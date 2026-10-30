import { z } from "zod";
import {
	isCpfOuCnpjValido,
	normalizarCpfCnpj,
} from "../../../shared/domain/cpf-cnpj";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";

export const TIPOS_CLIENTE = ["REVENDA", "FABRICA"] as const;

export const TipoClienteSchema = z.enum(TIPOS_CLIENTE, {
	error: "Selecione o segmento do cliente (Revenda ou Fábrica)",
});

export type TipoCliente = z.infer<typeof TipoClienteSchema>;

export const ROTULOS_TIPO_CLIENTE: Record<TipoCliente, string> = {
	REVENDA: "Revenda",
	FABRICA: "Fábrica",
};

const DocumentoCpfCnpjSchema = z
	.string()
	.transform(normalizarCpfCnpj)
	.refine(isCpfOuCnpjValido, "CPF ou CNPJ inválido");

export const ClienteSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		/** Normalizado. Único entre clientes do tenant (bloqueante). */
		cnpj_cpf: z
			.string()
			.regex(
				/^[A-Z0-9]{11}$|^[A-Z0-9]{14}$/,
				"Documento deve ter 11 (CPF) ou 14 (CNPJ) caracteres",
			)
			.refine(isCpfOuCnpjValido, "CPF ou CNPJ inválido"),
		/** Pode repetir (filiais): a UI apenas avisa. */
		razao_social: z.string().trim().min(1, "Razão social / Nome é obrigatório"),
		nome_fantasia: z.string().trim().nullable().optional(),
		/** Segmento comercial que determina a alíquota de comissão na representada. */
		tipo_cliente: TipoClienteSchema.default("REVENDA"),
		/** Estado de negócio (reversível). Inativos aparecem na lista de inativos. */
		ativo: z.boolean(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type Cliente = z.infer<typeof ClienteSchema>;

export const ClienteInputSchema = z.object({
	cnpj_cpf: DocumentoCpfCnpjSchema,
	razao_social: z.string().trim().min(1, "Razão social / Nome é obrigatório"),
	nome_fantasia: z
		.string()
		.trim()
		.optional()
		.nullable()
		.transform((val) => (val && val.length > 0 ? val : null)),
	tipo_cliente: TipoClienteSchema.default("REVENDA"),
});

export type ClienteInput = z.input<typeof ClienteInputSchema>;
export type ClienteInputValidado = z.output<typeof ClienteInputSchema>;
