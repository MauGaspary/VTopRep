import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import {
	type ClienteTabelaPreco,
	ClienteTabelaPrecoSchema,
} from "./cliente-tabela-preco.schema";
import {
	type ItemPreco,
	ItemPrecoSchema,
	type PrecoProdutoInput,
	PrecoProdutoInputSchema,
} from "./item-preco.schema";
import type { Produto } from "./produto.schema";
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

/**
 * Associações vivas de tabela padrão de um cliente, indexadas por `representada_id`.
 * Se houver duplicatas para a mesma representada (sincronização offline), vence a
 * de `updated_at` mais recente.
 */
export function indexarTabelasPadraoDoCliente(
	associacoes: readonly ClienteTabelaPreco[],
	tenantId: string,
	clienteId: string,
): Map<string, ClienteTabelaPreco> {
	const porRepresentada = new Map<string, ClienteTabelaPreco>();
	for (const assoc of associacoes) {
		if (
			assoc.tenant_id !== tenantId ||
			assoc.cliente_id !== clienteId ||
			assoc.deleted_at !== null
		) {
			continue;
		}
		const atual = porRepresentada.get(assoc.representada_id);
		if (!atual || assoc.updated_at > atual.updated_at) {
			porRepresentada.set(assoc.representada_id, assoc);
		}
	}
	return porRepresentada;
}

/**
 * Itens de preço vivos de um produto, indexados por `tabela_id`.
 * Se houver duplicatas para a mesma tabela (sincronização offline), vence o
 * de `updated_at` mais recente.
 */
export function indexarItensPrecoDoProduto(
	itens: readonly ItemPreco[],
	tenantId: string,
	produtoId: string,
): Map<string, ItemPreco> {
	const porTabela = new Map<string, ItemPreco>();
	for (const item of itens) {
		if (
			item.tenant_id !== tenantId ||
			item.produto_id !== produtoId ||
			item.deleted_at !== null
		) {
			continue;
		}
		const atual = porTabela.get(item.tabela_id);
		if (!atual || item.updated_at > atual.updated_at) {
			porTabela.set(item.tabela_id, item);
		}
	}
	return porTabela;
}

export interface SincronizarPrecosProdutoParams {
	tenantId: string;
	produto: Pick<Produto, "id" | "tenant_id" | "representada_id">;
	/** Todas as tabelas não excluídas da representada do produto. */
	tabelasDaRepresentada: readonly TabelaPreco[];
	/** Todos os itens de preço existentes do produto no tenant. */
	existentes: readonly ItemPreco[];
	inputs: readonly PrecoProdutoInput[];
	agora: string;
	gerarId?: () => string;
}

export interface PrecosSincronizados {
	/** Itens de preço vivos resultantes para o produto. */
	ativos: ItemPreco[];
	/** Registros a persistir: novos, alterados e removidos (tombstones). */
	gravar: ItemPreco[];
}

/**
 * Reconcilia os preços do produto por tabela da sua representada:
 * - `preco_base_centavos !== null`: cria ou atualiza o `ItemPreco` (mantém intacto se não mudou);
 * - `preco_base_centavos === null`: marca `deleted_at` no item existente da tabela;
 * - itens de outras tabelas da mesma representada não enviadas em `inputs` (ex.: tabelas
 *   encerradas ou inativas): permanecem preservados;
 * - itens de tabelas que não pertencem à representada atual do produto (ex.: quando o
 *   produto mudou de representada): recebem `deleted_at`.
 */
export function sincronizarPrecosProduto({
	tenantId,
	produto,
	tabelasDaRepresentada,
	existentes,
	inputs,
	agora,
	gerarId = () => crypto.randomUUID(),
}: SincronizarPrecosProdutoParams): PrecosSincronizados {
	garantirMesmoTenant(produto, tenantId);
	for (const tabela of tabelasDaRepresentada) {
		garantirMesmoTenant(tabela, tenantId);
	}
	for (const item of existentes) {
		garantirMesmoTenant(item, tenantId);
	}

	const tabelasValidas = new Set(
		tabelasDaRepresentada
			.filter(
				(t) =>
					t.deleted_at === null &&
					t.representada_id === produto.representada_id,
			)
			.map((t) => t.id),
	);

	// Agrupa itens vivos do produto por tabela_id (mais recente primeiro)
	const vivosPorTabela = new Map<string, ItemPreco[]>();
	for (const item of existentes) {
		if (item.produto_id !== produto.id || item.deleted_at !== null) continue;
		const lista = vivosPorTabela.get(item.tabela_id) ?? [];
		lista.push(item);
		vivosPorTabela.set(item.tabela_id, lista);
	}
	for (const lista of vivosPorTabela.values()) {
		lista.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
	}

	const tabelasProcessadas = new Set<string>();
	const ativos: ItemPreco[] = [];
	const gravar: ItemPreco[] = [];

	for (const rawInput of inputs) {
		const dados = PrecoProdutoInputSchema.parse(rawInput);
		if (!tabelasValidas.has(dados.tabela_id)) {
			throw new TabelaPrecoNaoEncontradaError(dados.tabela_id);
		}
		if (tabelasProcessadas.has(dados.tabela_id)) {
			continue;
		}
		tabelasProcessadas.add(dados.tabela_id);

		const [principal, ...duplicados] =
			vivosPorTabela.get(dados.tabela_id) ?? [];
		for (const dup of duplicados) {
			gravar.push({ ...dup, updated_at: agora, deleted_at: agora });
		}

		if (dados.preco_base_centavos === null) {
			if (principal) {
				gravar.push({ ...principal, updated_at: agora, deleted_at: agora });
			}
			continue;
		}

		if (principal) {
			const inalterado =
				principal.preco_base_centavos === dados.preco_base_centavos &&
				principal.desconto_maximo_permitido === dados.desconto_maximo_permitido;
			if (inalterado) {
				ativos.push(principal);
			} else {
				const atualizado = ItemPrecoSchema.parse({
					...principal,
					preco_base_centavos: dados.preco_base_centavos,
					desconto_maximo_permitido: dados.desconto_maximo_permitido,
					updated_at: agora,
					deleted_at: null,
				});
				ativos.push(atualizado);
				gravar.push(atualizado);
			}
			continue;
		}

		const novo = ItemPrecoSchema.parse({
			id: gerarId(),
			tenant_id: tenantId,
			tabela_id: dados.tabela_id,
			produto_id: produto.id,
			preco_base_centavos: dados.preco_base_centavos,
			desconto_maximo_permitido: dados.desconto_maximo_permitido,
			created_at: agora,
			updated_at: agora,
			deleted_at: null,
		});
		ativos.push(novo);
		gravar.push(novo);
	}

	// Trata tabelas não mencionadas no input: preserva as da mesma representada,
	// e remove (tombstone) as que ficaram órfãs por troca de representada.
	for (const [tabelaId, lista] of vivosPorTabela.entries()) {
		if (tabelasProcessadas.has(tabelaId)) continue;

		if (!tabelasValidas.has(tabelaId)) {
			for (const item of lista) {
				gravar.push({ ...item, updated_at: agora, deleted_at: agora });
			}
			continue;
		}

		const [principal, ...duplicados] = lista;
		if (principal) ativos.push(principal);
		for (const dup of duplicados) {
			gravar.push({ ...dup, updated_at: agora, deleted_at: agora });
		}
	}

	return { ativos, gravar };
}
