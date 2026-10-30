import { z } from "zod";
import {
	CamposSincronizaveisSchema,
	TimestampSchema,
} from "../../../shared/domain/datas";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";
import { TipoFreteSchema } from "../../../shared/domain/frete";
import { ItemPedidoInputSchema } from "./item-pedido.schema";

export const STATUS_PEDIDO = [
	"rascunho",
	"emitido",
	"parcialmente_faturado",
	"faturado_total",
	"cancelado",
] as const;

export const StatusPedidoSchema = z.enum(STATUS_PEDIDO);
export type StatusPedido = z.infer<typeof StatusPedidoSchema>;

export const ROTULOS_STATUS_PEDIDO: Record<StatusPedido, string> = {
	rascunho: "Orçamento",
	emitido: "Emitido",
	parcialmente_faturado: "Faturado Parcial",
	faturado_total: "Faturado Total",
	cancelado: "Cancelado",
};

export const CONDICOES_PAGAMENTO_PADRAO = [
	"À vista",
	"7 dias",
	"14 dias",
	"28 dias",
	"30 dias",
	"30/60 dias",
	"30/60/90 dias",
] as const;

export const PercentualComissaoSchema = z
	.number()
	.int("Comissão deve ser um inteiro em centésimos de percentual")
	.min(0, "Comissão não pode ser negativa")
	.max(CEM_POR_CENTO_CENTESIMOS, "Comissão não pode exceder 100%");

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
		status: StatusPedidoSchema,
		valor_total_centavos: z.number().int().nonnegative(),
		comissao_projetada_centavos: z.number().int().nonnegative(),
		observacoes: z.string().nullable(),
		idempotency_key: z.string().uuid(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type Pedido = z.infer<typeof PedidoSchema>;

const IdOpcionalSchema = z
	.string()
	.trim()
	.nullish()
	.transform((v) => (v && v.length > 0 ? v : null))
	.refine((v) => v === null || z.uuid().safeParse(v).success, {
		message: "Identificador inválido",
	});

export const PedidoInputSchema = z.object({
	cliente_id: z.string().uuid("Selecione um cliente"),
	representada_id: z.string().uuid("Selecione uma representada"),
	tabela_id: z.string().uuid("Selecione uma tabela de preço"),
	endereco_entrega_id: IdOpcionalSchema,
	contato_id: IdOpcionalSchema,
	condicao_pagamento: z
		.string()
		.trim()
		.min(1, "Informe a condição de pagamento"),
	tipo_frete: TipoFreteSchema,
	observacoes: z
		.string()
		.trim()
		.nullish()
		.transform((v) => (v && v.length > 0 ? v : null)),
	itens: z
		.array(ItemPedidoInputSchema)
		.min(1, "Adicione pelo menos um item ao orçamento"),
});

export type PedidoInput = z.input<typeof PedidoInputSchema>;
export type PedidoInputValidado = z.output<typeof PedidoInputSchema>;
