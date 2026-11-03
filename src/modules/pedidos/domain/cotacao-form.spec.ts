import { describe, expect, it } from "vitest";
import {
	atualizarGrupoForm,
	type CotacaoFormValues,
	chaveErroGrupoCotacao,
	type GrupoOrcamentoFormValues,
	garantirGrupoForm,
	novoGrupoOrcamentoForm,
	removerGrupoForm,
	resolverTabelaEfetivaGrupo,
	validarFormularioCotacao,
	valoresIniciaisCotacaoForm,
} from "./cotacao-form";
import { criarPedidoCompleto } from "./pedido";
import { chaveErroItemPedido } from "./pedido-form";

const TENANT = "11111111-1111-4111-a111-111111111111";
const CLIENTE = "33333333-3333-4333-a333-333333333333";
const REP_A = "44444444-4444-4444-a444-444444444444";
const REP_B = "55555555-5555-4555-a555-555555555555";
const TABELA_A = "66666666-6666-4666-a666-666666666666";
const TABELA_B = "67676767-6767-4767-a767-676767676767";
const PRODUTO = "77777777-7777-4777-a777-777777777777";
const AGORA = "2026-11-03T12:00:00.000Z";

const repA = { id: REP_A, regras_frete_padrao: "CIF" as const };
const repB = { id: REP_B, regras_frete_padrao: "FOB" as const };

const linha = (localId: string, quantidade = "2", desconto = "") => ({
	localId,
	produto_id: PRODUTO,
	preco_unitario_tabela_centavos: 1000,
	quantidade,
	percentual_desconto: desconto,
});

const grupoValido = (
	representadaId: string,
	tabelaId: string,
	overrides: Partial<GrupoOrcamentoFormValues> = {},
): GrupoOrcamentoFormValues => ({
	representada_id: representadaId,
	tabela_id: tabelaId,
	tabela_manual: false,
	condicao_pagamento: "30 dias",
	tipo_frete: "CIF",
	itens: [linha(`l-${representadaId}`)],
	...overrides,
});

const formValido = (
	overrides: Partial<CotacaoFormValues> = {},
): CotacaoFormValues => ({
	cliente_id: CLIENTE,
	endereco_entrega_id: "",
	contato_id: "",
	transportadora_id: "",
	observacoes: "",
	grupos: [grupoValido(REP_A, TABELA_A), grupoValido(REP_B, TABELA_B)],
	...overrides,
});

describe("valoresIniciaisCotacaoForm", () => {
	it("novo orçamento: vazio, com seção da representada de atalho", () => {
		expect(valoresIniciaisCotacaoForm().grupos).toEqual([]);
		const comAtalho = valoresIniciaisCotacaoForm(undefined, {
			clienteId: CLIENTE,
			representada: repB,
		});
		expect(comAtalho.cliente_id).toBe(CLIENTE);
		expect(comAtalho.grupos).toEqual([
			{
				representada_id: REP_B,
				tabela_id: "",
				tabela_manual: false,
				condicao_pagamento: "",
				tipo_frete: "FOB",
				itens: [],
			},
		]);
	});

	it("cotação existente: contexto do primeiro pedido e uma seção por pedido", () => {
		const criar = (representadaId: string, tabelaId: string) =>
			criarPedidoCompleto({
				tenantId: TENANT,
				percentualComissaoPadrao: 0,
				agora: AGORA,
				input: {
					cliente_id: CLIENTE,
					representada_id: representadaId,
					tabela_id: tabelaId,
					condicao_pagamento: "28 dias",
					tipo_frete: "FOB",
					observacoes: "Doca 2",
					itens: [
						{
							produto_id: PRODUTO,
							quantidade: 4,
							preco_unitario_tabela_centavos: 1000,
						},
					],
				},
			});
		const valores = valoresIniciaisCotacaoForm({
			cotacao_grupo_id: "c0c0c0c0-1111-4111-a111-111111111111",
			pedidos: [criar(REP_A, TABELA_A), criar(REP_B, TABELA_B)],
		});

		expect(valores.observacoes).toBe("Doca 2");
		expect(
			valores.grupos.map((g) => [
				g.representada_id,
				g.tabela_id,
				g.tabela_manual,
			]),
		).toEqual([
			[REP_A, TABELA_A, true],
			[REP_B, TABELA_B, true],
		]);
		expect(valores.grupos[0]?.itens[0]?.quantidade).toBe("4");
	});
});

describe("garantir / atualizar / remover seções", () => {
	it("cria a seção uma única vez, herdando a condição da última seção", () => {
		const primeiro = garantirGrupoForm([], repA);
		const comCondicao = atualizarGrupoForm(primeiro, REP_A, (g) => ({
			...g,
			condicao_pagamento: "30/60 dias",
		}));
		const dois = garantirGrupoForm(comCondicao, repB);

		expect(dois.map((g) => g.representada_id)).toEqual([REP_A, REP_B]);
		expect(dois[1]).toEqual(novoGrupoOrcamentoForm(repB, "30/60 dias"));
		expect(garantirGrupoForm(dois, repA)).toEqual(dois);
	});

	it("remove somente a seção da fábrica informada", () => {
		const grupos = [grupoValido(REP_A, TABELA_A), grupoValido(REP_B, TABELA_B)];
		expect(
			removerGrupoForm(grupos, REP_A).map((g) => g.representada_id),
		).toEqual([REP_B]);
	});
});

describe("resolverTabelaEfetivaGrupo", () => {
	const vigentes = [TABELA_A, TABELA_B];

	it("mantém a escolha manual enquanto vigente; senão usa a sugerida", () => {
		expect(
			resolverTabelaEfetivaGrupo(
				{ tabela_id: TABELA_B, tabela_manual: true },
				vigentes,
				TABELA_A,
			),
		).toBe(TABELA_B);
		expect(
			resolverTabelaEfetivaGrupo(
				{ tabela_id: TABELA_B, tabela_manual: true },
				[TABELA_A],
				TABELA_A,
			),
		).toBe(TABELA_A);
		expect(
			resolverTabelaEfetivaGrupo(
				{ tabela_id: TABELA_B, tabela_manual: false },
				vigentes,
				TABELA_A,
			),
		).toBe(TABELA_A);
	});

	it("sem sugestão mantém a atual; em modo leitura nunca troca", () => {
		expect(
			resolverTabelaEfetivaGrupo(
				{ tabela_id: "", tabela_manual: false },
				[],
				null,
			),
		).toBe("");
		expect(
			resolverTabelaEfetivaGrupo(
				{ tabela_id: TABELA_B, tabela_manual: false },
				[],
				TABELA_A,
				true,
			),
		).toBe(TABELA_B);
	});
});

describe("validarFormularioCotacao", () => {
	it("converte as seções com itens e descarta as vazias", () => {
		const resultado = validarFormularioCotacao(
			formValido({
				grupos: [
					grupoValido(REP_A, TABELA_A, {
						itens: [linha("l1", "3", "12,5")],
					}),
					grupoValido(REP_B, "", { itens: [] }),
				],
			}),
		);

		expect(resultado.success).toBe(true);
		if (resultado.success) {
			expect(resultado.data.grupos).toHaveLength(1);
			expect(resultado.data.grupos[0]).toMatchObject({
				representada_id: REP_A,
				itens: [{ quantidade: 3, percentual_desconto: 1250 }],
			});
		}
	});

	it("exige ao menos um item na cotação", () => {
		const resultado = validarFormularioCotacao(
			formValido({ grupos: [grupoValido(REP_A, TABELA_A, { itens: [] })] }),
		);
		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.itens).toBe(
				"Adicione pelo menos um item ao orçamento",
			);
		}
	});

	it("aponta erros nos campos compartilhados, da seção e das linhas", () => {
		const resultado = validarFormularioCotacao(
			formValido({
				cliente_id: "",
				grupos: [
					grupoValido(REP_A, TABELA_A, {
						itens: [linha("l1", "0"), linha("l2", "1", "120")],
					}),
					grupoValido(REP_B, "", { condicao_pagamento: " " }),
				],
			}),
		);

		expect(resultado.success).toBe(false);
		if (!resultado.success) {
			expect(resultado.erros.cliente_id).toBe("Selecione um cliente");
			expect(resultado.erros[chaveErroGrupoCotacao(REP_B, "tabela_id")]).toBe(
				"Selecione uma tabela de preço",
			);
			expect(
				resultado.erros[chaveErroGrupoCotacao(REP_B, "condicao_pagamento")],
			).toBe("Informe a condição de pagamento");
			expect(resultado.erros[chaveErroItemPedido("l1", "quantidade")]).toBe(
				"Quantidade deve ser maior que zero",
			);
			expect(
				resultado.erros[chaveErroItemPedido("l2", "percentual_desconto")],
			).toBeDefined();
			expect(resultado.geral).toBeNull();
		}
	});
});
