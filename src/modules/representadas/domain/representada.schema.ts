import { z } from "zod";
import { isCnpjValido, normalizarCnpj } from "../../../shared/domain/cnpj";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";
import { TipoFreteSchema } from "../../../shared/domain/frete";

export const CORES_REPRESENTADA = [
	"indigo",
	"emerald",
	"amber",
	"rose",
	"cyan",
	"violet",
	"blue",
	"orange",
] as const;

export type CorRepresentada = (typeof CORES_REPRESENTADA)[number];

export const CorRepresentadaSchema = z.enum(CORES_REPRESENTADA);

const CnpjNormalizadoSchema = z
	.string()
	.regex(/^[A-Z0-9]{12}\d{2}$/, "CNPJ deve conter 14 caracteres")
	.refine(isCnpjValido, "CNPJ inválido");

export const PercentualComissaoRepresentadaSchema = z
	.number()
	.int("Comissão deve ser um inteiro em centésimos de percentual")
	.min(0, "Comissão não pode ser negativa")
	.max(CEM_POR_CENTO_CENTESIMOS, "Comissão não pode exceder 100%");

/** Entidade persistida (Dexie / Supabase). */
export const RepresentadaSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		razao_social: z.string().trim().min(1, "Razão social é obrigatória"),
		nome_fantasia: z.string().trim().min(1, "Nome fantasia é obrigatório"),
		cnpj: CnpjNormalizadoSchema,
		/** Centésimos de %, ex: 500 = 5,00% (alíquota padrão / base) */
		percentual_comissao_padrao: PercentualComissaoRepresentadaSchema,
		/** Centésimos de %, aplicável quando `clientes.tipo_cliente = 'FABRICA'` (obrigatório) */
		percentual_comissao_fabrica: PercentualComissaoRepresentadaSchema,
		/** Centésimos de %, aplicável quando `clientes.tipo_cliente = 'REVENDA'` (opcional) */
		percentual_comissao_revenda:
			PercentualComissaoRepresentadaSchema.nullable().optional(),
		/** Apenas informativo nesta fase (trava de pedido mínimo está no BACKLOG). */
		valor_pedido_minimo_centavos: z
			.number()
			.int()
			.min(0, "Pedido mínimo não pode ser negativo"),
		regras_frete_padrao: TipoFreteSchema,
		/** Cor identificadora opcional no catálogo e listas. Se omitida, usa cor determinística. */
		cor: CorRepresentadaSchema.optional(),
		/** Estado de negócio (reversível). Inativas aparecem na lista de inativas. */
		ativo: z.boolean(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type Representada = z.infer<typeof RepresentadaSchema>;

const RepresentadaInputBaseSchema = z.object({
	razao_social: RepresentadaSchema.shape.razao_social,
	nome_fantasia: RepresentadaSchema.shape.nome_fantasia,
	cnpj: z.string().transform(normalizarCnpj).pipe(CnpjNormalizadoSchema),
	percentual_comissao_padrao: PercentualComissaoRepresentadaSchema.optional(),
	percentual_comissao_fabrica: PercentualComissaoRepresentadaSchema.optional(),
	percentual_comissao_revenda:
		PercentualComissaoRepresentadaSchema.nullable().optional(),
	valor_pedido_minimo_centavos:
		RepresentadaSchema.shape.valor_pedido_minimo_centavos,
	regras_frete_padrao: RepresentadaSchema.shape.regras_frete_padrao,
	cor: RepresentadaSchema.shape.cor,
});

/** Dados editáveis pelo usuário. O CNPJ é normalizado antes da validação. */
export const RepresentadaInputSchema = RepresentadaInputBaseSchema.superRefine(
	(dados, ctx) => {
		if (
			dados.percentual_comissao_fabrica === undefined &&
			dados.percentual_comissao_padrao === undefined
		) {
			ctx.addIssue({
				code: "custom",
				path: ["percentual_comissao_fabrica"],
				message: "Informe a comissão para fábrica",
			});
		}
	},
).transform((dados) => {
	const fabrica =
		dados.percentual_comissao_fabrica ?? dados.percentual_comissao_padrao ?? 0;
	const padrao = dados.percentual_comissao_padrao ?? fabrica;
	const { percentual_comissao_revenda, ...resto } = dados;
	return {
		...resto,
		percentual_comissao_padrao: padrao,
		percentual_comissao_fabrica: fabrica,
		...(percentual_comissao_revenda !== undefined &&
		percentual_comissao_revenda !== null
			? { percentual_comissao_revenda }
			: {}),
	};
});

export type RepresentadaInput = z.input<typeof RepresentadaInputSchema>;
export type RepresentadaInputValidado = z.output<
	typeof RepresentadaInputSchema
>;
