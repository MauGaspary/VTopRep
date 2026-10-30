import { z } from "zod";
import { type AppDatabase, db as defaultDb } from "../../../db/database";
import type { PrecoProdutoInput } from "../domain/item-preco.schema";
import { sincronizarPrecosProduto } from "../domain/preco";
import {
	atualizarProduto,
	correspondeBuscaProduto,
	criarProduto,
	detectarConflitoSku,
	inativarProduto,
	normalizarSku,
	ordenarProdutosComInativosNoFim,
	ProdutoInativoExistenteError,
	ProdutoNaoEncontradoError,
	RepresentadaNaoVinculadaError,
	reativarProduto,
	SkuDuplicadoError,
} from "../domain/produto";
import type { Produto, ProdutoInput } from "../domain/produto.schema";
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
		const lista = await this.consultar(
			tenantId,
			termoBusca,
			representadaId,
			(p) => p.ativo,
		);
		return ordenarProdutosComInativosNoFim(lista);
	}

	async listarTodos(
		tenantId: string,
		termoBusca?: string,
		representadaId?: string,
	): Promise<Produto[]> {
		const lista = await this.consultar(
			tenantId,
			termoBusca,
			representadaId,
			() => true,
		);
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
		if (
			!produto ||
			produto.tenant_id !== tenant ||
			produto.deleted_at !== null ||
			(!permitirInativo && !produto.ativo)
		) {
			return null;
		}

		return produto;
	}

	async obterPorSku(
		tenantId: string,
		representadaId: string,
		sku: string,
	): Promise<Produto | null> {
		const tenant = TenantIdSchema.parse(tenantId);
		const repId = IdSchema.parse(representadaId);

		const candidatos = await this.buscarPorSku(tenant, repId, sku);
		return candidatos.find((p) => p.deleted_at === null) ?? null;
	}

	async criar(
		tenantId: string,
		input: ProdutoInput,
		precosInput?: readonly PrecoProdutoInput[],
	): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const instante = this.agora();
		const novoProduto = criarProduto({
			tenantId: tenant,
			input,
			id: this.gerarId(),
			agora: instante,
		});

		await this.db.transaction(
			"rw",
			[
				this.db.produtos,
				this.db.representadas,
				this.db.tabelas_preco,
				this.db.itens_preco,
			],
			async () => {
				await this.garantirRepresentadaValida(
					tenant,
					novoProduto.representada_id,
				);
				await this.garantirSkuUnico(tenant, novoProduto, {
					oferecerReativacao: true,
				});
				await this.db.produtos.add(novoProduto);

				if (precosInput && precosInput.length > 0) {
					await this.sincronizarPrecos(
						tenant,
						novoProduto,
						precosInput,
						instante,
					);
				}
			},
		);

		return novoProduto;
	}

	async atualizar(
		tenantId: string,
		id: string,
		input: ProdutoInput,
		precosInput?: readonly PrecoProdutoInput[],
	): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const produtoId = IdSchema.parse(id);

		return this.db.transaction(
			"rw",
			[
				this.db.produtos,
				this.db.representadas,
				this.db.tabelas_preco,
				this.db.itens_preco,
			],
			async () => {
				const existente = await this.obterPorId(tenant, produtoId, true);
				if (!existente) {
					throw new ProdutoNaoEncontradoError(produtoId);
				}

				const instante = this.agora();
				const atualizado = atualizarProduto(existente, tenant, input, instante);
				await this.garantirRepresentadaValida(
					tenant,
					atualizado.representada_id,
				);
				const representadaAlterada =
					atualizado.representada_id !== existente.representada_id;
				const chaveAlterada =
					atualizado.sku !== existente.sku || representadaAlterada;
				if (chaveAlterada) {
					await this.garantirSkuUnico(tenant, atualizado, {
						oferecerReativacao: true,
					});
				}

				await this.db.produtos.put(atualizado);

				if (precosInput !== undefined || representadaAlterada) {
					await this.sincronizarPrecos(
						tenant,
						atualizado,
						precosInput ?? [],
						instante,
					);
				}

				return atualizado;
			},
		);
	}

	async inativar(tenantId: string, id: string): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const produtoId = IdSchema.parse(id);

		return this.db.transaction("rw", this.db.produtos, async () => {
			const existente = await this.obterPorId(tenant, produtoId, true);
			if (!existente) {
				throw new ProdutoNaoEncontradoError(produtoId);
			}

			const inativado = inativarProduto(existente, tenant, this.agora());
			if (inativado !== existente) {
				await this.db.produtos.put(inativado);
			}
			return inativado;
		});
	}

	async reativar(tenantId: string, id: string): Promise<Produto> {
		const tenant = TenantIdSchema.parse(tenantId);
		const produtoId = IdSchema.parse(id);

		return this.db.transaction(
			"rw",
			[this.db.produtos, this.db.representadas],
			async () => {
				const existente = await this.obterPorId(tenant, produtoId, true);
				if (!existente) {
					throw new ProdutoNaoEncontradoError(produtoId);
				}

				const reativado = reativarProduto(existente, tenant, this.agora());
				if (reativado === existente) {
					return existente;
				}

				// A representada vinculada precisa continuar ativa, e nenhum outro
				// produto ativo pode ter assumido o mesmo SKU nesse meio-tempo.
				await this.garantirRepresentadaValida(
					tenant,
					existente.representada_id,
				);
				await this.garantirSkuUnico(tenant, reativado, {
					oferecerReativacao: false,
				});

				await this.db.produtos.put(reativado);
				return reativado;
			},
		);
	}

	private async consultar(
		tenantId: string,
		termoBusca: string | undefined,
		representadaId: string | undefined,
		filtroEstado: (p: Produto) => boolean,
	): Promise<Produto[]> {
		const tenant = TenantIdSchema.parse(tenantId);
		const repId = representadaId ? IdSchema.parse(representadaId) : undefined;

		return this.db.produtos
			.where("tenant_id")
			.equals(tenant)
			.filter(
				(p) =>
					p.deleted_at === null &&
					filtroEstado(p) &&
					(repId === undefined || p.representada_id === repId) &&
					correspondeBuscaProduto(p, termoBusca),
			)
			.toArray();
	}

	private buscarPorSku(
		tenantId: string,
		representadaId: string,
		sku: string,
	): Promise<Produto[]> {
		return this.db.produtos
			.where("[tenant_id+representada_id+sku]")
			.equals([tenantId, representadaId, normalizarSku(sku)])
			.toArray();
	}

	private async garantirRepresentadaValida(
		tenantId: string,
		representadaId: string,
	): Promise<void> {
		const representada = await this.db.representadas.get(representadaId);
		if (
			!representada ||
			representada.tenant_id !== tenantId ||
			representada.deleted_at !== null ||
			!representada.ativo
		) {
			throw new RepresentadaNaoVinculadaError(representadaId);
		}
	}

	/**
	 * SKU é único por representada. Com `oferecerReativacao`, um SKU igual ao
	 * de um produto inativo vira `ProdutoInativoExistenteError` para a UI
	 * oferecer a reativação em vez de criar um duplicado.
	 */
	private async garantirSkuUnico(
		tenantId: string,
		produto: Produto,
		{ oferecerReativacao }: { oferecerReativacao: boolean },
	): Promise<void> {
		const candidatos = await this.buscarPorSku(
			tenantId,
			produto.representada_id,
			produto.sku,
		);
		const conflito = detectarConflitoSku(candidatos, produto, produto.id);

		if (conflito?.tipo === "ativo") {
			throw new SkuDuplicadoError(produto.sku);
		}
		if (conflito?.tipo === "inativo" && oferecerReativacao) {
			throw new ProdutoInativoExistenteError(conflito.registro);
		}
	}

	private async sincronizarPrecos(
		tenantId: string,
		produto: Produto,
		inputs: readonly PrecoProdutoInput[],
		agora: string,
	): Promise<void> {
		const [tabelasDaRepresentada, existentes] = await Promise.all([
			this.db.tabelas_preco
				.where("[tenant_id+representada_id]")
				.equals([tenantId, produto.representada_id])
				.toArray(),
			this.db.itens_preco
				.where("[tenant_id+produto_id]")
				.equals([tenantId, produto.id])
				.toArray(),
		]);

		const { gravar } = sincronizarPrecosProduto({
			tenantId,
			produto,
			tabelasDaRepresentada,
			existentes,
			inputs,
			agora,
			gerarId: this.gerarId,
		});

		if (gravar.length > 0) {
			await this.db.itens_preco.bulkPut(gravar);
		}
	}
}

export const produtoRepository: ProdutoRepository = new ProdutoDexieAdapter();
