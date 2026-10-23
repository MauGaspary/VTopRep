import { z } from "zod";
import { isCnpjValido, normalizarCnpj } from "../../../shared/domain/cnpj";

export const REGRAS_FRETE = ["CIF", "FOB", "FOB_REDESPACHO"] as const;
export const RegraFreteSchema = z.enum(REGRAS_FRETE, {
	error: "Selecione uma regra de frete válida",
});
export type RegraFrete = z.infer<typeof RegraFreteSchema>;

/** 100,00% expresso em centésimos de percentual. */
export const PERCENTUAL_MAXIMO_CENTESIMOS = 10000;

const CnpjNormalizadoSchema = z
	.string()
	.regex(/^[A-Z0-9]{12}\d{2}$/, "CNPJ deve conter 14 caracteres")
	.refine(isCnpjValido, "CNPJ inválido");

/** Entidade persistida (Dexie / Supabase). */
export const RepresentadaSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	razao_social: z.string().trim().min(1, "Razão social é obrigatória"),
	nome_fantasia: z.string().trim().min(1, "Nome fantasia é obrigatório"),
	cnpj: CnpjNormalizadoSchema,
	/** Centésimos de %, ex: 500 = 5,00% */
	percentual_comissao_padrao: z
		.number()
		.int()
		.min(0, "Comissão não pode ser negativa")
		.max(PERCENTUAL_MAXIMO_CENTESIMOS, "Comissão não pode exceder 100%"),
	/** Apenas informativo nesta fase (trava de pedido mínimo está no BACKLOG). */
	valor_pedido_minimo_centavos: z
		.number()
		.int()
		.min(0, "Pedido mínimo não pode ser negativo"),
	regras_frete_padrao: RegraFreteSchema,
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type Representada = z.infer<typeof RepresentadaSchema>;

/** Dados editáveis pelo usuário. O CNPJ é normalizado antes da validação. */
export const RepresentadaInputSchema = RepresentadaSchema.pick({
	razao_social: true,
	nome_fantasia: true,
	percentual_comissao_padrao: true,
	valor_pedido_minimo_centavos: true,
	regras_frete_padrao: true,
}).extend({
	cnpj: z.string().transform(normalizarCnpj).pipe(CnpjNormalizadoSchema),
});

export type RepresentadaInput = z.input<typeof RepresentadaInputSchema>;
export type RepresentadaInputValidado = z.output<
	typeof RepresentadaInputSchema
>;
