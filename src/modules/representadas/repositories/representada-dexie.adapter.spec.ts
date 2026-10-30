import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import {
	CnpjDuplicadoError,
	RepresentadaInativaExistenteError,
	RepresentadaNaoEncontradaError,
} from "../domain/representada";
import type { RepresentadaInput } from "../domain/representada.schema";
import { RepresentadaDexieAdapter } from "./representada-dexie.adapter";

const TENANT_1 = "11111111-1111-4111-a111-111111111111";
const TENANT_2 = "22222222-2222-4222-a222-222222222222";
const CNPJ_A = "11.222.333/0001-81";
const CNPJ_B = "12.ABC.345/01DE-35";

const input = (
	overrides: Partial<RepresentadaInput> = {},
): RepresentadaInput => ({
	razao_social: "Fábrica Alfa Ltda",
	nome_fantasia: "Alfa",
	cnpj: CNPJ_A,
	percentual_comissao_padrao: 500,
	valor_pedido_minimo_centavos: 100000,
	regras_frete_padrao: "CIF",
	...overrides,
});

describe("RepresentadaDexieAdapter", () => {
	let relogio: number;
	let adapter: RepresentadaDexieAdapter;

	beforeEach(async () => {
		await db.representadas.clear();
		await db.tabelas_preco.clear();
		relogio = Date.UTC(2026, 9, 22, 12, 0, 0);
		adapter = new RepresentadaDexieAdapter({
			agora: () => {
				relogio += 1000;
				return new Date(relogio).toISOString();
			},
		});
	});

	describe("criar", () => {
		it("persiste a representada validada com tenant_id", async () => {
			const criada = await adapter.criar(TENANT_1, input());

			const salva = await db.representadas.get(criada.id);
			expect(salva).toEqual(criada);
			expect(salva?.tenant_id).toBe(TENANT_1);
			expect(salva?.cnpj).toBe("11222333000181");
			expect(salva?.deleted_at).toBeNull();
		});

		it("rejeita input inválido sem persistir", async () => {
			await expect(
				adapter.criar(TENANT_1, input({ cnpj: "11.222.333/0001-00" })),
			).rejects.toThrow();
			expect(await db.representadas.count()).toBe(0);
		});

		it("rejeita tenantId inválido", async () => {
			await expect(adapter.criar("", input())).rejects.toThrow();
			await expect(adapter.criar("abc", input())).rejects.toThrow();
		});

		it("bloqueia CNPJ duplicado no mesmo tenant (mesmo com outra formatação)", async () => {
			await adapter.criar(TENANT_1, input());
			await expect(
				adapter.criar(
					TENANT_1,
					input({
						cnpj: "11222333000181",
						nome_fantasia: "Outro Nome",
						razao_social: "Outra Razão Social",
					}),
				),
			).rejects.toBeInstanceOf(CnpjDuplicadoError);
			expect(await db.representadas.count()).toBe(1);
		});

		it("permite razão social e nome fantasia repetidos com CNPJ diferente (filiais)", async () => {
			await adapter.criar(TENANT_1, input());
			await expect(
				adapter.criar(
					TENANT_1,
					input({
						cnpj: CNPJ_B,
						razao_social: "fábrica alfa ltda",
						nome_fantasia: "ALFA",
					}),
				),
			).resolves.toBeDefined();
			expect(await db.representadas.count()).toBe(2);
		});

		it("permite o mesmo CNPJ, Razão Social ou Nome Fantasia em tenants diferentes", async () => {
			await adapter.criar(TENANT_1, input());
			await expect(adapter.criar(TENANT_2, input())).resolves.toBeDefined();
		});

		it("oferece reativação se existir representada inativa com o mesmo CNPJ", async () => {
			const original = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, original.id);

			const erro = await adapter
				.criar(
					TENANT_1,
					input({
						cnpj: CNPJ_A,
						nome_fantasia: "Outro Nome",
						razao_social: "Outra Razão",
					}),
				)
				.catch((e: unknown) => e);
			expect(erro).toBeInstanceOf(RepresentadaInativaExistenteError);
			if (erro instanceof RepresentadaInativaExistenteError) {
				expect(erro.representadaInativa.id).toBe(original.id);
			}

			// Nomes iguais aos da inativa não bloqueiam
			await expect(
				adapter.criar(TENANT_1, input({ cnpj: CNPJ_B })),
			).resolves.toBeDefined();
		});
	});

	describe("listar", () => {
		it("retorna apenas ativas do tenant, ordenadas por nome fantasia", async () => {
			await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Zeta",
					razao_social: "Zeta Ltda",
					cnpj: CNPJ_A,
				}),
			);
			const inativa = await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Beta",
					razao_social: "Beta Ltda",
					cnpj: CNPJ_B,
				}),
			);
			await adapter.inativar(TENANT_1, inativa.id);
			await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Ácido",
					razao_social: "Ácido Ltda",
					cnpj: "44.555.666/0001-81",
				}),
			);
			await adapter.criar(TENANT_2, input({ nome_fantasia: "Outro tenant" }));

			const lista = await adapter.listar(TENANT_1);
			expect(lista.map((r) => r.nome_fantasia)).toEqual(["Ácido", "Zeta"]);
		});

		it("filtra por termo de busca", async () => {
			await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Calçados Sul",
					razao_social: "Calçados Sul Ltda",
					cnpj: CNPJ_A,
				}),
			);
			await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Têxtil Norte",
					razao_social: "Têxtil Norte Ltda",
					cnpj: CNPJ_B,
				}),
			);

			expect(
				(await adapter.listar(TENANT_1, "calcados")).map(
					(r) => r.nome_fantasia,
				),
			).toEqual(["Calçados Sul"]);
			expect(
				(await adapter.listar(TENANT_1, "ABC")).map((r) => r.nome_fantasia),
			).toEqual(["Têxtil Norte"]);
		});

		it("rejeita tenantId inválido", async () => {
			await expect(adapter.listar("")).rejects.toThrow();
		});
	});

	describe("listarTodas", () => {
		it("retorna ativas e inativas, com inativas no final", async () => {
			await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Zeta Ativa",
					razao_social: "Zeta Ativa Ltda",
					cnpj: CNPJ_A,
				}),
			);
			const inativa = await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Alfa Inativa",
					razao_social: "Alfa Inativa Ltda",
					cnpj: CNPJ_B,
				}),
			);
			await adapter.inativar(TENANT_1, inativa.id);
			await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Beta Ativa",
					razao_social: "Beta Ativa Ltda",
					cnpj: "44.555.666/0001-81",
				}),
			);

			const lista = await adapter.listarTodas(TENANT_1);
			expect(lista.map((r) => r.nome_fantasia)).toEqual([
				"Beta Ativa",
				"Zeta Ativa",
				"Alfa Inativa",
			]);
			expect(lista[2].ativo).toBe(false);
		});
	});

	describe("obterPorId", () => {
		it("retorna a representada do tenant", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			expect(await adapter.obterPorId(TENANT_1, criada.id)).toEqual(criada);
		});

		it("não vaza registros de outro tenant nem inativos", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			expect(await adapter.obterPorId(TENANT_2, criada.id)).toBeUndefined();

			await adapter.inativar(TENANT_1, criada.id);
			expect(await adapter.obterPorId(TENANT_1, criada.id)).toBeUndefined();
		});
	});

	describe("atualizar", () => {
		it("atualiza campos preservando created_at e avançando updated_at", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			const atualizada = await adapter.atualizar(
				TENANT_1,
				criada.id,
				input({ nome_fantasia: "Alfa Nova", percentual_comissao_padrao: 750 }),
			);

			expect(atualizada.nome_fantasia).toBe("Alfa Nova");
			expect(atualizada.percentual_comissao_padrao).toBe(750);
			expect(atualizada.created_at).toBe(criada.created_at);
			expect(atualizada.updated_at > criada.updated_at).toBe(true);
			expect(await db.representadas.get(criada.id)).toEqual(atualizada);
		});

		it("permite manter o próprio CNPJ", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await expect(
				adapter.atualizar(TENANT_1, criada.id, input({ razao_social: "Nova" })),
			).resolves.toBeDefined();
		});

		it("bloqueia troca para CNPJ de outra representada ativa", async () => {
			await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Alfa 1",
					razao_social: "Alfa 1 Ltda",
					cnpj: CNPJ_A,
				}),
			);
			const segunda = await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Alfa 2",
					razao_social: "Alfa 2 Ltda",
					cnpj: CNPJ_B,
				}),
			);
			await expect(
				adapter.atualizar(
					TENANT_1,
					segunda.id,
					input({
						nome_fantasia: "Alfa 2",
						razao_social: "Alfa 2 Ltda",
						cnpj: CNPJ_A,
					}),
				),
			).rejects.toBeInstanceOf(CnpjDuplicadoError);
		});

		it("não permite atualizar registro de outro tenant", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await expect(
				adapter.atualizar(TENANT_2, criada.id, input()),
			).rejects.toBeInstanceOf(RepresentadaNaoEncontradaError);
			expect((await db.representadas.get(criada.id))?.tenant_id).toBe(TENANT_1);
		});
	});

	describe("inativar", () => {
		it("marca ativo = false mantendo o registro sem tombstone", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, criada.id);

			const salvo = await db.representadas.get(criada.id);
			expect(salvo).toBeDefined();
			expect(salvo?.ativo).toBe(false);
			expect(salvo?.deleted_at).toBeNull();
		});

		it("não permite inativar registro de outro tenant", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await expect(
				adapter.inativar(TENANT_2, criada.id),
			).rejects.toBeInstanceOf(RepresentadaNaoEncontradaError);
			expect((await db.representadas.get(criada.id))?.ativo).toBe(true);
		});

		it("falha para id inexistente", async () => {
			await expect(
				adapter.inativar(TENANT_1, crypto.randomUUID()),
			).rejects.toBeInstanceOf(RepresentadaNaoEncontradaError);
		});
	});

	describe("reativar", () => {
		it("marca ativo = true reativando a representada", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, criada.id);

			expect((await db.representadas.get(criada.id))?.ativo).toBe(false);

			await adapter.reativar(TENANT_1, criada.id);

			const reativada = await db.representadas.get(criada.id);
			expect(reativada?.ativo).toBe(true);
		});

		it("bloqueia reativação se outra ativa já tiver o mesmo CNPJ", async () => {
			const primeira = await adapter.criar(TENANT_1, input({ cnpj: CNPJ_A }));
			await adapter.inativar(TENANT_1, primeira.id);

			// Ex.: chegou via sincronização uma segunda ativa com o mesmo CNPJ
			const agora = new Date().toISOString();
			await db.representadas.add({
				id: crypto.randomUUID(),
				tenant_id: TENANT_1,
				cnpj: "11222333000181",
				nome_fantasia: "Outra",
				razao_social: "Outra Razão Ltda",
				percentual_comissao_padrao: 500,
				percentual_comissao_fabrica: 500,
				valor_pedido_minimo_centavos: 100000,
				regras_frete_padrao: "CIF",
				ativo: true,
				created_at: agora,
				updated_at: agora,
				deleted_at: null,
			});

			await expect(
				adapter.reativar(TENANT_1, primeira.id),
			).rejects.toBeInstanceOf(CnpjDuplicadoError);
		});

		it("permite reativar mesmo havendo outra ativa com o mesmo nome", async () => {
			const primeira = await adapter.criar(TENANT_1, input({ cnpj: CNPJ_A }));
			await adapter.inativar(TENANT_1, primeira.id);
			await adapter.criar(TENANT_1, input({ cnpj: CNPJ_B }));

			await expect(
				adapter.reativar(TENANT_1, primeira.id),
			).resolves.toBeUndefined();
		});
	});

	describe("registros excluídos (tombstone)", () => {
		it("somem de listagens e consultas e não bloqueiam o CNPJ", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await db.representadas.update(criada.id, {
				deleted_at: new Date().toISOString(),
			});

			expect(await adapter.listarTodas(TENANT_1)).toEqual([]);
			expect(
				await adapter.obterPorId(TENANT_1, criada.id, true),
			).toBeUndefined();
			await expect(adapter.criar(TENANT_1, input())).resolves.toBeDefined();
		});
	});

	describe("tabelas de preço da representada", () => {
		it("cria automaticamente a Tabela Padrão vigente quando tabelasInput é omitido", async () => {
			const criada = await adapter.criar(TENANT_1, input());

			const tabelas = await db.tabelas_preco
				.where("[tenant_id+representada_id]")
				.equals([TENANT_1, criada.id])
				.toArray();
			expect(tabelas).toHaveLength(1);
			expect(tabelas[0]).toMatchObject({
				tenant_id: TENANT_1,
				representada_id: criada.id,
				nome_tabela: "Tabela Padrão",
				vigencia_fim: null,
				ativo: true,
				deleted_at: null,
			});
		});

		it("persiste e reconcilia tabelas customizadas no criar e atualizar", async () => {
			const criada = await adapter.criar(TENANT_1, input(), [
				{
					nome_tabela: "Tabela Atacado",
					vigencia_inicio: "2026-01-01",
					vigencia_fim: null,
					ativo: true,
				},
			]);

			const [atacado] = await db.tabelas_preco
				.where("[tenant_id+representada_id]")
				.equals([TENANT_1, criada.id])
				.toArray();
			expect(atacado?.nome_tabela).toBe("Tabela Atacado");

			await adapter.atualizar(TENANT_1, criada.id, input(), [
				{
					id: atacado?.id,
					nome_tabela: "Tabela Atacado Sul",
					vigencia_inicio: "2026-01-01",
					vigencia_fim: null,
					ativo: true,
				},
				{
					nome_tabela: "Tabela Varejo",
					vigencia_inicio: "2026-06-01",
					vigencia_fim: "2026-12-31",
					ativo: true,
				},
			]);

			const atualizadas = await db.tabelas_preco
				.where("[tenant_id+representada_id]")
				.equals([TENANT_1, criada.id])
				.toArray();
			expect(atualizadas.map((t) => t.nome_tabela).sort()).toEqual([
				"Tabela Atacado Sul",
				"Tabela Varejo",
			]);
		});
	});
});
