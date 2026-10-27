import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import {
	ClienteInativoExistenteError,
	CpfCnpjDuplicadoError,
	RazaoSocialClienteDuplicadaError,
} from "../domain/cliente";
import type { SalvarClienteDTO } from "./cliente.repository";
import { ClienteDexieAdapter } from "./cliente-dexie.adapter";

const TENANT_1 = "11111111-1111-4111-a111-111111111111";
const CPF_1 = "52998224725";
const CNPJ_1 = "11222333000181";

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

	describe("criar", () => {
		it("persiste cliente com endereços e contatos transacionalmente", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());

			expect(criado.cliente.id).toBeDefined();
			expect(criado.cliente.tenant_id).toBe(TENANT_1);
			expect(criado.enderecos).toHaveLength(1);
			expect(criado.contatos).toHaveLength(1);

			const noBanco = await db.clientes.get(criado.cliente.id);
			expect(noBanco).toBeDefined();
			const endsNoBanco = await db.clientes_enderecos
				.where("cliente_id")
				.equals(criado.cliente.id)
				.toArray();
			expect(endsNoBanco).toHaveLength(1);
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

		it("bloqueia razão social duplicada no mesmo tenant (case insensitive)", async () => {
			await adapter.criar(TENANT_1, dtoPadrao());

			await expect(
				adapter.criar(
					TENANT_1,
					dtoPadrao({
						cnpj_cpf: CNPJ_1,
						razao_social: "comercial de bebidas silva ltda",
						nome_fantasia: "Outro Nome",
					}),
				),
			).rejects.toBeInstanceOf(RazaoSocialClienteDuplicadaError);
		});

		it("bloqueia criação se existir cliente inativo com mesmo documento", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await adapter.inativar(TENANT_1, criado.cliente.id);

			await expect(
				adapter.criar(
					TENANT_1,
					dtoPadrao({
						razao_social: "Outra Razao",
						nome_fantasia: "Outro Nome",
					}),
				),
			).rejects.toBeInstanceOf(ClienteInativoExistenteError);
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
			expect(atualizado.contatos).toHaveLength(0);

			const contatosNoBanco = await db.clientes_contatos
				.where("cliente_id")
				.equals(criado.cliente.id)
				.toArray();
			expect(contatosNoBanco).toHaveLength(0);
		});
	});

	describe("inativar e reativar", () => {
		it("inativa e reativa cliente", async () => {
			const criado = await adapter.criar(TENANT_1, dtoPadrao());
			await adapter.inativar(TENANT_1, criado.cliente.id);

			const inativo = await adapter.obterPorId(
				TENANT_1,
				criado.cliente.id,
				true,
			);
			expect(inativo?.cliente.ativo).toBe(false);
			expect(inativo?.cliente.deleted_at).not.toBeNull();

			await adapter.reativar(TENANT_1, criado.cliente.id);
			const reativado = await adapter.obterPorId(TENANT_1, criado.cliente.id);
			expect(reativado?.cliente.ativo).toBe(true);
			expect(reativado?.cliente.deleted_at).toBeNull();
		});
	});
});
