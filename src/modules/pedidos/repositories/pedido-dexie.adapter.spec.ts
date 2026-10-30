import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import type { Cliente } from "../../clientes/domain/cliente.schema";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import type { Representada } from "../../representadas/domain/representada.schema";
import { gerarBlobEspelhoPedidoPdf } from "../components/espelho-pedido-pdf";
import {
	ContextoVendaInvalidoError,
	PedidoImutavelError,
	PedidoNaoEncontradoError,
} from "../domain/pedido";
import { PedidoDexieAdapter } from "./pedido-dexie.adapter";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const CLIENTE = "33333333-3333-4333-a333-333333333333";
const REPRESENTADA = "44444444-4444-4444-a444-444444444444";
const OUTRA_REPRESENTADA = "55555555-5555-4555-a555-555555555555";
const TABELA = "66666666-6666-4666-a666-666666666666";
const PRODUTO_A = "77777777-7777-4777-a777-777777777777";
const PRODUTO_B = "88888888-8888-4888-a888-888888888888";
const CRIADO_EM = "2026-01-01T00:00:00.000Z";
const AGORA = "2026-10-29T12:00:00.000Z";

const clienteBase: Cliente = {
	id: CLIENTE,
	tenant_id: TENANT,
	cnpj_cpf: "11222333000181",
	razao_social: "Mercado Bom Preço Ltda",
	nome_fantasia: "Bom Preço",
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
};

const representadaBase: Representada = {
	id: REPRESENTADA,
	tenant_id: TENANT,
	razao_social: "Vinitop Indústria S/A",
	nome_fantasia: "Vinitop",
	cnpj: "11222333000181",
	percentual_comissao_padrao: 750, // 7,50%
	valor_pedido_minimo_centavos: 150000,
	regras_frete_padrao: "CIF",
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
};

const tabelaBase: TabelaPreco = {
	id: TABELA,
	tenant_id: TENANT,
	representada_id: REPRESENTADA,
	nome_tabela: "Tabela Padrão",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
};

const produtoA: Produto = {
	id: PRODUTO_A,
	tenant_id: TENANT,
	representada_id: REPRESENTADA,
	sku: "VIN-001",
	descricao: "Vinho Tinto Seco 750ml",
	unidade_medida: "CX",
	multiplo_embalagem: 6,
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
};

const produtoB: Produto = {
	...produtoA,
	id: PRODUTO_B,
	sku: "VIN-002",
	descricao: "Espumante Brut 750ml",
};

describe("PedidoDexieAdapter", () => {
	const adapter = new PedidoDexieAdapter({ agora: () => AGORA });

	beforeEach(async () => {
		await Promise.all([
			db.pedidos.clear(),
			db.itens_pedido.clear(),
			db.outbox.clear(),
			db.clientes.clear(),
			db.representadas.clear(),
			db.tabelas_preco.clear(),
			db.produtos.clear(),
		]);
		await db.clientes.add(clienteBase);
		await db.representadas.add(representadaBase);
		await db.tabelas_preco.add(tabelaBase);
		await db.produtos.bulkAdd([produtoA, produtoB]);
	});

	it("salva rascunho de orçamento, atualiza itens e emite o pedido calculando comissão da representada", async () => {
		const rascunho = await adapter.salvarRascunho(TENANT, {
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			condicao_pagamento: "30/60 dias",
			tipo_frete: "CIF",
			observacoes: "Cotação inicial",
			itens: [
				{
					produto_id: PRODUTO_A,
					quantidade: 2,
					preco_unitario_tabela_centavos: 10000,
					percentual_desconto: 1000, // 10% -> líquido 9000 -> subtotal 18000
				},
			],
		});

		expect(rascunho.pedido.status).toBe("rascunho");
		expect(rascunho.pedido.valor_total_centavos).toBe(18000);
		// 7,50% sobre 18000 = 1350 centavos
		expect(rascunho.pedido.comissao_projetada_centavos).toBe(1350);
		expect(rascunho.itens).toHaveLength(1);

		const itemOriginalId = rascunho.itens[0]?.id;

		// Atualiza o rascunho adicionando PRODUTO_B e emitindo o pedido
		const emitido = await adapter.emitir(
			TENANT,
			{
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "28 dias",
				tipo_frete: "FOB",
				itens: [
					{
						id: itemOriginalId,
						produto_id: PRODUTO_A,
						quantidade: 2,
						preco_unitario_tabela_centavos: 10000,
						percentual_desconto: 1000,
					},
					{
						produto_id: PRODUTO_B,
						quantidade: 1,
						preco_unitario_tabela_centavos: 5000,
						percentual_desconto: 0,
					},
				],
			},
			rascunho.pedido.id,
		);

		expect(emitido.pedido.status).toBe("emitido");
		expect(emitido.pedido.valor_total_centavos).toBe(23000);
		// 7,50% de 23000 = 1725
		expect(emitido.pedido.comissao_projetada_centavos).toBe(1725);
		expect(emitido.itens).toHaveLength(2);

		const buscado = await adapter.obterPorId(TENANT, emitido.pedido.id);
		expect(buscado?.pedido.status).toBe("emitido");
		expect(buscado?.itens).toHaveLength(2);

		const espelho = await adapter.obterEspelhoPorId(TENANT, emitido.pedido.id, {
			nomeFantasia: "Vinitop RS",
			razaoSocial: "Vinitop RS Ltda",
			cnpj: "00.000.000/0001-00",
			telefone: "(51) 3333-0000",
		});
		expect(espelho).toBeDefined();
		expect(espelho?.totais.valorTotalFormatado).toBe("R$ 230,00");
		expect(espelho?.itens).toHaveLength(2);

		if (espelho) {
			const blob = await gerarBlobEspelhoPedidoPdf(espelho);
			expect(blob.type).toBe("application/pdf");
			expect(blob.size).toBeGreaterThan(500);
		}

		// Impede edição ou exclusão após emissão
		await expect(
			adapter.salvarRascunho(
				TENANT,
				{
					cliente_id: CLIENTE,
					representada_id: REPRESENTADA,
					tabela_id: TABELA,
					condicao_pagamento: "À vista",
					tipo_frete: "CIF",
					itens: [
						{
							produto_id: PRODUTO_A,
							quantidade: 1,
							preco_unitario_tabela_centavos: 10000,
						},
					],
				},
				emitido.pedido.id,
			),
		).rejects.toThrow(PedidoImutavelError);

		await expect(
			adapter.excluirRascunho(TENANT, emitido.pedido.id),
		).rejects.toThrow(PedidoImutavelError);
	});

	it("lista pedidos por status e exclui rascunho via soft delete", async () => {
		const rascunho = await adapter.salvarRascunho(TENANT, {
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			condicao_pagamento: "30 dias",
			tipo_frete: "CIF",
			itens: [
				{
					produto_id: PRODUTO_A,
					quantidade: 1,
					preco_unitario_tabela_centavos: 5000,
				},
			],
		});

		const emitido = await adapter.emitir(TENANT, {
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			condicao_pagamento: "À vista",
			tipo_frete: "CIF",
			itens: [
				{
					produto_id: PRODUTO_B,
					quantidade: 2,
					preco_unitario_tabela_centavos: 4000,
				},
			],
		});

		expect(await adapter.listar(TENANT)).toHaveLength(2);
		expect(await adapter.listar(TENANT, "rascunho")).toHaveLength(1);
		expect(await adapter.listar(TENANT, "emitido")).toHaveLength(1);

		await adapter.excluirRascunho(TENANT, rascunho.pedido.id);

		expect(
			await adapter.obterPorId(TENANT, rascunho.pedido.id),
		).toBeUndefined();
		expect(await adapter.listar(TENANT)).toEqual([emitido.pedido]);

		const filaOutbox = await db.outbox
			.where("tenant_id")
			.equals(TENANT)
			.toArray();
		// rascunho (1 pedido + 1 item INSERT) + emitido (1 pedido + 1 item INSERT) + exclusão rascunho (1 pedido + 1 item DELETE) = 6 mutações
		expect(filaOutbox).toHaveLength(6);
		expect(
			filaOutbox.some(
				(m) =>
					m.entity === "pedidos" &&
					m.action === "INSERT" &&
					m.idempotency_key === emitido.pedido.idempotency_key,
			),
		).toBe(true);
		expect(
			filaOutbox.some(
				(m) =>
					m.entity === "pedidos" &&
					m.action === "DELETE" &&
					m.payload.id === rascunho.pedido.id,
			),
		).toBe(true);
	});

	it("rejeita vínculos de outro tenant ou de outra representada", async () => {
		const prodOutraRep: Produto = {
			...produtoA,
			id: crypto.randomUUID(),
			representada_id: OUTRA_REPRESENTADA,
		};
		await db.produtos.add(prodOutraRep);

		await expect(
			adapter.salvarRascunho(TENANT, {
				cliente_id: CLIENTE,
				representada_id: REPRESENTADA,
				tabela_id: TABELA,
				condicao_pagamento: "30 dias",
				tipo_frete: "CIF",
				itens: [
					{
						produto_id: prodOutraRep.id,
						quantidade: 1,
						preco_unitario_tabela_centavos: 1000,
					},
				],
			}),
		).rejects.toThrow(ContextoVendaInvalidoError);

		await expect(
			adapter.salvarRascunho(OUTRO_TENANT, {
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
			}),
		).rejects.toThrow(ContextoVendaInvalidoError);

		await expect(
			adapter.excluirRascunho(TENANT, crypto.randomUUID()),
		).rejects.toThrow(PedidoNaoEncontradoError);
	});
});
