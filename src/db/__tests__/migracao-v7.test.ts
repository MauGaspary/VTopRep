import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase } from "../database";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CLIENTE_SEM_TIPO = "22222222-2222-4222-a222-222222222222";
const CLIENTE_FABRICA = "33333333-3333-4333-a333-333333333333";
const REP_LEGADA = "44444444-4444-4444-a444-444444444444";
const ATUALIZADO_EM = "2026-10-30T10:00:00.000Z";

const ESQUEMA_V6 = {
	clientes: "id, tenant_id, [tenant_id+cnpj_cpf], [tenant_id+deleted_at]",
	representadas: "id, tenant_id, [tenant_id+cnpj]",
};

describe("migração v6 -> v7", () => {
	let nomeBanco = "";
	let banco: AppDatabase | undefined;

	afterEach(async () => {
		banco?.close();
		await Dexie.delete(nomeBanco);
	});

	it("define tipo_cliente = 'REVENDA' nos clientes sem segmento e preenche percentual_comissao_fabrica nas representadas", async () => {
		nomeBanco = `migracao-v7-${crypto.randomUUID()}`;
		const legado = new Dexie(nomeBanco);
		legado.version(6).stores(ESQUEMA_V6);

		await legado.table("clientes").bulkAdd([
			{
				id: CLIENTE_SEM_TIPO,
				tenant_id: TENANT,
				cnpj_cpf: "52998224725",
				razao_social: "Mercado Sem Tipo",
				nome_fantasia: null,
				ativo: true,
				created_at: ATUALIZADO_EM,
				updated_at: ATUALIZADO_EM,
				deleted_at: null,
			},
			{
				id: CLIENTE_FABRICA,
				tenant_id: TENANT,
				cnpj_cpf: "11222333000181",
				razao_social: "Indústria Cliente S/A",
				nome_fantasia: "Indústria Cliente",
				tipo_cliente: "FABRICA",
				ativo: true,
				created_at: ATUALIZADO_EM,
				updated_at: ATUALIZADO_EM,
				deleted_at: null,
			},
		]);

		await legado.table("representadas").add({
			id: REP_LEGADA,
			tenant_id: TENANT,
			razao_social: "Fábrica Legada Ltda",
			nome_fantasia: "Fábrica Legada",
			cnpj: "11222333000181",
			percentual_comissao_padrao: 650,
			valor_pedido_minimo_centavos: 100000,
			regras_frete_padrao: "CIF",
			ativo: true,
			created_at: ATUALIZADO_EM,
			updated_at: ATUALIZADO_EM,
			deleted_at: null,
		});

		legado.close();

		banco = new AppDatabase(nomeBanco);

		const clienteMigrado = await banco.clientes.get(CLIENTE_SEM_TIPO);
		const clienteFabricaPreservado = await banco.clientes.get(CLIENTE_FABRICA);
		const repMigrada = await banco.representadas.get(REP_LEGADA);

		expect(clienteMigrado?.tipo_cliente).toBe("REVENDA");
		expect(clienteFabricaPreservado?.tipo_cliente).toBe("FABRICA");
		expect(repMigrada).toMatchObject({
			percentual_comissao_padrao: 650,
			percentual_comissao_fabrica: 650,
		});
		expect(repMigrada?.percentual_comissao_revenda).toBeUndefined();
	});
});
