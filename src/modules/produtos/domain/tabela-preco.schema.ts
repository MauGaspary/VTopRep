import { z } from "zod";

export const TabelaPrecoSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	representada_id: z.string().uuid(),
	nome_tabela: z.string().min(1),
	vigencia_inicio: z.string(),
	vigencia_fim: z.string().nullable().optional(),
	ativo: z.boolean().default(true),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type TabelaPreco = z.infer<typeof TabelaPrecoSchema>;
