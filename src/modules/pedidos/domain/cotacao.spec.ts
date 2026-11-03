import { describe, expect, it } from "vitest";
import {
	calcularTotaisCotacao,
	cotacaoEditavel,
	desmembrarCotacao,
	ordenarPedidosDaCotacao,
	planejarGravacaoCotacao,
	resolverCotacaoGrupoId,
} from "./cotacao";
import type { CotacaoInput } from "./cotacao.schema";
import { criarPedidoCompleto } from "./pedido";
import type { Pedido } from "./pedido.schema";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CLIENTE = "33333333-3333-4333-a333-333333333333";
const REP_A = "44444444-4444-4444-a444-444444444444";
const REP_B = "55555555-5555-4555-a555-555555555555";
const REP_C = "56565656-5656-4656-a656-565656565656";
const TABELA_A = "66666666-6666-4666-a666-666666666666";
const TABELA_B = "67676767-6767-4767-a767-676767676767";
const PRODUTO = "77777777-7777-4777-a777-777777777777";
const TRANSPORTADORA = "99999999-9999-4999-a999-999999999999";

const grupo = (representadaId: string, tabelaId: string) => ({
	representada_id: representadaId,
	tabela_id: tabelaId,
	condicao_pagamento: "30 dias",
	tipo_frete: "CIF" as const,
	itens: [
		{ produto_id: PRODUTO, quantidade: 1, preco_unitario_tabela_centavos: 100 },
	],
});

const cotacao = (grupos: CotacaoInput["grupos"]): CotacaoInput => ({
	cliente_id: CLIENTE,
	transportadora_id: TRANSPORTADORA,
	observacoes: "  Entregar junto  ",
	grupos,
});

const pedido = (
	representadaId: string,
	createdAt: string,
	overrides: Partial<Pedido> = {},
): Pedido => ({
	...criarPedidoCompleto({
		tenantId: TENANT,
		percentualComissaoPadrao: 500,
		agora: createdAt,
		input: {
			cliente_id: CLIENTE,
			representada_id: representadaId,
			tabela_id: TABELA_A,
			condicao_pagamento: "30 dias",
			tipo_frete: "CIF",
			itens: [
				{
					produto_id: PRODUTO,
					quantidade: 1,
					preco_unitario_tabela_centavos: 100,
				},
			],
		},
	}).pedido,
	...overrides,
});

describe("desmembrarCotacao", () => {
	it("gera 1 PedidoInput por fábrica replicando o contexto do cliente", () => {
		const pedidos = desmembrarCotacao(
			cotacao([grupo(REP_A, TABELA_A), grupo(REP_B, TABELA_B)]),
		);
		expect(pedidos).toHaveLength(2);
		expect(pedidos.map((p) => [p.representada_id, p.tabela_id])).toEqual([
			[REP_A, TABELA_A],
			[REP_B, TABELA_B],
		]);
		for (const p of pedidos) {
			expect(p).toMatchObject({
				cliente_id: CLIENTE,
				transportadora_id: TRANSPORTADORA,
				endereco_entrega_id: null,
				contato_id: null,
				observacoes: "Entregar junto",
			});
		}
	});

	it("rejeita cotação sem seções ou com a mesma fábrica duas vezes", () => {
		expect(() => desmembrarCotacao(cotacao([]))).toThrow(
			"Adicione pelo menos um item",
		);
		expect(() =>
			desmembrarCotacao(
				cotacao([grupo(REP_A, TABELA_A), grupo(REP_A, TABELA_A)]),
			),
		).toThrow("mais de uma seção");
	});
});

describe("planejarGravacaoCotacao", () => {
	it("casa pedidos existentes pela representada e exclui as fábricas removidas", () => {
		const a = pedido(REP_A, "2026-11-01T10:00:00.000Z");
		const b = pedido(REP_B, "2026-11-01T10:00:01.000Z");

		const plano = planejarGravacaoCotacao([REP_A, REP_C], [b, a]);
		expect(plano.existentePorRepresentada.get(REP_A)).toBe(a);
		expect(plano.existentePorRepresentada.has(REP_C)).toBe(false);
		expect(plano.excluir).toEqual([b]);
	});

	it("com dois pedidos da mesma fábrica, mantém o mais antigo e exclui o outro", () => {
		const antigo = pedido(REP_A, "2026-11-01T10:00:00.000Z");
		const duplicado = pedido(REP_A, "2026-11-01T11:00:00.000Z");
		const plano = planejarGravacaoCotacao([REP_A], [duplicado, antigo]);
		expect(plano.existentePorRepresentada.get(REP_A)).toBe(antigo);
		expect(plano.excluir).toEqual([duplicado]);
	});
});

describe("resolverCotacaoGrupoId", () => {
	const gerar = () => "c0c0c0c0-1111-4111-a111-111111111111";

	it("preserva o agrupador existente", () => {
		expect(
			resolverCotacaoGrupoId(
				[{ cotacao_grupo_id: null }, { cotacao_grupo_id: "existente" }],
				1,
				gerar,
			),
		).toBe("existente");
	});

	it("cria agrupador só quando há mais de uma fábrica", () => {
		expect(resolverCotacaoGrupoId([], 2, gerar)).toBe(gerar());
		expect(resolverCotacaoGrupoId([], 1, gerar)).toBeNull();
		expect(resolverCotacaoGrupoId([{ cotacao_grupo_id: null }], 1, gerar)).toBe(
			null,
		);
	});
});

describe("ordenarPedidosDaCotacao / cotacaoEditavel / calcularTotaisCotacao", () => {
	it("ordena por criação e depois por id", () => {
		const lista = [
			{ id: "b", created_at: "2026-11-01T10:00:00.000Z" },
			{ id: "c", created_at: "2026-11-01T09:00:00.000Z" },
			{ id: "a", created_at: "2026-11-01T10:00:00.000Z" },
		];
		expect(ordenarPedidosDaCotacao(lista).map((p) => p.id)).toEqual([
			"c",
			"a",
			"b",
		]);
	});

	it("só é editável quando todos os pedidos são rascunhos", () => {
		expect(
			cotacaoEditavel([{ status: "rascunho" }, { status: "rascunho" }]),
		).toBe(true);
		expect(
			cotacaoEditavel([{ status: "rascunho" }, { status: "emitido" }]),
		).toBe(false);
		expect(cotacaoEditavel([])).toBe(false);
	});

	it("soma total e comissão de todos os pedidos em centavos", () => {
		expect(
			calcularTotaisCotacao([
				{ valor_total_centavos: 33333, comissao_projetada_centavos: 2500 },
				{ valor_total_centavos: 16667, comissao_projetada_centavos: 833 },
			]),
		).toEqual({
			quantidade_pedidos: 2,
			valor_total_centavos: 50000,
			comissao_projetada_centavos: 3333,
		});
	});
});
