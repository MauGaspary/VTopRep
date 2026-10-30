import type { ResumoFilaOutbox } from "../domain/outbox";
import type {
	EnfileirarMutacaoInput,
	EntidadeSincronizavel,
	OutboxMutation,
	StatusOutbox,
} from "../domain/outbox.schema";

/**
 * Contrato de transporte remoto para envio de mutações da fila Outbox
 * (ex.: adaptador Supabase com `ON CONFLICT (idempotency_key) DO NOTHING` ou LWW).
 */
export interface OutboxTransport {
	enviarMutacao(mutacao: OutboxMutation): Promise<void>;
}

export interface ResultadoProcessamentoOutbox {
	enviadas: number;
	falhas: number;
}

export interface ResultadoDeltaRemoto {
	aplicados: number;
	ignoradosPorConflito: number;
}

export interface OutboxRepository {
	/** Registra uma mutação na fila Outbox local do tenant. */
	enfileirar(
		tenantId: string,
		input: EnfileirarMutacaoInput,
	): Promise<OutboxMutation>;
	/** Registra múltiplas mutações na fila Outbox local em lote transacional. */
	enfileirarLote(
		tenantId: string,
		inputs: readonly EnfileirarMutacaoInput[],
	): Promise<OutboxMutation[]>;
	/** Lista as mutações do tenant em ordem FIFO (opcionalmente filtradas por status). */
	listarFila(
		tenantId: string,
		status?: StatusOutbox,
	): Promise<OutboxMutation[]>;
	/** Obtém os contadores da fila Outbox do tenant. */
	obterResumo(tenantId: string): Promise<ResumoFilaOutbox>;
	/** Marca uma mutação como em sincronização (`syncing`). */
	marcarSincronizando(tenantId: string, id: string): Promise<OutboxMutation>;
	/** Remove a mutação da fila após confirmação de recebimento pelo servidor. */
	concluirSincronizacao(tenantId: string, id: string): Promise<void>;
	/** Registra erro de envio e incrementa `retry_count`. */
	registrarFalha(
		tenantId: string,
		id: string,
		erro: string,
	): Promise<OutboxMutation>;
	/** Reenfileira todas as mutações com status `failed` do tenant para `pending`. */
	reenfileirarFalhas(tenantId: string): Promise<number>;
	/** Processa todas as mutações `pending` do tenant através do transporte configurado. */
	processarPendentes(
		tenantId: string,
		transport?: OutboxTransport,
	): Promise<ResultadoProcessamentoOutbox>;
	/**
	 * Aplica registros vindos do servidor respeitando a política de conflito de cada
	 * entidade (PRD 3.2): LWW por `updated_at` registro a registro para cadastros de
	 * campo, Client-Wins com `idempotency_key` para pedidos/itens e Server-Wins para
	 * entidades mestres da fábrica.
	 */
	aplicarDeltaRemoto(
		tenantId: string,
		entity: EntidadeSincronizavel,
		registrosRemotos: readonly unknown[],
	): Promise<ResultadoDeltaRemoto>;
}
