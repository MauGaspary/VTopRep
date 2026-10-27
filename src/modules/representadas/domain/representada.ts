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
		super("Já existe uma representada com este CNPJ");
		this.name = "CnpjDuplicadoError";
	}
}

export class RazaoSocialDuplicadaError extends Error {
	constructor() {
		super("Já existe uma representada com esta Razão Social");
		this.name = "RazaoSocialDuplicadaError";
	}
}

export class NomeFantasiaDuplicadoError extends Error {
	constructor() {
		super("Já existe uma representada com este Nome Fantasia");
		this.name = "NomeFantasiaDuplicadoError";
	}
}

export class TenantDivergenteError extends Error {
	constructor() {
		super("Operação não permitida: registro pertence a outro tenant");
		this.name = "TenantDivergenteError";
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
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});
}

function garantirMesmoTenant(representada: Representada, tenantId: string) {
	if (representada.tenant_id !== tenantId) {
		throw new TenantDivergenteError();
	}
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

/** Soft delete: marca `deleted_at`. Idempotente. */
export function inativarRepresentada(
	existente: Representada,
	tenantId: string,
	agora: string,
): Representada {
	garantirMesmoTenant(existente, tenantId);
	if (existente.deleted_at !== null) return existente;
	return { ...existente, deleted_at: agora, updated_at: agora };
}

/** Reativação de representada: limpa `deleted_at`. Idempotente. */
export function reativarRepresentada(
	existente: Representada,
	tenantId: string,
	agora: string,
): Representada {
	garantirMesmoTenant(existente, tenantId);
	if (existente.deleted_at === null) return existente;
	return { ...existente, deleted_at: null, updated_at: agora };
}

/** Busca case/acento-insensível por razão social, nome fantasia ou CNPJ. */
export function correspondeBuscaRepresentada(
	representada: Representada,
	termo: string | undefined,
): boolean {
	const termoNormalizado = normalizarTextoComparacao(termo ?? "");
	if (termoNormalizado === "") return true;

	const termoCnpj = termoNormalizado.replace(/[.\-/\s]/g, "").toUpperCase();
	return (
		normalizarTextoComparacao(representada.razao_social).includes(
			termoNormalizado,
		) ||
		normalizarTextoComparacao(representada.nome_fantasia).includes(
			termoNormalizado,
		) ||
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

/** Ordena lista colocando ativas primeiro (alfabético por nome fantasia) e inativas ao final (alfabético por nome fantasia). */
export function ordenarRepresentadasComInativasNoFim(
	lista: Representada[],
): Representada[] {
	return [...lista].sort((a, b) => {
		const aInativa = a.deleted_at !== null;
		const bInativa = b.deleted_at !== null;

		if (aInativa !== bInativa) {
			return aInativa ? 1 : -1;
		}

		return a.nome_fantasia.localeCompare(b.nome_fantasia, "pt-BR", {
			sensitivity: "base",
		});
	});
}

/** Normaliza texto para comparações case/acento-insensíveis. */
export function normalizarTextoComparacao(texto: string): string {
	return texto
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}
