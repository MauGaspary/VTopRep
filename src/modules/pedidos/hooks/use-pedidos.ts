import { useMemo } from "react";
import type { TenantConfig } from "../../../config/tenant/tenant.schema";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { CotacaoInput } from "../domain/cotacao.schema";
import type { PedidoInput, StatusPedido } from "../domain/pedido.schema";
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
