import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import {
	atualizarClienteDados,
	type ClienteCompleto,
	ClienteInativoExistenteError,
	ClienteNaoEncontradoError,
	CpfCnpjDuplicadoError,
	correspondeBuscaCliente,
	criarClienteCompleto,
	detectarConflitoDocumento,
	detectarHomonimosCliente,
	type HomonimoCliente,
	inativarCliente,
	ordenarClientesComInativosNoFim,
	reativarCliente,
	sincronizarFilhosCliente,
} from "../domain/cliente";
import type { Cliente } from "../domain/cliente.schema";
import type { ClienteRepository, SalvarClienteDTO } from "./cliente.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface ClienteDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
}

export class ClienteDexieAdapter implements ClienteRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;

	constructor(options: ClienteDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	async listar(tenantId: string, termoBusca?: string): Promise<Cliente[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const lista = await this.db.clientes
			.where("tenant_id")
			.equals(tenant)
			.filter(
				(c) =>
					c.ativo &&
					c.deleted_at === null &&
					correspondeBuscaCliente(c, termoBusca),
			)
			.toArray();
		return ordenarClientesComInativosNoFim(lista);
	}

	async listarTodos(tenantId: string, termoBusca?: string): Promise<Cliente[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const lista = await this.db.clientes
			.where("tenant_id")
			.equals(tenant)
			.filter(
				(c) => c.deleted_at === null && correspondeBuscaCliente(c, termoBusca),
			)
			.toArray();
		return ordenarClientesComInativosNoFim(lista);
	}

	async obterPorId(
		tenantId: string,
		id: string,
		permitirInativo = false,
	): Promise<ClienteCompleto | undefined> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		const cliente = await this.obterCliente(tenant, idValido, permitirInativo);
		if (!cliente) {
			return undefined;
		}

		return { cliente, ...(await this.obterFilhosVivos(tenant, idValido)) };
	}

	async buscarHomonimos(
		tenantId: string,
		nomes: Pick<Cliente, "razao_social" | "nome_fantasia">,
		idAtual?: string,
	): Promise<HomonimoCliente[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const candidatos = await this.db.clientes
			.where("tenant_id")
			.equals(tenant)
			.toArray();
		return detectarHomonimosCliente(candidatos, nomes, idAtual);
	}

	async criar(
		tenantId: string,
		dto: SalvarClienteDTO,
	): Promise<ClienteCompleto> {
		const tenant = TenantIdSchema.parse(tenantId);

		const completo = criarClienteCompleto({
			tenantId: tenant,
			clienteInput: dto.cliente,
			enderecosInput: dto.enderecos,
			contatosInput: dto.contatos,
			clienteId: this.gerarId(),
			agora: this.agora(),
			gerarId: this.gerarId,
		});

		await this.db.transaction(
			"rw",
			[this.db.clientes, this.db.clientes_enderecos, this.db.clientes_contatos],
			async () => {
				await this.garantirDocumentoUnico(tenant, completo.cliente, {
					oferecerReativacao: true,
				});
				await this.db.clientes.add(completo.cliente);

				if (completo.enderecos.length > 0) {
					await this.db.clientes_enderecos.bulkAdd(completo.enderecos);
				}

				if (completo.contatos.length > 0) {
					await this.db.clientes_contatos.bulkAdd(completo.contatos);
				}
			},
		);

		return completo;
	}

	async atualizar(
		tenantId: string,
		id: string,
		dto: SalvarClienteDTO,
	): Promise<ClienteCompleto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		return this.db.transaction(
			"rw",
			[this.db.clientes, this.db.clientes_enderecos, this.db.clientes_contatos],
			async () => {
				const existente = await this.obterCliente(tenant, idValido, false);
				if (!existente) {
					throw new ClienteNaoEncontradoError(idValido);
				}

				const agora = this.agora();
				const atualizado = atualizarClienteDados(
					existente,
					tenant,
					dto.cliente,
					agora,
				);

				if (atualizado.cnpj_cpf !== existente.cnpj_cpf) {
					await this.garantirDocumentoUnico(tenant, atualizado, {
						oferecerReativacao: true,
					});
				}

				// Endereços e contatos: grava só novos, alterados e removidos
				// (tombstone), para o delta sync enxergar cada mudança.
				const filhos = sincronizarFilhosCliente({
					tenantId: tenant,
					clienteId: idValido,
					agora,
					enderecosInput: dto.enderecos,
					contatosInput: dto.contatos,
					existentes: await this.obterFilhosVivos(tenant, idValido),
					gerarId: this.gerarId,
				});

				await Promise.all([
					this.db.clientes.put(atualizado),
					this.db.clientes_enderecos.bulkPut(filhos.gravar.enderecos),
					this.db.clientes_contatos.bulkPut(filhos.gravar.contatos),
				]);

				return {
					cliente: atualizado,
					enderecos: filhos.enderecos,
					contatos: filhos.contatos,
				};
			},
		);
	}

	async inativar(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		await this.db.transaction("rw", this.db.clientes, async () => {
			const existente = await this.obterCliente(tenant, idValido, false);
			if (!existente) {
				throw new ClienteNaoEncontradoError(idValido);
			}
			await this.db.clientes.put(
				inativarCliente(existente, tenant, this.agora()),
			);
		});
	}

	async reativar(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		await this.db.transaction("rw", this.db.clientes, async () => {
			const existente = await this.obterCliente(tenant, idValido, true);
			if (!existente) {
				throw new ClienteNaoEncontradoError(idValido);
			}
			const reativado = reativarCliente(existente, tenant, this.agora());
			// Ao reativar, só importa o conflito com outro ATIVO de mesmo documento.
			await this.garantirDocumentoUnico(tenant, reativado, {
				oferecerReativacao: false,
			});
			await this.db.clientes.put(reativado);
		});
	}

	/** Endereços e contatos do cliente no tenant, sem os excluídos (tombstones). */
	private async obterFilhosVivos(
		tenantId: string,
		clienteId: string,
	): Promise<Pick<ClienteCompleto, "enderecos" | "contatos">> {
		const [enderecos, contatos] = await Promise.all([
			this.db.clientes_enderecos
				.where("[tenant_id+cliente_id]")
				.equals([tenantId, clienteId])
				.filter((e) => e.deleted_at === null)
				.toArray(),
			this.db.clientes_contatos
				.where("[tenant_id+cliente_id]")
				.equals([tenantId, clienteId])
				.filter((c) => c.deleted_at === null)
				.toArray(),
		]);
		return { enderecos, contatos };
	}

	/** Cliente do tenant, nunca excluído; inativo apenas com `permitirInativo`. */
	private async obterCliente(
		tenantId: string,
		id: string,
		permitirInativo: boolean,
	): Promise<Cliente | undefined> {
		const cliente = await this.db.clientes.get(id);
		if (
			!cliente ||
			cliente.tenant_id !== tenantId ||
			cliente.deleted_at !== null ||
			(!permitirInativo && !cliente.ativo)
		) {
			return undefined;
		}
		return cliente;
	}

	/**
	 * CPF/CNPJ é a única chave bloqueante. Com `oferecerReativacao`, um
	 * documento igual ao de um inativo vira `ClienteInativoExistenteError`
	 * para a UI oferecer a reativação em vez de criar um duplicado.
	 */
	private async garantirDocumentoUnico(
		tenantId: string,
		dados: Pick<Cliente, "id" | "cnpj_cpf">,
		{ oferecerReativacao }: { oferecerReativacao: boolean },
	): Promise<void> {
		const candidatos = await this.db.clientes
			.where("[tenant_id+cnpj_cpf]")
			.equals([tenantId, dados.cnpj_cpf])
			.toArray();

		const conflito = detectarConflitoDocumento(
			candidatos,
			dados.cnpj_cpf,
			dados.id,
		);
		if (conflito?.tipo === "ativo") {
			throw new CpfCnpjDuplicadoError();
		}
		if (conflito?.tipo === "inativo" && oferecerReativacao) {
			throw new ClienteInativoExistenteError(conflito.registro);
		}
	}
}

export const clienteRepository: ClienteRepository = new ClienteDexieAdapter();
