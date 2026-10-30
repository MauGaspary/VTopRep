import type { ClienteTabelaPreco } from "../domain/cliente-tabela-preco.schema";
import type { ItemPreco } from "../domain/item-preco.schema";
import type { ResolucaoPreco, ResolucaoPrecosTabela } from "../domain/preco";
import type { TabelaPreco } from "../domain/tabela-preco.schema";

export interface PrecoCatalogo {
	tabela_id: string;
	nome_tabela: string;
	preco_base_centavos: number;
	desconto_maximo_permitido: number;
}

/** `data` é sempre uma data de calendário `AAAA-MM-DD` (ver `dataLocal`). */
export interface PrecoRepository {
	/** Todas as tabelas não excluídas da representada (ativas primeiro, depois vigência mais recente). */
	listarTabelasDaRepresentada(
		tenantId: string,
		representadaId: string,
	): Promise<TabelaPreco[]>;
	/** Tabelas ativas, não excluídas e não encerradas na data (para precificar produtos). */
	listarTabelasEmUso(
		tenantId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco[]>;
	/** Tabelas ativas e vigentes da representada, da vigência mais recente para a mais antiga. */
	listarTabelasVigentes(
		tenantId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco[]>;
	/** Itens de preço vivos do produto, indexados por `tabela_id`. */
	obterItensPrecoDoProduto(
		tenantId: string,
		produtoId: string,
	): Promise<Map<string, ItemPreco>>;
	/** Preço vigente de cada produto para exibição rápida no catálogo, indexado por `produto_id`. */
	resolverPrecosCatalogo(
		tenantId: string,
		data: string,
	): Promise<Map<string, PrecoCatalogo>>;
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
	/** Associações vivas de tabela padrão do cliente, indexadas por `representada_id`. */
	obterTabelasPadraoDoCliente(
		tenantId: string,
		clienteId: string,
	): Promise<Map<string, ClienteTabelaPreco>>;
	/** Tabelas disponíveis (ativas e não excluídas) agrupadas por `representada_id`. */
	listarTabelasDisponiveisPorRepresentada(
		tenantId: string,
	): Promise<Map<string, TabelaPreco[]>>;
	/** Sincroniza as escolhas de tabela padrão do cliente por representada (`""` remove o vínculo). */
	sincronizarTabelasPadraoCliente(
		tenantId: string,
		clienteId: string,
		escolhasPorRepresentada: Readonly<Record<string, string>>,
	): Promise<void>;
}
