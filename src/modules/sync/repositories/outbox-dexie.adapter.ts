import type { Table } from "dexie";
import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ClienteSchema } from "../../clientes/domain/cliente.schema";
import { ClienteContatoSchema } from "../../clientes/domain/cliente-contato.schema";
import { ClienteEnderecoSchema } from "../../clientes/domain/cliente-endereco.schema";
import { ClienteMetricaSchema } from "../../clientes/domain/cliente-metrica.schema";
import { ItemPedidoSchema } from "../../pedidos/domain/item-pedido.schema";
import { PedidoSchema } from "../../pedidos/domain/pedido.schema";
import { ClienteTabelaPrecoSchema } from "../../produtos/domain/cliente-tabela-preco.schema";
import { ItemPrecoSchema } from "../../produtos/domain/item-preco.schema";
import { ProdutoSchema } from "../../produtos/domain/produto.schema";
import { TabelaPrecoSchema } from "../../produtos/domain/tabela-preco.schema";
import { RepresentadaSchema } from "../../representadas/domain/representada.schema";
import {
	criarMutacaoOutbox,
	iniciarSincronizacaoMutacao,
	OutboxMutacaoNaoEncontradaError,
	ordenarFilaOutbox,
	type RegistroSincronizavel,
	type ResumoFilaOutbox,
	reenfileirarMutacaoFalha,
	registrarFalhaMutacao,
	resolverConflitoSincronizacao,
	resumirFilaOutbox,
} from "../domain/outbox";
import {
	type EnfileirarMutacaoInput,
	type EntidadeSincronizavel,
	EntidadeSincronizavelSchema,
	type OutboxMutation,
	type StatusOutbox,
	StatusOutboxSchema,
} from "../domain/outbox.schema";
import type {
	OutboxRepository,
	OutboxTransport,
	ResultadoDeltaRemoto,
	ResultadoProcessamentoOutbox,
} from "./outbox.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface OutboxDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
	transport?: OutboxTransport;
}

const noopTransport: OutboxTransport = {
	async enviarMutacao() {
		// Transporte local padrão (no-op) quando não há backend remoto conectado
	},
};

export class OutboxDexieAdapter implements OutboxRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;
	private readonly transportPadrao: OutboxTransport;

	constructor(options: OutboxDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
		this.transportPadrao = options.transport ?? noopTransport;
	}

	async enfileirar(
		tenantId: string,
		input: EnfileirarMutacaoInput,
	): Promise<OutboxMutation> {
		const tenant = TenantIdSchema.parse(tenantId);
		const mutacao = criarMutacaoOutbox({
			id: this.gerarId(),
			tenantId: tenant,
			input,
			agora: this.agora(),
			gerarId: this.gerarId,
		});

		await this.db.outbox.add(mutacao);
		return mutacao;
	}

	async enfileirarLote(
		tenantId: string,
		inputs: readonly EnfileirarMutacaoInput[],
	): Promise<OutboxMutation[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		if (inputs.length === 0) return [];

		const instante = this.agora();
		const mutacoes = inputs.map((input) =>
			criarMutacaoOutbox({
				id: this.gerarId(),
				tenantId: tenant,
				input,
				agora: instante,
				gerarId: this.gerarId,
			}),
		);

		await this.db.transaction("rw", this.db.outbox, async () => {
			await this.db.outbox.bulkAdd(mutacoes);
		});

		return mutacoes;
	}

	async listarFila(
		tenantId: string,
		status?: StatusOutbox,
	): Promise<OutboxMutation[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const statusValido =
			status !== undefined ? StatusOutboxSchema.parse(status) : undefined;

		const colecao = statusValido
			? this.db.outbox
					.where("[tenant_id+status]")
					.equals([tenant, statusValido])
			: this.db.outbox.where("tenant_id").equals(tenant);

		const lista = await colecao.toArray();
		return ordenarFilaOutbox(lista);
	}

	async obterResumo(tenantId: string): Promise<ResumoFilaOutbox> {
		const tenant = TenantIdSchema.parse(tenantId);
		const mutacoes = await this.db.outbox
			.where("tenant_id")
			.equals(tenant)
			.toArray();
		return resumirFilaOutbox(mutacoes);
	}

	async marcarSincronizando(
		tenantId: string,
		id: string,
	): Promise<OutboxMutation> {
		const tenant = TenantIdSchema.parse(tenantId);
		const mutacaoId = IdSchema.parse(id);

		return this.db.transaction("rw", this.db.outbox, async () => {
			const existente = await this.obterDoTenant(tenant, mutacaoId);
			const atualizada = iniciarSincronizacaoMutacao(existente, tenant);
			await this.db.outbox.put(atualizada);
			return atualizada;
		});
	}

	async concluirSincronizacao(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const mutacaoId = IdSchema.parse(id);

		await this.db.transaction("rw", this.db.outbox, async () => {
			await this.obterDoTenant(tenant, mutacaoId);
			await this.db.outbox.delete(mutacaoId);
		});
	}

	async registrarFalha(
		tenantId: string,
		id: string,
		erro: string,
	): Promise<OutboxMutation> {
		const tenant = TenantIdSchema.parse(tenantId);
		const mutacaoId = IdSchema.parse(id);

		return this.db.transaction("rw", this.db.outbox, async () => {
			const existente = await this.obterDoTenant(tenant, mutacaoId);
			const atualizada = registrarFalhaMutacao(existente, tenant, erro);
			await this.db.outbox.put(atualizada);
			return atualizada;
		});
	}

	async reenfileirarFalhas(tenantId: string): Promise<number> {
		const tenant = TenantIdSchema.parse(tenantId);

		return this.db.transaction("rw", this.db.outbox, async () => {
			const falhas = await this.db.outbox
				.where("[tenant_id+status]")
				.equals([tenant, "failed"])
				.toArray();

			if (falhas.length === 0) return 0;

			const reenfileiradas = falhas.map((m) =>
				reenfileirarMutacaoFalha(m, tenant),
			);
			await this.db.outbox.bulkPut(reenfileiradas);
			return reenfileiradas.length;
		});
	}

	async processarPendentes(
		tenantId: string,
		transport: OutboxTransport = this.transportPadrao,
	): Promise<ResultadoProcessamentoOutbox> {
		const tenant = TenantIdSchema.parse(tenantId);
		const pendentes = await this.listarFila(tenant, "pending");

		let enviadas = 0;
		let falhas = 0;
		const chavesProcessadasNestaRodada = new Set<string>();

		for (const mutacao of pendentes) {
			if (chavesProcessadasNestaRodada.has(mutacao.idempotency_key)) {
				await this.concluirSincronizacao(tenant, mutacao.id);
				enviadas++;
				continue;
			}

			await this.marcarSincronizando(tenant, mutacao.id);
			try {
				await transport.enviarMutacao({
					...mutacao,
					status: "syncing",
				});
				chavesProcessadasNestaRodada.add(mutacao.idempotency_key);
				await this.concluirSincronizacao(tenant, mutacao.id);
				enviadas++;
			} catch (e) {
				await this.registrarFalha(
					tenant,
					mutacao.id,
					mensagemDeErro(e, "Erro ao sincronizar mutação"),
				);
				falhas++;
			}
		}

		return { enviadas, falhas };
	}

	async aplicarDeltaRemoto(
		tenantId: string,
		entity: EntidadeSincronizavel,
		registrosRemotos: readonly unknown[],
	): Promise<ResultadoDeltaRemoto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const entidadeValida = EntidadeSincronizavelSchema.parse(entity);
		if (registrosRemotos.length === 0) {
			return { aplicados: 0, ignoradosPorConflito: 0 };
		}

		switch (entidadeValida) {
			case "representadas":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.representadas,
					registrosRemotos.map((r) => RepresentadaSchema.parse(r)),
				);
			case "clientes":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.clientes,
					registrosRemotos.map((r) => ClienteSchema.parse(r)),
				);
			case "clientes_enderecos":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.clientes_enderecos,
					registrosRemotos.map((r) => ClienteEnderecoSchema.parse(r)),
				);
			case "clientes_contatos":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.clientes_contatos,
					registrosRemotos.map((r) => ClienteContatoSchema.parse(r)),
				);
			case "clientes_metricas":
				return this.aplicarDeltaMetricas(
					tenant,
					registrosRemotos.map((r) => ClienteMetricaSchema.parse(r)),
				);
			case "clientes_tabelas_preco":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.clientes_tabelas_preco,
					registrosRemotos.map((r) => ClienteTabelaPrecoSchema.parse(r)),
				);
			case "produtos":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.produtos,
					registrosRemotos.map((r) => ProdutoSchema.parse(r)),
				);
			case "tabelas_preco":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.tabelas_preco,
					registrosRemotos.map((r) => TabelaPrecoSchema.parse(r)),
				);
			case "itens_preco":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.itens_preco,
					registrosRemotos.map((r) => ItemPrecoSchema.parse(r)),
				);
			case "pedidos":
				return this.aplicarDeltaPedidos(
					tenant,
					registrosRemotos.map((r) => PedidoSchema.parse(r)),
				);
			case "itens_pedido":
				return this.aplicarDeltaComChaveId(
					tenant,
					entidadeValida,
					this.db.itens_pedido,
					registrosRemotos.map((r) => ItemPedidoSchema.parse(r)),
				);
		}
	}

	private async aplicarDeltaComChaveId<
		T extends RegistroSincronizavel & { id: string },
	>(
		tenantId: string,
		entity: EntidadeSincronizavel,
		tabela: Table<T, string>,
		remotos: readonly T[],
	): Promise<ResultadoDeltaRemoto> {
		return this.db.transaction("rw", tabela, async () => {
			let aplicados = 0;
			let ignoradosPorConflito = 0;
			const paraGravar: T[] = [];

			for (const remoto of remotos) {
				const local = await tabela.get(remoto.id);
				const decisao = resolverConflitoSincronizacao({
					entity,
					tenantId,
					local,
					remoto,
				});
				if (decisao.vencedor === "remoto") {
					paraGravar.push(decisao.registro);
					aplicados++;
				} else {
					ignoradosPorConflito++;
				}
			}

			if (paraGravar.length > 0) {
				await tabela.bulkPut(paraGravar);
			}

			return { aplicados, ignoradosPorConflito };
		});
	}

	private async aplicarDeltaPedidos(
		tenantId: string,
		remotos: readonly z.infer<typeof PedidoSchema>[],
	): Promise<ResultadoDeltaRemoto> {
		return this.db.transaction("rw", this.db.pedidos, async () => {
			let aplicados = 0;
			let ignoradosPorConflito = 0;
			const locaisDoTenant = await this.db.pedidos
				.where("tenant_id")
				.equals(tenantId)
				.toArray();
			const porId = new Map(locaisDoTenant.map((p) => [p.id, p]));
			const porIdempotencyKey = new Map(
				locaisDoTenant.map((p) => [p.idempotency_key, p]),
			);
			const paraGravar: z.infer<typeof PedidoSchema>[] = [];

			for (const remoto of remotos) {
				const local =
					porId.get(remoto.id) ?? porIdempotencyKey.get(remoto.idempotency_key);
				const decisao = resolverConflitoSincronizacao({
					entity: "pedidos",
					tenantId,
					local,
					remoto,
				});
				if (decisao.vencedor === "remoto") {
					paraGravar.push(decisao.registro);
					porId.set(decisao.registro.id, decisao.registro);
					porIdempotencyKey.set(
						decisao.registro.idempotency_key,
						decisao.registro,
					);
					aplicados++;
				} else {
					ignoradosPorConflito++;
				}
			}

			if (paraGravar.length > 0) {
				await this.db.pedidos.bulkPut(paraGravar);
			}

			return { aplicados, ignoradosPorConflito };
		});
	}

	private async aplicarDeltaMetricas(
		tenantId: string,
		remotos: readonly z.infer<typeof ClienteMetricaSchema>[],
	): Promise<ResultadoDeltaRemoto> {
		return this.db.transaction("rw", this.db.clientes_metricas, async () => {
			let aplicados = 0;
			let ignoradosPorConflito = 0;
			const paraGravar: z.infer<typeof ClienteMetricaSchema>[] = [];

			for (const remoto of remotos) {
				const local = await this.db.clientes_metricas.get(remoto.cliente_id);
				const decisao = resolverConflitoSincronizacao({
					entity: "clientes_metricas",
					tenantId,
					local,
					remoto,
				});
				if (decisao.vencedor === "remoto") {
					paraGravar.push(decisao.registro);
					aplicados++;
				} else {
					ignoradosPorConflito++;
				}
			}

			if (paraGravar.length > 0) {
				await this.db.clientes_metricas.bulkPut(paraGravar);
			}

			return { aplicados, ignoradosPorConflito };
		});
	}

	private async obterDoTenant(
		tenantId: string,
		id: string,
	): Promise<OutboxMutation> {
		const existente = await this.db.outbox.get(id);
		if (!existente || existente.tenant_id !== tenantId) {
			throw new OutboxMutacaoNaoEncontradaError(id);
		}
		return existente;
	}
}

export const outboxRepository: OutboxRepository = new OutboxDexieAdapter();
