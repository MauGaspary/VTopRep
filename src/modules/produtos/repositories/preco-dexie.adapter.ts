import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import { DataSchema } from "../../../shared/domain/datas";
import type { ClienteTabelaPreco } from "../domain/cliente-tabela-preco.schema";
import {
	ClienteNaoVinculadoError,
	definirTabelaPadrao,
	escolherTabelaSugerida,
	listarTabelasVigentes,
	type ResolucaoPreco,
	type ResolucaoPrecosTabela,
	removerTabelaPadrao,
	resolverPreco,
	resolverPrecosDaTabela,
	TabelaPrecoNaoEncontradaError,
} from "../domain/preco";
import type { TabelaPreco } from "../domain/tabela-preco.schema";
import type { PrecoRepository } from "./preco.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface PrecoDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
}

/** Mais recente primeiro (LWW por `updated_at`). */
function porAtualizacaoDesc(a: ClienteTabelaPreco, b: ClienteTabelaPreco) {
	return b.updated_at.localeCompare(a.updated_at);
}

export class PrecoDexieAdapter implements PrecoRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;

	constructor(options: PrecoDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	async listarTabelasVigentes(
		tenantId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const repId = IdSchema.parse(representadaId);
		const dia = DataSchema.parse(data);

		const tabelas = await this.db.tabelas_preco
			.where("[tenant_id+representada_id]")
			.equals([tenant, repId])
			.toArray();
		return listarTabelasVigentes(tabelas, dia);
	}

	async obterTabelaSugerida(
		tenantId: string,
		clienteId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco | null> {
		const [vigentes, padrao] = await Promise.all([
			this.listarTabelasVigentes(tenantId, representadaId, data),
			this.obterTabelaPadraoCliente(tenantId, clienteId, representadaId),
		]);
		return escolherTabelaSugerida(vigentes, padrao?.tabela_id ?? null);
	}

	async obterTabelaPadraoCliente(
		tenantId: string,
		clienteId: string,
		representadaId: string,
	): Promise<ClienteTabelaPreco | null> {
		const vivas = await this.associacoesVivas(
			TenantIdSchema.parse(tenantId),
			IdSchema.parse(clienteId),
			IdSchema.parse(representadaId),
		);
		return vivas[0] ?? null;
	}

	async resolverPreco(
		tenantId: string,
		tabelaId: string,
		produtoId: string,
		data: string,
	): Promise<ResolucaoPreco> {
		const tenant = TenantIdSchema.parse(tenantId);
		const tabId = IdSchema.parse(tabelaId);
		const prodId = IdSchema.parse(produtoId);
		const dia = DataSchema.parse(data);

		const [tabela, itens] = await Promise.all([
			this.obterTabela(tenant, tabId),
			this.db.itens_preco
				.where("[tenant_id+tabela_id+produto_id]")
				.equals([tenant, tabId, prodId])
				.toArray(),
		]);
		return resolverPreco({
			tenantId: tenant,
			tabela,
			itens,
			produtoId: prodId,
			data: dia,
		});
	}

	async resolverPrecosDaTabela(
		tenantId: string,
		tabelaId: string,
		data: string,
	): Promise<ResolucaoPrecosTabela> {
		const tenant = TenantIdSchema.parse(tenantId);
		const tabId = IdSchema.parse(tabelaId);
		const dia = DataSchema.parse(data);

		const [tabela, itens] = await Promise.all([
			this.obterTabela(tenant, tabId),
			this.db.itens_preco
				.where("[tenant_id+tabela_id]")
				.equals([tenant, tabId])
				.toArray(),
		]);
		return resolverPrecosDaTabela({
			tenantId: tenant,
			tabela,
			itens,
			data: dia,
		});
	}

	async definirTabelaPadraoCliente(
		tenantId: string,
		clienteId: string,
		tabelaId: string,
	): Promise<ClienteTabelaPreco> {
		const tenant = TenantIdSchema.parse(tenantId);
		const cliId = IdSchema.parse(clienteId);
		const tabId = IdSchema.parse(tabelaId);

		return this.db.transaction(
			"rw",
			[this.db.clientes_tabelas_preco, this.db.tabelas_preco, this.db.clientes],
			async () => {
				const cliente = await this.db.clientes.get(cliId);
				if (
					!cliente ||
					cliente.tenant_id !== tenant ||
					cliente.deleted_at !== null
				) {
					throw new ClienteNaoVinculadoError(cliId);
				}

				const tabela = await this.obterTabela(tenant, tabId);
				if (!tabela) {
					throw new TabelaPrecoNaoEncontradaError(tabId);
				}

				const agora = this.agora();
				const [existente = null, ...duplicadas] = await this.associacoesVivas(
					tenant,
					cliId,
					tabela.representada_id,
				);
				const associacao = definirTabelaPadrao({
					existente,
					tenantId: tenant,
					clienteId: cliId,
					tabela,
					id: this.gerarId(),
					agora,
				});

				// Duas associações vivas só surgem de criações offline em aparelhos
				// diferentes; a definição explícita resolve o empate.
				const alteradas = duplicadas.map((d) =>
					removerTabelaPadrao(d, tenant, agora),
				);
				if (associacao !== existente) alteradas.push(associacao);
				if (alteradas.length > 0) {
					await this.db.clientes_tabelas_preco.bulkPut(alteradas);
				}
				return associacao;
			},
		);
	}

	async removerTabelaPadraoCliente(
		tenantId: string,
		clienteId: string,
		representadaId: string,
	): Promise<ClienteTabelaPreco | null> {
		const tenant = TenantIdSchema.parse(tenantId);
		const cliId = IdSchema.parse(clienteId);
		const repId = IdSchema.parse(representadaId);

		return this.db.transaction(
			"rw",
			this.db.clientes_tabelas_preco,
			async () => {
				const vivas = await this.associacoesVivas(tenant, cliId, repId);
				if (vivas.length === 0) return null;

				const agora = this.agora();
				const removidas = vivas.map((a) =>
					removerTabelaPadrao(a, tenant, agora),
				);
				await this.db.clientes_tabelas_preco.bulkPut(removidas);
				return removidas[0] ?? null;
			},
		);
	}

	/** Tabela do tenant e não excluída (pode estar inativa ou fora de vigência). */
	private async obterTabela(
		tenantId: string,
		tabelaId: string,
	): Promise<TabelaPreco | null> {
		const tabela = await this.db.tabelas_preco.get(tabelaId);
		if (
			!tabela ||
			tabela.tenant_id !== tenantId ||
			tabela.deleted_at !== null
		) {
			return null;
		}
		return tabela;
	}

	/** Associações vivas, da mais recente para a mais antiga. */
	private async associacoesVivas(
		tenantId: string,
		clienteId: string,
		representadaId: string,
	): Promise<ClienteTabelaPreco[]> {
		const associacoes = await this.db.clientes_tabelas_preco
			.where("[tenant_id+cliente_id+representada_id]")
			.equals([tenantId, clienteId, representadaId])
			.filter((a) => a.deleted_at === null)
			.toArray();
		return associacoes.sort(porAtualizacaoDesc);
	}
}

export const precoRepository: PrecoRepository = new PrecoDexieAdapter();
