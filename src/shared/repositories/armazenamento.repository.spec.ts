import { describe, expect, it, vi } from "vitest";
import { ESTADO_ARMAZENAMENTO_DESCONHECIDO } from "../domain/armazenamento";
import { criarArmazenamentoNavegador } from "./armazenamento.repository";

function gerenciadorFalso(
	opcoes: {
		persistido?: boolean;
		concede?: boolean;
		falhaEstimativa?: boolean;
	} = {},
) {
	let persistido = opcoes.persistido ?? false;
	return {
		persisted: vi.fn(async () => persistido),
		persist: vi.fn(async () => {
			persistido = opcoes.concede ?? false;
			return persistido;
		}),
		estimate: vi.fn(async () => {
			if (opcoes.falhaEstimativa) throw new Error("indisponível");
			return { usage: 2048, quota: 1024 * 1024 };
		}),
	};
}

describe("criarArmazenamentoNavegador", () => {
	it("sem Storage API devolve estado desconhecido e não persiste", async () => {
		const repo = criarArmazenamentoNavegador(null);
		expect(await repo.obterEstado()).toEqual(ESTADO_ARMAZENAMENTO_DESCONHECIDO);
		expect(await repo.solicitarPersistencia()).toBe(false);
	});

	it("informa persistência e uso do armazenamento", async () => {
		const repo = criarArmazenamentoNavegador(
			gerenciadorFalso({ persistido: true }),
		);
		expect(await repo.obterEstado()).toEqual({
			suportado: true,
			persistente: true,
			usadoBytes: 2048,
			cotaBytes: 1024 * 1024,
		});
	});

	it("falha na estimativa não derruba o estado", async () => {
		const repo = criarArmazenamentoNavegador(
			gerenciadorFalso({ falhaEstimativa: true }),
		);
		expect(await repo.obterEstado()).toMatchObject({
			suportado: true,
			usadoBytes: null,
			cotaBytes: null,
		});
	});

	it("só pede persistência se ainda não estiver persistente", async () => {
		const jaPersistido = gerenciadorFalso({ persistido: true });
		expect(
			await criarArmazenamentoNavegador(jaPersistido).solicitarPersistencia(),
		).toBe(true);
		expect(jaPersistido.persist).not.toHaveBeenCalled();

		const concede = gerenciadorFalso({ concede: true });
		expect(
			await criarArmazenamentoNavegador(concede).solicitarPersistencia(),
		).toBe(true);
		expect(concede.persist).toHaveBeenCalledOnce();

		const recusa = gerenciadorFalso({ concede: false });
		expect(
			await criarArmazenamentoNavegador(recusa).solicitarPersistencia(),
		).toBe(false);
	});
});
