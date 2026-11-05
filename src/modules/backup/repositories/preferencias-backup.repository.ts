import { z } from "zod";
import {
	lerPreferenciasBackup,
	type PreferenciasBackup,
	PreferenciasBackupSchema,
} from "../domain/lembrete-backup";

/**
 * Data do último backup e adiamento do lembrete, por tenant e por aparelho.
 * Não sincroniza (como a preferência de tema): cada aparelho tem a sua cópia
 * local e o seu próprio backup.
 */
export interface PreferenciasBackupRepository {
	obter(tenantId: string): PreferenciasBackup;
	salvar(tenantId: string, preferencias: PreferenciasBackup): void;
	/** Avisa quando as preferências mudam (nesta aba ou em outra). */
	assinar(ouvinte: () => void): () => void;
}

type ArmazenamentoChaveValor = Pick<Storage, "getItem" | "setItem">;

const TenantIdSchema = z.string().uuid("tenantId inválido");

export function chavePreferenciasBackup(tenantId: string): string {
	return `vtop:backup:${TenantIdSchema.parse(tenantId)}`;
}

export function criarPreferenciasBackupLocalStorage(
	armazenamento: ArmazenamentoChaveValor | null,
	alvoEventos: Pick<
		EventTarget,
		"addEventListener" | "removeEventListener"
	> | null = null,
): PreferenciasBackupRepository {
	const ouvintes = new Set<() => void>();
	// Cache por tenant: `useSyncExternalStore` exige o mesmo objeto enquanto
	// nada mudar.
	const cache = new Map<string, PreferenciasBackup>();

	const notificar = () => {
		for (const ouvinte of ouvintes) ouvinte();
	};
	// Outra aba gravou: descarta o cache e relê.
	const aoMudarEmOutraAba = () => {
		cache.clear();
		notificar();
	};

	return {
		obter(tenantId) {
			const chave = chavePreferenciasBackup(tenantId);
			const emCache = cache.get(chave);
			if (emCache) return emCache;
			let valor: string | null = null;
			try {
				valor = armazenamento?.getItem(chave) ?? null;
			} catch {
				valor = null;
			}
			const preferencias = lerPreferenciasBackup(valor);
			cache.set(chave, preferencias);
			return preferencias;
		},
		salvar(tenantId, preferencias) {
			const chave = chavePreferenciasBackup(tenantId);
			const validas = PreferenciasBackupSchema.parse(preferencias);
			try {
				armazenamento?.setItem(chave, JSON.stringify(validas));
			} catch {
				// sem armazenamento disponível: vale até recarregar a página
			}
			cache.set(chave, validas);
			notificar();
		},
		assinar(ouvinte) {
			ouvintes.add(ouvinte);
			if (ouvintes.size === 1)
				alvoEventos?.addEventListener("storage", aoMudarEmOutraAba);
			return () => {
				ouvintes.delete(ouvinte);
				if (ouvintes.size === 0) {
					alvoEventos?.removeEventListener("storage", aoMudarEmOutraAba);
				}
			};
		},
	};
}

function localStorageDisponivel(): ArmazenamentoChaveValor | null {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}

export const preferenciasBackupRepository: PreferenciasBackupRepository =
	criarPreferenciasBackupLocalStorage(
		localStorageDisponivel(),
		typeof window === "undefined" ? null : window,
	);
