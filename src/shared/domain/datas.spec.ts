import { describe, expect, it } from "vitest";
import { DataSchema, dataLocal } from "./datas";

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
