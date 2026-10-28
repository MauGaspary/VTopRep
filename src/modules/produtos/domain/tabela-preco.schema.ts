import { z } from "zod";
import {
	CamposSincronizaveisSchema,
	DataSchema,
} from "../../../shared/domain/datas";

export const TabelaPrecoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		representada_id: z.string().uuid(),
		nome_tabela: z.string().min(1),
		vigencia_inicio: DataSchema,
		/** `null` = vigência em aberto. */
		vigencia_fim: DataSchema.nullable().optional(),
		ativo: z.boolean().default(true),
	})
	.extend(CamposSincronizaveisSchema.shape)
	.refine((t) => !t.vigencia_fim || t.vigencia_fim >= t.vigencia_inicio, {
		message: "Fim da vigência não pode ser anterior ao início",
		path: ["vigencia_fim"],
	});

export type TabelaPreco = z.infer<typeof TabelaPrecoSchema>;
