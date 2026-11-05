import type { IndexableType, Table } from "dexie";
import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import {
	BackupInvalidoError,
	contarRegistrosBackup,
	montarBackup,
	montarContagem,
	tabelasParaRestaurar,
	verificarIntegridadeBackup,
} from "../domain/backup";
import type {
	BackupLocal,
	ContagemBackup,
	TabelaBackup,
	TabelasBackup,
} from "../domain/backup.schema";
import type {
	BackupRepository,
	ExportarBackupParams,
} from "./backup.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");

interface BackupDexieAdapterOptions {
	database?: AppDatabase;
	agora?: () => string;
}

export class BackupDexieAdapter implements BackupRepository {
	private readonly db: AppDatabase;
	private readonly agora: () => string;

	constructor(options: BackupDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	get versaoBanco(): number {
		return this.db.verno;
	}

	/** Tabelas do Dexie cobertas pelo backup (todas as que têm `tenant_id`). */
	private tabelasDexie(): Table[] {
		const d = this.db;
		return [
			d.representadas,
			d.transportadoras,
			d.clientes,
			d.clientes_enderecos,
			d.clientes_contatos,
			d.clientes_metricas,
			d.produtos,
			d.tabelas_preco,
			d.itens_preco,
			d.pedidos,
			d.itens_pedido,
			d.outbox,
			d.mapeamentos_importacao,
		];
	}

	async exportar({
		tenantId,
		tenantNome,
	}: ExportarBackupParams): Promise<BackupLocal> {
		const tenant = TenantIdSchema.parse(tenantId);
		const d = this.db;
		const doTenant = <T, K extends IndexableType>(tabela: Table<T, K>) =>
			tabela.where("tenant_id").equals(tenant).toArray();

		// Leitura numa transação: o backup é uma foto consistente do banco.
		const tabelas = await d.transaction("r", this.tabelasDexie(), async () => ({
			representadas: await doTenant(d.representadas),
			transportadoras: await doTenant(d.transportadoras),
			clientes: await doTenant(d.clientes),
			clientes_enderecos: await doTenant(d.clientes_enderecos),
			clientes_contatos: await doTenant(d.clientes_contatos),
			clientes_metricas: await doTenant(d.clientes_metricas),
			produtos: await doTenant(d.produtos),
			tabelas_preco: await doTenant(d.tabelas_preco),
			itens_preco: await doTenant(d.itens_preco),
			pedidos: await doTenant(d.pedidos),
			itens_pedido: await doTenant(d.itens_pedido),
			outbox: await doTenant(d.outbox),
			mapeamentos_importacao: await doTenant(d.mapeamentos_importacao),
		}));

		return montarBackup({
			tenantId: tenant,
			tenantNome,
			versaoBanco: this.versaoBanco,
			agora: this.agora(),
			tabelas,
		});
	}

	async restaurar(
		tenantId: string,
		backup: BackupLocal,
	): Promise<ContagemBackup> {
		const tenant = TenantIdSchema.parse(tenantId);
		if (backup.tenant_id !== tenant) {
			throw new BackupInvalidoError(
				"Este backup é de outra empresa e não pode ser restaurado aqui.",
			);
		}
		if (backup.versao_banco !== this.versaoBanco) {
			throw new BackupInvalidoError(
				`Backup de outra versão do banco (v${backup.versao_banco}; este aparelho usa v${this.versaoBanco}).`,
			);
		}
		const tabelas: TabelasBackup = tabelasParaRestaurar(backup);
		const inconsistencia = verificarIntegridadeBackup(tabelas, tenant);
		if (inconsistencia) throw new BackupInvalidoError(inconsistencia);

		const d = this.db;
		const substituir = async <T, K extends IndexableType>(
			tabela: Table<T, K>,
			registros: readonly T[],
		) => {
			await tabela.where("tenant_id").equals(tenant).delete();
			if (registros.length > 0) await tabela.bulkAdd([...registros]);
		};

		// Tudo ou nada: qualquer falha desfaz as exclusões e inclusões.
		await d.transaction("rw", this.tabelasDexie(), async () => {
			await substituir(d.representadas, tabelas.representadas);
			await substituir(d.transportadoras, tabelas.transportadoras);
			await substituir(d.clientes, tabelas.clientes);
			await substituir(d.clientes_enderecos, tabelas.clientes_enderecos);
			await substituir(d.clientes_contatos, tabelas.clientes_contatos);
			await substituir(d.clientes_metricas, tabelas.clientes_metricas);
			await substituir(d.produtos, tabelas.produtos);
			await substituir(d.tabelas_preco, tabelas.tabelas_preco);
			await substituir(d.itens_preco, tabelas.itens_preco);
			await substituir(d.pedidos, tabelas.pedidos);
			await substituir(d.itens_pedido, tabelas.itens_pedido);
			await substituir(d.outbox, tabelas.outbox);
			await substituir(
				d.mapeamentos_importacao,
				tabelas.mapeamentos_importacao,
			);
		});

		return contarRegistrosBackup(tabelas);
	}

	async contar(tenantId: string): Promise<ContagemBackup> {
		const tenant = TenantIdSchema.parse(tenantId);
		const d = this.db;
		const contagens = await d.transaction(
			"r",
			this.tabelasDexie(),
			async () => {
				const resultado = new Map<TabelaBackup, number>();
				const contarTabela = async <T, K extends IndexableType>(
					nome: TabelaBackup,
					tabela: Table<T, K>,
				) => {
					resultado.set(
						nome,
						await tabela.where("tenant_id").equals(tenant).count(),
					);
				};
				await contarTabela("representadas", d.representadas);
				await contarTabela("transportadoras", d.transportadoras);
				await contarTabela("clientes", d.clientes);
				await contarTabela("clientes_enderecos", d.clientes_enderecos);
				await contarTabela("clientes_contatos", d.clientes_contatos);
				await contarTabela("clientes_metricas", d.clientes_metricas);
				await contarTabela("produtos", d.produtos);
				await contarTabela("tabelas_preco", d.tabelas_preco);
				await contarTabela("itens_preco", d.itens_preco);
				await contarTabela("pedidos", d.pedidos);
				await contarTabela("itens_pedido", d.itens_pedido);
				await contarTabela("outbox", d.outbox);
				await contarTabela("mapeamentos_importacao", d.mapeamentos_importacao);
				return resultado;
			},
		);
		return montarContagem((tabela) => contagens.get(tabela) ?? 0);
	}
}

export const backupRepository: BackupRepository = new BackupDexieAdapter();
