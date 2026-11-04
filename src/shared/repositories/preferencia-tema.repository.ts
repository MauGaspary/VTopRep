import {
	CHAVE_PREFERENCIA_TEMA,
	lerPreferenciaTema,
	type PreferenciaTema,
} from "../domain/tema";

/**
 * Preferência de tema do aparelho. Não sincroniza: não é dado de negócio e
 * cada aparelho pode ter a sua.
 */
export interface PreferenciaTemaRepository {
	obter(): PreferenciaTema;
	salvar(preferencia: PreferenciaTema): void;
}

type ArmazenamentoChaveValor = Pick<Storage, "getItem" | "setItem">;

/**
 * Implementação sobre `localStorage`. Falhas de acesso (modo privado, cota,
 * armazenamento bloqueado) não derrubam a tela: a leitura cai no padrão e a
 * gravação vale só para a sessão atual.
 */
export function criarPreferenciaTemaLocalStorage(
	armazenamento: ArmazenamentoChaveValor | null,
): PreferenciaTemaRepository {
	return {
		obter() {
			try {
				return lerPreferenciaTema(
					armazenamento?.getItem(CHAVE_PREFERENCIA_TEMA),
				);
			} catch {
				return lerPreferenciaTema(null);
			}
		},
		salvar(preferencia) {
			try {
				armazenamento?.setItem(CHAVE_PREFERENCIA_TEMA, preferencia);
			} catch {
				// sem armazenamento disponível: a escolha vale até recarregar
			}
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

export const preferenciaTemaRepository: PreferenciaTemaRepository =
	criarPreferenciaTemaLocalStorage(localStorageDisponivel());
