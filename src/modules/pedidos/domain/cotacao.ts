import { somarCentavos } from "../../../shared/domain/dinheiro";
import {
	type CotacaoInput,
	CotacaoInputSchema,
	type CotacaoInputValidado,
} from "./cotacao.schema";
import type { PedidoCompleto } from "./pedido";
import type { Pedido, PedidoInputValidado } from "./pedido.schema";

/**
 * Cotação carregada: os pedidos individuais (um por representada) que
 * compartilham o mesmo `cotacao_grupo_id`. Um pedido avulso (sem grupo) é
 * tratado como uma cotação de uma única fábrica.
 */
export interface CotacaoCompleta {
	cotacao_grupo_id: string | null;
	pedidos: PedidoCompleto[];
}

/**
 * Desmembra a cotação em um `PedidoInput` por representada, replicando o
 * contexto compartilhado do cliente em cada pedido.
 */
export function desmembrarCotacao(input: CotacaoInput): PedidoInputValidado[] {
	const dados: CotacaoInputValidado = CotacaoInputSchema.parse(input);
	return dados.grupos.map((grupo) => ({
		cliente_id: dados.cliente_id,
		endereco_entrega_id: dados.endereco_entrega_id,
		contato_id: dados.contato_id,
		transportadora_id: dados.transportadora_id,
		observacoes: dados.observacoes,
		...grupo,
	}));
}

export interface PlanoGravacaoCotacao {
	/** Pedido já gravado que será atualizado, por `representada_id`. */
	existentePorRepresentada: Map<string, Pedido>;
	/** Pedidos da cotação cuja representada saiu da sacola (viram tombstone). */
	excluir: Pedido[];
}

/**
 * Casa as seções da cotação com os pedidos já gravados pela representada.
 * Seções novas não têm pedido correspondente (serão criadas); pedidos sem
 * seção correspondente — ou duplicados para a mesma fábrica — são excluídos.
 */
export function planejarGravacaoCotacao(
	representadaIds: readonly string[],
	existentes: readonly Pedido[],
): PlanoGravacaoCotacao {
	const desejadas = new Set(representadaIds);
	const existentePorRepresentada = new Map<string, Pedido>();
	const excluir: Pedido[] = [];

	for (const pedido of ordenarPedidosDaCotacao(existentes)) {
		if (
			desejadas.has(pedido.representada_id) &&
			!existentePorRepresentada.has(pedido.representada_id)
		) {
			existentePorRepresentada.set(pedido.representada_id, pedido);
		} else {
			excluir.push(pedido);
		}
	}

	return { existentePorRepresentada, excluir };
}

/**
 * Mantém o agrupador já existente; numa cotação nova, só cria um agrupador
 * quando há mais de uma representada (pedido de uma fábrica fica avulso).
 */
export function resolverCotacaoGrupoId(
	existentes: readonly Pick<Pedido, "cotacao_grupo_id">[],
	quantidadeRepresentadas: number,
	gerarId: () => string,
): string | null {
	const atual = existentes.find((p) => p.cotacao_grupo_id)?.cotacao_grupo_id;
	if (atual) return atual;
	return quantidadeRepresentadas > 1 ? gerarId() : null;
}

/** Ordem estável das seções: ordem de criação dos pedidos, depois id. */
export function ordenarPedidosDaCotacao<
	P extends Pick<Pedido, "id" | "created_at">,
>(pedidos: readonly P[]): P[] {
	return [...pedidos].sort(
		(a, b) =>
			a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
	);
}

/** Cotação só pode ser editada enquanto todos os seus pedidos são rascunhos. */
export function cotacaoEditavel(
	pedidos: readonly Pick<Pedido, "status">[],
): boolean {
	return pedidos.length > 0 && pedidos.every((p) => p.status === "rascunho");
}

export interface TotaisCotacao {
	quantidade_pedidos: number;
	valor_total_centavos: number;
	comissao_projetada_centavos: number;
}

/** Consolida total e comissão de todos os pedidos da cotação (em centavos). */
export function calcularTotaisCotacao(
	pedidos: readonly Pick<
		Pedido,
		"valor_total_centavos" | "comissao_projetada_centavos"
	>[],
): TotaisCotacao {
	return {
		quantidade_pedidos: pedidos.length,
		valor_total_centavos: somarCentavos(
			pedidos.map((p) => p.valor_total_centavos),
		),
		comissao_projetada_centavos: somarCentavos(
			pedidos.map((p) => p.comissao_projetada_centavos),
		),
	};
}
