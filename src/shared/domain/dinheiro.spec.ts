import { describe, expect, it } from "vitest";
import {
	aplicarPercentual,
	dividirHalfEven,
	multiplicarPorFracao,
	somarCentavos,
} from "./dinheiro";

describe("dividirHalfEven", () => {
	it("divide exatamente quando não há resto", () => {
		expect(dividirHalfEven(10n, 2n)).toBe(5n);
		expect(dividirHalfEven(0n, 7n)).toBe(0n);
	});

	it("arredonda empates exatos para o par", () => {
		expect(dividirHalfEven(5n, 2n)).toBe(2n); // 2,5 => 2
		expect(dividirHalfEven(7n, 2n)).toBe(4n); // 3,5 => 4
		expect(dividirHalfEven(1n, 2n)).toBe(0n); // 0,5 => 0
		expect(dividirHalfEven(3n, 2n)).toBe(2n); // 1,5 => 2
	});

	it("arredonda para o mais próximo fora dos empates", () => {
		expect(dividirHalfEven(10n, 3n)).toBe(3n); // 3,333...
		expect(dividirHalfEven(20n, 3n)).toBe(7n); // 6,666...
		expect(dividirHalfEven(251n, 100n)).toBe(3n); // 2,51
		expect(dividirHalfEven(249n, 100n)).toBe(2n); // 2,49
	});

	it("é simétrico para negativos (estornos)", () => {
		expect(dividirHalfEven(-5n, 2n)).toBe(-2n);
		expect(dividirHalfEven(-7n, 2n)).toBe(-4n);
		expect(dividirHalfEven(7n, -2n)).toBe(-4n);
		expect(dividirHalfEven(-20n, 3n)).toBe(-7n);
	});

	it("rejeita divisão por zero", () => {
		expect(() => dividirHalfEven(1n, 0n)).toThrow(RangeError);
	});
});

describe("multiplicarPorFracao", () => {
	it("trata dízimas periódicas (1/3 e 2/3 de R$ 100,00)", () => {
		expect(multiplicarPorFracao(10000, 1, 3)).toBe(3333);
		expect(multiplicarPorFracao(10000, 2, 3)).toBe(6667);
		expect(multiplicarPorFracao(100, 1, 3)).toBe(33);
		expect(multiplicarPorFracao(200, 1, 3)).toBe(67);
	});

	it("rejeita entradas não inteiras ou fora do limite seguro", () => {
		expect(() => multiplicarPorFracao(10.5, 1, 3)).toThrow(RangeError);
		expect(() => multiplicarPorFracao(100, 1.5, 3)).toThrow(RangeError);
		expect(() => multiplicarPorFracao(Number.MAX_SAFE_INTEGER, 2, 1)).toThrow(
			RangeError,
		);
	});
});

describe("aplicarPercentual", () => {
	it("calcula comissão em centavos (5,00% de R$ 1.000,00)", () => {
		expect(aplicarPercentual(100000, 500)).toBe(5000);
	});

	it("trata dízimas periódicas no percentual", () => {
		expect(aplicarPercentual(100, 3333)).toBe(33); // 33,33
		expect(aplicarPercentual(100, 6667)).toBe(67); // 66,67
		expect(aplicarPercentual(1000, 3333)).toBe(333); // 333,3
	});

	it("aplica half-even nos empates exatos", () => {
		expect(aplicarPercentual(5, 5000)).toBe(2); // 2,5 => 2
		expect(aplicarPercentual(15, 5000)).toBe(8); // 7,5 => 8
		expect(aplicarPercentual(1, 5000)).toBe(0); // 0,5 => 0
		expect(aplicarPercentual(250, 100)).toBe(2); // 2,5 => 2
		expect(aplicarPercentual(350, 100)).toBe(4); // 3,5 => 4
	});

	it("cobre zero e 100%", () => {
		expect(aplicarPercentual(0, 500)).toBe(0);
		expect(aplicarPercentual(12345, 0)).toBe(0);
		expect(aplicarPercentual(12345, 10000)).toBe(12345);
	});

	it("não perde precisão com valores grandes", () => {
		// O produto intermediário (MAX_SAFE_INTEGER * 10000) excede 2^53
		expect(aplicarPercentual(Number.MAX_SAFE_INTEGER, 10000)).toBe(
			Number.MAX_SAFE_INTEGER,
		);
		expect(aplicarPercentual(900719925474099, 5000)).toBe(450359962737050); // ...049,5 => par
	});
});

describe("somarCentavos", () => {
	it("soma valores inteiros", () => {
		expect(somarCentavos([])).toBe(0);
		expect(somarCentavos([1, 2, 3])).toBe(6);
		expect(somarCentavos([15050, -50])).toBe(15000);
	});

	it("rejeita estouro e valores não inteiros", () => {
		expect(() => somarCentavos([Number.MAX_SAFE_INTEGER, 1])).toThrow(
			RangeError,
		);
		expect(() => somarCentavos([0.1, 0.2])).toThrow(RangeError);
	});
});
