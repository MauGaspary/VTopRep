import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import type { RepresentadaInput } from "../domain/representada.schema";
import { representadaRepository } from "../repositories/representada-dexie.adapter";

/** Lista reativa de representadas ativas do tenant. */
export function useRepresentadas(tenantId: string, termoBusca?: string) {
	const representadas = useLiveQuery(
		() => representadaRepository.listar(tenantId, termoBusca),
		[tenantId, termoBusca],
	);

	return {
		representadas: representadas ?? [],
		isLoading: representadas === undefined,
	};
}

/**
 * Representada por id. `representada` é `undefined` enquanto carrega e
 * `null` quando não existe (ou pertence a outro tenant / foi inativada).
 */
export function useRepresentada(tenantId: string, id: string | undefined) {
	const representada = useLiveQuery(async () => {
		if (!id) return null;
		return (await representadaRepository.obterPorId(tenantId, id)) ?? null;
	}, [tenantId, id]);

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
		}),
		[tenantId],
	);
}
