import { useState } from "react";

/** Linhas renderizadas por vez em listas que podem ter milhares de itens. */
export const PASSO_LISTA_INCREMENTAL = 100;

/**
 * Renderiza a lista aos poucos (primeiros `passo` itens e "Mostrar mais"),
 * para que catálogos com milhares de SKUs abram e filtrem sem travar.
 * Volta ao início quando `chave` muda (outra busca ou representada).
 */
export function useListaIncremental<T>(
	itens: readonly T[],
	chave: string,
	passo = PASSO_LISTA_INCREMENTAL,
) {
	const [estado, setEstado] = useState({ chave, limite: passo });
	const limite = estado.chave === chave ? estado.limite : passo;
	if (estado.chave !== chave) setEstado({ chave, limite: passo });

	return {
		visiveis: itens.length > limite ? itens.slice(0, limite) : itens,
		restantes: Math.max(0, itens.length - limite),
		mostrarMais: () => setEstado({ chave, limite: limite + passo }),
		mostrarTodos: () => setEstado({ chave, limite: itens.length }),
	};
}
