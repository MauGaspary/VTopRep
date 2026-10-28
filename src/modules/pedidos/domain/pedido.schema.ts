import { z } from "zod";
import {
	CamposSincronizaveisSchema,
	TimestampSchema,
} from "../../../shared/domain/datas";
import { TipoFreteSchema } from "../../../shared/domain/frete";

export const PedidoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		cliente_id: z.string().uuid(),
		representada_id: z.string().uuid(),
		tabela_id: z.string().uuid(),
		endereco_entrega_id: z.string().uuid().nullable().optional(),
		contato_id: z.string().uuid().nullable().optional(),
		data_emissao: TimestampSchema,
		condicao_pagamento: z.string().min(1),
		/** Herdável de `representadas.regras_frete_padrao` (mesmo domínio de valores). */
		tipo_frete: TipoFreteSchema,
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
	})
	.extend(CamposSincronizaveisSchema.shape);

export type Pedido = z.infer<typeof PedidoSchema>;
