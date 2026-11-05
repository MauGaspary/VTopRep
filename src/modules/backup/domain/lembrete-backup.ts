import { z } from "zod";
import { TimestampSchema } from "../../../shared/domain/datas";

/**
 * Preferências de backup do aparelho (não sincronizam): quando o último
 * backup foi baixado e até quando o lembrete foi adiado.
 */
export const PreferenciasBackupSchema = z.object({
	ultimo_backup_em: TimestampSchema.nullable(),
	lembrete_adiado_ate: TimestampSchema.nullable(),
});

export type PreferenciasBackup = z.infer<typeof PreferenciasBackupSchema>;

export const PREFERENCIAS_BACKUP_PADRAO: PreferenciasBackup = {
	ultimo_backup_em: null,
	lembrete_adiado_ate: null,
};

/** Lembra de novo depois de uma semana sem backup. */
export const INTERVALO_LEMBRETE_DIAS = 7;
/** "Lembrar amanhã" adia o aviso por um dia. */
export const ADIAMENTO_LEMBRETE_DIAS = 1;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Valor salvo ausente ou inválido volta para o padrão (nunca derruba a tela). */
export function lerPreferenciasBackup(valor: unknown): PreferenciasBackup {
	if (typeof valor !== "string") return PREFERENCIAS_BACKUP_PADRAO;
	try {
		const resultado = PreferenciasBackupSchema.safeParse(JSON.parse(valor));
		return resultado.success ? resultado.data : PREFERENCIAS_BACKUP_PADRAO;
	} catch {
		return PREFERENCIAS_BACKUP_PADRAO;
	}
}

function inicioDoDiaLocal(instante: Date): number {
	return new Date(
		instante.getFullYear(),
		instante.getMonth(),
		instante.getDate(),
	).getTime();
}

/**
 * Dias de calendário (fuso do aparelho) desde o último backup: 0 = hoje,
 * 1 = ontem. `null` se nunca houve backup.
 */
export function diasDesdeUltimoBackup(
	ultimoBackupEm: string | null,
	agora: Date,
): number | null {
	if (!ultimoBackupEm) return null;
	const diferenca =
		inicioDoDiaLocal(agora) - inicioDoDiaLocal(new Date(ultimoBackupEm));
	// `round` absorve a hora a mais ou a menos de um eventual horário de verão.
	return Math.max(0, Math.round(diferenca / MS_POR_DIA));
}

export interface DeveLembrarBackupParams {
	preferencias: PreferenciasBackup;
	agora: Date;
	/** Há algum registro do tenant no aparelho. */
	temDados: boolean;
	/** Com a sincronização remota ligada (TODO 2.11), o servidor guarda a cópia. */
	sincronizacaoAtiva: boolean;
}

/**
 * Lembrete periódico de backup enquanto os dados vivem só no aparelho: quando
 * nunca houve backup ou o último tem `INTERVALO_LEMBRETE_DIAS` ou mais, salvo
 * se o lembrete estiver adiado.
 */
export function deveLembrarBackup({
	preferencias,
	agora,
	temDados,
	sincronizacaoAtiva,
}: DeveLembrarBackupParams): boolean {
	if (sincronizacaoAtiva || !temDados) return false;
	const { lembrete_adiado_ate, ultimo_backup_em } = preferencias;
	if (
		lembrete_adiado_ate &&
		agora.getTime() < new Date(lembrete_adiado_ate).getTime()
	) {
		return false;
	}
	const dias = diasDesdeUltimoBackup(ultimo_backup_em, agora);
	return dias === null || dias >= INTERVALO_LEMBRETE_DIAS;
}

export function registrarBackupFeito(
	preferencias: PreferenciasBackup,
	agora: Date,
): PreferenciasBackup {
	return {
		...preferencias,
		ultimo_backup_em: agora.toISOString(),
		lembrete_adiado_ate: null,
	};
}

export function adiarLembreteBackup(
	preferencias: PreferenciasBackup,
	agora: Date,
): PreferenciasBackup {
	return {
		...preferencias,
		lembrete_adiado_ate: new Date(
			agora.getTime() + ADIAMENTO_LEMBRETE_DIAS * MS_POR_DIA,
		).toISOString(),
	};
}

/** Texto curto: "Nenhum backup neste aparelho", "hoje", "ontem", "há 9 dias". */
export function descreverUltimoBackup(
	ultimoBackupEm: string | null,
	agora: Date,
): string {
	const dias = diasDesdeUltimoBackup(ultimoBackupEm, agora);
	if (dias === null) return "Nenhum backup feito neste aparelho";
	if (dias === 0) return "Último backup hoje";
	if (dias === 1) return "Último backup ontem";
	return `Último backup há ${dias} dias`;
}
