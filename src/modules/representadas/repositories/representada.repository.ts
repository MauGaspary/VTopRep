import type {
	Representada,
	RepresentadaInput,
} from "../domain/representada.schema";

export interface RepresentadaRepository {
	/** Lista representadas ativas (não excluídas) do tenant, ordenadas por nome fantasia. */
	listar(tenantId: string, termoBusca?: string): Promise<Representada[]>;
	/** Retorna a representada ativa do tenant ou `undefined`. */
	obterPorId(tenantId: string, id: string): Promise<Representada | undefined>;
	criar(tenantId: string, input: RepresentadaInput): Promise<Representada>;
	atualizar(
		tenantId: string,
		id: string,
		input: RepresentadaInput,
	): Promise<Representada>;
	/** Soft delete (marca `deleted_at`). */
	inativar(tenantId: string, id: string): Promise<void>;
}
