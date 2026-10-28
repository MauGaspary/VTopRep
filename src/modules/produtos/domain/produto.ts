import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { normalizarTexto } from "../../../shared/domain/texto";
import {
	type ConflitoUnicidade,
	detectarConflito,
} from "../../../shared/domain/unicidade";
import {
	type Produto,
	type ProdutoInput,
	ProdutoInputSchema,
	ProdutoSchema,
} from "./produto.schema";

export class SkuDuplicadoError extends Error {
	readonly sku: string;

	constructor(sku: string) {
		super(`Já existe um produto ativo com o SKU "${sku}" nesta representada.`);
		this.name = "SkuDuplicadoError";
		this.sku = sku;
	}
}

export class ProdutoInativoExistenteError extends Error {
	readonly produtoInativo: Produto;

	constructor(produtoInativo: Produto) {
		super(
			`Já existe um produto inativo com o SKU "${produtoInativo.sku}" (${produtoInativo.descricao}) nesta representada. Deseja reativá-lo?`,
		);
		this.name = "ProdutoInativoExistenteError";
		this.produtoInativo = produtoInativo;
	}
}

export class ProdutoNaoEncontradoError extends Error {
	readonly id: string;

	constructor(id: string) {
		super(`Produto com id "${id}" não encontrado.`);
		this.name = "ProdutoNaoEncontradoError";
		this.id = id;
	}
}

export class RepresentadaNaoVinculadaError extends Error {
	readonly representadaId: string;

	constructor(representadaId: string) {
		super(
			`A representada informada (${representadaId}) não foi encontrada ou está inativa neste tenant.`,
		);
		this.name = "RepresentadaNaoVinculadaError";
		this.representadaId = representadaId;
	}
}

export function normalizarSku(sku: string): string {
	return sku.trim().toUpperCase();
}

function camposEditaveis(input: ProdutoInput) {
	const dados = ProdutoInputSchema.parse(input);
	return {
		representada_id: dados.representada_id,
		sku: normalizarSku(dados.sku),
		descricao: dados.descricao,
		unidade_medida: dados.unidade_medida.toUpperCase(),
		multiplo_embalagem: dados.multiplo_embalagem ?? 1,
	};
}

interface CriarProdutoParams {
	tenantId: string;
	input: ProdutoInput;
	id: string;
	agora: string;
}

export function criarProduto({
	tenantId,
	input,
	id,
	agora,
}: CriarProdutoParams): Produto {
	return ProdutoSchema.parse({
		...camposEditaveis(input),
		id,
		tenant_id: tenantId,
		ativo: true,
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});
}

/** Aplica alterações preservando identidade, tenant, estado e data de criação. */
export function atualizarProduto(
	existente: Produto,
	tenantId: string,
	input: ProdutoInput,
	agora: string,
): Produto {
	garantirMesmoTenant(existente, tenantId);
	return ProdutoSchema.parse({
		...existente,
		...camposEditaveis(input),
		updated_at: agora,
	});
}

/** Inativação (estado de negócio, reversível): marca `ativo = false`. Idempotente. */
export function inativarProduto(
	existente: Produto,
	tenantId: string,
	agora: string,
): Produto {
	garantirMesmoTenant(existente, tenantId);
	if (!existente.ativo) return existente;
	return { ...existente, ativo: false, updated_at: agora };
}

/** Reativação: marca `ativo = true`. Idempotente. */
export function reativarProduto(
	existente: Produto,
	tenantId: string,
	agora: string,
): Produto {
	garantirMesmoTenant(existente, tenantId);
	if (existente.ativo) return existente;
	return { ...existente, ativo: true, updated_at: agora };
}

/**
 * Conflito bloqueante: outro produto (não excluído) da mesma representada
 * com o mesmo SKU normalizado. Representadas diferentes podem repetir SKU.
 */
export function detectarConflitoSku(
	candidatos: readonly Produto[],
	chave: Pick<Produto, "representada_id" | "sku">,
	idAtual?: string,
): ConflitoUnicidade<Produto> | null {
	const sku = normalizarSku(chave.sku);
	return detectarConflito(
		candidatos,
		(p) =>
			p.representada_id === chave.representada_id &&
			normalizarSku(p.sku) === sku,
		idAtual,
	);
}

export function correspondeBuscaProduto(
	produto: Produto,
	termoBusca?: string,
): boolean {
	if (!termoBusca?.trim()) return true;

	const termo = normalizarTexto(termoBusca);
	const sku = normalizarTexto(produto.sku);
	const descricao = normalizarTexto(produto.descricao);

	return sku.includes(termo) || descricao.includes(termo);
}

export function ordenarProdutosComInativosNoFim(
	produtos: Produto[],
): Produto[] {
	return [...produtos].sort((a, b) => {
		if (a.ativo !== b.ativo) {
			return a.ativo ? -1 : 1;
		}
		return a.descricao.localeCompare(b.descricao, "pt-BR", {
			sensitivity: "base",
		});
	});
}
