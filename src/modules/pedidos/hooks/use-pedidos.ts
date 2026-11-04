import { useMemo } from "react";
import type { TenantConfig } from "../../../config/tenant/tenant.schema";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { PrecoResolvido } from "../../produtos/domain/preco";
import { precoRepository } from "../../produtos/repositories/preco-dexie.adapter";
import { produtoRepository } from "../../produtos/repositories/produto-dexie.adapter";
import { representadaRepository } from "../../representadas/repositories/representada-dexie.adapter";
import type { CotacaoInput } from "../domain/cotacao.schema";
import type { PedidoInput, StatusPedido } from "../domain/pedido.schema";
import {
	montarRepeticaoCotacao,
	type PrecificacaoAtual,
	type RepeticaoCotacao,
} from "../domain/repetir-pedido";
import { pedidoRepository } from "../repositories/pedido-dexie.adapter";

export function usePedidos(tenantId: string, status?: StatusPedido) {
	const pedidos = useLiveRepositoryQuery(
		() => pedidoRepository.listar(tenantId, status),
		[tenantId, status],
	);

	return {
		pedidos: pedidos ?? [],
		isLoading: pedidos === undefined,
	};
}

/** Histórico de orçamentos e pedidos do cliente (mais recentes primeiro). */
export function usePedidosDoCliente(
	tenantId: string,
	clienteId: string | undefined,
) {
	const pedidos = useLiveRepositoryQuery(() => {
		if (!clienteId) return Promise.resolve([]);
		return pedidoRepository.listarPorCliente(tenantId, clienteId);
	}, [tenantId, clienteId]);

	return {
		pedidos: pedidos ?? [],
		isLoading: pedidos === undefined,
	};
}

/**
 * Valores de um novo orçamento repetindo o pedido (ou a cotação inteira) com
 * os preços da tabela vigente hoje. `null` quando o pedido não existe.
 */
export function useRepeticaoCotacao(
	tenantId: string,
	pedidoId: string | undefined,
	hoje: string,
) {
	const repeticao =
		useLiveRepositoryQuery(async (): Promise<RepeticaoCotacao | null> => {
			if (!pedidoId) return null;
			const cotacao = await pedidoRepository.obterCotacao(tenantId, pedidoId);
			if (!cotacao) return null;

			const [produtos, representadasAtivas] = await Promise.all([
				produtoRepository.listarTodos(tenantId),
				representadaRepository.listar(tenantId),
			]);
			const precificacao = new Map<string, PrecificacaoAtual>();
			for (const { pedido } of cotacao.pedidos) {
				const repId = pedido.representada_id;
				if (precificacao.has(repId)) continue;
				const tabela = await precoRepository.obterTabelaSugerida(
					tenantId,
					repId,
					hoje,
				);
				const resolucao = tabela
					? await precoRepository.resolverPrecosDaTabela(
							tenantId,
							tabela.id,
							hoje,
						)
					: null;
				precificacao.set(repId, {
					tabelaId: tabela?.id ?? null,
					precosPorProduto:
						resolucao?.ok === true
							? resolucao.precos
							: new Map<string, PrecoResolvido>(),
				});
			}

			return montarRepeticaoCotacao({
				pedidos: cotacao.pedidos,
				produtosPorId: new Map(produtos.map((p) => [p.id, p])),
				representadasAtivasIds: new Set(representadasAtivas.map((r) => r.id)),
				precificacaoPorRepresentada: precificacao,
				gerarLocalId: () => crypto.randomUUID(),
			});
		}, [tenantId, pedidoId, hoje]);

	return {
		repeticao,
		isLoading: repeticao === undefined,
	};
}

export function usePedido(tenantId: string, id: string | undefined) {
	const dados = useLiveRepositoryQuery(async () => {
		if (!id) return null;
		return (await pedidoRepository.obterPorId(tenantId, id)) ?? null;
	}, [tenantId, id]);

	return {
		dados,
		isLoading: dados === undefined,
	};
}

export function useEspelhoPedido(
	tenantId: string,
	id: string | undefined,
	empresa: TenantConfig["empresa"],
) {
	const espelho = useLiveRepositoryQuery(async () => {
		if (!id) return null;
		return (
			(await pedidoRepository.obterEspelhoPorId(tenantId, id, empresa)) ?? null
		);
	}, [
		tenantId,
		id,
		empresa.nomeFantasia,
		empresa.razaoSocial,
		empresa.cnpj,
		empresa.telefone,
	]);

	return {
		espelho,
		isLoading: espelho === undefined,
	};
}

/** Cotação do pedido: todos os pedidos do mesmo `cotacao_grupo_id`, com itens. */
export function useCotacao(tenantId: string, pedidoId: string | undefined) {
	const dados = useLiveRepositoryQuery(async () => {
		if (!pedidoId) return null;
		return (await pedidoRepository.obterCotacao(tenantId, pedidoId)) ?? null;
	}, [tenantId, pedidoId]);

	return {
		dados,
		isLoading: dados === undefined,
	};
}

/** Espelho unificado da cotação (todas as fábricas), com as seções individuais. */
export function useEspelhoCotacao(
	tenantId: string,
	pedidoId: string | undefined,
	empresa: TenantConfig["empresa"],
) {
	const espelho = useLiveRepositoryQuery(async () => {
		if (!pedidoId) return null;
		return (
			(await pedidoRepository.obterEspelhoCotacao(
				tenantId,
				pedidoId,
				empresa,
			)) ?? null
		);
	}, [
		tenantId,
		pedidoId,
		empresa.nomeFantasia,
		empresa.razaoSocial,
		empresa.cnpj,
		empresa.telefone,
	]);

	return {
		espelho,
		isLoading: espelho === undefined,
	};
}

export function usePedidoActions(tenantId: string) {
	return useMemo(
		() => ({
			salvarRascunho: (input: PedidoInput, id?: string) =>
				pedidoRepository.salvarRascunho(tenantId, input, id),
			emitir: (input: PedidoInput, id?: string) =>
				pedidoRepository.emitir(tenantId, input, id),
			salvarCotacao: (
				input: CotacaoInput,
				status: "rascunho" | "emitido",
				pedidoReferenciaId?: string,
			) =>
				pedidoRepository.salvarCotacao(
					tenantId,
					input,
					status,
					pedidoReferenciaId,
				),
			excluirRascunho: (id: string) =>
				pedidoRepository.excluirRascunho(tenantId, id),
			obterEspelhoPorId: (id: string, empresa: TenantConfig["empresa"]) =>
				pedidoRepository.obterEspelhoPorId(tenantId, id, empresa),
		}),
		[tenantId],
	);
}
