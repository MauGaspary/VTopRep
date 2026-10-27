import { z } from "zod";

export const PAPEL_CONTATO = ["COMPRADOR", "FINANCEIRO", "DIRETORIA"] as const;
export const PapelContatoSchema = z.enum(PAPEL_CONTATO);
export type PapelContato = z.infer<typeof PapelContatoSchema>;

export const ClienteContatoSchema = z.object({
	id: z.string().uuid(),
	cliente_id: z.string().uuid(),
	nome: z.string().trim().min(1, "Nome do contato é obrigatório"),
	papel: PapelContatoSchema.nullable().optional(),
	telefone_whatsapp: z
		.string()
		.trim()
		.min(1, "Telefone / WhatsApp é obrigatório"),
	email: z.string().trim().email("E-mail inválido").nullable().optional(),
});

export type ClienteContato = z.infer<typeof ClienteContatoSchema>;

export const ClienteContatoInputSchema = z.object({
	id: z.string().uuid().optional(),
	nome: z.string().trim().min(1, "Nome do contato é obrigatório"),
	papel: PapelContatoSchema.nullable().optional(),
	telefone_whatsapp: z
		.string()
		.trim()
		.min(1, "Telefone / WhatsApp é obrigatório"),
	email: z
		.string()
		.trim()
		.optional()
		.nullable()
		.transform((val) => (val && val.length > 0 ? val : null))
		.refine(
			(val) =>
				val === null ||
				val === undefined ||
				z.string().email().safeParse(val).success,
			"E-mail inválido",
		),
});

export type ClienteContatoInput = z.input<typeof ClienteContatoInputSchema>;
export type ClienteContatoInputValidado = z.output<
	typeof ClienteContatoInputSchema
>;
