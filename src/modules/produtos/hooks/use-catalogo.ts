import { useProdutos } from "./use-produtos";

export function useCatalogo(tenantId: string, termoBusca?: string) {
	return useProdutos(tenantId, termoBusca);
}
