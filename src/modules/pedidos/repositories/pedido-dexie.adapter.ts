import { z } from "zod";
import type { TenantConfig } from "../../../config/tenant/tenant.schema";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import type { Produto } from "../../produtos/domain/produto.schema";
import { criarMutacaoParaRegistro } from "../../sync/domain/outbox";
import {
	type EspelhoPedidoDados,
	montarEspelhoPedido,
} from "../domain/espelho-pedido";
import type { ItemPedido } from "../domain/item-pedido.schema";
import {
	atualizarPedidoCompleto,
	ContextoVendaInvalidoError,
	criarPedidoCompleto,
	excluirRascunhoPedido,
	ordenarPedidosPorDataDesc,
	type PedidoCompleto,
	PedidoNaoEncontradoError,
	resolverPercentualComissaoPedido,
} from "../domain/pedido";
import {
	type Pedido,
	type PedidoInput,
	PedidoInputSchema,
	type StatusPedido,
} from "../domain/pedido.schema";
import type { PedidoRepository } from "./pedido.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface PedidoDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
}

export class PedidoDexieAdapter implements PedidoRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;

	constructor(options: PedidoDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	async listar(tenantId: string, status?: StatusPedido): Promise<Pedido[]> {
		const tenant = TenantIdSchema.parse(tenantId);

		const colecao = status
			? this.db.pedidos.where("[tenant_id+status]").equals([tenant, status])
			: this.db.pedidos.where("tenant_id").equals(tenant);

		const lista = await colecao.filter((p) => p.deleted_at === null).toArray();
		return ordenarPedidosPorDataDesc(lista);
	}

	async obterPorId(
		tenantId: string,
		id: string,
	): Promise<PedidoCompleto | undefined> {
		const tenant = TenantIdSchema.parse(tenantId);
		const pedidoId = IdSchema.parse(id);

		const pedido = await this.obterPedidoVivo(tenant, pedidoId);
		if (!pedido) return undefined;

		const itens = await this.obterItensVivos(tenant, pedidoId);
		return { pedido, itens };
	}

	async obterEspelhoPorId(
		tenantId: string,
		id: string,
		empresa: TenantConfig["empresa"],
	): Promise<EspelhoPedidoDados | undefined> {
		const tenant = TenantIdSchema.parse(tenantId);
		const pedidoId = IdSchema.parse(id);

		const pedidoCompleto = await this.obterPorId(tenant, pedidoId);
		if (!pedidoCompleto) return undefined;

		const { pedido, itens } = pedidoCompleto;
		const idsProdutos = [...new Set(itens.map((i) => i.produto_id))];

		const [cliente, representada, tabelaPreco, endereco, contato, produtos] =
			await Promise.all([
				this.db.clientes.get(pedido.cliente_id),
				this.db.representadas.get(pedido.representada_id),
				this.db.tabelas_preco.get(pedido.tabela_id),
				pedido.endereco_entrega_id
					? this.db.clientes_enderecos.get(pedido.endereco_entrega_id)
					: Promise.resolve(undefined),
				pedido.contato_id
					? this.db.clientes_contatos.get(pedido.contato_id)
					: Promise.resolve(undefined),
				this.db.produtos.bulkGet(idsProdutos),
			]);

		if (
			!cliente ||
			cliente.tenant_id !== tenant ||
			!representada ||
			representada.tenant_id !== tenant
		) {
			return undefined;
		}

		const produtosPorId = new Map<string, Produto>();
		for (const p of produtos) {
			if (p && p.tenant_id === tenant) {
				produtosPorId.set(p.id, p);
			}
		}

		return montarEspelhoPedido({
			tenantId: tenant,
			empresa,
			pedidoCompleto,
			cliente,
			representada,
			tabelaPreco:
				tabelaPreco && tabelaPreco.tenant_id === tenant ? tabelaPreco : null,
			enderecoEntrega:
				endereco && endereco.tenant_id === tenant ? endereco : null,
			contato: contato && contato.tenant_id === tenant ? contato : null,
			produtosPorId,
		});
	}

	async salvarRascunho(
		tenantId: string,
		input: PedidoInput,
		id?: string,
	): Promise<PedidoCompleto> {
		return this.persistir(tenantId, input, "rascunho", id);
	}

	async emitir(
		tenantId: string,
		input: PedidoInput,
		id?: string,
	): Promise<PedidoCompleto> {
		return this.persistir(tenantId, input, "emitido", id);
	}

	async excluirRascunho(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const pedidoId = IdSchema.parse(id);

		await this.db.transaction(
			"rw",
			[this.db.pedidos, this.db.itens_pedido, this.db.outbox],
			async () => {
				const existente = await this.obterPedidoVivo(tenant, pedidoId);
				if (!existente) {
					throw new PedidoNaoEncontradoError(pedidoId);
				}
				const itensExistentes = await this.obterItensVivos(tenant, pedidoId);
				const agora = this.agora();
				const { pedido, itens } = excluirRascunhoPedido({
					existente,
					itensExistentes,
					tenantId: tenant,
					agora,
				});

				const mutacoesOutbox = [
					criarMutacaoParaRegistro({
						tenantId: tenant,
						entity: "pedidos",
						registro: pedido,
						existiaAntes: true,
						agora,
						gerarId: this.gerarId,
					}),
					...itens.map((item) =>
						criarMutacaoParaRegistro({
							tenantId: tenant,
							entity: "itens_pedido",
							registro: item,
							existiaAntes: true,
							agora,
							gerarId: this.gerarId,
						}),
					),
				];

				await Promise.all([
					this.db.pedidos.put(pedido),
					itens.length > 0
						? this.db.itens_pedido.bulkPut(itens)
						: Promise.resolve(),
					this.db.outbox.bulkAdd(mutacoesOutbox),
				]);
			},
		);
	}

	private async persistir(
		tenantId: string,
		input: PedidoInput,
		status: "rascunho" | "emitido",
		id?: string,
	): Promise<PedidoCompleto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const pedidoId = id !== undefined ? IdSchema.parse(id) : undefined;
		const dados = PedidoInputSchema.parse(input);

		return this.db.transaction(
			"rw",
			[
				this.db.pedidos,
				this.db.itens_pedido,
				this.db.outbox,
				this.db.clientes,
				this.db.representadas,
				this.db.tabelas_preco,
				this.db.produtos,
			],
			async () => {
				const percentualComissaoPadrao = await this.validarContextoEVinculos(
					tenant,
					dados,
				);
				const agora = this.agora();

				if (pedidoId) {
					const existente = await this.obterPedidoVivo(tenant, pedidoId);
					if (!existente) {
						throw new PedidoNaoEncontradoError(pedidoId);
					}
					const itensExistentes = await this.obterItensVivos(tenant, pedidoId);
					const idsItensExistentes = new Set(itensExistentes.map((i) => i.id));
					const novaIdempotencyKey = this.gerarId();

					const atualizado = atualizarPedidoCompleto({
						existente,
						itensExistentes,
						tenantId: tenant,
						input: dados,
						percentualComissaoPadrao,
						status,
						idempotencyKey:
							status === "emitido"
								? novaIdempotencyKey
								: existente.idempotency_key,
						agora,
						gerarId: this.gerarId,
					});

					const mutacoesOutbox = [
						criarMutacaoParaRegistro({
							tenantId: tenant,
							entity: "pedidos",
							registro: atualizado.pedido,
							existiaAntes: true,
							idempotencyKey: novaIdempotencyKey,
							agora,
							gerarId: this.gerarId,
						}),
						...atualizado.gravarItens.map((item) =>
							criarMutacaoParaRegistro({
								tenantId: tenant,
								entity: "itens_pedido",
								registro: item,
								existiaAntes: idsItensExistentes.has(item.id),
								agora,
								gerarId: this.gerarId,
							}),
						),
					];

					await Promise.all([
						this.db.pedidos.put(atualizado.pedido),
						atualizado.gravarItens.length > 0
							? this.db.itens_pedido.bulkPut(atualizado.gravarItens)
							: Promise.resolve(),
						this.db.outbox.bulkAdd(mutacoesOutbox),
					]);

					return { pedido: atualizado.pedido, itens: atualizado.itens };
				}

				const criado = criarPedidoCompleto({
					tenantId: tenant,
					input: dados,
					percentualComissaoPadrao,
					status,
					pedidoId: this.gerarId(),
					idempotencyKey: this.gerarId(),
					agora,
					gerarId: this.gerarId,
				});

				const mutacoesOutbox = [
					criarMutacaoParaRegistro({
						tenantId: tenant,
						entity: "pedidos",
						registro: criado.pedido,
						existiaAntes: false,
						idempotencyKey: criado.pedido.idempotency_key,
						agora,
						gerarId: this.gerarId,
					}),
					...criado.itens.map((item) =>
						criarMutacaoParaRegistro({
							tenantId: tenant,
							entity: "itens_pedido",
							registro: item,
							existiaAntes: false,
							agora,
							gerarId: this.gerarId,
						}),
					),
				];

				await Promise.all([
					this.db.pedidos.add(criado.pedido),
					this.db.itens_pedido.bulkAdd(criado.itens),
					this.db.outbox.bulkAdd(mutacoesOutbox),
				]);

				return criado;
			},
		);
	}

	private async validarContextoEVinculos(
		tenantId: string,
		dados: PedidoInput,
	): Promise<number> {
		const [cliente, representada, tabela] = await Promise.all([
			this.db.clientes.get(dados.cliente_id),
			this.db.representadas.get(dados.representada_id),
			this.db.tabelas_preco.get(dados.tabela_id),
		]);

		if (
			!cliente ||
			cliente.tenant_id !== tenantId ||
			cliente.deleted_at !== null
		) {
			throw new ContextoVendaInvalidoError(
				"O cliente selecionado não foi encontrado neste tenant.",
			);
		}

		if (
			!representada ||
			representada.tenant_id !== tenantId ||
			representada.deleted_at !== null
		) {
			throw new ContextoVendaInvalidoError(
				"A representada selecionada não foi encontrada neste tenant.",
			);
		}

		if (
			!tabela ||
			tabela.tenant_id !== tenantId ||
			tabela.deleted_at !== null ||
			tabela.representada_id !== representada.id
		) {
			throw new ContextoVendaInvalidoError(
				"A tabela de preço selecionada não pertence à representada informada.",
			);
		}

		const idsProdutos = [...new Set(dados.itens.map((i) => i.produto_id))];
		const produtos = await this.db.produtos.bulkGet(idsProdutos);
		for (let idx = 0; idx < idsProdutos.length; idx++) {
			const produto = produtos[idx];
			if (
				!produto ||
				produto.tenant_id !== tenantId ||
				produto.deleted_at !== null ||
				produto.representada_id !== representada.id
			) {
				throw new ContextoVendaInvalidoError(
					"Um ou mais produtos do orçamento não pertencem à representada selecionada.",
				);
			}
		}

		return resolverPercentualComissaoPedido(representada, cliente.tipo_cliente);
	}

	private async obterPedidoVivo(
		tenantId: string,
		id: string,
	): Promise<Pedido | undefined> {
		const pedido = await this.db.pedidos.get(id);
		if (
			!pedido ||
			pedido.tenant_id !== tenantId ||
			pedido.deleted_at !== null
		) {
			return undefined;
		}
		return pedido;
	}

	private async obterItensVivos(
		tenantId: string,
		pedidoId: string,
	): Promise<ItemPedido[]> {
		return this.db.itens_pedido
			.where("[tenant_id+pedido_id]")
			.equals([tenantId, pedidoId])
			.filter((i) => i.deleted_at === null)
			.toArray();
	}
}

export const pedidoRepository: PedidoRepository = new PedidoDexieAdapter();
