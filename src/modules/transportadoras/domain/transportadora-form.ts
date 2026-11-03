import { formatarCnpj } from "../../../shared/domain/cnpj";
import { mapearIssues } from "../../../shared/domain/formulario";
import {
	type Transportadora,
	TransportadoraInputSchema,
	type TransportadoraInputValidado,
} from "./transportadora.schema";

/** Valores crus do formulário (sempre texto, como vêm dos inputs). */
export interface TransportadoraFormValues {
	nome_fantasia: string;
	razao_social: string;
	cnpj: string;
	telefone: string;
	cidade_uf: string;
}

export type TransportadoraFormErros = Partial<
	Record<keyof TransportadoraFormValues, string>
>;

export type ResultadoFormularioTransportadora =
	| { success: true; data: TransportadoraInputValidado }
	| { success: false; erros: TransportadoraFormErros; geral: string | null };

const CAMPOS: ReadonlySet<string> = new Set<keyof TransportadoraFormValues>([
	"nome_fantasia",
	"razao_social",
	"cnpj",
	"telefone",
	"cidade_uf",
]);

function isCampoTransportadora(
	valor: unknown,
): valor is keyof TransportadoraFormValues {
	return typeof valor === "string" && CAMPOS.has(valor);
}

export function valoresIniciaisTransportadoraForm(
	transportadora?: Transportadora,
): TransportadoraFormValues {
	return {
		nome_fantasia: transportadora?.nome_fantasia ?? "",
		razao_social: transportadora?.razao_social ?? "",
		cnpj: transportadora?.cnpj ? formatarCnpj(transportadora.cnpj) : "",
		telefone: transportadora?.telefone ?? "",
		cidade_uf: transportadora?.cidade_uf ?? "",
	};
}

/** Converte e valida os valores do formulário em um input de domínio. */
export function validarFormularioTransportadora(
	valores: TransportadoraFormValues,
): ResultadoFormularioTransportadora {
	const resultado = TransportadoraInputSchema.safeParse(valores);
	if (resultado.success) {
		return { success: true, data: resultado.data };
	}

	const { erros, geral } = mapearIssues(resultado.error.issues, (caminho) => {
		const campo = caminho[0];
		return isCampoTransportadora(campo) ? campo : undefined;
	});
	return { success: false, erros, geral };
}
