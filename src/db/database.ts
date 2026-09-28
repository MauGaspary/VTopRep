import Dexie, { type Table } from "dexie";
import type { Cliente } from "../modules/clientes/domain/cliente.schema";
import type {
	ItemPedido,
	Pedido,
} from "../modules/pedidos/domain/pedido.schema";
import type { Produto } from "../modules/produtos/domain/produto.schema";
import type { OutboxMutation } from "../modules/sync/domain/outbox.schema";

export class AppDatabase extends Dexie {
	clientes!: Table<Cliente, string>;
	produtos!: Table<Produto, string>;
	pedidos!: Table<Pedido, string>;
	itens_pedido!: Table<ItemPedido, string>;
	outbox!: Table<OutboxMutation, string>;

	constructor() {
		super("VinitopRS_Database");

		this.version(1).stores({
			clientes: "id, tenant_id, [tenant_id+cnpj_cpf], [tenant_id+deleted_at]",
			produtos: "id, tenant_id, [tenant_id+sku], [tenant_id+deleted_at]",
			pedidos:
				"id, tenant_id, [tenant_id+status], [tenant_id+cliente_id], [tenant_id+deleted_at]",
			itens_pedido:
				"id, tenant_id, [tenant_id+pedido_id], [tenant_id+deleted_at]",
			outbox: "id, tenantId, [tenantId+status]",
		});
	}
}

export const db = new AppDatabase();
