import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import {
	atualizarPedidoCompleto,
	calcularComissaoProjetada,
	calcularItemPedido,
	calcularPrecoLiquidoUnitario,
	calcularTotaisPedido,
	criarItemPedido,
	criarPedidoCompleto,
	escolherContatoPadrao,
	escolherEnderecoEntregaPadrao,
	excluirRascunhoPedido,
	ordenarPedidosPorDataDesc,
	PedidoImutavelError,
	resolverPercentualComissaoPedido,
	sincronizarItensPedido,
} from "./pedido";

const TENANT = "11111111-1111-4111-a111-111111111111";
const PEDIDO = "22222222-2222-4222-a222-222222222222";
const PRODUTO_A = "33333333-3333-4333-a333-333333333333";
const PRODUTO_B = "44444444-4444-4444-a444-444444444444";
const AGORA = "2026-10-29T12:00:00.000Z";

describe("calcularPrecoLiquidoUnitario", () => {
	it("mantém o preço de tabela quando o desconto é zero ou omitido", () => {
		expect(calcularPrecoLiquidoUnitario(15000)).toBe(15000);
		expect(calcularPrecoLiquidoUnitario(15000, 0)).toBe(15000);
	});

	it("aplica desconto percentual exato em centésimos (15,00% sobre R$ 100,00)", () => {
		expect(calcularPrecoLiquidoUnitario(10000, 1500)).toBe(8500);
	});

	it("zera o preço líquido com 100% de desconto ou preço base zero", () => {
		expect(calcularPrecoLiquidoUnitario(12345, 10000)).toBe(0);
		expect(calcularPrecoLiquidoUnitario(0, 1500)).toBe(0);
	});

	it("trata dízimas periódicas no percentual de desconto", () => {
		// 33,33% de 100 centavos => desconto 33 => líquido 67
		expect(calcularPrecoLiquidoUnitario(100, 3333)).toBe(67);
		// 66,67% de 100 centavos => desconto 67 => líquido 33
		expect(calcularPrecoLiquidoUnitario(100, 6667)).toBe(33);
		// 33,33% de 1000 centavos => desconto 333 => líquido 667
		expect(calcularPrecoLiquidoUnitario(1000, 3333)).toBe(667);
	});

	it("aplica arredondamento bancário (half-even) nos empates exatos do desconto", () => {
		// 50,00% de 1 centavo = 0,5 => desconto 0 (par) => líquido 1
		expect(calcularPrecoLiquidoUnitario(1, 5000)).toBe(1);
		// 50,00% de 5 centavos = 2,5 => desconto 2 (par) => líquido 3
		expect(calcularPrecoLiquidoUnitario(5, 5000)).toBe(3);
		// 50,00% de 15 centavos = 7,5 => desconto 8 (par) => líquido 7
		expect(calcularPrecoLiquidoUnitario(15, 5000)).toBe(7);
		// 1,00% de 250 centavos = 2,5 => desconto 2 (par) => líquido 248
		expect(calcularPrecoLiquidoUnitario(250, 100)).toBe(248);
		// 1,00% de 350 centavos = 3,5 => desconto 4 (par) => líquido 346
		expect(calcularPrecoLiquidoUnitario(350, 100)).toBe(346);
	});

	it("rejeita preço negativo, desconto fora de 0..10000 ou valores decimais", () => {
		expect(() => calcularPrecoLiquidoUnitario(-100, 0)).toThrow();
		expect(() => calcularPrecoLiquidoUnitario(100.5, 0)).toThrow();
		expect(() => calcularPrecoLiquidoUnitario(1000, -1)).toThrow();
		expect(() => calcularPrecoLiquidoUnitario(1000, 10001)).toThrow();
		expect(() => calcularPrecoLiquidoUnitario(1000, 10.5)).toThrow();
	});
});

describe("calcularItemPedido", () => {
	it("calcula preço líquido, desconto unitário, subtotal e desconto total do item", () => {
		const resultado = calcularItemPedido({
			quantidade: 4,
			preco_unitario_tabela_centavos: 2500, // R$ 25,00
			percentual_desconto: 1000, // 10,00%
		});

		expect(resultado).toEqual({
			quantidade: 4,
			preco_unitario_tabela_centavos: 2500,
			percentual_desconto: 1000,
			desconto_unitario_centavos: 250,
			preco_liquido_unitario_centavos: 2250,
			subtotal_tabela_centavos: 10000,
			desconto_total_centavos: 1000,
			subtotal_centavos: 9000,
		});
	});

	it("assume desconto zero quando omitido", () => {
		const resultado = calcularItemPedido({
			quantidade: 3,
			preco_unitario_tabela_centavos: 1200,
		});

		expect(resultado.percentual_desconto).toBe(0);
		expect(resultado.preco_liquido_unitario_centavos).toBe(1200);
		expect(resultado.subtotal_centavos).toBe(3600);
		expect(resultado.desconto_total_centavos).toBe(0);
	});

	it("calcula subtotal multiplicando a quantidade pelo preço líquido unitário já arredondado", () => {
		// 33,33% sobre R$ 1,00 (100 centavos) => desconto unitário = 33, líquido unitário = 67.
		// Com quantidade 3: subtotal = 3 * 67 = 201 centavos (e não 300 - 100 = 200).
		const resultado = calcularItemPedido({
			quantidade: 3,
			preco_unitario_tabela_centavos: 100,
			percentual_desconto: 3333,
		});

		expect(resultado.desconto_unitario_centavos).toBe(33);
		expect(resultado.preco_liquido_unitario_centavos).toBe(67);
		expect(resultado.subtotal_tabela_centavos).toBe(300);
		expect(resultado.subtotal_centavos).toBe(201);
		expect(resultado.desconto_total_centavos).toBe(99);
	});

	it("rejeita quantidade menor ou igual a zero ou estouro de inteiro seguro", () => {
		expect(() =>
			calcularItemPedido({
				quantidade: 0,
				preco_unitario_tabela_centavos: 1000,
			}),
		).toThrow();
		expect(() =>
			calcularItemPedido({
				quantidade: -2,
				preco_unitario_tabela_centavos: 1000,
			}),
		).toThrow();
		expect(() =>
			calcularItemPedido({
				quantidade: 2,
				preco_unitario_tabela_centavos: Number.MAX_SAFE_INTEGER,
			}),
		).toThrow(RangeError);
	});
});

describe("criarItemPedido", () => {
	it("cria entidade ItemPedido válida com valores financeiros derivados", () => {
		const id = "55555555-5555-4555-a555-555555555555";
		const item = criarItemPedido({
			id,
			tenantId: TENANT,
			pedidoId: PEDIDO,
			agora: AGORA,
			input: {
				produto_id: PRODUTO_A,
				quantidade: 6,
				preco_unitario_tabela_centavos: 1990,
				percentual_desconto: 500, // 5% de 1990 = 99,5 => 100 (half-even) => líquido 1890
			},
		});

		expect(item).toEqual({
			id,
			tenant_id: TENANT,
			pedido_id: PEDIDO,
			produto_id: PRODUTO_A,
			quantidade: 6,
			preco_unitario_tabela_centavos: 1990,
			percentual_desconto: 500,
			preco_liquido_unitario_centavos: 1890,
			subtotal_centavos: 11340,
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: null,
		});
	});
});

describe("calcularComissaoProjetada", () => {
	it("calcula comissão padrão em centavos (5,00% sobre R$ 1.000,00)", () => {
		expect(calcularComissaoProjetada(100000, 500)).toBe(5000);
	});

	it("aplica arredondamento bancário (half-even) em empates exatos da comissão", () => {
		// 5,00% de 50 centavos = 2,5 => 2 (par)
		expect(calcularComissaoProjetada(50, 500)).toBe(2);
		// 5,00% de 70 centavos = 3,5 => 4 (par)
		expect(calcularComissaoProjetada(70, 500)).toBe(4);
	});

	it("trata dízimas periódicas na comissão (3,33% sobre R$ 10,00)", () => {
		expect(calcularComissaoProjetada(1000, 333)).toBe(33);
	});

	it("rejeita total negativo ou percentual de comissão inválido", () => {
		expect(() => calcularComissaoProjetada(-1, 500)).toThrow();
		expect(() => calcularComissaoProjetada(1000, -10)).toThrow();
		expect(() => calcularComissaoProjetada(1000, 10001)).toThrow();
	});

	it("resolve a comissão diferenciada por segmento (Revenda vs. Fábrica) com half-even", () => {
		const configRep = {
			percentual_comissao_padrao: 625, // 6,25%
			percentual_comissao_revenda: 625, // 6,25%
			percentual_comissao_fabrica: 375, // 3,75%
		};
		const comissaoRevenda = resolverPercentualComissaoPedido(
			configRep,
			"REVENDA",
		);
		const comissaoFabrica = resolverPercentualComissaoPedido(
			configRep,
			"FABRICA",
		);
		expect(comissaoRevenda).toBe(625);
		expect(comissaoFabrica).toBe(375);

		// R$ 0,40 (40 centavos):
		// Revenda 6,25% de 40 = 2,5 => 2 centavos (half-even par)
		// Fábrica 3,75% de 40 = 1,5 => 2 centavos (half-even par)
		expect(calcularComissaoProjetada(40, comissaoRevenda)).toBe(2);
		expect(calcularComissaoProjetada(40, comissaoFabrica)).toBe(2);

		// R$ 1.000,00 (100000 centavos):
		// Revenda 6,25% = 6250 centavos; Fábrica 3,75% = 3750 centavos
		expect(calcularComissaoProjetada(100000, comissaoRevenda)).toBe(6250);
		expect(calcularComissaoProjetada(100000, comissaoFabrica)).toBe(3750);
	});
});

describe("calcularTotaisPedido", () => {
	it("retorna totalizadores zerados quando a lista de itens está vazia", () => {
		expect(calcularTotaisPedido([], 500)).toEqual({
			quantidade_itens: 0,
			quantidade_total_volumes: 0,
			valor_tabela_total_centavos: 0,
			desconto_total_centavos: 0,
			valor_total_centavos: 0,
			percentual_comissao_padrao: 500,
			comissao_projetada_centavos: 0,
		});
	});

	it("consolida múltiplos itens e projeta comissão com half-even", () => {
		const itens = [
			{
				// 2 un * (R$ 100,00 - 10% = R$ 90,00) = R$ 180,00 (18000)
				quantidade: 2,
				preco_unitario_tabela_centavos: 10000,
				percentual_desconto: 1000,
			},
			{
				// 5 un * (R$ 0,05 - 50% [2,5 -> 2] = R$ 0,03) = R$ 0,15 (15)
				quantidade: 5,
				preco_unitario_tabela_centavos: 5,
				percentual_desconto: 5000,
			},
		];

		// Total tabela = 20000 + 25 = 20025
		// Total líquido = 18000 + 15 = 18015
		// Desconto total = 20025 - 18015 = 2010
		// Comissão de 5,00% (500) sobre 18015 = 900,75 => 901 centavos
		expect(calcularTotaisPedido(itens, 500)).toEqual({
			quantidade_itens: 2,
			quantidade_total_volumes: 7,
			valor_tabela_total_centavos: 20025,
			desconto_total_centavos: 2010,
			valor_total_centavos: 18015,
			percentual_comissao_padrao: 500,
			comissao_projetada_centavos: 901,
		});
	});

	it("ignora itens marcados com deleted_at (tombstones)", () => {
		const ativo = criarItemPedido({
			id: "55555555-5555-4555-a555-555555555555",
			tenantId: TENANT,
			pedidoId: PEDIDO,
			agora: AGORA,
			input: {
				produto_id: PRODUTO_A,
				quantidade: 2,
				preco_unitario_tabela_centavos: 5000,
				percentual_desconto: 0,
			},
		});
		const excluido = {
			...criarItemPedido({
				id: "66666666-6666-4666-a666-666666666666",
				tenantId: TENANT,
				pedidoId: PEDIDO,
				agora: AGORA,
				input: {
					produto_id: PRODUTO_B,
					quantidade: 10,
					preco_unitario_tabela_centavos: 9000,
					percentual_desconto: 0,
				},
			}),
			deleted_at: AGORA,
		};

		const totais = calcularTotaisPedido([ativo, excluido], 750);

		expect(totais).toEqual({
			quantidade_itens: 1,
			quantidade_total_volumes: 2,
			valor_tabela_total_centavos: 10000,
			desconto_total_centavos: 0,
			valor_total_centavos: 10000,
			percentual_comissao_padrao: 750,
			comissao_projetada_centavos: 750,
		});
	});
});

describe("criarPedidoCompleto, atualizarPedidoCompleto e excluirRascunhoPedido", () => {
	const CLIENTE = "77777777-7777-4777-a777-777777777777";
	const REPRESENTADA = "88888888-8888-4888-a888-888888888888";
	const TABELA = "99999999-9999-4999-a999-999999999999";
	const ENDERECO = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
	const CONTATO = "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb";
	const DEPOIS = "2026-10-29T15:30:00.000Z";

	it("cria orçamento em rascunho calculando totais e comissão projetada", () => {
		const { pedido, itens } = criarPedidoCompleto({
			tenantId: TENANT,
			pedidoId: PEDIDO,
			agora: AGORA,
			percentualComissaoPadrao: 500, // 5%
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				endereco_entrega_id: ENDERECO,
				contato_id: CONTATO,
				condicao_pagamento: "30/60 dias",
				tipo_frete: "CIF",
				observacoes: "Entregar pela manhã",
				itens: [
					{
						produto_id: PRODUTO_A,
						quantidade: 4,
						preco_unitario_tabela_centavos: 10000,
						percentual_desconto: 1000, // 10% -> líquido 9000 -> subtotal 36000
					},
				],
			},
		});

		expect(pedido.status).toBe("rascunho");
		expect(pedido.valor_total_centavos).toBe(36000);
		expect(pedido.comissao_projetada_centavos).toBe(1800);
		expect(pedido.observacoes).toBe("Entregar pela manhã");
		expect(itens).toHaveLength(1);
		expect(itens[0]?.subtotal_centavos).toBe(36000);
	});

	it("reconcilia itens ao atualizar rascunho e emite o pedido bloqueando edições futuras", () => {
		const inicial = criarPedidoCompleto({
			tenantId: TENANT,
			pedidoId: PEDIDO,
			agora: AGORA,
			percentualComissaoPadrao: 500,
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30 dias",
				tipo_frete: "FOB",
				itens: [
					{
						produto_id: PRODUTO_A,
						quantidade: 2,
						preco_unitario_tabela_centavos: 5000,
						percentual_desconto: 0,
					},
					{
						produto_id: PRODUTO_B,
						quantidade: 1,
						preco_unitario_tabela_centavos: 3000,
						percentual_desconto: 0,
					},
				],
			},
		});

		const itemMantido = inicial.itens[0];
		const itemRemovido = inicial.itens[1];
		if (!itemMantido || !itemRemovido) {
			throw new Error("Itens iniciais ausentes");
		}

		// Mantém itemMantido inalterado, remove itemRemovido e emite o pedido
		const emitido = atualizarPedidoCompleto({
			existente: inicial.pedido,
			itensExistentes: inicial.itens,
			tenantId: TENANT,
			agora: DEPOIS,
			status: "emitido",
			percentualComissaoPadrao: 500,
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30 dias",
				tipo_frete: "FOB",
				itens: [
					{
						id: itemMantido.id,
						produto_id: itemMantido.produto_id,
						quantidade: itemMantido.quantidade,
						preco_unitario_tabela_centavos:
							itemMantido.preco_unitario_tabela_centavos,
						percentual_desconto: itemMantido.percentual_desconto,
					},
				],
			},
		});

		expect(emitido.pedido.status).toBe("emitido");
		expect(emitido.pedido.valor_total_centavos).toBe(10000);
		expect(emitido.pedido.data_emissao).toBe(DEPOIS);
		expect(emitido.itens).toEqual([itemMantido]);
		expect(emitido.gravarItens).toHaveLength(1);
		expect(emitido.gravarItens[0]).toMatchObject({
			id: itemRemovido.id,
			deleted_at: DEPOIS,
		});

		// Pedido emitido é imutável
		expect(() =>
			atualizarPedidoCompleto({
				existente: emitido.pedido,
				itensExistentes: emitido.itens,
				tenantId: TENANT,
				agora: DEPOIS,
				percentualComissaoPadrao: 500,
				input: {
					cliente_id: CLIENTE,
					representada_id: REPRESENTADA,
					tabela_id: TABELA,
					condicao_pagamento: "À vista",
					tipo_frete: "CIF",
					itens: [
						{
							produto_id: PRODUTO_A,
							quantidade: 1,
							preco_unitario_tabela_centavos: 5000,
						},
					],
				},
			}),
		).toThrow(PedidoImutavelError);

		expect(() =>
			excluirRascunhoPedido({
				existente: emitido.pedido,
				itensExistentes: emitido.itens,
				tenantId: TENANT,
				agora: DEPOIS,
			}),
		).toThrow(PedidoImutavelError);
	});

	it("exclui rascunho aplicando soft delete no pedido e em seus itens", () => {
		const rascunho = criarPedidoCompleto({
			tenantId: TENANT,
			pedidoId: PEDIDO,
			agora: AGORA,
			percentualComissaoPadrao: 500,
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30 dias",
				tipo_frete: "CIF",
				itens: [
					{
						produto_id: PRODUTO_A,
						quantidade: 1,
						preco_unitario_tabela_centavos: 2000,
					},
				],
			},
		});

		const excluido = excluirRascunhoPedido({
			existente: rascunho.pedido,
			itensExistentes: rascunho.itens,
			tenantId: TENANT,
			agora: DEPOIS,
		});

		expect(excluido.pedido.deleted_at).toBe(DEPOIS);
		expect(excluido.itens[0]?.deleted_at).toBe(DEPOIS);
	});

	it("valida isolamento de tenant nas operações de pedido e itens", () => {
		const OUTRO_TENANT = "cccccccc-cccc-4ccc-accc-cccccccccccc";
		const rascunho = criarPedidoCompleto({
			tenantId: TENANT,
			pedidoId: PEDIDO,
			agora: AGORA,
			percentualComissaoPadrao: 500,
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30 dias",
				tipo_frete: "CIF",
				itens: [
					{
						produto_id: PRODUTO_A,
						quantidade: 1,
						preco_unitario_tabela_centavos: 2000,
					},
				],
			},
		});

		expect(() =>
			sincronizarItensPedido({
				tenantId: OUTRO_TENANT,
				pedidoId: PEDIDO,
				agora: DEPOIS,
				itensInput: [],
				existentes: rascunho.itens,
			}),
		).toThrow(TenantDivergenteError);

		expect(() =>
			excluirRascunhoPedido({
				existente: rascunho.pedido,
				itensExistentes: rascunho.itens,
				tenantId: OUTRO_TENANT,
				agora: DEPOIS,
			}),
		).toThrow(TenantDivergenteError);
	});
});

describe("auxiliares de contexto e ordenação de pedidos", () => {
	it("escolhe endereço ENTREGA, depois PRINCIPAL, depois o primeiro disponível", () => {
		expect(escolherEnderecoEntregaPadrao([])).toBe("");
		expect(
			escolherEnderecoEntregaPadrao([
				{ id: "1", tipo_endereco: "COBRANCA" },
				{ id: "2", tipo_endereco: "PRINCIPAL" },
				{ id: "3", tipo_endereco: "ENTREGA" },
			]),
		).toBe("3");
		expect(
			escolherEnderecoEntregaPadrao([
				{ id: "1", tipo_endereco: "COBRANCA" },
				{ id: "2", tipo_endereco: "PRINCIPAL" },
			]),
		).toBe("2");
	});

	it("escolhe contato COMPRADOR ou o primeiro disponível", () => {
		expect(escolherContatoPadrao([])).toBe("");
		expect(
			escolherContatoPadrao([
				{ id: "1", papel: "FINANCEIRO" },
				{ id: "2", papel: "COMPRADOR" },
			]),
		).toBe("2");
		expect(escolherContatoPadrao([{ id: "1", papel: null }])).toBe("1");
	});

	it("ordena pedidos do mais recente para o mais antigo", () => {
		const CLIENTE = "77777777-7777-4777-a777-777777777777";
		const REPRESENTADA = "88888888-8888-4888-a888-888888888888";
		const TABELA = "99999999-9999-4999-a999-999999999999";

		const antigo = criarPedidoCompleto({
			tenantId: TENANT,
			agora: "2026-10-01T10:00:00.000Z",
			percentualComissaoPadrao: 500,
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30 dias",
				tipo_frete: "CIF",
				itens: [
					{
						produto_id: PRODUTO_A,
						quantidade: 1,
						preco_unitario_tabela_centavos: 1000,
					},
				],
			},
		}).pedido;

		const recente = criarPedidoCompleto({
			tenantId: TENANT,
			agora: "2026-10-20T10:00:00.000Z",
			percentualComissaoPadrao: 500,
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30 dias",
				tipo_frete: "CIF",
				itens: [
					{
						produto_id: PRODUTO_A,
						quantidade: 1,
						preco_unitario_tabela_centavos: 1000,
					},
				],
			},
		}).pedido;

		expect(ordenarPedidosPorDataDesc([antigo, recente])).toEqual([
			recente,
			antigo,
		]);
	});
});
