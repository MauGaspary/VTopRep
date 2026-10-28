import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import {
	atualizarProduto,
	correspondeBuscaProduto,
	criarProduto,
	inativarProduto,
	normalizarSku,
	ordenarProdutosComInativosNoFim,
	ProdutoInativoExistenteError,
	ProdutoNaoEncontradoError,
	RepresentadaNaoVinculadaError,
	reativarProduto,
	SkuDuplicadoError,
} from "../domain/produto";
import {
	type Produto,
	type ProdutoInput,
	ProdutoInputSchema,
} from "../domain/produto.schema";
import type { ProdutoRepository } from "./produto.repository";

const TenantIdSchema = z.string().uuid("tenantId inválido");
const IdSchema = z.string().uuid("id inválido");

interface ProdutoDexieAdapterOptions {
	database?: AppDatabase;
	gerarId?: () => string;
	agora?: () => string;
}

export class ProdutoDexieAdapter implements ProdutoRepository {
	private readonly db: AppDatabase;
	private readonly gerarId: () => string;
	private readonly agora: () => string;

	constructor(options: ProdutoDexieAdapterOptions = {}) {
		this.db = options.database ?? defaultDb;
		this.gerarId = options.gerarId ?? (() => crypto.randomUUID());
		this.agora = options.agora ?? (() => new Date().toISOString());
	}

	async listar(
		tenantId: string,
		termoBusca?: string,
		representadaId?: string,
	): Promise<Produto[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const repId = representadaId ? IdSchema.parse(representadaId) : undefined;

		const lista = await this.db.produtos
			.where("tenant_id")
			.equals(tenant)
			.filter((p) => {
				const isAtivo = p.ativo === true && p.deleted_at === null;
				if (!isAtivo) return false;
				if (repId && p.representada_id !== repId) return false;
				return correspondeBuscaProduto(p, termoBusca);
			})
			.toArray();

		return ordenarProdutosComInativosNoFim(lista);
	}

	async listarTodos(
		tenantId: string,
		termoBusca?: string,
		representadaId?: string,
	): Promise<Produto[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const repId = representadaId ? IdSchema.parse(representadaId) : undefined;

		const lista = await this.db.produtos
			.where("tenant_id")
			.equals(tenant)
			.filter((p) => {
				if (repId && p.representada_id !== repId) return false;
				return correspondeBuscaProduto(p, termoBusca);
			})
			.toArray();

		return ordenarProdutosComInativosNoFim(lista);
	}

	async buscarCatalogo(
		tenantId: string,
		termoBusca?: string,
	): Promise<Produto[]> {
		return this.listar(tenantId, termoBusca);
	}

	async obterPorId(
		tenantId: string,
		id: string,
		permitirInativo = false,
	): Promise<Produto | null> {
		const tenant = TenantIdSchema.parse(tenantId);
		const produtoId = IdSchema.parse(id);

		const produto = await this.db.produtos.get(produtoId);
		if (!produto || produto.tenant_id !== tenant) {
			return null;
		}

		if (!permitirInativo && (!produto.ativo || produto.deleted_at !== null)) {
			return null;
		}

		return produto;
	}

	async obterPorSku(tenantId: string, sku: string): Promise<Produto | null> {
		const tenant = TenantIdSchema.parse(tenantId);
		const normalizado = normalizarSku(sku);

		const produtos = await this.db.produtos
			.where("tenant_id")
			.equals(tenant)
			.filter((p) => normalizarSku(p.sku) === normalizado)
			.toArray();

		return produtos[0] ?? null;
	}

	async criar(tenantId: string, input: ProdutoInput): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const dadosValidados = ProdutoInputSchema.parse(input);

		await this.garantirRepresentadaValida(
			tenant,
			dadosValidados.representada_id,
		);
		await this.garantirUnicidadeSku(tenant, dadosValidados.sku);

		const novoProduto = criarProduto(tenant, dadosValidados, {
			gerarId: this.gerarId,
			agora: this.agora,
		});

		await this.db.produtos.add(novoProduto);
		return novoProduto;
	}

	async atualizar(
		tenantId: string,
		id: string,
		input: ProdutoInput,
	): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const produtoId = IdSchema.parse(id);
		const dadosValidados = ProdutoInputSchema.parse(input);

		const produtoExistente = await this.obterPorId(tenant, produtoId, true);
		if (!produtoExistente) {
			throw new ProdutoNaoEncontradoError(produtoId);
		}

		await this.garantirRepresentadaValida(
			tenant,
			dadosValidados.representada_id,
		);

		if (
			normalizarSku(produtoExistente.sku) !== normalizarSku(dadosValidados.sku)
		) {
			await this.garantirUnicidadeSku(tenant, dadosValidados.sku, produtoId);
		}

		const atualizado = atualizarProduto(produtoExistente, dadosValidados, {
			agora: this.agora,
		});

		await this.db.produtos.put(atualizado);
		return atualizado;
	}

	async inativar(tenantId: string, id: string): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const produtoId = IdSchema.parse(id);

		const existente = await this.obterPorId(tenant, produtoId, true);
		if (!existente) {
			throw new ProdutoNaoEncontradoError(produtoId);
		}

		if (!existente.ativo && existente.deleted_at !== null) {
			return existente;
		}

		const inativado = inativarProduto(existente, { agora: this.agora });
		await this.db.produtos.put(inativado);
		return inativado;
	}

	async reativar(tenantId: string, id: string): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const produtoId = IdSchema.parse(id);

		const existente = await this.obterPorId(tenant, produtoId, true);
		if (!existente) {
			throw new ProdutoNaoEncontradoError(produtoId);
		}

		if (existente.ativo && existente.deleted_at === null) {
			return existente;
		}

		// Garante que a representada vinculada ainda é válida
		await this.garantirRepresentadaValida(tenant, existente.representada_id);

		// Garante que não foi criado outro produto ativo com o mesmo SKU
		const normalizado = normalizarSku(existente.sku);
		const outrosProdutos = await this.db.produtos
			.where("tenant_id")
			.equals(tenant)
			.filter(
				(p) =>
					p.id !== produtoId &&
					p.ativo &&
					p.deleted_at === null &&
					normalizarSku(p.sku) === normalizado,
			)
			.toArray();

		if (outrosProdutos.length > 0) {
			throw new SkuDuplicadoError(existente.sku);
		}

		const reativado = reativarProduto(existente, { agora: this.agora });
		await this.db.produtos.put(reativado);
		return reativado;
	}

	private async garantirRepresentadaValida(
		tenantId: string,
		representadaId: string,
	): Promise<void> {
		const representada = await this.db.representadas.get(representadaId);
		if (
			!representada ||
			representada.tenant_id !== tenantId ||
			representada.deleted_at !== null
		) {
			throw new RepresentadaNaoVinculadaError(representadaId);
		}
	}

	private async garantirUnicidadeSku(
		tenantId: string,
		sku: string,
		idIgnorar?: string,
	): Promise<void> {
		const normalizado = normalizarSku(sku);

		const produtos = await this.db.produtos
			.where("tenant_id")
			.equals(tenantId)
			.filter((p) => normalizarSku(p.sku) === normalizado)
			.toArray();

		const outrosProdutos = idIgnorar
			? produtos.filter((p) => p.id !== idIgnorar)
			: produtos;

		// 1. Conflito com produto ativo
		const ativoExistente = outrosProdutos.find(
			(p) => p.ativo && p.deleted_at === null,
		);
		if (ativoExistente) {
			throw new SkuDuplicadoError(sku);
		}

		// 2. Conflito com produto inativo (permite reativação)
		const inativoExistente = outrosProdutos.find(
			(p) => !p.ativo || p.deleted_at !== null,
		);
		if (inativoExistente) {
			throw new ProdutoInativoExistenteError(inativoExistente);
		}
	}
}

export const produtoRepository = new ProdutoDexieAdapter();
