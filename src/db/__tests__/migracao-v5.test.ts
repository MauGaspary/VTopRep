import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../database";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CLIENTE_ID = "22222222-2222-4222-a222-222222222222";
const ATUALIZADO_EM = "2026-10-20T10:00:00.000Z";

/** Esquema da v4 (só as tabelas usadas no teste). */
const ESQUEMA_V4 = {
	clientes: "id, tenant_id, [tenant_id+cnpj_cpf], [tenant_id+deleted_at]",
	clientes_enderecos: "id, tenant_id, [tenant_id+cliente_id]",
	clientes_contatos: "id, tenant_id, [tenant_id+cliente_id]",
};

describe("migração v4 -> v5", () => {
	let nomeBanco = "";
	let banco: AppDatabase | undefined;

	afterEach(async () => {
		banco?.close();
		await Dexie.delete(nomeBanco);
	});

	it("preenche timestamps e deleted_at de endereços e contatos a partir do cliente", async () => {
		nomeBanco = `migracao-v5-${crypto.randomUUID()}`;
		const legado = new Dexie(nomeBanco);
		legado.version(4).stores(ESQUEMA_V4);
		await legado.table("clientes").add({
			id: CLIENTE_ID,
			tenant_id: TENANT,
			cnpj_cpf: "52998224725",
			updated_at: ATUALIZADO_EM,
		});
		await legado.table("clientes_enderecos").add({
			id: "e1",
			tenant_id: TENANT,
			cliente_id: CLIENTE_ID,
			tipo_endereco: "PRINCIPAL",
			endereco_completo: "Rua A, 1",
		});
		await legado.table("clientes_contatos").add({
			id: "c1",
			tenant_id: TENANT,
			cliente_id: CLIENTE_ID,
			nome: "Ana",
			telefone_whatsapp: "51 99999-9999",
		});
		legado.close();

		banco = new AppDatabase(nomeBanco);

		const esperado = {
			created_at: ATUALIZADO_EM,
			updated_at: ATUALIZADO_EM,
			deleted_at: null,
		};
		expect(await banco.clientes_enderecos.get("e1")).toMatchObject(esperado);
		expect(await banco.clientes_contatos.get("c1")).toMatchObject(esperado);
	});
});
