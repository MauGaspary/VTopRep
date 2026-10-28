import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mapearIssues, mensagemDeErro } from "./formulario";

const Schema = z.object({
	nome: z.string().min(1, "Nome é obrigatório"),
	idade: z.number().int("Idade deve ser inteira").min(0, "Idade negativa"),
	interno: z.string().min(1, "Campo interno inválido"),
});

const campoDoCaminho = (caminho: readonly PropertyKey[]) => {
	const chave = caminho[0];
	if (chave === "nome") return "nome";
	if (chave === "idade") return "idade";
	return undefined;
};

describe("mapearIssues", () => {
	it("mapeia issues para os campos e mantém a primeira mensagem", () => {
		const resultado = Schema.safeParse({ nome: "", idade: -1.5, interno: "x" });
		expect(resultado.success).toBe(false);
		if (resultado.success) return;

		const { erros, geral } = mapearIssues(
			resultado.error.issues,
			campoDoCaminho,
		);
		expect(erros).toEqual({
			nome: "Nome é obrigatório",
			idade: "Idade deve ser inteira",
		});
		expect(geral).toBeNull();
	});

	it("envia caminhos desconhecidos para o erro geral", () => {
		const resultado = Schema.safeParse({ nome: "Ok", idade: 1, interno: "" });
		if (resultado.success) throw new Error("deveria falhar");

		const { erros, geral } = mapearIssues(
			resultado.error.issues,
			campoDoCaminho,
		);
		expect(erros).toEqual({});
		expect(geral).toBe("Campo interno inválido");
	});

	it("não sobrescreve erros iniciais", () => {
		const resultado = Schema.safeParse({ nome: "", idade: 1, interno: "x" });
		if (resultado.success) throw new Error("deveria falhar");

		const { erros } = mapearIssues(resultado.error.issues, campoDoCaminho, {
			nome: "Erro prévio",
		});
		expect(erros.nome).toBe("Erro prévio");
	});
});

describe("mensagemDeErro", () => {
	it("usa a primeira mensagem do ZodError em vez do JSON cru", () => {
		const resultado = Schema.safeParse({ nome: "", idade: 1, interno: "x" });
		if (resultado.success) throw new Error("deveria falhar");
		expect(mensagemDeErro(resultado.error, "fallback")).toBe(
			"Nome é obrigatório",
		);
	});

	it("usa a mensagem de Error comum e o fallback para valores desconhecidos", () => {
		expect(mensagemDeErro(new Error("Falhou"), "fallback")).toBe("Falhou");
		expect(mensagemDeErro("texto", "fallback")).toBe("fallback");
		expect(mensagemDeErro(new Error(""), "fallback")).toBe("fallback");
	});
});
