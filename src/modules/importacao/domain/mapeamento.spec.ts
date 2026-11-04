import { describe, expect, it } from "vitest";
import {
	adivinharMapeamento,
	colunasParaSalvar,
	detectarLinhaCabecalho,
	letraColuna,
	sugerirMapeamento,
	validarMapeamento,
} from "./mapeamento";

const CABECALHO = ["Código", "Descrição do Produto", "UN", "Emb.", "Preço R$"];

describe("adivinharMapeamento", () => {
	it("reconhece nomes comuns com acento, pontuação e caixa variados", () => {
		expect(adivinharMapeamento(CABECALHO)).toEqual({
			sku: 0,
			descricao: 1,
			unidade_medida: 2,
			multiplo_embalagem: 3,
			preco: 4,
		});
	});

	it("deixa de fora colunas que não reconhece", () => {
		expect(adivinharMapeamento(["Ref", "Item", "IPI"])).toEqual({
			sku: 0,
			descricao: null,
			unidade_medida: null,
			multiplo_embalagem: null,
			preco: null,
		});
	});

	it("não usa a mesma coluna para dois campos", () => {
		const m = adivinharMapeamento(["Preço", "Valor"]);
		expect(m.preco).toBe(0);
		expect(m.sku).toBeNull();
	});
});

describe("sugerirMapeamento", () => {
	it("usa o mapeamento salvo pelo nome, mesmo com colunas em outra ordem", () => {
		const salvo = {
			sku: "Ref. Fábrica",
			descricao: "Nome",
			unidade_medida: null,
			multiplo_embalagem: null,
			preco: "Tabela 2026",
		};
		const m = sugerirMapeamento(
			["Tabela 2026", "UN", "nome", "REF FÁBRICA"],
			salvo,
		);
		expect(m).toEqual({
			sku: 3,
			descricao: 2,
			// salvo como "não importar": continua de fora, mesmo reconhecível
			unidade_medida: null,
			multiplo_embalagem: null,
			preco: 0,
		});
	});

	it("completa com a adivinhação os campos salvos que sumiram do arquivo", () => {
		const salvo = {
			sku: "Cod. antigo",
			descricao: "Descrição",
			unidade_medida: null,
			multiplo_embalagem: null,
			preco: "Preço",
		};
		expect(
			sugerirMapeamento(["Código", "Descrição", "Preço"], salvo),
		).toMatchObject({
			sku: 0,
			descricao: 1,
			preco: 2,
		});
	});

	it("sem mapeamento salvo, adivinha", () => {
		expect(sugerirMapeamento(CABECALHO, null).sku).toBe(0);
	});
});

describe("colunasParaSalvar / validarMapeamento", () => {
	it("guarda os nomes do cabeçalho", () => {
		expect(
			colunasParaSalvar(CABECALHO, {
				sku: 0,
				descricao: 1,
				unidade_medida: null,
				multiplo_embalagem: null,
				preco: 4,
			}),
		).toEqual({
			sku: "Código",
			descricao: "Descrição do Produto",
			unidade_medida: null,
			multiplo_embalagem: null,
			preco: "Preço R$",
		});
	});

	it("exige SKU e colunas distintas", () => {
		const base = {
			sku: null,
			descricao: 1,
			unidade_medida: null,
			multiplo_embalagem: null,
			preco: null,
		};
		expect(validarMapeamento(base).ok).toBe(false);
		expect(validarMapeamento({ ...base, sku: 1 }).ok).toBe(false);
		expect(validarMapeamento({ ...base, sku: 0 })).toEqual({
			ok: true,
			mapeamento: { ...base, sku: 0 },
		});
	});
});

describe("detectarLinhaCabecalho", () => {
	it("pula linhas de título antes do cabeçalho", () => {
		const linhas = [
			["TABELA DE PREÇOS 2026", "", ""],
			["Válida a partir de 01/01/2026", "", ""],
			[""],
			["Código", "Descrição", "Preço"],
			["A1", "Parafuso", "1,50"],
		];
		expect(detectarLinhaCabecalho(linhas)).toBe(3);
	});

	it("sem nomes reconhecidos, usa a primeira linha mais preenchida", () => {
		const linhas = [["Lista"], ["X", "Y", "Z"], ["1", "2", "3"]];
		expect(detectarLinhaCabecalho(linhas)).toBe(1);
	});

	it("arquivo vazio usa a linha 0", () => {
		expect(detectarLinhaCabecalho([])).toBe(0);
	});
});

describe("letraColuna", () => {
	it("segue o padrão do Excel", () => {
		expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(letraColuna)).toEqual([
			"A",
			"B",
			"Z",
			"AA",
			"AB",
			"AZ",
			"BA",
			"ZZ",
			"AAA",
		]);
	});
});
