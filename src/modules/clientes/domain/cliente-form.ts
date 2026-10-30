import { z } from "zod";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { mapearIssues } from "../../../shared/domain/formulario";
import type { ClienteCompleto } from "./cliente";
import {
	ClienteInputSchema,
	type ClienteInputValidado,
} from "./cliente.schema";
import {
	ClienteContatoInputSchema,
	type ClienteContatoInputValidado,
} from "./cliente-contato.schema";
import {
	ClienteEnderecoInputSchema,
	type ClienteEnderecoInputValidado,
} from "./cliente-endereco.schema";

/** Linha de endereço do formulário. `localId` só serve de `key` na UI. */
export interface EnderecoFormValues {
	localId: string;
	id?: string;
	tipo_endereco: string;
	endereco_completo: string;
	/** Não editáveis no formulário; preservados na edição. */
	latitude?: number | null;
	longitude?: number | null;
}

/** Linha de contato do formulário. `papel` vazio significa "sem papel". */
export interface ContatoFormValues {
	localId: string;
	id?: string;
	nome: string;
	papel: string;
	telefone_whatsapp: string;
	email: string;
}

export interface ClienteFormValues {
	cnpj_cpf: string;
	razao_social: string;
	nome_fantasia: string;
	enderecos: EnderecoFormValues[];
	contatos: ContatoFormValues[];
}

export type CampoEnderecoForm = "tipo_endereco" | "endereco_completo";
export type CampoContatoForm = "nome" | "papel" | "telefone_whatsapp" | "email";

/** Chaves: `cnpj_cpf`, `razao_social`, `nome_fantasia`, `enderecos.<i>.<campo>`, `contatos.<i>.<campo>`. */
export type ClienteFormErros = Partial<Record<string, string>>;

export interface ClienteFormDados {
	cliente: ClienteInputValidado;
	enderecos: ClienteEnderecoInputValidado[];
	contatos: ClienteContatoInputValidado[];
}

export type ResultadoFormularioCliente =
	| { success: true; data: ClienteFormDados }
	| { success: false; erros: ClienteFormErros; geral: string | null };

export function chaveErroEndereco(
	indice: number,
	campo: CampoEnderecoForm,
): string {
	return `enderecos.${indice}.${campo}`;
}

export function chaveErroContato(
	indice: number,
	campo: CampoContatoForm,
): string {
	return `contatos.${indice}.${campo}`;
}

const CAMPOS_CLIENTE = new Set(["cnpj_cpf", "razao_social", "nome_fantasia"]);
const CAMPOS_ENDERECO = new Set<string>(["tipo_endereco", "endereco_completo"]);
const CAMPOS_CONTATO = new Set<string>([
	"nome",
	"papel",
	"telefone_whatsapp",
	"email",
]);

const FormularioClienteSchema = z.object({
	cliente: ClienteInputSchema,
	enderecos: z.array(ClienteEnderecoInputSchema),
	contatos: z.array(ClienteContatoInputSchema),
});

function campoDoCaminho(caminho: readonly PropertyKey[]): string | undefined {
	const [grupo, indiceOuCampo, campo] = caminho;
	if (grupo === "cliente" && typeof indiceOuCampo === "string") {
		return CAMPOS_CLIENTE.has(indiceOuCampo) ? indiceOuCampo : undefined;
	}
	if (typeof indiceOuCampo !== "number" || typeof campo !== "string") {
		return undefined;
	}
	if (grupo === "enderecos" && CAMPOS_ENDERECO.has(campo)) {
		return `enderecos.${indiceOuCampo}.${campo}`;
	}
	if (grupo === "contatos" && CAMPOS_CONTATO.has(campo)) {
		return `contatos.${indiceOuCampo}.${campo}`;
	}
	return undefined;
}

export function novoEnderecoForm(gerarId: () => string): EnderecoFormValues {
	return {
		localId: gerarId(),
		tipo_endereco: "PRINCIPAL",
		endereco_completo: "",
	};
}

export function novoContatoForm(gerarId: () => string): ContatoFormValues {
	return {
		localId: gerarId(),
		nome: "",
		papel: "COMPRADOR",
		telefone_whatsapp: "",
		email: "",
	};
}

export function valoresIniciaisClienteForm(
	dados?: ClienteCompleto,
): ClienteFormValues {
	if (!dados) {
		return {
			cnpj_cpf: "",
			razao_social: "",
			nome_fantasia: "",
			enderecos: [],
			contatos: [],
		};
	}

	return {
		cnpj_cpf: formatarCpfCnpj(dados.cliente.cnpj_cpf),
		razao_social: dados.cliente.razao_social,
		nome_fantasia: dados.cliente.nome_fantasia ?? "",
		enderecos: dados.enderecos.map((e) => ({
			localId: e.id,
			id: e.id,
			tipo_endereco: e.tipo_endereco,
			endereco_completo: e.endereco_completo,
			latitude: e.latitude,
			longitude: e.longitude,
		})),
		contatos: dados.contatos.map((c) => ({
			localId: c.id,
			id: c.id,
			nome: c.nome,
			papel: c.papel ?? "",
			telefone_whatsapp: c.telefone_whatsapp,
			email: c.email ?? "",
		})),
	};
}

const PARECE_DOCUMENTO = /^[\d.\-/\s]+$/;

/**
 * Valores iniciais para o cadastro rápido de cliente dentro do orçamento,
 * reaproveitando o texto que o representante já havia digitado no Combobox.
 */
export function valoresIniciaisCadastroRapidoCliente(
	termoDigitado?: string,
): ClienteFormValues {
	const limpo = termoDigitado?.trim() ?? "";
	if (limpo === "") {
		return valoresIniciaisClienteForm();
	}
	if (PARECE_DOCUMENTO.test(limpo) && /\d/.test(limpo)) {
		return {
			cnpj_cpf: limpo,
			razao_social: "",
			nome_fantasia: "",
			enderecos: [],
			contatos: [],
		};
	}
	return {
		cnpj_cpf: "",
		razao_social: limpo,
		nome_fantasia: limpo,
		enderecos: [],
		contatos: [],
	};
}

/** Converte e valida o formulário completo (cliente + endereços + contatos). */
export function validarFormularioCliente(
	valores: ClienteFormValues,
): ResultadoFormularioCliente {
	const errosConversao: ClienteFormErros = {};
	if (valores.cnpj_cpf.trim() === "") {
		errosConversao.cnpj_cpf = "CPF ou CNPJ é obrigatório";
	}

	const resultado = FormularioClienteSchema.safeParse({
		cliente: {
			cnpj_cpf: valores.cnpj_cpf,
			razao_social: valores.razao_social,
			nome_fantasia: valores.nome_fantasia,
		},
		enderecos: valores.enderecos.map((e) => ({
			id: e.id,
			tipo_endereco: e.tipo_endereco,
			endereco_completo: e.endereco_completo,
			latitude: e.latitude,
			longitude: e.longitude,
		})),
		contatos: valores.contatos.map((c) => ({
			id: c.id,
			nome: c.nome,
			papel: c.papel === "" ? null : c.papel,
			telefone_whatsapp: c.telefone_whatsapp,
			email: c.email,
		})),
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
