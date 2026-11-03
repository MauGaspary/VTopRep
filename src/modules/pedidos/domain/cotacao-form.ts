import { mapearIssues } from "../../../shared/domain/formulario";
import type { Representada } from "../../representadas/domain/representada.schema";
import type { CotacaoCompleta } from "./cotacao";
import {
	CotacaoInputSchema,
	type CotacaoInputValidado,
} from "./cotacao.schema";
import {
	chaveErroItemPedido,
	converterItensFormPedido,
	type ItemOrcamentoFormValues,
	type PedidoFormErros,
	valoresIniciaisPedidoForm,
} from "./pedido-form";

/** Seção da sacola referente a uma representada (vira um pedido individual). */
export interface GrupoOrcamentoFormValues {
	representada_id: string;
	tabela_id: string;
	/** `true` quando o representante escolheu a tabela (não segue a sugestão). */
	tabela_manual: boolean;
	condicao_pagamento: string;
	tipo_frete: string;
	itens: ItemOrcamentoFormValues[];
}

/** Workspace da cotação: contexto do cliente compartilhado + seções por fábrica. */
export interface CotacaoFormValues {
	cliente_id: string;
	endereco_entrega_id: string;
	contato_id: string;
	transportadora_id: string;
	observacoes: string;
	grupos: GrupoOrcamentoFormValues[];
}

export type CampoGrupoCotacao =
	| "representada_id"
	| "tabela_id"
	| "condicao_pagamento"
	| "tipo_frete"
	| "itens";

const CAMPOS_COMPARTILHADOS = new Set<string>([
	"cliente_id",
	"endereco_entrega_id",
	"contato_id",
	"transportadora_id",
	"observacoes",
]);

/**
 * Chaves de erro: campos compartilhados (`cliente_id`, ...), `itens` (sacola
 * vazia), `grupos.<representadaId>.<campo>` e `itens.<localId>.<campo>`.
 */
export function chaveErroGrupoCotacao(
	representadaId: string,
	campo: CampoGrupoCotacao,
): string {
	return `grupos.${representadaId}.${campo}`;
}

type RepresentadaDoGrupo = Pick<Representada, "id" | "regras_frete_padrao">;

/** Seção vazia para a representada, herdando o frete padrão da fábrica. */
export function novoGrupoOrcamentoForm(
	representada: RepresentadaDoGrupo,
	condicaoPagamento = "",
): GrupoOrcamentoFormValues {
	return {
		representada_id: representada.id,
		tabela_id: "",
		tabela_manual: false,
		condicao_pagamento: condicaoPagamento,
		tipo_frete: representada.regras_frete_padrao ?? "CIF",
		itens: [],
	};
}

export interface DefaultsCotacaoForm {
	clienteId?: string;
	representada?: RepresentadaDoGrupo;
}

export function valoresIniciaisCotacaoForm(
	cotacao?: CotacaoCompleta,
	defaults: DefaultsCotacaoForm = {},
): CotacaoFormValues {
	const primeiro = cotacao?.pedidos[0];
	if (cotacao && primeiro) {
		const base = valoresIniciaisPedidoForm(primeiro);
		return {
			cliente_id: base.cliente_id,
			endereco_entrega_id: base.endereco_entrega_id,
			contato_id: base.contato_id,
			transportadora_id: base.transportadora_id,
			observacoes: base.observacoes,
			grupos: cotacao.pedidos.map((pedidoCompleto) => {
				const valores = valoresIniciaisPedidoForm(pedidoCompleto);
				return {
					representada_id: valores.representada_id,
					tabela_id: valores.tabela_id,
					tabela_manual: true,
					condicao_pagamento: valores.condicao_pagamento,
					tipo_frete: valores.tipo_frete,
					itens: valores.itens,
				};
			}),
		};
	}

	return {
		cliente_id: defaults.clienteId ?? "",
		endereco_entrega_id: "",
		contato_id: "",
		transportadora_id: "",
		observacoes: "",
		grupos: defaults.representada
			? [novoGrupoOrcamentoForm(defaults.representada)]
			: [],
	};
}

/**
 * Garante uma seção para a representada (sem mexer nas demais). A nova seção
 * reaproveita a condição de pagamento da última seção, que costuma se repetir.
 */
export function garantirGrupoForm(
	grupos: readonly GrupoOrcamentoFormValues[],
	representada: RepresentadaDoGrupo,
): GrupoOrcamentoFormValues[] {
	if (grupos.some((g) => g.representada_id === representada.id)) {
		return [...grupos];
	}
	const condicao = grupos.at(-1)?.condicao_pagamento ?? "";
	return [...grupos, novoGrupoOrcamentoForm(representada, condicao)];
}

export function atualizarGrupoForm(
	grupos: readonly GrupoOrcamentoFormValues[],
	representadaId: string,
	alterar: (grupo: GrupoOrcamentoFormValues) => GrupoOrcamentoFormValues,
): GrupoOrcamentoFormValues[] {
	return grupos.map((g) =>
		g.representada_id === representadaId ? alterar(g) : g,
	);
}

export function removerGrupoForm(
	grupos: readonly GrupoOrcamentoFormValues[],
	representadaId: string,
): GrupoOrcamentoFormValues[] {
	return grupos.filter((g) => g.representada_id !== representadaId);
}

/**
 * Tabela efetiva da seção: a escolhida pelo representante enquanto continuar
 * vigente (em modo leitura, sempre a gravada); senão a sugerida (padrão do
 * cliente ou a vigente mais recente).
 */
export function resolverTabelaEfetivaGrupo(
	grupo: Pick<GrupoOrcamentoFormValues, "tabela_id" | "tabela_manual">,
	idsTabelasVigentes: readonly string[],
	tabelaSugeridaId: string | null,
	somenteLeitura = false,
): string {
	if (
		grupo.tabela_manual &&
		grupo.tabela_id !== "" &&
		(somenteLeitura || idsTabelasVigentes.includes(grupo.tabela_id))
	) {
		return grupo.tabela_id;
	}
	if (somenteLeitura) return grupo.tabela_id;
	return tabelaSugeridaId ?? grupo.tabela_id;
}

export type ResultadoFormularioCotacao =
	| { success: true; data: CotacaoInputValidado }
	| { success: false; erros: PedidoFormErros; geral: string | null };

/**
 * Converte e valida o workspace da cotação. Seções sem itens são descartadas
 * (não geram pedido); ao menos uma seção precisa ter itens.
 */
export function validarFormularioCotacao(
	valores: CotacaoFormValues,
): ResultadoFormularioCotacao {
	const errosConversao: PedidoFormErros = {};
	const gruposComItens = valores.grupos.filter((g) => g.itens.length > 0);

	const grupos = gruposComItens.map((grupo) => ({
		representada_id: grupo.representada_id,
		tabela_id: grupo.tabela_id,
		condicao_pagamento: grupo.condicao_pagamento,
		tipo_frete: grupo.tipo_frete,
		itens: converterItensFormPedido(grupo.itens, errosConversao),
	}));

	const resultado = CotacaoInputSchema.safeParse({
		cliente_id: valores.cliente_id,
		endereco_entrega_id: valores.endereco_entrega_id,
		contato_id: valores.contato_id,
		transportadora_id: valores.transportadora_id,
		observacoes: valores.observacoes,
		grupos,
	});

	if (resultado.success && Object.keys(errosConversao).length === 0) {
		return { success: true, data: resultado.data };
	}

	const { erros, geral } = mapearIssues(
		resultado.success ? [] : resultado.error.issues,
		(caminho) => {
			const [primeiro, indiceGrupo, campo, indiceItem, campoItem] = caminho;
			if (typeof primeiro === "string" && CAMPOS_COMPARTILHADOS.has(primeiro)) {
				return primeiro;
			}
			if (primeiro !== "grupos") return undefined;
			if (indiceGrupo === undefined) return "itens";

			const grupo =
				typeof indiceGrupo === "number"
					? gruposComItens[indiceGrupo]
					: undefined;
			if (!grupo) return undefined;

			if (
				campo === "itens" &&
				typeof indiceItem === "number" &&
				(campoItem === "quantidade" || campoItem === "percentual_desconto")
			) {
				const localId = grupo.itens[indiceItem]?.localId;
				if (localId) return chaveErroItemPedido(localId, campoItem);
			}
			const campoDoGrupo = campoGrupo(campo);
			return campoDoGrupo
				? chaveErroGrupoCotacao(grupo.representada_id, campoDoGrupo)
				: undefined;
		},
		errosConversao,
	);

	return { success: false, erros, geral };
}

function campoGrupo(
	campo: PropertyKey | undefined,
): CampoGrupoCotacao | undefined {
	switch (campo) {
		case "representada_id":
		case "tabela_id":
		case "condicao_pagamento":
		case "tipo_frete":
		case "itens":
			return campo;
		default:
			return undefined;
	}
}
