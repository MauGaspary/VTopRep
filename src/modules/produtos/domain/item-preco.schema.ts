import { z } from "zod";

export const ItemPrecoSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	tabela_id: z.string().uuid(),
	produto_id: z.string().uuid(),
	preco_base_centavos: z.number().int().nonnegative(),
	teto_desconto_permitido: z.number().int().nonnegative().default(0),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type ItemPreco = z.infer<typeof ItemPrecoSchema>;
