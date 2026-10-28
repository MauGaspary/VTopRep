import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";

export const ItemPedidoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		pedido_id: z.string().uuid(),
		produto_id: z.string().uuid(),
		quantidade: z.number().int().positive(),
		preco_unitario_tabela_centavos: z.number().int().nonnegative(),
		/**
		 * Desconto em centésimos de % (1500 = 15,00%). É a fonte da verdade:
		 * `preco_liquido_unitario_centavos` deriva dele com arredondamento half-even.
		 */
		percentual_desconto: z
			.number()
			.int()
			.min(0, "Desconto não pode ser negativo")
			.max(CEM_POR_CENTO_CENTESIMOS, "Desconto não pode exceder 100%"),
		preco_liquido_unitario_centavos: z.number().int().nonnegative(),
		subtotal_centavos: z.number().int().nonnegative(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type ItemPedido = z.infer<typeof ItemPedidoSchema>;
