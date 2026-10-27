import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import { normalizarTextoComparacao } from "../../representadas/domain/representada";
import {
	atualizarClienteDados,
	type ClienteCompleto,
	ClienteInativoExistenteError,
	ClienteNaoEncontradoError,
	CpfCnpjDuplicadoError,
	correspondeBuscaCliente,
	criarClienteCompleto,
	inativarCliente,
	NomeFantasiaClienteDuplicadoError,
	ordenarClientesComInativosNoFim,
	RazaoSocialClienteDuplicadaError,
	reativarCliente,
} from "../domain/cliente";
import type { Cliente } from "../domain/cliente.schema";
import {
	type ClienteContato,
	ClienteContatoInputSchema,
	ClienteContatoSchema,
} from "../domain/cliente-contato.schema";
import {
	type ClienteEndereco,
	ClienteEnderecoInputSchema,
	ClienteEnderecoSchema,
} from "../domain/cliente-endereco.schema";
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
				(c) => c.deleted_at === null && correspondeBuscaCliente(c, termoBusca),
			)
			.toArray();
		return ordenarClientesComInativosNoFim(lista);
	}

	async listarTodos(tenantId: string, termoBusca?: string): Promise<Cliente[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const lista = await this.db.clientes
			.where("tenant_id")
			.equals(tenant)
			.filter((c) => correspondeBuscaCliente(c, termoBusca))
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

		const cliente = await this.db.clientes.get(idValido);
		if (
			!cliente ||
			cliente.tenant_id !== tenant ||
			(!permitirInativo && cliente.deleted_at !== null)
		) {
			return undefined;
		}

		const [enderecos, contatos] = await Promise.all([
			this.db.clientes_enderecos.where("cliente_id").equals(idValido).toArray(),
			this.db.clientes_contatos.where("cliente_id").equals(idValido).toArray(),
		]);

		return { cliente, enderecos, contatos };
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
				await this.garantirUnicidade(
					tenant,
					completo.cliente,
					completo.cliente.id,
				);
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
				const existente = await this.db.clientes.get(idValido);
				if (
					!existente ||
					existente.tenant_id !== tenant ||
					existente.deleted_at
				) {
					throw new ClienteNaoEncontradoError(idValido);
				}

				const atualizado = atualizarClienteDados(
					existente,
					tenant,
					dto.cliente,
					this.agora(),
				);

				await this.garantirUnicidade(tenant, atualizado, atualizado.id);

				// Processar endereços: substituir coleção do cliente
				const novosEnderecos: ClienteEndereco[] = (dto.enderecos || []).map(
					(end) => {
						const parsed = ClienteEnderecoInputSchema.parse(end);
						return ClienteEnderecoSchema.parse({
							...parsed,
							id: parsed.id ?? this.gerarId(),
							cliente_id: idValido,
						});
					},
				);

				// Processar contatos: substituir coleção do cliente
				const novosContatos: ClienteContato[] = (dto.contatos || []).map(
					(cont) => {
						const parsed = ClienteContatoInputSchema.parse(cont);
						return ClienteContatoSchema.parse({
							...parsed,
							id: parsed.id ?? this.gerarId(),
							cliente_id: idValido,
						});
					},
				);

				await Promise.all([
					this.db.clientes.put(atualizado),
					this.db.clientes_enderecos
						.where("cliente_id")
						.equals(idValido)
						.delete(),
					this.db.clientes_contatos
						.where("cliente_id")
						.equals(idValido)
						.delete(),
				]);

				if (novosEnderecos.length > 0) {
					await this.db.clientes_enderecos.bulkAdd(novosEnderecos);
				}
				if (novosContatos.length > 0) {
					await this.db.clientes_contatos.bulkAdd(novosContatos);
				}

				return {
					cliente: atualizado,
					enderecos: novosEnderecos,
					contatos: novosContatos,
				};
			},
		);
	}

	async inativar(tenantId: string, id: string): Promise<void> {
		const tenant = TenantIdSchema.parse(tenantId);
		const idValido = IdSchema.parse(id);

		await this.db.transaction("rw", this.db.clientes, async () => {
			const existente = await this.db.clientes.get(idValido);
			if (
				!existente ||
				existente.tenant_id !== tenant ||
				existente.deleted_at
			) {
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
			const existente = await this.db.clientes.get(idValido);
			if (!existente || existente.tenant_id !== tenant) {
				throw new ClienteNaoEncontradoError(idValido);
			}
			const reativado = reativarCliente(existente, tenant, this.agora());
			await this.garantirUnicidadeEntreAtivos(tenant, reativado, reativado.id);
			await this.db.clientes.put(reativado);
		});
	}

	private async garantirUnicidade(
		tenantId: string,
		dados: Pick<Cliente, "cnpj_cpf" | "razao_social" | "nome_fantasia">,
		idAtual: string,
	): Promise<void> {
		const todos = await this.db.clientes
			.where("tenant_id")
			.equals(tenantId)
			.filter((c) => c.id !== idAtual)
			.toArray();

		const razaoNorm = normalizarTextoComparacao(dados.razao_social);
		const fantasiaNorm =
			dados.nome_fantasia && dados.nome_fantasia.length > 0
				? normalizarTextoComparacao(dados.nome_fantasia)
				: null;

		// 1. Checa conflito com ativos
		for (const c of todos) {
			if (c.deleted_at === null) {
				if (c.cnpj_cpf === dados.cnpj_cpf) {
					throw new CpfCnpjDuplicadoError();
				}
				if (normalizarTextoComparacao(c.razao_social) === razaoNorm) {
					throw new RazaoSocialClienteDuplicadaError();
				}
				if (
					fantasiaNorm !== null &&
					c.nome_fantasia &&
					normalizarTextoComparacao(c.nome_fantasia) === fantasiaNorm
				) {
					throw new NomeFantasiaClienteDuplicadoError();
				}
			}
		}

		// 2. Checa conflito com inativos
		for (const c of todos) {
			if (c.deleted_at !== null) {
				if (c.cnpj_cpf === dados.cnpj_cpf) {
					throw new ClienteInativoExistenteError(c, "cnpj_cpf");
				}
				if (normalizarTextoComparacao(c.razao_social) === razaoNorm) {
					throw new ClienteInativoExistenteError(c, "razao_social");
				}
				if (
					fantasiaNorm !== null &&
					c.nome_fantasia &&
					normalizarTextoComparacao(c.nome_fantasia) === fantasiaNorm
				) {
					throw new ClienteInativoExistenteError(c, "nome_fantasia");
				}
			}
		}
	}

	private async garantirUnicidadeEntreAtivos(
		tenantId: string,
		dados: Pick<Cliente, "cnpj_cpf" | "razao_social" | "nome_fantasia">,
		idAtual: string,
	): Promise<void> {
		const ativos = await this.db.clientes
			.where("tenant_id")
			.equals(tenantId)
			.filter((c) => c.deleted_at === null && c.id !== idAtual)
			.toArray();

		const razaoNorm = normalizarTextoComparacao(dados.razao_social);
		const fantasiaNorm =
			dados.nome_fantasia && dados.nome_fantasia.length > 0
				? normalizarTextoComparacao(dados.nome_fantasia)
				: null;

		for (const c of ativos) {
			if (c.cnpj_cpf === dados.cnpj_cpf) {
				throw new CpfCnpjDuplicadoError();
			}
			if (normalizarTextoComparacao(c.razao_social) === razaoNorm) {
				throw new RazaoSocialClienteDuplicadaError();
			}
			if (
				fantasiaNorm !== null &&
				c.nome_fantasia &&
				normalizarTextoComparacao(c.nome_fantasia) === fantasiaNorm
			) {
				throw new NomeFantasiaClienteDuplicadoError();
			}
		}
	}
}

export const clienteRepository: ClienteRepository = new ClienteDexieAdapter();
