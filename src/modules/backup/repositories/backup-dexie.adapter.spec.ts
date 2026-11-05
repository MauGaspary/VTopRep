import { beforeEach, describe, expect, it } from "vitest";
import { AppDatabase, db } from "../../../db/database";
import { seedDatabase } from "../../../db/seed";
import { criarPedidoCompleto } from "../../pedidos/domain/pedido";
import { criarMutacaoParaRegistro } from "../../sync/domain/outbox";
import {
	BackupInvalidoError,
	lerArquivoBackup,
	serializarBackup,
	totalRegistros,
} from "../domain/backup";
import { TABELAS_BACKUP, type TabelasBackup } from "../domain/backup.schema";
import { BackupDexieAdapter } from "./backup-dexie.adapter";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const AGORA = "2026-11-04T15:30:00.000Z";

/**
 * Dados realistas: seed (representadas, catálogo, clientes) + um pedido com
 * itens, Outbox pendente e o mapeamento de colunas do CSV.
 */
async function popularTenant(tenantId: string): Promise<void> {
	await seedDatabase(db, tenantId);
	const [cliente] = await db.clientes
		.where("tenant_id")
		.equals(tenantId)
		.toArray();
	const [tabela] = await db.tabelas_preco
		.where("tenant_id")
		.equals(tenantId)
		.toArray();
	if (!cliente || !tabela) throw new Error("seed incompleto");
	const [produto] = await db.produtos
		.where("tenant_id")
		.equals(tenantId)
		.toArray();
	if (!produto) throw new Error("seed sem produtos");

	const { pedido, itens } = criarPedidoCompleto({
		tenantId,
		input: {
			cliente_id: cliente.id,
			representada_id: tabela.representada_id,
			tabela_id: tabela.id,
			condicao_pagamento: "30/60",
			tipo_frete: "CIF",
			itens: [
				{
					produto_id: produto.id,
					quantidade: 3,
					preco_unitario_tabela_centavos: 1999,
					percentual_desconto: 500,
				},
			],
		},
		percentualComissaoPadrao: 500,
		agora: AGORA,
	});
	await db.pedidos.add(pedido);
	await db.itens_pedido.bulkAdd(itens);
	await db.outbox.bulkAdd([
		criarMutacaoParaRegistro({
			tenantId,
			entity: "pedidos",
			registro: pedido,
			existiaAntes: false,
			agora: AGORA,
		}),
		{
			...criarMutacaoParaRegistro({
				tenantId,
				entity: "clientes",
				registro: cliente,
				existiaAntes: true,
				agora: AGORA,
			}),
			status: "syncing",
		},
	]);
	await db.mapeamentos_importacao.add({
		tenant_id: tenantId,
		representada_id: tabela.representada_id,
		colunas: {
			sku: "Código",
			descricao: "Descrição",
			unidade_medida: null,
			multiplo_embalagem: null,
			preco: "Preço",
		},
		updated_at: AGORA,
	});
}

describe("BackupDexieAdapter", () => {
	let adapter: BackupDexieAdapter;

	beforeEach(async () => {
		await Promise.all(db.tables.map((tabela) => tabela.clear()));
		adapter = new BackupDexieAdapter({ agora: () => AGORA });
	});

	it("cobre todas as tabelas do banco e grava a versão atual", () => {
		expect(db.tables.map((t) => t.name).sort()).toEqual(
			[...TABELAS_BACKUP].sort(),
		);
		expect(adapter.versaoBanco).toBe(11);
		expect(new AppDatabase("VersaoBackupTeste").verno).toBe(
			adapter.versaoBanco,
		);
	});

	it("exporta só os dados do tenant, inclusive Outbox e mapeamento de CSV", async () => {
		await popularTenant(TENANT);
		await popularTenant(OUTRO_TENANT);

		const backup = await adapter.exportar({
			tenantId: TENANT,
			tenantNome: "Vinitop RS",
		});

		expect(backup).toMatchObject({
			tenant_id: TENANT,
			tenant_nome: "Vinitop RS",
			versao_banco: 11,
			exportado_em: AGORA,
		});
		const contagem = await adapter.contar(TENANT);
		for (const tabela of TABELAS_BACKUP) {
			expect(backup.tabelas[tabela]).toHaveLength(contagem[tabela]);
			for (const registro of backup.tabelas[tabela]) {
				expect(registro.tenant_id).toBe(TENANT);
			}
		}
		expect(contagem.pedidos).toBe(1);
		expect(contagem.itens_pedido).toBe(1);
		expect(contagem.outbox).toBe(2);
		expect(contagem.mapeamentos_importacao).toBe(1);
		expect(contagem.clientes).toBeGreaterThan(0);
	});

	it("restaura num aparelho limpo exatamente o que foi exportado", async () => {
		await popularTenant(TENANT);
		const original = await adapter.exportar({
			tenantId: TENANT,
			tenantNome: "Vinitop RS",
		});
		const contagemOriginal = await adapter.contar(TENANT);
		const lido = lerArquivoBackup(serializarBackup(original), {
			tenantId: TENANT,
			versaoBanco: adapter.versaoBanco,
		});
		if (!lido.ok) throw new Error(lido.erro);

		await Promise.all(db.tables.map((tabela) => tabela.clear()));
		const restaurados = await adapter.restaurar(TENANT, lido.backup);

		expect(restaurados).toEqual(contagemOriginal);
		expect(await adapter.contar(TENANT)).toEqual(contagemOriginal);
		const novaExportacao = await adapter.exportar({
			tenantId: TENANT,
			tenantNome: "Vinitop RS",
		});
		const semOutbox = ({ outbox: _o, ...resto }: TabelasBackup) => resto;
		expect(semOutbox(novaExportacao.tabelas)).toEqual(
			semOutbox(original.tabelas),
		);
		// A mutação que estava "em envio" volta para a fila.
		expect(novaExportacao.tabelas.outbox.map((m) => m.status).sort()).toEqual([
			"pending",
			"pending",
		]);
	});

	it("substitui os dados do tenant sem tocar nos de outro tenant", async () => {
		await popularTenant(TENANT);
		const backup = await adapter.exportar({
			tenantId: TENANT,
			tenantNome: "Vinitop RS",
		});
		// Depois do backup: dados novos neste tenant e dados de outro tenant.
		await popularTenant(TENANT);
		await popularTenant(OUTRO_TENANT);
		const outroAntes = await adapter.contar(OUTRO_TENANT);

		await adapter.restaurar(TENANT, backup);

		const ids = (await db.clientes.where("tenant_id").equals(TENANT).toArray())
			.map((c) => c.id)
			.sort();
		expect(ids).toEqual(backup.tabelas.clientes.map((c) => c.id).sort());
		expect(await adapter.contar(OUTRO_TENANT)).toEqual(outroAntes);
	});

	it("é tudo ou nada: falha no meio não altera os dados locais", async () => {
		await popularTenant(TENANT);
		await popularTenant(OUTRO_TENANT);
		const backup = await adapter.exportar({
			tenantId: TENANT,
			tenantNome: "Vinitop RS",
		});
		const antes = await adapter.contar(TENANT);
		// Um item de pedido com o id de um registro de outro tenant: o `bulkAdd`
		// falha depois que as tabelas anteriores já foram substituídas.
		const [alheio] = await db.itens_pedido
			.where("tenant_id")
			.equals(OUTRO_TENANT)
			.toArray();
		const [item] = backup.tabelas.itens_pedido;
		if (!alheio || !item) throw new Error("fixture incompleta");
		const conflitante = {
			...backup,
			tabelas: {
				...backup.tabelas,
				itens_pedido: [{ ...item, id: alheio.id }],
			},
		};

		await expect(adapter.restaurar(TENANT, conflitante)).rejects.toThrow();
		expect(await adapter.contar(TENANT)).toEqual(antes);
	});

	it("recusa backup de outro tenant ou de outra versão do banco", async () => {
		await popularTenant(OUTRO_TENANT);
		const doOutro = await adapter.exportar({
			tenantId: OUTRO_TENANT,
			tenantNome: "Outra",
		});

		await expect(adapter.restaurar(TENANT, doOutro)).rejects.toBeInstanceOf(
			BackupInvalidoError,
		);
		await expect(
			adapter.restaurar(OUTRO_TENANT, { ...doOutro, versao_banco: 10 }),
		).rejects.toBeInstanceOf(BackupInvalidoError);
		await expect(
			adapter.exportar({ tenantId: "abc", tenantNome: "" }),
		).rejects.toThrow();
		expect(totalRegistros(await adapter.contar(TENANT))).toBe(0);
	});
});
