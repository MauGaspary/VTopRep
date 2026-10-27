import { describe, expect, it } from "vitest";
import {
	formatarCpfCnpj,
	isCpfOuCnpjValido,
	isCpfValido,
	normalizarCpf,
} from "./cpf-cnpj";

describe("normalizarCpf", () => {
	it("remove caracteres não numéricos", () => {
		expect(normalizarCpf(" 123.456.789-00 ")).toBe("12345678900");
	});
});

describe("isCpfValido", () => {
	it("valida CPFs reais", () => {
		// CPFs válidos conhecidos
		expect(isCpfValido("52998224725")).toBe(true);
		expect(isCpfValido("529.982.247-25")).toBe(true);
	});

	it("rejeita CPFs com todos dígitos iguais", () => {
		expect(isCpfValido("11111111111")).toBe(false);
		expect(isCpfValido("00000000000")).toBe(false);
	});

	it("rejeita CPFs com dígitos verificadores incorretos", () => {
		expect(isCpfValido("52998224726")).toBe(false);
	});

	it("rejeita tamanho diferente de 11", () => {
		expect(isCpfValido("1234567890")).toBe(false);
		expect(isCpfValido("123456789012")).toBe(false);
	});
});

describe("isCpfOuCnpjValido", () => {
	it("aceita CPF válido", () => {
		expect(isCpfOuCnpjValido("529.982.247-25")).toBe(true);
		expect(isCpfOuCnpjValido("52998224725")).toBe(true);
	});

	it("aceita CNPJ numérico válido", () => {
		expect(isCpfOuCnpjValido("11.222.333/0001-81")).toBe(true);
		expect(isCpfOuCnpjValido("11222333000181")).toBe(true);
	});

	it("aceita CNPJ alfanumérico válido", () => {
		expect(isCpfOuCnpjValido("12.ABC.345/01DE-35")).toBe(true);
	});

	it("rejeita documento inválido", () => {
		expect(isCpfOuCnpjValido("12345678900")).toBe(false);
		expect(isCpfOuCnpjValido("11222333000182")).toBe(false);
		expect(isCpfOuCnpjValido("")).toBe(false);
	});
});

describe("formatarCpfCnpj", () => {
	it("formata CPF", () => {
		expect(formatarCpfCnpj("52998224725")).toBe("529.982.247-25");
	});

	it("formata CNPJ", () => {
		expect(formatarCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
		expect(formatarCpfCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
	});

	it("retorna o valor original caso tamanho não seja 11 nem 14", () => {
		expect(formatarCpfCnpj("123")).toBe("123");
	});
});
