import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import type { Representada } from "../../representadas/domain/representada.schema";
import type { LinhaImportacao } from "../domain/importacao.schema";
import { ImportacaoDexieAdapter } from "./importacao-dexie.adapter";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const REP = "33333333-3333-4333-a333-333333333333";
const CRIADO_EM = "2026-01-01T00:00:00.000Z";
const AGORA = "2026-11-04T12:00:00.000Z";

const representada = (extra: Partial<Representada> = {}): Representada => ({
	id: REP,
	tenant_id: TENANT,
	razao_social: "Fábrica LTDA",
	nome_fantasia: "Fábrica",
	cnpj: "11222333000181",
	percentual_comissao_padrao: 500,
	percentual_comissao_fabrica: 500,
	valor_pedido_minimo_centavos: 0,
	regras_frete_padrao: "CIF",
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...extra,
});

const produto = (sku: string, extra: Partial<Produto> = {}): Produto => ({
	id: crypto.randomUUID(),
	tenant_id: TENANT,
	representada_id: REP,
	sku,
	descricao: `Produto ${sku}`,
	unidade_medida: "UN",
	multiplo_embalagem: 1,
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...extra,
});

const tabela = (extra: Partial<TabelaPreco> = {}): TabelaPreco => ({
	id: crypto.randomUUID(),
	tenant_id: TENANT,
	representada_id: REP,
	nome_tabela: "Tabela 2026",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...extra,
});

const linha = (
	numero: number,
	sku: string,
	preco: number | null,
): LinhaImportacao => ({
	linha: numero,
	sku,
	descricao: `Produto ${sku}`,
	unidade_medida: null,
	multiplo_embalagem: null,
	preco_centavos: preco,
});

describe("ImportacaoDexieAdapter", () => {
	const adapter = new ImportacaoDexieAdapter({ agora: () => AGORA });

	beforeEach(async () => {
		await Promise.all(db.tables.map((t) => t.clear()));
		await db.representadas.add(representada());
	});

	describe("mapeamento", () => {
		it("salva e lê por tenant e representada", async () => {
			const colunas = {
				sku: "Código",
				descricao: "Descrição",
				unidade_medida: null,
				multiplo_embalagem: null,
				preco: "Preço",
			};
			expect(await adapter.obterMapeamento(TENANT, REP)).toBeNull();
			await adapter.salvarMapeamento(TENANT, REP, colunas);
			expect(await adapter.obterMapeamento(TENANT, REP)).toEqual({
				tenant_id: TENANT,
				representada_id: REP,
				colunas,
				updated_at: AGORA,
			});
			expect(await adapter.obterMapeamento(OUTRO_TENANT, REP)).toBeNull();
			// Não é dado de negócio: não vai para a Outbox
			expect(await db.outbox.count()).toBe(0);
		});

		it("ignora registro local inválido", async () => {
			await db.mapeamentos_importacao.put({
				tenant_id: TENANT,
				representada_id: REP,
				colunas: {
					sku: "",
					descricao: null,
					unidade_medida: null,
					multiplo_embalagem: null,
					preco: null,
				},
				updated_at: AGORA,
			});
			expect(await adapter.obterMapeamento(TENANT, REP)).toBeNull();
		});
	});

	describe("importar", () => {
		it("grava produtos, itens de preço e Outbox na tabela existente", async () => {
			const t = tabela();
			const existente = produto("A1");
			await db.tabelas_preco.add(t);
			await db.produtos.add(existente);

			const resumo = await adapter.importar(TENANT, {
				opcoes: {
					representada_id: REP,
					destino: { tipo: "existente", tabela_id: t.id },
					ausentes: "manter",
				},
				linhas: [linha(2, "A1", 1500), linha(3, "N1", 990)],
				skusNoArquivo: new Set(["A1", "N1"]),
			});

			expect(resumo).toMatchObject({
				criados: 1,
				precos_gravados: 2,
				tabela_id: t.id,
			});
			const novo = await db.produtos
				.where("[tenant_id+representada_id+sku]")
				.equals([TENANT, REP, "N1"])
				.first();
			expect(novo).toMatchObject({ descricao: "Produto N1", ativo: true });
			const itens = await db.itens_preco
				.where("[tenant_id+tabela_id]")
				.equals([TENANT, t.id])
				.toArray();
			expect(itens.map((i) => i.preco_base_centavos).sort()).toEqual([
				1500, 990,
			]);

			const outbox = await db.outbox.toArray();
			expect(outbox.map((m) => `${m.entity}:${m.action}`).sort()).toEqual([
				"itens_preco:INSERT",
				"itens_preco:INSERT",
				"produtos:INSERT",
			]);
			expect(outbox.every((m) => m.tenant_id === TENANT)).toBe(true);
		});

		it("cria nova tabela e encerra a substituída", async () => {
			const antiga = tabela();
			await db.tabelas_preco.add(antiga);

			const resumo = await adapter.importar(TENANT, {
				opcoes: {
					representada_id: REP,
					destino: {
						tipo: "nova",
						nome_tabela: "Tabela 2027",
						vigencia_inicio: "2027-01-01",
						vigencia_fim: null,
						substitui_tabela_id: antiga.id,
					},
					ausentes: "manter",
				},
				linhas: [linha(2, "A1", 100)],
				skusNoArquivo: new Set(["A1"]),
			});

			expect((await db.tabelas_preco.get(antiga.id))?.vigencia_fim).toBe(
				"2026-12-31",
			);
			const nova = resumo.tabela_id
				? await db.tabelas_preco.get(resumo.tabela_id)
				: undefined;
			expect(nova).toMatchObject({ nome_tabela: "Tabela 2027", ativo: true });
			const acoes = (await db.outbox.toArray())
				.filter((m) => m.entity === "tabelas_preco")
				.map((m) => m.action)
				.sort();
			expect(acoes).toEqual(["INSERT", "UPDATE"]);
		});

		it("não grava nada se o plano falhar (transação)", async () => {
			const inativa = tabela({ ativo: false });
			await db.tabelas_preco.add(inativa);
			await expect(
				adapter.importar(TENANT, {
					opcoes: {
						representada_id: REP,
						destino: { tipo: "existente", tabela_id: inativa.id },
						ausentes: "manter",
					},
					linhas: [linha(2, "A1", 100)],
					skusNoArquivo: new Set(["A1"]),
				}),
			).rejects.toThrow(/inativa/);
			expect(await db.produtos.count()).toBe(0);
			expect(await db.outbox.count()).toBe(0);
		});

		it("recusa representada de outro tenant ou inativa", async () => {
			const params = {
				opcoes: {
					representada_id: REP,
					destino: null,
					ausentes: "manter" as const,
				},
				linhas: [linha(2, "A1", null)],
				skusNoArquivo: new Set(["A1"]),
			};
			await expect(adapter.importar(OUTRO_TENANT, params)).rejects.toThrow(
				/não foi encontrada ou está inativa/,
			);
			await db.representadas.put(representada({ ativo: false }));
			await expect(adapter.importar(TENANT, params)).rejects.toThrow(
				/não foi encontrada ou está inativa/,
			);
		});

		it("recusa linhas com SKU não normalizado", async () => {
			await expect(
				adapter.importar(TENANT, {
					opcoes: { representada_id: REP, destino: null, ausentes: "manter" },
					linhas: [linha(2, "a1", null)],
					skusNoArquivo: new Set(["a1"]),
				}),
			).rejects.toThrow();
		});

		it("importa cerca de 5.000 linhas em lotes", {
			timeout: 60_000,
		}, async () => {
			const t = tabela();
			await db.tabelas_preco.add(t);
			const total = 5000;
			const linhas = Array.from({ length: total }, (_, i) =>
				linha(i + 2, `SKU-${String(i).padStart(5, "0")}`, 100 + i),
			);

			const resumo = await adapter.importar(TENANT, {
				opcoes: {
					representada_id: REP,
					destino: { tipo: "existente", tabela_id: t.id },
					ausentes: "manter",
				},
				linhas,
				skusNoArquivo: new Set(linhas.map((l) => l.sku)),
			});

			expect(resumo).toMatchObject({ criados: total, precos_gravados: total });
			expect(await db.produtos.count()).toBe(total);
			expect(await db.itens_preco.count()).toBe(total);
			expect(await db.outbox.count()).toBe(total * 2);

			// Mesma importação de novo: nada muda, nada a gravar
			await expect(
				adapter.importar(TENANT, {
					opcoes: {
						representada_id: REP,
						destino: { tipo: "existente", tabela_id: t.id },
						ausentes: "manter",
					},
					linhas,
					skusNoArquivo: new Set(linhas.map((l) => l.sku)),
				}),
			).rejects.toThrow(/Nada a gravar/);
		});

		// O `fake-indexeddb` é quadrático ao sobrescrever registros; no navegador
		// a atualização é linear (medição real na Fase 2.9.5). Aqui, 1.000 linhas.
		it("reimportação atualiza os itens de preço existentes", {
			timeout: 60_000,
		}, async () => {
			const t = tabela();
			await db.tabelas_preco.add(t);
			const linhas = Array.from({ length: 1000 }, (_, i) =>
				linha(i + 2, `SKU-${String(i).padStart(5, "0")}`, 100 + i),
			);
			const opcoes = {
				representada_id: REP,
				destino: { tipo: "existente" as const, tabela_id: t.id },
				ausentes: "manter" as const,
			};
			const skusNoArquivo = new Set(linhas.map((l) => l.sku));
			await adapter.importar(TENANT, { opcoes, linhas, skusNoArquivo });

			const segunda = await adapter.importar(TENANT, {
				opcoes,
				linhas: linhas.map((l) => ({
					...l,
					preco_centavos: (l.preco_centavos ?? 0) + 1,
				})),
				skusNoArquivo,
			});
			expect(segunda).toMatchObject({ criados: 0, precos_gravados: 1000 });
			expect(await db.itens_preco.count()).toBe(1000);
			const updates = await db.outbox
				.filter((m) => m.action === "UPDATE")
				.count();
			expect(updates).toBe(1000);
		});
	});
});
