import { z } from "zod";

export const ProdutoSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	representada_id: z.string().uuid(),
	sku: z.string().min(1),
	descricao: z.string().min(1),
	unidade_medida: z.string().min(1),
	multiplo_embalagem: z.number().int().positive().nullable().optional(),
	ativo: z.boolean(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type Produto = z.infer<typeof ProdutoSchema>;
