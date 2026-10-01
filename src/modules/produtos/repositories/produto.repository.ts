import type { Produto } from "../domain/produto.schema";

export interface ProdutoRepository {
	buscarCatalogo(tenantId: string, termoBusca?: string): Promise<Produto[]>;
}
