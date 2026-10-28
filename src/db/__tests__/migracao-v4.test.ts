import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../database";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CLIENTE_ID = "22222222-2222-4222-a222-222222222222";
const REP_ID = "33333333-3333-4333-a333-333333333333";
const AGORA = "2026-10-01T12:00:00.000Z";

/** Esquema da v3, como estava antes da migração. */
const ESQUEMA_V3 = {
	clientes: "id, tenant_id, [tenant_id+cnpj_cpf], [tenant_id+deleted_at]",
	clientes_enderecos: "id, cliente_id",
	clientes_contatos: "id, cliente_id",
	clientes_metricas: "cliente_id, tenant_id, [tenant_id+curva_abc]",
	produtos: "id, tenant_id, [tenant_id+sku], [tenant_id+deleted_at]",
	tabelas_preco:
		"id, tenant_id, [tenant_id+representada_id], [tenant_id+deleted_at]",
	itens_preco:
		"id, tenant_id, [tenant_id+tabela_id], [tenant_id+produto_id], [tenant_id+deleted_at]",
	pedidos:
		"id, tenant_id, [tenant_id+status], [tenant_id+cliente_id], [tenant_id+deleted_at]",
	itens_pedido: "id, tenant_id, [tenant_id+pedido_id], [tenant_id+deleted_at]",
	outbox: "id, tenantId, [tenantId+status]",
	representadas: "id, tenant_id, [tenant_id+cnpj]",
};

let nomeBanco = "";

async function criarBancoLegado(): Promise<void> {
	nomeBanco = `migracao-v4-${crypto.randomUUID()}`;
	const legado = new Dexie(nomeBanco);
	legado.version(3).stores(ESQUEMA_V3);

	await legado.table("clientes").bulkAdd([
		{
			id: CLIENTE_ID,
			tenant_id: TENANT,
			cnpj_cpf: "52998224725",
			razao_social: "Cliente Ativo",
			ativo: true,
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: null,
		},
		{
			id: "44444444-4444-4444-a444-444444444444",
			tenant_id: TENANT,
			cnpj_cpf: "11222333000181",
			razao_social: "Cliente Inativado",
			ativo: false,
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: AGORA,
		},
	]);
	await legado.table("clientes_enderecos").bulkAdd([
		{
			id: "e1",
			cliente_id: CLIENTE_ID,
			tipo_endereco: "PRINCIPAL",
			endereco_completo: "Rua A, 1",
		},
		{
			id: "e-orfao",
			cliente_id: "99999999-9999-4999-a999-999999999999",
			tipo_endereco: "PRINCIPAL",
			endereco_completo: "Sem pai",
		},
	]);
	await legado.table("clientes_contatos").add({
		id: "c1",
		cliente_id: CLIENTE_ID,
		nome: "Ana",
		telefone_whatsapp: "51 99999-9999",
	});
	await legado.table("representadas").bulkAdd([
		{ id: REP_ID, tenant_id: TENANT, cnpj: "11222333000181", deleted_at: null },
		{
			id: "55555555-5555-4555-a555-555555555555",
			tenant_id: TENANT,
			cnpj: "12ABC34501DE35",
			deleted_at: AGORA,
		},
	]);
	await legado.table("produtos").bulkAdd([
		{
			id: "p1",
			tenant_id: TENANT,
			representada_id: REP_ID,
			sku: "  sku-01 ",
			multiplo_embalagem: null,
			ativo: false,
			deleted_at: AGORA,
		},
	]);
	await legado.table("itens_preco").add({
		id: "ip1",
		tenant_id: TENANT,
		teto_desconto_permitido: 1500,
	});
	await legado.table("tabelas_preco").add({
		id: "t1",
		tenant_id: TENANT,
		vigencia_inicio: "2026-01-15T03:00:00.000Z",
		vigencia_fim: null,
	});
	await legado.table("outbox").add({
		id: "o1",
		tenantId: TENANT,
		idempotencyKey: "k1",
		retryCount: 2,
		createdAt: AGORA,
		status: "pending",
	});

	legado.close();
}

describe("migração v3 -> v4", () => {
	let banco: AppDatabase | undefined;

	afterEach(async () => {
		banco?.close();
		await Dexie.delete(nomeBanco);
	});

	it("preenche tenant_id nos filhos de clientes e remove órfãos", async () => {
		await criarBancoLegado();
		banco = new AppDatabase(nomeBanco);

		const enderecos = await banco.clientes_enderecos
			.where("[tenant_id+cliente_id]")
			.equals([TENANT, CLIENTE_ID])
			.toArray();
		expect(enderecos.map((e) => e.id)).toEqual(["e1"]);
		expect(await banco.clientes_enderecos.get("e-orfao")).toBeUndefined();

		const contato = await banco.clientes_contatos.get("c1");
		expect(contato?.tenant_id).toBe(TENANT);
	});

	it("converte inativação legada (deleted_at) em ativo = false", async () => {
		await criarBancoLegado();
		banco = new AppDatabase(nomeBanco);

		const inativado = await banco.clientes.get(
			"44444444-4444-4444-a444-444444444444",
		);
		expect(inativado).toMatchObject({ ativo: false, deleted_at: null });
		expect(await banco.clientes.get(CLIENTE_ID)).toMatchObject({
			ativo: true,
			deleted_at: null,
		});

		expect(await banco.representadas.get(REP_ID)).toMatchObject({
			ativo: true,
			deleted_at: null,
		});
		expect(
			await banco.representadas.get("55555555-5555-4555-a555-555555555555"),
		).toMatchObject({ ativo: false, deleted_at: null });
	});

	it("normaliza SKU e múltiplo e indexa por representada", async () => {
		await criarBancoLegado();
		banco = new AppDatabase(nomeBanco);

		const produtos = await banco.produtos
			.where("[tenant_id+representada_id+sku]")
			.equals([TENANT, REP_ID, "SKU-01"])
			.toArray();
		expect(produtos).toHaveLength(1);
		expect(produtos[0]).toMatchObject({
			multiplo_embalagem: 1,
			ativo: false,
			deleted_at: null,
		});
	});

	it("renomeia campos de itens de preço e do outbox e converte vigência em data", async () => {
		await criarBancoLegado();
		banco = new AppDatabase(nomeBanco);

		const itemPreco = await banco.itens_preco.get("ip1");
		expect(itemPreco?.desconto_maximo_permitido).toBe(1500);
		expect(itemPreco).not.toHaveProperty("teto_desconto_permitido");

		expect((await banco.tabelas_preco.get("t1"))?.vigencia_inicio).toBe(
			"2026-01-15",
		);

		const pendentes = await banco.outbox
			.where("[tenant_id+status]")
			.equals([TENANT, "pending"])
			.toArray();
		expect(pendentes).toHaveLength(1);
		expect(pendentes[0]).toMatchObject({
			tenant_id: TENANT,
			idempotency_key: "k1",
			retry_count: 2,
			created_at: AGORA,
		});
		expect(pendentes[0]).not.toHaveProperty("tenantId");
	});
});
