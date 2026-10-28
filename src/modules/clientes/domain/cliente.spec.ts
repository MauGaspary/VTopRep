import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import {
	atualizarClienteDados,
	correspondeBuscaCliente,
	criarClienteCompleto,
	detectarConflitoDocumento,
	detectarHomonimosCliente,
	inativarCliente,
	ordenarClientesComInativosNoFim,
	reativarCliente,
	sincronizarFilhosCliente,
} from "./cliente";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const AGORA = "2026-10-27T10:00:00.000Z";

describe("criarClienteCompleto", () => {
	it("cria cliente com endereços e contatos associados", () => {
		const completo = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: {
				cnpj_cpf: "52998224725",
				razao_social: "João da Silva",
				nome_fantasia: "Mercadinho Silva",
			},
			enderecosInput: [
				{
					tipo_endereco: "PRINCIPAL",
					endereco_completo: "Rua das Flores, 123",
				},
			],
			contatosInput: [
				{
					nome: "João",
					papel: "COMPRADOR",
					telefone_whatsapp: "(51) 99999-9999",
					email: "joao@exemplo.com",
				},
			],
			agora: AGORA,
		});

		expect(completo.cliente.tenant_id).toBe(TENANT);
		expect(completo.cliente.cnpj_cpf).toBe("52998224725");
		expect(completo.cliente.ativo).toBe(true);
		expect(completo.enderecos).toHaveLength(1);
		expect(completo.enderecos[0].cliente_id).toBe(completo.cliente.id);
		expect(completo.contatos).toHaveLength(1);
		expect(completo.contatos[0].cliente_id).toBe(completo.cliente.id);
	});

	it("propaga o tenant_id do cliente para endereços e contatos", () => {
		const completo = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: { cnpj_cpf: "52998224725", razao_social: "João" },
			enderecosInput: [
				{ tipo_endereco: "ENTREGA", endereco_completo: "Rua A, 1" },
			],
			contatosInput: [{ nome: "João", telefone_whatsapp: "51 99999-9999" }],
			agora: AGORA,
		});

		expect(completo.enderecos[0].tenant_id).toBe(TENANT);
		expect(completo.contatos[0].tenant_id).toBe(TENANT);
	});

	it("rejeita documento ausente (CPF/CNPJ é obrigatório)", () => {
		expect(() =>
			criarClienteCompleto({
				tenantId: TENANT,
				clienteInput: { cnpj_cpf: "", razao_social: "Prospect" },
				agora: AGORA,
			}),
		).toThrow();
	});

	it("rejeita documento inválido", () => {
		expect(() =>
			criarClienteCompleto({
				tenantId: TENANT,
				clienteInput: {
					cnpj_cpf: "12345678900",
					razao_social: "Inválido",
				},
				agora: AGORA,
			}),
		).toThrow();
	});
});

describe("atualizarClienteDados", () => {
	it("atualiza cliente mantendo tenant e id", () => {
		const { cliente } = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: {
				cnpj_cpf: "52998224725",
				razao_social: "Nome Antigo",
			},
			agora: AGORA,
		});

		const atualizado = atualizarClienteDados(
			cliente,
			TENANT,
			{
				cnpj_cpf: "52998224725",
				razao_social: "Nome Novo",
				nome_fantasia: "Fantasia Nova",
			},
			"2026-10-27T12:00:00.000Z",
		);

		expect(atualizado.razao_social).toBe("Nome Novo");
		expect(atualizado.updated_at).toBe("2026-10-27T12:00:00.000Z");
	});

	it("impede atualização se tenant divergir", () => {
		const { cliente } = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: {
				cnpj_cpf: "52998224725",
				razao_social: "Nome Antigo",
			},
			agora: AGORA,
		});

		expect(() =>
			atualizarClienteDados(
				cliente,
				OUTRO_TENANT,
				{
					cnpj_cpf: "52998224725",
					razao_social: "Nome Novo",
				},
				AGORA,
			),
		).toThrow(TenantDivergenteError);
	});
});

describe("inativar e reativar cliente", () => {
	it("inativa e reativa corretamente", () => {
		const { cliente } = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: {
				cnpj_cpf: "52998224725",
				razao_social: "Cliente Teste",
			},
			agora: AGORA,
		});

		const inativo = inativarCliente(
			cliente,
			TENANT,
			"2026-10-27T11:00:00.000Z",
		);
		expect(inativo.ativo).toBe(false);
		expect(inativo.deleted_at).toBeNull();
		expect(inativo.updated_at).toBe("2026-10-27T11:00:00.000Z");

		const reativado = reativarCliente(
			inativo,
			TENANT,
			"2026-10-27T12:00:00.000Z",
		);
		expect(reativado.ativo).toBe(true);
		expect(reativado.deleted_at).toBeNull();
	});

	it("bloqueia inativação e reativação com tenant divergente", () => {
		const { cliente } = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: { cnpj_cpf: "52998224725", razao_social: "Cliente" },
			agora: AGORA,
		});
		expect(() => inativarCliente(cliente, OUTRO_TENANT, AGORA)).toThrow(
			TenantDivergenteError,
		);
		const inativo = inativarCliente(cliente, TENANT, AGORA);
		expect(() => reativarCliente(inativo, OUTRO_TENANT, AGORA)).toThrow(
			TenantDivergenteError,
		);
	});
});

describe("detectarConflitoDocumento e detectarHomonimosCliente", () => {
	const matriz = criarClienteCompleto({
		tenantId: TENANT,
		clienteId: "33333333-3333-4333-a333-333333333333",
		clienteInput: {
			cnpj_cpf: "11222333000181",
			razao_social: "Rede Mercados Ltda",
			nome_fantasia: "Mercado Bom",
		},
		agora: AGORA,
	}).cliente;
	const NOVO_ID = "44444444-4444-4444-a444-444444444444";

	it("bloqueia o mesmo documento, mesmo formatado", () => {
		expect(
			detectarConflitoDocumento([matriz], "11.222.333/0001-81", NOVO_ID),
		).toEqual({ tipo: "ativo", registro: matriz });
		expect(
			detectarConflitoDocumento([matriz], "52998224725", NOVO_ID),
		).toBeNull();
	});

	it("apenas avisa sobre filiais com mesma razão social ou nome fantasia", () => {
		expect(
			detectarHomonimosCliente(
				[matriz],
				{ razao_social: "rede mercados ltda", nome_fantasia: "MERCADO BOM" },
				NOVO_ID,
			),
		).toEqual([
			{ registro: matriz, campos: ["razao_social", "nome_fantasia"] },
		]);
	});

	it("não compara nome fantasia ausente", () => {
		expect(
			detectarHomonimosCliente(
				[{ ...matriz, nome_fantasia: null }],
				{ razao_social: "Outra", nome_fantasia: null },
				NOVO_ID,
			),
		).toEqual([]);
	});
});

describe("correspondeBuscaCliente", () => {
	const { cliente } = criarClienteCompleto({
		tenantId: TENANT,
		clienteInput: {
			cnpj_cpf: "52998224725",
			razao_social: "Padaria da Esquina Ltda",
			nome_fantasia: "Pão Quente",
		},
		agora: AGORA,
	});

	it("filtra por razão social, nome fantasia e documento", () => {
		expect(correspondeBuscaCliente(cliente, "padaria")).toBe(true);
		expect(correspondeBuscaCliente(cliente, "QUENTE")).toBe(true);
		expect(correspondeBuscaCliente(cliente, "529.982")).toBe(true);
		expect(correspondeBuscaCliente(cliente, "farmácia")).toBe(false);
	});
});

describe("ordenarClientesComInativosNoFim", () => {
	it("ordena ativas antes de inativas", () => {
		const c1 = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: { cnpj_cpf: "52998224725", razao_social: "Zeta Ativo" },
			agora: AGORA,
		}).cliente;
		const c2 = inativarCliente(
			criarClienteCompleto({
				tenantId: TENANT,
				clienteInput: {
					cnpj_cpf: "11222333000181",
					razao_social: "Alfa Inativo",
				},
				agora: AGORA,
			}).cliente,
			TENANT,
			AGORA,
		);
		const c3 = criarClienteCompleto({
			tenantId: TENANT,
			clienteInput: { cnpj_cpf: "12ABC34501DE35", razao_social: "Beta Ativo" },
			agora: AGORA,
		}).cliente;

		const ordenados = ordenarClientesComInativosNoFim([c1, c2, c3]);
		expect(ordenados.map((c) => c.razao_social)).toEqual([
			"Beta Ativo",
			"Zeta Ativo",
			"Alfa Inativo",
		]);
	});
});

describe("sincronizarFilhosCliente", () => {
	const CLIENTE_ID = "55555555-5555-4555-a555-555555555555";
	const DEPOIS = "2026-10-28T09:00:00.000Z";
	let sequencia = 0;
	const gerarId = () =>
		`00000000-0000-4000-a000-${String(++sequencia).padStart(12, "0")}`;

	const original = criarClienteCompleto({
		tenantId: TENANT,
		clienteId: CLIENTE_ID,
		clienteInput: { cnpj_cpf: "52998224725", razao_social: "Cliente" },
		enderecosInput: [
			{ tipo_endereco: "PRINCIPAL", endereco_completo: "Rua A, 1" },
			{ tipo_endereco: "ENTREGA", endereco_completo: "Rua B, 2" },
		],
		contatosInput: [{ nome: "Ana", telefone_whatsapp: "51 99999-9999" }],
		agora: AGORA,
		gerarId,
	});
	const [enderecoA, enderecoB] = original.enderecos;
	const [contato] = original.contatos;

	const sincronizar = (
		enderecosInput: Parameters<
			typeof sincronizarFilhosCliente
		>[0]["enderecosInput"],
		contatosInput: Parameters<
			typeof sincronizarFilhosCliente
		>[0]["contatosInput"] = [
			{ id: contato.id, nome: "Ana", telefone_whatsapp: "51 99999-9999" },
		],
	) =>
		sincronizarFilhosCliente({
			tenantId: TENANT,
			clienteId: CLIENTE_ID,
			agora: DEPOIS,
			enderecosInput,
			contatosInput,
			existentes: original,
			gerarId,
		});

	it("cria filhos com timestamps e sem tombstone", () => {
		expect(enderecoA).toMatchObject({
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: null,
		});
	});

	it("mantém intactos os filhos sem alteração e não grava nada", () => {
		const resultado = sincronizar([
			{
				id: enderecoA.id,
				tipo_endereco: "PRINCIPAL",
				endereco_completo: "Rua A, 1",
			},
			{
				id: enderecoB.id,
				tipo_endereco: "ENTREGA",
				endereco_completo: "Rua B, 2",
			},
		]);

		expect(resultado.enderecos).toEqual([enderecoA, enderecoB]);
		expect(resultado.contatos).toEqual([contato]);
		expect(resultado.gravar).toEqual({ enderecos: [], contatos: [] });
	});

	it("atualiza o alterado preservando id e created_at", () => {
		const resultado = sincronizar([
			{
				id: enderecoA.id,
				tipo_endereco: "COBRANCA",
				endereco_completo: "Rua A, 1",
			},
			{
				id: enderecoB.id,
				tipo_endereco: "ENTREGA",
				endereco_completo: "Rua B, 2",
			},
		]);

		expect(resultado.gravar.enderecos).toEqual([
			{ ...enderecoA, tipo_endereco: "COBRANCA", updated_at: DEPOIS },
		]);
	});

	it("marca deleted_at no removido em vez de apagar", () => {
		const resultado = sincronizar(
			[
				{
					id: enderecoA.id,
					tipo_endereco: "PRINCIPAL",
					endereco_completo: "Rua A, 1",
				},
			],
			[],
		);

		expect(resultado.enderecos).toEqual([enderecoA]);
		expect(resultado.contatos).toEqual([]);
		expect(resultado.gravar.enderecos).toEqual([
			{ ...enderecoB, deleted_at: DEPOIS, updated_at: DEPOIS },
		]);
		expect(resultado.gravar.contatos).toEqual([
			{ ...contato, deleted_at: DEPOIS, updated_at: DEPOIS },
		]);
	});

	it("cria com id novo quando o id é desconhecido ou repetido", () => {
		const estranho = "99999999-9999-4999-a999-999999999999";
		const resultado = sincronizar([
			{ id: estranho, tipo_endereco: "ENTREGA", endereco_completo: "Rua C, 3" },
			{
				id: enderecoA.id,
				tipo_endereco: "PRINCIPAL",
				endereco_completo: "Rua A, 1",
			},
			{
				id: enderecoA.id,
				tipo_endereco: "ENTREGA",
				endereco_completo: "Rua D, 4",
			},
		]);

		const ids = resultado.enderecos.map((e) => e.id);
		expect(ids).not.toContain(estranho);
		expect(ids.filter((id) => id === enderecoA.id)).toHaveLength(1);
		expect(resultado.enderecos).toHaveLength(3);
		// B não veio na lista: vira tombstone
		expect(
			resultado.gravar.enderecos.find((e) => e.id === enderecoB.id)?.deleted_at,
		).toBe(DEPOIS);
	});
});
