import { useMemo } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import type { ResumoFilaOutbox } from "../domain/outbox";
import type { StatusOutbox } from "../domain/outbox.schema";
import type { OutboxTransport } from "../repositories/outbox.repository";
import { outboxRepository } from "../repositories/outbox-dexie.adapter";

const RESUMO_VAZIO: ResumoFilaOutbox = {
	pendentes: 0,
	sincronizando: 0,
	falhas: 0,
	total: 0,
};

export function useOutboxResumo(tenantId: string) {
	const resumo = useLiveRepositoryQuery(
		() => outboxRepository.obterResumo(tenantId),
		[tenantId],
	);

	return {
		resumo: resumo ?? RESUMO_VAZIO,
		isLoading: resumo === undefined,
	};
}

export function useOutboxFila(tenantId: string, status?: StatusOutbox) {
	const fila = useLiveRepositoryQuery(
		() => outboxRepository.listarFila(tenantId, status),
		[tenantId, status],
	);

	return {
		fila: fila ?? [],
		isLoading: fila === undefined,
	};
}

export function useOutboxActions(tenantId: string) {
	return useMemo(
		() => ({
			processarPendentes: (transport?: OutboxTransport) =>
				outboxRepository.processarPendentes(tenantId, transport),
			reenfileirarFalhas: () => outboxRepository.reenfileirarFalhas(tenantId),
		}),
		[tenantId],
	);
}
