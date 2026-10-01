import { z } from "zod";

export const PedidoSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	cliente_id: z.string().uuid(),
	representada_id: z.string().uuid(),
	tabela_id: z.string().uuid(),
	endereco_entrega_id: z.string().uuid().nullable().optional(),
	contato_id: z.string().uuid().nullable().optional(),
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

export type Pedido = z.infer<typeof PedidoSchema>;
