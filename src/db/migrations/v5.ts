import type { Transaction } from "dexie";
import { z } from "zod";

/**
 * Migração v4 -> v5: endereços e contatos passam a ter `created_at`,
 * `updated_at` e `deleted_at` (soft delete universal). Registros existentes
 * herdam o `updated_at` do cliente pai, a melhor estimativa disponível.
 */

type Registro = Record<string, unknown>;

const ReferenciaClienteSchema = z.object({
	id: z.string(),
	updated_at: z.string().optional(),
});

export async function migrarParaV5(tx: Transaction): Promise<void> {
	const clientes = z
		.array(ReferenciaClienteSchema)
		.parse(await tx.table("clientes").toArray());
	const atualizacaoPorCliente = new Map(
		clientes.map((c) => [c.id, c.updated_at]),
	);
	const fallback = new Date().toISOString();

	for (const tabela of ["clientes_enderecos", "clientes_contatos"]) {
		await tx
			.table(tabela)
			.toCollection()
			.modify((registro: Registro) => {
				const clienteId = registro.cliente_id;
				const instante =
					(typeof clienteId === "string"
						? atualizacaoPorCliente.get(clienteId)
						: undefined) ?? fallback;
				if (typeof registro.created_at !== "string") {
					registro.created_at = instante;
				}
				if (typeof registro.updated_at !== "string") {
					registro.updated_at = instante;
				}
				if (registro.deleted_at === undefined) {
					registro.deleted_at = null;
				}
			});
	}
}
