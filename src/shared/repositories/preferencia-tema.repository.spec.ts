import { describe, expect, it } from "vitest";
import { CHAVE_PREFERENCIA_TEMA } from "../domain/tema";
import { criarPreferenciaTemaLocalStorage } from "./preferencia-tema.repository";

function armazenamentoEmMemoria(inicial: Record<string, string> = {}) {
	const dados = new Map(Object.entries(inicial));
	return {
		dados,
		getItem: (chave: string) => dados.get(chave) ?? null,
		setItem: (chave: string, valor: string) => {
			dados.set(chave, valor);
		},
	};
}

describe("criarPreferenciaTemaLocalStorage", () => {
	it("sem valor salvo, a preferência é claro", () => {
		const repo = criarPreferenciaTemaLocalStorage(armazenamentoEmMemoria());
		expect(repo.obter()).toBe("claro");
	});

	it("grava e lê a preferência na chave do tema", () => {
		const armazenamento = armazenamentoEmMemoria();
		const repo = criarPreferenciaTemaLocalStorage(armazenamento);
		repo.salvar("escuro");
		expect(armazenamento.dados.get(CHAVE_PREFERENCIA_TEMA)).toBe("escuro");
		expect(repo.obter()).toBe("escuro");
	});

	it("valor corrompido volta para claro", () => {
		const repo = criarPreferenciaTemaLocalStorage(
			armazenamentoEmMemoria({ [CHAVE_PREFERENCIA_TEMA]: "roxo" }),
		);
		expect(repo.obter()).toBe("claro");
	});

	it("armazenamento indisponível ou com erro não lança", () => {
		const quebrado = {
			getItem: () => {
				throw new Error("SecurityError");
			},
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		};
		const repo = criarPreferenciaTemaLocalStorage(quebrado);
		expect(repo.obter()).toBe("claro");
		expect(() => repo.salvar("escuro")).not.toThrow();
		expect(criarPreferenciaTemaLocalStorage(null).obter()).toBe("claro");
	});
});
