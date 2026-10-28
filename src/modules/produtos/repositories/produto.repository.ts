import type { Produto, ProdutoInput } from "../domain/produto.schema";

export interface ProdutoRepository {
	listar(
		tenantId: string,
		termoBusca?: string,
		representadaId?: string,
	): Promise<Produto[]>;
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
	obterPorSku(tenantId: string, sku: string): Promise<Produto | null>;
	criar(tenantId: string, input: ProdutoInput): Promise<Produto>;
	atualizar(
		tenantId: string,
		id: string,
		input: ProdutoInput,
	): Promise<Produto>;
	inativar(tenantId: string, id: string): Promise<Produto>;
	reativar(tenantId: string, id: string): Promise<Produto>;
}
