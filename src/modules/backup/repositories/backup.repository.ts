import type { BackupLocal, ContagemBackup } from "../domain/backup.schema";

export interface ExportarBackupParams {
	tenantId: string;
	/** Nome fantasia, gravado no cabeçalho só para exibição. */
	tenantNome: string;
}

/** Backup local do tenant (TODO 2.10.2): exportar e restaurar o banco do aparelho. */
export interface BackupRepository {
	/** Versão do banco local, gravada no backup e exigida na restauração. */
	readonly versaoBanco: number;
	/** Lê todas as tabelas do tenant e monta o backup validado. */
	exportar(params: ExportarBackupParams): Promise<BackupLocal>;
	/**
	 * Substitui todos os dados locais do tenant pelos do backup, numa única
	 * transação: se algo falhar, nada muda.
	 */
	restaurar(tenantId: string, backup: BackupLocal): Promise<ContagemBackup>;
	/** Quantidade de registros do tenant em cada tabela. */
	contar(tenantId: string): Promise<ContagemBackup>;
}
