import { describe, expect, it } from "vitest";
import { normalizarTexto } from "./texto";

describe("normalizarTexto", () => {
	it("remove acentos, espaços nas pontas e converte para minúsculas", () => {
		expect(normalizarTexto("  Açúcar Cristal Orgânico  ")).toBe(
			"acucar cristal organico",
		);
		expect(normalizarTexto("FÁBRICA")).toBe("fabrica");
	});

	it("preserva espaços internos e caracteres não acentuados", () => {
		expect(normalizarTexto("Parafuso 1/2 Inox")).toBe("parafuso 1/2 inox");
	});

	it("retorna string vazia para texto vazio ou só com espaços", () => {
		expect(normalizarTexto("")).toBe("");
		expect(normalizarTexto("   ")).toBe("");
	});
});
