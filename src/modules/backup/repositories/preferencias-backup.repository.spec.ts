import { describe, expect, it, vi } from "vitest";
import { PREFERENCIAS_BACKUP_PADRAO } from "../domain/lembrete-backup";
import {
	chavePreferenciasBackup,
	criarPreferenciasBackupLocalStorage,
} from "./preferencias-backup.repository";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const PREFS = {
	ultimo_backup_em: "2026-11-04T15:30:00.000Z",
	lembrete_adiado_ate: null,
};

function armazenamentoEmMemoria() {
	const dados = new Map<string, string>();
	return {
		dados,
		getItem: (chave: string) => dados.get(chave) ?? null,
		setItem: (chave: string, valor: string) => {
			dados.set(chave, valor);
		},
	};
}

describe("criarPreferenciasBackupLocalStorage", () => {
	it("guarda por tenant e devolve o padrão para quem não tem", () => {
		const armazenamento = armazenamentoEmMemoria();
		const repo = criarPreferenciasBackupLocalStorage(armazenamento);

		repo.salvar(TENANT, PREFS);

		expect(repo.obter(TENANT)).toEqual(PREFS);
		expect(repo.obter(OUTRO_TENANT)).toEqual(PREFERENCIAS_BACKUP_PADRAO);
		expect(
			JSON.parse(
				armazenamento.dados.get(chavePreferenciasBackup(TENANT)) ?? "",
			),
		).toEqual(PREFS);
	});

	it("devolve o mesmo objeto enquanto nada muda (useSyncExternalStore)", () => {
		const repo = criarPreferenciasBackupLocalStorage(armazenamentoEmMemoria());
		expect(repo.obter(TENANT)).toBe(repo.obter(TENANT));
	});

	it("avisa os ouvintes ao salvar e para de avisar ao cancelar", () => {
		const repo = criarPreferenciasBackupLocalStorage(armazenamentoEmMemoria());
		const ouvinte = vi.fn();
		const cancelar = repo.assinar(ouvinte);

		repo.salvar(TENANT, PREFS);
		expect(ouvinte).toHaveBeenCalledOnce();

		cancelar();
		repo.salvar(TENANT, PREFERENCIAS_BACKUP_PADRAO);
		expect(ouvinte).toHaveBeenCalledOnce();
	});

	it("relê o valor quando outra aba grava", () => {
		const armazenamento = armazenamentoEmMemoria();
		const alvo = new EventTarget();
		const repo = criarPreferenciasBackupLocalStorage(armazenamento, alvo);
		const ouvinte = vi.fn();
		repo.assinar(ouvinte);
		expect(repo.obter(TENANT)).toEqual(PREFERENCIAS_BACKUP_PADRAO);

		armazenamento.setItem(
			chavePreferenciasBackup(TENANT),
			JSON.stringify(PREFS),
		);
		alvo.dispatchEvent(new Event("storage"));

		expect(ouvinte).toHaveBeenCalledOnce();
		expect(repo.obter(TENANT)).toEqual(PREFS);
	});

	it("falhas do armazenamento e tenant inválido", () => {
		const quebrado = {
			getItem: () => {
				throw new Error("bloqueado");
			},
			setItem: () => {
				throw new Error("cota");
			},
		};
		const repo = criarPreferenciasBackupLocalStorage(quebrado);
		expect(repo.obter(TENANT)).toEqual(PREFERENCIAS_BACKUP_PADRAO);
		expect(() => repo.salvar(TENANT, PREFS)).not.toThrow();
		// Sem armazenamento, vale até recarregar.
		expect(repo.obter(TENANT)).toEqual(PREFS);
		expect(() => repo.obter("abc")).toThrow();
	});
});
