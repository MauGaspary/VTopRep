import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import {
	type ClienteTabelaPreco,
	ClienteTabelaPrecoSchema,
} from "./cliente-tabela-preco.schema";
import type { ItemPreco } from "./item-preco.schema";
import type { TabelaPreco } from "./tabela-preco.schema";

export class TabelaPrecoNaoEncontradaError extends Error {
	readonly tabelaId: string;

	constructor(tabelaId: string) {
		super(
			`A tabela de preço informada (${tabelaId}) não foi encontrada ou está inativa neste tenant.`,
		);
		this.name = "TabelaPrecoNaoEncontradaError";
		this.tabelaId = tabelaId;
	}
}

export class ClienteNaoVinculadoError extends Error {
	readonly clienteId: string;

	constructor(clienteId: string) {
		super(
			`O cliente informado (${clienteId}) não foi encontrado neste tenant.`,
		);
		this.name = "ClienteNaoVinculadoError";
		this.clienteId = clienteId;
	}
}

/** Tabela utilizável: ativa e não excluída. */
export function tabelaDisponivel(tabela: TabelaPreco): boolean {
	return tabela.ativo && tabela.deleted_at === null;
}

/**
 * A vigência inclui os dois extremos; `vigencia_fim` ausente = em aberto.
 * `data` é uma data de calendário (`AAAA-MM-DD`), comparável como texto.
 */
export function tabelaVigenteEm(tabela: TabelaPreco, data: string): boolean {
	if (tabela.vigencia_inicio > data) return false;
	return !tabela.vigencia_fim || data <= tabela.vigencia_fim;
}

/**
 * Tabelas disponíveis e vigentes na data, da vigência mais recente para a
 * mais antiga (empate: ordem alfabética do nome).
 */
export function listarTabelasVigentes(
	tabelas: readonly TabelaPreco[],
	data: string,
): TabelaPreco[] {
	return tabelas
		.filter((t) => tabelaDisponivel(t) && tabelaVigenteEm(t, data))
		.sort(
			(a, b) =>
				b.vigencia_inicio.localeCompare(a.vigencia_inicio) ||
				a.nome_tabela.localeCompare(b.nome_tabela, "pt-BR", {
					sensitivity: "base",
				}),
		);
}

/**
 * Sugestão de tabela para o pedido: a padrão do cliente, se estiver entre as
 * vigentes; senão, a de vigência mais recente. O representante pode trocar.
 */
export function escolherTabelaSugerida(
	vigentes: readonly TabelaPreco[],
	tabelaPadraoId: string | null,
): TabelaPreco | null {
	const padrao = vigentes.find((t) => t.id === tabelaPadraoId);
	return padrao ?? vigentes[0] ?? null;
}

/**
 * Itens vivos da tabela, um por produto. Se houver mais de um item vivo para
 * o mesmo produto (dado inconsistente vindo da sincronização), vence o de
 * `updated_at` mais recente.
 */
export function indexarItensPreco(
	itens: readonly ItemPreco[],
	tabela: TabelaPreco,
): Map<string, ItemPreco> {
	const porProduto = new Map<string, ItemPreco>();
	for (const item of itens) {
		if (
			item.tenant_id !== tabela.tenant_id ||
			item.tabela_id !== tabela.id ||
			item.deleted_at !== null
		) {
			continue;
		}
		const atual = porProduto.get(item.produto_id);
		if (!atual || item.updated_at > atual.updated_at) {
			porProduto.set(item.produto_id, item);
		}
	}
	return porProduto;
}

export interface PrecoResolvido {
	tabela_id: string;
	produto_id: string;
	preco_base_centavos: number;
	/** Centésimos de %. Informativo nesta fase (trava no BACKLOG). */
	desconto_maximo_permitido: number;
}

export type MotivoTabelaIndisponivel =
	| "tabela_nao_encontrada"
	| "tabela_inativa"
	| "fora_de_vigencia";

export type MotivoSemPreco = MotivoTabelaIndisponivel | "produto_sem_preco";

export type ResolucaoPreco =
	| { ok: true; preco: PrecoResolvido }
	| { ok: false; motivo: MotivoSemPreco };

export type ResolucaoPrecosTabela =
	| { ok: true; precos: Map<string, PrecoResolvido> }
	| { ok: false; motivo: MotivoTabelaIndisponivel };

interface ResolverPrecosParams {
	tenantId: string;
	tabela: TabelaPreco | null;
	itens: readonly ItemPreco[];
	data: string;
}

type VerificacaoTabela =
	| { ok: true; tabela: TabelaPreco }
	| { ok: false; motivo: MotivoTabelaIndisponivel };

function verificarTabela(
	tenantId: string,
	tabela: TabelaPreco | null,
	data: string,
): VerificacaoTabela {
	if (!tabela || tabela.deleted_at !== null) {
		return { ok: false, motivo: "tabela_nao_encontrada" };
	}
	garantirMesmoTenant(tabela, tenantId);
	if (!tabela.ativo) return { ok: false, motivo: "tabela_inativa" };
	if (!tabelaVigenteEm(tabela, data)) {
		return { ok: false, motivo: "fora_de_vigencia" };
	}
	return { ok: true, tabela };
}

function paraPrecoResolvido(item: ItemPreco): PrecoResolvido {
	return {
		tabela_id: item.tabela_id,
		produto_id: item.produto_id,
		preco_base_centavos: item.preco_base_centavos,
		desconto_maximo_permitido: item.desconto_maximo_permitido,
	};
}

/** Resolve o preço de um produto na tabela selecionada, na data informada. */
export function resolverPreco({
	tenantId,
	tabela,
	itens,
	produtoId,
	data,
}: ResolverPrecosParams & { produtoId: string }): ResolucaoPreco {
	const verificacao = verificarTabela(tenantId, tabela, data);
	if (!verificacao.ok) return verificacao;

	const item = indexarItensPreco(itens, verificacao.tabela).get(produtoId);
	if (!item) return { ok: false, motivo: "produto_sem_preco" };
	return { ok: true, preco: paraPrecoResolvido(item) };
}

/** Todos os preços da tabela selecionada, por `produto_id` (para o catálogo). */
export function resolverPrecosDaTabela({
	tenantId,
	tabela,
	itens,
	data,
}: ResolverPrecosParams): ResolucaoPrecosTabela {
	const verificacao = verificarTabela(tenantId, tabela, data);
	if (!verificacao.ok) return verificacao;

	const precos = new Map<string, PrecoResolvido>();
	for (const [produtoId, item] of indexarItensPreco(
		itens,
		verificacao.tabela,
	)) {
		precos.set(produtoId, paraPrecoResolvido(item));
	}
	return { ok: true, precos };
}

interface DefinirTabelaPadraoParams {
	/** Associação viva atual do cliente para a representada da tabela, se houver. */
	existente: ClienteTabelaPreco | null;
	tenantId: string;
	clienteId: string;
	tabela: TabelaPreco;
	id: string;
	agora: string;
}

/**
 * Define a tabela padrão do cliente para a representada da tabela. Reaproveita
 * a associação existente (mesmo id). Idempotente se a tabela já for a padrão.
 */
export function definirTabelaPadrao({
	existente,
	tenantId,
	clienteId,
	tabela,
	id,
	agora,
}: DefinirTabelaPadraoParams): ClienteTabelaPreco {
	garantirMesmoTenant(tabela, tenantId);
	if (!tabelaDisponivel(tabela)) {
		throw new TabelaPrecoNaoEncontradaError(tabela.id);
	}

	if (existente) {
		garantirMesmoTenant(existente, tenantId);
		if (
			existente.cliente_id !== clienteId ||
			existente.representada_id !== tabela.representada_id
		) {
			throw new Error(
				"Associação existente não corresponde ao cliente e à representada da tabela",
			);
		}
		if (existente.tabela_id === tabela.id && existente.deleted_at === null) {
			return existente;
		}
		return ClienteTabelaPrecoSchema.parse({
			...existente,
			tabela_id: tabela.id,
			updated_at: agora,
			deleted_at: null,
		});
	}

	return ClienteTabelaPrecoSchema.parse({
		id,
		tenant_id: tenantId,
		cliente_id: clienteId,
		representada_id: tabela.representada_id,
		tabela_id: tabela.id,
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});
}

/** Remove a tabela padrão (tombstone). Idempotente. */
export function removerTabelaPadrao(
	existente: ClienteTabelaPreco,
	tenantId: string,
	agora: string,
): ClienteTabelaPreco {
	garantirMesmoTenant(existente, tenantId);
	if (existente.deleted_at !== null) return existente;
	return { ...existente, updated_at: agora, deleted_at: agora };
}
