import { z } from "zod";

export const ClienteSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	cnpj_cpf: z.string().min(11),
	razao_social: z.string().min(1),
	nome_fantasia: z.string().nullable().optional(),
	ativo: z.boolean().default(true),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type Cliente = z.infer<typeof ClienteSchema>;
