import { describe, expect, it } from "vitest";
import {
	ajustarCorPrimariaParaTema,
	CONTRASTE_MINIMO_AA,
	corHslParaHex,
	formatarCorHsl,
	lerCorHsl,
	lerPreferenciaTema,
	razaoContraste,
	resolverTema,
} from "./tema";

describe("lerPreferenciaTema", () => {
	it("aceita as três preferências válidas", () => {
		expect(lerPreferenciaTema("claro")).toBe("claro");
		expect(lerPreferenciaTema("escuro")).toBe("escuro");
		expect(lerPreferenciaTema("sistema")).toBe("sistema");
	});

	it("valor ausente ou inválido volta para claro", () => {
		expect(lerPreferenciaTema(null)).toBe("claro");
		expect(lerPreferenciaTema(undefined)).toBe("claro");
		expect(lerPreferenciaTema("dark")).toBe("claro");
		expect(lerPreferenciaTema(1)).toBe("claro");
	});
});

describe("resolverTema", () => {
	it("claro e escuro ignoram o sistema", () => {
		expect(resolverTema("claro", true)).toBe("claro");
		expect(resolverTema("escuro", false)).toBe("escuro");
	});

	it("sistema segue o prefers-color-scheme", () => {
		expect(resolverTema("sistema", true)).toBe("escuro");
		expect(resolverTema("sistema", false)).toBe("claro");
	});
});

describe("lerCorHsl / formatarCorHsl", () => {
	it("aceita vírgulas, espaços e hsl()", () => {
		const esperado = { h: 228, s: 60, l: 34 };
		expect(lerCorHsl("228, 60%, 34%")).toEqual(esperado);
		expect(lerCorHsl("228 60% 34%")).toEqual(esperado);
		expect(lerCorHsl("hsl(228deg 60% 34%)")).toEqual(esperado);
		expect(lerCorHsl("-132, 60%, 34%")).toEqual(esperado);
	});

	it("rejeita formatos inválidos", () => {
		expect(lerCorHsl("#1e3a8a")).toBeNull();
		expect(lerCorHsl("228, 160%, 34%")).toBeNull();
		expect(lerCorHsl("")).toBeNull();
	});

	it("formata no padrão dos tokens", () => {
		expect(formatarCorHsl({ h: 228, s: 60, l: 34 })).toBe("228 60% 34%");
	});
});

describe("razaoContraste", () => {
	it("preto × branco = 21 e cor × ela mesma = 1", () => {
		const branco = { h: 0, s: 0, l: 100 };
		const preto = { h: 0, s: 0, l: 0 };
		expect(razaoContraste(branco, preto)).toBeCloseTo(21, 5);
		expect(razaoContraste(branco, branco)).toBeCloseTo(1, 5);
	});
});

describe("ajustarCorPrimariaParaTema", () => {
	const fundoClaro = { h: 0, s: 0, l: 100 };
	const fundoEscuro = { h: 210, s: 5, l: 8 };

	const contrasteCom = (valor: string, fundo: typeof fundoClaro) => {
		const cor = lerCorHsl(valor);
		if (!cor) throw new Error(`cor inválida: ${valor}`);
		return razaoContraste(cor, fundo);
	};

	it("mantém a cor que já tem contraste e usa texto branco", () => {
		expect(ajustarCorPrimariaParaTema("228, 60%, 34%", "claro")).toEqual({
			primaria: "228 60% 34%",
			textoSobrePrimaria: "0 0% 100%",
		});
	});

	it("no escuro clareia o azul-marinho do tenant até o contraste AA", () => {
		const cores = ajustarCorPrimariaParaTema("228, 60%, 34%", "escuro");
		expect(cores).not.toBeNull();
		if (!cores) return;
		const ajustada = lerCorHsl(cores.primaria);
		expect(ajustada?.h).toBe(228);
		expect(ajustada?.s).toBe(60);
		expect(ajustada?.l).toBeGreaterThan(34);
		expect(contrasteCom(cores.primaria, fundoEscuro)).toBeGreaterThanOrEqual(
			CONTRASTE_MINIMO_AA,
		);
		// o texto do botão é o de maior contraste com a primária clareada
		expect(
			contrasteCom(cores.textoSobrePrimaria, {
				h: 0,
				s: 0,
				l: 0,
			}),
		).toBeLessThan(2);
	});

	it("no claro escurece uma cor clara demais", () => {
		const cores = ajustarCorPrimariaParaTema("50 90% 70%", "claro");
		expect(cores).not.toBeNull();
		if (!cores) return;
		expect(contrasteCom(cores.primaria, fundoClaro)).toBeGreaterThanOrEqual(
			CONTRASTE_MINIMO_AA,
		);
	});

	it("cor inválida → null (fica o token padrão do CSS)", () => {
		expect(ajustarCorPrimariaParaTema("azul", "escuro")).toBeNull();
	});
});

describe("corHslParaHex", () => {
	it("converte HSL para #rrggbb", () => {
		expect(corHslParaHex({ h: 0, s: 0, l: 100 })).toBe("#ffffff");
		expect(corHslParaHex({ h: 0, s: 0, l: 0 })).toBe("#000000");
		expect(corHslParaHex({ h: 0, s: 100, l: 50 })).toBe("#ff0000");
		expect(corHslParaHex({ h: 228, s: 60, l: 34 })).toBe("#23378b");
	});
});
