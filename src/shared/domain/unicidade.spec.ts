import { describe, expect, it } from "vitest";
import { detectarConflito, detectarHomonimos } from "./unicidade";

interface Registro {
	id: string;
	ativo: boolean;
	deleted_at: string | null;
	doc: string;
	razao: string;
	fantasia: string | null;
}

const registro = (overrides: Partial<Registro> = {}): Registro => ({
	id: "1",
	ativo: true,
	deleted_at: null,
	doc: "111",
	razao: "Comercial Alfa Ltda",
	fantasia: "Alfa",
	...overrides,
});

const mesmoDoc = (doc: string) => (r: Registro) => r.doc === doc;

describe("detectarConflito", () => {
	it("retorna null quando não há registro com a mesma chave", () => {
		expect(detectarConflito([registro()], mesmoDoc("999"))).toBeNull();
		expect(detectarConflito([], mesmoDoc("111"))).toBeNull();
	});

	it("detecta conflito com registro ativo", () => {
		const ativo = registro();
		expect(detectarConflito([ativo], mesmoDoc("111"))).toEqual({
			tipo: "ativo",
			registro: ativo,
		});
	});

	it("detecta conflito com inativo para oferecer reativação", () => {
		const inativo = registro({ ativo: false });
		expect(detectarConflito([inativo], mesmoDoc("111"))).toEqual({
			tipo: "inativo",
			registro: inativo,
		});
	});

	it("prioriza o ativo quando existem ativo e inativo com a mesma chave", () => {
		const inativo = registro({ id: "1", ativo: false });
		const ativo = registro({ id: "2" });
		expect(detectarConflito([inativo, ativo], mesmoDoc("111"))?.tipo).toBe(
			"ativo",
		);
	});

	it("ignora o próprio registro e registros excluídos", () => {
		const proprio = registro({ id: "1" });
		const excluido = registro({ id: "2", deleted_at: "2026-01-01T00:00:00Z" });
		expect(
			detectarConflito([proprio, excluido], mesmoDoc("111"), "1"),
		).toBeNull();
	});
});

describe("detectarHomonimos", () => {
	const detectar = (
		candidatos: Registro[],
		razao: string,
		fantasia: string | null,
		idAtual?: string,
	) =>
		detectarHomonimos({
			candidatos,
			campos: ["razao", "fantasia"] as const,
			nomes: { razao, fantasia },
			nomesDe: (r) => ({ razao: r.razao, fantasia: r.fantasia }),
			idAtual,
		});

	it("lista registros com nomes iguais ignorando caixa e acentos", () => {
		const existente = registro({ razao: "Comércio Alfa Ltda" });
		expect(detectar([existente], "COMERCIO ALFA LTDA", "Outro")).toEqual([
			{ registro: existente, campos: ["razao"] },
		]);
	});

	it("informa todos os campos coincidentes", () => {
		const existente = registro();
		expect(detectar([existente], "comercial alfa ltda", "ALFA")).toEqual([
			{ registro: existente, campos: ["razao", "fantasia"] },
		]);
	});

	it("não compara nomes vazios ou nulos", () => {
		const semFantasia = registro({ fantasia: null });
		expect(detectar([semFantasia], "Outra Razão", null)).toEqual([]);
		expect(detectar([semFantasia], "Outra Razão", "  ")).toEqual([]);
	});

	it("ignora o próprio registro e excluídos, mas inclui inativos", () => {
		const proprio = registro({ id: "1" });
		const excluido = registro({ id: "2", deleted_at: "2026-01-01T00:00:00Z" });
		const inativo = registro({ id: "3", ativo: false });
		expect(
			detectar([proprio, excluido, inativo], "Comercial Alfa Ltda", null, "1"),
		).toEqual([{ registro: inativo, campos: ["razao"] }]);
	});
});
