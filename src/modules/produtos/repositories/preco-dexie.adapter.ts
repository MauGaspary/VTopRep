import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import { DataSchema } from "../../../shared/domain/datas";
import type { ItemPreco } from "../domain/item-preco.schema";
import {
	escolherTabelaSugerida,
	indexarItensPreco,
	indexarItensPrecoDoProduto,
	listarTabelasVigentes,
	type ResolucaoPreco,
	type ResolucaoPrecosTabela,
	resolverPreco,
	resolverPrecosDaTabela,
	tabelaDisponivel,
} from "../domain/preco";
import {
	listarTabelasEmUso,
	ordenarTabelasPreco,
} from "../domain/tabela-preco";
import type { TabelaPreco } from "../domain/tabela-preco.schema";
import type { PrecoCatalogo, PrecoRepository } from "./preco.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface PrecoDexieAdapterOptions {
	database?: AppDatabase;
}

export class PrecoDexieAdapter implements PrecoRepository {
	private readonly db: AppDatabase;

	constructor(options: PrecoDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
	}

	async listarTabelasDaRepresentada(
		tenantId: string,
		representadaId: string,
	): Promise<TabelaPreco[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const repId = IdSchema.parse(representadaId);

		const tabelas = await this.db.tabelas_preco
			.where("[tenant_id+representada_id]")
			.equals([tenant, repId])
			.filter((t) => t.deleted_at === null)
			.toArray();
		return ordenarTabelasPreco(tabelas);
	}

	async listarTabelasEmUso(
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
		return listarTabelasEmUso(tabelas, dia);
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

	async obterItensPrecoDoProduto(
		tenantId: string,
		produtoId: string,
	): Promise<Map<string, ItemPreco>> {
		const tenant = TenantIdSchema.parse(tenantId);
		const prodId = IdSchema.parse(produtoId);

		const itens = await this.db.itens_preco
			.where("[tenant_id+produto_id]")
			.equals([tenant, prodId])
			.toArray();
		return indexarItensPrecoDoProduto(itens, tenant, prodId);
	}

	async resolverPrecosCatalogo(
		tenantId: string,
		data: string,
	): Promise<Map<string, PrecoCatalogo>> {
		const tenant = TenantIdSchema.parse(tenantId);
		const dia = DataSchema.parse(data);

		const [todasTabelas, todosItens] = await Promise.all([
			this.db.tabelas_preco.where("tenant_id").equals(tenant).toArray(),
			this.db.itens_preco.where("tenant_id").equals(tenant).toArray(),
		]);

		const vigentes = listarTabelasVigentes(todasTabelas, dia);
		const resultado = new Map<string, PrecoCatalogo>();

		for (const tabela of vigentes) {
			const itensDaTabela = indexarItensPreco(todosItens, tabela);
			for (const [produtoId, item] of itensDaTabela.entries()) {
				if (!resultado.has(produtoId)) {
					resultado.set(produtoId, {
						tabela_id: tabela.id,
						nome_tabela: tabela.nome_tabela,
						preco_base_centavos: item.preco_base_centavos,
						desconto_maximo_permitido: item.desconto_maximo_permitido,
					});
				}
			}
		}

		return resultado;
	}

	async obterTabelaSugerida(
		tenantId: string,
		representadaId: string,
		data: string,
	): Promise<TabelaPreco | null> {
		return escolherTabelaSugerida(
			await this.listarTabelasVigentes(tenantId, representadaId, data),
		);
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

	async listarTabelasDisponiveisPorRepresentada(
		tenantId: string,
	): Promise<Map<string, TabelaPreco[]>> {
		const tenant = TenantIdSchema.parse(tenantId);
		const todas = await this.db.tabelas_preco
			.where("tenant_id")
			.equals(tenant)
			.filter((t) => tabelaDisponivel(t))
			.toArray();

		const porRepresentada = new Map<string, TabelaPreco[]>();
		for (const tabela of ordenarTabelasPreco(todas)) {
			const lista = porRepresentada.get(tabela.representada_id) ?? [];
			lista.push(tabela);
			porRepresentada.set(tabela.representada_id, lista);
		}
		return porRepresentada;
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
}

export const precoRepository: PrecoRepository = new PrecoDexieAdapter();
