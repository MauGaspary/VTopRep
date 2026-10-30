import { describe, expect, it } from "vitest";
import { NOME_TABELA_PADRAO } from "../../produtos/domain/tabela-preco";
import { criarRepresentada } from "./representada";
import {
	chaveErroTabelaPreco,
	type RepresentadaFormValues,
	validarFormularioRepresentada,
	validarTabelasPrecoForm,
	valoresIniciaisFormulario,
	valoresIniciaisTabelasPrecoForm,
} from "./representada-form";

const formValido = (
	overrides: Partial<RepresentadaFormValues> = {},
): RepresentadaFormValues => ({
	razao_social: "Fábrica ACME Ltda",
	nome_fantasia: "ACME",
	cnpj: "11.222.333/0001-81",
	percentual_comissao: "5,25",
	valor_pedido_minimo: "1.500,00",
	regras_frete_padrao: "FOB",
	...overrides,
});

describe("validarFormularioRepresentada", () => {
	it("converte texto pt-BR em inteiros (centésimos e centavos)", () => {
		const resultado = validarFormularioRepresentada(formValido());
		expect(resultado).toEqual({
			success: true,
			data: {
				razao_social: "Fábrica ACME Ltda",
				nome_fantasia: "ACME",
				cnpj: "11222333000181",
				percentual_comissao_padrao: 525,
				valor_pedido_minimo_centavos: 150000,
				regras_frete_padrao: "FOB",
			},
		});
	});

	it("trata pedido mínimo vazio como zero", () => {
		const resultado = validarFormularioRepresentada(
			formValido({ valor_pedido_minimo: "  " }),
		);
		expect(resultado.success).toBe(true);
		if (resultado.success) {
			expect(resultado.data.valor_pedido_minimo_centavos).toBe(0);
		}
	});

	it("retorna erros mapeados para os campos do formulário", () => {
		const resultado = validarFormularioRepresentada({
			razao_social: "",
			nome_fantasia: "",
			cnpj: "11.222.333/0001-00",
			percentual_comissao: "abc",
			valor_pedido_minimo: "1,234",
			regras_frete_padrao: "EXW",
		});
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(Object.keys(resultado.erros).sort()).toEqual(
				[
					"cnpj",
					"nome_fantasia",
					"percentual_comissao",
					"razao_social",
					"regras_frete_padrao",
					"valor_pedido_minimo",
				].sort(),
			);
			expect(resultado.erros.percentual_comissao).toContain("percentual");
		}
	});

	it("rejeita comissão acima de 100%", () => {
		const resultado = validarFormularioRepresentada(
			formValido({ percentual_comissao: "100,01" }),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.percentual_comissao).toBe(
				"Comissão não pode exceder 100%",
			);
		}
	});

	it("rejeita CNPJ inválido com mensagem amigável", () => {
		const resultado = validarFormularioRepresentada(
			formValido({ cnpj: "11.222.333/0001-82" }),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.cnpj).toBe("CNPJ inválido");
		}
	});
});

describe("valoresIniciaisFormulario", () => {
	it("retorna valores vazios com frete CIF por padrão", () => {
		expect(valoresIniciaisFormulario()).toEqual({
			razao_social: "",
			nome_fantasia: "",
			cnpj: "",
			percentual_comissao: "",
			valor_pedido_minimo: "",
			regras_frete_padrao: "CIF",
		});
	});

	it("formata uma representada existente e faz ida-e-volta sem perdas", () => {
		const representada = criarRepresentada({
			tenantId: "11111111-1111-4111-a111-111111111111",
			id: "33333333-3333-4333-a333-333333333333",
			agora: "2026-10-22T12:00:00.000Z",
			input: {
				razao_social: "ACME Ltda",
				nome_fantasia: "ACME",
				cnpj: "11222333000181",
				percentual_comissao_padrao: 333,
				valor_pedido_minimo_centavos: 123456789,
				regras_frete_padrao: "FOB_REDESPACHO",
			},
		});

		const valores = valoresIniciaisFormulario(representada);
		expect(valores.cnpj).toBe("11.222.333/0001-81");
		expect(valores.percentual_comissao).toBe("3,33");
		expect(valores.valor_pedido_minimo).toBe("1.234.567,89");

		const resultado = validarFormularioRepresentada(valores);
		expect(resultado.success).toBe(true);
		if (resultado.success) {
			expect(resultado.data.percentual_comissao_padrao).toBe(333);
			expect(resultado.data.valor_pedido_minimo_centavos).toBe(123456789);
		}
	});
});

describe("valoresIniciaisTabelasPrecoForm e validarTabelasPrecoForm", () => {
	it("sugere Tabela Padrão vigente a partir de hoje quando não há tabelas", () => {
		const iniciais = valoresIniciaisTabelasPrecoForm(
			undefined,
			"2026-10-29",
			() => "id-local",
		);
		expect(iniciais).toEqual([
			{
				localId: "id-local",
				nome_tabela: NOME_TABELA_PADRAO,
				vigencia_inicio: "2026-10-29",
				vigencia_fim: "",
				ativo: true,
			},
		]);

		expect(validarTabelasPrecoForm(iniciais)).toEqual({
			success: true,
			data: [
				{
					id: undefined,
					nome_tabela: NOME_TABELA_PADRAO,
					vigencia_inicio: "2026-10-29",
					vigencia_fim: null,
					ativo: true,
				},
			],
		});
	});

	it("mapeia erros por linha e campo (ex: nome vazio e fim antes do início)", () => {
		const resultado = validarTabelasPrecoForm([
			{
				localId: "1",
				nome_tabela: "  ",
				vigencia_inicio: "2026-06-10",
				vigencia_fim: "2026-06-01",
				ativo: true,
			},
		]);

		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros[chaveErroTabelaPreco(0, "nome_tabela")]).toBe(
				"Nome da tabela é obrigatório",
			);
			expect(resultado.erros[chaveErroTabelaPreco(0, "vigencia_fim")]).toBe(
				"Fim da vigência não pode ser anterior ao início",
			);
		}
	});
});
