import { z } from "zod";
import { TimestampSchema } from "../../../shared/domain/datas";

/** Tabelas de negócio que propagam mutações para o servidor. */
export const ENTIDADES_SINCRONIZAVEIS = [
	"representadas",
	"clientes",
	"clientes_enderecos",
	"clientes_contatos",
	"clientes_metricas",
	"produtos",
	"tabelas_preco",
	"itens_preco",
	"pedidos",
	"itens_pedido",
] as const;

export const EntidadeSincronizavelSchema = z.enum(ENTIDADES_SINCRONIZAVEIS);
export type EntidadeSincronizavel = z.infer<typeof EntidadeSincronizavelSchema>;

export const OutboxMutationSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	entity: EntidadeSincronizavelSchema,
	action: z.enum(["INSERT", "UPDATE", "DELETE"]),
	payload: z.record(z.string(), z.unknown()),
	idempotency_key: z.string().uuid(),
	status: z.enum(["pending", "syncing", "failed"]),
	retry_count: z.number().int().nonnegative(),
	last_error: z.string().optional(),
	created_at: TimestampSchema,
});

export type OutboxMutation = z.infer<typeof OutboxMutationSchema>;
