import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import type { Cliente } from "../../clientes/domain/cliente.schema";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import type { Representada } from "../../representadas/domain/representada.schema";
import type { Transportadora } from "../../transportadoras/domain/transportadora.schema";
import {
	gerarBlobEspelhoCotacaoPdf,
	gerarBlobEspelhoPedidoPdf,
} from "../components/espelho-pedido-pdf";
import type { CotacaoInput, GrupoCotacaoInput } from "../domain/cotacao.schema";
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
	tipo_cliente: "REVENDA",
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
	percentual_comissao_revenda: 750, // 7,50%
	percentual_comissao_fabrica: 400, // 4,00%
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

const TRANSPORTADORA = "abababab-abab-4bab-abab-abababababab";

const transportadoraBase: Transportadora = {
	id: TRANSPORTADORA,
	tenant_id: TENANT,
	nome_fantasia: "Rodo Sul",
	razao_social: null,
	cnpj: null,
	telefone: "(54) 3333-0000",
	cidade_uf: "Caxias do Sul/RS",
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
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
			db.transportadoras.clear(),
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

	it("grava a transportadora do pedido, exibe no espelho/PDF e rejeita a de outro tenant", async () => {
		await db.transportadoras.bulkAdd([
			transportadoraBase,
			{
				...transportadoraBase,
				id: crypto.randomUUID(),
				tenant_id: OUTRO_TENANT,
			},
		]);
		const inputBase = {
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			condicao_pagamento: "30 dias",
			tipo_frete: "FOB" as const,
			itens: [
				{
					produto_id: PRODUTO_A,
					quantidade: 6,
					preco_unitario_tabela_centavos: 1000,
				},
			],
		};

		const emitido = await adapter.emitir(TENANT, {
			...inputBase,
			transportadora_id: TRANSPORTADORA,
		});
		expect(emitido.pedido.transportadora_id).toBe(TRANSPORTADORA);
		expect((await db.pedidos.get(emitido.pedido.id))?.transportadora_id).toBe(
			TRANSPORTADORA,
		);
		const mutacao = (await db.outbox.toArray()).find(
			(m) => m.entity === "pedidos",
		);
		expect(mutacao?.payload.transportadora_id).toBe(TRANSPORTADORA);

		const espelho = await adapter.obterEspelhoPorId(TENANT, emitido.pedido.id, {
			nomeFantasia: "Vinitop RS",
			razaoSocial: "Vinitop RS Ltda",
			cnpj: "00.000.000/0001-00",
			telefone: "(51) 3333-0000",
		});
		expect(espelho?.logistica.transportadora?.nomeFantasia).toBe("Rodo Sul");
		if (espelho) {
			const blob = await gerarBlobEspelhoPedidoPdf(espelho);
			expect(blob.type).toBe("application/pdf");
		}

		const semTransportadora = await adapter.salvarRascunho(TENANT, inputBase);
		expect(semTransportadora.pedido.transportadora_id).toBeNull();

		const deOutroTenant = (await db.transportadoras.toArray()).find(
			(t) => t.tenant_id === OUTRO_TENANT,
		);
		await expect(
			adapter.salvarRascunho(TENANT, {
				...inputBase,
				transportadora_id: deOutroTenant?.id,
			}),
		).rejects.toThrow(ContextoVendaInvalidoError);
		await expect(
			adapter.salvarRascunho(TENANT, {
				...inputBase,
				transportadora_id: crypto.randomUUID(),
			}),
		).rejects.toThrow(ContextoVendaInvalidoError);
	});

	it("aplica a comissão de fábrica quando o cliente é do segmento FABRICA", async () => {
		const clienteFabricaId = "99999999-9999-4999-a999-999999999999";
		await db.clientes.add({
			...clienteBase,
			id: clienteFabricaId,
			cnpj_cpf: "52998224725",
			razao_social: "Indústria Sul S/A",
			tipo_cliente: "FABRICA",
		});

		const pedidoFabrica = await adapter.salvarRascunho(TENANT, {
			cliente_id: clienteFabricaId,
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			condicao_pagamento: "30 dias",
			tipo_frete: "CIF",
			itens: [
				{
					produto_id: PRODUTO_A,
					quantidade: 1,
					preco_unitario_tabela_centavos: 10000, // R$ 100,00 -> 4,00% = R$ 4,00 (400 centavos)
				},
			],
		});

		expect(pedidoFabrica.pedido.valor_total_centavos).toBe(10000);
		expect(pedidoFabrica.pedido.comissao_projetada_centavos).toBe(400);
	});

	describe("cotação multi-representada", () => {
		const TABELA_2 = "6b6b6b6b-6b6b-4b6b-ab6b-6b6b6b6b6b6b";
		const PRODUTO_C = "7c7c7c7c-7c7c-4c7c-ac7c-7c7c7c7c7c7c";
		const EMPRESA = {
			nomeFantasia: "Vinitop RS",
			razaoSocial: "Vinitop RS Ltda",
			cnpj: "00.000.000/0001-00",
			telefone: "(51) 3333-0000",
		};

		const grupoVinitop = (quantidade = 2): GrupoCotacaoInput => ({
			representada_id: REPRESENTADA,
			tabela_id: TABELA,
			condicao_pagamento: "30/60 dias",
			tipo_frete: "CIF",
			itens: [
				{
					produto_id: PRODUTO_A,
					quantidade,
					preco_unitario_tabela_centavos: 10000,
				},
			],
		});
		const grupoSerra: GrupoCotacaoInput = {
			representada_id: OUTRA_REPRESENTADA,
			tabela_id: TABELA_2,
			condicao_pagamento: "28 dias",
			tipo_frete: "FOB",
			itens: [
				{
					produto_id: PRODUTO_C,
					quantidade: 3,
					preco_unitario_tabela_centavos: 5000,
					percentual_desconto: 1000, // 10% -> 4500 x 3 = 13500
				},
			],
		};
		const cotacao = (grupos: GrupoCotacaoInput[]): CotacaoInput => ({
			cliente_id: CLIENTE,
			transportadora_id: TRANSPORTADORA,
			observacoes: "Entregar junto",
			grupos,
		});

		beforeEach(async () => {
			await db.transportadoras.add(transportadoraBase);
			await db.representadas.add({
				...representadaBase,
				id: OUTRA_REPRESENTADA,
				nome_fantasia: "Serra Bebidas",
				razao_social: "Serra Bebidas Ltda",
				percentual_comissao_revenda: 500, // 5,00%
				regras_frete_padrao: "FOB",
			});
			await db.tabelas_preco.add({
				...tabelaBase,
				id: TABELA_2,
				representada_id: OUTRA_REPRESENTADA,
			});
			await db.produtos.add({
				...produtoA,
				id: PRODUTO_C,
				representada_id: OUTRA_REPRESENTADA,
				sku: "SER-001",
				descricao: "Suco de Uva 1L",
			});
		});

		it("desmembra em 1 pedido por fábrica, vinculados pelo mesmo cotacao_grupo_id", async () => {
			const salva = await adapter.salvarCotacao(
				TENANT,
				cotacao([grupoVinitop(), grupoSerra]),
				"rascunho",
			);

			expect(salva.cotacao_grupo_id).toEqual(expect.any(String));
			expect(salva.pedidos).toHaveLength(2);
			const [vinitop, serra] = salva.pedidos;
			expect(vinitop?.pedido).toMatchObject({
				representada_id: REPRESENTADA,
				cotacao_grupo_id: salva.cotacao_grupo_id,
				condicao_pagamento: "30/60 dias",
				tipo_frete: "CIF",
				transportadora_id: TRANSPORTADORA,
				observacoes: "Entregar junto",
				valor_total_centavos: 20000,
				comissao_projetada_centavos: 1500, // 7,50%
				status: "rascunho",
			});
			expect(serra?.pedido).toMatchObject({
				representada_id: OUTRA_REPRESENTADA,
				cotacao_grupo_id: salva.cotacao_grupo_id,
				tipo_frete: "FOB",
				valor_total_centavos: 13500,
				comissao_projetada_centavos: 675, // 5,00%
			});
			expect(vinitop?.pedido.idempotency_key).not.toBe(
				serra?.pedido.idempotency_key,
			);

			const fila = await db.outbox.toArray();
			const mutacoesPedidos = fila.filter((m) => m.entity === "pedidos");
			expect(mutacoesPedidos).toHaveLength(2);
			expect(fila.filter((m) => m.entity === "itens_pedido")).toHaveLength(2);
			for (const m of mutacoesPedidos) {
				expect(m.payload.cotacao_grupo_id).toBe(salva.cotacao_grupo_id);
			}

			const serraId = serra?.pedido.id ?? "";
			const carregada = await adapter.obterCotacao(TENANT, serraId);
			expect(carregada?.cotacao_grupo_id).toBe(salva.cotacao_grupo_id);
			expect(carregada?.pedidos.map((p) => p.pedido.representada_id)).toEqual([
				REPRESENTADA,
				OUTRA_REPRESENTADA,
			]);
			expect(carregada?.pedidos.every((p) => p.itens.length === 1)).toBe(true);
			expect(await adapter.obterCotacao(OUTRO_TENANT, serraId)).toBeUndefined();
		});

		it("cotação de uma única fábrica gera pedido avulso (sem agrupador)", async () => {
			const salva = await adapter.salvarCotacao(
				TENANT,
				cotacao([grupoVinitop()]),
				"emitido",
			);
			expect(salva.cotacao_grupo_id).toBeNull();
			expect(salva.pedidos[0]?.pedido.cotacao_grupo_id).toBeNull();
			expect(salva.pedidos[0]?.pedido.status).toBe("emitido");
		});

		it("ao editar, atualiza por fábrica, inclui novas e exclui (tombstone) as removidas", async () => {
			const avulso = await adapter.salvarCotacao(
				TENANT,
				cotacao([grupoVinitop()]),
				"rascunho",
			);
			const vinitopId = avulso.pedidos[0]?.pedido.id ?? "";

			// Pedido avulso ganha uma segunda fábrica -> passa a ter agrupador
			const ampliada = await adapter.salvarCotacao(
				TENANT,
				cotacao([grupoVinitop(5), grupoSerra]),
				"rascunho",
				vinitopId,
			);
			expect(ampliada.cotacao_grupo_id).toEqual(expect.any(String));
			expect(ampliada.pedidos[0]?.pedido.id).toBe(vinitopId);
			expect(ampliada.pedidos[0]?.pedido.valor_total_centavos).toBe(50000);
			expect(ampliada.pedidos[0]?.pedido.cotacao_grupo_id).toBe(
				ampliada.cotacao_grupo_id,
			);
			const serraId = ampliada.pedidos[1]?.pedido.id ?? "";

			// Remove a Vinitop da sacola e fecha a cotação
			const fechada = await adapter.salvarCotacao(
				TENANT,
				cotacao([grupoSerra]),
				"emitido",
				serraId,
			);
			expect(fechada.cotacao_grupo_id).toBe(ampliada.cotacao_grupo_id);
			expect(fechada.pedidos.map((p) => p.pedido.id)).toEqual([serraId]);
			expect(fechada.pedidos[0]?.pedido.status).toBe("emitido");

			const vinitopGravado = await db.pedidos.get(vinitopId);
			expect(vinitopGravado?.deleted_at).toBe(AGORA);
			const itensVinitop = await db.itens_pedido
				.filter((i) => i.pedido_id === vinitopId)
				.toArray();
			expect(itensVinitop.length).toBeGreaterThan(0);
			expect(itensVinitop.every((i) => i.deleted_at === AGORA)).toBe(true);
			expect(
				(await db.outbox.toArray()).some(
					(m) =>
						m.entity === "pedidos" &&
						m.payload.id === vinitopId &&
						m.action === "DELETE",
				),
			).toBe(true);

			// Emitida: não pode mais ser alterada
			await expect(
				adapter.salvarCotacao(
					TENANT,
					cotacao([grupoSerra]),
					"rascunho",
					serraId,
				),
			).rejects.toThrow(PedidoImutavelError);
		});

		it("é atômica: um vínculo inválido em qualquer fábrica não grava nada", async () => {
			await expect(
				adapter.salvarCotacao(
					TENANT,
					// tabela da Vinitop na seção da Serra
					cotacao([grupoVinitop(), { ...grupoSerra, tabela_id: TABELA }]),
					"rascunho",
				),
			).rejects.toThrow(ContextoVendaInvalidoError);
			expect(await db.pedidos.count()).toBe(0);
			expect(await db.itens_pedido.count()).toBe(0);
			expect(await db.outbox.count()).toBe(0);

			await expect(
				adapter.salvarCotacao(
					TENANT,
					cotacao([grupoVinitop(), grupoVinitop(3)]),
					"rascunho",
				),
			).rejects.toThrow("mais de uma seção");
			await expect(
				adapter.salvarCotacao(
					TENANT,
					cotacao([grupoVinitop()]),
					"rascunho",
					crypto.randomUUID(),
				),
			).rejects.toThrow(PedidoNaoEncontradoError);
		});

		it("monta o espelho unificado e gera os PDFs unificado e individual", async () => {
			const salva = await adapter.salvarCotacao(
				TENANT,
				cotacao([grupoVinitop(), grupoSerra]),
				"rascunho",
			);
			const espelho = await adapter.obterEspelhoCotacao(
				TENANT,
				salva.pedidos[0]?.pedido.id ?? "",
				EMPRESA,
			);

			expect(espelho?.secoes.map((s) => s.representada.nomeFantasia)).toEqual([
				"Vinitop",
				"Serra Bebidas",
			]);
			expect(espelho?.totais.valorTotalCentavos).toBe(33500);
			expect(espelho?.totais.valorTotalFormatado).toBe("R$ 335,00");
			expect(espelho?.logistica.transportadora?.nomeFantasia).toBe("Rodo Sul");
			expect(espelho?.codigoCurto).toBe(
				salva.cotacao_grupo_id?.slice(0, 8).toUpperCase(),
			);

			if (espelho) {
				const unificado = await gerarBlobEspelhoCotacaoPdf(espelho);
				expect(unificado.type).toBe("application/pdf");
				const [primeira] = espelho.secoes;
				if (primeira) {
					const individual = await gerarBlobEspelhoPedidoPdf(primeira);
					expect(individual.type).toBe("application/pdf");
				}
			}
		});
	});
});
