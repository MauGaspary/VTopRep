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

export const PedidoSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	cliente_id: z.string().uuid(),
	representada_id: z.string().uuid(),
	tabela_id: z.string().uuid(),
	data_emissao: z.string(),
	condicao_pagamento: z.string().min(1),
	tipo_frete: z.enum(["CIF", "FOB"]),
	status: z.enum([
		"rascunho",
		"emitido",
		"parcialmente_faturado",
		"faturado_total",
		"cancelado",
	]),
	valor_total_centavos: z.number().int().nonnegative(),
	comissao_projetada_centavos: z.number().int().nonnegative(),
	observacoes: z.string().nullable(),
	idempotency_key: z.string().uuid(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type ItemPedido = z.infer<typeof ItemPedidoSchema>;
export type Pedido = z.infer<typeof PedidoSchema>;
