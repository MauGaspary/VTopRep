import { mapearIssues } from "../../../shared/domain/formulario";
import {
	type Produto,
	type ProdutoInput,
	ProdutoInputSchema,
} from "./produto.schema";

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
