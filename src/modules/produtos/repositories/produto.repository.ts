import type { PrecoProdutoInput } from "../domain/item-preco.schema";
import type { Produto, ProdutoInput } from "../domain/produto.schema";

export interface ProdutoRepository {
	/** Lista produtos ativos do tenant. */
	listar(
		tenantId: string,
		termoBusca?: string,
		representadaId?: string,
	): Promise<Produto[]>;
	/** Lista ativos e inativos do tenant (sem excluídos), com inativos ao final. */
	listarTodos(
		tenantId: string,
		termoBusca?: string,
		representadaId?: string,
	): Promise<Produto[]>;
	buscarCatalogo(tenantId: string, termoBusca?: string): Promise<Produto[]>;
	obterPorId(
		tenantId: string,
		id: string,
		permitirInativo?: boolean,
	): Promise<Produto | null>;
	/** SKU é único por representada, não por tenant. */
	obterPorSku(
		tenantId: string,
		representadaId: string,
		sku: string,
	): Promise<Produto | null>;
	criar(
		tenantId: string,
		input: ProdutoInput,
		precosInput?: readonly PrecoProdutoInput[],
	): Promise<Produto>;
	atualizar(
		tenantId: string,
		id: string,
		input: ProdutoInput,
		precosInput?: readonly PrecoProdutoInput[],
	): Promise<Produto>;
	inativar(tenantId: string, id: string): Promise<Produto>;
	reativar(tenantId: string, id: string): Promise<Produto>;
}
