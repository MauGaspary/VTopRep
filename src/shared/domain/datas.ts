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
