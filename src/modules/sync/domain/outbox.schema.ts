import { z } from "zod";
import { TimestampSchema } from "../../../shared/domain/datas";

/** Tabelas de negócio que propagam mutações para o servidor. */
export const ENTIDADES_SINCRONIZAVEIS = [
	"representadas",
	"clientes",
	"clientes_enderecos",
	"clientes_contatos",
	"clientes_metricas",
	"clientes_tabelas_preco",
	"produtos",
	"tabelas_preco",
	"itens_preco",
	"pedidos",
	"itens_pedido",
] as const;

export const EntidadeSincronizavelSchema = z.enum(ENTIDADES_SINCRONIZAVEIS);
export type EntidadeSincronizavel = z.infer<typeof EntidadeSincronizavelSchema>;

export const ACOES_OUTBOX = ["INSERT", "UPDATE", "DELETE"] as const;
export const AcaoOutboxSchema = z.enum(ACOES_OUTBOX);
export type AcaoOutbox = z.infer<typeof AcaoOutboxSchema>;

export const STATUS_OUTBOX = ["pending", "syncing", "failed"] as const;
export const StatusOutboxSchema = z.enum(STATUS_OUTBOX);
export type StatusOutbox = z.infer<typeof StatusOutboxSchema>;

export const OutboxMutationSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	entity: EntidadeSincronizavelSchema,
	action: AcaoOutboxSchema,
	payload: z.record(z.string(), z.unknown()),
	idempotency_key: z.string().uuid(),
	status: StatusOutboxSchema,
	retry_count: z.number().int().nonnegative(),
	last_error: z.string().optional(),
	created_at: TimestampSchema,
});

export type OutboxMutation = z.infer<typeof OutboxMutationSchema>;

export const EnfileirarMutacaoInputSchema = z.object({
	entity: EntidadeSincronizavelSchema,
	action: AcaoOutboxSchema,
	payload: z.record(z.string(), z.unknown()),
	idempotency_key: z.string().uuid().optional(),
});

export type EnfileirarMutacaoInput = z.input<
	typeof EnfileirarMutacaoInputSchema
>;
