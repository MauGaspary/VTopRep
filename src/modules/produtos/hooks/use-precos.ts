import { useMemo } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { ItemPreco } from "../domain/item-preco.schema";
import type { PrecoResolvido } from "../domain/preco";
import type { ReajusteTabelaInput } from "../domain/reajuste-tabela";
import type { TabelaPreco } from "../domain/tabela-preco.schema";
import type { PrecoCatalogo } from "../repositories/preco.repository";
import { precoRepository } from "../repositories/preco-dexie.adapter";

const MAPA_ITENS_VAZIO: ReadonlyMap<string, ItemPreco> = new Map();
const MAPA_CATALOGO_VAZIO: ReadonlyMap<string, PrecoCatalogo> = new Map();
const MAPA_TABELAS_POR_REP_VAZIO: ReadonlyMap<string, TabelaPreco[]> =
	new Map();
const MAPA_PRECOS_TABELA_VAZIO: ReadonlyMap<string, PrecoResolvido> = new Map();

/** Todas as tabelas não excluídas da representada (para gestão no cadastro da representada). */
export function useTabelasDaRepresentada(
	tenantId: string,
	representadaId: string | undefined,
) {
	const tabelas = useLiveRepositoryQuery(() => {
		if (!tenantId || !representadaId) return Promise.resolve([]);
		return precoRepository.listarTabelasDaRepresentada(
			tenantId,
			representadaId,
		);
	}, [tenantId, representadaId]);

	return {
		tabelas: tabelas ?? [],
		isLoading: tabelas === undefined,
	};
}

/** Tabelas ativas e não encerradas da representada (para precificar produtos). */
export function useTabelasEmUso(
	tenantId: string,
	representadaId: string | undefined,
	data: string,
) {
	const tabelas = useLiveRepositoryQuery(() => {
		if (!tenantId || !representadaId || !data) return Promise.resolve([]);
		return precoRepository.listarTabelasEmUso(tenantId, representadaId, data);
	}, [tenantId, representadaId, data]);

	return {
		tabelas: tabelas ?? [],
		isLoading: tabelas === undefined,
	};
}

/** Tabelas ativas e vigentes da representada na data (para o orçamento/pedido). */
export function useTabelasVigentes(
	tenantId: string,
	representadaId: string | undefined,
	data: string,
) {
	const tabelas = useLiveRepositoryQuery(() => {
		if (!tenantId || !representadaId || !data) return Promise.resolve([]);
		return precoRepository.listarTabelasVigentes(
			tenantId,
			representadaId,
			data,
		);
	}, [tenantId, representadaId, data]);

	return {
		tabelas: tabelas ?? [],
		isLoading: tabelas === undefined,
	};
}

/** Itens de preço vivos de um produto, indexados por `tabela_id`. */
export function useItensPrecoDoProduto(
	tenantId: string,
	produtoId: string | undefined,
) {
	const itensPorTabela = useLiveRepositoryQuery(() => {
		if (!tenantId || !produtoId) {
			return Promise.resolve(new Map<string, ItemPreco>());
		}
		return precoRepository.obterItensPrecoDoProduto(tenantId, produtoId);
	}, [tenantId, produtoId]);

	return {
		itensPorTabela: itensPorTabela ?? MAPA_ITENS_VAZIO,
		isLoading: itensPorTabela === undefined,
	};
}

/** Preço vigente de cada produto para exibição rápida no catálogo. */
export function usePrecosCatalogo(tenantId: string, data: string) {
	const precosPorProduto = useLiveRepositoryQuery(() => {
		if (!tenantId || !data) {
			return Promise.resolve(new Map<string, PrecoCatalogo>());
		}
		return precoRepository.resolverPrecosCatalogo(tenantId, data);
	}, [tenantId, data]);

	return {
		precosPorProduto: precosPorProduto ?? MAPA_CATALOGO_VAZIO,
		isLoading: precosPorProduto === undefined,
	};
}

/** Tabelas disponíveis (ativas e não excluídas) agrupadas por `representada_id`. */
export function useTabelasDisponiveisPorRepresentada(tenantId: string) {
	const tabelasPorRepresentada = useLiveRepositoryQuery(() => {
		if (!tenantId) {
			return Promise.resolve(new Map<string, TabelaPreco[]>());
		}
		return precoRepository.listarTabelasDisponiveisPorRepresentada(tenantId);
	}, [tenantId]);

	return {
		tabelasPorRepresentada:
			tabelasPorRepresentada ?? MAPA_TABELAS_POR_REP_VAZIO,
		isLoading: tabelasPorRepresentada === undefined,
	};
}

/** Todos os preços de uma tabela específica vigentes na data, indexados por `produto_id`. */
export function usePrecosDaTabela(
	tenantId: string,
	tabelaId: string | undefined,
	data: string,
) {
	const resolucao = useLiveRepositoryQuery(async () => {
		if (!tenantId || !tabelaId || !data) {
			return new Map<string, PrecoResolvido>();
		}
		const res = await precoRepository.resolverPrecosDaTabela(
			tenantId,
			tabelaId,
			data,
		);
		return res.ok ? res.precos : new Map<string, PrecoResolvido>();
	}, [tenantId, tabelaId, data]);

	return {
		precosPorProduto: resolucao ?? MAPA_PRECOS_TABELA_VAZIO,
		isLoading: resolucao === undefined,
	};
}

/** Itens de preço vivos de uma tabela, por `produto_id` (qualquer vigência). */
export function useItensDaTabela(
	tenantId: string,
	tabelaId: string | undefined,
) {
	const itens = useLiveRepositoryQuery(() => {
		if (!tenantId || !tabelaId) {
			return Promise.resolve(new Map<string, ItemPreco>());
		}
		return precoRepository.listarItensDaTabela(tenantId, tabelaId);
	}, [tenantId, tabelaId]);

	return {
		itensPorProduto: itens ?? MAPA_ITENS_VAZIO,
		isLoading: itens === undefined,
	};
}

/** Reajuste em lote com o tenant já injetado. */
export function useReajusteTabela(tenantId: string) {
	return useMemo(
		() => ({
			reajustar: (input: ReajusteTabelaInput) =>
				precoRepository.reajustarTabela(tenantId, input),
		}),
		[tenantId],
	);
}
