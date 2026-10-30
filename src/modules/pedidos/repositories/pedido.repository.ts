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
	/** Exclui (soft delete) um orçamento ainda em status `rascunho`. */
	excluirRascunho(tenantId: string, id: string): Promise<void>;
}
