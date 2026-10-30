import { describe, expect, it } from "vitest";
import { DataSchema, dataLocal, formatarDataBr } from "./datas";

describe("formatarDataBr", () => {
	it("converte AAAA-MM-DD em DD/MM/AAAA sem passar por fuso", () => {
		expect(formatarDataBr("2026-01-05")).toBe("05/01/2026");
		expect(formatarDataBr("2026-12-31")).toBe("31/12/2026");
	});

	it("rejeita texto fora do formato de data", () => {
		expect(() => formatarDataBr("05/01/2026")).toThrow();
		expect(() => formatarDataBr("")).toThrow();
	});
});

describe("dataLocal", () => {
	it("usa o dia do fuso local, mesmo perto da meia-noite", () => {
		expect(dataLocal(new Date(2026, 9, 28, 23, 59))).toBe("2026-10-28");
		expect(dataLocal(new Date(2026, 9, 29, 0, 0))).toBe("2026-10-29");
	});

	it("preenche mês e dia com zero à esquerda", () => {
		expect(dataLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
	});

	it("gera um valor aceito pelo DataSchema", () => {
		expect(DataSchema.parse(dataLocal(new Date()))).toMatch(
			/^\d{4}-\d{2}-\d{2}$/,
		);
	});
});
