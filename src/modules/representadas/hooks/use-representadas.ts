import { useMemo } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { RepresentadaInput } from "../domain/representada.schema";
import { representadaRepository } from "../repositories/representada-dexie.adapter";

/** Lista reativa de representadas ativas do tenant. */
export function useRepresentadas(tenantId: string, termoBusca?: string) {
	const representadas = useLiveRepositoryQuery(
		() => representadaRepository.listar(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		representadas: representadas ?? [],
		isLoading: representadas === undefined,
	};
}

/** Lista reativa de todas as representadas do tenant (ativas e inativas). */
export function useTodasRepresentadas(tenantId: string, termoBusca?: string) {
	const representadas = useLiveRepositoryQuery(
		() => representadaRepository.listarTodas(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		representadas: representadas ?? [],
		isLoading: representadas === undefined,
	};
}

/**
 * Representada por id. `representada` é `undefined` enquanto carrega e
 * `null` quando não existe.
 */
export function useRepresentada(
	tenantId: string,
	id: string | undefined,
	permitirInativo = false,
) {
	const representada = useLiveRepositoryQuery(async () => {
		if (!id) return null;
		return (
			(await representadaRepository.obterPorId(
				tenantId,
				id,
				permitirInativo,
			)) ?? null
		);
	}, [tenantId, id, permitirInativo]);

	return {
		representada,
		isLoading: representada === undefined,
	};
}

/** Ações de escrita com o tenant já injetado. */
export function useRepresentadaActions(tenantId: string) {
	return useMemo(
		() => ({
			criar: (input: RepresentadaInput) =>
				representadaRepository.criar(tenantId, input),
			atualizar: (id: string, input: RepresentadaInput) =>
				representadaRepository.atualizar(tenantId, id, input),
			inativar: (id: string) => representadaRepository.inativar(tenantId, id),
			reativar: (id: string) => representadaRepository.reativar(tenantId, id),
		}),
		[tenantId],
	);
}
