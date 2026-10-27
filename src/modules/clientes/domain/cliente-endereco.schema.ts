import { z } from "zod";

export const TIPO_ENDERECO = ["PRINCIPAL", "ENTREGA", "COBRANCA"] as const;
export const TipoEnderecoSchema = z.enum(TIPO_ENDERECO);
export type TipoEndereco = z.infer<typeof TipoEnderecoSchema>;

export const ClienteEnderecoSchema = z.object({
	id: z.string().uuid(),
	cliente_id: z.string().uuid(),
	tipo_endereco: TipoEnderecoSchema,
	endereco_completo: z.string().trim().min(1, "Endereço é obrigatório"),
	latitude: z.number().nullable().optional(),
	longitude: z.number().nullable().optional(),
});

export type ClienteEndereco = z.infer<typeof ClienteEnderecoSchema>;

export const ClienteEnderecoInputSchema = z.object({
	id: z.string().uuid().optional(),
	tipo_endereco: TipoEnderecoSchema,
	endereco_completo: z.string().trim().min(1, "Endereço é obrigatório"),
	latitude: z.number().nullable().optional(),
	longitude: z.number().nullable().optional(),
});

export type ClienteEnderecoInput = z.input<typeof ClienteEnderecoInputSchema>;
export type ClienteEnderecoInputValidado = z.output<
	typeof ClienteEnderecoInputSchema
>;
