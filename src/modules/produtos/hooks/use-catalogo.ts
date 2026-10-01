import { useLiveQuery } from "dexie-react-hooks";
import { produtoRepository } from "../repositories/produto-dexie.adapter";

export function useCatalogo(tenantId: string, termoBusca?: string) {
	const produtos = useLiveQuery(
		() => {
			if (!tenantId) return Promise.resolve([]);
			return produtoRepository.buscarCatalogo(tenantId, termoBusca);
		},
		[tenantId, termoBusca],
		[], // Default value
	);

	return {
		produtos: produtos,
		isLoading: produtos === undefined,
	};
}
