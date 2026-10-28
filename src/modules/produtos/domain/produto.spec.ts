import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import {
	atualizarProduto,
	correspondeBuscaProduto,
	criarProduto,
	detectarConflitoSku,
	inativarProduto,
	normalizarSku,
	ordenarProdutosComInativosNoFim,
	reativarProduto,
} from "./produto";
import type { Produto, ProdutoInput } from "./produto.schema";

const TENANT_ID = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "99999999-9999-4999-a999-999999999999";
const REPRESENTADA_ID = "22222222-2222-4222-a222-222222222222";
const OUTRA_REPRESENTADA = "55555555-5555-4555-a555-555555555555";
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
		it("cria produto válido normalizando SKU, descrição e unidade", () => {
			const input: ProdutoInput = {
				representada_id: REPRESENTADA_ID,
				sku: " sku-abc-123 ",
				descricao: "  Tubo PVC 100mm  ",
				unidade_medida: "m  ",
				multiplo_embalagem: 6,
			};

			const criado = criarProduto({
				tenantId: TENANT_ID,
				input,
				id: NOVO_ID,
				agora: "2026-01-02T12:00:00.000Z",
			});

			expect(criado).toEqual({
				id: NOVO_ID,
				tenant_id: TENANT_ID,
				representada_id: REPRESENTADA_ID,
				sku: "SKU-ABC-123",
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
			const criar = (multiplo: number | null | undefined) =>
				criarProduto({
					tenantId: TENANT_ID,
					id: NOVO_ID,
					agora: "2026-01-02T12:00:00.000Z",
					input: {
						representada_id: REPRESENTADA_ID,
						sku: "SKU-UNITARIO",
						descricao: "Item Unitário",
						unidade_medida: "UN",
						multiplo_embalagem: multiplo,
					},
				});

			expect(criar(null).multiplo_embalagem).toBe(1);
			expect(criar(undefined).multiplo_embalagem).toBe(1);
		});

		it("rejeita produto com dados inválidos via Zod", () => {
			expect(() =>
				criarProduto({
					tenantId: TENANT_ID,
					id: NOVO_ID,
					agora: "2026-01-02T12:00:00.000Z",
					input: {
						representada_id: "invalido",
						sku: "",
						descricao: "",
						unidade_medida: "",
					},
				}),
			).toThrow();
		});

		it("rejeita tenant ou timestamp inválidos", () => {
			const input: ProdutoInput = {
				representada_id: REPRESENTADA_ID,
				sku: "SKU",
				descricao: "Item",
				unidade_medida: "UN",
			};
			expect(() =>
				criarProduto({ tenantId: "x", input, id: NOVO_ID, agora: "agora" }),
			).toThrow();
			expect(() =>
				criarProduto({
					tenantId: TENANT_ID,
					input,
					id: NOVO_ID,
					agora: "28/10/2026",
				}),
			).toThrow();
		});
	});

	describe("atualizarProduto", () => {
		const input: ProdutoInput = {
			representada_id: REPRESENTADA_ID,
			sku: "sku-001-rev",
			descricao: "Parafuso Sextavado 1/2 Aço Inox",
			unidade_medida: "CX",
			multiplo_embalagem: 50,
		};

		it("atualiza campos preservando ID, tenant, estado e created_at", () => {
			const atualizado = atualizarProduto(
				PRODUTO_BASE,
				TENANT_ID,
				input,
				"2026-02-01T10:00:00.000Z",
			);

			expect(atualizado.id).toBe(PRODUTO_BASE.id);
			expect(atualizado.tenant_id).toBe(PRODUTO_BASE.tenant_id);
			expect(atualizado.created_at).toBe(PRODUTO_BASE.created_at);
			expect(atualizado.ativo).toBe(true);
			expect(atualizado.sku).toBe("SKU-001-REV");
			expect(atualizado.descricao).toBe("Parafuso Sextavado 1/2 Aço Inox");
			expect(atualizado.unidade_medida).toBe("CX");
			expect(atualizado.multiplo_embalagem).toBe(50);
			expect(atualizado.updated_at).toBe("2026-02-01T10:00:00.000Z");
		});

		it("bloqueia atualização com tenant divergente", () => {
			expect(() =>
				atualizarProduto(
					PRODUTO_BASE,
					OUTRO_TENANT,
					input,
					"2026-02-01T10:00:00.000Z",
				),
			).toThrow(TenantDivergenteError);
		});
	});

	describe("inativar e reativar", () => {
		it("inativa marcando ativo = false sem preencher deleted_at (tombstone)", () => {
			const inativado = inativarProduto(
				PRODUTO_BASE,
				TENANT_ID,
				"2026-03-01T00:00:00.000Z",
			);

			expect(inativado.ativo).toBe(false);
			expect(inativado.deleted_at).toBeNull();
			expect(inativado.updated_at).toBe("2026-03-01T00:00:00.000Z");
		});

		it("reativa produto inativo marcando ativo = true", () => {
			const inativo: Produto = { ...PRODUTO_BASE, ativo: false };

			const reativado = reativarProduto(
				inativo,
				TENANT_ID,
				"2026-04-01T00:00:00.000Z",
			);

			expect(reativado.ativo).toBe(true);
			expect(reativado.deleted_at).toBeNull();
			expect(reativado.updated_at).toBe("2026-04-01T00:00:00.000Z");
		});

		it("é idempotente", () => {
			const inativo: Produto = { ...PRODUTO_BASE, ativo: false };
			expect(
				inativarProduto(inativo, TENANT_ID, "2026-05-01T00:00:00.000Z"),
			).toBe(inativo);
			expect(
				reativarProduto(PRODUTO_BASE, TENANT_ID, "2026-05-01T00:00:00.000Z"),
			).toBe(PRODUTO_BASE);
		});

		it("bloqueia inativação e reativação com tenant divergente", () => {
			expect(() =>
				inativarProduto(PRODUTO_BASE, OUTRO_TENANT, "2026-03-01T00:00:00.000Z"),
			).toThrow(TenantDivergenteError);
			expect(() =>
				reativarProduto(
					{ ...PRODUTO_BASE, ativo: false },
					OUTRO_TENANT,
					"2026-03-01T00:00:00.000Z",
				),
			).toThrow(TenantDivergenteError);
		});
	});

	describe("detectarConflitoSku", () => {
		it("permite o mesmo SKU em representadas distintas", () => {
			expect(
				detectarConflitoSku(
					[PRODUTO_BASE],
					{ representada_id: OUTRA_REPRESENTADA, sku: "SKU-001" },
					NOVO_ID,
				),
			).toBeNull();
		});

		it("detecta SKU repetido na mesma representada, ignorando caixa e espaços", () => {
			expect(
				detectarConflitoSku(
					[PRODUTO_BASE],
					{ representada_id: REPRESENTADA_ID, sku: " sku-001 " },
					NOVO_ID,
				),
			).toEqual({ tipo: "ativo", registro: PRODUTO_BASE });
		});

		it("sinaliza conflito com inativo para oferecer reativação", () => {
			const inativo: Produto = { ...PRODUTO_BASE, ativo: false };
			expect(
				detectarConflitoSku(
					[inativo],
					{ representada_id: REPRESENTADA_ID, sku: "SKU-001" },
					NOVO_ID,
				)?.tipo,
			).toBe("inativo");
		});
	});

	describe("normalização e busca", () => {
		it("normaliza SKU", () => {
			expect(normalizarSku("  sku-xpto-99  ")).toBe("SKU-XPTO-99");
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
