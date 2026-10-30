import { describe, expect, it } from "vitest";
import { criarPedidoCompleto } from "./pedido";
import {
	adicionarOuIncrementarItemForm,
	ajustarDeltaQuantidadeItemForm,
	calcularPreviaItemForm,
	calcularPreviaTotaisForm,
	chaveErroItemPedido,
	reprecificarItensFormPorTabela,
	validarFormularioPedido,
	valoresIniciaisPedidoForm,
} from "./pedido-form";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CLIENTE = "22222222-2222-4222-a222-222222222222";
const REPRESENTADA = "33333333-3333-4333-a333-333333333333";
const TABELA = "44444444-4444-4444-a444-444444444444";
const PRODUTO_A = "55555555-5555-4555-a555-555555555555";
const PRODUTO_B = "66666666-6666-4666-a666-666666666666";
const AGORA = "2026-10-29T12:00:00.000Z";

describe("valoresIniciaisPedidoForm", () => {
	it("inicia sem cliente, representada ou condição pré-selecionados quando não há defaults", () => {
		expect(valoresIniciaisPedidoForm()).toEqual({
			cliente_id: "",
			representada_id: "",
			tabela_id: "",
			endereco_entrega_id: "",
			contato_id: "",
			condicao_pagamento: "",
			tipo_frete: "CIF",
			observacoes: "",
			itens: [],
		});
	});

	it("preenche defaults em novo orçamento quando informados por atalho", () => {
		const inicial = valoresIniciaisPedidoForm(undefined, {
			clienteId: CLIENTE,
			representadaId: REPRESENTADA,
			tabelaId: TABELA,
			tipoFrete: "FOB",
			condicaoPagamento: "28 dias",
		});

		expect(inicial).toEqual({
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			endereco_entrega_id: "",
			contato_id: "",
			condicao_pagamento: "28 dias",
			tipo_frete: "FOB",
			observacoes: "",
			itens: [],
		});
	});

	it("hidrata formulário a partir de um PedidoCompleto existente", () => {
		const completo = criarPedidoCompleto({
			tenantId: TENANT,
			agora: AGORA,
			percentualComissaoPadrao: 500,
			input: {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30/60 dias",
				tipo_frete: "CIF",
				observacoes: "Urgente",
				itens: [
					{
						produto_id: PRODUTO_A,
						quantidade: 3,
						preco_unitario_tabela_centavos: 1500,
						percentual_desconto: 1250, // 12,50%
					},
				],
			},
		});

		const form = valoresIniciaisPedidoForm(completo);
		expect(form.cliente_id).toBe(CLIENTE);
		expect(form.condicao_pagamento).toBe("30/60 dias");
		expect(form.observacoes).toBe("Urgente");
		expect(form.itens).toHaveLength(1);
		expect(form.itens[0]).toMatchObject({
			produto_id: PRODUTO_A,
			quantidade: "3",
			percentual_desconto: "12,50",
			preco_unitario_tabela_centavos: 1500,
		});
	});
});

describe("manipulação ágil de itens no formulário", () => {
	it("adiciona novo produto e incrementa quantidade quando adicionado novamente", () => {
		let itens = adicionarOuIncrementarItemForm(
			[],
			PRODUTO_A,
			2500,
			() => "local-1",
		);
		expect(itens).toEqual([
			{
				localId: "local-1",
				produto_id: PRODUTO_A,
				preco_unitario_tabela_centavos: 2500,
				quantidade: "1",
				percentual_desconto: "",
			},
		]);

		// Aplica desconto na linha e adiciona o mesmo produto novamente
		itens = itens.map((i) => ({ ...i, percentual_desconto: "5,00" }));
		itens = adicionarOuIncrementarItemForm(
			itens,
			PRODUTO_A,
			2500,
			() => "local-2",
			2,
		);

		expect(itens).toHaveLength(1);
		expect(itens[0]).toMatchObject({
			localId: "local-1",
			quantidade: "3",
			percentual_desconto: "5,00",
		});
	});

	it("ajusta quantidade por delta sem permitir valor menor que 1", () => {
		const inicial = [
			{
				localId: "local-1",
				produto_id: PRODUTO_A,
				preco_unitario_tabela_centavos: 1000,
				quantidade: "2",
				percentual_desconto: "",
			},
		];

		const reduzido = ajustarDeltaQuantidadeItemForm(inicial, "local-1", -1);
		expect(reduzido[0]?.quantidade).toBe("1");

		const pisoUm = ajustarDeltaQuantidadeItemForm(reduzido, "local-1", -5);
		expect(pisoUm[0]?.quantidade).toBe("1");

		const aumentado = ajustarDeltaQuantidadeItemForm(pisoUm, "local-1", 4);
		expect(aumentado[0]?.quantidade).toBe("5");
	});

	it("reprecifica itens ao trocar de tabela de preço identificando produtos sem preço", () => {
		const itens = [
			{
				localId: "local-1",
				produto_id: PRODUTO_A,
				preco_unitario_tabela_centavos: 1000,
				quantidade: "2",
				percentual_desconto: "5,00",
			},
			{
				localId: "local-2",
				produto_id: PRODUTO_B,
				preco_unitario_tabela_centavos: 2000,
				quantidade: "1",
				percentual_desconto: "",
			},
		];

		const novaTabela = new Map([[PRODUTO_A, { preco_base_centavos: 1200 }]]);
		const resultado = reprecificarItensFormPorTabela(itens, novaTabela);

		expect(resultado.itens[0]?.preco_unitario_tabela_centavos).toBe(1200);
		expect(resultado.itens[1]?.preco_unitario_tabela_centavos).toBe(2000);
		expect(resultado.produtosSemPrecoIds).toEqual([PRODUTO_B]);
	});
});

describe("calcularPreviaItemForm e calcularPreviaTotaisForm", () => {
	it("calcula prévia da linha e dos totais em tempo real", () => {
		const linhaValida = {
			localId: "local-1",
			produto_id: PRODUTO_A,
			preco_unitario_tabela_centavos: 10000,
			quantidade: "3",
			percentual_desconto: "10,00",
		};
		const linhaEmDigitacao = {
			localId: "local-2",
			produto_id: PRODUTO_B,
			preco_unitario_tabela_centavos: 5000,
			quantidade: "",
			percentual_desconto: "abc",
		};

		const previaValida = calcularPreviaItemForm(linhaValida);
		expect(previaValida?.preco_liquido_unitario_centavos).toBe(9000);
		expect(previaValida?.subtotal_centavos).toBe(27000);

		expect(calcularPreviaItemForm(linhaEmDigitacao)).toBeNull();

		const totais = calcularPreviaTotaisForm(
			[linhaValida, linhaEmDigitacao],
			500,
		);
		expect(totais.quantidade_itens).toBe(1);
		expect(totais.valor_total_centavos).toBe(27000);
		expect(totais.comissao_projetada_centavos).toBe(1350);
	});
});

describe("validarFormularioPedido", () => {
	it("valida um formulário completo convertendo quantidade e desconto", () => {
		const resultado = validarFormularioPedido({
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			endereco_entrega_id: "",
			contato_id: "",
			condicao_pagamento: "30 dias",
			tipo_frete: "CIF",
			observacoes: "  ",
			itens: [
				{
					localId: "item-1",
					produto_id: PRODUTO_A,
					preco_unitario_tabela_centavos: 2500,
					quantidade: "7",
					percentual_desconto: "12,50",
				},
			],
		});

		expect(resultado.success).toBe(true);
		if (resultado.success) {
			expect(resultado.data.observacoes).toBeNull();
			expect(resultado.data.endereco_entrega_id).toBeNull();
			expect(resultado.data.itens).toEqual([
				{
					id: undefined,
					produto_id: PRODUTO_A,
					quantidade: 7,
					preco_unitario_tabela_centavos: 2500,
					percentual_desconto: 1250,
				},
			]);
		}
	});

	it("mapeia erros de campos obrigatórios, lista vazia e valores inválidos de itens", () => {
		const semItens = validarFormularioPedido({
			cliente_id: "",
			representada_id: "",
			tabela_id: "",
			endereco_entrega_id: "",
			contato_id: "",
			condicao_pagamento: " ",
			tipo_frete: "CIF",
			observacoes: "",
			itens: [],
		});

		expect(semItens.success).toBe(false);
		if (!semItens.success) {
			expect(semItens.erros.cliente_id).toBeDefined();
			expect(semItens.erros.representada_id).toBeDefined();
			expect(semItens.erros.tabela_id).toBeDefined();
			expect(semItens.erros.condicao_pagamento).toBeDefined();
			expect(semItens.erros.itens).toBeDefined();
		}

		const comItemInvalido = validarFormularioPedido({
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			endereco_entrega_id: "",
			contato_id: "",
			condicao_pagamento: "À vista",
			tipo_frete: "CIF",
			observacoes: "",
			itens: [
				{
					localId: "item-x",
					produto_id: PRODUTO_A,
					preco_unitario_tabela_centavos: 1000,
					quantidade: "0",
					percentual_desconto: "150,00",
				},
			],
		});

		expect(comItemInvalido.success).toBe(false);
		if (!comItemInvalido.success) {
			expect(
				comItemInvalido.erros[chaveErroItemPedido("item-x", "quantidade")],
			).toBeDefined();
			expect(
				comItemInvalido.erros[
					chaveErroItemPedido("item-x", "percentual_desconto")
				],
			).toBeDefined();
		}
	});
});
