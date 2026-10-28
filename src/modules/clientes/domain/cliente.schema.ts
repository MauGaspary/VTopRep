import { z } from "zod";
import {
	isCpfOuCnpjValido,
	normalizarCpfCnpj,
} from "../../../shared/domain/cpf-cnpj";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";

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
});

export type ClienteInput = z.input<typeof ClienteInputSchema>;
export type ClienteInputValidado = z.output<typeof ClienteInputSchema>;
