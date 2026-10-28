import { normalizarTexto } from "./texto";

/** Campos mínimos para as regras de unicidade entre cadastros. */
export interface RegistroUnico {
	id: string;
	ativo: boolean;
	deleted_at: string | null;
}

export type ConflitoUnicidade<T> =
	| { tipo: "ativo"; registro: T }
	| { tipo: "inativo"; registro: T };

/**
 * Procura entre os candidatos outro registro com a mesma chave (bloqueante).
 * Ignora o próprio registro (`idAtual`) e registros excluídos (`deleted_at`).
 * Conflito com registro ativo tem precedência sobre conflito com inativo.
 */
export function detectarConflito<T extends RegistroUnico>(
	candidatos: readonly T[],
	mesmaChave: (registro: T) => boolean,
	idAtual?: string,
): ConflitoUnicidade<T> | null {
	let inativo: T | null = null;
	for (const registro of candidatos) {
		if (registro.id === idAtual || registro.deleted_at !== null) continue;
		if (!mesmaChave(registro)) continue;
		if (registro.ativo) return { tipo: "ativo", registro };
		inativo ??= registro;
	}
	return inativo ? { tipo: "inativo", registro: inativo } : null;
}

export interface Homonimo<T, C extends string> {
	registro: T;
	campos: C[];
}

interface DetectarHomonimosParams<T, C extends string> {
	candidatos: readonly T[];
	campos: readonly C[];
	nomes: Record<C, string | null | undefined>;
	nomesDe: (registro: T) => Record<C, string | null | undefined>;
	idAtual?: string;
}

/**
 * Lista registros com nomes iguais aos informados (case/acento-insensível),
 * campo a campo. Não bloqueia: serve para avisar o usuário, já que nomes
 * repetidos são legítimos (filiais, redes com o mesmo nome fantasia).
 */
export function detectarHomonimos<T extends RegistroUnico, C extends string>({
	candidatos,
	campos,
	nomes,
	nomesDe,
	idAtual,
}: DetectarHomonimosParams<T, C>): Homonimo<T, C>[] {
	const normalizar = (valor: string | null | undefined) =>
		valor ? normalizarTexto(valor) : "";

	const resultado: Homonimo<T, C>[] = [];
	for (const registro of candidatos) {
		if (registro.id === idAtual || registro.deleted_at !== null) continue;
		const nomesRegistro = nomesDe(registro);
		const camposIguais = campos.filter((campo) => {
			const informado = normalizar(nomes[campo]);
			return informado !== "" && informado === normalizar(nomesRegistro[campo]);
		});
		if (camposIguais.length > 0) {
			resultado.push({ registro, campos: camposIguais });
		}
	}
	return resultado;
}
