import { describe, expect, it } from "vitest";
import {
	atualizarClienteDados,
	correspondeBuscaCliente,
	criarClienteCompleto,
	inativarCliente,
	ordenarClientesComInativosNoFim,
	reativarCliente,
	TenantDivergenteClienteError,
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
		).toThrow(TenantDivergenteClienteError);
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
		expect(inativo.deleted_at).toBe("2026-10-27T11:00:00.000Z");

		const reativado = reativarCliente(
			inativo,
			TENANT,
			"2026-10-27T12:00:00.000Z",
		);
		expect(reativado.ativo).toBe(true);
		expect(reativado.deleted_at).toBeNull();
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
