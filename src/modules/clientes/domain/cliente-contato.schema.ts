import { z } from "zod";

export const ClienteContatoSchema = z.object({
	id: z.string().uuid(),
	cliente_id: z.string().uuid(),
	nome: z.string().min(1),
	papel: z.enum(["COMPRADOR", "FINANCEIRO", "DIRETORIA"]).nullable().optional(),
	telefone_whatsapp: z.string().min(1),
	email: z.string().email().nullable().optional(),
});

export type ClienteContato = z.infer<typeof ClienteContatoSchema>;
