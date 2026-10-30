import { z } from "zod";
import {
	formatarInteiroComoDecimalBr,
	parseDecimalBrParaInteiro,
} from "../../../shared/domain/decimal-br";
import { mapearIssues } from "../../../shared/domain/formulario";
import {
	type ItemPreco,
	PrecoProdutoInputSchema,
	type PrecoProdutoInputValidado,
} from "./item-preco.schema";
import {
	type Produto,
	type ProdutoInput,
	ProdutoInputSchema,
} from "./produto.schema";
import type { TabelaPreco } from "./tabela-preco.schema";

/** Valores crus do formulário (sempre texto, como vêm dos inputs). */
export interface ProdutoFormValues {
	representada_id: string;
	sku: string;
	descricao: string;
	unidade_medida: string;
	multiplo_embalagem: string;
}

export type ProdutoFormErros = Partial<Record<keyof ProdutoFormValues, string>>;

export type ResultadoFormularioProduto =
	| { success: true; data: ProdutoInput }
	| { success: false; erros: ProdutoFormErros; geral: string | null };

const CAMPOS_FORMULARIO: ReadonlySet<string> = new Set<keyof ProdutoFormValues>(
	[
		"representada_id",
		"sku",
		"descricao",
		"unidade_medida",
		"multiplo_embalagem",
	],
);

function isCampoProdutoForm(chave: unknown): chave is keyof ProdutoFormValues {
	return typeof chave === "string" && CAMPOS_FORMULARIO.has(chave);
}

const SOMENTE_DIGITOS = /^\d+$/;

export function valoresIniciaisProdutoForm(
	produto?: Produto,
	representadaPadraoId = "",
): ProdutoFormValues {
	if (produto) {
		return {
			representada_id: produto.representada_id,
			sku: produto.sku,
			descricao: produto.descricao,
			unidade_medida: produto.unidade_medida,
			multiplo_embalagem: String(produto.multiplo_embalagem),
		};
	}

	return {
		representada_id: representadaPadraoId,
		sku: "",
		descricao: "",
		unidade_medida: "UN",
		multiplo_embalagem: "1",
	};
}

/** Converte e valida os valores do formulário em um input de domínio. */
export function validarFormularioProduto(
	valores: ProdutoFormValues,
): ResultadoFormularioProduto {
	const errosConversao: ProdutoFormErros = {};

	const multiploTexto = valores.multiplo_embalagem.trim();
	let multiplo: number | null = null;
	if (multiploTexto !== "") {
		if (SOMENTE_DIGITOS.test(multiploTexto)) {
			multiplo = Number(multiploTexto);
		} else {
			errosConversao.multiplo_embalagem =
				"Informe um número inteiro maior que zero (ex: 6)";
		}
	}

	const resultado = ProdutoInputSchema.safeParse({
		representada_id: valores.representada_id,
		sku: valores.sku,
		descricao: valores.descricao,
		unidade_medida: valores.unidade_medida,
		multiplo_embalagem: multiplo,
	});

	if (resultado.success && Object.keys(errosConversao).length === 0) {
		return { success: true, data: resultado.data };
	}

	const { erros, geral } = mapearIssues(
		resultado.success ? [] : resultado.error.issues,
		(caminho) => (isCampoProdutoForm(caminho[0]) ? caminho[0] : undefined),
		errosConversao,
	);
	return { success: false, erros, geral };
}

/** Linha de preço do produto por tabela da representada no formulário. */
export interface PrecoTabelaFormValues {
	tabela_id: string;
	nome_tabela: string;
	vigencia_inicio: string;
	vigencia_fim: string | null;
	preco_base: string;
	desconto_maximo: string;
}

export type CampoPrecoTabelaForm = "preco_base" | "desconto_maximo";
export type PrecosProdutoFormErros = Partial<Record<string, string>>;

export type ResultadoPrecosProdutoForm =
	| { success: true; data: PrecoProdutoInputValidado[] }
	| { success: false; erros: PrecosProdutoFormErros; geral: string | null };

export function chaveErroPrecoTabela(
	tabelaId: string,
	campo: CampoPrecoTabelaForm,
): string {
	return `precos.${tabelaId}.${campo}`;
}

export function valoresIniciaisPrecosProdutoForm(
	tabelas: readonly TabelaPreco[],
	itensPorTabela: ReadonlyMap<string, ItemPreco>,
): PrecoTabelaFormValues[] {
	return tabelas.map((tabela) => {
		const item = itensPorTabela.get(tabela.id);
		return {
			tabela_id: tabela.id,
			nome_tabela: tabela.nome_tabela,
			vigencia_inicio: tabela.vigencia_inicio,
			vigencia_fim: tabela.vigencia_fim ?? null,
			preco_base: item
				? formatarInteiroComoDecimalBr(item.preco_base_centavos)
				: "",
			desconto_maximo: item
				? formatarInteiroComoDecimalBr(item.desconto_maximo_permitido)
				: "",
		};
	});
}

const ListaPrecosInputSchema = z.array(PrecoProdutoInputSchema);

export function validarPrecosProdutoForm(
	valores: readonly PrecoTabelaFormValues[],
): ResultadoPrecosProdutoForm {
	const errosConversao: PrecosProdutoFormErros = {};

	const convertidos = valores.map((linha) => {
		const precoTexto = linha.preco_base.trim();
		let precoCentavos: number | null = null;
		if (precoTexto !== "") {
			const parsed = parseDecimalBrParaInteiro(precoTexto);
			if (parsed === null) {
				errosConversao[chaveErroPrecoTabela(linha.tabela_id, "preco_base")] =
					"Informe um preço válido (ex: 25,90)";
			} else {
				precoCentavos = parsed;
			}
		}

		const descontoTexto = linha.desconto_maximo.trim();
		let descontoCentesimos = 0;
		if (descontoTexto !== "") {
			const parsed = parseDecimalBrParaInteiro(descontoTexto);
			if (parsed === null) {
				errosConversao[
					chaveErroPrecoTabela(linha.tabela_id, "desconto_maximo")
				] = "Informe um percentual válido (ex: 5,00)";
			} else {
				descontoCentesimos = parsed;
			}
		}

		return {
			tabela_id: linha.tabela_id,
			preco_base_centavos: precoCentavos,
			desconto_maximo_permitido: descontoCentesimos,
		};
	});

	const resultado = ListaPrecosInputSchema.safeParse(convertidos);

	if (resultado.success && Object.keys(errosConversao).length === 0) {
		return { success: true, data: resultado.data };
	}

	const { erros, geral } = mapearIssues(
		resultado.success ? [] : resultado.error.issues,
		(caminho) => {
			const [indice, campo] = caminho;
			if (typeof indice !== "number") return undefined;
			const tabelaId = valores[indice]?.tabela_id;
			if (!tabelaId) return undefined;
			if (campo === "preco_base_centavos") {
				return chaveErroPrecoTabela(tabelaId, "preco_base");
			}
			if (campo === "desconto_maximo_permitido") {
				return chaveErroPrecoTabela(tabelaId, "desconto_maximo");
			}
			return undefined;
		},
		errosConversao,
	);

	return { success: false, erros, geral };
}
