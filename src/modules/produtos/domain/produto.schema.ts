import { z } from "zod";

export const UNIDADES_MEDIDA_PADRAO = [
	"UN",
	"CX",
	"PCT",
	"KG",
	"M",
	"PAR",
	"L",
] as const;

export const ProdutoSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	representada_id: z.string().uuid(),
	sku: z.string().min(1, "SKU é obrigatório"),
	descricao: z.string().min(1, "Descrição é obrigatória"),
	unidade_medida: z.string().min(1, "Unidade de medida é obrigatória"),
	multiplo_embalagem: z.number().int().positive().nullable().optional(),
	ativo: z.boolean(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable(),
});

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
	multiplo_embalagem: z
		.number()
		.int("Múltiplo de embalagem deve ser um número inteiro")
		.positive("Múltiplo de embalagem deve ser maior que zero")
		.nullable()
		.optional(),
});

export type ProdutoInput = z.infer<typeof ProdutoInputSchema>;
