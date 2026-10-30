import {
	garantirMesmoTenant,
	TenantDivergenteError,
} from "../../../shared/domain/tenant";
import {
	type AcaoOutbox,
	ENTIDADES_SINCRONIZAVEIS,
	type EnfileirarMutacaoInput,
	EnfileirarMutacaoInputSchema,
	type EntidadeSincronizavel,
	EntidadeSincronizavelSchema,
	type OutboxMutation,
	OutboxMutationSchema,
} from "./outbox.schema";

export class OutboxMutacaoNaoEncontradaError extends Error {
	readonly id: string;

	constructor(id: string) {
		super(`Mutação da fila outbox ${id} não encontrada.`);
		this.name = "OutboxMutacaoNaoEncontradaError";
		this.id = id;
	}
}

export interface ResumoFilaOutbox {
	pendentes: number;
	sincronizando: number;
	falhas: number;
	total: number;
}

export interface RegistroComCicloDeVida {
	id?: string;
	tenant_id: string;
	created_at?: string;
	updated_at?: string;
	deleted_at?: string | null;
}

/**
 * Determina a ação de sincronização (`INSERT`, `UPDATE` ou `DELETE`) de um
 * registro a partir do seu estado de exclusão lógica e da existência prévia.
 */
export function determinarAcaoMutacao(
	registro: { deleted_at?: string | null },
	existiaAntes: boolean,
): AcaoOutbox {
	if (registro.deleted_at !== null && registro.deleted_at !== undefined) {
		return "DELETE";
	}
	return existiaAntes ? "UPDATE" : "INSERT";
}

export interface CriarMutacaoOutboxParams {
	id: string;
	tenantId: string;
	input: EnfileirarMutacaoInput;
	agora: string;
	gerarId?: () => string;
}

/**
 * Cria uma entrada validada na fila Outbox, garantindo que o `payload`
 * pertença ao mesmo `tenantId` caso contenha a propriedade `tenant_id`.
 */
export function criarMutacaoOutbox({
	id,
	tenantId,
	input,
	agora,
	gerarId = () => crypto.randomUUID(),
}: CriarMutacaoOutboxParams): OutboxMutation {
	const dados = EnfileirarMutacaoInputSchema.parse(input);
	const tenantDoPayload = dados.payload.tenant_id;

	if (
		typeof tenantDoPayload === "string" &&
		tenantDoPayload.trim().length > 0 &&
		tenantDoPayload !== tenantId
	) {
		throw new TenantDivergenteError();
	}

	const payloadComTenant: Record<string, unknown> = {
		...dados.payload,
		tenant_id: tenantId,
	};

	return OutboxMutationSchema.parse({
		id,
		tenant_id: tenantId,
		entity: dados.entity,
		action: dados.action,
		payload: payloadComTenant,
		idempotency_key: dados.idempotency_key ?? gerarId(),
		status: "pending",
		retry_count: 0,
		created_at: agora,
	});
}

export interface CriarMutacaoParaRegistroParams<
	T extends RegistroComCicloDeVida,
> {
	id?: string;
	tenantId: string;
	entity: EntidadeSincronizavel;
	registro: T;
	existiaAntes: boolean;
	idempotencyKey?: string;
	agora: string;
	gerarId?: () => string;
}

/**
 * Converte um registro de domínio persistido localmente em uma `OutboxMutation`
 * pronta para gravação transacional na tabela `outbox`.
 */
export function criarMutacaoParaRegistro<T extends RegistroComCicloDeVida>({
	id,
	tenantId,
	entity,
	registro,
	existiaAntes,
	idempotencyKey,
	agora,
	gerarId = () => crypto.randomUUID(),
}: CriarMutacaoParaRegistroParams<T>): OutboxMutation {
	garantirMesmoTenant(registro, tenantId);
	const action = determinarAcaoMutacao(registro, existiaAntes);
	const payload: Record<string, unknown> = Object.fromEntries(
		Object.entries(registro),
	);

	return criarMutacaoOutbox({
		id: id ?? gerarId(),
		tenantId,
		input: {
			entity,
			action,
			payload,
			idempotency_key: idempotencyKey ?? gerarId(),
		},
		agora,
		gerarId,
	});
}

/** Marca uma mutação da fila como em processo de envio (`syncing`). */
export function iniciarSincronizacaoMutacao(
	mutacao: OutboxMutation,
	tenantId: string,
): OutboxMutation {
	garantirMesmoTenant(mutacao, tenantId);
	return OutboxMutationSchema.parse({
		...mutacao,
		status: "syncing",
	});
}

/** Registra falha de envio na mutação, incrementando `retry_count` e gravando `last_error`. */
export function registrarFalhaMutacao(
	mutacao: OutboxMutation,
	tenantId: string,
	erro: string,
): OutboxMutation {
	garantirMesmoTenant(mutacao, tenantId);
	const mensagem = erro.trim() || "Falha desconhecida na sincronização";
	return OutboxMutationSchema.parse({
		...mutacao,
		status: "failed",
		retry_count: mutacao.retry_count + 1,
		last_error: mensagem,
	});
}

/** Reenfileira uma mutação com falha de volta para `pending`. */
export function reenfileirarMutacaoFalha(
	mutacao: OutboxMutation,
	tenantId: string,
): OutboxMutation {
	garantirMesmoTenant(mutacao, tenantId);
	if (mutacao.status !== "failed") {
		return mutacao;
	}
	return OutboxMutationSchema.parse({
		...mutacao,
		status: "pending",
	});
}

const ORDEM_DEPENDENCIA_ENTIDADE: ReadonlyMap<EntidadeSincronizavel, number> =
	new Map(ENTIDADES_SINCRONIZAVEIS.map((entidade, idx) => [entidade, idx]));

/**
 * Ordena a fila Outbox em ordem FIFO (`created_at` ascendente), respeitando a
 * precedência de chaves estrangeiras entre tabelas pai e filha quando geradas
 * na mesma transação (`created_at` idêntico), com desempate determinístico por `id`.
 */
export function ordenarFilaOutbox(
	mutacoes: readonly OutboxMutation[],
): OutboxMutation[] {
	return [...mutacoes].sort(
		(a, b) =>
			a.created_at.localeCompare(b.created_at) ||
			(ORDEM_DEPENDENCIA_ENTIDADE.get(a.entity) ?? 0) -
				(ORDEM_DEPENDENCIA_ENTIDADE.get(b.entity) ?? 0) ||
			a.id.localeCompare(b.id),
	);
}

/** Calcula os contadores de status da fila Outbox de um tenant. */
export function resumirFilaOutbox(
	mutacoes: readonly OutboxMutation[],
): ResumoFilaOutbox {
	let pendentes = 0;
	let sincronizando = 0;
	let falhas = 0;

	for (const m of mutacoes) {
		if (m.status === "pending") pendentes++;
		else if (m.status === "syncing") sincronizando++;
		else if (m.status === "failed") falhas++;
	}

	return {
		pendentes,
		sincronizando,
		falhas,
		total: mutacoes.length,
	};
}

export type PoliticaConflitoSincronizacao =
	| "CLIENT_WINS_IDEMPOTENCY"
	| "LWW_CAMPO"
	| "SERVER_WINS";

const ENTIDADES_CAMPO_LWW: ReadonlySet<EntidadeSincronizavel> = new Set([
	"clientes",
	"clientes_enderecos",
	"clientes_contatos",
	"clientes_tabelas_preco",
]);

const ENTIDADES_TRANSACIONAIS_CAMPO: ReadonlySet<EntidadeSincronizavel> =
	new Set(["pedidos", "itens_pedido"]);

/**
 * Retorna a política de resolução de conflitos definida no PRD 3.2:
 * - `pedidos` / `itens_pedido`: `CLIENT_WINS_IDEMPOTENCY`
 * - `clientes` / `clientes_enderecos` / `clientes_contatos` / `clientes_tabelas_preco`: `LWW_CAMPO` (por `updated_at`, registro a registro)
 * - Mestres da fábrica (`representadas`, `produtos`, `tabelas_preco`, `itens_preco`, `clientes_metricas`): `SERVER_WINS`
 */
export function obterPoliticaConflito(
	entity: EntidadeSincronizavel,
): PoliticaConflitoSincronizacao {
	const entidadeValida = EntidadeSincronizavelSchema.parse(entity);
	if (ENTIDADES_TRANSACIONAIS_CAMPO.has(entidadeValida)) {
		return "CLIENT_WINS_IDEMPOTENCY";
	}
	if (ENTIDADES_CAMPO_LWW.has(entidadeValida)) {
		return "LWW_CAMPO";
	}
	return "SERVER_WINS";
}

export interface RegistroSincronizavel {
	tenant_id: string;
	updated_at?: string;
	deleted_at?: string | null;
	idempotency_key?: string;
}

export interface ResolverConflitoParams<T extends RegistroSincronizavel> {
	entity: EntidadeSincronizavel;
	tenantId: string;
	local: T | undefined;
	remoto: T;
}

export interface DecisaoConflito<T extends RegistroSincronizavel> {
	vencedor: "local" | "remoto";
	registro: T;
	politica: PoliticaConflitoSincronizacao;
	motivo:
		| "novo_registro_remoto"
		| "client_wins_idempotency"
		| "lww_remoto_mais_recente"
		| "lww_local_mais_recente_ou_igual"
		| "server_wins_autoridade_fabrica";
}

/**
 * Resolve conflitos entre o registro armazenado no Dexie (`local`) e o registro
 * recebido da nuvem (`remoto`) conforme o PRD 3.2:
 * - **Cadastros de campo (`LWW_CAMPO`)**: compara `updated_at` registro a registro;
 *   o `remoto` só sobrescreve o `local` quando `remoto.updated_at > local.updated_at`
 *   (inclusive aplicando tombstones `deleted_at !== null`).
 * - **Pedidos e itens (`CLIENT_WINS_IDEMPOTENCY`)**: preserva o registro local se já
 *   existir no aparelho (ou tiver a mesma `idempotency_key`), evitando que um pedido
 *   emitido offline seja sobrescrito.
 * - **Mestres da fábrica (`SERVER_WINS`)**: o servidor é a autoridade; atualiza sempre
 *   que não houver edição local mais nova pendente (`remoto.updated_at >= local.updated_at`
 *   ou sem `updated_at`).
 */
export function resolverConflitoSincronizacao<T extends RegistroSincronizavel>({
	entity,
	tenantId,
	local,
	remoto,
}: ResolverConflitoParams<T>): DecisaoConflito<T> {
	const politica = obterPoliticaConflito(entity);
	garantirMesmoTenant(remoto, tenantId);
	if (local) {
		garantirMesmoTenant(local, tenantId);
	}

	if (!local) {
		return {
			vencedor: "remoto",
			registro: remoto,
			politica,
			motivo: "novo_registro_remoto",
		};
	}

	if (politica === "CLIENT_WINS_IDEMPOTENCY") {
		return {
			vencedor: "local",
			registro: local,
			politica,
			motivo: "client_wins_idempotency",
		};
	}

	if (politica === "LWW_CAMPO") {
		const dataLocal = local.updated_at ?? "";
		const dataRemota = remoto.updated_at ?? "";
		if (dataRemota.localeCompare(dataLocal) > 0) {
			return {
				vencedor: "remoto",
				registro: remoto,
				politica,
				motivo: "lww_remoto_mais_recente",
			};
		}
		return {
			vencedor: "local",
			registro: local,
			politica,
			motivo: "lww_local_mais_recente_ou_igual",
		};
	}

	// SERVER_WINS (Mestres da fábrica)
	const dataLocal = local.updated_at ?? "";
	const dataRemota = remoto.updated_at ?? "";
	if (
		dataLocal === "" ||
		dataRemota === "" ||
		dataRemota.localeCompare(dataLocal) >= 0
	) {
		return {
			vencedor: "remoto",
			registro: remoto,
			politica,
			motivo: "server_wins_autoridade_fabrica",
		};
	}

	return {
		vencedor: "local",
		registro: local,
		politica,
		motivo: "lww_local_mais_recente_ou_igual",
	};
}
