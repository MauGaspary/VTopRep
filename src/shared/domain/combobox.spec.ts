import { describe, expect, it } from "vitest";
import {
	calcularIndiceDestacadoCombobox,
	filtrarOpcoesCombobox,
	type OpcaoCombobox,
} from "./combobox";

const OPCOES: readonly OpcaoCombobox[] = [
	{
		id: "1",
		label: "Mercado Central Sul",
		sublabel: "Comércio de Alimentos Central Ltda",
		keywords: ["11.222.333/0001-81"],
	},
	{
		id: "2",
		label: "Supermercado Alvorada",
		sublabel: "Rede Central de Supermercados S/A",
		keywords: ["98.765.432/0001-10"],
	},
	{
		id: "3",
		label: "Central Ferragens",
		sublabel: "Ferragens do Vale Ltda",
		keywords: ["123.456.789-09"],
	},
];

describe("filtrarOpcoesCombobox", () => {
	it("retorna todas as opções na ordem original quando o termo é vazio", () => {
		expect(filtrarOpcoesCombobox(OPCOES, "   ").map((o) => o.id)).toEqual([
			"1",
			"2",
			"3",
		]);
	});

	it("prioriza opções cujo rótulo começa com o termo antes de correspondências parciais", () => {
		const resultado = filtrarOpcoesCombobox(OPCOES, "central");
		expect(resultado.map((o) => o.id)).toEqual(["3", "1", "2"]);
	});

	it("encontra por CNPJ/CPF mesmo digitando sem pontuação", () => {
		const porCnpjSemPontuacao = filtrarOpcoesCombobox(OPCOES, "11222333");
		expect(porCnpjSemPontuacao.map((o) => o.id)).toEqual(["1"]);

		const porCpfFormatado = filtrarOpcoesCombobox(OPCOES, "456.789");
		expect(porCpfFormatado.map((o) => o.id)).toEqual(["3"]);
	});

	it("ignora caixa alta/baixa e acentuação", () => {
		const resultado = filtrarOpcoesCombobox(OPCOES, "COMERCIO DE ALIMENTOS");
		expect(resultado.map((o) => o.id)).toEqual(["1"]);
	});
});

describe("calcularIndiceDestacadoCombobox", () => {
	it("retorna -1 quando não há opções", () => {
		expect(calcularIndiceDestacadoCombobox(0, 0, "proximo")).toBe(-1);
		expect(calcularIndiceDestacadoCombobox(-1, 0, "anterior")).toBe(-1);
	});

	it("navega ciclicamente para frente e para trás", () => {
		expect(calcularIndiceDestacadoCombobox(-1, 3, "proximo")).toBe(0);
		expect(calcularIndiceDestacadoCombobox(0, 3, "proximo")).toBe(1);
		expect(calcularIndiceDestacadoCombobox(2, 3, "proximo")).toBe(0);

		expect(calcularIndiceDestacadoCombobox(-1, 3, "anterior")).toBe(2);
		expect(calcularIndiceDestacadoCombobox(0, 3, "anterior")).toBe(2);
		expect(calcularIndiceDestacadoCombobox(2, 3, "anterior")).toBe(1);
	});
});
