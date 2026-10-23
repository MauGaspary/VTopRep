import { formatarCnpj } from "../../../shared/domain/cnpj";
import {
	formatarInteiroComoDecimalBr,
	parseDecimalBrParaInteiro,
} from "../../../shared/domain/decimal-br";
import {
	type RegraFrete,
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
	| { success: false; erros: RepresentadaFormErros };

export const ROTULOS_FRETE: Record<RegraFrete, string> = {
	CIF: "CIF (frete pago pela fábrica)",
	FOB: "FOB (frete pago pelo cliente)",
	FOB_REDESPACHO: "FOB Redespacho",
};

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

/** Converte e valida os valores do formulário em um input de domínio. */
export function validarFormularioRepresentada(
	valores: RepresentadaFormValues,
): ResultadoFormulario {
	const erros: RepresentadaFormErros = {};

	const percentual = parseDecimalBrParaInteiro(valores.percentual_comissao);
	if (percentual === null) {
		erros.percentual_comissao = "Informe um percentual válido (ex: 5,00)";
	}

	const pedidoMinimo =
		valores.valor_pedido_minimo.trim() === ""
			? 0
			: parseDecimalBrParaInteiro(valores.valor_pedido_minimo);
	if (pedidoMinimo === null) {
		erros.valor_pedido_minimo = "Informe um valor válido (ex: 1.500,00)";
	}

	const resultado = RepresentadaInputSchema.safeParse({
		razao_social: valores.razao_social,
		nome_fantasia: valores.nome_fantasia,
		cnpj: valores.cnpj,
		percentual_comissao_padrao: percentual ?? 0,
		valor_pedido_minimo_centavos: pedidoMinimo ?? 0,
		regras_frete_padrao: valores.regras_frete_padrao,
	});

	if (!resultado.success) {
		for (const issue of resultado.error.issues) {
			const chave = issue.path[0];
			const campo =
				typeof chave === "string" ? CAMPO_POR_PATH[chave] : undefined;
			if (campo && erros[campo] === undefined) {
				erros[campo] = issue.message;
			}
		}
	}

	if (Object.keys(erros).length > 0 || !resultado.success) {
		return { success: false, erros };
	}

	return { success: true, data: resultado.data };
}
