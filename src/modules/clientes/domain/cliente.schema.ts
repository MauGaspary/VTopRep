import { z } from "zod";

export const ClienteSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	cnpj_cpf: z.string().min(11),
	razao_social: z.string().min(1),
	nome_fantasia: z.string().min(1),
	contato_comprador: z.string().min(1),
	telefone_whatsapp: z.string().min(1),
	endereco_completo: z.string().min(1),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
	frequencia_recompra_dias_estimada: z.number().int().positive().default(30),
	data_ultima_compra: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type Cliente = z.infer<typeof ClienteSchema>;
