import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";

export const TIPO_ENDERECO = ["PRINCIPAL", "ENTREGA", "COBRANCA"] as const;
export const TipoEnderecoSchema = z.enum(TIPO_ENDERECO, {
	error: "Selecione um tipo de endereço válido",
});
export type TipoEndereco = z.infer<typeof TipoEnderecoSchema>;

/** Campos editáveis pelo usuário. */
const CamposEnderecoSchema = z.object({
	tipo_endereco: TipoEnderecoSchema,
	endereco_completo: z.string().trim().min(1, "Endereço é obrigatório"),
	latitude: z.number().nullable().optional(),
	longitude: z.number().nullable().optional(),
});

export const ClienteEnderecoSchema = CamposEnderecoSchema.extend({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	cliente_id: z.string().uuid(),
}).extend(CamposSincronizaveisSchema.shape);

export type ClienteEndereco = z.infer<typeof ClienteEnderecoSchema>;

/** `id` presente = endereço já existente do cliente (edição). */
export const ClienteEnderecoInputSchema = CamposEnderecoSchema.extend({
	id: z.string().uuid().optional(),
});

export type ClienteEnderecoInput = z.input<typeof ClienteEnderecoInputSchema>;
export type ClienteEnderecoInputValidado = z.output<
	typeof ClienteEnderecoInputSchema
>;
