import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import type { ItemPreco } from "../domain/item-preco.schema";
import type { TabelaPreco } from "../domain/tabela-preco.schema";
import { PrecoDexieAdapter } from "./preco-dexie.adapter";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const REPRESENTADA = "33333333-3333-4333-a333-333333333333";
const OUTRA_REPRESENTADA = "44444444-4444-4444-a444-444444444444";
const PRODUTO_A = "66666666-6666-4666-a666-666666666666";
const PRODUTO_B = "77777777-7777-4777-a777-777777777777";
const CRIADO_EM = "2026-01-01T00:00:00.000Z";
const AGORA = "2026-10-28T12:00:00.000Z";
const HOJE = "2026-10-28";

const tabela = (overrides: Partial<TabelaPreco> = {}): TabelaPreco => ({
	id: crypto.randomUUID(),
	tenant_id: TENANT,
	representada_id: REPRESENTADA,
	nome_tabela: "Tabela",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...overrides,
});

const itemPreco = (
	tabelaPreco: TabelaPreco,
	overrides: Partial<ItemPreco> = {},
): ItemPreco => ({
	id: crypto.randomUUID(),
	tenant_id: tabelaPreco.tenant_id,
	tabela_id: tabelaPreco.id,
	produto_id: PRODUTO_A,
	preco_base_centavos: 1000,
	desconto_maximo_permitido: 0,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...overrides,
});

describe("PrecoDexieAdapter", () => {
	const adapter = new PrecoDexieAdapter();

	beforeEach(async () => {
		await Promise.all([db.tabelas_preco.clear(), db.itens_preco.clear()]);
	});

	describe("listarTabelasVigentes", () => {
		it("lista só as tabelas vigentes da representada e do tenant", async () => {
			const recente = tabela({
				nome_tabela: "Recente",
				vigencia_inicio: "2026-06-01",
			});
			const antiga = tabela({ nome_tabela: "Antiga" });
			await db.tabelas_preco.bulkAdd([
				recente,
				antiga,
				tabela({ ativo: false }),
				tabela({ deleted_at: AGORA }),
				tabela({ vigencia_fim: "2026-02-01" }),
				tabela({ representada_id: OUTRA_REPRESENTADA }),
				tabela({ tenant_id: OUTRO_TENANT }),
			]);

			const vigentes = await adapter.listarTabelasVigentes(
				TENANT,
				REPRESENTADA,
				HOJE,
			);

			expect(vigentes.map((t) => t.nome_tabela)).toEqual(["Recente", "Antiga"]);
		});

		it("rejeita data fora do formato AAAA-MM-DD", async () => {
			await expect(
				adapter.listarTabelasVigentes(TENANT, REPRESENTADA, "28/10/2026"),
			).rejects.toThrow();
		});
	});

	describe("resolverPreco", () => {
		it("busca o preço do produto na tabela pelo índice composto", async () => {
			const t = tabela();
			await db.tabelas_preco.add(t);
			await db.itens_preco.bulkAdd([
				itemPreco(t, { preco_base_centavos: 4990 }),
				itemPreco(t, { produto_id: PRODUTO_B, preco_base_centavos: 100 }),
			]);

			expect(
				await adapter.resolverPreco(TENANT, t.id, PRODUTO_A, HOJE),
			).toEqual({
				ok: true,
				preco: {
					tabela_id: t.id,
					produto_id: PRODUTO_A,
					preco_base_centavos: 4990,
					desconto_maximo_permitido: 0,
				},
			});
		});

		it("informa o motivo quando não há preço", async () => {
			const vencida = tabela({ vigencia_fim: "2026-02-01" });
			const vazia = tabela();
			await db.tabelas_preco.bulkAdd([vencida, vazia]);
			await db.itens_preco.add(itemPreco(vencida));

			expect(
				await adapter.resolverPreco(TENANT, vencida.id, PRODUTO_A, HOJE),
			).toEqual({ ok: false, motivo: "fora_de_vigencia" });
			expect(
				await adapter.resolverPreco(TENANT, vazia.id, PRODUTO_A, HOJE),
			).toEqual({ ok: false, motivo: "produto_sem_preco" });
		});

		it("não enxerga tabela de outro tenant", async () => {
			const alheia = tabela({ tenant_id: OUTRO_TENANT });
			await db.tabelas_preco.add(alheia);
			await db.itens_preco.add(itemPreco(alheia));

			expect(
				await adapter.resolverPreco(TENANT, alheia.id, PRODUTO_A, HOJE),
			).toEqual({ ok: false, motivo: "tabela_nao_encontrada" });
		});
	});

	describe("resolverPrecosDaTabela", () => {
		it("devolve os preços vivos por produto", async () => {
			const t = tabela();
			await db.tabelas_preco.add(t);
			await db.itens_preco.bulkAdd([
				itemPreco(t, { preco_base_centavos: 100 }),
				itemPreco(t, { produto_id: PRODUTO_B, deleted_at: AGORA }),
			]);

			const resultado = await adapter.resolverPrecosDaTabela(
				TENANT,
				t.id,
				HOJE,
			);

			expect(resultado.ok).toBe(true);
			if (!resultado.ok) return;
			expect([...resultado.precos.keys()]).toEqual([PRODUTO_A]);
		});
	});

	describe("obterTabelaSugerida", () => {
		it("sugere a vigente de início mais recente da representada", async () => {
			const antiga = tabela({ vigencia_inicio: "2025-01-01" });
			const recente = tabela({ vigencia_inicio: "2026-06-01" });
			const futura = tabela({ vigencia_inicio: "2027-01-01" });
			const outraRep = tabela({
				representada_id: OUTRA_REPRESENTADA,
				vigencia_inicio: "2026-09-01",
			});
			const outroTenant = tabela({
				tenant_id: OUTRO_TENANT,
				vigencia_inicio: "2026-10-01",
			});
			await db.tabelas_preco.bulkAdd([
				antiga,
				recente,
				futura,
				outraRep,
				outroTenant,
			]);

			expect(
				(await adapter.obterTabelaSugerida(TENANT, REPRESENTADA, HOJE))?.id,
			).toBe(recente.id);
		});

		it("sem tabela vigente, não sugere nenhuma", async () => {
			await db.tabelas_preco.add(tabela({ ativo: false }));
			expect(
				await adapter.obterTabelaSugerida(TENANT, REPRESENTADA, HOJE),
			).toBeNull();
		});
	});

	describe("listagens de tabelas e resolução do catálogo", () => {
		it("lista tabelas da representada, tabelas em uso, itens do produto e preços do catálogo", async () => {
			const vigente = tabela({
				nome_tabela: "Tabela Padrão",
				vigencia_inicio: "2026-01-01",
			});
			const futura = tabela({
				nome_tabela: "Tabela 2027",
				vigencia_inicio: "2027-01-01",
			});
			const inativa = tabela({
				nome_tabela: "Tabela Antiga",
				ativo: false,
			});
			await db.tabelas_preco.bulkAdd([inativa, futura, vigente]);
			await db.itens_preco.bulkAdd([
				itemPreco(vigente, {
					produto_id: PRODUTO_A,
					preco_base_centavos: 3500,
					desconto_maximo_permitido: 1000,
				}),
				itemPreco(futura, {
					produto_id: PRODUTO_A,
					preco_base_centavos: 3900,
				}),
			]);

			const todasDaRep = await adapter.listarTabelasDaRepresentada(
				TENANT,
				REPRESENTADA,
			);
			expect(todasDaRep.map((t) => t.nome_tabela)).toEqual([
				"Tabela 2027",
				"Tabela Padrão",
				"Tabela Antiga",
			]);

			const emUso = await adapter.listarTabelasEmUso(
				TENANT,
				REPRESENTADA,
				HOJE,
			);
			expect(emUso.map((t) => t.nome_tabela)).toEqual([
				"Tabela Padrão",
				"Tabela 2027",
			]);

			const itensDoProd = await adapter.obterItensPrecoDoProduto(
				TENANT,
				PRODUTO_A,
			);
			expect(itensDoProd.size).toBe(2);
			expect(itensDoProd.get(vigente.id)?.preco_base_centavos).toBe(3500);

			const precosCatalogo = await adapter.resolverPrecosCatalogo(TENANT, HOJE);
			expect(precosCatalogo.get(PRODUTO_A)).toEqual({
				tabela_id: vigente.id,
				nome_tabela: "Tabela Padrão",
				preco_base_centavos: 3500,
				desconto_maximo_permitido: 1000,
			});
		});

		it("lista tabelas disponíveis por representada", async () => {
			const tabRep1 = tabela({
				representada_id: REPRESENTADA,
				nome_tabela: "Atacado Rep 1",
			});
			const tabRep2 = tabela({
				representada_id: OUTRA_REPRESENTADA,
				nome_tabela: "Padrão Rep 2",
			});
			const tabInativa = tabela({
				representada_id: REPRESENTADA,
				nome_tabela: "Inativa",
				ativo: false,
			});
			await db.tabelas_preco.bulkAdd([tabRep1, tabRep2, tabInativa]);

			const disponiveisPorRep =
				await adapter.listarTabelasDisponiveisPorRepresentada(TENANT);
			expect(disponiveisPorRep.get(REPRESENTADA)?.map((t) => t.id)).toEqual([
				tabRep1.id,
			]);
			expect(
				disponiveisPorRep.get(OUTRA_REPRESENTADA)?.map((t) => t.id),
			).toEqual([tabRep2.id]);
		});
	});
});
