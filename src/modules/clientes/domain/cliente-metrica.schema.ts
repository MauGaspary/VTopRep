import { z } from "zod";

export const ClienteMetricaSchema = z.object({
	cliente_id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	data_ultima_compra: z.string().nullable().optional(),
	frequencia_recompra_dias: z.number().int().positive().default(30),
	curva_abc: z.enum(["A", "B", "C"]).nullable().optional(),
	ticket_medio_centavos: z.number().int().nonnegative().default(0),
});

export type ClienteMetrica = z.infer<typeof ClienteMetricaSchema>;
