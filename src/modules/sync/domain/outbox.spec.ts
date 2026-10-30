import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import {
	criarMutacaoOutbox,
	criarMutacaoParaRegistro,
	determinarAcaoMutacao,
	iniciarSincronizacaoMutacao,
	obterPoliticaConflito,
	ordenarFilaOutbox,
	reenfileirarMutacaoFalha,
	registrarFalhaMutacao,
	resolverConflitoSincronizacao,
	resumirFilaOutbox,
} from "./outbox";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const ID_A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const KEY_1 = "cccccccc-cccc-4ccc-accc-cccccccccccc";
const T1 = "2026-10-30T10:00:00.000Z";
const T2 = "2026-10-30T11:00:00.000Z";

describe("Fila Outbox e Resolução de Conflitos (Domínio)", () => {
	describe("determinarAcaoMutacao e criarMutacaoParaRegistro", () => {
		it("determina INSERT para novo registro, UPDATE para existente e DELETE para tombstone", () => {
			expect(determinarAcaoMutacao({ deleted_at: null }, false)).toBe("INSERT");
			expect(determinarAcaoMutacao({ deleted_at: null }, true)).toBe("UPDATE");
			expect(determinarAcaoMutacao({ deleted_at: T2 }, false)).toBe("DELETE");
			expect(determinarAcaoMutacao({ deleted_at: T2 }, true)).toBe("DELETE");
		});

		it("cria mutação validada para registro e rejeita tenant divergente", () => {
			const mutacao = criarMutacaoParaRegistro({
				id: ID_A,
				tenantId: TENANT,
				entity: "pedidos",
				registro: {
					id: ID_B,
					tenant_id: TENANT,
					status: "emitido",
					deleted_at: null,
				},
				existiaAntes: false,
				idempotencyKey: KEY_1,
				agora: T1,
			});

			expect(mutacao).toEqual({
				id: ID_A,
				tenant_id: TENANT,
				entity: "pedidos",
				action: "INSERT",
				payload: {
					id: ID_B,
					tenant_id: TENANT,
					status: "emitido",
					deleted_at: null,
				},
				idempotency_key: KEY_1,
				status: "pending",
				retry_count: 0,
				created_at: T1,
			});

			expect(() =>
				criarMutacaoOutbox({
					id: ID_A,
					tenantId: TENANT,
					input: {
						entity: "clientes",
						action: "UPDATE",
						payload: { id: ID_B, tenant_id: OUTRO_TENANT },
					},
					agora: T1,
				}),
			).toThrow(TenantDivergenteError);
		});
	});

	describe("transições de estado, ordenação FIFO e resumo da fila", () => {
		it("transiciona pending -> syncing -> failed -> pending preservando retry_count e validando tenant", () => {
			const base = criarMutacaoOutbox({
				id: ID_A,
				tenantId: TENANT,
				input: {
					entity: "pedidos",
					action: "INSERT",
					payload: { id: ID_B },
					idempotency_key: KEY_1,
				},
				agora: T1,
			});

			const sincronizando = iniciarSincronizacaoMutacao(base, TENANT);
			expect(sincronizando.status).toBe("syncing");

			const falha = registrarFalhaMutacao(
				sincronizando,
				TENANT,
				"Sem conexão com o servidor",
			);
			expect(falha.status).toBe("failed");
			expect(falha.retry_count).toBe(1);
			expect(falha.last_error).toBe("Sem conexão com o servidor");

			const reenfileirada = reenfileirarMutacaoFalha(falha, TENANT);
			expect(reenfileirada.status).toBe("pending");
			expect(reenfileirada.retry_count).toBe(1);

			expect(() => iniciarSincronizacaoMutacao(base, OUTRO_TENANT)).toThrow(
				TenantDivergenteError,
			);
		});

		it("ordena a fila em FIFO por created_at e sumariza status", () => {
			const mRecente = criarMutacaoOutbox({
				id: ID_B,
				tenantId: TENANT,
				input: { entity: "pedidos", action: "INSERT", payload: {} },
				agora: T2,
			});
			const mAntiga = criarMutacaoOutbox({
				id: ID_A,
				tenantId: TENANT,
				input: { entity: "clientes", action: "UPDATE", payload: {} },
				agora: T1,
			});
			const mFalha = registrarFalhaMutacao(mRecente, TENANT, "Timeout");

			const ordenadas = ordenarFilaOutbox([mFalha, mAntiga]);
			expect(ordenadas.map((m) => m.id)).toEqual([ID_A, ID_B]);

			expect(resumirFilaOutbox(ordenadas)).toEqual({
				pendentes: 1,
				sincronizando: 0,
				falhas: 1,
				total: 2,
			});
		});
	});

	describe("resolução de conflitos (PRD 3.2)", () => {
		it("classifica corretamente a política de conflito de cada entidade", () => {
			expect(obterPoliticaConflito("pedidos")).toBe("CLIENT_WINS_IDEMPOTENCY");
			expect(obterPoliticaConflito("itens_pedido")).toBe(
				"CLIENT_WINS_IDEMPOTENCY",
			);
			expect(obterPoliticaConflito("clientes")).toBe("LWW_CAMPO");
			expect(obterPoliticaConflito("clientes_enderecos")).toBe("LWW_CAMPO");
			expect(obterPoliticaConflito("clientes_contatos")).toBe("LWW_CAMPO");
			expect(obterPoliticaConflito("clientes_tabelas_preco")).toBe("LWW_CAMPO");
			expect(obterPoliticaConflito("produtos")).toBe("SERVER_WINS");
			expect(obterPoliticaConflito("representadas")).toBe("SERVER_WINS");
			expect(obterPoliticaConflito("tabelas_preco")).toBe("SERVER_WINS");
			expect(obterPoliticaConflito("itens_preco")).toBe("SERVER_WINS");
		});

		it("cadastros de campo seguem LWW por updated_at registro a registro (incluindo tombstones)", () => {
			const localAntigo: {
				id: string;
				tenant_id: string;
				razao_social: string;
				updated_at: string;
				deleted_at: string | null;
			} = {
				id: ID_A,
				tenant_id: TENANT,
				razao_social: "Versão Aparelho 1",
				updated_at: T1,
				deleted_at: null,
			};
			const remotoMaisRecente = {
				id: ID_A,
				tenant_id: TENANT,
				razao_social: "Versão Aparelho 2",
				updated_at: T2,
				deleted_at: null,
			};

			// Remoto mais recente vence
			const decisaoRemoto = resolverConflitoSincronizacao({
				entity: "clientes",
				tenantId: TENANT,
				local: localAntigo,
				remoto: remotoMaisRecente,
			});
			expect(decisaoRemoto.vencedor).toBe("remoto");
			expect(decisaoRemoto.registro.razao_social).toBe("Versão Aparelho 2");
			expect(decisaoRemoto.motivo).toBe("lww_remoto_mais_recente");

			// Local mais recente vence sobre remoto defasado
			const decisaoLocal = resolverConflitoSincronizacao({
				entity: "clientes",
				tenantId: TENANT,
				local: remotoMaisRecente,
				remoto: localAntigo,
			});
			expect(decisaoLocal.vencedor).toBe("local");
			expect(decisaoLocal.registro.razao_social).toBe("Versão Aparelho 2");
			expect(decisaoLocal.motivo).toBe("lww_local_mais_recente_ou_igual");

			// Tombstone remoto mais recente propaga o soft delete
			const tombstoneRemoto = {
				...localAntigo,
				updated_at: T2,
				deleted_at: T2,
			};
			const decisaoTombstone = resolverConflitoSincronizacao({
				entity: "clientes_enderecos",
				tenantId: TENANT,
				local: localAntigo,
				remoto: tombstoneRemoto,
			});
			expect(decisaoTombstone.vencedor).toBe("remoto");
			expect(decisaoTombstone.registro.deleted_at).toBe(T2);
		});

		it("pedidos e itens de pedido seguem Client-Wins com Idempotency Key quando já existem localmente", () => {
			const pedidoLocal = {
				id: ID_A,
				tenant_id: TENANT,
				valor_total_centavos: 25000,
				idempotency_key: KEY_1,
				updated_at: T1,
				deleted_at: null,
			};
			const pedidoRemoto = {
				...pedidoLocal,
				valor_total_centavos: 10000,
				updated_at: T2,
			};

			const decisao = resolverConflitoSincronizacao({
				entity: "pedidos",
				tenantId: TENANT,
				local: pedidoLocal,
				remoto: pedidoRemoto,
			});
			expect(decisao.vencedor).toBe("local");
			expect(decisao.registro.valor_total_centavos).toBe(25000);
			expect(decisao.motivo).toBe("client_wins_idempotency");

			// Se ainda não existe localmente (ex.: novo aparelho sincronizando histórico), aceita o remoto
			const decisaoNovo = resolverConflitoSincronizacao({
				entity: "pedidos",
				tenantId: TENANT,
				local: undefined,
				remoto: pedidoRemoto,
			});
			expect(decisaoNovo.vencedor).toBe("remoto");
			expect(decisaoNovo.motivo).toBe("novo_registro_remoto");
		});

		it("entidades mestres da fábrica seguem Server-Wins e rejeitam tenant divergente", () => {
			const produtoLocal = {
				id: ID_A,
				tenant_id: TENANT,
				descricao: "Local",
				updated_at: T1,
				deleted_at: null,
			};
			const produtoRemoto = {
				id: ID_A,
				tenant_id: TENANT,
				descricao: "Catálogo Fábrica",
				updated_at: T1, // mesmo timestamp -> servidor tem autoridade
				deleted_at: null,
			};

			const decisao = resolverConflitoSincronizacao({
				entity: "produtos",
				tenantId: TENANT,
				local: produtoLocal,
				remoto: produtoRemoto,
			});
			expect(decisao.vencedor).toBe("remoto");
			expect(decisao.registro.descricao).toBe("Catálogo Fábrica");

			expect(() =>
				resolverConflitoSincronizacao({
					entity: "produtos",
					tenantId: TENANT,
					local: produtoLocal,
					remoto: { ...produtoRemoto, tenant_id: OUTRO_TENANT },
				}),
			).toThrow(TenantDivergenteError);
		});
	});
});
