import type { TabelaPrecoInput } from "../../produtos/domain/tabela-preco.schema";
import type {
	Representada,
	RepresentadaInput,
} from "../domain/representada.schema";

export interface RepresentadaRepository {
	/** Lista representadas ativas do tenant, ordenadas por nome fantasia. */
	listar(tenantId: string, termoBusca?: string): Promise<Representada[]>;
	/** Lista ativas e inativas do tenant (sem excluídas), com inativas ao final. */
	listarTodas(tenantId: string, termoBusca?: string): Promise<Representada[]>;
	/** Retorna a representada do tenant ou `undefined` (inativas só com permitirInativo=true). */
	obterPorId(
		tenantId: string,
		id: string,
		permitirInativo?: boolean,
	): Promise<Representada | undefined>;
	/**
	 * Cria a representada e suas tabelas de preço em transação única.
	 * Se `tabelasInput` for omitido ou vazio, cria automaticamente uma "Tabela Padrão" vigente.
	 */
	criar(
		tenantId: string,
		input: RepresentadaInput,
		tabelasInput?: readonly TabelaPrecoInput[],
	): Promise<Representada>;
	/**
	 * Atualiza a representada e, se `tabelasInput` for informado, reconcilia
	 * suas tabelas de preço na mesma transação.
	 */
	atualizar(
		tenantId: string,
		id: string,
		input: RepresentadaInput,
		tabelasInput?: readonly TabelaPrecoInput[],
	): Promise<Representada>;
	/** Inativação de negócio (marca `ativo = false`). */
	inativar(tenantId: string, id: string): Promise<void>;
	/** Reativa uma representada previamente inativada. */
	reativar(tenantId: string, id: string): Promise<void>;
}
