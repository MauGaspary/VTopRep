import type {
	Transportadora,
	TransportadoraInput,
} from "../domain/transportadora.schema";

export interface TransportadoraRepository {
	/** Lista transportadoras ativas do tenant, ordenadas por nome fantasia. */
	listar(tenantId: string, termoBusca?: string): Promise<Transportadora[]>;
	/** Lista ativas e inativas do tenant (sem excluídas), com inativas ao final. */
	listarTodas(tenantId: string, termoBusca?: string): Promise<Transportadora[]>;
	/** Retorna a transportadora do tenant ou `undefined` (inativas só com permitirInativo=true). */
	obterPorId(
		tenantId: string,
		id: string,
		permitirInativo?: boolean,
	): Promise<Transportadora | undefined>;
	criar(tenantId: string, input: TransportadoraInput): Promise<Transportadora>;
	atualizar(
		tenantId: string,
		id: string,
		input: TransportadoraInput,
	): Promise<Transportadora>;
	/** Inativação de negócio (marca `ativo = false`). */
	inativar(tenantId: string, id: string): Promise<void>;
	/** Reativa uma transportadora previamente inativada. */
	reativar(tenantId: string, id: string): Promise<void>;
}
