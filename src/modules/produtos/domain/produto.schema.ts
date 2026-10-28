import { z } from "zod";
import { CamposSincronizaveisSchema } from "../../../shared/domain/datas";

export const UNIDADES_MEDIDA_PADRAO = [
	"UN",
	"CX",
	"PCT",
	"KG",
	"M",
	"PAR",
	"L",
] as const;

const MultiploEmbalagemSchema = z
	.number()
	.int("Múltiplo de embalagem deve ser um número inteiro")
	.positive("Múltiplo de embalagem deve ser maior que zero");

export const ProdutoSchema = z
	.object({
		id: z.string().uuid(),
		tenant_id: z.string().uuid(),
		representada_id: z.string().uuid(),
		/** Normalizado (sem espaços nas pontas, maiúsculo). Único por representada. */
		sku: z
			.string()
			.min(1, "SKU é obrigatório")
			.regex(/^\S(.*\S)?$/, "SKU não pode ter espaços nas pontas")
			.refine((sku) => sku === sku.toUpperCase(), "SKU deve estar normalizado"),
		descricao: z.string().min(1, "Descrição é obrigatória"),
		unidade_medida: z.string().min(1, "Unidade de medida é obrigatória"),
		multiplo_embalagem: MultiploEmbalagemSchema,
		/** Estado de negócio (reversível). Inativos aparecem na lista de inativos. */
		ativo: z.boolean(),
	})
	.extend(CamposSincronizaveisSchema.shape);

export type Produto = z.infer<typeof ProdutoSchema>;

export const ProdutoInputSchema = z.object({
	representada_id: z.string().uuid("Selecione uma representada válida"),
	sku: z
		.string()
		.trim()
		.min(1, "SKU é obrigatório")
		.max(64, "SKU deve ter no máximo 64 caracteres"),
	descricao: z
		.string()
		.trim()
		.min(1, "Descrição é obrigatória")
		.max(255, "Descrição deve ter no máximo 255 caracteres"),
	unidade_medida: z
		.string()
		.trim()
		.min(1, "Unidade de medida é obrigatória")
		.max(10, "Unidade deve ter no máximo 10 caracteres"),
	/** Opcional na entrada: ausente vira 1. */
	multiplo_embalagem: MultiploEmbalagemSchema.nullable().optional(),
});

export type ProdutoInput = z.infer<typeof ProdutoInputSchema>;
