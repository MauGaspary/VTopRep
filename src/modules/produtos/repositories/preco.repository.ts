import type { ClienteTabelaPreco } from "../domain/cliente-tabela-preco.schema";
import type { ResolucaoPreco, ResolucaoPrecosTabela } from "../domain/preco";
import type { TabelaPreco } from "../domain/tabela-preco.schema";

/** `data` é sempre uma data de calendário `AAAA-MM-DD` (ver `dataLocal`). */
export interface PrecoRepository {
	/** Tabelas ativas e vigentes da representada, da vigência mais recente para a mais antiga. */
	listarTabelasVigentes(
		tenantId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco[]>;
	/** Tabela padrão do cliente se vigente; senão, a vigente mais recente. */
	obterTabelaSugerida(
		tenantId: string,
		clienteId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco | null>;
	obterTabelaPadraoCliente(
		tenantId: string,
		clienteId: string,
		representadaId: string,
	): Promise<ClienteTabelaPreco | null>;
	resolverPreco(
		tenantId: string,
		tabelaId: string,
		produtoId: string,
		data: string,
	): Promise<ResolucaoPreco>;
	/** Todos os preços da tabela, por `produto_id`. */
	resolverPrecosDaTabela(
		tenantId: string,
		tabelaId: string,
		data: string,
	): Promise<ResolucaoPrecosTabela>;
	/** Define (ou troca) a tabela padrão do cliente para a representada da tabela. */
	definirTabelaPadraoCliente(
		tenantId: string,
		clienteId: string,
		tabelaId: string,
	): Promise<ClienteTabelaPreco>;
	/** Remove a tabela padrão (tombstone). `null` se não havia padrão. */
	removerTabelaPadraoCliente(
		tenantId: string,
		clienteId: string,
		representadaId: string,
	): Promise<ClienteTabelaPreco | null>;
}
