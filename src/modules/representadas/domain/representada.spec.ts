import { describe, expect, it } from "vitest";
import {
	atualizarRepresentada,
	correspondeBuscaRepresentada,
	criarRepresentada,
	inativarRepresentada,
	ordenarRepresentadas,
	ordenarRepresentadasComInativasNoFim,
	reativarRepresentada,
	TenantDivergenteError,
} from "./representada";
import {
	type RepresentadaInput,
	RepresentadaInputSchema,
} from "./representada.schema";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const ID = "33333333-3333-4333-a333-333333333333";
const AGORA = "2026-10-22T12:00:00.000Z";
const DEPOIS = "2026-10-23T12:00:00.000Z";

const inputValido = (
	overrides: Partial<RepresentadaInput> = {},
): RepresentadaInput => ({
	razao_social: "Fábrica de Calçados Ltda",
	nome_fantasia: "Calçados Sul",
	cnpj: "11.222.333/0001-81",
	percentual_comissao_padrao: 500,
	valor_pedido_minimo_centavos: 150000,
	regras_frete_padrao: "CIF",
	...overrides,
});

const criar = (overrides: Partial<RepresentadaInput> = {}) =>
	criarRepresentada({
		tenantId: TENANT,
		input: inputValido(overrides),
		id: ID,
		agora: AGORA,
	});

describe("criarRepresentada", () => {
	it("cria entidade com tenant, timestamps e CNPJ normalizado", () => {
		const r = criar();
		expect(r).toEqual({
			id: ID,
			tenant_id: TENANT,
			razao_social: "Fábrica de Calçados Ltda",
			nome_fantasia: "Calçados Sul",
			cnpj: "11222333000181",
			percentual_comissao_padrao: 500,
			valor_pedido_minimo_centavos: 150000,
			regras_frete_padrao: "CIF",
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: null,
		});
	});

	it("remove espaços extras de razão social e nome fantasia", () => {
		const r = criar({ razao_social: "  ACME  ", nome_fantasia: " Acme " });
		expect(r.razao_social).toBe("ACME");
		expect(r.nome_fantasia).toBe("Acme");
	});

	it("aceita CNPJ alfanumérico", () => {
		expect(criar({ cnpj: "12.abc.345/01de-35" }).cnpj).toBe("12ABC34501DE35");
	});

	it("aceita limites de comissão 0% e 100% e pedido mínimo zero", () => {
		expect(
			criar({ percentual_comissao_padrao: 0 }).percentual_comissao_padrao,
		).toBe(0);
		expect(
			criar({ percentual_comissao_padrao: 10000 }).percentual_comissao_padrao,
		).toBe(10000);
		expect(
			criar({ valor_pedido_minimo_centavos: 0 }).valor_pedido_minimo_centavos,
		).toBe(0);
	});

	it.each([
		["CNPJ inválido", { cnpj: "11.222.333/0001-82" }],
		["CNPJ vazio", { cnpj: "" }],
		["razão social vazia", { razao_social: "   " }],
		["nome fantasia vazio", { nome_fantasia: "" }],
		["comissão negativa", { percentual_comissao_padrao: -1 }],
		["comissão acima de 100%", { percentual_comissao_padrao: 10001 }],
		["comissão decimal (não inteira)", { percentual_comissao_padrao: 5.5 }],
		["pedido mínimo decimal", { valor_pedido_minimo_centavos: 100.5 }],
		["pedido mínimo negativo", { valor_pedido_minimo_centavos: -100 }],
	] satisfies [string, Partial<RepresentadaInput>][])(
		"rejeita %s",
		(_, overrides) => {
			expect(() => criar(overrides)).toThrow();
		},
	);

	it("rejeita regra de frete desconhecida", () => {
		const resultado = RepresentadaInputSchema.safeParse({
			...inputValido(),
			regras_frete_padrao: "EXW",
		});
		expect(resultado.success).toBe(false);
	});

	it("rejeita tenant_id inválido", () => {
		expect(() =>
			criarRepresentada({
				tenantId: "nao-e-uuid",
				input: inputValido(),
				id: ID,
				agora: AGORA,
			}),
		).toThrow();
	});
});

describe("atualizarRepresentada", () => {
	it("aplica alterações preservando id, tenant e created_at", () => {
		const original = criar();
		const atualizada = atualizarRepresentada(
			original,
			TENANT,
			inputValido({ nome_fantasia: "Novo Nome", regras_frete_padrao: "FOB" }),
			DEPOIS,
		);
		expect(atualizada.id).toBe(ID);
		expect(atualizada.tenant_id).toBe(TENANT);
		expect(atualizada.created_at).toBe(AGORA);
		expect(atualizada.updated_at).toBe(DEPOIS);
		expect(atualizada.nome_fantasia).toBe("Novo Nome");
		expect(atualizada.regras_frete_padrao).toBe("FOB");
	});

	it("bloqueia atualização com tenant divergente", () => {
		expect(() =>
			atualizarRepresentada(criar(), OUTRO_TENANT, inputValido(), DEPOIS),
		).toThrow(TenantDivergenteError);
	});
});

describe("inativarRepresentada", () => {
	it("marca deleted_at e updated_at", () => {
		const inativa = inativarRepresentada(criar(), TENANT, DEPOIS);
		expect(inativa.deleted_at).toBe(DEPOIS);
		expect(inativa.updated_at).toBe(DEPOIS);
	});

	it("é idempotente", () => {
		const inativa = inativarRepresentada(criar(), TENANT, DEPOIS);
		const novamente = inativarRepresentada(
			inativa,
			TENANT,
			"2026-12-01T00:00:00.000Z",
		);
		expect(novamente).toBe(inativa);
	});

	it("bloqueia inativação com tenant divergente", () => {
		expect(() => inativarRepresentada(criar(), OUTRO_TENANT, DEPOIS)).toThrow(
			TenantDivergenteError,
		);
	});
});

describe("reativarRepresentada", () => {
	it("limpa deleted_at e atualiza updated_at", () => {
		const inativa = inativarRepresentada(criar(), TENANT, DEPOIS);
		const reativada = reativarRepresentada(
			inativa,
			TENANT,
			"2026-10-24T12:00:00.000Z",
		);
		expect(reativada.deleted_at).toBeNull();
		expect(reativada.updated_at).toBe("2026-10-24T12:00:00.000Z");
	});

	it("é idempotente se já estiver ativa", () => {
		const ativa = criar();
		const reativada = reativarRepresentada(ativa, TENANT, DEPOIS);
		expect(reativada).toBe(ativa);
	});

	it("bloqueia reativação com tenant divergente", () => {
		const inativa = inativarRepresentada(criar(), TENANT, DEPOIS);
		expect(() => inativarRepresentada(inativa, OUTRO_TENANT, DEPOIS)).toThrow(
			TenantDivergenteError,
		);
	});
});

describe("correspondeBuscaRepresentada", () => {
	const r = criar();

	it("retorna true para termo vazio ou indefinido", () => {
		expect(correspondeBuscaRepresentada(r, undefined)).toBe(true);
		expect(correspondeBuscaRepresentada(r, "   ")).toBe(true);
	});

	it("busca por nome fantasia e razão social ignorando caixa e acentos", () => {
		expect(correspondeBuscaRepresentada(r, "calcados")).toBe(true);
		expect(correspondeBuscaRepresentada(r, "FÁBRICA")).toBe(true);
		expect(correspondeBuscaRepresentada(r, "têxtil")).toBe(false);
	});

	it("busca por CNPJ formatado ou não", () => {
		expect(correspondeBuscaRepresentada(r, "11.222.333")).toBe(true);
		expect(correspondeBuscaRepresentada(r, "0001-81")).toBe(true);
		expect(correspondeBuscaRepresentada(r, "99999")).toBe(false);
	});
});

describe("ordenarRepresentadas", () => {
	it("ordena por nome fantasia sem mutar a lista original", () => {
		const lista = [
			{ ...criar(), nome_fantasia: "Zeta" },
			{ ...criar(), nome_fantasia: "Ácido" },
			{ ...criar(), nome_fantasia: "beta" },
		];
		const ordenada = ordenarRepresentadas(lista);
		expect(ordenada.map((x) => x.nome_fantasia)).toEqual([
			"Ácido",
			"beta",
			"Zeta",
		]);
		expect(lista[0].nome_fantasia).toBe("Zeta");
	});
});

describe("ordenarRepresentadasComInativasNoFim", () => {
	it("coloca ativas primeiro e inativas no final, ordenadas por nome fantasia", () => {
		const lista = [
			{ ...criar(), nome_fantasia: "Zeta Ativa", deleted_at: null },
			{ ...criar(), nome_fantasia: "Alfa Inativa", deleted_at: AGORA },
			{ ...criar(), nome_fantasia: "Beta Ativa", deleted_at: null },
			{ ...criar(), nome_fantasia: "Zeta Inativa", deleted_at: AGORA },
		];

		const ordenada = ordenarRepresentadasComInativasNoFim(lista);
		expect(ordenada.map((x) => x.nome_fantasia)).toEqual([
			"Beta Ativa",
			"Zeta Ativa",
			"Alfa Inativa",
			"Zeta Inativa",
		]);
	});
});
