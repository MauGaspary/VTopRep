import { z } from "zod";

export const ItemPedidoSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	pedido_id: z.string().uuid(),
	produto_id: z.string().uuid(),
	quantidade: z.number().int().positive(),
	preco_unitario_tabela_centavos: z.number().int().nonnegative(),
	percentual_desconto: z.number().int().nonnegative(),
	preco_liquido_unitario_centavos: z.number().int().nonnegative(),
	subtotal_centavos: z.number().int().nonnegative(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type ItemPedido = z.infer<typeof ItemPedidoSchema>;
