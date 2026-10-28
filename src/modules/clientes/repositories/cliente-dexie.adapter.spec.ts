import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import {
	ClienteInativoExistenteError,
	ClienteNaoEncontradoError,
	CpfCnpjDuplicadoError,
} from "../domain/cliente";
import type { SalvarClienteDTO } from "./cliente.repository";
import { ClienteDexieAdapter } from "./cliente-dexie.adapter";

const TENANT_1 = "11111111-1111-4111-a111-111111111111";
const TENANT_2 = "22222222-2222-4222-a222-222222222222";
const CPF_1 = "52998224725";
const CNPJ_1 = "11222333000181";
const CNPJ_2 = "12ABC34501DE35";

const dtoPadrao = (
	overrides: Partial<SalvarClienteDTO["cliente"]> = {},
): SalvarClienteDTO => ({
	cliente: {
		cnpj_cpf: CPF_1,
		razao_social: "Comercial de Bebidas Silva Ltda",
		nome_fantasia: "Bebidas Silva",
		...overrides,
	},
	enderecos: [
		{
			tipo_endereco: "PRINCIPAL",
			endereco_completo: "Av Central, 500",
		},
	],
	contatos: [
		{
			nome: "Carlos Silva",
			papel: "COMPRADOR",
			telefone_whatsapp: "(51) 98888-7777",
			email: "carlos@silva.com",
		},
	],
});

describe("ClienteDexieAdapter", () => {
	let adapter: ClienteDexieAdapter;

	beforeEach(async () => {
		await db.clientes.clear();
		await db.clientes_enderecos.clear();
		await db.clientes_contatos.clear();
		adapter = new ClienteDexieAdapter();
	});

	const enderecosDe = (tenantId: string, clienteId: string) =>
		db.clientes_enderecos
			.where("[tenant_id+cliente_id]")
			.equals([tenantId, clienteId])
			.toArray();

	const contatosDe = (tenantId: string, clienteId: string) =>
		db.clientes_contatos
			.where("[tenant_id+cliente_id]")
			.equals([tenantId, clienteId])
			.toArray();

	describe("criar", () => {
		it("persiste cliente com endereços e contatos transacionalmente, com tenant_id nos filhos", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());

			expect(criado.cliente.tenant_id).toBe(TENANT_1);
			expect(criado.enderecos).toHaveLength(1);
			expect(criado.contatos).toHaveLength(1);

			expect(await db.clientes.get(criado.cliente.id)).toEqual(criado.cliente);
			expect(await enderecosDe(TENANT_1, criado.cliente.id)).toEqual(
				criado.enderecos,
			);
			expect(await contatosDe(TENANT_1, criado.cliente.id)).toEqual(
				criado.contatos,
			);
		});

		it("não grava nada se um contato for inválido", async () => {
			const dto = dtoPadrao();
			dto.contatos = [
				{ nome: "Ana", telefone_whatsapp: "51 9999-9999", email: "ana@" },
			];

			await expect(adapter.criar(TENANT_1, dto)).rejects.toThrow();
			expect(await db.clientes.count()).toBe(0);
			expect(await db.clientes_enderecos.count()).toBe(0);
		});

		it("bloqueia documento duplicado no mesmo tenant", async () => {
			await adapter.criar(TENANT_1, dtoPadrao());

			await expect(
				adapter.criar(
					TENANT_1,
					dtoPadrao({
						razao_social: "Outra Razao",
						nome_fantasia: "Outro Nome",
					}),
				),
			).rejects.toBeInstanceOf(CpfCnpjDuplicadoError);
		});

		it("permite filiais: mesma razão social e nome fantasia com CNPJ diferente", async () => {
			await adapter.criar(TENANT_1, dtoPadrao({ cnpj_cpf: CNPJ_1 }));

			await expect(
				adapter.criar(
					TENANT_1,
					dtoPadrao({
						cnpj_cpf: CNPJ_2,
						razao_social: "comercial de bebidas silva ltda",
						nome_fantasia: "BEBIDAS SILVA",
					}),
				),
			).resolves.toBeDefined();
			expect(await db.clientes.count()).toBe(2);
		});

		it("permite o mesmo documento em tenants diferentes", async () => {
			await adapter.criar(TENANT_1, dtoPadrao());
			await expect(adapter.criar(TENANT_2, dtoPadrao())).resolves.toBeDefined();
		});

		it("oferece reativação se existir cliente inativo com mesmo documento", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await adapter.inativar(TENANT_1, criado.cliente.id);

			const erro = await adapter
				.criar(
					TENANT_1,
					dtoPadrao({
						razao_social: "Outra Razao",
						nome_fantasia: "Outro Nome",
					}),
				)
				.catch((e: unknown) => e);
			expect(erro).toBeInstanceOf(ClienteInativoExistenteError);
			if (erro instanceof ClienteInativoExistenteError) {
				expect(erro.clienteInativo.id).toBe(criado.cliente.id);
			}
		});
	});

	describe("buscarHomonimos", () => {
		it("lista clientes do tenant com o mesmo nome", async () => {
			const existente = await adapter.criar(TENANT_1, dtoPadrao());
			await adapter.criar(TENANT_2, dtoPadrao());

			const homonimos = await adapter.buscarHomonimos(TENANT_1, {
				razao_social: "Outra",
				nome_fantasia: "bebidas silva",
			});
			expect(homonimos).toEqual([
				{ registro: existente.cliente, campos: ["nome_fantasia"] },
			]);

			expect(
				await adapter.buscarHomonimos(
					TENANT_1,
					{
						razao_social: existente.cliente.razao_social,
						nome_fantasia: null,
					},
					existente.cliente.id,
				),
			).toEqual([]);
		});
	});

	describe("listar e listarTodos", () => {
		it("retorna clientes filtrados e ordenados", async () => {
			const c1 = await adapter.criar(
				TENANT_1,
				dtoPadrao({ razao_social: "Zeta Comércio", cnpj_cpf: CPF_1 }),
			);
			const c2 = await adapter.criar(
				TENANT_1,
				dtoPadrao({
					razao_social: "Alfa Comércio",
					nome_fantasia: "Alfa",
					cnpj_cpf: CNPJ_1,
				}),
			);
			await adapter.inativar(TENANT_1, c2.cliente.id);

			const ativas = await adapter.listar(TENANT_1);
			expect(ativas).toHaveLength(1);
			expect(ativas[0].id).toBe(c1.cliente.id);

			const todas = await adapter.listarTodos(TENANT_1);
			expect(todas).toHaveLength(2);
			expect(todas[0].razao_social).toBe("Zeta Comércio");
			expect(todas[1].razao_social).toBe("Alfa Comércio"); // inativo no fim
		});

		it("omite registros excluídos (tombstone)", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await db.clientes.update(criado.cliente.id, {
				deleted_at: new Date().toISOString(),
			});

			expect(await adapter.listarTodos(TENANT_1)).toEqual([]);
			expect(
				await adapter.obterPorId(TENANT_1, criado.cliente.id, true),
			).toBeUndefined();
		});
	});

	describe("obterPorId", () => {
		it("não retorna cliente nem filhos de outro tenant", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			expect(
				await adapter.obterPorId(TENANT_2, criado.cliente.id, true),
			).toBeUndefined();
		});

		it("ignora filhos gravados com tenant diferente do cliente", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await db.clientes_enderecos.add({
				id: crypto.randomUUID(),
				tenant_id: TENANT_2,
				cliente_id: criado.cliente.id,
				tipo_endereco: "ENTREGA",
				endereco_completo: "Endereço de outro tenant",
				created_at: criado.cliente.created_at,
				updated_at: criado.cliente.created_at,
				deleted_at: null,
			});

			const obtido = await adapter.obterPorId(TENANT_1, criado.cliente.id);
			expect(obtido?.enderecos).toEqual(criado.enderecos);
		});
	});

	describe("atualizar", () => {
		it("atualiza cliente e sincroniza endereços/contatos", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());

			const atualizado = await adapter.atualizar(TENANT_1, criado.cliente.id, {
				cliente: {
					cnpj_cpf: CPF_1,
					razao_social: "Silva Bebidas Atualizada",
					nome_fantasia: "Silva Novo",
				},
				enderecos: [
					{
						tipo_endereco: "ENTREGA",
						endereco_completo: "Novo Endereço, 999",
					},
				],
				contatos: [],
			});

			expect(atualizado.cliente.razao_social).toBe("Silva Bebidas Atualizada");
			expect(atualizado.enderecos).toHaveLength(1);
			expect(atualizado.enderecos[0].tipo_endereco).toBe("ENTREGA");
			expect(atualizado.enderecos[0].tenant_id).toBe(TENANT_1);
			expect(atualizado.contatos).toHaveLength(0);

			expect(await adapter.obterPorId(TENANT_1, criado.cliente.id)).toEqual(
				atualizado,
			);
		});

		it("remove endereços e contatos por soft delete, sem apagar do banco", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			const [enderecoOriginal] = criado.enderecos;
			const [contatoOriginal] = criado.contatos;

			await adapter.atualizar(TENANT_1, criado.cliente.id, {
				cliente: dtoPadrao().cliente,
				enderecos: [],
				contatos: [],
			});

			const enderecoGravado = await db.clientes_enderecos.get(
				enderecoOriginal.id,
			);
			expect(enderecoGravado?.deleted_at).not.toBeNull();
			expect(
				(await db.clientes_contatos.get(contatoOriginal.id))?.deleted_at,
			).not.toBeNull();

			const obtido = await adapter.obterPorId(TENANT_1, criado.cliente.id);
			expect(obtido?.enderecos).toEqual([]);
			expect(obtido?.contatos).toEqual([]);
		});

		it("não regrava endereços e contatos que não mudaram", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			const [endereco] = criado.enderecos;
			const [contato] = criado.contatos;

			await adapter.atualizar(TENANT_1, criado.cliente.id, {
				cliente: dtoPadrao({ razao_social: "Nova Razão" }).cliente,
				enderecos: [{ ...dtoPadrao().enderecos[0], id: endereco.id }],
				contatos: [
					{ ...dtoPadrao().contatos[0], id: contato.id, nome: "Carlos S." },
				],
			});

			expect(await db.clientes_enderecos.get(endereco.id)).toEqual(endereco);
			const contatoGravado = await db.clientes_contatos.get(contato.id);
			expect(contatoGravado?.nome).toBe("Carlos S.");
			expect(contatoGravado?.created_at).toBe(contato.created_at);
			expect(contatoGravado?.deleted_at).toBeNull();
		});

		it("não aceita id de endereço de outro cliente (cria um novo)", async () => {
			const outro = await adapter.criar(
				TENANT_1,
				dtoPadrao({ cnpj_cpf: CNPJ_1 }),
			);
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			const idAlheio = outro.enderecos[0].id;

			const atualizado = await adapter.atualizar(TENANT_1, criado.cliente.id, {
				cliente: dtoPadrao().cliente,
				enderecos: [
					{
						id: idAlheio,
						tipo_endereco: "ENTREGA",
						endereco_completo: "Tentativa",
					},
				],
				contatos: [],
			});

			expect(atualizado.enderecos[0].id).not.toBe(idAlheio);
			expect(await db.clientes_enderecos.get(idAlheio)).toEqual(
				outro.enderecos[0],
			);
		});

		it("bloqueia troca para documento de outro cliente ativo", async () => {
			await adapter.criar(TENANT_1, dtoPadrao({ cnpj_cpf: CNPJ_1 }));
			const segundo = await adapter.criar(TENANT_1, dtoPadrao());

			await expect(
				adapter.atualizar(
					TENANT_1,
					segundo.cliente.id,
					dtoPadrao({ cnpj_cpf: CNPJ_1 }),
				),
			).rejects.toBeInstanceOf(CpfCnpjDuplicadoError);
		});

		it("não permite atualizar cliente de outro tenant", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await expect(
				adapter.atualizar(TENANT_2, criado.cliente.id, dtoPadrao()),
			).rejects.toBeInstanceOf(ClienteNaoEncontradoError);
		});
	});

	describe("inativar e reativar", () => {
		it("inativa (ativo = false, sem tombstone) e reativa cliente", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await adapter.inativar(TENANT_1, criado.cliente.id);

			const inativo = await adapter.obterPorId(
				TENANT_1,
				criado.cliente.id,
				true,
			);
			expect(inativo?.cliente.ativo).toBe(false);
			expect(inativo?.cliente.deleted_at).toBeNull();
			expect(
				await adapter.obterPorId(TENANT_1, criado.cliente.id),
			).toBeUndefined();

			await adapter.reativar(TENANT_1, criado.cliente.id);
			const reativado = await adapter.obterPorId(TENANT_1, criado.cliente.id);
			expect(reativado?.cliente.ativo).toBe(true);
		});

		it("bloqueia reativação se outro cliente ativo tiver o mesmo documento", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await adapter.inativar(TENANT_1, criado.cliente.id);
			// Ex.: chegou via sincronização outro cliente ativo com o mesmo CPF
			await db.clientes.add({
				...criado.cliente,
				id: crypto.randomUUID(),
				ativo: true,
			});

			await expect(
				adapter.reativar(TENANT_1, criado.cliente.id),
			).rejects.toBeInstanceOf(CpfCnpjDuplicadoError);
		});

		it("não permite inativar cliente de outro tenant", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await expect(
				adapter.inativar(TENANT_2, criado.cliente.id),
			).rejects.toBeInstanceOf(ClienteNaoEncontradoError);
			expect((await db.clientes.get(criado.cliente.id))?.ativo).toBe(true);
		});
	});
});
