import { describe, expect, it } from "vitest";
import {
	FILTROS_HISTORICO_PADRAO,
	FiltrosHistoricoSchema,
	filtrarHistorico,
	ORDENACAO_HISTORICO_PADRAO,
	ordenarHistorico,
	resumirHistoricoCliente,
} from "./historico-cliente";
import type { StatusPedido } from "./pedido.schema";

const REP_A = "44444444-4444-4444-a444-444444444444";
const REP_B = "55555555-5555-4555-a555-555555555555";

const pedido = (
	id: string,
	dia: string,
	valor: number,
	status: StatusPedido = "emitido",
	representada_id = REP_A,
) => ({
	id,
	representada_id,
	status,
	data_emissao: `${dia}T12:00:00.000Z`,
	updated_at: `${dia}T12:00:00.000Z`,
	valor_total_centavos: valor,
});

const lista = [
	pedido("a", "2026-09-10", 50000),
	pedido("b", "2026-11-01", 12000, "rascunho", REP_B),
	pedido("c", "2026-10-15", 99999, "faturado_total", REP_B),
	pedido("d", "2026-10-20", 30000, "cancelado"),
];

describe("ordenarHistorico", () => {
	it("padrão: do mais recente para o mais antigo", () => {
		expect(
			ordenarHistorico(lista, ORDENACAO_HISTORICO_PADRAO).map((p) => p.id),
		).toEqual(["b", "d", "c", "a"]);
	});

	it("data crescente", () => {
		expect(
			ordenarHistorico(lista, { criterio: "data", direcao: "asc" }).map(
				(p) => p.id,
			),
		).toEqual(["a", "c", "d", "b"]);
	});

	it("valor, do maior para o menor", () => {
		expect(
			ordenarHistorico(lista, { criterio: "valor", direcao: "desc" }).map(
				(p) => p.id,
			),
		).toEqual(["c", "a", "d", "b"]);
	});

	it("status segue o ciclo do pedido; empate pela data mais recente", () => {
		const comEmpate = [...lista, pedido("e", "2026-11-02", 1000)];
		expect(
			ordenarHistorico(comEmpate, { criterio: "status", direcao: "asc" }).map(
				(p) => p.id,
			),
		).toEqual(["b", "e", "a", "c", "d"]);
	});

	it("representada em ordem alfabética do nome", () => {
		const nomes = new Map([
			[REP_A, "Zeta Fábrica"],
			[REP_B, "alfa Indústria"],
		]);
		expect(
			ordenarHistorico(
				lista,
				{ criterio: "representada", direcao: "asc" },
				(id) => nomes.get(id) ?? "",
			).map((p) => p.id),
		).toEqual(["b", "c", "d", "a"]);
	});
});

describe("filtrarHistorico", () => {
	it("sem filtros, mantém tudo", () => {
		expect(filtrarHistorico(lista, FILTROS_HISTORICO_PADRAO)).toHaveLength(4);
	});

	it("esconde rascunhos, filtra por representada, status e período", () => {
		expect(
			filtrarHistorico(lista, {
				...FILTROS_HISTORICO_PADRAO,
				incluir_rascunhos: false,
			}).map((p) => p.id),
		).toEqual(["a", "c", "d"]);
		expect(
			filtrarHistorico(lista, {
				...FILTROS_HISTORICO_PADRAO,
				representada_id: REP_B,
			}).map((p) => p.id),
		).toEqual(["b", "c"]);
		expect(
			filtrarHistorico(lista, {
				...FILTROS_HISTORICO_PADRAO,
				status: "cancelado",
			}).map((p) => p.id),
		).toEqual(["d"]);
		expect(
			filtrarHistorico(lista, {
				...FILTROS_HISTORICO_PADRAO,
				data_inicio: "2026-10-15",
				data_fim: "2026-10-20",
			}).map((p) => p.id),
		).toEqual(["c", "d"]);
	});

	it("o schema rejeita período invertido", () => {
		expect(
			FiltrosHistoricoSchema.safeParse({
				...FILTROS_HISTORICO_PADRAO,
				data_inicio: "2026-10-20",
				data_fim: "2026-10-01",
			}).success,
		).toBe(false);
	});
});

describe("resumirHistoricoCliente", () => {
	it("conta só pedidos emitidos ou superiores e calcula o ticket médio half-even", () => {
		// a (50000) + c (99999) = 149999; 149999 / 2 = 74999,5 → par = 75000
		expect(resumirHistoricoCliente(lista)).toEqual({
			quantidade_pedidos: 2,
			valor_total_centavos: 149999,
			ticket_medio_centavos: 75000,
			data_ultima_compra: "2026-10-15",
		});
	});

	it("dízima: 3 pedidos de R$ 100,00 + R$ 0,01", () => {
		const resumo = resumirHistoricoCliente([
			pedido("x", "2026-01-01", 10000),
			pedido("y", "2026-02-01", 10000),
			pedido("z", "2026-03-01", 1),
		]);
		// 20001 / 3 = 6667
		expect(resumo.ticket_medio_centavos).toBe(6667);
	});

	it("sem compras: zeros e sem data", () => {
		expect(
			resumirHistoricoCliente([pedido("r", "2026-01-01", 500, "rascunho")]),
		).toEqual({
			quantidade_pedidos: 0,
			valor_total_centavos: 0,
			ticket_medio_centavos: 0,
			data_ultima_compra: null,
		});
	});
});
