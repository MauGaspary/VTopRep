import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import { DataSchema } from "../../../shared/domain/datas";
import { criarMutacaoParaRegistro } from "../../sync/domain/outbox";
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
	planejarReajusteTabela,
	type ReajusteTabelaInput,
	ReajusteTabelaInputSchema,
} from "../domain/reajuste-tabela";
import {
	listarTabelasEmUso,
	ordenarTabelasPreco,
} from "../domain/tabela-preco";
import type { TabelaPreco } from "../domain/tabela-preco.schema";
import type {
	PrecoCatalogo,
	PrecoRepository,
	ResultadoReajuste,
} from "./preco.repository";

export class TabelaOrigemIndisponivelError extends Error {
	constructor() {
		super("Tabela de origem não encontrada nesta conta.");
		this.name = "TabelaOrigemIndisponivelError";
	}
}

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface PrecoDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
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

	async listarItensDaTabela(
		tenantId: string,
		tabelaId: string,
	): Promise<Map<string, ItemPreco>> {
		const tenant = TenantIdSchema.parse(tenantId);
		const tabId = IdSchema.parse(tabelaId);
		const [tabela, itens] = await Promise.all([
			this.obterTabela(tenant, tabId),
			this.db.itens_preco
				.where("[tenant_id+tabela_id]")
				.equals([tenant, tabId])
				.toArray(),
		]);
		return tabela ? indexarItensPreco(itens, tabela) : new Map();
	}

	async reajustarTabela(
		tenantId: string,
		input: ReajusteTabelaInput,
	): Promise<ResultadoReajuste> {
		const tenant = TenantIdSchema.parse(tenantId);
		const dados = ReajusteTabelaInputSchema.parse(input);
		const agora = this.agora();

		return this.db.transaction(
			"rw",
			[this.db.tabelas_preco, this.db.itens_preco, this.db.outbox],
			async () => {
				const origem = await this.obterTabela(tenant, dados.tabela_origem_id);
				if (!origem) throw new TabelaOrigemIndisponivelError();
				const itensOrigem = await this.db.itens_preco
					.where("[tenant_id+tabela_id]")
					.equals([tenant, origem.id])
					.toArray();

				const plano = planejarReajusteTabela({
					tenantId: tenant,
					origem,
					itensOrigem,
					input: dados,
					agora,
					gerarId: this.gerarId,
				});

				const mutacao = <T extends { tenant_id: string }>(
					entity: "tabelas_preco" | "itens_preco",
					registro: T,
					existiaAntes: boolean,
				) =>
					criarMutacaoParaRegistro({
						tenantId: tenant,
						entity,
						registro,
						existiaAntes,
						agora,
						gerarId: this.gerarId,
					});

				const tabelas = [plano.novaTabela];
				const mutacoes = [mutacao("tabelas_preco", plano.novaTabela, false)];
				if (plano.origemEncerrada) {
					tabelas.push(plano.origemEncerrada);
					mutacoes.push(mutacao("tabelas_preco", plano.origemEncerrada, true));
				}
				for (const item of plano.itens) {
					mutacoes.push(mutacao("itens_preco", item, false));
				}

				await this.db.tabelas_preco.bulkPut(tabelas);
				await this.db.itens_preco.bulkAdd(plano.itens);
				await this.db.outbox.bulkAdd(mutacoes);

				return {
					tabela: plano.novaTabela,
					itens: plano.itens.length,
					origemEncerrada: plano.origemEncerrada,
				};
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
}

export const precoRepository: PrecoRepository = new PrecoDexieAdapter();
