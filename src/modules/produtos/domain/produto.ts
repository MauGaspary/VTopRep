import {
	type Produto,
	type ProdutoInput,
	ProdutoInputSchema,
	ProdutoSchema,
} from "./produto.schema";

export class SkuDuplicadoError extends Error {
	readonly sku: string;

	constructor(sku: string) {
		super(`Já existe um produto ativo cadastrado com o SKU "${sku}".`);
		this.name = "SkuDuplicadoError";
		this.sku = sku;
	}
}

export class ProdutoInativoExistenteError extends Error {
	readonly produtoInativo: Produto;

	constructor(produtoInativo: Produto) {
		super(
			`Já existe um produto inativo com o SKU "${produtoInativo.sku}" (${produtoInativo.descricao}). Deseja reativá-lo?`,
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

export interface DominioProdutoOptions {
	gerarId?: () => string;
	agora?: () => string;
}

export function normalizarSku(sku: string): string {
	return sku.trim().toUpperCase();
}

export function normalizarTexto(texto: string): string {
	return texto
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

export function criarProduto(
	tenantId: string,
	input: ProdutoInput,
	options: DominioProdutoOptions = {},
): Produto {
	const dadosValidados = ProdutoInputSchema.parse(input);
	const gerarId = options.gerarId ?? (() => crypto.randomUUID());
	const agora = options.agora ?? (() => new Date().toISOString());
	const timestamp = agora();

	const novoProduto: Produto = {
		id: gerarId(),
		tenant_id: tenantId,
		representada_id: dadosValidados.representada_id,
		sku: dadosValidados.sku.trim(),
		descricao: dadosValidados.descricao.trim(),
		unidade_medida: dadosValidados.unidade_medida.trim().toUpperCase(),
		multiplo_embalagem: dadosValidados.multiplo_embalagem ?? 1,
		ativo: true,
		created_at: timestamp,
		updated_at: timestamp,
		deleted_at: null,
	};

	return ProdutoSchema.parse(novoProduto);
}

export function atualizarProduto(
	produtoExistente: Produto,
	input: ProdutoInput,
	options: DominioProdutoOptions = {},
): Produto {
	const dadosValidados = ProdutoInputSchema.parse(input);
	const agora = options.agora ?? (() => new Date().toISOString());

	const produtoAtualizado: Produto = {
		...produtoExistente,
		representada_id: dadosValidados.representada_id,
		sku: dadosValidados.sku.trim(),
		descricao: dadosValidados.descricao.trim(),
		unidade_medida: dadosValidados.unidade_medida.trim().toUpperCase(),
		multiplo_embalagem: dadosValidados.multiplo_embalagem ?? 1,
		updated_at: agora(),
	};

	return ProdutoSchema.parse(produtoAtualizado);
}

export function inativarProduto(
	produto: Produto,
	options: DominioProdutoOptions = {},
): Produto {
	const agora = options.agora ?? (() => new Date().toISOString());
	const timestamp = agora();

	const inativado: Produto = {
		...produto,
		ativo: false,
		updated_at: timestamp,
		deleted_at: timestamp,
	};

	return ProdutoSchema.parse(inativado);
}

export function reativarProduto(
	produto: Produto,
	options: DominioProdutoOptions = {},
): Produto {
	const agora = options.agora ?? (() => new Date().toISOString());

	const reativado: Produto = {
		...produto,
		ativo: true,
		updated_at: agora(),
		deleted_at: null,
	};

	return ProdutoSchema.parse(reativado);
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
