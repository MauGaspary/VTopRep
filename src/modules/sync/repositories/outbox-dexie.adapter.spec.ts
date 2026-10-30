import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../../db/database";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import type { Cliente } from "../../clientes/domain/cliente.schema";
import { ClienteDexieAdapter } from "../../clientes/repositories/cliente-dexie.adapter";
import type { Pedido } from "../../pedidos/domain/pedido.schema";
import type { Produto } from "../../produtos/domain/produto.schema";
import { OutboxMutacaoNaoEncontradaError } from "../domain/outbox";
import { OutboxDexieAdapter } from "./outbox-dexie.adapter";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const CLIENTE_ID = "33333333-3333-4333-a333-333333333333";
const REP_ID = "44444444-4444-4444-a444-444444444444";
const TABELA_ID = "55555555-5555-4555-a555-555555555555";
const PRODUTO_ID = "66666666-6666-4666-a666-666666666666";
const PEDIDO_ID = "77777777-7777-4777-a777-777777777777";
const KEY_1 = "88888888-8888-4888-a888-888888888888";
const T1 = "2026-10-30T10:00:00.000Z";
const T2 = "2026-10-30T11:00:00.000Z";
const T3 = "2026-10-30T12:00:00.000Z";

describe("OutboxDexieAdapter", () => {
	let relogio = 0;
	const adapter = new OutboxDexieAdapter({
		agora: () => {
			relogio += 1000;
			return new Date(Date.UTC(2026, 9, 30, 10, 0, 0) + relogio).toISOString();
		},
	});

	beforeEach(async () => {
		relogio = 0;
		await Promise.all([
			db.outbox.clear(),
			db.clientes.clear(),
			db.clientes_enderecos.clear(),
			db.clientes_contatos.clear(),
			db.pedidos.clear(),
			db.itens_pedido.clear(),
			db.produtos.clear(),
		]);
	});

	it("enfileira mutações isoladas por tenant, processa pendentes com idempotência e trata falhas/retentativas", async () => {
		const m1 = await adapter.enfileirar(TENANT, {
			entity: "pedidos",
			action: "INSERT",
			payload: { id: PEDIDO_ID, status: "emitido" },
			idempotency_key: KEY_1,
		});
		// Mesma idempotency_key (duplicata acidental na fila)
		await adapter.enfileirar(TENANT, {
			entity: "pedidos",
			action: "INSERT",
			payload: { id: PEDIDO_ID, status: "emitido" },
			idempotency_key: KEY_1,
		});
		const mFalha = await adapter.enfileirar(TENANT, {
			entity: "clientes",
			action: "UPDATE",
			payload: { id: CLIENTE_ID },
		});
		await adapter.enfileirar(OUTRO_TENANT, {
			entity: "clientes",
			action: "INSERT",
			payload: { id: crypto.randomUUID() },
		});

		const resumoInicial = await adapter.obterResumo(TENANT);
		expect(resumoInicial).toEqual({
			pendentes: 3,
			sincronizando: 0,
			falhas: 0,
			total: 3,
		});

		const idsEnviadosNoTransporte: string[] = [];
		const resultado = await adapter.processarPendentes(TENANT, {
			async enviarMutacao(mutacao) {
				if (mutacao.id === mFalha.id) {
					throw new Error("Falha de rede temporária");
				}
				idsEnviadosNoTransporte.push(mutacao.id);
			},
		});

		// m1 enviada, duplicata de KEY_1 concluída por idempotência sem reenviar, mFalha falhou
		expect(resultado).toEqual({ enviadas: 2, falhas: 1 });
		expect(idsEnviadosNoTransporte).toEqual([m1.id]);

		const filaFalha = await adapter.listarFila(TENANT, "failed");
		expect(filaFalha).toHaveLength(1);
		expect(filaFalha[0]?.retry_count).toBe(1);
		expect(filaFalha[0]?.last_error).toBe("Falha de rede temporária");

		// Reenfileira falhas e processa com sucesso
		const qtdReenfileirada = await adapter.reenfileirarFalhas(TENANT);
		expect(qtdReenfileirada).toBe(1);

		const segundoResultado = await adapter.processarPendentes(TENANT, {
			async enviarMutacao(mutacao) {
				idsEnviadosNoTransporte.push(mutacao.id);
			},
		});
		expect(segundoResultado).toEqual({ enviadas: 1, falhas: 0 });
		expect(await adapter.listarFila(TENANT)).toHaveLength(0);
		// A fila do outro tenant permanece intacta
		expect(await adapter.listarFila(OUTRO_TENANT)).toHaveLength(1);
	});

	it("impede manipulação de mutação pertencente a outro tenant", async () => {
		const mOutro = await adapter.enfileirar(OUTRO_TENANT, {
			entity: "clientes",
			action: "INSERT",
			payload: { id: CLIENTE_ID },
		});

		await expect(
			adapter.marcarSincronizando(TENANT, mOutro.id),
		).rejects.toThrow(OutboxMutacaoNaoEncontradaError);
		await expect(
			adapter.concluirSincronizacao(TENANT, mOutro.id),
		).rejects.toThrow(OutboxMutacaoNaoEncontradaError);
		await expect(
			adapter.registrarFalha(TENANT, mOutro.id, "Erro"),
		).rejects.toThrow(OutboxMutacaoNaoEncontradaError);
	});

	it("aplica delta remoto com LWW por updated_at para cadastros de campo e preserva tombstones", async () => {
		const clienteLocal: Cliente = {
			id: CLIENTE_ID,
			tenant_id: TENANT,
			cnpj_cpf: "11222333000181",
			razao_social: "Mercado Local T2",
			nome_fantasia: "Local",
			ativo: true,
			created_at: T1,
			updated_at: T2,
			deleted_at: null,
		};
		await db.clientes.add(clienteLocal);

		// Remoto mais antigo (T1) -> ignorado pelo LWW
		const r1 = await adapter.aplicarDeltaRemoto(TENANT, "clientes", [
			{
				...clienteLocal,
				razao_social: "Mercado Remoto Defasado T1",
				updated_at: T1,
			},
		]);
		expect(r1).toEqual({ aplicados: 0, ignoradosPorConflito: 1 });
		expect((await db.clientes.get(CLIENTE_ID))?.razao_social).toBe(
			"Mercado Local T2",
		);

		// Remoto mais recente (T3) -> vence no LWW
		const r2 = await adapter.aplicarDeltaRemoto(TENANT, "clientes", [
			{
				...clienteLocal,
				razao_social: "Mercado Atualizado T3",
				updated_at: T3,
			},
		]);
		expect(r2).toEqual({ aplicados: 1, ignoradosPorConflito: 0 });
		expect((await db.clientes.get(CLIENTE_ID))?.razao_social).toBe(
			"Mercado Atualizado T3",
		);

		// Tombstone remoto mais recente -> aplica soft delete sem apagar registro
		await adapter.aplicarDeltaRemoto(TENANT, "clientes", [
			{
				...clienteLocal,
				updated_at: "2026-10-30T13:00:00.000Z",
				deleted_at: "2026-10-30T13:00:00.000Z",
			},
		]);
		expect((await db.clientes.get(CLIENTE_ID))?.deleted_at).toBe(
			"2026-10-30T13:00:00.000Z",
		);
	});

	it("aplica Client-Wins com idempotency_key para pedidos e Server-Wins para produtos", async () => {
		const pedidoLocal: Pedido = {
			id: PEDIDO_ID,
			tenant_id: TENANT,
			cliente_id: CLIENTE_ID,
			representada_id: REP_ID,
			tabela_id: TABELA_ID,
			endereco_entrega_id: null,
			contato_id: null,
			data_emissao: T1,
			condicao_pagamento: "30 dias",
			tipo_frete: "CIF",
			status: "emitido",
			valor_total_centavos: 45000,
			comissao_projetada_centavos: 2250,
			observacoes: null,
			idempotency_key: KEY_1,
			created_at: T1,
			updated_at: T1,
			deleted_at: null,
		};
		await db.pedidos.add(pedidoLocal);

		// Tentativa remota com outro ID mas mesma idempotency_key não sobrescreve nem duplica
		const deltaPedido = await adapter.aplicarDeltaRemoto(TENANT, "pedidos", [
			{
				...pedidoLocal,
				id: crypto.randomUUID(),
				valor_total_centavos: 1000,
				updated_at: T3,
			},
		]);
		expect(deltaPedido).toEqual({ aplicados: 0, ignoradosPorConflito: 1 });
		expect(await db.pedidos.count()).toBe(1);
		expect((await db.pedidos.get(PEDIDO_ID))?.valor_total_centavos).toBe(45000);

		// Produto da fábrica (Server-Wins)
		const produtoRemoto: Produto = {
			id: PRODUTO_ID,
			tenant_id: TENANT,
			representada_id: REP_ID,
			sku: "VIN-999",
			descricao: "Reserva Especial",
			unidade_medida: "CX",
			multiplo_embalagem: 6,
			ativo: true,
			created_at: T1,
			updated_at: T2,
			deleted_at: null,
		};
		const deltaProduto = await adapter.aplicarDeltaRemoto(TENANT, "produtos", [
			produtoRemoto,
		]);
		expect(deltaProduto).toEqual({ aplicados: 1, ignoradosPorConflito: 0 });
		expect(await db.produtos.get(PRODUTO_ID)).toEqual(produtoRemoto);

		// Rejeita registro remoto de outro tenant
		await expect(
			adapter.aplicarDeltaRemoto(TENANT, "produtos", [
				{ ...produtoRemoto, tenant_id: OUTRO_TENANT },
			]),
		).rejects.toThrow(TenantDivergenteError);
	});

	it("ClienteDexieAdapter grava mutações na outbox transacionalmente ao criar e editar clientes", async () => {
		const clienteAdapter = new ClienteDexieAdapter({ agora: () => T1 });
		const criado = await clienteAdapter.criar(TENANT, {
			cliente: {
				cnpj_cpf: "11222333000181",
				razao_social: "Distribuidora Sul Ltda",
				nome_fantasia: "Sul Bebidas",
			},
			enderecos: [
				{
					tipo_endereco: "ENTREGA",
					endereco_completo: "Rua das Vinícolas, 100",
				},
			],
			contatos: [
				{
					nome: "Mariana",
					papel: "COMPRADOR",
					telefone_whatsapp: "51999998888",
				},
			],
		});

		const fila = await adapter.listarFila(TENANT);
		expect(fila).toHaveLength(3);
		expect(fila.map((m) => `${m.entity}:${m.action}`)).toEqual([
			"clientes:INSERT",
			"clientes_enderecos:INSERT",
			"clientes_contatos:INSERT",
		]);
		expect(fila[0]?.payload.id).toBe(criado.cliente.id);
	});
});
