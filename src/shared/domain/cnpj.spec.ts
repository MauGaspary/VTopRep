import { describe, expect, it } from "vitest";
import {
	calcularDigitosVerificadoresCnpj,
	formatarCnpj,
	isCnpjValido,
	normalizarCnpj,
} from "./cnpj";

describe("normalizarCnpj", () => {
	it("remove pontuação, espaços e converte para maiúsculas", () => {
		expect(normalizarCnpj(" 11.222.333/0001-81 ")).toBe("11222333000181");
		expect(normalizarCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
	});
});

describe("isCnpjValido", () => {
	it("aceita CNPJ numérico válido, formatado ou não", () => {
		expect(isCnpjValido("11.222.333/0001-81")).toBe(true);
		expect(isCnpjValido("11222333000181")).toBe(true);
	});

	it("aceita CNPJ alfanumérico válido (exemplo oficial da RFB)", () => {
		expect(isCnpjValido("12.ABC.345/01DE-35")).toBe(true);
		expect(isCnpjValido("12abc34501de35")).toBe(true);
	});

	it("rejeita dígitos verificadores incorretos", () => {
		expect(isCnpjValido("11.222.333/0001-82")).toBe(false);
		expect(isCnpjValido("12.ABC.345/01DE-36")).toBe(false);
	});

	it("rejeita tamanho inválido, letras nos DVs e sequências repetidas", () => {
		expect(isCnpjValido("")).toBe(false);
		expect(isCnpjValido("1122233300018")).toBe(false);
		expect(isCnpjValido("112223330001811")).toBe(false);
		expect(isCnpjValido("112223330001A1")).toBe(false);
		expect(isCnpjValido("00000000000000")).toBe(false);
		expect(isCnpjValido("11111111111111")).toBe(false);
	});
});

describe("calcularDigitosVerificadoresCnpj", () => {
	it("calcula os DVs para base numérica e alfanumérica", () => {
		expect(calcularDigitosVerificadoresCnpj("112223330001")).toBe("81");
		expect(calcularDigitosVerificadoresCnpj("12ABC34501DE")).toBe("35");
	});

	it("lança erro para base inválida", () => {
		expect(() => calcularDigitosVerificadoresCnpj("123")).toThrow();
	});
});

describe("formatarCnpj", () => {
	it("aplica a máscara padrão", () => {
		expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
		expect(formatarCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
	});

	it("retorna a entrada original quando incompleta", () => {
		expect(formatarCnpj("1122")).toBe("1122");
	});
});
