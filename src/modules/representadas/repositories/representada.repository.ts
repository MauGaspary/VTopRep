import type {
	Representada,
	RepresentadaInput,
} from "../domain/representada.schema";

export interface RepresentadaRepository {
	/** Lista representadas ativas (não excluídas) do tenant, ordenadas por nome fantasia. */
	listar(tenantId: string, termoBusca?: string): Promise<Representada[]>;
	/** Lista todas as representadas do tenant (ativas e inativas), com inativas ao final da lista. */
	listarTodas(tenantId: string, termoBusca?: string): Promise<Representada[]>;
	/** Retorna a representada do tenant ou `undefined` (mesmo se inativa quando permitirInativo=true). */
	obterPorId(
		tenantId: string,
		id: string,
		permitirInativo?: boolean,
	): Promise<Representada | undefined>;
	criar(tenantId: string, input: RepresentadaInput): Promise<Representada>;
	atualizar(
		tenantId: string,
		id: string,
		input: RepresentadaInput,
	): Promise<Representada>;
	/** Soft delete (marca `deleted_at`). */
	inativar(tenantId: string, id: string): Promise<void>;
	/** Reativa uma representada previamente inativada (limpa `deleted_at`). */
	reativar(tenantId: string, id: string): Promise<void>;
}
