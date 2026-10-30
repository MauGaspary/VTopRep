import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";

export const QuantidadeItemPedidoSchema = z
	.number()
	.int("Quantidade deve ser um número inteiro")
	.positive("Quantidade deve ser maior que zero");

export const PrecoUnitarioCentavosSchema = z
	.number()
	.int("Preço unitário deve ser um inteiro em centavos")
	.nonnegative("Preço unitário não pode ser negativo");

/**
 * Desconto em centésimos de % (1500 = 15,00%). É a fonte da verdade:
 * `preco_liquido_unitario_centavos` deriva dele com arredondamento half-even.
 */
export const PercentualDescontoSchema = z
	.number()
	.int("Desconto deve ser um inteiro em centésimos de percentual")
	.min(0, "Desconto não pode ser negativo")
	.max(CEM_POR_CENTO_CENTESIMOS, "Desconto não pode exceder 100%");

export const ItemPedidoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		pedido_id: z.string().uuid(),
		produto_id: z.string().uuid(),
		quantidade: QuantidadeItemPedidoSchema,
		preco_unitario_tabela_centavos: PrecoUnitarioCentavosSchema,
		percentual_desconto: PercentualDescontoSchema,
		preco_liquido_unitario_centavos: z.number().int().nonnegative(),
		subtotal_centavos: z.number().int().nonnegative(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type ItemPedido = z.infer<typeof ItemPedidoSchema>;

/** Dados financeiros mínimos para calcular um item do orçamento/pedido. */
export const ItemPedidoCalculoInputSchema = z.object({
	quantidade: QuantidadeItemPedidoSchema,
	preco_unitario_tabela_centavos: PrecoUnitarioCentavosSchema,
	percentual_desconto: PercentualDescontoSchema.default(0),
});

export type ItemPedidoCalculoInput = z.input<
	typeof ItemPedidoCalculoInputSchema
>;

/** `id` presente = item já existente do rascunho de pedido (edição). */
export const ItemPedidoInputSchema = ItemPedidoCalculoInputSchema.extend({
	id: z.string().uuid().optional(),
	produto_id: z.string().uuid("Selecione um produto válido"),
});

export type ItemPedidoInput = z.input<typeof ItemPedidoInputSchema>;
export type ItemPedidoInputValidado = z.output<typeof ItemPedidoInputSchema>;
