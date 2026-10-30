import { useMemo } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { PrecoProdutoInput } from "../domain/item-preco.schema";
import type { ProdutoInput } from "../domain/produto.schema";
import { produtoRepository } from "../repositories/produto-dexie.adapter";

/** Lista reativa de produtos ativos do tenant. */
export function useProdutos(
	tenantId: string,
	termoBusca?: string,
	representadaId?: string,
) {
	const produtos = useLiveRepositoryQuery(() => {
		if (!tenantId) return Promise.resolve([]);
		return produtoRepository.listar(tenantId, termoBusca, representadaId);
	}, [tenantId, termoBusca, representadaId]);

	return {
		produtos: produtos ?? [],
		isLoading: produtos === undefined,
	};
}

/** Lista reativa de todos os produtos do tenant (ativos e inativos). */
export function useTodosProdutos(
	tenantId: string,
	termoBusca?: string,
	representadaId?: string,
) {
	const produtos = useLiveRepositoryQuery(() => {
		if (!tenantId) return Promise.resolve([]);
		return produtoRepository.listarTodos(tenantId, termoBusca, representadaId);
	}, [tenantId, termoBusca, representadaId]);

	return {
		produtos: produtos ?? [],
		isLoading: produtos === undefined,
	};
}

/**
 * Produto por id. `produto` é `undefined` enquanto carrega e
 * `null` quando não existe.
 */
export function useProduto(
	tenantId: string,
	id: string | undefined,
	permitirInativo = false,
) {
	const produto = useLiveRepositoryQuery(async () => {
		if (!tenantId || !id) return null;
		return (
			(await produtoRepository.obterPorId(tenantId, id, permitirInativo)) ??
			null
		);
	}, [tenantId, id, permitirInativo]);

	return {
		produto,
		isLoading: produto === undefined,
	};
}

/** Ações de escrita com o tenant já injetado. */
export function useProdutoActions(tenantId: string) {
	return useMemo(
		() => ({
			criar: (
				input: ProdutoInput,
				precosInput?: readonly PrecoProdutoInput[],
			) => produtoRepository.criar(tenantId, input, precosInput),
			atualizar: (
				id: string,
				input: ProdutoInput,
				precosInput?: readonly PrecoProdutoInput[],
			) => produtoRepository.atualizar(tenantId, id, input, precosInput),
			inativar: (id: string) => produtoRepository.inativar(tenantId, id),
			reativar: (id: string) => produtoRepository.reativar(tenantId, id),
		}),
		[tenantId],
	);
}
