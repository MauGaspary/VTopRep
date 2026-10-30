import { z } from "zod";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import {
	formatarInteiroComoDecimalBr,
	parseDecimalBrParaInteiro,
} from "../../../shared/domain/decimal-br";
import { mapearIssues } from "../../../shared/domain/formulario";
import { NOME_TABELA_PADRAO } from "../../produtos/domain/tabela-preco";
import {
	type TabelaPreco,
	TabelaPrecoInputSchema,
	type TabelaPrecoInputValidado,
} from "../../produtos/domain/tabela-preco.schema";
import {
	type Representada,
	RepresentadaInputSchema,
	type RepresentadaInputValidado,
} from "./representada.schema";

/** Valores crus do formulário (sempre texto, como vêm dos inputs). */
export interface RepresentadaFormValues {
	razao_social: string;
	nome_fantasia: string;
	cnpj: string;
	percentual_comissao: string;
	valor_pedido_minimo: string;
	regras_frete_padrao: string;
}

export type RepresentadaFormErros = Partial<
	Record<keyof RepresentadaFormValues, string>
>;

export type ResultadoFormulario =
	| { success: true; data: RepresentadaInputValidado }
	| { success: false; erros: RepresentadaFormErros; geral: string | null };

export function valoresIniciaisFormulario(
	representada?: Representada,
): RepresentadaFormValues {
	if (!representada) {
		return {
			razao_social: "",
			nome_fantasia: "",
			cnpj: "",
			percentual_comissao: "",
			valor_pedido_minimo: "",
			regras_frete_padrao: "CIF",
		};
	}
	return {
		razao_social: representada.razao_social,
		nome_fantasia: representada.nome_fantasia,
		cnpj: formatarCnpj(representada.cnpj),
		percentual_comissao: formatarInteiroComoDecimalBr(
			representada.percentual_comissao_padrao,
		),
		valor_pedido_minimo: formatarInteiroComoDecimalBr(
			representada.valor_pedido_minimo_centavos,
		),
		regras_frete_padrao: representada.regras_frete_padrao,
	};
}

const CAMPO_POR_PATH: Record<string, keyof RepresentadaFormValues> = {
	razao_social: "razao_social",
	nome_fantasia: "nome_fantasia",
	cnpj: "cnpj",
	percentual_comissao_padrao: "percentual_comissao",
	valor_pedido_minimo_centavos: "valor_pedido_minimo",
	regras_frete_padrao: "regras_frete_padrao",
};

function campoDoCaminho(
	caminho: readonly PropertyKey[],
): keyof RepresentadaFormValues | undefined {
	const chave = caminho[0];
	return typeof chave === "string" ? CAMPO_POR_PATH[chave] : undefined;
}

/** Converte e valida os valores do formulário em um input de domínio. */
export function validarFormularioRepresentada(
	valores: RepresentadaFormValues,
): ResultadoFormulario {
	const errosConversao: RepresentadaFormErros = {};

	const percentual = parseDecimalBrParaInteiro(valores.percentual_comissao);
	if (percentual === null) {
		errosConversao.percentual_comissao =
			"Informe um percentual válido (ex: 5,00)";
	}

	const pedidoMinimo =
		valores.valor_pedido_minimo.trim() === ""
			? 0
			: parseDecimalBrParaInteiro(valores.valor_pedido_minimo);
	if (pedidoMinimo === null) {
		errosConversao.valor_pedido_minimo =
			"Informe um valor válido (ex: 1.500,00)";
	}

	const resultado = RepresentadaInputSchema.safeParse({
		razao_social: valores.razao_social,
		nome_fantasia: valores.nome_fantasia,
		cnpj: valores.cnpj,
		percentual_comissao_padrao: percentual ?? 0,
		valor_pedido_minimo_centavos: pedidoMinimo ?? 0,
		regras_frete_padrao: valores.regras_frete_padrao,
	});

	if (resultado.success && Object.keys(errosConversao).length === 0) {
		return { success: true, data: resultado.data };
	}

	const { erros, geral } = mapearIssues(
		resultado.success ? [] : resultado.error.issues,
		campoDoCaminho,
		errosConversao,
	);
	return { success: false, erros, geral };
}

/** Linha de tabela de preço no formulário da representada. */
export interface TabelaPrecoFormValues {
	localId: string;
	id?: string;
	nome_tabela: string;
	vigencia_inicio: string;
	vigencia_fim: string;
	ativo: boolean;
}

export type CampoTabelaPrecoForm =
	| "nome_tabela"
	| "vigencia_inicio"
	| "vigencia_fim";

export type TabelasPrecoFormErros = Partial<Record<string, string>>;

export type ResultadoTabelasPrecoForm =
	| { success: true; data: TabelaPrecoInputValidado[] }
	| { success: false; erros: TabelasPrecoFormErros; geral: string | null };

export function chaveErroTabelaPreco(
	indice: number,
	campo: CampoTabelaPrecoForm,
): string {
	return `tabelas.${indice}.${campo}`;
}

export function novaTabelaPrecoForm(
	gerarId: () => string,
	hoje: string,
	nome = "",
): TabelaPrecoFormValues {
	return {
		localId: gerarId(),
		nome_tabela: nome,
		vigencia_inicio: hoje,
		vigencia_fim: "",
		ativo: true,
	};
}

export function valoresIniciaisTabelasPrecoForm(
	tabelas: readonly TabelaPreco[] | undefined,
	hoje: string,
	gerarId: () => string = () => crypto.randomUUID(),
): TabelaPrecoFormValues[] {
	if (!tabelas || tabelas.length === 0) {
		return [novaTabelaPrecoForm(gerarId, hoje, NOME_TABELA_PADRAO)];
	}
	return tabelas.map((t) => ({
		localId: t.id,
		id: t.id,
		nome_tabela: t.nome_tabela,
		vigencia_inicio: t.vigencia_inicio,
		vigencia_fim: t.vigencia_fim ?? "",
		ativo: t.ativo,
	}));
}

const CAMPOS_TABELA: ReadonlySet<string> = new Set<CampoTabelaPrecoForm>([
	"nome_tabela",
	"vigencia_inicio",
	"vigencia_fim",
]);

function isCampoTabelaPrecoForm(valor: unknown): valor is CampoTabelaPrecoForm {
	return typeof valor === "string" && CAMPOS_TABELA.has(valor);
}

const ListaTabelasInputSchema = z.array(TabelaPrecoInputSchema);

export function validarTabelasPrecoForm(
	tabelas: readonly TabelaPrecoFormValues[],
): ResultadoTabelasPrecoForm {
	if (tabelas.length === 0) {
		return {
			success: false,
			erros: {},
			geral: "Mantenha pelo menos uma tabela de preço na representada",
		};
	}

	const resultado = ListaTabelasInputSchema.safeParse(
		tabelas.map((t) => ({
			id: t.id,
			nome_tabela: t.nome_tabela,
			vigencia_inicio: t.vigencia_inicio.trim(),
			vigencia_fim: t.vigencia_fim.trim() === "" ? null : t.vigencia_fim.trim(),
			ativo: t.ativo,
		})),
	);

	if (resultado.success) {
		return { success: true, data: resultado.data };
	}

	const { erros, geral } = mapearIssues(resultado.error.issues, (caminho) => {
		const [indice, campo] = caminho;
		if (typeof indice === "number" && isCampoTabelaPrecoForm(campo)) {
			return chaveErroTabelaPreco(indice, campo);
		}
		return undefined;
	});

	return { success: false, erros, geral };
}
