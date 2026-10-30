import { z } from "zod";

/** Instante ISO-8601 em UTC (ex.: `2026-10-28T12:00:00.000Z`), como `Date#toISOString`. */
export const TimestampSchema = z.iso.datetime({
	error: "Data/hora deve estar no formato ISO-8601 (UTC)",
});

/** Data de calendário sem horário (ex.: `2026-10-28`). */
export const DataSchema = z.iso.date({
	error: "Data deve estar no formato AAAA-MM-DD",
});

/** Campos de auditoria e tombstone presentes em toda tabela sincronizável. */
export const CamposSincronizaveisSchema = z.object({
	created_at: TimestampSchema,
	updated_at: TimestampSchema,
	/** Tombstone de sincronização (exclusão lógica). Não confundir com `ativo`. */
	deleted_at: TimestampSchema.nullable(),
});

/**
 * Data de calendário (`AAAA-MM-DD`) no fuso local do aparelho. Não use
 * `toISOString().slice(0, 10)`: em UTC, à noite no Brasil já é o dia seguinte.
 */
export function dataLocal(instante: Date): string {
	const ano = String(instante.getFullYear()).padStart(4, "0");
	const mes = String(instante.getMonth() + 1).padStart(2, "0");
	const dia = String(instante.getDate()).padStart(2, "0");
	return `${ano}-${mes}-${dia}`;
}

/** Formata uma data de calendário `AAAA-MM-DD` como `DD/MM/AAAA` (sem fuso). */
export function formatarDataBr(data: string): string {
	const [ano, mes, dia] = DataSchema.parse(data).split("-");
	return `${dia}/${mes}/${ano}`;
}
