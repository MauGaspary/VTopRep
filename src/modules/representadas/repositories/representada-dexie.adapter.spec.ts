import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import {
	CnpjDuplicadoError,
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
					input({ cnpj: "11222333000181", nome_fantasia: "Outra" }),
				),
			).rejects.toBeInstanceOf(CnpjDuplicadoError);
			expect(await db.representadas.count()).toBe(1);
		});

		it("permite o mesmo CNPJ em tenants diferentes", async () => {
			await adapter.criar(TENANT_1, input());
			await expect(adapter.criar(TENANT_2, input())).resolves.toBeDefined();
		});

		it("permite recadastrar CNPJ de representada inativada", async () => {
			const original = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, original.id);
			await expect(adapter.criar(TENANT_1, input())).resolves.toBeDefined();
		});
	});

	describe("listar", () => {
		it("retorna apenas ativas do tenant, ordenadas por nome fantasia", async () => {
			await adapter.criar(TENANT_1, input({ nome_fantasia: "Zeta" }));
			const inativa = await adapter.criar(
				TENANT_1,
				input({ nome_fantasia: "Beta", cnpj: CNPJ_B }),
			);
			await adapter.inativar(TENANT_1, inativa.id);
			await adapter.criar(
				TENANT_1,
				input({ nome_fantasia: "Ácido", cnpj: CNPJ_B }),
			);
			await adapter.criar(TENANT_2, input({ nome_fantasia: "Outro tenant" }));

			const lista = await adapter.listar(TENANT_1);
			expect(lista.map((r) => r.nome_fantasia)).toEqual(["Ácido", "Zeta"]);
		});

		it("filtra por termo de busca", async () => {
			await adapter.criar(TENANT_1, input({ nome_fantasia: "Calçados Sul" }));
			await adapter.criar(
				TENANT_1,
				input({ nome_fantasia: "Têxtil Norte", cnpj: CNPJ_B }),
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
			await adapter.criar(TENANT_1, input());
			const segunda = await adapter.criar(TENANT_1, input({ cnpj: CNPJ_B }));
			await expect(
				adapter.atualizar(TENANT_1, segunda.id, input({ cnpj: CNPJ_A })),
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
		it("faz soft delete mantendo o registro no banco", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await adapter.inativar(TENANT_1, criada.id);

			const salvo = await db.representadas.get(criada.id);
			expect(salvo).toBeDefined();
			expect(salvo?.deleted_at).not.toBeNull();
		});

		it("não permite inativar registro de outro tenant", async () => {
			const criada = await adapter.criar(TENANT_1, input());
			await expect(
				adapter.inativar(TENANT_2, criada.id),
			).rejects.toBeInstanceOf(RepresentadaNaoEncontradaError);
			expect((await db.representadas.get(criada.id))?.deleted_at).toBeNull();
		});

		it("falha para id inexistente", async () => {
			await expect(
				adapter.inativar(TENANT_1, crypto.randomUUID()),
			).rejects.toBeInstanceOf(RepresentadaNaoEncontradaError);
		});
	});
});
