import {
	ESTADO_ARMAZENAMENTO_DESCONHECIDO,
	type EstadoArmazenamento,
} from "../domain/armazenamento";

/**
 * Armazenamento persistente do navegador (TODO 2.10.2). Sem persistência, o
 * navegador pode apagar o IndexedDB quando o aparelho fica sem espaço.
 */
export interface ArmazenamentoRepository {
	obterEstado(): Promise<EstadoArmazenamento>;
	/** Pede ao navegador para não apagar os dados; devolve se ficou persistente. */
	solicitarPersistencia(): Promise<boolean>;
}

type GerenciadorArmazenamento = Pick<
	StorageManager,
	"estimate" | "persist" | "persisted"
>;

/** Falhas da Storage API (navegador antigo, modo privado) viram "desconhecido". */
export function criarArmazenamentoNavegador(
	gerenciador: GerenciadorArmazenamento | null,
): ArmazenamentoRepository {
	return {
		async obterEstado() {
			if (!gerenciador) return ESTADO_ARMAZENAMENTO_DESCONHECIDO;
			const [persistente, estimativa] = await Promise.all([
				gerenciador.persisted().catch(() => false),
				gerenciador.estimate().catch(() => null),
			]);
			return {
				suportado: true,
				persistente,
				usadoBytes: estimativa?.usage ?? null,
				cotaBytes: estimativa?.quota ?? null,
			};
		},
		async solicitarPersistencia() {
			if (!gerenciador) return false;
			try {
				if (await gerenciador.persisted()) return true;
				return await gerenciador.persist();
			} catch {
				return false;
			}
		},
	};
}

function gerenciadorDisponivel(): GerenciadorArmazenamento | null {
	if (typeof navigator === "undefined") return null;
	const gerenciador = navigator.storage;
	return gerenciador &&
		typeof gerenciador.persist === "function" &&
		typeof gerenciador.persisted === "function" &&
		typeof gerenciador.estimate === "function"
		? gerenciador
		: null;
}

export const armazenamentoRepository: ArmazenamentoRepository =
	criarArmazenamentoNavegador(gerenciadorDisponivel());
