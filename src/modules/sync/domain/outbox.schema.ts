import { z } from "zod";

export const OutboxMutationSchema = z.object({
	id: z.string().uuid(),
	tenantId: z.string().uuid(),
	entity: z.enum(["pedidos", "clientes", "itens_pedido"]),
	action: z.enum(["INSERT", "UPDATE", "DELETE"]),
	payload: z.record(z.string(), z.unknown()),
	idempotencyKey: z.string().uuid(),
	status: z.enum(["pending", "syncing", "failed"]),
	retryCount: z.number().int().nonnegative(),
	lastError: z.string().optional(),
	createdAt: z.string(),
});

export type OutboxMutation = z.infer<typeof OutboxMutationSchema>;
