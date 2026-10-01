import { db } from "../../../db/database";
import type { Produto } from "../domain/produto.schema";
import type { ProdutoRepository } from "./produto.repository";

export class ProdutoDexieAdapter implements ProdutoRepository {
	async buscarCatalogo(
		tenantId: string,
		termoBusca?: string,
	): Promise<Produto[]> {
		if (!tenantId) {
			throw new Error("tenantId é obrigatório");
		}

		return db.produtos
			.where("tenant_id")
			.equals(tenantId)
			.filter((produto) => {
				const isAtivo = produto.ativo === true;
				const isNotDeleted = produto.deleted_at === null;

				if (!isAtivo || !isNotDeleted) return false;

				if (termoBusca) {
					const termoLower = termoBusca.toLowerCase();
					return (
						produto.sku.toLowerCase().includes(termoLower) ||
						produto.descricao.toLowerCase().includes(termoLower)
					);
				}

				return true;
			})
			.toArray();
	}
}

export const produtoRepository = new ProdutoDexieAdapter();
