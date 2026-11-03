import { useMemo } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { TransportadoraInput } from "../domain/transportadora.schema";
import { transportadoraRepository } from "../repositories/transportadora-dexie.adapter";

/** Lista reativa de transportadoras ativas do tenant. */
export function useTransportadoras(tenantId: string, termoBusca?: string) {
	const transportadoras = useLiveRepositoryQuery(
		() => transportadoraRepository.listar(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		transportadoras: transportadoras ?? [],
		isLoading: transportadoras === undefined,
	};
}

/** Lista reativa de todas as transportadoras do tenant (ativas e inativas). */
export function useTodasTransportadoras(tenantId: string, termoBusca?: string) {
	const transportadoras = useLiveRepositoryQuery(
		() => transportadoraRepository.listarTodas(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		transportadoras: transportadoras ?? [],
		isLoading: transportadoras === undefined,
	};
}

/**
 * Transportadora por id. `transportadora` é `undefined` enquanto carrega e
 * `null` quando não existe.
 */
export function useTransportadora(
	tenantId: string,
	id: string | undefined,
	permitirInativo = false,
) {
	const transportadora = useLiveRepositoryQuery(async () => {
		if (!id) return null;
		return (
			(await transportadoraRepository.obterPorId(
				tenantId,
				id,
				permitirInativo,
			)) ?? null
		);
	}, [tenantId, id, permitirInativo]);

	return {
		transportadora,
		isLoading: transportadora === undefined,
	};
}

/** Ações de escrita com o tenant já injetado. */
export function useTransportadoraActions(tenantId: string) {
	return useMemo(
		() => ({
			criar: (input: TransportadoraInput) =>
				transportadoraRepository.criar(tenantId, input),
			atualizar: (id: string, input: TransportadoraInput) =>
				transportadoraRepository.atualizar(tenantId, id, input),
			inativar: (id: string) => transportadoraRepository.inativar(tenantId, id),
			reativar: (id: string) => transportadoraRepository.reativar(tenantId, id),
		}),
		[tenantId],
	);
}
