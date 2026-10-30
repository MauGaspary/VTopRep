import {
	formatarInteiroComoDecimalBr,
	parseDecimalBrParaInteiro,
} from "../../../shared/domain/decimal-br";
import { CEM_POR_CENTO_CENTESIMOS } from "../../../shared/domain/dinheiro";
import { mapearIssues } from "../../../shared/domain/formulario";
import {
	type CalculoItemPedido,
	calcularItemPedido,
	calcularTotaisPedido,
	type ItemCalculavel,
	type PedidoCompleto,
	type TotaisPedido,
} from "./pedido";
import { PedidoInputSchema, type PedidoInputValidado } from "./pedido.schema";

export interface ItemOrcamentoFormValues {
	localId: string;
	id?: string;
	produto_id: string;
	preco_unitario_tabela_centavos: number;
	quantidade: string;
	percentual_desconto: string;
}

export interface PedidoFormValues {
	cliente_id: string;
	representada_id: string;
	tabela_id: string;
	endereco_entrega_id: string;
	contato_id: string;
	condicao_pagamento: string;
	tipo_frete: string;
	observacoes: string;
	itens: ItemOrcamentoFormValues[];
}

export type CampoItemPedidoForm = "quantidade" | "percentual_desconto";

/**
 * Chaves possíveis: `cliente_id`, `representada_id`, `tabela_id`,
 * `endereco_entrega_id`, `contato_id`, `condicao_pagamento`, `tipo_frete`,
 * `observacoes`, `itens`, `itens.<localId>.quantidade`,
 * `itens.<localId>.percentual_desconto`.
 */
export type PedidoFormErros = Partial<Record<string, string>>;

export type ResultadoFormularioPedido =
	| { success: true; data: PedidoInputValidado }
	| { success: false; erros: PedidoFormErros; geral: string | null };

export function chaveErroItemPedido(
	localId: string,
	campo: CampoItemPedidoForm,
): string {
	return `itens.${localId}.${campo}`;
}

const CAMPOS_TOPO = new Set<string>([
	"cliente_id",
	"representada_id",
	"tabela_id",
	"endereco_entrega_id",
	"contato_id",
	"condicao_pagamento",
	"tipo_frete",
	"observacoes",
	"itens",
]);

const SOMENTE_DIGITOS = /^\d+$/;

export interface DefaultsPedidoForm {
	clienteId?: string;
	representadaId?: string;
	tabelaId?: string;
	tipoFrete?: string;
	condicaoPagamento?: string;
}

export function valoresIniciaisPedidoForm(
	dados?: PedidoCompleto,
	defaults: DefaultsPedidoForm = {},
): PedidoFormValues {
	if (dados) {
		return {
			cliente_id: dados.pedido.cliente_id,
			representada_id: dados.pedido.representada_id,
			tabela_id: dados.pedido.tabela_id,
			endereco_entrega_id: dados.pedido.endereco_entrega_id ?? "",
			contato_id: dados.pedido.contato_id ?? "",
			condicao_pagamento: dados.pedido.condicao_pagamento,
			tipo_frete: dados.pedido.tipo_frete,
			observacoes: dados.pedido.observacoes ?? "",
			itens: dados.itens.map((item) => ({
				localId: item.id,
				id: item.id,
				produto_id: item.produto_id,
				preco_unitario_tabela_centavos: item.preco_unitario_tabela_centavos,
				quantidade: String(item.quantidade),
				percentual_desconto:
					item.percentual_desconto > 0
						? formatarInteiroComoDecimalBr(item.percentual_desconto)
						: "",
			})),
		};
	}

	return {
		cliente_id: defaults.clienteId ?? "",
		representada_id: defaults.representadaId ?? "",
		tabela_id: defaults.tabelaId ?? "",
		endereco_entrega_id: "",
		contato_id: "",
		condicao_pagamento: defaults.condicaoPagamento ?? "",
		tipo_frete: defaults.tipoFrete ?? "CIF",
		observacoes: "",
		itens: [],
	};
}

/**
 * Adiciona um produto ao orçamento, ou incrementa sua quantidade caso ele
 * já esteja na lista (mantendo o desconto e a posição existentes).
 */
export function adicionarOuIncrementarItemForm(
	itens: readonly ItemOrcamentoFormValues[],
	produtoId: string,
	precoUnitarioCentavos: number,
	gerarLocalId: () => string,
	incremento = 1,
): ItemOrcamentoFormValues[] {
	const passo = Math.max(1, Math.trunc(incremento));
	const indiceExistente = itens.findIndex((i) => i.produto_id === produtoId);

	if (indiceExistente >= 0) {
		return itens.map((item, idx) => {
			if (idx !== indiceExistente) return item;
			const qtdAtual = SOMENTE_DIGITOS.test(item.quantidade.trim())
				? Number(item.quantidade.trim())
				: 0;
			return {
				...item,
				preco_unitario_tabela_centavos: precoUnitarioCentavos,
				quantidade: String(Math.max(1, qtdAtual + passo)),
			};
		});
	}

	return [
		...itens,
		{
			localId: gerarLocalId(),
			produto_id: produtoId,
			preco_unitario_tabela_centavos: precoUnitarioCentavos,
			quantidade: String(passo),
			percentual_desconto: "",
		},
	];
}

/** Ajusta a quantidade de uma linha pelo delta (+1 / -1), nunca abaixo de 1. */
export function ajustarDeltaQuantidadeItemForm(
	itens: readonly ItemOrcamentoFormValues[],
	localId: string,
	delta: number,
): ItemOrcamentoFormValues[] {
	return itens.map((item) => {
		if (item.localId !== localId) return item;
		const qtdAtual = SOMENTE_DIGITOS.test(item.quantidade.trim())
			? Number(item.quantidade.trim())
			: 1;
		const novaQtd = Math.max(1, qtdAtual + Math.trunc(delta));
		return {
			...item,
			quantidade: String(novaQtd),
		};
	});
}

/**
 * Atualiza o `preco_unitario_tabela_centavos` dos itens já adicionados ao
 * trocar de tabela de preço na mesma representada.
 */
export function reprecificarItensFormPorTabela(
	itens: readonly ItemOrcamentoFormValues[],
	precosPorProduto: ReadonlyMap<string, { preco_base_centavos: number }>,
): {
	itens: ItemOrcamentoFormValues[];
	produtosSemPrecoIds: string[];
} {
	const produtosSemPrecoIds: string[] = [];
	const atualizados = itens.map((item) => {
		const preco = precosPorProduto.get(item.produto_id);
		if (!preco) {
			produtosSemPrecoIds.push(item.produto_id);
			return item;
		}
		if (item.preco_unitario_tabela_centavos === preco.preco_base_centavos) {
			return item;
		}
		return {
			...item,
			preco_unitario_tabela_centavos: preco.preco_base_centavos,
		};
	});

	return { itens: atualizados, produtosSemPrecoIds };
}

/**
 * Interpreta o texto de desconto (`""` => `0`, `"5,25"` => `525`).
 * Retorna `null` se o texto for inválido ou maior que 100,00%.
 */
export function parseDescontoFormParaCentesimos(texto: string): number | null {
	const limpo = texto.trim();
	if (limpo === "") return 0;
	const parsed = parseDecimalBrParaInteiro(limpo);
	if (parsed === null || parsed < 0 || parsed > CEM_POR_CENTO_CENTESIMOS) {
		return null;
	}
	return parsed;
}

/**
 * Calcula a prévia financeira de uma linha enquanto o usuário digita.
 * Retorna `null` caso a quantidade ou o desconto estejam em estado inválido.
 */
export function calcularPreviaItemForm(
	linha: ItemOrcamentoFormValues,
): CalculoItemPedido | null {
	const qtdTexto = linha.quantidade.trim();
	if (!SOMENTE_DIGITOS.test(qtdTexto)) return null;
	const quantidade = Number(qtdTexto);
	if (!Number.isSafeInteger(quantidade) || quantidade <= 0) return null;

	const desconto = parseDescontoFormParaCentesimos(linha.percentual_desconto);
	if (desconto === null) return null;

	try {
		return calcularItemPedido({
			quantidade,
			preco_unitario_tabela_centavos: linha.preco_unitario_tabela_centavos,
			percentual_desconto: desconto,
		});
	} catch {
		return null;
	}
}

/**
 * Calcula a prévia dos totais do orçamento considerando todas as linhas válidas.
 */
export function calcularPreviaTotaisForm(
	itens: readonly ItemOrcamentoFormValues[],
	percentualComissaoPadrao: number,
): TotaisPedido {
	const calculaveis: ItemCalculavel[] = [];
	for (const linha of itens) {
		const previa = calcularPreviaItemForm(linha);
		if (previa) {
			calculaveis.push({
				quantidade: previa.quantidade,
				preco_unitario_tabela_centavos: previa.preco_unitario_tabela_centavos,
				percentual_desconto: previa.percentual_desconto,
			});
		}
	}
	return calcularTotaisPedido(calculaveis, percentualComissaoPadrao);
}

/** Converte e valida o formulário completo do orçamento/pedido. */
export function validarFormularioPedido(
	valores: PedidoFormValues,
): ResultadoFormularioPedido {
	const errosConversao: PedidoFormErros = {};

	const itensConvertidos = valores.itens.map((linha) => {
		const qtdTexto = linha.quantidade.trim();
		let quantidade = 0;
		if (SOMENTE_DIGITOS.test(qtdTexto)) {
			quantidade = Number(qtdTexto);
			if (quantidade <= 0) {
				errosConversao[chaveErroItemPedido(linha.localId, "quantidade")] =
					"Quantidade deve ser maior que zero";
			}
		} else {
			errosConversao[chaveErroItemPedido(linha.localId, "quantidade")] =
				"Informe um número inteiro maior que zero";
		}

		const descontoCentesimos = parseDescontoFormParaCentesimos(
			linha.percentual_desconto,
		);
		if (descontoCentesimos === null) {
			errosConversao[
				chaveErroItemPedido(linha.localId, "percentual_desconto")
			] = "Informe um desconto entre 0,00% e 100,00%";
		}

		return {
			id: linha.id,
			produto_id: linha.produto_id,
			quantidade: quantidade > 0 ? quantidade : 1,
			preco_unitario_tabela_centavos: linha.preco_unitario_tabela_centavos,
			percentual_desconto: descontoCentesimos ?? 0,
		};
	});

	const resultado = PedidoInputSchema.safeParse({
		cliente_id: valores.cliente_id,
		representada_id: valores.representada_id,
		tabela_id: valores.tabela_id,
		endereco_entrega_id: valores.endereco_entrega_id,
		contato_id: valores.contato_id,
		condicao_pagamento: valores.condicao_pagamento,
		tipo_frete: valores.tipo_frete,
		observacoes: valores.observacoes,
		itens: itensConvertidos,
	});

	if (resultado.success && Object.keys(errosConversao).length === 0) {
		return { success: true, data: resultado.data };
	}

	const { erros, geral } = mapearIssues(
		resultado.success ? [] : resultado.error.issues,
		(caminho) => {
			const [primeiro, segundo, terceiro] = caminho;
			if (
				primeiro === "itens" &&
				typeof segundo === "number" &&
				(terceiro === "quantidade" || terceiro === "percentual_desconto")
			) {
				const localId = valores.itens[segundo]?.localId;
				return localId ? chaveErroItemPedido(localId, terceiro) : "itens";
			}
			if (typeof primeiro === "string" && CAMPOS_TOPO.has(primeiro)) {
				return primeiro;
			}
			return undefined;
		},
		errosConversao,
	);

	return { success: false, erros, geral };
}
