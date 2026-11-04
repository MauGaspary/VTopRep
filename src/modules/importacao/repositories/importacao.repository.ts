import type {
	ColunasMapeamentoSalvo,
	LinhaImportacao,
	MapeamentoImportacaoSalvo,
	OpcoesImportacao,
	ResumoImportacao,
} from "../domain/importacao.schema";

export interface ImportarProdutosParams {
	opcoes: OpcoesImportacao;
	linhas: readonly LinhaImportacao[];
	/** Todos os SKUs do arquivo, inclusive de linhas com erro (protege de inativação). */
	skusNoArquivo: ReadonlySet<string>;
}

export interface ImportacaoRepository {
	/** Mapeamento de colunas salvo neste aparelho para a representada. */
	obterMapeamento(
		tenantId: string,
		representadaId: string,
	): Promise<MapeamentoImportacaoSalvo | null>;
	salvarMapeamento(
		tenantId: string,
		representadaId: string,
		colunas: ColunasMapeamentoSalvo,
	): Promise<void>;
	/**
	 * Recalcula o plano com os dados atuais do banco e grava tudo (produtos,
	 * tabela, itens de preço e Outbox) numa única transação.
	 */
	importar(
		tenantId: string,
		params: ImportarProdutosParams,
	): Promise<ResumoImportacao>;
}
