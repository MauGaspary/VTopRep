import { z } from "zod";
import { PedidoInputSchema } from "./pedido.schema";

/**
 * Seção da cotação referente a uma representada (fábrica): cada seção vira um
 * `Pedido` individual com sua tabela, condição de pagamento e tipo de frete.
 */
export const GrupoCotacaoInputSchema = PedidoInputSchema.pick({
	representada_id: true,
	tabela_id: true,
	condicao_pagamento: true,
	tipo_frete: true,
	itens: true,
});

/**
 * Cotação multi-representada: o contexto do cliente (entrega, contato,
 * transportadora e observações) é único e compartilhado por todas as seções.
 */
export const CotacaoInputSchema = PedidoInputSchema.pick({
	cliente_id: true,
	endereco_entrega_id: true,
	contato_id: true,
	transportadora_id: true,
	observacoes: true,
})
	.extend({
		grupos: z
			.array(GrupoCotacaoInputSchema)
			.min(1, "Adicione pelo menos um item ao orçamento"),
	})
	.superRefine((cotacao, ctx) => {
		const vistas = new Set<string>();
		cotacao.grupos.forEach((grupo, idx) => {
			if (vistas.has(grupo.representada_id)) {
				ctx.addIssue({
					code: "custom",
					path: ["grupos", idx, "representada_id"],
					message: "A representada aparece em mais de uma seção da cotação",
				});
			}
			vistas.add(grupo.representada_id);
		});
	});

export type GrupoCotacaoInput = z.input<typeof GrupoCotacaoInputSchema>;
export type CotacaoInput = z.input<typeof CotacaoInputSchema>;
export type CotacaoInputValidado = z.output<typeof CotacaoInputSchema>;
