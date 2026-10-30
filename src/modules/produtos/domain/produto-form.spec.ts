import { describe, expect, it } from "vitest";
import type { ItemPreco } from "./item-preco.schema";
import { criarProduto } from "./produto";
import {
	chaveErroPrecoTabela,
	type ProdutoFormValues,
	validarFormularioProduto,
	validarPrecosProdutoForm,
	valoresIniciaisPrecosProdutoForm,
	valoresIniciaisProdutoForm,
} from "./produto-form";
import type { TabelaPreco } from "./tabela-preco.schema";

const REPRESENTADA_ID = "22222222-2222-4222-a222-222222222222";

const formValido = (
	overrides: Partial<ProdutoFormValues> = {},
): ProdutoFormValues => ({
	representada_id: REPRESENTADA_ID,
	sku: " prd-001 ",
	descricao: "Parafuso Sextavado",
	unidade_medida: "cx",
	multiplo_embalagem: "6",
	...overrides,
});

describe("validarFormularioProduto", () => {
	it("converte os valores em input de domínio", () => {
		expect(validarFormularioProduto(formValido())).toEqual({
			success: true,
			data: {
				representada_id: REPRESENTADA_ID,
				sku: "prd-001",
				descricao: "Parafuso Sextavado",
				unidade_medida: "cx",
				multiplo_embalagem: 6,
			},
		});
	});

	it("trata múltiplo vazio como ausente (o domínio usa 1)", () => {
		const resultado = validarFormularioProduto(
			formValido({ multiplo_embalagem: "  " }),
		);
		expect(resultado.success).toBe(true);
		if (resultado.success) {
			expect(resultado.data.multiplo_embalagem).toBeNull();
		}
	});

	it.each([
		["texto", "abc"],
		["número com sufixo", "12abc"],
		["decimal com vírgula", "1,5"],
		["decimal com ponto", "1.5"],
		["negativo", "-3"],
	])("rejeita múltiplo %s em vez de trocar por 1", (_, valor) => {
		const resultado = validarFormularioProduto(
			formValido({ multiplo_embalagem: valor }),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.multiplo_embalagem).toBeDefined();
		}
	});

	it("rejeita múltiplo zero com a mensagem do schema", () => {
		const resultado = validarFormularioProduto(
			formValido({ multiplo_embalagem: "0" }),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.multiplo_embalagem).toBe(
				"Múltiplo de embalagem deve ser maior que zero",
			);
		}
	});

	it("mapeia erros de todos os campos e não gera erro geral", () => {
		const resultado = validarFormularioProduto({
			representada_id: "",
			sku: "",
			descricao: "",
			unidade_medida: "",
			multiplo_embalagem: "x",
		});
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(Object.keys(resultado.erros).sort()).toEqual(
				[
					"descricao",
					"multiplo_embalagem",
					"representada_id",
					"sku",
					"unidade_medida",
				].sort(),
			);
			expect(resultado.geral).toBeNull();
		}
	});
});

describe("valoresIniciaisProdutoForm", () => {
	it("usa a representada padrão e unidade UN para produto novo", () => {
		expect(valoresIniciaisProdutoForm(undefined, REPRESENTADA_ID)).toEqual({
			representada_id: REPRESENTADA_ID,
			sku: "",
			descricao: "",
			unidade_medida: "UN",
			multiplo_embalagem: "1",
		});
	});

	it("faz ida-e-volta de um produto existente sem perdas", () => {
		const produto = criarProduto({
			tenantId: "11111111-1111-4111-a111-111111111111",
			id: "33333333-3333-4333-a333-333333333333",
			agora: "2026-10-28T12:00:00.000Z",
			input: {
				representada_id: REPRESENTADA_ID,
				sku: "PRD-9",
				descricao: "Tubo",
				unidade_medida: "M",
				multiplo_embalagem: 12,
			},
		});

		const resultado = validarFormularioProduto(
			valoresIniciaisProdutoForm(produto),
		);
		expect(resultado).toEqual({
			success: true,
			data: {
				representada_id: REPRESENTADA_ID,
				sku: "PRD-9",
				descricao: "Tubo",
				unidade_medida: "M",
				multiplo_embalagem: 12,
			},
		});
	});
});

describe("valoresIniciaisPrecosProdutoForm e validarPrecosProdutoForm", () => {
	const TABELA_A = "44444444-4444-4444-a444-444444444444";
	const TABELA_B = "55555555-5555-4555-a555-555555555555";
	const tabelas: TabelaPreco[] = [
		{
			id: TABELA_A,
			tenant_id: "11111111-1111-4111-a111-111111111111",
			representada_id: REPRESENTADA_ID,
			nome_tabela: "Tabela Padrão",
			vigencia_inicio: "2026-01-01",
			vigencia_fim: null,
			ativo: true,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
			deleted_at: null,
		},
		{
			id: TABELA_B,
			tenant_id: "11111111-1111-4111-a111-111111111111",
			representada_id: REPRESENTADA_ID,
			nome_tabela: "Tabela Atacado",
			vigencia_inicio: "2026-06-01",
			vigencia_fim: "2026-12-31",
			ativo: true,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
			deleted_at: null,
		},
	];

	it("monta linhas a partir das tabelas e faz ida-e-volta de preços e descontos", () => {
		const itens = new Map<string, ItemPreco>([
			[
				TABELA_A,
				{
					id: "66666666-6666-4666-a666-666666666666",
					tenant_id: "11111111-1111-4111-a111-111111111111",
					tabela_id: TABELA_A,
					produto_id: "77777777-7777-4777-a777-777777777777",
					preco_base_centavos: 12990,
					desconto_maximo_permitido: 550,
					created_at: "2026-01-01T00:00:00.000Z",
					updated_at: "2026-01-01T00:00:00.000Z",
					deleted_at: null,
				},
			],
		]);

		const iniciais = valoresIniciaisPrecosProdutoForm(tabelas, itens);
		expect(iniciais).toEqual([
			{
				tabela_id: TABELA_A,
				nome_tabela: "Tabela Padrão",
				vigencia_inicio: "2026-01-01",
				vigencia_fim: null,
				preco_base: "129,90",
				desconto_maximo: "5,50",
			},
			{
				tabela_id: TABELA_B,
				nome_tabela: "Tabela Atacado",
				vigencia_inicio: "2026-06-01",
				vigencia_fim: "2026-12-31",
				preco_base: "",
				desconto_maximo: "",
			},
		]);

		expect(validarPrecosProdutoForm(iniciais)).toEqual({
			success: true,
			data: [
				{
					tabela_id: TABELA_A,
					preco_base_centavos: 12990,
					desconto_maximo_permitido: 550,
				},
				{
					tabela_id: TABELA_B,
					preco_base_centavos: null,
					desconto_maximo_permitido: 0,
				},
			],
		});
	});

	it("mapeia erros de preço inválido e desconto acima de 100%", () => {
		const resultado = validarPrecosProdutoForm([
			{
				tabela_id: TABELA_A,
				nome_tabela: "Tabela Padrão",
				vigencia_inicio: "2026-01-01",
				vigencia_fim: null,
				preco_base: "abc",
				desconto_maximo: "120,00",
			},
		]);

		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(
				resultado.erros[chaveErroPrecoTabela(TABELA_A, "preco_base")],
			).toBeDefined();
			expect(
				resultado.erros[chaveErroPrecoTabela(TABELA_A, "desconto_maximo")],
			).toBe("Desconto máximo não pode exceder 100%");
		}
	});
});
