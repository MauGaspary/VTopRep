import { describe, expect, it } from "vitest";
import { criarClienteCompleto } from "./cliente";
import {
	type ClienteFormValues,
	chaveErroContato,
	chaveErroEndereco,
	novoContatoForm,
	novoEnderecoForm,
	validarFormularioCliente,
	valoresIniciaisCadastroRapidoCliente,
	valoresIniciaisClienteForm,
} from "./cliente-form";

let sequencia = 0;
const gerarId = () => `local-${++sequencia}`;

const formValido = (
	overrides: Partial<ClienteFormValues> = {},
): ClienteFormValues => ({
	cnpj_cpf: "529.982.247-25",
	razao_social: "  João da Silva  ",
	nome_fantasia: "",
	enderecos: [
		{
			...novoEnderecoForm(gerarId),
			endereco_completo: "Rua das Flores, 123",
		},
	],
	contatos: [
		{
			...novoContatoForm(gerarId),
			nome: "João",
			telefone_whatsapp: "(51) 99999-9999",
			email: "joao@exemplo.com",
		},
	],
	...overrides,
});

describe("validarFormularioCliente", () => {
	it("converte o formulário em dados de domínio normalizados", () => {
		const resultado = validarFormularioCliente(formValido());
		expect(resultado.success).toBe(true);
		if (!resultado.success) return;

		expect(resultado.data.cliente).toEqual({
			cnpj_cpf: "52998224725",
			razao_social: "João da Silva",
			nome_fantasia: null,
		});
		expect(resultado.data.enderecos).toEqual([
			{
				id: undefined,
				tipo_endereco: "PRINCIPAL",
				endereco_completo: "Rua das Flores, 123",
				latitude: undefined,
				longitude: undefined,
			},
		]);
		expect(resultado.data.contatos[0]).toMatchObject({
			nome: "João",
			papel: "COMPRADOR",
			email: "joao@exemplo.com",
		});
	});

	it("trata papel e e-mail vazios como nulos", () => {
		const resultado = validarFormularioCliente(
			formValido({
				contatos: [
					{
						...novoContatoForm(gerarId),
						nome: "Ana",
						papel: "",
						telefone_whatsapp: "51 98888-7777",
						email: "  ",
					},
				],
			}),
		);
		expect(resultado.success).toBe(true);
		if (resultado.success) {
			expect(resultado.data.contatos[0].papel).toBeNull();
			expect(resultado.data.contatos[0].email).toBeNull();
		}
	});

	it("exige o documento e informa quando está vazio", () => {
		const resultado = validarFormularioCliente(formValido({ cnpj_cpf: " " }));
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.cnpj_cpf).toBe("CPF ou CNPJ é obrigatório");
		}
	});

	it("rejeita documento inválido com mensagem amigável", () => {
		const resultado = validarFormularioCliente(
			formValido({ cnpj_cpf: "123.456.789-00" }),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.cnpj_cpf).toBe("CPF ou CNPJ inválido");
			expect(resultado.geral).toBeNull();
		}
	});

	it("mapeia e-mail inválido do contato para o campo, sem vazar o ZodError", () => {
		const resultado = validarFormularioCliente(
			formValido({
				contatos: [
					{
						...novoContatoForm(gerarId),
						nome: "Ana",
						telefone_whatsapp: "51 98888-7777",
						email: "ana@",
					},
				],
			}),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros[chaveErroContato(0, "email")]).toBe(
				"E-mail inválido",
			);
			expect(resultado.geral).toBeNull();
		}
	});

	it("aponta a linha exata de endereços e contatos incompletos", () => {
		const resultado = validarFormularioCliente(
			formValido({
				razao_social: "",
				enderecos: [
					{ ...novoEnderecoForm(gerarId), endereco_completo: "Rua A, 1" },
					novoEnderecoForm(gerarId),
				],
				contatos: [novoContatoForm(gerarId)],
			}),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros).toEqual({
				razao_social: "Razão social / Nome é obrigatório",
				[chaveErroEndereco(1, "endereco_completo")]: "Endereço é obrigatório",
				[chaveErroContato(0, "nome")]: "Nome do contato é obrigatório",
				[chaveErroContato(0, "telefone_whatsapp")]:
					"Telefone / WhatsApp é obrigatório",
			});
		}
	});

	it("rejeita tipo de endereço desconhecido", () => {
		const resultado = validarFormularioCliente(
			formValido({
				enderecos: [
					{
						...novoEnderecoForm(gerarId),
						tipo_endereco: "FILIAL",
						endereco_completo: "Rua A, 1",
					},
				],
			}),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(
				resultado.erros[chaveErroEndereco(0, "tipo_endereco")],
			).toBeDefined();
		}
	});
});

describe("valoresIniciaisClienteForm", () => {
	it("retorna formulário vazio para cliente novo", () => {
		expect(valoresIniciaisClienteForm()).toEqual({
			cnpj_cpf: "",
			razao_social: "",
			nome_fantasia: "",
			enderecos: [],
			contatos: [],
		});
	});

	it("faz ida-e-volta preservando ids e coordenadas", () => {
		const completo = criarClienteCompleto({
			tenantId: "11111111-1111-4111-a111-111111111111",
			clienteInput: {
				cnpj_cpf: "11222333000181",
				razao_social: "Padaria Ltda",
				nome_fantasia: "Pão Quente",
			},
			enderecosInput: [
				{
					tipo_endereco: "ENTREGA",
					endereco_completo: "Rua B, 2",
					latitude: -30.03,
					longitude: -51.23,
				},
			],
			contatosInput: [
				{ nome: "Ana", telefone_whatsapp: "51 98888-7777", papel: null },
			],
			agora: "2026-10-28T12:00:00.000Z",
		});

		const valores = valoresIniciaisClienteForm(completo);
		expect(valores.cnpj_cpf).toBe("11.222.333/0001-81");
		expect(valores.contatos[0].papel).toBe("");

		const resultado = validarFormularioCliente(valores);
		expect(resultado.success).toBe(true);
		if (resultado.success) {
			expect(resultado.data.enderecos[0]).toMatchObject({
				id: completo.enderecos[0].id,
				latitude: -30.03,
				longitude: -51.23,
			});
			expect(resultado.data.contatos[0].id).toBe(completo.contatos[0].id);
		}
	});

	it("pré-preenche documento ou nome no cadastro rápido conforme o termo digitado", () => {
		expect(valoresIniciaisCadastroRapidoCliente("11.222.333/0001-81")).toEqual({
			cnpj_cpf: "11.222.333/0001-81",
			razao_social: "",
			nome_fantasia: "",
			enderecos: [],
			contatos: [],
		});

		expect(valoresIniciaisCadastroRapidoCliente("Mercado Central")).toEqual({
			cnpj_cpf: "",
			razao_social: "Mercado Central",
			nome_fantasia: "Mercado Central",
			enderecos: [],
			contatos: [],
		});
	});
});
