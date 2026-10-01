import { z } from "zod";

export const ClienteEnderecoSchema = z.object({
	id: z.string().uuid(),
	cliente_id: z.string().uuid(),
	tipo_endereco: z.enum(["PRINCIPAL", "ENTREGA", "COBRANCA"]),
	endereco_completo: z.string().min(1),
	latitude: z.number().nullable().optional(),
	longitude: z.number().nullable().optional(),
});

export type ClienteEndereco = z.infer<typeof ClienteEnderecoSchema>;
