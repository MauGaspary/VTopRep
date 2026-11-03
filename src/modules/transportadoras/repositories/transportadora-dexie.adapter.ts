import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import { criarMutacaoParaRegistro } from "../../sync/domain/outbox";
import {
	atualizarTransportadora,
	CnpjTransportadoraDuplicadoError,
	correspondeBuscaTransportadora,
	criarTransportadora,
	detectarConflitoCnpjTransportadora,
	inativarTransportadora,
	ordenarTransportadoras,
	reativarTransportadora,
	TransportadoraInativaExistenteError,
	TransportadoraNaoEncontradaError,
} from "../domain/transportadora";
import type {
	Transportadora,
	TransportadoraInput,
} from "../domain/transportadora.schema";
import type { TransportadoraRepository } from "./transportadora.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface TransportadoraDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
}

export class TransportadoraDexieAdapter implements TransportadoraRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;

	constructor(options: TransportadoraDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	async listar(
		tenantId: string,
		termoBusca?: string,
	): Promise<Transportadora[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const lista = await this.db.transportadoras
			.where("tenant_id")
			.equals(tenant)
			.filter(
				(t) =>
					t.ativo &&
					t.deleted_at === null &&
					correspondeBuscaTransportadora(t, termoBusca),
			)
			.toArray();
		return ordenarTransportadoras(lista);
	}

	async listarTodas(
		tenantId: string,
		termoBusca?: string,
	): Promise<Transportadora[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const lista = await this.db.transportadoras
			.where("tenant_id")
			.equals(tenant)
			.filter(
				(t) =>
					t.deleted_at === null &&
					correspondeBuscaTransportadora(t, termoBusca),
			)
			.toArray();
		return ordenarTransportadoras(lista);
	}

	async obterPorId(
		tenantId: string,
		id: string,
		permitirInativo = false,
	): Promise<Transportadora | undefined> {
		const tenant = TenantIdSchema.parse(tenantId);
		const registro = await this.db.transportadoras.get(IdSchema.parse(id));
		if (
			!registro ||
			registro.tenant_id !== tenant ||
			registro.deleted_at !== null ||
			(!permitirInativo && !registro.ativo)
		) {
			return undefined;
		}
		return registro;
	}

	async criar(
		tenantId: string,
		input: TransportadoraInput,
	): Promise<Transportadora> {
		const tenant = TenantIdSchema.parse(tenantId);
		const agora = this.agora();
		const nova = criarTransportadora({
			tenantId: tenant,
			input,
			id: this.gerarId(),
			agora,
		});

		await this.db.transaction(
			"rw",
			[this.db.transportadoras, this.db.outbox],
			async () => {
				await this.garantirCnpjUnico(tenant, nova, {
					oferecerReativacao: true,
				});
				await Promise.all([
					this.db.transportadoras.add(nova),
					this.db.outbox.add(this.mutacao(tenant, nova, false, agora)),
				]);
			},
		);

		return nova;
	}

	async atualizar(
		tenantId: string,
		id: string,
		input: TransportadoraInput,
	): Promise<Transportadora> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		return this.db.transaction(
			"rw",
			[this.db.transportadoras, this.db.outbox],
			async () => {
				const existente = await this.obterAtivaOuFalhar(tenant, idValido);
				const agora = this.agora();
				const atualizada = atualizarTransportadora(
					existente,
					tenant,
					input,
					agora,
				);
				if (atualizada.cnpj !== existente.cnpj) {
					await this.garantirCnpjUnico(tenant, atualizada, {
						oferecerReativacao: true,
					});
				}
				await Promise.all([
					this.db.transportadoras.put(atualizada),
					this.db.outbox.add(this.mutacao(tenant, atualizada, true, agora)),
				]);
				return atualizada;
			},
		);
	}

	async inativar(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		await this.db.transaction(
			"rw",
			[this.db.transportadoras, this.db.outbox],
			async () => {
				const existente = await this.obterAtivaOuFalhar(tenant, idValido);
				const agora = this.agora();
				const inativada = inativarTransportadora(existente, tenant, agora);
				await Promise.all([
					this.db.transportadoras.put(inativada),
					this.db.outbox.add(this.mutacao(tenant, inativada, true, agora)),
				]);
			},
		);
	}

	async reativar(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		await this.db.transaction(
			"rw",
			[this.db.transportadoras, this.db.outbox],
			async () => {
				const registro = await this.obterPorId(tenant, idValido, true);
				if (!registro) {
					throw new TransportadoraNaoEncontradaError(idValido);
				}
				if (registro.ativo) return;
				const agora = this.agora();
				const reativada = reativarTransportadora(registro, tenant, agora);
				// Ao reativar, só importa o conflito com outra ATIVA de mesmo CNPJ.
				await this.garantirCnpjUnico(tenant, reativada, {
					oferecerReativacao: false,
				});
				await Promise.all([
					this.db.transportadoras.put(reativada),
					this.db.outbox.add(this.mutacao(tenant, reativada, true, agora)),
				]);
			},
		);
	}

	private mutacao(
		tenantId: string,
		registro: Transportadora,
		existiaAntes: boolean,
		agora: string,
	) {
		return criarMutacaoParaRegistro({
			tenantId,
			entity: "transportadoras",
			registro,
			existiaAntes,
			agora,
			gerarId: this.gerarId,
		});
	}

	private async obterAtivaOuFalhar(
		tenantId: string,
		id: string,
	): Promise<Transportadora> {
		const registro = await this.obterPorId(tenantId, id);
		if (!registro) {
			throw new TransportadoraNaoEncontradaError(id);
		}
		return registro;
	}

	/**
	 * CNPJ (quando informado) é a única chave bloqueante. Com `oferecerReativacao`,
	 * um CNPJ igual ao de uma inativa vira `TransportadoraInativaExistenteError`
	 * para a UI oferecer a reativação em vez de criar um duplicado.
	 */
	private async garantirCnpjUnico(
		tenantId: string,
		dados: Pick<Transportadora, "id" | "cnpj">,
		{ oferecerReativacao }: { oferecerReativacao: boolean },
	): Promise<void> {
		if (dados.cnpj === null) return;

		const candidatos = await this.db.transportadoras
			.where("[tenant_id+cnpj]")
			.equals([tenantId, dados.cnpj])
			.toArray();

		const conflito = detectarConflitoCnpjTransportadora(
			candidatos,
			dados.cnpj,
			dados.id,
		);
		if (conflito?.tipo === "ativo") {
			throw new CnpjTransportadoraDuplicadoError();
		}
		if (conflito?.tipo === "inativo" && oferecerReativacao) {
			throw new TransportadoraInativaExistenteError(conflito.registro);
		}
	}
}

export const transportadoraRepository: TransportadoraRepository =
	new TransportadoraDexieAdapter();
