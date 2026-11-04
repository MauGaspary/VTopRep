import { describe, expect, it } from "vitest";
import {
	detectarSeparadorDecimal,
	parseInteiroPositivoCsv,
	parsePrecoCsv,
} from "./numero-csv";

const centavos = (valor: string, sep: "," | "." = ",") => {
	const r = parsePrecoCsv(valor, sep);
	return r.ok ? r.centavos : r.erro;
};

describe("detectarSeparadorDecimal", () => {
	it("usa vírgula em colunas no padrão brasileiro", () => {
		expect(detectarSeparadorDecimal(["1.234,56", "12,5", "3"])).toBe(",");
	});

	it("usa ponto em colunas no padrão americano", () => {
		expect(detectarSeparadorDecimal(["1234.56", "12.5", "1,234.00"])).toBe(".");
	});

	it("decide pela maioria dos valores sem ambiguidade", () => {
		// "1.234" e "1,234" (3 casas) não votam
		expect(detectarSeparadorDecimal(["1.234", "1,234", "9.99"])).toBe(".");
	});

	it("usa vírgula quando nada desempata", () => {
		expect(detectarSeparadorDecimal(["1.234", "10", ""])).toBe(",");
		expect(detectarSeparadorDecimal([])).toBe(",");
	});

	it("separador repetido indica milhar", () => {
		expect(detectarSeparadorDecimal(["1.234.567"])).toBe(",");
		expect(detectarSeparadorDecimal(["1,234,567"])).toBe(".");
	});
});

describe("parsePrecoCsv", () => {
	it("converte formatos brasileiros", () => {
		expect(centavos("1.234,56")).toBe(123456);
		expect(centavos("R$ 1.234,56")).toBe(123456);
		expect(centavos("R$1.234,56")).toBe(123456);
		expect(centavos(" 12,5 ")).toBe(1250);
		expect(centavos("12")).toBe(1200);
		expect(centavos("0,01")).toBe(1);
		expect(centavos("0,00")).toBe(0);
		expect(centavos(",50")).toBe(50);
		expect(centavos("1.234.567,89")).toBe(123456789);
		expect(centavos("1 234,56")).toBe(123456);
		expect(centavos("1.234")).toBe(123400);
	});

	it("converte formatos com ponto decimal", () => {
		expect(centavos("1234.56", ".")).toBe(123456);
		expect(centavos("1,234.56", ".")).toBe(123456);
		expect(centavos("0.1", ".")).toBe(10);
	});

	it("não sofre com erros de ponto flutuante", () => {
		expect(centavos("0,29")).toBe(29);
		expect(centavos("1,15")).toBe(115);
		expect(centavos("4,35")).toBe(435);
		expect(centavos("1,005")).toBe(100); // half-even: 100,5 → 100
	});

	it("arredonda mais de 2 casas (half-even) e sinaliza", () => {
		expect(parsePrecoCsv("12,3456", ",")).toEqual({
			ok: true,
			centavos: 1235,
			arredondado: true,
		});
		expect(parsePrecoCsv("12,345", ",")).toEqual({
			ok: true,
			centavos: 1234,
			arredondado: true,
		});
		expect(parsePrecoCsv("12,355", ",")).toEqual({
			ok: true,
			centavos: 1236,
			arredondado: true,
		});
		expect(parsePrecoCsv("0,004", ",")).toEqual({
			ok: true,
			centavos: 0,
			arredondado: true,
		});
	});

	it("zeros extras não contam como arredondamento", () => {
		expect(parsePrecoCsv("12,3400", ",")).toEqual({
			ok: true,
			centavos: 1234,
			arredondado: false,
		});
	});

	it("recusa negativos, texto e formatos quebrados", () => {
		expect(parsePrecoCsv("-1,00", ",").ok).toBe(false);
		expect(parsePrecoCsv("(1,00)", ",").ok).toBe(false);
		expect(parsePrecoCsv("abc", ",").ok).toBe(false);
		expect(parsePrecoCsv("", ",").ok).toBe(false);
		expect(parsePrecoCsv("R$", ",").ok).toBe(false);
		expect(parsePrecoCsv("1,2,3", ",").ok).toBe(false);
		expect(parsePrecoCsv("1.23,45", ",").ok).toBe(false);
		expect(parsePrecoCsv("12,34a", ",").ok).toBe(false);
		expect(parsePrecoCsv(",", ",").ok).toBe(false);
	});

	it("explica o erro com o valor original", () => {
		expect(parsePrecoCsv(" -5 ", ",")).toEqual({
			ok: false,
			erro: 'Preço negativo: "-5"',
		});
		expect(parsePrecoCsv("x", ",")).toEqual({
			ok: false,
			erro: 'Preço inválido: "x"',
		});
	});
});

describe("parseInteiroPositivoCsv", () => {
	it("aceita inteiros com ou sem casas zeradas e milhar", () => {
		expect(parseInteiroPositivoCsv("12")).toBe(12);
		expect(parseInteiroPositivoCsv(" 12,00 ")).toBe(12);
		expect(parseInteiroPositivoCsv("12.0")).toBe(12);
		expect(parseInteiroPositivoCsv("1.000")).toBe(1000);
	});

	it("recusa frações, zero, negativos e texto", () => {
		expect(parseInteiroPositivoCsv("1,5")).toBeNull();
		expect(parseInteiroPositivoCsv("0")).toBeNull();
		expect(parseInteiroPositivoCsv("-2")).toBeNull();
		expect(parseInteiroPositivoCsv("cx")).toBeNull();
		expect(parseInteiroPositivoCsv("")).toBeNull();
	});
});
