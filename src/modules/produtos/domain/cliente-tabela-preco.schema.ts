import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";

/**
 * Tabela de preço padrão de um cliente para uma representada. No máximo um
 * registro vivo (sem `deleted_at`) por `tenant_id + cliente_id + representada_id`.
 * `representada_id` repete o da tabela para permitir a consulta por índice.
 */
export const ClienteTabelaPrecoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		cliente_id: z.string().uuid(),
		representada_id: z.string().uuid(),
		tabela_id: z.string().uuid(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type ClienteTabelaPreco = z.infer<typeof ClienteTabelaPrecoSchema>;
