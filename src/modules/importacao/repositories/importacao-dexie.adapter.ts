import type { Table } from "dexie";
import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import type { ItemPreco } from "../../produtos/domain/item-preco.schema";
import { RepresentadaNaoVinculadaError } from "../../produtos/domain/produto";
import { criarMutacaoParaRegistro } from "../../sync/domain/outbox";
import type { EntidadeSincronizavel } from "../../sync/domain/outbox.schema";
import {
	type ColunasMapeamentoSalvo,
	LinhaImportacaoSchema,
	type MapeamentoImportacaoSalvo,
	MapeamentoImportacaoSalvoSchema,
	OpcoesImportacaoSchema,
	type ResumoImportacao,
} from "../domain/importacao.schema";
import { planejarImportacao, type RegistroPlanejado } from "../domain/plano";
import type {
	ImportacaoRepository,
	ImportarProdutosParams,
} from "./importacao.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");
const LinhasSchema = z.array(LinhaImportacaoSchema);

/** Tamanho do lote de gravação: mantém cada `bulkPut` curto em arquivos grandes. */
export const TAMANHO_LOTE_IMPORTACAO = 500;

interface ImportacaoDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
}

export class ImportacaoDexieAdapter implements ImportacaoRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;

	constructor(options: ImportacaoDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	async obterMapeamento(
		tenantId: string,
		representadaId: string,
	): Promise<MapeamentoImportacaoSalvo | null> {
		const tenant = TenantIdSchema.parse(tenantId);
		const repId = IdSchema.parse(representadaId);
		const salvo = await this.db.mapeamentos_importacao.get([tenant, repId]);
		if (!salvo) return null;
		// Dado local antigo ou corrompido: ignora em vez de quebrar a tela.
		const valido = MapeamentoImportacaoSalvoSchema.safeParse(salvo);
		return valido.success ? valido.data : null;
	}

	async salvarMapeamento(
		tenantId: string,
		representadaId: string,
		colunas: ColunasMapeamentoSalvo,
	): Promise<void> {
		const registro = MapeamentoImportacaoSalvoSchema.parse({
			tenant_id: TenantIdSchema.parse(tenantId),
			representada_id: IdSchema.parse(representadaId),
			colunas,
			updated_at: this.agora(),
		});
		await this.db.mapeamentos_importacao.put(registro);
	}

	private async listarItensPrecoDaTabela(
		tenantId: string,
		tabelaId: string,
	): Promise<ItemPreco[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const id = IdSchema.parse(tabelaId);
		// `toArray()` + filtro em JS usa `getAll` (rápido); `.filter()` do Dexie
		// percorre um cursor, bem mais lento em tabelas com milhares de itens.
		const itens = await this.db.itens_preco
			.where("[tenant_id+tabela_id]")
			.equals([tenant, id])
			.toArray();
		return itens.filter((i) => i.deleted_at === null);
	}

	async importar(
		tenantId: string,
		{
			opcoes: opcoesBrutas,
			linhas: linhasBrutas,
			skusNoArquivo,
		}: ImportarProdutosParams,
	): Promise<ResumoImportacao> {
		const tenant = TenantIdSchema.parse(tenantId);
		const opcoes = OpcoesImportacaoSchema.parse(opcoesBrutas);
		const linhas = LinhasSchema.parse(linhasBrutas);
		const repId = opcoes.representada_id;
		const agora = this.agora();

		return this.db.transaction(
			"rw",
			[
				this.db.representadas,
				this.db.produtos,
				this.db.tabelas_preco,
				this.db.itens_preco,
				this.db.outbox,
			],
			async () => {
				const representada = await this.db.representadas.get(repId);
				if (
					!representada ||
					representada.tenant_id !== tenant ||
					representada.deleted_at !== null ||
					!representada.ativo
				) {
					throw new RepresentadaNaoVinculadaError(repId);
				}

				const [produtos, tabelas, itensTabelaDestino] = await Promise.all([
					this.db.produtos
						.where("tenant_id")
						.equals(tenant)
						.toArray()
						.then((lista) =>
							lista.filter(
								(p) => p.representada_id === repId && p.deleted_at === null,
							),
						),
					this.db.tabelas_preco
						.where("[tenant_id+representada_id]")
						.equals([tenant, repId])
						.toArray()
						.then((lista) => lista.filter((t) => t.deleted_at === null)),
					opcoes.destino?.tipo === "existente"
						? this.listarItensPrecoDaTabela(tenant, opcoes.destino.tabela_id)
						: Promise.resolve([]),
				]);

				const plano = planejarImportacao({
					tenantId: tenant,
					opcoes,
					linhas,
					skusNoArquivo,
					produtos,
					tabelas,
					itensTabelaDestino,
					agora,
					gerarId: this.gerarId,
				});

				await this.gravarEmLotes(
					tenant,
					"tabelas_preco",
					this.db.tabelas_preco,
					plano.tabelas,
					agora,
				);
				await this.gravarEmLotes(
					tenant,
					"produtos",
					this.db.produtos,
					plano.produtos,
					agora,
				);
				await this.gravarEmLotes(
					tenant,
					"itens_preco",
					this.db.itens_preco,
					plano.itensPreco,
					agora,
				);
				return plano.resumo;
			},
		);
	}

	/** Grava registros e as mutações da Outbox correspondentes, em lotes. */
	private async gravarEmLotes<T extends { id: string; tenant_id: string }>(
		tenantId: string,
		entity: EntidadeSincronizavel,
		tabela: Table<T, string>,
		registros: readonly RegistroPlanejado<T>[],
		agora: string,
	): Promise<void> {
		for (let i = 0; i < registros.length; i += TAMANHO_LOTE_IMPORTACAO) {
			const lote = registros.slice(i, i + TAMANHO_LOTE_IMPORTACAO);
			await tabela.bulkPut(lote.map((r) => r.registro));
			await this.db.outbox.bulkAdd(
				lote.map(({ registro, existiaAntes }) =>
					criarMutacaoParaRegistro({
						tenantId,
						entity,
						registro,
						existiaAntes,
						agora,
						gerarId: this.gerarId,
					}),
				),
			);
		}
	}
}

export const importacaoRepository: ImportacaoRepository =
	new ImportacaoDexieAdapter();
