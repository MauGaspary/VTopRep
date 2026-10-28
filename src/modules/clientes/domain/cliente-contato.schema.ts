import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";

export const PAPEL_CONTATO = ["COMPRADOR", "FINANCEIRO", "DIRETORIA"] as const;
export const PapelContatoSchema = z.enum(PAPEL_CONTATO, {
	error: "Selecione um papel válido",
});
export type PapelContato = z.infer<typeof PapelContatoSchema>;

const NomeContatoSchema = z
	.string()
	.trim()
	.min(1, "Nome do contato é obrigatório");
const TelefoneContatoSchema = z
	.string()
	.trim()
	.min(1, "Telefone / WhatsApp é obrigatório");

export const ClienteContatoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		cliente_id: z.string().uuid(),
		nome: NomeContatoSchema,
		papel: PapelContatoSchema.nullable().optional(),
		telefone_whatsapp: TelefoneContatoSchema,
		email: z.string().trim().email("E-mail inválido").nullable().optional(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type ClienteContato = z.infer<typeof ClienteContatoSchema>;

/** `id` presente = contato já existente do cliente (edição). */
export const ClienteContatoInputSchema = z.object({
	id: z.string().uuid().optional(),
	nome: NomeContatoSchema,
	papel: PapelContatoSchema.nullable().optional(),
	telefone_whatsapp: TelefoneContatoSchema,
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
