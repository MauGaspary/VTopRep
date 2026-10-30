import Dexie, { type Table } from "dexie";
import type { Cliente } from "../modules/clientes/domain/cliente.schema";
import type { ClienteContato } from "../modules/clientes/domain/cliente-contato.schema";
import type { ClienteEndereco } from "../modules/clientes/domain/cliente-endereco.schema";
import type { ClienteMetrica } from "../modules/clientes/domain/cliente-metrica.schema";
import type { ItemPedido } from "../modules/pedidos/domain/item-pedido.schema";
import type { Pedido } from "../modules/pedidos/domain/pedido.schema";
import type { ClienteTabelaPreco } from "../modules/produtos/domain/cliente-tabela-preco.schema";
import type { ItemPreco } from "../modules/produtos/domain/item-preco.schema";
import type { Produto } from "../modules/produtos/domain/produto.schema";
import type { TabelaPreco } from "../modules/produtos/domain/tabela-preco.schema";
import type { Representada } from "../modules/representadas/domain/representada.schema";
import type { OutboxMutation } from "../modules/sync/domain/outbox.schema";
import { migrarParaV4 } from "./migrations/v4";
import { migrarParaV5 } from "./migrations/v5";
import { migrarParaV7 } from "./migrations/v7";

export const NOME_BANCO_PADRAO = "VTop_Rep_DB";

export class AppDatabase extends Dexie {
	clientes!: Table<Cliente, string>;
	clientes_enderecos!: Table<ClienteEndereco, string>;
	clientes_contatos!: Table<ClienteContato, string>;
	clientes_metricas!: Table<ClienteMetrica, string>;
	clientes_tabelas_preco!: Table<ClienteTabelaPreco, string>;
	produtos!: Table<Produto, string>;
	tabelas_preco!: Table<TabelaPreco, string>;
	itens_preco!: Table<ItemPreco, string>;
	pedidos!: Table<Pedido, string>;
	itens_pedido!: Table<ItemPedido, string>;
	outbox!: Table<OutboxMutation, string>;
	representadas!: Table<Representada, string>;

	constructor(nome = NOME_BANCO_PADRAO) {
		super(nome);

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

		// v4: tenant_id nas tabelas filhas de clientes, SKU único por
		// representada, `ativo` separado de `deleted_at`, outbox em snake_case.
		this.version(4)
			.stores({
				clientes_enderecos: "id, tenant_id, [tenant_id+cliente_id]",
				clientes_contatos: "id, tenant_id, [tenant_id+cliente_id]",
				produtos:
					"id, tenant_id, [tenant_id+representada_id+sku], [tenant_id+deleted_at]",
				outbox: "id, tenant_id, [tenant_id+status]",
			})
			.upgrade(migrarParaV4);

		// v5: timestamps e soft delete em endereços e contatos (sem mudar índices).
		this.version(5).stores({}).upgrade(migrarParaV5);

		// v6: tabela de preço padrão por cliente e representada; busca direta
		// do preço de um produto numa tabela. Só cria estruturas, sem upgrade.
		this.version(6).stores({
			clientes_tabelas_preco:
				"id, tenant_id, [tenant_id+cliente_id+representada_id]",
			itens_preco:
				"id, tenant_id, [tenant_id+tabela_id], [tenant_id+produto_id], [tenant_id+tabela_id+produto_id], [tenant_id+deleted_at]",
		});

		// v7: segmentação de cliente (`tipo_cliente`: REVENDA | FABRICA) e
		// alíquotas de comissão por segmento nas representadas.
		this.version(7).stores({}).upgrade(migrarParaV7);
	}
}

export const db = new AppDatabase();
