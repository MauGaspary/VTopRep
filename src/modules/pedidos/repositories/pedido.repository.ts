import type { TenantConfig } from "../../../config/tenant/tenant.schema";
import type { CotacaoCompleta } from "../domain/cotacao";
import type { CotacaoInput } from "../domain/cotacao.schema";
import type {
	EspelhoCotacaoDados,
	EspelhoPedidoDados,
} from "../domain/espelho-pedido";
import type { PedidoCompleto } from "../domain/pedido";
import type {
	Pedido,
	PedidoInput,
	StatusPedido,
} from "../domain/pedido.schema";

export interface PedidoRepository {
	/** Lista todos os orçamentos e pedidos não excluídos do tenant (mais recentes primeiro). */
	listar(tenantId: string, status?: StatusPedido): Promise<Pedido[]>;
	/** Obtém um orçamento ou pedido com seus itens vivos. */
	obterPorId(tenantId: string, id: string): Promise<PedidoCompleto | undefined>;
	/** Monta os dados completos do espelho do orçamento/pedido para geração de PDF e envio. */
	obterEspelhoPorId(
		tenantId: string,
		id: string,
		empresa: TenantConfig["empresa"],
	): Promise<EspelhoPedidoDados | undefined>;
	/** Cria ou atualiza um orçamento em status `rascunho`. */
	salvarRascunho(
		tenantId: string,
		input: PedidoInput,
		id?: string,
	): Promise<PedidoCompleto>;
	/** Cria ou fecha um orçamento passando o status para `emitido`. */
	emitir(
		tenantId: string,
		input: PedidoInput,
		id?: string,
	): Promise<PedidoCompleto>;
	/**
	 * Obtém a cotação do pedido: todos os pedidos vivos do mesmo
	 * `cotacao_grupo_id` (ou só o próprio pedido, se avulso), com itens.
	 */
	obterCotacao(
		tenantId: string,
		pedidoId: string,
	): Promise<CotacaoCompleta | undefined>;
	/** Espelho unificado da cotação (todas as fábricas) para o cliente. */
	obterEspelhoCotacao(
		tenantId: string,
		pedidoId: string,
		empresa: TenantConfig["empresa"],
	): Promise<EspelhoCotacaoDados | undefined>;
	/**
	 * Grava a cotação multi-representada numa única transação: 1 pedido por
	 * representada, vinculados por `cotacao_grupo_id`. Ao editar
	 * (`pedidoReferenciaId`), atualiza os pedidos existentes por representada e
	 * exclui (tombstone) os rascunhos das fábricas removidas da sacola.
	 */
	salvarCotacao(
		tenantId: string,
		input: CotacaoInput,
		status: "rascunho" | "emitido",
		pedidoReferenciaId?: string,
	): Promise<CotacaoCompleta>;
	/** Exclui (soft delete) um orçamento ainda em status `rascunho`. */
	excluirRascunho(tenantId: string, id: string): Promise<void>;
}
