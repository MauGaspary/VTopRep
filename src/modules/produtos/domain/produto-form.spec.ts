import { describe, expect, it } from "vitest";
import { criarProduto } from "./produto";
import {
	type ProdutoFormValues,
	validarFormularioProduto,
	valoresIniciaisProdutoForm,
} from "./produto-form";

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
