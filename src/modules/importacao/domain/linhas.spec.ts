import { describe, expect, it } from "vitest";
import { extrairLinhasImportacao } from "./linhas";

const MAPEAMENTO = {
	sku: 0,
	descricao: 1,
	unidade_medida: 2,
	multiplo_embalagem: 3,
	preco: 4,
};

const extrair = (linhas: string[][], linhaCabecalho = 0) =>
	extrairLinhasImportacao({ linhas, linhaCabecalho, mapeamento: MAPEAMENTO });

const CAB = ["SKU", "Descrição", "UN", "Emb", "Preço"];

describe("extrairLinhasImportacao", () => {
	it("normaliza SKU, unidade, espaços e converte preço em centavos", () => {
		const r = extrair([
			CAB,
			[" a-1 ", "  Parafuso   sextavado ", "cx", "12", "1.234,56"],
		]);
		expect(r.problemas).toEqual([]);
		expect(r.linhas).toEqual([
			{
				linha: 2,
				sku: "A-1",
				descricao: "Parafuso sextavado",
				unidade_medida: "CX",
				multiplo_embalagem: 12,
				preco_centavos: 123456,
			},
		]);
		expect(r.total).toBe(1);
		expect([...r.skus]).toEqual(["A-1"]);
	});

	it("começa depois da linha de cabeçalho e numera como no Excel", () => {
		const r = extrair([["Título"], CAB, ["A1", "X", "", "", "1"]], 1);
		expect(r.linhas[0]?.linha).toBe(3);
	});

	it("ignora linhas vazias e trata células vazias como não informadas", () => {
		const r = extrair([CAB, ["", "", ""], ["A1", "", "", "", "2,00"], [" "]]);
		expect(r.total).toBe(1);
		expect(r.linhas[0]).toMatchObject({
			descricao: null,
			unidade_medida: null,
			multiplo_embalagem: null,
			preco_centavos: 200,
		});
	});

	it("aponta a linha dos erros e tira a linha da importação", () => {
		const r = extrair([
			CAB,
			["", "Sem código", "", "", "1,00"],
			["A2", "Preço ruim", "", "", "abc"],
			["A3", "Múltiplo ruim", "", "1,5", "1,00"],
			["A4", "Ok", "", "", "1,00"],
		]);
		expect(r.linhas.map((l) => l.sku)).toEqual(["A4"]);
		expect(r.problemas).toEqual([
			{ linha: 2, sku: null, gravidade: "erro", mensagem: "SKU vazio" },
			{
				linha: 3,
				sku: "A2",
				gravidade: "erro",
				mensagem: 'Preço inválido: "abc"',
			},
			{
				linha: 4,
				sku: "A3",
				gravidade: "erro",
				mensagem:
					'Múltiplo de embalagem inválido: "1,5" (use um inteiro maior que zero)',
			},
		]);
		// SKUs de linhas com erro continuam "presentes no arquivo"
		expect(r.skus.has("A2")).toBe(true);
	});

	it("avisa preço vazio e preço arredondado", () => {
		const r = extrair([
			CAB,
			["A1", "X", "", "", ""],
			["A2", "Y", "", "", "0,12345"],
		]);
		expect(r.linhas.map((l) => l.preco_centavos)).toEqual([null, 12]);
		expect(r.problemas.map((p) => [p.linha, p.gravidade])).toEqual([
			[2, "aviso"],
			[3, "aviso"],
		]);
		expect(r.problemas[1]?.mensagem).toContain("mais de 2 casas decimais");
	});

	it("SKU repetido igual: vale a primeira; diferente: erro em todas", () => {
		const r = extrair([
			CAB,
			["A1", "X", "", "", "1,00"],
			["a1", "X", "", "", "1,00"],
			["B1", "Y", "", "", "1,00"],
			["B1", "Y", "", "", "2,00"],
			["B1", "Y", "", "", "3,00"],
		]);
		expect(r.linhas.map((l) => l.linha)).toEqual([2]);
		expect(r.problemas).toEqual([
			{
				linha: 3,
				sku: "A1",
				gravidade: "aviso",
				mensagem: "SKU repetido (igual à linha 2); linha ignorada",
			},
			{
				linha: 4,
				sku: "B1",
				gravidade: "erro",
				mensagem: "SKU repetido com dados diferentes (também nas linhas 5, 6)",
			},
			{
				linha: 5,
				sku: "B1",
				gravidade: "erro",
				mensagem: "SKU repetido com dados diferentes (também nas linhas 4, 6)",
			},
			{
				linha: 6,
				sku: "B1",
				gravidade: "erro",
				mensagem: "SKU repetido com dados diferentes (também nas linhas 4, 5)",
			},
		]);
	});

	it("detecta o separador decimal pela coluna inteira", () => {
		const r = extrair([
			CAB,
			["A1", "X", "", "", "1.234"],
			["A2", "Y", "", "", "10.5"],
			["A3", "Z", "", "", "2.75"],
		]);
		expect(r.linhas.map((l) => l.preco_centavos)).toEqual([123, 1050, 275]);
	});

	it("sem coluna de preço, não avisa preço vazio", () => {
		const r = extrairLinhasImportacao({
			linhas: [CAB, ["A1", "X"]],
			linhaCabecalho: 0,
			mapeamento: {
				...MAPEAMENTO,
				preco: null,
				unidade_medida: null,
				multiplo_embalagem: null,
			},
		});
		expect(r.problemas).toEqual([]);
		expect(r.linhas[0]?.preco_centavos).toBeNull();
	});

	it("recusa descrição longa demais", () => {
		const r = extrair([CAB, ["A1", "x".repeat(256), "", "", "1"]]);
		expect(r.problemas[0]?.mensagem).toBe(
			"Descrição com mais de 255 caracteres",
		);
	});
});
