import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";

export const ItemPrecoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		tabela_id: z.string().uuid(),
		produto_id: z.string().uuid(),
		preco_base_centavos: z.number().int().nonnegative(),
		/** Centésimos de % (1500 = 15,00%). Informativo nesta fase (trava no BACKLOG). */
		desconto_maximo_permitido: z
			.number()
			.int()
			.min(0, "Desconto máximo não pode ser negativo")
			.max(CEM_POR_CENTO_CENTESIMOS, "Desconto máximo não pode exceder 100%")
			.default(0),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type ItemPreco = z.infer<typeof ItemPrecoSchema>;
