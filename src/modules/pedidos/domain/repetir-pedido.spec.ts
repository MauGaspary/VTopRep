import { describe, expect, it } from "vitest";
import { criarPedidoCompleto } from "./pedido";
import { montarRepeticaoCotacao } from "./repetir-pedido";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CLIENTE = "33333333-3333-4333-a333-333333333333";
const REP_A = "44444444-4444-4444-a444-444444444444";
const REP_B = "55555555-5555-4555-a555-555555555555";
const TABELA_ANTIGA = "66666666-6666-4666-a666-666666666666";
const TABELA_NOVA = "67676767-6767-4767-a767-676767676767";
const TRANSPORTADORA = "99999999-9999-4999-a999-999999999999";
const PROD_1 = "77777777-7777-4777-a777-777777777771";
const PROD_2 = "77777777-7777-4777-a777-777777777772";
const PROD_3 = "77777777-7777-4777-a777-777777777773";
const PROD_B = "88888888-8888-4888-a888-888888888888";
const AGORA = "2026-09-01T12:00:00.000Z";

const pedidoDe = (
	representadaId: string,
	itens: { produto_id: string; quantidade: number; desconto?: number }[],
) =>
	criarPedidoCompleto({
		tenantId: TENANT,
		percentualComissaoPadrao: 500,
		agora: AGORA,
		input: {
			cliente_id: CLIENTE,
			representada_id: representadaId,
			tabela_id: TABELA_ANTIGA,
			transportadora_id: TRANSPORTADORA,
			condicao_pagamento: "30/60 dias",
			tipo_frete: "FOB",
			observacoes: "Entregar pela manhã",
			itens: itens.map((i) => ({
				produto_id: i.produto_id,
				quantidade: i.quantidade,
				preco_unitario_tabela_centavos: 1000,
				percentual_desconto: i.desconto ?? 0,
			})),
		},
	});

const produto = (id: string, ativo = true) => ({
	id,
	sku: `SKU-${id.slice(-1)}`,
	descricao: `Produto ${id.slice(-1)}`,
	ativo,
	deleted_at: null,
});

let contador = 0;
const gerarLocalId = () => `l${++contador}`;

describe("montarRepeticaoCotacao", () => {
	it("repete produtos, quantidades e descontos com o preço da tabela vigente", () => {
		const resultado = montarRepeticaoCotacao({
			pedidos: [
				pedidoDe(REP_A, [
					{ produto_id: PROD_1, quantidade: 3, desconto: 1250 },
					{ produto_id: PROD_2, quantidade: 1 },
					{ produto_id: PROD_3, quantidade: 2 },
				]),
			],
			produtosPorId: new Map([
				[PROD_1, produto(PROD_1)],
				[PROD_2, produto(PROD_2, false)],
				[PROD_3, produto(PROD_3)],
			]),
			representadasAtivasIds: new Set([REP_A]),
			precificacaoPorRepresentada: new Map([
				[
					REP_A,
					{
						tabelaId: TABELA_NOVA,
						precosPorProduto: new Map([
							[PROD_1, { preco_base_centavos: 1290 }],
							[PROD_2, { preco_base_centavos: 500 }],
						]),
					},
				],
			]),
			gerarLocalId,
		});

		expect(resultado.valores).toMatchObject({
			cliente_id: CLIENTE,
			endereco_entrega_id: "",
			contato_id: "",
			transportadora_id: TRANSPORTADORA,
			observacoes: "Entregar pela manhã",
		});
		expect(resultado.valores.grupos).toHaveLength(1);
		expect(resultado.valores.grupos[0]).toMatchObject({
			representada_id: REP_A,
			tabela_id: TABELA_NOVA,
			tabela_manual: false,
			condicao_pagamento: "30/60 dias",
			tipo_frete: "FOB",
		});
		// preço novo (1290), nunca o antigo (1000)
		expect(resultado.valores.grupos[0]?.itens).toEqual([
			{
				localId: expect.any(String),
				produto_id: PROD_1,
				preco_unitario_tabela_centavos: 1290,
				quantidade: "3",
				percentual_desconto: "12,50",
			},
		]);
		expect(
			resultado.itensNaoRepetidos.map((i) => [i.produtoId, i.motivo]),
		).toEqual([
			[PROD_2, "produto_indisponivel"],
			[PROD_3, "sem_preco"],
		]);
		// o item novo não reaproveita o id do item antigo
		expect(resultado.valores.grupos[0]?.itens[0]).not.toHaveProperty("id");
	});

	it("cotação: repete cada fábrica; fábrica inativa ou sem tabela vigente fica de fora", () => {
		const resultado = montarRepeticaoCotacao({
			pedidos: [
				pedidoDe(REP_A, [{ produto_id: PROD_1, quantidade: 1 }]),
				pedidoDe(REP_B, [{ produto_id: PROD_B, quantidade: 5 }]),
			],
			produtosPorId: new Map([
				[PROD_1, produto(PROD_1)],
				[PROD_B, produto(PROD_B)],
			]),
			representadasAtivasIds: new Set([REP_A, REP_B]),
			precificacaoPorRepresentada: new Map([
				[
					REP_A,
					{
						tabelaId: TABELA_NOVA,
						precosPorProduto: new Map([[PROD_1, { preco_base_centavos: 10 }]]),
					},
				],
				[REP_B, { tabelaId: null, precosPorProduto: new Map() }],
			]),
			gerarLocalId,
		});

		expect(resultado.valores.grupos.map((g) => g.representada_id)).toEqual([
			REP_A,
		]);
		expect(resultado.itensNaoRepetidos).toEqual([
			{
				produtoId: PROD_B,
				representadaId: REP_B,
				sku: "SKU-8",
				descricao: "Produto 8",
				motivo: "sem_tabela_vigente",
			},
		]);

		const semRepA = montarRepeticaoCotacao({
			pedidos: [pedidoDe(REP_A, [{ produto_id: PROD_1, quantidade: 1 }])],
			produtosPorId: new Map([[PROD_1, produto(PROD_1)]]),
			representadasAtivasIds: new Set(),
			precificacaoPorRepresentada: new Map(),
			gerarLocalId,
		});
		expect(semRepA.valores.grupos).toEqual([]);
		expect(semRepA.itensNaoRepetidos[0]?.motivo).toBe("representada_inativa");
	});
});
