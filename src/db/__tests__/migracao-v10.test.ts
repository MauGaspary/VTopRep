import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../database";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CRIADO_EM = "2026-11-03T10:00:00.000Z";

const ESQUEMA_V9 = {
	outbox: "id, tenant_id, [tenant_id+status]",
	clientes_tabelas_preco:
		"id, tenant_id, [tenant_id+cliente_id+representada_id]",
};

const mutacao = (id: string, entity: string) => ({
	id,
	tenant_id: TENANT,
	entity,
	action: "UPDATE",
	payload: { id: crypto.randomUUID(), tenant_id: TENANT },
	idempotency_key: crypto.randomUUID(),
	status: "pending",
	retry_count: 0,
	last_error: null,
	created_at: CRIADO_EM,
});

describe("migração v9 -> v10", () => {
	let nomeBanco = "";
	let banco: AppDatabase | undefined;

	afterEach(async () => {
		banco?.close();
		await Dexie.delete(nomeBanco);
	});

	it("remove a store de tabela padrão por cliente e as mutações pendentes dela", async () => {
		nomeBanco = `migracao-v10-${crypto.randomUUID()}`;
		const legado = new Dexie(nomeBanco);
		legado.version(9).stores(ESQUEMA_V9);

		await legado.table("clientes_tabelas_preco").add({
			id: crypto.randomUUID(),
			tenant_id: TENANT,
			cliente_id: crypto.randomUUID(),
			representada_id: crypto.randomUUID(),
			tabela_id: crypto.randomUUID(),
			created_at: CRIADO_EM,
			updated_at: CRIADO_EM,
			deleted_at: null,
		});
		await legado
			.table("outbox")
			.bulkAdd([
				mutacao(
					"aaaaaaaa-0000-4000-a000-000000000001",
					"clientes_tabelas_preco",
				),
				mutacao("aaaaaaaa-0000-4000-a000-000000000002", "clientes"),
			]);
		legado.close();

		banco = new AppDatabase(nomeBanco);
		await banco.open();

		expect(banco.tables.map((t) => t.name)).not.toContain(
			"clientes_tabelas_preco",
		);
		const restantes = await banco.outbox.toArray();
		expect(restantes.map((m) => m.entity)).toEqual(["clientes"]);
	});
});
