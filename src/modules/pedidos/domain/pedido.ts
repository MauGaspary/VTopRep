import {
	aplicarPercentual,
	multiplicarPorFracao,
	somarCentavos,
} from "../../../shared/domain/dinheiro";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import type { TipoCliente } from "../../clientes/domain/cliente.schema";
import {
	type ComissaoRepresentadaConfig,
	resolverPercentualComissaoRepresentada,
} from "../../representadas/domain/representada";
import {
	type ItemPedido,
	type ItemPedidoCalculoInput,
	ItemPedidoCalculoInputSchema,
	type ItemPedidoInput,
	ItemPedidoInputSchema,
	ItemPedidoSchema,
	PercentualDescontoSchema,
	PrecoUnitarioCentavosSchema,
} from "./item-pedido.schema";
import {
	type Pedido,
	type PedidoInput,
	PedidoInputSchema,
	PedidoSchema,
	PercentualComissaoSchema,
	type StatusPedido,
} from "./pedido.schema";

export class PedidoNaoEncontradoError extends Error {
	readonly id: string;

	constructor(id: string) {
		super(`Orçamento ou pedido ${id} não encontrado.`);
		this.name = "PedidoNaoEncontradoError";
		this.id = id;
	}
}

export class PedidoImutavelError extends Error {
	readonly id: string;
	readonly status: StatusPedido;

	constructor(id: string, status: StatusPedido) {
		super(
			`O pedido ${id} já está com status "${status}" e não pode ser alterado ou excluído.`,
		);
		this.name = "PedidoImutavelError";
		this.id = id;
		this.status = status;
	}
}

export class ContextoVendaInvalidoError extends Error {
	constructor(mensagem: string) {
		super(mensagem);
		this.name = "ContextoVendaInvalidoError";
	}
}

export interface PedidoCompleto {
	pedido: Pedido;
	itens: ItemPedido[];
}

export interface CalculoItemPedido {
	quantidade: number;
	preco_unitario_tabela_centavos: number;
	percentual_desconto: number;
	desconto_unitario_centavos: number;
	preco_liquido_unitario_centavos: number;
	subtotal_tabela_centavos: number;
	desconto_total_centavos: number;
	subtotal_centavos: number;
}

export interface TotaisPedido {
	quantidade_itens: number;
	quantidade_total_volumes: number;
	valor_tabela_total_centavos: number;
	desconto_total_centavos: number;
	valor_total_centavos: number;
	percentual_comissao_padrao: number;
	comissao_projetada_centavos: number;
}

export type ItemCalculavel = ItemPedidoCalculoInput & {
	deleted_at?: string | null;
};

/**
 * Calcula o preço líquido unitário em centavos a partir do `percentual_desconto`
 * (centésimos de %, fonte da verdade), aplicando arredondamento bancário (half-even)
 * no valor do desconto unitário:
 * `preco_liquido = preco_unitario - aplicarPercentual(preco_unitario, percentual_desconto)`
 */
export function calcularPrecoLiquidoUnitario(
	precoUnitarioTabelaCentavos: number,
	percentualDesconto = 0,
): number {
	const precoUnitario = PrecoUnitarioCentavosSchema.parse(
		precoUnitarioTabelaCentavos,
	);
	const desconto = PercentualDescontoSchema.parse(percentualDesconto);
	return precoUnitario - aplicarPercentual(precoUnitario, desconto);
}

/**
 * Calcula os valores unitários e subtotais de um item do orçamento/pedido.
 * Garante que todas as operações intermediárias e finais permaneçam em inteiros seguros.
 */
export function calcularItemPedido(
	input: ItemPedidoCalculoInput,
): CalculoItemPedido {
	const { quantidade, preco_unitario_tabela_centavos, percentual_desconto } =
		ItemPedidoCalculoInputSchema.parse(input);

	const desconto_unitario_centavos = aplicarPercentual(
		preco_unitario_tabela_centavos,
		percentual_desconto,
	);
	const preco_liquido_unitario_centavos =
		preco_unitario_tabela_centavos - desconto_unitario_centavos;
	const subtotal_tabela_centavos = multiplicarPorFracao(
		preco_unitario_tabela_centavos,
		quantidade,
		1,
	);
	const subtotal_centavos = multiplicarPorFracao(
		preco_liquido_unitario_centavos,
		quantidade,
		1,
	);
	const desconto_total_centavos = subtotal_tabela_centavos - subtotal_centavos;

	return {
		quantidade,
		preco_unitario_tabela_centavos,
		percentual_desconto,
		desconto_unitario_centavos,
		preco_liquido_unitario_centavos,
		subtotal_tabela_centavos,
		desconto_total_centavos,
		subtotal_centavos,
	};
}

interface CriarItemPedidoParams {
	id: string;
	tenantId: string;
	pedidoId: string;
	input: ItemPedidoInput;
	agora: string;
}

/**
 * Cria uma entidade `ItemPedido` validada, derivando `preco_liquido_unitario_centavos`
 * e `subtotal_centavos` a partir do motor financeiro.
 */
export function criarItemPedido({
	id,
	tenantId,
	pedidoId,
	input,
	agora,
}: CriarItemPedidoParams): ItemPedido {
	const dados = ItemPedidoInputSchema.parse(input);
	const calculo = calcularItemPedido(dados);

	return ItemPedidoSchema.parse({
		id,
		tenant_id: tenantId,
		pedido_id: pedidoId,
		produto_id: dados.produto_id,
		quantidade: calculo.quantidade,
		preco_unitario_tabela_centavos: calculo.preco_unitario_tabela_centavos,
		percentual_desconto: calculo.percentual_desconto,
		preco_liquido_unitario_centavos: calculo.preco_liquido_unitario_centavos,
		subtotal_centavos: calculo.subtotal_centavos,
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});
}

/**
 * Resolve o percentual de comissão aplicável ao pedido cruzando a representada
 * e o segmento do cliente (`REVENDA` vs. `FABRICA`).
 */
export function resolverPercentualComissaoPedido(
	representada: ComissaoRepresentadaConfig,
	tipoCliente?: TipoCliente | null,
): number {
	return PercentualComissaoSchema.parse(
		resolverPercentualComissaoRepresentada(representada, tipoCliente),
	);
}

/**
 * Calcula a comissão projetada do representante em centavos sobre o total líquido
 * do pedido, com arredondamento bancário (half-even).
 */
export function calcularComissaoProjetada(
	valorTotalCentavos: number,
	percentualComissaoPadrao: number,
): number {
	const total = PrecoUnitarioCentavosSchema.parse(valorTotalCentavos);
	const comissao = PercentualComissaoSchema.parse(percentualComissaoPadrao);
	return aplicarPercentual(total, comissao);
}

/**
 * Calcula os totalizadores globais do orçamento/pedido e a projeção de comissão
 * do representante. Ignora itens marcados com `deleted_at` (tombstones).
 */
export function calcularTotaisPedido(
	itens: readonly ItemCalculavel[],
	percentualComissaoPadrao: number,
): TotaisPedido {
	const comissao = PercentualComissaoSchema.parse(percentualComissaoPadrao);
	const itensVivos = itens.filter(
		(item) => item.deleted_at === null || item.deleted_at === undefined,
	);
	const calculados = itensVivos.map(calcularItemPedido);

	const quantidade_total_volumes = somarCentavos(
		calculados.map((item) => item.quantidade),
	);
	const valor_tabela_total_centavos = somarCentavos(
		calculados.map((item) => item.subtotal_tabela_centavos),
	);
	const valor_total_centavos = somarCentavos(
		calculados.map((item) => item.subtotal_centavos),
	);
	const desconto_total_centavos =
		valor_tabela_total_centavos - valor_total_centavos;
	const comissao_projetada_centavos = aplicarPercentual(
		valor_total_centavos,
		comissao,
	);

	return {
		quantidade_itens: calculados.length,
		quantidade_total_volumes,
		valor_tabela_total_centavos,
		desconto_total_centavos,
		valor_total_centavos,
		percentual_comissao_padrao: comissao,
		comissao_projetada_centavos,
	};
}

const mesmoConteudoItem = (a: ItemPedido, b: ItemPedido) =>
	a.produto_id === b.produto_id &&
	a.quantidade === b.quantidade &&
	a.preco_unitario_tabela_centavos === b.preco_unitario_tabela_centavos &&
	a.percentual_desconto === b.percentual_desconto &&
	a.preco_liquido_unitario_centavos === b.preco_liquido_unitario_centavos &&
	a.subtotal_centavos === b.subtotal_centavos;

export interface SincronizarItensPedidoParams {
	tenantId: string;
	pedidoId: string;
	agora: string;
	itensInput: readonly ItemPedidoInput[];
	existentes?: readonly ItemPedido[];
	gerarId?: () => string;
}

export interface ItensPedidoSincronizados {
	/** Itens vivos resultantes do orçamento/pedido. */
	ativos: ItemPedido[];
	/** Registros a persistir: novos, alterados e removidos (tombstones). */
	gravar: ItemPedido[];
}

/**
 * Reconcilia os itens enviados com os itens já gravados do pedido:
 * - `id` correspondente a um item vivo do pedido: preserva `id`/`created_at`
 *   (mantém intacto se inalterado, ou atualiza `updated_at`);
 * - sem `id` ou com `id` desconhecido/repetido: cria com novo id;
 * - itens vivos ausentes do input: recebem `deleted_at` (soft delete).
 */
export function sincronizarItensPedido({
	tenantId,
	pedidoId,
	agora,
	itensInput,
	existentes = [],
	gerarId = () => crypto.randomUUID(),
}: SincronizarItensPedidoParams): ItensPedidoSincronizados {
	for (const item of existentes) {
		garantirMesmoTenant(item, tenantId);
	}

	const vivos = new Map(
		existentes
			.filter((i) => i.deleted_at === null && i.pedido_id === pedidoId)
			.map((i) => [i.id, i]),
	);
	const usados = new Set<string>();
	const ativos: ItemPedido[] = [];
	const gravar: ItemPedido[] = [];

	for (const rawInput of itensInput) {
		const dados = ItemPedidoInputSchema.parse(rawInput);
		const existente = dados.id !== undefined ? vivos.get(dados.id) : undefined;

		if (existente && !usadas_has(usados, existente.id)) {
			usados.add(existente.id);
			const calculado = criarItemPedido({
				id: existente.id,
				tenantId,
				pedidoId,
				input: dados,
				agora,
			});
			const candidato: ItemPedido = {
				...calculado,
				created_at: existente.created_at,
				updated_at: agora,
			};
			if (mesmoConteudoItem(existente, candidato)) {
				ativos.push(existente);
			} else {
				ativos.push(candidato);
				gravar.push(candidato);
			}
			continue;
		}

		const novo = criarItemPedido({
			id: gerarId(),
			tenantId,
			pedidoId,
			input: dados,
			agora,
		});
		ativos.push(novo);
		gravar.push(novo);
	}

	for (const existente of vivos.values()) {
		if (!usados.has(existente.id)) {
			gravar.push({ ...existente, updated_at: agora, deleted_at: agora });
		}
	}

	return { ativos, gravar };
}

function usadas_has(set: ReadonlySet<string>, id: string): boolean {
	return set.has(id);
}

export interface CriarPedidoCompletoParams {
	tenantId: string;
	input: PedidoInput;
	percentualComissaoPadrao: number;
	status?: "rascunho" | "emitido";
	pedidoId?: string;
	idempotencyKey?: string;
	agora: string;
	gerarId?: () => string;
}

export function criarPedidoCompleto({
	tenantId,
	input,
	percentualComissaoPadrao,
	status = "rascunho",
	pedidoId,
	idempotencyKey,
	agora,
	gerarId = () => crypto.randomUUID(),
}: CriarPedidoCompletoParams): PedidoCompleto {
	const dados = PedidoInputSchema.parse(input);
	const id = pedidoId ?? gerarId();

	const { ativos: itens } = sincronizarItensPedido({
		tenantId,
		pedidoId: id,
		agora,
		itensInput: dados.itens,
		gerarId,
	});

	const totais = calcularTotaisPedido(itens, percentualComissaoPadrao);

	const pedido = PedidoSchema.parse({
		id,
		tenant_id: tenantId,
		cliente_id: dados.cliente_id,
		representada_id: dados.representada_id,
		tabela_id: dados.tabela_id,
		endereco_entrega_id: dados.endereco_entrega_id,
		contato_id: dados.contato_id,
		data_emissao: agora,
		condicao_pagamento: dados.condicao_pagamento,
		tipo_frete: dados.tipo_frete,
		status,
		valor_total_centavos: totais.valor_total_centavos,
		comissao_projetada_centavos: totais.comissao_projetada_centavos,
		observacoes: dados.observacoes,
		idempotency_key: idempotencyKey ?? gerarId(),
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});

	return { pedido, itens };
}

export interface AtualizarPedidoCompletoParams {
	existente: Pedido;
	itensExistentes: readonly ItemPedido[];
	tenantId: string;
	input: PedidoInput;
	percentualComissaoPadrao: number;
	status?: "rascunho" | "emitido";
	idempotencyKey?: string;
	agora: string;
	gerarId?: () => string;
}

export interface PedidoAtualizado extends PedidoCompleto {
	gravarItens: ItemPedido[];
}

/**
 * Atualiza um rascunho de orçamento (ou emite o pedido). Pedidos que já saíram
 * do status `rascunho` são imutáveis (`PedidoImutavelError`).
 */
export function atualizarPedidoCompleto({
	existente,
	itensExistentes,
	tenantId,
	input,
	percentualComissaoPadrao,
	status = "rascunho",
	idempotencyKey,
	agora,
	gerarId = () => crypto.randomUUID(),
}: AtualizarPedidoCompletoParams): PedidoAtualizado {
	garantirMesmoTenant(existente, tenantId);
	if (existente.status !== "rascunho") {
		throw new PedidoImutavelError(existente.id, existente.status);
	}

	const dados = PedidoInputSchema.parse(input);
	const { ativos: itens, gravar: gravarItens } = sincronizarItensPedido({
		tenantId,
		pedidoId: existente.id,
		agora,
		itensInput: dados.itens,
		existentes: itensExistentes,
		gerarId,
	});

	const totais = calcularTotaisPedido(itens, percentualComissaoPadrao);

	const pedido = PedidoSchema.parse({
		...existente,
		cliente_id: dados.cliente_id,
		representada_id: dados.representada_id,
		tabela_id: dados.tabela_id,
		endereco_entrega_id: dados.endereco_entrega_id,
		contato_id: dados.contato_id,
		data_emissao: status === "emitido" ? agora : existente.data_emissao,
		condicao_pagamento: dados.condicao_pagamento,
		tipo_frete: dados.tipo_frete,
		status,
		valor_total_centavos: totais.valor_total_centavos,
		comissao_projetada_centavos: totais.comissao_projetada_centavos,
		observacoes: dados.observacoes,
		idempotency_key:
			status === "emitido"
				? (idempotencyKey ?? existente.idempotency_key)
				: existente.idempotency_key,
		updated_at: agora,
		deleted_at: null,
	});

	return { pedido, itens, gravarItens };
}

export interface ExcluirRascunhoParams {
	existente: Pedido;
	itensExistentes: readonly ItemPedido[];
	tenantId: string;
	agora: string;
}

/**
 * Marca um rascunho e seus itens vivos com `deleted_at` (tombstone).
 * Rejeita caso o pedido já tenha sido emitido.
 */
export function excluirRascunhoPedido({
	existente,
	itensExistentes,
	tenantId,
	agora,
}: ExcluirRascunhoParams): { pedido: Pedido; itens: ItemPedido[] } {
	garantirMesmoTenant(existente, tenantId);
	for (const item of itensExistentes) {
		garantirMesmoTenant(item, tenantId);
	}
	if (existente.status !== "rascunho") {
		throw new PedidoImutavelError(existente.id, existente.status);
	}

	const pedido: Pedido = {
		...existente,
		updated_at: agora,
		deleted_at: agora,
	};
	const itens = itensExistentes
		.filter((i) => i.deleted_at === null && i.pedido_id === existente.id)
		.map((i) => ({ ...i, updated_at: agora, deleted_at: agora }));

	return { pedido, itens };
}

/**
 * Sugere o endereço de entrega padrão do cliente: prioriza `ENTREGA`,
 * depois `PRINCIPAL`, ou o primeiro endereço disponível.
 */
export function escolherEnderecoEntregaPadrao<
	E extends { id: string; tipo_endereco: string },
>(enderecos: readonly E[]): string {
	const entrega = enderecos.find((e) => e.tipo_endereco === "ENTREGA");
	if (entrega) return entrega.id;
	const principal = enderecos.find((e) => e.tipo_endereco === "PRINCIPAL");
	if (principal) return principal.id;
	return enderecos[0]?.id ?? "";
}

/**
 * Sugere o contato padrão do cliente para o orçamento: prioriza `COMPRADOR`
 * ou o primeiro contato disponível.
 */
export function escolherContatoPadrao<
	C extends { id: string; papel?: string | null },
>(contatos: readonly C[]): string {
	const comprador = contatos.find((c) => c.papel === "COMPRADOR");
	if (comprador) return comprador.id;
	return contatos[0]?.id ?? "";
}

/** Ordena pedidos/orçamentos do mais recentemente atualizado/emitido para o mais antigo. */
export function ordenarPedidosPorDataDesc(
	pedidos: readonly Pedido[],
): Pedido[] {
	return [...pedidos].sort(
		(a, b) =>
			b.updated_at.localeCompare(a.updated_at) ||
			b.data_emissao.localeCompare(a.data_emissao),
	);
}
