import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import {
	atualizarRepresentada,
	CnpjDuplicadoError,
	correspondeBuscaRepresentada,
	criarRepresentada,
	inativarRepresentada,
	NomeFantasiaDuplicadoError,
	normalizarTextoComparacao,
	ordenarRepresentadas,
	ordenarRepresentadasComInativasNoFim,
	RazaoSocialDuplicadaError,
	RepresentadaNaoEncontradaError,
	reativarRepresentada,
} from "../domain/representada";
import type {
	Representada,
	RepresentadaInput,
} from "../domain/representada.schema";
import type { RepresentadaRepository } from "./representada.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface RepresentadaDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
}

export class RepresentadaDexieAdapter implements RepresentadaRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;

	constructor(options: RepresentadaDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	async listar(tenantId: string, termoBusca?: string): Promise<Representada[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const lista = await this.db.representadas
			.where("tenant_id")
			.equals(tenant)
			.filter(
				(r) =>
					r.deleted_at === null && correspondeBuscaRepresentada(r, termoBusca),
			)
			.toArray();
		return ordenarRepresentadas(lista);
	}

	async listarTodas(
		tenantId: string,
		termoBusca?: string,
	): Promise<Representada[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const lista = await this.db.representadas
			.where("tenant_id")
			.equals(tenant)
			.filter((r) => correspondeBuscaRepresentada(r, termoBusca))
			.toArray();
		return ordenarRepresentadasComInativasNoFim(lista);
	}

	async obterPorId(
		tenantId: string,
		id: string,
		permitirInativo = false,
	): Promise<Representada | undefined> {
		const tenant = TenantIdSchema.parse(tenantId);
		const registro = await this.db.representadas.get(IdSchema.parse(id));
		if (
			!registro ||
			registro.tenant_id !== tenant ||
			(!permitirInativo && registro.deleted_at)
		) {
			return undefined;
		}
		return registro;
	}

	async criar(
		tenantId: string,
		input: RepresentadaInput,
	): Promise<Representada> {
		const tenant = TenantIdSchema.parse(tenantId);
		const nova = criarRepresentada({
			tenantId: tenant,
			input,
			id: this.gerarId(),
			agora: this.agora(),
		});

		await this.db.transaction("rw", this.db.representadas, async () => {
			await this.garantirUnicidade(tenant, nova, nova.id);
			await this.db.representadas.add(nova);
		});

		return nova;
	}

	async atualizar(
		tenantId: string,
		id: string,
		input: RepresentadaInput,
	): Promise<Representada> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		return this.db.transaction("rw", this.db.representadas, async () => {
			const existente = await this.obterAtivaOuFalhar(tenant, idValido);
			const atualizada = atualizarRepresentada(
				existente,
				tenant,
				input,
				this.agora(),
			);
			await this.garantirUnicidade(tenant, atualizada, atualizada.id);
			await this.db.representadas.put(atualizada);
			return atualizada;
		});
	}

	async inativar(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		await this.db.transaction("rw", this.db.representadas, async () => {
			const existente = await this.obterAtivaOuFalhar(tenant, idValido);
			await this.db.representadas.put(
				inativarRepresentada(existente, tenant, this.agora()),
			);
		});
	}

	async reativar(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		await this.db.transaction("rw", this.db.representadas, async () => {
			const registro = await this.db.representadas.get(idValido);
			if (!registro || registro.tenant_id !== tenant) {
				throw new RepresentadaNaoEncontradaError(idValido);
			}
			const reativada = reativarRepresentada(registro, tenant, this.agora());
			await this.garantirUnicidade(tenant, reativada, reativada.id);
			await this.db.representadas.put(reativada);
		});
	}

	private async obterAtivaOuFalhar(
		tenantId: string,
		id: string,
	): Promise<Representada> {
		const registro = await this.db.representadas.get(id);
		if (!registro || registro.tenant_id !== tenantId || registro.deleted_at) {
			throw new RepresentadaNaoEncontradaError(id);
		}
		return registro;
	}

	private async garantirUnicidade(
		tenantId: string,
		dados: Pick<Representada, "cnpj" | "razao_social" | "nome_fantasia">,
		idAtual: string,
	): Promise<void> {
		const ativasDoTenant = await this.db.representadas
			.where("tenant_id")
			.equals(tenantId)
			.filter((r) => r.deleted_at === null && r.id !== idAtual)
			.toArray();

		const razaoNorm = normalizarTextoComparacao(dados.razao_social);
		const fantasiaNorm = normalizarTextoComparacao(dados.nome_fantasia);

		for (const r of ativasDoTenant) {
			if (r.cnpj === dados.cnpj) {
				throw new CnpjDuplicadoError();
			}
			if (normalizarTextoComparacao(r.razao_social) === razaoNorm) {
				throw new RazaoSocialDuplicadaError();
			}
			if (normalizarTextoComparacao(r.nome_fantasia) === fantasiaNorm) {
				throw new NomeFantasiaDuplicadoError();
			}
		}
	}
}

export const representadaRepository: RepresentadaRepository =
	new RepresentadaDexieAdapter();
