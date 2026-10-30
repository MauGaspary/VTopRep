import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import { dataLocal } from "../../../shared/domain/datas";
import {
	criarTabelaPadrao,
	sincronizarTabelasRepresentada,
} from "../../produtos/domain/tabela-preco";
import type { TabelaPrecoInput } from "../../produtos/domain/tabela-preco.schema";
import {
	atualizarRepresentada,
	CnpjDuplicadoError,
	correspondeBuscaRepresentada,
	criarRepresentada,
	detectarConflitoCnpj,
	inativarRepresentada,
	ordenarRepresentadas,
	ordenarRepresentadasComInativasNoFim,
	RepresentadaInativaExistenteError,
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
					r.ativo &&
					r.deleted_at === null &&
					correspondeBuscaRepresentada(r, termoBusca),
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
			.filter(
				(r) =>
					r.deleted_at === null && correspondeBuscaRepresentada(r, termoBusca),
			)
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
			registro.deleted_at !== null ||
			(!permitirInativo && !registro.ativo)
		) {
			return undefined;
		}
		return registro;
	}

	async criar(
		tenantId: string,
		input: RepresentadaInput,
		tabelasInput?: readonly TabelaPrecoInput[],
	): Promise<Representada> {
		const tenant = TenantIdSchema.parse(tenantId);
		const instante = this.agora();
		const nova = criarRepresentada({
			tenantId: tenant,
			input,
			id: this.gerarId(),
			agora: instante,
		});

		await this.db.transaction(
			"rw",
			[this.db.representadas, this.db.tabelas_preco],
			async () => {
				await this.garantirCnpjUnico(tenant, nova, {
					oferecerReativacao: true,
				});
				await this.db.representadas.add(nova);

				if (tabelasInput && tabelasInput.length > 0) {
					const { gravar } = sincronizarTabelasRepresentada({
						tenantId: tenant,
						representadaId: nova.id,
						existentes: [],
						inputs: tabelasInput,
						agora: instante,
						gerarId: this.gerarId,
					});
					if (gravar.length > 0) {
						await this.db.tabelas_preco.bulkPut(gravar);
					}
				} else {
					const padrao = criarTabelaPadrao({
						id: this.gerarId(),
						tenantId: tenant,
						representadaId: nova.id,
						hoje: dataLocal(new Date(instante)),
						agora: instante,
					});
					await this.db.tabelas_preco.add(padrao);
				}
			},
		);

		return nova;
	}

	async atualizar(
		tenantId: string,
		id: string,
		input: RepresentadaInput,
		tabelasInput?: readonly TabelaPrecoInput[],
	): Promise<Representada> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		return this.db.transaction(
			"rw",
			[this.db.representadas, this.db.tabelas_preco],
			async () => {
				const existente = await this.obterAtivaOuFalhar(tenant, idValido);
				const instante = this.agora();
				const atualizada = atualizarRepresentada(
					existente,
					tenant,
					input,
					instante,
				);
				if (atualizada.cnpj !== existente.cnpj) {
					await this.garantirCnpjUnico(tenant, atualizada, {
						oferecerReativacao: true,
					});
				}
				await this.db.representadas.put(atualizada);

				if (tabelasInput !== undefined) {
					const tabelasExistentes = await this.db.tabelas_preco
						.where("[tenant_id+representada_id]")
						.equals([tenant, idValido])
						.toArray();
					const { gravar } = sincronizarTabelasRepresentada({
						tenantId: tenant,
						representadaId: idValido,
						existentes: tabelasExistentes,
						inputs: tabelasInput,
						agora: instante,
						gerarId: this.gerarId,
					});
					if (gravar.length > 0) {
						await this.db.tabelas_preco.bulkPut(gravar);
					}
				}

				return atualizada;
			},
		);
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
			const registro = await this.obterPorId(tenant, idValido, true);
			if (!registro) {
				throw new RepresentadaNaoEncontradaError(idValido);
			}
			const reativada = reativarRepresentada(registro, tenant, this.agora());
			// Ao reativar, só importa o conflito com outra ATIVA de mesmo CNPJ.
			await this.garantirCnpjUnico(tenant, reativada, {
				oferecerReativacao: false,
			});
			await this.db.representadas.put(reativada);
		});
	}

	private async obterAtivaOuFalhar(
		tenantId: string,
		id: string,
	): Promise<Representada> {
		const registro = await this.obterPorId(tenantId, id);
		if (!registro) {
			throw new RepresentadaNaoEncontradaError(id);
		}
		return registro;
	}

	/**
	 * CNPJ é a única chave bloqueante. Com `oferecerReativacao`, um CNPJ igual
	 * ao de uma inativa vira `RepresentadaInativaExistenteError` para a UI
	 * oferecer a reativação em vez de criar um duplicado.
	 */
	private async garantirCnpjUnico(
		tenantId: string,
		dados: Pick<Representada, "id" | "cnpj">,
		{ oferecerReativacao }: { oferecerReativacao: boolean },
	): Promise<void> {
		const candidatos = await this.db.representadas
			.where("[tenant_id+cnpj]")
			.equals([tenantId, dados.cnpj])
			.toArray();

		const conflito = detectarConflitoCnpj(candidatos, dados.cnpj, dados.id);
		if (conflito?.tipo === "ativo") {
			throw new CnpjDuplicadoError();
		}
		if (conflito?.tipo === "inativo" && oferecerReativacao) {
			throw new RepresentadaInativaExistenteError(conflito.registro);
		}
	}
}

export const representadaRepository: RepresentadaRepository =
	new RepresentadaDexieAdapter();
