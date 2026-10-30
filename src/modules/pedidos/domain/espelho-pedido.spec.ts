import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import type { Cliente } from "../../clientes/domain/cliente.schema";
import type { ClienteContato } from "../../clientes/domain/cliente-contato.schema";
import type { ClienteEndereco } from "../../clientes/domain/cliente-endereco.schema";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import type { Representada } from "../../representadas/domain/representada.schema";
import {
	gerarNomeArquivoEspelhoPdf,
	gerarTextoCompartilhamentoEspelho,
	gerarUrlEmailEspelho,
	gerarUrlWhatsappEspelho,
	montarEspelhoPedido,
	normalizarTelefoneWhatsapp,
} from "./espelho-pedido";
import { criarPedidoCompleto } from "./pedido";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const CLIENTE_ID = "33333333-3333-4333-a333-333333333333";
const REP_ID = "44444444-4444-4444-a444-444444444444";
const TABELA_ID = "55555555-5555-4555-a555-555555555555";
const PRODUTO_ID = "66666666-6666-4666-a666-666666666666";
const ENDERECO_ID = "77777777-7777-4777-a777-777777777777";
const CONTATO_ID = "88888888-8888-4888-a888-888888888888";
const PEDIDO_ID = "a1b2c3d4-0000-4000-a000-000000000000";
const AGORA = "2026-10-30T14:30:00.000Z";

const empresaMock = {
	nomeFantasia: "Vinitop RS",
	razaoSocial: "Vinitop Representações Ltda",
	cnpj: "11222333000181",
	telefone: "(51) 3333-4444",
};

const clienteBase: Cliente = {
	id: CLIENTE_ID,
	tenant_id: TENANT,
	cnpj_cpf: "11222333000181",
	razao_social: "Supermercado Central Gaúcho Ltda",
	nome_fantasia: "Super Central",
	ativo: true,
	created_at: AGORA,
	updated_at: AGORA,
	deleted_at: null,
};

const representadaBase: Representada = {
	id: REP_ID,
	tenant_id: TENANT,
	razao_social: "Vinícola Serra Sul S/A",
	nome_fantasia: "Serra Sul",
	cnpj: "11222333000181",
	percentual_comissao_padrao: 500,
	valor_pedido_minimo_centavos: 100000,
	regras_frete_padrao: "CIF",
	ativo: true,
	created_at: AGORA,
	updated_at: AGORA,
	deleted_at: null,
};

const tabelaBase: TabelaPreco = {
	id: TABELA_ID,
	tenant_id: TENANT,
	representada_id: REP_ID,
	nome_tabela: "Tabela Atacado Sul",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: AGORA,
	updated_at: AGORA,
	deleted_at: null,
};

const produtoBase: Produto = {
	id: PRODUTO_ID,
	tenant_id: TENANT,
	representada_id: REP_ID,
	sku: "CAB-750",
	descricao: "Cabernet Sauvignon Reserva 750ml",
	unidade_medida: "CX",
	multiplo_embalagem: 6,
	ativo: true,
	created_at: AGORA,
	updated_at: AGORA,
	deleted_at: null,
};

const enderecoBase: ClienteEndereco = {
	id: ENDERECO_ID,
	tenant_id: TENANT,
	cliente_id: CLIENTE_ID,
	tipo_endereco: "ENTREGA",
	endereco_completo: "Av. Assis Brasil, 1500 - Porto Alegre/RS",
	created_at: AGORA,
	updated_at: AGORA,
	deleted_at: null,
};

const contatoBase: ClienteContato = {
	id: CONTATO_ID,
	tenant_id: TENANT,
	cliente_id: CLIENTE_ID,
	nome: "Roberto Comprador",
	papel: "COMPRADOR",
	telefone_whatsapp: "(51) 99888-7766",
	email: "roberto@supercentral.com.br",
	created_at: AGORA,
	updated_at: AGORA,
	deleted_at: null,
};

describe("Espelho do Pedido (Domínio)", () => {
	const pedidoCompleto = criarPedidoCompleto({
		tenantId: TENANT,
		pedidoId: PEDIDO_ID,
		status: "emitido",
		percentualComissaoPadrao: 500,
		agora: AGORA,
		input: {
			cliente_id: CLIENTE_ID,
			representada_id: REP_ID,
			tabela_id: TABELA_ID,
			endereco_entrega_id: ENDERECO_ID,
			contato_id: CONTATO_ID,
			condicao_pagamento: "28/56 dias",
			tipo_frete: "CIF",
			observacoes: "Entregar pela doca 2 até as 16h",
			itens: [
				{
					produto_id: PRODUTO_ID,
					quantidade: 3,
					preco_unitario_tabela_centavos: 20000,
					percentual_desconto: 1000, // 10% -> líquido 18000 -> subtotal 54000
				},
			],
		},
	});

	const produtosPorId = new Map([[PRODUTO_ID, produtoBase]]);

	it("monta os dados formatados do espelho de pedido com precisão em centavos", () => {
		const espelho = montarEspelhoPedido({
			tenantId: TENANT,
			empresa: empresaMock,
			pedidoCompleto,
			cliente: clienteBase,
			representada: representadaBase,
			tabelaPreco: tabelaBase,
			enderecoEntrega: enderecoBase,
			contato: contatoBase,
			produtosPorId,
		});

		expect(espelho.codigoCurto).toBe("A1B2C3D4");
		expect(espelho.tituloDocumento).toBe("ESPELHO DE PEDIDO DE VENDA");
		expect(espelho.dataEmissaoFormatada).toBe("30/10/2026");
		expect(espelho.cliente.documentoFormatado).toBe("11.222.333/0001-81");
		expect(espelho.cliente.enderecoEntrega).toContain("Av. Assis Brasil, 1500");
		expect(espelho.itens).toHaveLength(1);
		expect(espelho.itens[0]).toMatchObject({
			numero: 1,
			sku: "CAB-750",
			quantidade: 3,
			precoTabelaFormatado: "R$ 200,00",
			descontoPercentualFormatado: "10,00%",
			precoLiquidoFormatado: "R$ 180,00",
			subtotalFormatado: "R$ 540,00",
		});
		expect(espelho.totais).toEqual({
			quantidadeItens: 1,
			quantidadeVolumes: 3,
			valorTabelaTotalCentavos: 60000,
			valorTabelaTotalFormatado: "R$ 600,00",
			descontoTotalCentavos: 6000,
			descontoTotalFormatado: "R$ 60,00",
			valorTotalCentavos: 54000,
			valorTotalFormatado: "R$ 540,00",
		});
	});

	it("gera nome de arquivo PDF determinístico e links de WhatsApp e E-mail", () => {
		const espelho = montarEspelhoPedido({
			tenantId: TENANT,
			empresa: empresaMock,
			pedidoCompleto,
			cliente: clienteBase,
			representada: representadaBase,
			tabelaPreco: tabelaBase,
			enderecoEntrega: enderecoBase,
			contato: contatoBase,
			produtosPorId,
		});

		expect(gerarNomeArquivoEspelhoPdf(espelho)).toBe(
			"pedido-A1B2C3D4-super-central-2026-10-30.pdf",
		);

		const texto = gerarTextoCompartilhamentoEspelho(espelho);
		expect(texto).toContain("*ESPELHO DE PEDIDO DE VENDA #A1B2C3D4*");
		expect(texto).toContain("CAB-750");
		expect(texto).toContain("R$ 540,00");

		expect(normalizarTelefoneWhatsapp("(51) 99888-7766")).toBe("5551998887766");
		const urlWhats = gerarUrlWhatsappEspelho(espelho);
		expect(urlWhats.startsWith("https://wa.me/5551998887766?text=")).toBe(true);

		const urlEmail = gerarUrlEmailEspelho(espelho);
		expect(
			urlEmail.startsWith("mailto:roberto@supercentral.com.br?subject="),
		).toBe(true);
	});

	it("rejeita entidades de outro tenant ao montar o espelho", () => {
		expect(() =>
			montarEspelhoPedido({
				tenantId: OUTRO_TENANT,
				empresa: empresaMock,
				pedidoCompleto,
				cliente: clienteBase,
				representada: representadaBase,
				produtosPorId,
			}),
		).toThrow(TenantDivergenteError);
	});
});
