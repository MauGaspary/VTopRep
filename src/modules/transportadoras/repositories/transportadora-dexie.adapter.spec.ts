import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import {
	CnpjTransportadoraDuplicadoError,
	TransportadoraInativaExistenteError,
	TransportadoraNaoEncontradaError,
} from "../domain/transportadora";
import type { TransportadoraInput } from "../domain/transportadora.schema";
import { TransportadoraDexieAdapter } from "./transportadora-dexie.adapter";

const TENANT_1 = "11111111-1111-4111-a111-111111111111";
const TENANT_2 = "22222222-2222-4222-a222-222222222222";
const CNPJ_A = "11.222.333/0001-81";

const input = (
	overrides: Partial<TransportadoraInput> = {},
): TransportadoraInput => ({
	nome_fantasia: "Rodo Sul",
	razao_social: "Rodo Sul Transportes Ltda",
	cnpj: CNPJ_A,
	telefone: "(54) 3333-0000",
	cidade_uf: "Caxias do Sul/RS",
	...overrides,
});

describe("TransportadoraDexieAdapter", () => {
	let relogio: number;
	let adapter: TransportadoraDexieAdapter;

	beforeEach(async () => {
		await db.transportadoras.clear();
		await db.outbox.clear();
		relogio = Date.UTC(2026, 10, 3, 12, 0, 0);
		adapter = new TransportadoraDexieAdapter({
			agora: () => {
				relogio += 1000;
				return new Date(relogio).toISOString();
			},
		});
	});

	describe("criar", () => {
		it("persiste com tenant_id e registra INSERT na outbox", async () => {
			const criada = await adapter.criar(TENANT_1, input());

			const salva = await db.transportadoras.get(criada.id);
			expect(salva).toEqual(criada);
			expect(salva?.cnpj).toBe("11222333000181");

			const fila = await db.outbox.toArray();
			expect(fila).toHaveLength(1);
			expect(fila[0]).toMatchObject({
				tenant_id: TENANT_1,
				entity: "transportadoras",
				action: "INSERT",
				status: "pending",
			});
			expect(fila[0]?.payload.id).toBe(criada.id);
			expect(fila[0]?.payload.tenant_id).toBe(TENANT_1);
		});

		it("rejeita input inválido e tenant inválido sem persistir nada", async () => {
			await expect(
				adapter.criar(TENANT_1, input({ cnpj: "11.222.333/0001-00" })),
			).rejects.toThrow();
			await expect(adapter.criar("abc", input())).rejects.toThrow();
			expect(await db.transportadoras.count()).toBe(0);
			expect(await db.outbox.count()).toBe(0);
		});

		it("bloqueia CNPJ duplicado no mesmo tenant, sem gravar outbox", async () => {
			await adapter.criar(TENANT_1, input());
			await expect(
				adapter.criar(
					TENANT_1,
					input({ nome_fantasia: "Outra", cnpj: "11222333000181" }),
				),
			).rejects.toBeInstanceOf(CnpjTransportadoraDuplicadoError);
			expect(await db.transportadoras.count()).toBe(1);
			expect(await db.outbox.count()).toBe(1);
		});

		it("permite o mesmo CNPJ em tenants diferentes", async () => {
			await adapter.criar(TENANT_1, input());
			await expect(adapter.criar(TENANT_2, input())).resolves.toBeDefined();
		});

		it("permite várias transportadoras sem CNPJ", async () => {
			await adapter.criar(TENANT_1, input({ cnpj: "" }));
			await adapter.criar(TENANT_1, input({ cnpj: null, nome_fantasia: "B" }));
			expect(await db.transportadoras.count()).toBe(2);
		});

		it("oferece reativar a inativa com o mesmo CNPJ", async () => {
			const original = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, original.id);

			const erro = await adapter
				.criar(TENANT_1, input({ nome_fantasia: "Nova" }))
				.catch((e: unknown) => e);
			expect(erro).toBeInstanceOf(TransportadoraInativaExistenteError);
			if (erro instanceof TransportadoraInativaExistenteError) {
				expect(erro.transportadoraInativa.id).toBe(original.id);
			}
		});
	});

	describe("listar / obterPorId", () => {
		it("isola por tenant, filtra busca e esconde inativas e excluídas", async () => {
			const a = await adapter.criar(TENANT_1, input({ cnpj: null }));
			const b = await adapter.criar(
				TENANT_1,
				input({
					nome_fantasia: "Expresso Norte",
					cnpj: null,
					cidade_uf: "Manaus/AM",
				}),
			);
			await adapter.criar(TENANT_2, input({ nome_fantasia: "Outro Tenant" }));
			await adapter.inativar(TENANT_1, b.id);
			const excluida = await adapter.criar(
				TENANT_1,
				input({ nome_fantasia: "Excluída", cnpj: null }),
			);
			await db.transportadoras.update(excluida.id, {
				deleted_at: new Date().toISOString(),
			});

			expect((await adapter.listar(TENANT_1)).map((t) => t.id)).toEqual([a.id]);
			expect((await adapter.listarTodas(TENANT_1)).map((t) => t.id)).toEqual([
				a.id,
				b.id,
			]);
			expect(
				(await adapter.listarTodas(TENANT_1, "manaus")).map((t) => t.id),
			).toEqual([b.id]);

			expect(await adapter.obterPorId(TENANT_2, a.id)).toBeUndefined();
			expect(await adapter.obterPorId(TENANT_1, b.id)).toBeUndefined();
			expect((await adapter.obterPorId(TENANT_1, b.id, true))?.id).toBe(b.id);
			expect(
				await adapter.obterPorId(TENANT_1, excluida.id, true),
			).toBeUndefined();
		});
	});

	describe("atualizar", () => {
		it("atualiza os dados e registra UPDATE na outbox", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			const atualizada = await adapter.atualizar(
				TENANT_1,
				criada.id,
				input({ nome_fantasia: "Rodo Sul Express", telefone: "" }),
			);

			expect(atualizada.nome_fantasia).toBe("Rodo Sul Express");
			expect(atualizada.telefone).toBeNull();
			expect(atualizada.created_at).toBe(criada.created_at);
			expect(atualizada.updated_at > criada.updated_at).toBe(true);

			const acoes = (await db.outbox.toArray()).map((m) => m.action).sort();
			expect(acoes).toEqual(["INSERT", "UPDATE"]);
		});

		it("bloqueia trocar para um CNPJ já usado", async () => {
			await adapter.criar(TENANT_1, input());
			const outra = await adapter.criar(
				TENANT_1,
				input({ nome_fantasia: "B", cnpj: null }),
			);
			await expect(
				adapter.atualizar(TENANT_1, outra.id, input({ nome_fantasia: "B" })),
			).rejects.toBeInstanceOf(CnpjTransportadoraDuplicadoError);
		});

		it("não atualiza transportadora de outro tenant", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await expect(
				adapter.atualizar(TENANT_2, criada.id, input()),
			).rejects.toBeInstanceOf(TransportadoraNaoEncontradaError);
		});
	});

	describe("inativar / reativar", () => {
		it("alterna `ativo` sem preencher deleted_at e enfileira as mutações", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, criada.id);
			expect((await db.transportadoras.get(criada.id))?.ativo).toBe(false);
			expect((await db.transportadoras.get(criada.id))?.deleted_at).toBeNull();

			await adapter.reativar(TENANT_1, criada.id);
			expect((await db.transportadoras.get(criada.id))?.ativo).toBe(true);
			expect(await db.outbox.count()).toBe(3);
		});

		it("reativar uma ativa não gera mutação", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await adapter.reativar(TENANT_1, criada.id);
			expect(await db.outbox.count()).toBe(1);
		});

		it("bloqueia reativar se outra ativa já usa o CNPJ", async () => {
			const original = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, original.id);
			// Outra ativa com o mesmo CNPJ (ex.: chegou por sincronização).
			await db.transportadoras.add({
				...original,
				id: crypto.randomUUID(),
				ativo: true,
			});
			await expect(
				adapter.reativar(TENANT_1, original.id),
			).rejects.toBeInstanceOf(CnpjTransportadoraDuplicadoError);
		});
	});
});
