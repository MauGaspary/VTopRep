import { useMemo } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
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

export function usePedidoActions(tenantId: string) {
	return useMemo(
		() => ({
			salvarRascunho: (input: PedidoInput, id?: string) =>
				pedidoRepository.salvarRascunho(tenantId, input, id),
			emitir: (input: PedidoInput, id?: string) =>
				pedidoRepository.emitir(tenantId, input, id),
			excluirRascunho: (id: string) =>
				pedidoRepository.excluirRascunho(tenantId, id),
		}),
		[tenantId],
	);
}
