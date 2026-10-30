import { normalizarCnpj } from "../../../shared/domain/cnpj";
import { formatarCentesimosPercentual } from "../../../shared/domain/decimal-br";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { normalizarTexto } from "../../../shared/domain/texto";
import {
	type ConflitoUnicidade,
	detectarConflito,
} from "../../../shared/domain/unicidade";
import type { TipoCliente } from "../../clientes/domain/cliente.schema";
import {
	CORES_REPRESENTADA,
	type CorRepresentada,
	type Representada,
	type RepresentadaInput,
	RepresentadaInputSchema,
	RepresentadaSchema,
} from "./representada.schema";

export type ComissaoRepresentadaConfig = Pick<
	Representada,
	"percentual_comissao_padrao"
> &
	Partial<
		Pick<
			Representada,
			"percentual_comissao_revenda" | "percentual_comissao_fabrica"
		>
	>;

/**
 * Resolve o percentual de comissão aplicável (em centésimos de %) cruzando a
 * representada com o segmento comercial do cliente (`REVENDA` vs. `FABRICA`).
 * - Para `FABRICA` (ou quando nenhum cliente foi selecionado ainda), usa
 *   `percentual_comissao_fabrica` (ou `percentual_comissao_padrao`).
 * - Para `REVENDA`, usa `percentual_comissao_revenda` quando definido, caindo
 *   em `percentual_comissao_fabrica` / `percentual_comissao_padrao` caso a
 *   comissão de revenda não tenha sido preenchida.
 */
export function resolverPercentualComissaoRepresentada(
	representada: ComissaoRepresentadaConfig,
	tipoCliente?: TipoCliente | null,
): number {
	const comissaoFabrica =
		representada.percentual_comissao_fabrica ??
		representada.percentual_comissao_padrao;
	if (tipoCliente === "REVENDA") {
		return representada.percentual_comissao_revenda ?? comissaoFabrica;
	}
	return comissaoFabrica;
}

/**
 * Formata um resumo conciso das alíquotas de comissão da representada:
 * - Se não houver comissão diferenciada de Revenda (ou se for igual à de Fábrica),
 *   exibe apenas a alíquota de Fábrica (ex: `5,00%`).
 * - Se forem distintas, exibe `Fáb. 5,00% · Rev. 7,50%`.
 */
export function formatarResumoComissaoRepresentada(
	representada: ComissaoRepresentadaConfig,
): string {
	const fabrica = resolverPercentualComissaoRepresentada(
		representada,
		"FABRICA",
	);
	const revenda = representada.percentual_comissao_revenda;
	if (revenda === undefined || revenda === null || revenda === fabrica) {
		return formatarCentesimosPercentual(fabrica);
	}
	return `Fáb. ${formatarCentesimosPercentual(fabrica)} · Rev. ${formatarCentesimosPercentual(revenda)}`;
}

export const ROTULOS_COR_REPRESENTADA: Record<CorRepresentada, string> = {
	indigo: "Índigo",
	emerald: "Esmeralda",
	amber: "Âmbar",
	rose: "Rosa",
	cyan: "Ciano",
	violet: "Violeta",
	blue: "Azul",
	orange: "Laranja",
};

/**
 * Retorna a cor configurada na representada ou deriva uma cor determinística
 * a partir do ID quando não informada.
 */
export function obterCorRepresentada(
	representada: Pick<Representada, "id" | "cor">,
): CorRepresentada {
	if (representada.cor) {
		return representada.cor;
	}
	let hash = 0;
	for (let i = 0; i < representada.id.length; i++) {
		hash = (hash * 31 + representada.id.charCodeAt(i)) >>> 0;
	}
	return CORES_REPRESENTADA[hash % CORES_REPRESENTADA.length] ?? "indigo";
}

export class RepresentadaNaoEncontradaError extends Error {
	constructor(id: string) {
		super(`Representada ${id} não encontrada`);
		this.name = "RepresentadaNaoEncontradaError";
	}
}

export class CnpjDuplicadoError extends Error {
	constructor() {
		super("Já existe uma representada ativa com este CNPJ");
		this.name = "CnpjDuplicadoError";
	}
}

export class RepresentadaInativaExistenteError extends Error {
	readonly representadaInativa: Representada;

	constructor(representadaInativa: Representada) {
		super(
			`Existe uma representada inativa com este mesmo CNPJ: "${representadaInativa.nome_fantasia}". Deseja reativá-la?`,
		);
		this.name = "RepresentadaInativaExistenteError";
		this.representadaInativa = representadaInativa;
	}
}

interface CriarRepresentadaParams {
	tenantId: string;
	input: RepresentadaInput;
	id: string;
	agora: string;
}

/** Cria uma nova representada validada. */
export function criarRepresentada({
	tenantId,
	input,
	id,
	agora,
}: CriarRepresentadaParams): Representada {
	const dados = RepresentadaInputSchema.parse(input);
	return RepresentadaSchema.parse({
		...dados,
		id,
		tenant_id: tenantId,
		ativo: true,
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});
}

/** Aplica alterações preservando identidade, tenant e data de criação. */
export function atualizarRepresentada(
	existente: Representada,
	tenantId: string,
	input: RepresentadaInput,
	agora: string,
): Representada {
	garantirMesmoTenant(existente, tenantId);
	const dados = RepresentadaInputSchema.parse(input);
	const {
		cor: _corAnterior,
		percentual_comissao_revenda: _revendaAnterior,
		...restoExistente
	} = existente;
	return RepresentadaSchema.parse({
		...restoExistente,
		...dados,
		updated_at: agora,
	});
}

/** Inativação (estado de negócio, reversível): marca `ativo = false`. Idempotente. */
export function inativarRepresentada(
	existente: Representada,
	tenantId: string,
	agora: string,
): Representada {
	garantirMesmoTenant(existente, tenantId);
	if (!existente.ativo) return existente;
	return { ...existente, ativo: false, updated_at: agora };
}

/** Reativação: marca `ativo = true`. Idempotente. */
export function reativarRepresentada(
	existente: Representada,
	tenantId: string,
	agora: string,
): Representada {
	garantirMesmoTenant(existente, tenantId);
	if (existente.ativo) return existente;
	return { ...existente, ativo: true, updated_at: agora };
}

/** Conflito bloqueante: outra representada (não excluída) com o mesmo CNPJ. */
export function detectarConflitoCnpj(
	candidatos: readonly Representada[],
	cnpj: string,
	idAtual?: string,
): ConflitoUnicidade<Representada> | null {
	const normalizado = normalizarCnpj(cnpj);
	return detectarConflito(candidatos, (r) => r.cnpj === normalizado, idAtual);
}

/** Busca case/acento-insensível por razão social, nome fantasia ou CNPJ. */
export function correspondeBuscaRepresentada(
	representada: Representada,
	termo: string | undefined,
): boolean {
	const termoNormalizado = normalizarTexto(termo ?? "");
	if (termoNormalizado === "") return true;

	const termoCnpj = normalizarCnpj(termoNormalizado);
	return (
		normalizarTexto(representada.razao_social).includes(termoNormalizado) ||
		normalizarTexto(representada.nome_fantasia).includes(termoNormalizado) ||
		(termoCnpj !== "" && representada.cnpj.includes(termoCnpj))
	);
}

/** Ordena alfabeticamente pelo nome fantasia (pt-BR). */
export function ordenarRepresentadas(lista: Representada[]): Representada[] {
	return [...lista].sort((a, b) =>
		a.nome_fantasia.localeCompare(b.nome_fantasia, "pt-BR", {
			sensitivity: "base",
		}),
	);
}

/** Ordena lista colocando ativas primeiro e inativas ao final, ambas por nome fantasia. */
export function ordenarRepresentadasComInativasNoFim(
	lista: Representada[],
): Representada[] {
	return [...lista].sort((a, b) => {
		if (a.ativo !== b.ativo) {
			return a.ativo ? -1 : 1;
		}

		return a.nome_fantasia.localeCompare(b.nome_fantasia, "pt-BR", {
			sensitivity: "base",
		});
	});
}
