import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useLiveRepositoryQuery } from "../../../shared/hooks/use-live-repository-query";
import { SINCRONIZACAO_REMOTA_ATIVA } from "../../sync/domain/sincronizacao";
import { totalRegistros } from "../domain/backup";
import type { BackupLocal } from "../domain/backup.schema";
import {
	adiarLembreteBackup,
	deveLembrarBackup,
	registrarBackupFeito,
} from "../domain/lembrete-backup";
import { backupRepository } from "../repositories/backup-dexie.adapter";
import { preferenciasBackupRepository } from "../repositories/preferencias-backup.repository";

/** Quantidade de registros do tenant por tabela (reativo). */
export function useContagemDados(tenantId: string) {
	const contagem = useLiveRepositoryQuery(
		() => backupRepository.contar(tenantId),
		[tenantId],
	);
	return {
		contagem,
		total: contagem ? totalRegistros(contagem) : 0,
		isLoading: contagem === undefined,
	};
}

export function useBackupActions(tenantId: string, tenantNome: string) {
	return useMemo(
		() => ({
			versaoBanco: backupRepository.versaoBanco,
			exportar: () => backupRepository.exportar({ tenantId, tenantNome }),
			restaurar: (backup: BackupLocal) =>
				backupRepository.restaurar(tenantId, backup),
		}),
		[tenantId, tenantNome],
	);
}

/** Último backup e adiamento do lembrete deste aparelho. */
export function usePreferenciasBackup(tenantId: string) {
	const preferencias = useSyncExternalStore(
		preferenciasBackupRepository.assinar,
		() => preferenciasBackupRepository.obter(tenantId),
	);

	const registrarBackup = useCallback(() => {
		preferenciasBackupRepository.salvar(
			tenantId,
			registrarBackupFeito(
				preferenciasBackupRepository.obter(tenantId),
				new Date(),
			),
		);
	}, [tenantId]);

	const adiarLembrete = useCallback(() => {
		preferenciasBackupRepository.salvar(
			tenantId,
			adiarLembreteBackup(
				preferenciasBackupRepository.obter(tenantId),
				new Date(),
			),
		);
	}, [tenantId]);

	return { preferencias, registrarBackup, adiarLembrete };
}

/** Se o lembrete periódico de backup deve aparecer agora. */
export function useLembreteBackup(tenantId: string) {
	const { preferencias, adiarLembrete } = usePreferenciasBackup(tenantId);
	const { total, isLoading } = useContagemDados(tenantId);
	const mostrar =
		!isLoading &&
		deveLembrarBackup({
			preferencias,
			agora: new Date(),
			temDados: total > 0,
			sincronizacaoAtiva: SINCRONIZACAO_REMOTA_ATIVA,
		});
	return { mostrar, preferencias, adiarLembrete };
}
