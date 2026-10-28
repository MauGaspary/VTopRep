import { normalizarCnpj } from "../../../shared/domain/cnpj";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { normalizarTexto } from "../../../shared/domain/texto";
import {
	type ConflitoUnicidade,
	detectarConflito,
} from "../../../shared/domain/unicidade";
import {
	type Representada,
	type RepresentadaInput,
	RepresentadaInputSchema,
	RepresentadaSchema,
} from "./representada.schema";

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
	return RepresentadaSchema.parse({
		...existente,
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
