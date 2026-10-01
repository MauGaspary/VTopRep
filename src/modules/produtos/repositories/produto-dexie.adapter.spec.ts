import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import type { Produto } from "../domain/produto.schema";
import { ProdutoDexieAdapter } from "./produto-dexie.adapter";

describe("ProdutoDexieAdapter", () => {
	const adapter = new ProdutoDexieAdapter();
	const tenant1 = "11111111-1111-4111-a111-111111111111";
	const tenant2 = "22222222-2222-4222-a222-222222222222";

	beforeEach(async () => {
		await db.produtos.clear();
	});

	const mockProduto = (overrides: Partial<Produto>): Produto => ({
		id: crypto.randomUUID(),
		tenant_id: tenant1,
		representada_id: crypto.randomUUID(),
		sku: "SKU-DEFAULT",
		descricao: "Produto Padrao",
		unidade_medida: "UN",
		multiplo_embalagem: 1,
		ativo: true,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		deleted_at: null,
		...overrides,
	});

	it("deve retornar produtos ativos e não deletados do tenant correto", async () => {
		await db.produtos.bulkAdd([
			mockProduto({ sku: "P1", tenant_id: tenant1 }),
			mockProduto({ sku: "P2", tenant_id: tenant2 }), // Outro tenant
			mockProduto({ sku: "P3", tenant_id: tenant1, ativo: false }), // Inativo
			mockProduto({
				sku: "P4",
				tenant_id: tenant1,
				deleted_at: new Date().toISOString(),
			}), // Deletado
		]);

		const result = await adapter.buscarCatalogo(tenant1);

		expect(result).toHaveLength(1);
		expect(result[0].sku).toBe("P1");
	});

	it("deve buscar por termo no SKU ou descrição", async () => {
		await db.produtos.bulkAdd([
			mockProduto({
				sku: "SKU123",
				descricao: "Caneta Azul",
				tenant_id: tenant1,
			}),
			mockProduto({
				sku: "SKU456",
				descricao: "Caderno 10 Matérias",
				tenant_id: tenant1,
			}),
			mockProduto({ sku: "SKU789", descricao: "Lápis", tenant_id: tenant1 }),
		]);

		const resultSku = await adapter.buscarCatalogo(tenant1, "123");
		expect(resultSku).toHaveLength(1);
		expect(resultSku[0].sku).toBe("SKU123");

		const resultDescricao = await adapter.buscarCatalogo(tenant1, "cader");
		expect(resultDescricao).toHaveLength(1);
		expect(resultDescricao[0].descricao).toBe("Caderno 10 Matérias");

		const resultCase = await adapter.buscarCatalogo(tenant1, "CANETA");
		expect(resultCase).toHaveLength(1);
		expect(resultCase[0].descricao).toBe("Caneta Azul");
	});

	it("deve lançar erro se o tenantId não for fornecido", async () => {
		await expect(adapter.buscarCatalogo("")).rejects.toThrow(
			"tenantId é obrigatório",
		);
	});
});
