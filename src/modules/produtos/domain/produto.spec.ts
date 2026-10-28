import { describe, expect, it } from "vitest";
import {
	atualizarProduto,
	correspondeBuscaProduto,
	criarProduto,
	inativarProduto,
	normalizarSku,
	normalizarTexto,
	ordenarProdutosComInativosNoFim,
	reativarProduto,
} from "./produto";
import type { Produto, ProdutoInput } from "./produto.schema";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const REPRESENTADA_ID = "22222222-2222-4222-a222-222222222222";
const PRODUTO_ID = "33333333-3333-4333-a333-333333333333";
const NOVO_ID = "44444444-4444-4444-a444-444444444444";

const PRODUTO_BASE: Produto = {
	id: PRODUTO_ID,
	tenant_id: TENANT_ID,
	representada_id: REPRESENTADA_ID,
	sku: "SKU-001",
	descricao: "Parafuso Sextavado 1/2",
	unidade_medida: "UN",
	multiplo_embalagem: 100,
	ativo: true,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
	deleted_at: null,
};

describe("Produto - Lógica Pura de Domínio", () => {
	describe("criarProduto", () => {
		it("cria produto válido com múltiplos e unidade padrão", () => {
			const input: ProdutoInput = {
				representada_id: REPRESENTADA_ID,
				sku: "sku-abc-123",
				descricao: "  Tubo PVC 100mm  ",
				unidade_medida: "m  ",
				multiplo_embalagem: 6,
			};

			const criado = criarProduto(TENANT_ID, input, {
				gerarId: () => NOVO_ID,
				agora: () => "2026-01-02T12:00:00.000Z",
			});

			expect(criado).toEqual({
				id: NOVO_ID,
				tenant_id: TENANT_ID,
				representada_id: REPRESENTADA_ID,
				sku: "sku-abc-123",
				descricao: "Tubo PVC 100mm",
				unidade_medida: "M",
				multiplo_embalagem: 6,
				ativo: true,
				created_at: "2026-01-02T12:00:00.000Z",
				updated_at: "2026-01-02T12:00:00.000Z",
				deleted_at: null,
			});
		});

		it("atribui multiplo_embalagem padrão como 1 quando nulo ou indefinido", () => {
			const input: ProdutoInput = {
				representada_id: REPRESENTADA_ID,
				sku: "SKU-UNITARIO",
				descricao: "Item Unitário",
				unidade_medida: "UN",
				multiplo_embalagem: null,
			};

			const criado = criarProduto(TENANT_ID, input, {
				gerarId: () => NOVO_ID,
			});
			expect(criado.multiplo_embalagem).toBe(1);
		});

		it("rejeita produto com dados inválidos via Zod", () => {
			expect(() =>
				criarProduto(TENANT_ID, {
					representada_id: "invalido",
					sku: "",
					descricao: "",
					unidade_medida: "",
				}),
			).toThrow();
		});
	});

	describe("atualizarProduto", () => {
		it("atualiza campos preservando ID, tenant e created_at", () => {
			const input: ProdutoInput = {
				representada_id: REPRESENTADA_ID,
				sku: "SKU-001-REV",
				descricao: "Parafuso Sextavado 1/2 Aço Inox",
				unidade_medida: "CX",
				multiplo_embalagem: 50,
			};

			const atualizado = atualizarProduto(PRODUTO_BASE, input, {
				agora: () => "2026-02-01T10:00:00.000Z",
			});

			expect(atualizado.id).toBe(PRODUTO_BASE.id);
			expect(atualizado.tenant_id).toBe(PRODUTO_BASE.tenant_id);
			expect(atualizado.created_at).toBe(PRODUTO_BASE.created_at);
			expect(atualizado.sku).toBe("SKU-001-REV");
			expect(atualizado.descricao).toBe("Parafuso Sextavado 1/2 Aço Inox");
			expect(atualizado.unidade_medida).toBe("CX");
			expect(atualizado.multiplo_embalagem).toBe(50);
			expect(atualizado.updated_at).toBe("2026-02-01T10:00:00.000Z");
		});
	});

	describe("inativar e reativar", () => {
		it("inativa produto marcando ativo como false e preenchendo deleted_at", () => {
			const inativado = inativarProduto(PRODUTO_BASE, {
				agora: () => "2026-03-01T00:00:00.000Z",
			});

			expect(inativado.ativo).toBe(false);
			expect(inativado.deleted_at).toBe("2026-03-01T00:00:00.000Z");
			expect(inativado.updated_at).toBe("2026-03-01T00:00:00.000Z");
		});

		it("reativa produto inativo limpando deleted_at e marcando ativo como true", () => {
			const inativo: Produto = {
				...PRODUTO_BASE,
				ativo: false,
				deleted_at: "2026-03-01T00:00:00.000Z",
			};

			const reativado = reativarProduto(inativo, {
				agora: () => "2026-04-01T00:00:00.000Z",
			});

			expect(reativado.ativo).toBe(true);
			expect(reativado.deleted_at).toBeNull();
			expect(reativado.updated_at).toBe("2026-04-01T00:00:00.000Z");
		});
	});

	describe("normalização e busca", () => {
		it("normaliza SKU e texto com acentos", () => {
			expect(normalizarSku("  sku-xpto-99  ")).toBe("SKU-XPTO-99");
			expect(normalizarTexto("  Açúcar Cristal Orgânico  ")).toBe(
				"acucar cristal organico",
			);
		});

		it("corresponde busca por SKU ou descrição independentemente de maiúsculas/acentos", () => {
			expect(correspondeBuscaProduto(PRODUTO_BASE, "sextavado")).toBe(true);
			expect(correspondeBuscaProduto(PRODUTO_BASE, "sku-001")).toBe(true);
			expect(correspondeBuscaProduto(PRODUTO_BASE, "PARAFUSO")).toBe(true);
			expect(correspondeBuscaProduto(PRODUTO_BASE, "arruela")).toBe(false);
			expect(correspondeBuscaProduto(PRODUTO_BASE, undefined)).toBe(true);
			expect(correspondeBuscaProduto(PRODUTO_BASE, "")).toBe(true);
		});

		it("ordena produtos ativos primeiro e depois alfabeticamente por descrição", () => {
			const p1: Produto = { ...PRODUTO_BASE, descricao: "Zinco", ativo: true };
			const p2: Produto = {
				...PRODUTO_BASE,
				descricao: "Alumínio",
				ativo: false,
			};
			const p3: Produto = { ...PRODUTO_BASE, descricao: "Bronze", ativo: true };

			const ordenados = ordenarProdutosComInativosNoFim([p1, p2, p3]);
			expect(ordenados.map((p) => p.descricao)).toEqual([
				"Bronze",
				"Zinco",
				"Alumínio",
			]);
		});
	});
});
