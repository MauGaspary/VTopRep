import { z } from "zod";
import {
	CamposSincronizaveisSchema,
	DataSchema,
} from "../../../shared/domain/datas";

const MENSAGEM_FIM_ANTES_DO_INICIO =
	"Fim da vigência não pode ser anterior ao início";

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
		message: MENSAGEM_FIM_ANTES_DO_INICIO,
		path: ["vigencia_fim"],
	});

export type TabelaPreco = z.infer<typeof TabelaPrecoSchema>;

/**
 * Dados editáveis de uma tabela no cadastro da representada.
 * `id` presente = tabela já existente da representada (edição).
 */
export const TabelaPrecoInputSchema = z
	.object({
		id: z.string().uuid().optional(),
		nome_tabela: z
			.string()
			.trim()
			.min(1, "Nome da tabela é obrigatório")
			.max(80, "Nome da tabela deve ter no máximo 80 caracteres"),
		vigencia_inicio: DataSchema,
		vigencia_fim: DataSchema.nullable().optional(),
		ativo: z.boolean().default(true),
	})
	.refine((t) => !t.vigencia_fim || t.vigencia_fim >= t.vigencia_inicio, {
		message: MENSAGEM_FIM_ANTES_DO_INICIO,
		path: ["vigencia_fim"],
	});

export type TabelaPrecoInput = z.input<typeof TabelaPrecoInputSchema>;
export type TabelaPrecoInputValidado = z.output<typeof TabelaPrecoInputSchema>;
