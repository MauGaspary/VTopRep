import { z } from "zod";
import { isCnpjValido, normalizarCnpj } from "../../../shared/domain/cnpj";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";
import { TipoFreteSchema } from "../../../shared/domain/frete";

const CnpjNormalizadoSchema = z
	.string()
	.regex(/^[A-Z0-9]{12}\d{2}$/, "CNPJ deve conter 14 caracteres")
	.refine(isCnpjValido, "CNPJ inválido");

/** Entidade persistida (Dexie / Supabase). */
export const RepresentadaSchema = z
	.object({
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
			.max(CEM_POR_CENTO_CENTESIMOS, "Comissão não pode exceder 100%"),
		/** Apenas informativo nesta fase (trava de pedido mínimo está no BACKLOG). */
		valor_pedido_minimo_centavos: z
			.number()
			.int()
			.min(0, "Pedido mínimo não pode ser negativo"),
		regras_frete_padrao: TipoFreteSchema,
		/** Estado de negócio (reversível). Inativas aparecem na lista de inativas. */
		ativo: z.boolean(),
	})
	.extend(CamposSincronizaveisSchema.shape);

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
