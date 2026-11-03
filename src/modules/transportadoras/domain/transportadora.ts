import { formatarCnpj, normalizarCnpj } from "../../../shared/domain/cnpj";
import type { OpcaoCombobox } from "../../../shared/domain/combobox";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { normalizarTexto } from "../../../shared/domain/texto";
import {
	type ConflitoUnicidade,
	detectarConflito,
} from "../../../shared/domain/unicidade";
import {
	type Transportadora,
	type TransportadoraInput,
	TransportadoraInputSchema,
	TransportadoraSchema,
} from "./transportadora.schema";

export class TransportadoraNaoEncontradaError extends Error {
	constructor(id: string) {
		super(`Transportadora ${id} não encontrada`);
		this.name = "TransportadoraNaoEncontradaError";
	}
}

export class CnpjTransportadoraDuplicadoError extends Error {
	constructor() {
		super("Já existe uma transportadora ativa com este CNPJ");
		this.name = "CnpjTransportadoraDuplicadoError";
	}
}

export class TransportadoraInativaExistenteError extends Error {
	readonly transportadoraInativa: Transportadora;

	constructor(transportadoraInativa: Transportadora) {
		super(
			`Existe uma transportadora inativa com este mesmo CNPJ: "${transportadoraInativa.nome_fantasia}". Deseja reativá-la?`,
		);
		this.name = "TransportadoraInativaExistenteError";
		this.transportadoraInativa = transportadoraInativa;
	}
}

interface CriarTransportadoraParams {
	tenantId: string;
	input: TransportadoraInput;
	id: string;
	agora: string;
}

/** Cria uma nova transportadora validada. */
export function criarTransportadora({
	tenantId,
	input,
	id,
	agora,
}: CriarTransportadoraParams): Transportadora {
	const dados = TransportadoraInputSchema.parse(input);
	return TransportadoraSchema.parse({
		...dados,
		id,
		tenant_id: tenantId,
		ativo: true,
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});
}

/** Aplica alterações preservando identidade, tenant, estado e data de criação. */
export function atualizarTransportadora(
	existente: Transportadora,
	tenantId: string,
	input: TransportadoraInput,
	agora: string,
): Transportadora {
	garantirMesmoTenant(existente, tenantId);
	const dados = TransportadoraInputSchema.parse(input);
	return TransportadoraSchema.parse({
		...existente,
		...dados,
		updated_at: agora,
	});
}

/** Inativação (estado de negócio, reversível): marca `ativo = false`. Idempotente. */
export function inativarTransportadora(
	existente: Transportadora,
	tenantId: string,
	agora: string,
): Transportadora {
	garantirMesmoTenant(existente, tenantId);
	if (!existente.ativo) return existente;
	return { ...existente, ativo: false, updated_at: agora };
}

/** Reativação: marca `ativo = true`. Idempotente. */
export function reativarTransportadora(
	existente: Transportadora,
	tenantId: string,
	agora: string,
): Transportadora {
	garantirMesmoTenant(existente, tenantId);
	if (existente.ativo) return existente;
	return { ...existente, ativo: true, updated_at: agora };
}

/**
 * Conflito bloqueante: outra transportadora (não excluída) com o mesmo CNPJ.
 * Transportadoras sem CNPJ nunca conflitam.
 */
export function detectarConflitoCnpjTransportadora(
	candidatos: readonly Transportadora[],
	cnpj: string | null | undefined,
	idAtual?: string,
): ConflitoUnicidade<Transportadora> | null {
	const normalizado = normalizarCnpj(cnpj ?? "");
	if (normalizado === "") return null;
	return detectarConflito(candidatos, (t) => t.cnpj === normalizado, idAtual);
}

/** Busca case/acento-insensível por nome fantasia, razão social, CNPJ ou cidade/UF. */
export function correspondeBuscaTransportadora(
	transportadora: Transportadora,
	termo: string | undefined,
): boolean {
	const termoNormalizado = normalizarTexto(termo ?? "");
	if (termoNormalizado === "") return true;

	const termoCnpj = normalizarCnpj(termoNormalizado);
	return (
		normalizarTexto(transportadora.nome_fantasia).includes(termoNormalizado) ||
		normalizarTexto(transportadora.razao_social ?? "").includes(
			termoNormalizado,
		) ||
		normalizarTexto(transportadora.cidade_uf ?? "").includes(
			termoNormalizado,
		) ||
		(termoCnpj !== "" && (transportadora.cnpj ?? "").includes(termoCnpj))
	);
}

/** Ordena colocando ativas primeiro e inativas ao final, ambas por nome fantasia (pt-BR). */
export function ordenarTransportadoras(
	lista: readonly Transportadora[],
): Transportadora[] {
	return [...lista].sort((a, b) => {
		if (a.ativo !== b.ativo) {
			return a.ativo ? -1 : 1;
		}
		return a.nome_fantasia.localeCompare(b.nome_fantasia, "pt-BR", {
			sensitivity: "base",
		});
	});
}

/** Linha secundária de identificação: `Caxias do Sul/RS · 11.222.333/0001-81 · (54) 3333-0000`. */
export function descreverTransportadora(
	transportadora: Pick<Transportadora, "cnpj" | "telefone" | "cidade_uf">,
): string {
	return [
		transportadora.cidade_uf,
		transportadora.cnpj ? formatarCnpj(transportadora.cnpj) : null,
		transportadora.telefone,
	]
		.filter((parte): parte is string => Boolean(parte))
		.join(" · ");
}

/**
 * Transportadora sugerida no orçamento: a habitual do cliente, desde que
 * exista entre as disponíveis (ativas e do tenant). Caso contrário, nenhuma.
 */
export function sugerirTransportadoraDoCliente(
	cliente: { transportadora_padrao_id?: string | null } | null | undefined,
	disponiveis: readonly Pick<Transportadora, "id" | "ativo">[],
): string {
	const habitualId = cliente?.transportadora_padrao_id ?? null;
	if (!habitualId) return "";
	return disponiveis.some((t) => t.id === habitualId && t.ativo)
		? habitualId
		: "";
}

/**
 * Opções do `Combobox` de transportadora: ativas e, se informada, a já
 * selecionada mesmo que inativa (para não "sumir" de um cadastro antigo).
 */
export function opcoesComboboxTransportadoras(
	lista: readonly Transportadora[],
	idSelecionado?: string | null,
): OpcaoCombobox<Transportadora>[] {
	return ordenarTransportadoras(
		lista.filter(
			(t) =>
				t.deleted_at === null && (t.ativo || (idSelecionado ?? "") === t.id),
		),
	).map((t) => ({
		id: t.id,
		label: t.ativo ? t.nome_fantasia : `${t.nome_fantasia} (inativa)`,
		sublabel: descreverTransportadora(t) || undefined,
		keywords: [
			t.razao_social ?? "",
			t.cnpj ?? "",
			t.cnpj ? formatarCnpj(t.cnpj) : "",
			t.cidade_uf ?? "",
		],
		dados: t,
	}));
}
