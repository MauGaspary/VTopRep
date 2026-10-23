import Dexie, { type Table } from "dexie";
import type { Cliente } from "../modules/clientes/domain/cliente.schema";
import type { ClienteContato } from "../modules/clientes/domain/cliente-contato.schema";
import type { ClienteEndereco } from "../modules/clientes/domain/cliente-endereco.schema";
import type { ClienteMetrica } from "../modules/clientes/domain/cliente-metrica.schema";
import type { ItemPedido } from "../modules/pedidos/domain/item-pedido.schema";
import type { Pedido } from "../modules/pedidos/domain/pedido.schema";
import type { ItemPreco } from "../modules/produtos/domain/item-preco.schema";
import type { Produto } from "../modules/produtos/domain/produto.schema";
import type { TabelaPreco } from "../modules/produtos/domain/tabela-preco.schema";
import type { Representada } from "../modules/representadas/domain/representada.schema";
import type { OutboxMutation } from "../modules/sync/domain/outbox.schema";

export class AppDatabase extends Dexie {
	clientes!: Table<Cliente, string>;
	clientes_enderecos!: Table<ClienteEndereco, string>;
	clientes_contatos!: Table<ClienteContato, string>;
	clientes_metricas!: Table<ClienteMetrica, string>;
	produtos!: Table<Produto, string>;
	tabelas_preco!: Table<TabelaPreco, string>;
	itens_preco!: Table<ItemPreco, string>;
	pedidos!: Table<Pedido, string>;
	itens_pedido!: Table<ItemPedido, string>;
	outbox!: Table<OutboxMutation, string>;
	representadas!: Table<Representada, string>;

	constructor() {
		super("VTop_Rep_DB");

		this.version(1).stores({
			clientes: "id, tenant_id, [tenant_id+cnpj_cpf], [tenant_id+deleted_at]",
			produtos: "id, tenant_id, [tenant_id+sku], [tenant_id+deleted_at]",
			pedidos:
				"id, tenant_id, [tenant_id+status], [tenant_id+cliente_id], [tenant_id+deleted_at]",
			itens_pedido:
				"id, tenant_id, [tenant_id+pedido_id], [tenant_id+deleted_at]",
			outbox: "id, tenantId, [tenantId+status]",
		});

		this.version(2).stores({
			clientes: "id, tenant_id, [tenant_id+cnpj_cpf], [tenant_id+deleted_at]",
			clientes_enderecos: "id, cliente_id",
			clientes_contatos: "id, cliente_id",
			clientes_metricas: "cliente_id, tenant_id, [tenant_id+curva_abc]",
			produtos: "id, tenant_id, [tenant_id+sku], [tenant_id+deleted_at]",
			tabelas_preco:
				"id, tenant_id, [tenant_id+representada_id], [tenant_id+deleted_at]",
			itens_preco:
				"id, tenant_id, [tenant_id+tabela_id], [tenant_id+produto_id], [tenant_id+deleted_at]",
			pedidos:
				"id, tenant_id, [tenant_id+status], [tenant_id+cliente_id], [tenant_id+deleted_at]",
			itens_pedido:
				"id, tenant_id, [tenant_id+pedido_id], [tenant_id+deleted_at]",
			outbox: "id, tenantId, [tenantId+status]",
		});

		this.version(3).stores({
			representadas: "id, tenant_id, [tenant_id+cnpj]",
		});
	}
}

export const db = new AppDatabase();
