import { describe, expect, it } from "vitest";
import { criarTransportadora } from "./transportadora";
import {
	type TransportadoraFormValues,
	validarFormularioTransportadora,
	valoresIniciaisTransportadoraForm,
} from "./transportadora-form";

const formValido = (
	overrides: Partial<TransportadoraFormValues> = {},
): TransportadoraFormValues => ({
	nome_fantasia: "Rodo Sul",
	razao_social: "",
	cnpj: "",
	telefone: "",
	cidade_uf: "",
	...overrides,
});

describe("validarFormularioTransportadora", () => {
	it("aceita somente o nome fantasia", () => {
		expect(validarFormularioTransportadora(formValido())).toEqual({
			success: true,
			data: {
				nome_fantasia: "Rodo Sul",
				razao_social: null,
				cnpj: null,
				telefone: null,
				cidade_uf: null,
			},
		});
	});

	it("normaliza o CNPJ formatado", () => {
		const resultado = validarFormularioTransportadora(
			formValido({ cnpj: "11.222.333/0001-81" }),
		);
		expect(resultado.success && resultado.data.cnpj).toBe("11222333000181");
	});

	it("aponta erro no campo do CNPJ inválido e no nome vazio", () => {
		const resultado = validarFormularioTransportadora(
			formValido({ nome_fantasia: " ", cnpj: "11.222.333/0001-00" }),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.nome_fantasia).toBeDefined();
			expect(resultado.erros.cnpj).toBe("CNPJ inválido");
			expect(resultado.geral).toBeNull();
		}
	});
});

describe("valoresIniciaisTransportadoraForm", () => {
	it("retorna campos vazios para nova transportadora", () => {
		expect(valoresIniciaisTransportadoraForm()).toEqual(
			formValido({ nome_fantasia: "" }),
		);
	});

	it("preenche a partir do registro, com CNPJ formatado", () => {
		const t = criarTransportadora({
			tenantId: "11111111-1111-4111-a111-111111111111",
			id: "33333333-3333-4333-a333-333333333333",
			agora: "2026-11-03T12:00:00.000Z",
			input: {
				nome_fantasia: "Rodo Sul",
				cnpj: "11222333000181",
				cidade_uf: "Caxias do Sul/RS",
			},
		});
		expect(valoresIniciaisTransportadoraForm(t)).toEqual(
			formValido({ cnpj: "11.222.333/0001-81", cidade_uf: "Caxias do Sul/RS" }),
		);
	});
});
