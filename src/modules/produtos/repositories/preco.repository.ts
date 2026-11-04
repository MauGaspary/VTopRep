import type { ItemPreco } from "../domain/item-preco.schema";
import type { ResolucaoPreco, ResolucaoPrecosTabela } from "../domain/preco";
import type { ReajusteTabelaInput } from "../domain/reajuste-tabela";
import type { TabelaPreco } from "../domain/tabela-preco.schema";

export interface ResultadoReajuste {
	tabela: TabelaPreco;
	itens: number;
	/** Origem com o novo fim de vigência; `null` se ela já terminava antes. */
	origemEncerrada: TabelaPreco | null;
}

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
	/** Tabela vigente de início mais recente da representada (sugestão do pedido). */
	obterTabelaSugerida(
		tenantId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco | null>;
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
	/** Tabelas disponíveis (ativas e não excluídas) agrupadas por `representada_id`. */
	listarTabelasDisponiveisPorRepresentada(
		tenantId: string,
	): Promise<Map<string, TabelaPreco[]>>;
	/** Itens de preço vivos da tabela, um por produto (por `produto_id`). */
	listarItensDaTabela(
		tenantId: string,
		tabelaId: string,
	): Promise<Map<string, ItemPreco>>;
	/**
	 * Cria uma tabela com os preços da origem reajustados e encerra a origem na
	 * véspera do início da nova, numa transação com a Outbox.
	 */
	reajustarTabela(
		tenantId: string,
		input: ReajusteTabelaInput,
	): Promise<ResultadoReajuste>;
}
