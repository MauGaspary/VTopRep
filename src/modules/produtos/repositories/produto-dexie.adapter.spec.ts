import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import type { Representada } from "../../representadas/domain/representada.schema";
import {
	ProdutoInativoExistenteError,
	ProdutoNaoEncontradoError,
	RepresentadaNaoVinculadaError,
	SkuDuplicadoError,
} from "../domain/produto";
import type { Produto, ProdutoInput } from "../domain/produto.schema";
import { ProdutoDexieAdapter } from "./produto-dexie.adapter";

describe("ProdutoDexieAdapter", () => {
	const adapter = new ProdutoDexieAdapter();
	const tenant1 = "11111111-1111-4111-a111-111111111111";
	const tenant2 = "22222222-2222-4222-a222-222222222222";
	const repIdValida = "33333333-3333-4333-a333-333333333333";
	const repIdOutroTenant = "44444444-4444-4444-a444-444444444444";
	const repIdInativa = "55555555-5555-4555-a555-555555555555";
	const repIdOutraValida = "66666666-6666-4666-a666-666666666666";

	beforeEach(async () => {
		await db.produtos.clear();
		await db.representadas.clear();
		await db.tabelas_preco.clear();
		await db.itens_preco.clear();

		const repValida: Representada = {
			id: repIdValida,
			tenant_id: tenant1,
			razao_social: "Fabrica Alpha Ltda",
			nome_fantasia: "Fabrica Alpha",
			cnpj: "11222333000181",
			percentual_comissao_padrao: 500,
			valor_pedido_minimo_centavos: 10000,
			regras_frete_padrao: "FOB",
			ativo: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			deleted_at: null,
		};

		const repOutroTenant: Representada = {
			...repValida,
			id: repIdOutroTenant,
			tenant_id: tenant2,
		};

		const repInativa: Representada = {
			...repValida,
			id: repIdInativa,
			ativo: false,
		};

		await db.representadas.bulkAdd([repValida, repOutroTenant, repInativa]);
	});

	const mockProduto = (overrides: Partial<Produto>): Produto => ({
		id: crypto.randomUUID(),
		tenant_id: tenant1,
		representada_id: repIdValida,
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

	describe("buscarCatalogo e listar", () => {
		it("retorna apenas produtos ativos e não deletados do tenant correto", async () => {
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

		it("busca por termo no SKU ou descrição", async () => {
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

		it("filtra por representadaId quando informado", async () => {
			const outraRepId = "66666666-6666-4666-a666-666666666666";
			await db.representadas.add({
				id: outraRepId,
				tenant_id: tenant1,
				razao_social: "Outra Fabrica Ltda",
				nome_fantasia: "Outra Fabrica",
				cnpj: "22333444000192",
				percentual_comissao_padrao: 400,
				valor_pedido_minimo_centavos: 5000,
				regras_frete_padrao: "CIF",
				ativo: true,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				deleted_at: null,
			});

			await db.produtos.bulkAdd([
				mockProduto({ sku: "PA1", representada_id: repIdValida }),
				mockProduto({ sku: "PB1", representada_id: outraRepId }),
			]);

			const filtrados = await adapter.listar(tenant1, undefined, repIdValida);
			expect(filtrados).toHaveLength(1);
			expect(filtrados[0].sku).toBe("PA1");
		});
	});

	describe("criar", () => {
		const inputValido: ProdutoInput = {
			representada_id: repIdValida,
			sku: "PRD-NEW-01",
			descricao: "Novo Produto Teste",
			unidade_medida: "CX",
			multiplo_embalagem: 12,
		};

		it("cria produto com sucesso associado a uma representada válida", async () => {
			const criado = await adapter.criar(tenant1, inputValido);

			expect(criado.id).toBeDefined();
			expect(criado.tenant_id).toBe(tenant1);
			expect(criado.representada_id).toBe(repIdValida);
			expect(criado.sku).toBe("PRD-NEW-01");
			expect(criado.multiplo_embalagem).toBe(12);
			expect(criado.ativo).toBe(true);
			expect(criado.deleted_at).toBeNull();

			const salvo = await db.produtos.get(criado.id);
			expect(salvo).toBeDefined();
		});

		it("rejeita criação se a representada não existir ou pertencer a outro tenant", async () => {
			await expect(
				adapter.criar(tenant1, {
					...inputValido,
					representada_id: repIdOutroTenant,
				}),
			).rejects.toBeInstanceOf(RepresentadaNaoVinculadaError);

			await expect(
				adapter.criar(tenant1, {
					...inputValido,
					representada_id: "77777777-7777-4777-a777-777777777777",
				}),
			).rejects.toBeInstanceOf(RepresentadaNaoVinculadaError);
		});

		it("rejeita criação se a representada estiver inativa", async () => {
			await expect(
				adapter.criar(tenant1, {
					...inputValido,
					representada_id: repIdInativa,
				}),
			).rejects.toBeInstanceOf(RepresentadaNaoVinculadaError);
		});

		it("rejeita SKU duplicado entre produtos ativos no mesmo tenant", async () => {
			await adapter.criar(tenant1, inputValido);

			await expect(
				adapter.criar(tenant1, {
					...inputValido,
					sku: "  prd-new-01  ",
				}),
			).rejects.toBeInstanceOf(SkuDuplicadoError);
		});

		it("rejeita criação e emite ProdutoInativoExistenteError quando existe inativo com mesmo SKU", async () => {
			const criado = await adapter.criar(tenant1, inputValido);
			await adapter.inativar(tenant1, criado.id);

			await expect(adapter.criar(tenant1, inputValido)).rejects.toBeInstanceOf(
				ProdutoInativoExistenteError,
			);
		});

		it("permite o mesmo SKU em representadas distintas do mesmo tenant", async () => {
			await db.representadas.add({
				id: repIdOutraValida,
				tenant_id: tenant1,
				razao_social: "Fabrica Beta Ltda",
				nome_fantasia: "Fabrica Beta",
				cnpj: "12ABC34501DE35",
				percentual_comissao_padrao: 300,
				valor_pedido_minimo_centavos: 0,
				regras_frete_padrao: "CIF",
				ativo: true,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				deleted_at: null,
			});

			const daAlpha = await adapter.criar(tenant1, inputValido);
			const daBeta = await adapter.criar(tenant1, {
				...inputValido,
				sku: "prd-new-01",
				representada_id: repIdOutraValida,
			});

			expect(daBeta.sku).toBe(daAlpha.sku);
			expect(
				await adapter.obterPorSku(tenant1, repIdOutraValida, "PRD-NEW-01"),
			).toEqual(daBeta);
			expect(
				await adapter.obterPorSku(tenant1, repIdValida, " prd-new-01 "),
			).toEqual(daAlpha);
		});

		it("ignora registros excluídos (tombstone) na unicidade de SKU", async () => {
			await db.produtos.add(
				mockProduto({
					sku: "PRD-NEW-01",
					deleted_at: new Date().toISOString(),
				}),
			);

			await expect(adapter.criar(tenant1, inputValido)).resolves.toBeDefined();
		});

		it("serializa criações concorrentes com o mesmo SKU (transação)", async () => {
			const resultados = await Promise.allSettled([
				adapter.criar(tenant1, inputValido),
				adapter.criar(tenant1, inputValido),
			]);

			expect(resultados.map((r) => r.status).sort()).toEqual([
				"fulfilled",
				"rejected",
			]);
			expect(await db.produtos.count()).toBe(1);
		});
	});

	describe("atualizar", () => {
		it("permite atualizar campos e valida SKU único", async () => {
			const criado = await adapter.criar(tenant1, {
				representada_id: repIdValida,
				sku: "SKU-ORIGINAL",
				descricao: "Original",
				unidade_medida: "UN",
				multiplo_embalagem: 1,
			});

			const atualizado = await adapter.atualizar(tenant1, criado.id, {
				representada_id: repIdValida,
				sku: "SKU-ALTERADO",
				descricao: "Descrição Alterada",
				unidade_medida: "CX",
				multiplo_embalagem: 10,
			});

			expect(atualizado.sku).toBe("SKU-ALTERADO");
			expect(atualizado.descricao).toBe("Descrição Alterada");
			expect(atualizado.unidade_medida).toBe("CX");
		});

		it("lança ProdutoNaoEncontradoError ao atualizar id inexistente", async () => {
			await expect(
				adapter.atualizar(tenant1, "88888888-8888-4888-a888-888888888888", {
					representada_id: repIdValida,
					sku: "SKU-QUALQUER",
					descricao: "Qualquer",
					unidade_medida: "UN",
				}),
			).rejects.toBeInstanceOf(ProdutoNaoEncontradoError);
		});
	});

	describe("inativar e reativar", () => {
		it("inativa produto (ativo = false, sem tombstone) e permite reativação", async () => {
			const criado = await adapter.criar(tenant1, {
				representada_id: repIdValida,
				sku: "SKU-REATIVAVEL",
				descricao: "Item para Reativação",
				unidade_medida: "UN",
			});

			const inativado = await adapter.inativar(tenant1, criado.id);
			expect(inativado.ativo).toBe(false);
			expect(inativado.deleted_at).toBeNull();
			expect(await db.produtos.get(criado.id)).toEqual(inativado);

			// Não deve aparecer na listagem de ativos
			const ativos = await adapter.listar(tenant1);
			expect(ativos.find((p) => p.id === criado.id)).toBeUndefined();

			// Deve aparecer na listagem de todos
			const todos = await adapter.listarTodos(tenant1);
			expect(todos.find((p) => p.id === criado.id)).toBeDefined();

			// Reativação
			const reativado = await adapter.reativar(tenant1, criado.id);
			expect(reativado.ativo).toBe(true);
			expect(reativado.deleted_at).toBeNull();
		});

		it("impede reativação se a representada vinculada tiver sido inativada", async () => {
			const criado = await adapter.criar(tenant1, {
				representada_id: repIdValida,
				sku: "SKU-SEM-REP",
				descricao: "Item sem Representada",
				unidade_medida: "UN",
			});

			await adapter.inativar(tenant1, criado.id);

			await db.representadas.update(repIdValida, { ativo: false });

			await expect(adapter.reativar(tenant1, criado.id)).rejects.toBeInstanceOf(
				RepresentadaNaoVinculadaError,
			);
		});

		it("impede reativação se outro produto ativo assumiu o mesmo SKU", async () => {
			const criado = await adapter.criar(tenant1, {
				representada_id: repIdValida,
				sku: "SKU-DISPUTADO",
				descricao: "Original",
				unidade_medida: "UN",
			});
			await adapter.inativar(tenant1, criado.id);
			// Ex.: chegou via sincronização outro produto ativo com o mesmo SKU
			await db.produtos.add(mockProduto({ sku: "SKU-DISPUTADO" }));

			await expect(adapter.reativar(tenant1, criado.id)).rejects.toBeInstanceOf(
				SkuDuplicadoError,
			);
		});

		it("não permite inativar nem reativar produto de outro tenant", async () => {
			const criado = await adapter.criar(tenant1, {
				representada_id: repIdValida,
				sku: "SKU-T1",
				descricao: "Do tenant 1",
				unidade_medida: "UN",
			});

			await expect(adapter.inativar(tenant2, criado.id)).rejects.toBeInstanceOf(
				ProdutoNaoEncontradoError,
			);
			await expect(adapter.reativar(tenant2, criado.id)).rejects.toBeInstanceOf(
				ProdutoNaoEncontradoError,
			);
			expect((await db.produtos.get(criado.id))?.ativo).toBe(true);
		});
	});

	describe("preços por tabela no criar e atualizar", () => {
		it("salva, atualiza e remove preços do produto na mesma transação", async () => {
			const agora = new Date().toISOString();
			const tabelaPadraoId = "77777777-7777-4777-a777-777777777777";
			await db.tabelas_preco.add({
				id: tabelaPadraoId,
				tenant_id: tenant1,
				representada_id: repIdValida,
				nome_tabela: "Tabela Padrão",
				vigencia_inicio: "2026-01-01",
				vigencia_fim: null,
				ativo: true,
				created_at: agora,
				updated_at: agora,
				deleted_at: null,
			});

			const criado = await adapter.criar(
				tenant1,
				{
					representada_id: repIdValida,
					sku: "SKU-PRECO",
					descricao: "Produto com Preço",
					unidade_medida: "UN",
				},
				[
					{
						tabela_id: tabelaPadraoId,
						preco_base_centavos: 1990,
						desconto_maximo_permitido: 500,
					},
				],
			);

			const itensCriados = await db.itens_preco
				.where("[tenant_id+produto_id]")
				.equals([tenant1, criado.id])
				.toArray();
			expect(itensCriados).toHaveLength(1);
			expect(itensCriados[0]).toMatchObject({
				tabela_id: tabelaPadraoId,
				preco_base_centavos: 1990,
				desconto_maximo_permitido: 500,
				deleted_at: null,
			});

			// Atualiza o preço para null (remove com tombstone)
			await adapter.atualizar(
				tenant1,
				criado.id,
				{
					representada_id: repIdValida,
					sku: "SKU-PRECO",
					descricao: "Produto com Preço",
					unidade_medida: "UN",
				},
				[
					{
						tabela_id: tabelaPadraoId,
						preco_base_centavos: null,
					},
				],
			);

			const itensAposRemocao = await db.itens_preco
				.where("[tenant_id+produto_id]")
				.equals([tenant1, criado.id])
				.toArray();
			expect(itensAposRemocao[0]?.deleted_at).not.toBeNull();
		});
	});
});
