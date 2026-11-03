import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import {
	atualizarTransportadora,
	correspondeBuscaTransportadora,
	criarTransportadora,
	descreverTransportadora,
	detectarConflitoCnpjTransportadora,
	inativarTransportadora,
	opcoesComboboxTransportadoras,
	ordenarTransportadoras,
	reativarTransportadora,
	sugerirTransportadoraDoCliente,
} from "./transportadora";
import type { Transportadora } from "./transportadora.schema";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const ID = "33333333-3333-4333-a333-333333333333";
const AGORA = "2026-11-03T12:00:00.000Z";
const DEPOIS = "2026-11-03T13:00:00.000Z";

const criar = (
	overrides: Partial<Parameters<typeof criarTransportadora>[0]["input"]> = {},
	id = ID,
) =>
	criarTransportadora({
		tenantId: TENANT,
		id,
		agora: AGORA,
		input: { nome_fantasia: "Rodo Sul", ...overrides },
	});

describe("criarTransportadora", () => {
	it("cria com apenas o nome fantasia, preenchendo opcionais com null", () => {
		expect(criar()).toEqual({
			id: ID,
			tenant_id: TENANT,
			nome_fantasia: "Rodo Sul",
			razao_social: null,
			cnpj: null,
			telefone: null,
			cidade_uf: null,
			ativo: true,
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: null,
		});
	});

	it("normaliza o CNPJ (inclusive alfanumérico) e remove espaços dos textos", () => {
		const t = criar({
			nome_fantasia: "  Rodo Sul  ",
			razao_social: " Rodo Sul Transportes Ltda ",
			cnpj: "12.abc.345/01de-35",
			telefone: " (54) 3333-0000 ",
			cidade_uf: " Caxias do Sul/RS ",
		});
		expect(t.nome_fantasia).toBe("Rodo Sul");
		expect(t.razao_social).toBe("Rodo Sul Transportes Ltda");
		expect(t.cnpj).toBe("12ABC34501DE35");
		expect(t.telefone).toBe("(54) 3333-0000");
		expect(t.cidade_uf).toBe("Caxias do Sul/RS");
	});

	it("trata textos vazios como ausentes", () => {
		const t = criar({
			razao_social: "  ",
			cnpj: "",
			telefone: "",
			cidade_uf: "",
		});
		expect(t.razao_social).toBeNull();
		expect(t.cnpj).toBeNull();
		expect(t.telefone).toBeNull();
		expect(t.cidade_uf).toBeNull();
	});

	it("rejeita CNPJ informado com dígito verificador inválido", () => {
		expect(() => criar({ cnpj: "11.222.333/0001-00" })).toThrow();
	});

	it("rejeita nome fantasia vazio", () => {
		expect(() => criar({ nome_fantasia: "   " })).toThrow();
	});
});

describe("atualizarTransportadora", () => {
	it("aplica alterações preservando id, tenant, ativo e created_at", () => {
		const original = inativarTransportadora(criar(), TENANT, AGORA);
		const atualizada = atualizarTransportadora(
			original,
			TENANT,
			{ nome_fantasia: "Rodo Sul Express", cnpj: "11222333000181" },
			DEPOIS,
		);
		expect(atualizada).toMatchObject({
			id: ID,
			tenant_id: TENANT,
			nome_fantasia: "Rodo Sul Express",
			cnpj: "11222333000181",
			ativo: false,
			created_at: AGORA,
			updated_at: DEPOIS,
		});
	});

	it("permite remover o CNPJ e demais opcionais", () => {
		const original = criar({ cnpj: "11222333000181", telefone: "54 9999" });
		const atualizada = atualizarTransportadora(
			original,
			TENANT,
			{ nome_fantasia: "Rodo Sul", cnpj: "", telefone: null },
			DEPOIS,
		);
		expect(atualizada.cnpj).toBeNull();
		expect(atualizada.telefone).toBeNull();
	});

	it("bloqueia atualização de outro tenant", () => {
		expect(() =>
			atualizarTransportadora(
				criar(),
				OUTRO_TENANT,
				{ nome_fantasia: "X" },
				DEPOIS,
			),
		).toThrow(TenantDivergenteError);
	});
});

describe("inativar / reativar", () => {
	it("alterna apenas `ativo` e `updated_at`, sem preencher deleted_at", () => {
		const inativa = inativarTransportadora(criar(), TENANT, DEPOIS);
		expect(inativa.ativo).toBe(false);
		expect(inativa.updated_at).toBe(DEPOIS);
		expect(inativa.deleted_at).toBeNull();

		const reativada = reativarTransportadora(inativa, TENANT, AGORA);
		expect(reativada.ativo).toBe(true);
		expect(reativada.deleted_at).toBeNull();
	});

	it("é idempotente", () => {
		const ativa = criar();
		expect(reativarTransportadora(ativa, TENANT, DEPOIS)).toBe(ativa);
		const inativa = inativarTransportadora(ativa, TENANT, DEPOIS);
		expect(inativarTransportadora(inativa, TENANT, AGORA)).toBe(inativa);
	});

	it("bloqueia outro tenant", () => {
		expect(() => inativarTransportadora(criar(), OUTRO_TENANT, DEPOIS)).toThrow(
			TenantDivergenteError,
		);
	});
});

describe("detectarConflitoCnpjTransportadora", () => {
	const comCnpj = criar({ cnpj: "11222333000181" });

	it("detecta conflito com ativa mesmo com outra formatação", () => {
		expect(
			detectarConflitoCnpjTransportadora([comCnpj], "11.222.333/0001-81"),
		).toEqual({ tipo: "ativo", registro: comCnpj });
	});

	it("oferece a inativa quando é a única com o CNPJ", () => {
		const inativa = inativarTransportadora(comCnpj, TENANT, DEPOIS);
		expect(
			detectarConflitoCnpjTransportadora([inativa], "11222333000181")?.tipo,
		).toBe("inativo");
	});

	it("ignora o próprio registro, tombstones e CNPJ ausente", () => {
		expect(
			detectarConflitoCnpjTransportadora([comCnpj], "11222333000181", ID),
		).toBeNull();
		expect(
			detectarConflitoCnpjTransportadora(
				[{ ...comCnpj, deleted_at: DEPOIS }],
				"11222333000181",
			),
		).toBeNull();
		expect(detectarConflitoCnpjTransportadora([comCnpj], null)).toBeNull();
		expect(detectarConflitoCnpjTransportadora([comCnpj], "")).toBeNull();
	});

	it("duas transportadoras sem CNPJ nunca conflitam", () => {
		const semCnpj = criar();
		expect(detectarConflitoCnpjTransportadora([semCnpj], null)).toBeNull();
	});
});

describe("correspondeBuscaTransportadora", () => {
	const t = criar({
		nome_fantasia: "Expresso Gaúcho",
		razao_social: "Expresso Gaucho Transportes Ltda",
		cnpj: "11222333000181",
		cidade_uf: "Passo Fundo/RS",
	});

	it("busca por nome (acento-insensível), razão social, cidade e CNPJ", () => {
		expect(correspondeBuscaTransportadora(t, undefined)).toBe(true);
		expect(correspondeBuscaTransportadora(t, "gaucho")).toBe(true);
		expect(correspondeBuscaTransportadora(t, "transportes")).toBe(true);
		expect(correspondeBuscaTransportadora(t, "passo fundo")).toBe(true);
		expect(correspondeBuscaTransportadora(t, "11.222.333")).toBe(true);
		expect(correspondeBuscaTransportadora(t, "rodonaves")).toBe(false);
	});

	it("não quebra com opcionais nulos", () => {
		expect(correspondeBuscaTransportadora(criar(), "rodo")).toBe(true);
		expect(correspondeBuscaTransportadora(criar(), "xyz")).toBe(false);
	});
});

describe("ordenarTransportadoras", () => {
	it("ativas primeiro, depois por nome fantasia pt-BR", () => {
		const a = criar({ nome_fantasia: "Zeta" }, crypto.randomUUID());
		const b = criar({ nome_fantasia: "álamo" }, crypto.randomUUID());
		const c = inativarTransportadora(
			criar({ nome_fantasia: "Beta" }, crypto.randomUUID()),
			TENANT,
			DEPOIS,
		);
		expect(
			ordenarTransportadoras([c, a, b]).map((t) => t.nome_fantasia),
		).toEqual(["álamo", "Zeta", "Beta"]);
	});
});

describe("descreverTransportadora", () => {
	it("junta cidade, CNPJ formatado e telefone, omitindo ausentes", () => {
		expect(
			descreverTransportadora({
				cidade_uf: "Caxias do Sul/RS",
				cnpj: "11222333000181",
				telefone: "(54) 3333-0000",
			}),
		).toBe("Caxias do Sul/RS · 11.222.333/0001-81 · (54) 3333-0000");
		expect(
			descreverTransportadora({ cidade_uf: null, cnpj: null, telefone: null }),
		).toBe("");
	});
});

describe("sugerirTransportadoraDoCliente", () => {
	const ativa: Pick<Transportadora, "id" | "ativo"> = { id: ID, ativo: true };

	it("sugere a habitual do cliente quando está disponível e ativa", () => {
		expect(
			sugerirTransportadoraDoCliente({ transportadora_padrao_id: ID }, [ativa]),
		).toBe(ID);
	});

	it("não sugere quando o cliente não tem habitual, ela sumiu ou está inativa", () => {
		expect(sugerirTransportadoraDoCliente(null, [ativa])).toBe("");
		expect(
			sugerirTransportadoraDoCliente({ transportadora_padrao_id: null }, [
				ativa,
			]),
		).toBe("");
		expect(
			sugerirTransportadoraDoCliente({ transportadora_padrao_id: ID }, []),
		).toBe("");
		expect(
			sugerirTransportadoraDoCliente({ transportadora_padrao_id: ID }, [
				{ id: ID, ativo: false },
			]),
		).toBe("");
	});
});

describe("opcoesComboboxTransportadoras", () => {
	const ativa = criar(
		{
			nome_fantasia: "Rodo Sul",
			cnpj: "11222333000181",
			cidade_uf: "Caxias do Sul/RS",
		},
		crypto.randomUUID(),
	);
	const inativa = inativarTransportadora(
		criar({ nome_fantasia: "Antiga" }, crypto.randomUUID()),
		TENANT,
		DEPOIS,
	);
	const excluida = {
		...criar({ nome_fantasia: "Excluída" }, crypto.randomUUID()),
		deleted_at: DEPOIS,
	};

	it("lista só ativas, com sublabel e CNPJ pesquisável", () => {
		const opcoes = opcoesComboboxTransportadoras([inativa, ativa, excluida]);
		expect(opcoes.map((o) => o.id)).toEqual([ativa.id]);
		expect(opcoes[0]?.sublabel).toBe("Caxias do Sul/RS · 11.222.333/0001-81");
		expect(opcoes[0]?.keywords).toContain("11222333000181");
	});

	it("mantém a inativa já selecionada, sinalizada no rótulo", () => {
		const opcoes = opcoesComboboxTransportadoras([inativa, ativa], inativa.id);
		expect(opcoes.map((o) => o.label)).toEqual([
			"Rodo Sul",
			"Antiga (inativa)",
		]);
		expect(opcoes[1]?.sublabel).toBeUndefined();
	});
});
