import { describe, expect, it } from "vitest";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
	formatarInteiroComoDecimalBr,
	parseDecimalBrParaInteiro,
} from "./decimal-br";

describe("parseDecimalBrParaInteiro", () => {
	it("converte formatos pt-BR para inteiro escalado por 100", () => {
		expect(parseDecimalBrParaInteiro("1.500,50")).toBe(150050);
		expect(parseDecimalBrParaInteiro("1500,5")).toBe(150050);
		expect(parseDecimalBrParaInteiro("1500")).toBe(150000);
		expect(parseDecimalBrParaInteiro("0,01")).toBe(1);
		expect(parseDecimalBrParaInteiro("R$ 10,00")).toBe(1000);
		expect(parseDecimalBrParaInteiro("5,25%")).toBe(525);
	});

	it("aceita ponto como separador decimal quando não há vírgula e há até 2 casas", () => {
		expect(parseDecimalBrParaInteiro("5.25")).toBe(525);
		expect(parseDecimalBrParaInteiro("5.5")).toBe(550);
	});

	it("trata ponto seguido de 3 dígitos como separador de milhar", () => {
		expect(parseDecimalBrParaInteiro("1.500")).toBe(150000);
		expect(parseDecimalBrParaInteiro("1.234.567,89")).toBe(123456789);
	});

	it("evita erros de ponto flutuante clássicos", () => {
		// 0.1 + 0.2 em float seria 0.30000000000000004
		expect(parseDecimalBrParaInteiro("0,29")).toBe(29);
		expect(parseDecimalBrParaInteiro("1,15")).toBe(115);
		expect(parseDecimalBrParaInteiro("4,35")).toBe(435);
	});

	it("retorna null para entradas inválidas", () => {
		expect(parseDecimalBrParaInteiro("")).toBeNull();
		expect(parseDecimalBrParaInteiro("   ")).toBeNull();
		expect(parseDecimalBrParaInteiro("abc")).toBeNull();
		expect(parseDecimalBrParaInteiro("-5,00")).toBeNull();
		expect(parseDecimalBrParaInteiro("1,234")).toBeNull();
		expect(parseDecimalBrParaInteiro("1,2,3")).toBeNull();
		expect(parseDecimalBrParaInteiro("99999999999999999999")).toBeNull();
	});
});

describe("formatarInteiroComoDecimalBr", () => {
	it("formata com separador de milhar e 2 casas", () => {
		expect(formatarInteiroComoDecimalBr(0)).toBe("0,00");
		expect(formatarInteiroComoDecimalBr(5)).toBe("0,05");
		expect(formatarInteiroComoDecimalBr(150050)).toBe("1.500,50");
		expect(formatarInteiroComoDecimalBr(123456789)).toBe("1.234.567,89");
		expect(formatarInteiroComoDecimalBr(-1050)).toBe("-10,50");
	});

	it("lança erro para valores não inteiros", () => {
		expect(() => formatarInteiroComoDecimalBr(1.5)).toThrow();
	});

	it("é inverso de parseDecimalBrParaInteiro", () => {
		for (const valor of [0, 1, 99, 100, 101, 150050, 999999]) {
			expect(
				parseDecimalBrParaInteiro(formatarInteiroComoDecimalBr(valor)),
			).toBe(valor);
		}
	});
});

describe("formatadores de apresentação", () => {
	it("formata centavos e percentuais", () => {
		expect(formatarCentavos(150050)).toBe("R$ 1.500,50");
		expect(formatarCentesimosPercentual(525)).toBe("5,25%");
	});
});
