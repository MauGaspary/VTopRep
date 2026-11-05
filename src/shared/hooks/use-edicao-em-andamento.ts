import { useEffect, useSyncExternalStore } from "react";

/**
 * Registro, só em memória, das telas com alterações ainda não gravadas (ex.:
 * orçamento em edição). O aviso de nova versão consulta este registro para não
 * recarregar o app e perder o que o representante está digitando.
 */
const edicoes = new Set<symbol>();
const ouvintes = new Set<() => void>();

function notificar(): void {
	for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void): () => void {
	ouvintes.add(ouvinte);
	return () => {
		ouvintes.delete(ouvinte);
	};
}

function haEdicao(): boolean {
	return edicoes.size > 0;
}

/** Marca a tela atual como "com alterações não salvas" enquanto `ativa` for verdadeiro. */
export function useRegistrarEdicaoEmAndamento(ativa: boolean): void {
	useEffect(() => {
		if (!ativa) return;
		const chave = Symbol("edicao");
		edicoes.add(chave);
		notificar();
		return () => {
			edicoes.delete(chave);
			notificar();
		};
	}, [ativa]);
}

/** Indica se alguma tela tem alterações não salvas. */
export function useHaEdicaoEmAndamento(): boolean {
	return useSyncExternalStore(assinar, haEdicao, () => false);
}
