import { formatarInteiroComoDecimalBr } from "../../../shared/domain/decimal-br";
import type { PrecoResolvido } from "../../produtos/domain/preco";
import type { Produto } from "../../produtos/domain/produto.schema";
import type {
	CotacaoFormValues,
	GrupoOrcamentoFormValues,
} from "./cotacao-form";
import type { PedidoCompleto } from "./pedido";

/** Tabela sugerida hoje para a representada e seus preços vigentes. */
export interface PrecificacaoAtual {
	tabelaId: string | null;
	precosPorProduto: ReadonlyMap<
		string,
		Pick<PrecoResolvido, "preco_base_centavos">
	>;
}

export type MotivoItemNaoRepetido =
	| "representada_inativa"
	| "sem_tabela_vigente"
	| "produto_indisponivel"
	| "sem_preco";

export const ROTULOS_MOTIVO_NAO_REPETIDO: Record<
	MotivoItemNaoRepetido,
	string
> = {
	representada_inativa: "fábrica inativa",
	sem_tabela_vigente: "fábrica sem tabela vigente",
	produto_indisponivel: "produto inativo ou removido",
	sem_preco: "sem preço na tabela vigente",
};

export interface ItemNaoRepetido {
	produtoId: string;
	representadaId: string;
	/** SKU e descrição, quando o produto ainda existe no aparelho. */
	sku: string | null;
	descricao: string | null;
	motivo: MotivoItemNaoRepetido;
}

export interface RepeticaoCotacao {
	valores: CotacaoFormValues;
	itensNaoRepetidos: ItemNaoRepetido[];
}

export interface MontarRepeticaoParams {
	/** Pedidos da cotação de origem (1 por fábrica; avulso = 1). */
	pedidos: readonly PedidoCompleto[];
	produtosPorId: ReadonlyMap<
		string,
		Pick<Produto, "id" | "sku" | "descricao" | "ativo" | "deleted_at">
	>;
	representadasAtivasIds: ReadonlySet<string>;
	precificacaoPorRepresentada: ReadonlyMap<string, PrecificacaoAtual>;
	gerarLocalId: () => string;
}

/**
 * Monta um novo orçamento a partir de um pedido (ou cotação) existente:
 * mesmo cliente, transportadora, observações e, por fábrica, mesma condição de
 * pagamento, frete, produtos, quantidades e descontos. O preço vem **sempre da
 * tabela vigente hoje** (nunca do pedido antigo). Itens de fábrica inativa,
 * sem tabela vigente, de produto inativo/removido ou sem preço não entram e
 * voltam em `itensNaoRepetidos` para o aviso na tela. Endereço e contato
 * ficam para a sugestão automática do orçamento (podem ter mudado).
 */
export function montarRepeticaoCotacao({
	pedidos,
	produtosPorId,
	representadasAtivasIds,
	precificacaoPorRepresentada,
	gerarLocalId,
}: MontarRepeticaoParams): RepeticaoCotacao {
	const itensNaoRepetidos: ItemNaoRepetido[] = [];
	const grupos: GrupoOrcamentoFormValues[] = [];

	for (const { pedido, itens } of pedidos) {
		const repId = pedido.representada_id;
		const precificacao = precificacaoPorRepresentada.get(repId);
		const motivoGrupo: MotivoItemNaoRepetido | null =
			!representadasAtivasIds.has(repId)
				? "representada_inativa"
				: !precificacao?.tabelaId
					? "sem_tabela_vigente"
					: null;

		const itensRepetidos: GrupoOrcamentoFormValues["itens"] = [];
		for (const item of itens) {
			const produto = produtosPorId.get(item.produto_id);
			const disponivel = produto?.ativo === true && produto.deleted_at === null;
			const preco = precificacao?.precosPorProduto.get(item.produto_id);
			const motivo: MotivoItemNaoRepetido | null =
				motivoGrupo ??
				(!disponivel ? "produto_indisponivel" : !preco ? "sem_preco" : null);

			if (motivo || !preco) {
				itensNaoRepetidos.push({
					produtoId: item.produto_id,
					representadaId: repId,
					sku: produto?.sku ?? null,
					descricao: produto?.descricao ?? null,
					motivo: motivo ?? "sem_preco",
				});
				continue;
			}

			itensRepetidos.push({
				localId: gerarLocalId(),
				produto_id: item.produto_id,
				preco_unitario_tabela_centavos: preco.preco_base_centavos,
				quantidade: String(item.quantidade),
				percentual_desconto:
					item.percentual_desconto > 0
						? formatarInteiroComoDecimalBr(item.percentual_desconto)
						: "",
			});
		}

		if (itensRepetidos.length > 0 && precificacao?.tabelaId) {
			grupos.push({
				representada_id: repId,
				tabela_id: precificacao.tabelaId,
				tabela_manual: false,
				condicao_pagamento: pedido.condicao_pagamento,
				tipo_frete: pedido.tipo_frete,
				itens: itensRepetidos,
			});
		}
	}

	const primeiro = pedidos[0]?.pedido;
	return {
		valores: {
			cliente_id: primeiro?.cliente_id ?? "",
			endereco_entrega_id: "",
			contato_id: "",
			transportadora_id: primeiro?.transportadora_id ?? "",
			observacoes: primeiro?.observacoes ?? "",
			grupos,
		},
		itensNaoRepetidos,
	};
}
