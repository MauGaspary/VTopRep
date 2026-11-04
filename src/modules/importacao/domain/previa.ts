import { dividirHalfEven } from "../../../shared/domain/dinheiro";
import type { Produto } from "../../produtos/domain/produto.schema";
import type {
	CampoCadastralImportacao,
	LinhaImportacao,
} from "./importacao.schema";
import type { ProblemaLinha } from "./linhas";

export const UNIDADE_PADRAO_IMPORTACAO = "UN";

export type SituacaoProdutoPrevia = "novo" | "reativado" | "existente";
export type SituacaoPrecoPrevia =
	| "subiu"
	| "caiu"
	| "novo"
	| "igual"
	| "sem_preco";

export interface ItemPrevia {
	linha: LinhaImportacao;
	/** Produto do cadastro com o mesmo SKU (`null` = novo). */
	produto: Produto | null;
	situacao: SituacaoProdutoPrevia;
	camposAlterados: CampoCadastralImportacao[];
	/** Cadastro resultante depois da importação. */
	final: Pick<Produto, "descricao" | "unidade_medida" | "multiplo_embalagem">;
	precoAnteriorCentavos: number | null;
	precoNovoCentavos: number | null;
	/** Centésimos de % (half-even); `null` sem preço anterior positivo. */
	variacaoCentesimos: number | null;
	situacaoPreco: SituacaoPrecoPrevia;
}

export const CATEGORIAS_PREVIA = [
	"novos",
	"reativados",
	"alterados",
	"preco_subiu",
	"preco_caiu",
	"preco_novo",
	"inalterados",
] as const;
export type CategoriaPrevia = (typeof CATEGORIAS_PREVIA)[number];

export const ROTULOS_CATEGORIA_PREVIA: Record<CategoriaPrevia, string> = {
	novos: "Novos",
	reativados: "Reativados",
	alterados: "Cadastro alterado",
	preco_subiu: "Preço subiu",
	preco_caiu: "Preço caiu",
	preco_novo: "Preço novo",
	inalterados: "Inalterados",
};

/** Rótulo de uma linha da prévia (singular). */
export const ROTULOS_CATEGORIA_ITEM: Record<CategoriaPrevia, string> = {
	novos: "Novo",
	reativados: "Reativado",
	alterados: "Cadastro alterado",
	preco_subiu: "Preço subiu",
	preco_caiu: "Preço caiu",
	preco_novo: "Preço novo",
	inalterados: "Inalterado",
};

/** Um item pode cair em mais de uma categoria (ex.: alterado e preço subiu). */
export function categoriasDoItem(item: ItemPrevia): CategoriaPrevia[] {
	const categorias: CategoriaPrevia[] = [];
	if (item.situacao === "novo") categorias.push("novos");
	if (item.situacao === "reativado") categorias.push("reativados");
	if (item.camposAlterados.length > 0) categorias.push("alterados");
	if (item.situacaoPreco === "subiu") categorias.push("preco_subiu");
	if (item.situacaoPreco === "caiu") categorias.push("preco_caiu");
	if (item.situacaoPreco === "novo") categorias.push("preco_novo");
	if (categorias.length === 0) categorias.push("inalterados");
	return categorias;
}

export interface PreviaImportacao {
	itens: ItemPrevia[];
	/** Produtos ativos da representada cujo SKU não está no arquivo. */
	ausentes: Produto[];
	/** Problemas encontrados ao cruzar com o cadastro (ex.: novo sem descrição). */
	problemas: ProblemaLinha[];
	contagem: Record<CategoriaPrevia, number>;
}

interface CalcularPreviaParams {
	linhas: readonly LinhaImportacao[];
	/** Todos os SKUs do arquivo, inclusive de linhas com erro. */
	skusNoArquivo: ReadonlySet<string>;
	/** Produtos não excluídos da representada (ativos e inativos). */
	produtos: readonly Produto[];
	/** Preço atual por `produto_id` para comparar; `null` = sem comparação. */
	precosReferencia: ReadonlyMap<string, number> | null;
	/** `false` quando a coluna de preço não foi mapeada. */
	importarPreco: boolean;
}

/** Variação percentual em centésimos de % (`1050` = +10,50%). */
export function variacaoPercentual(
	anterior: number,
	novo: number,
): number | null {
	if (anterior <= 0) return null;
	return Number(
		dividirHalfEven(BigInt(novo - anterior) * 10000n, BigInt(anterior)),
	);
}

/** Produto por SKU; havendo ativo e inativo com o mesmo SKU, vale o ativo. */
export function indexarProdutosPorSku(
	produtos: readonly Produto[],
): Map<string, Produto> {
	const porSku = new Map<string, Produto>();
	for (const produto of produtos) {
		if (produto.deleted_at !== null) continue;
		const atual = porSku.get(produto.sku);
		if (!atual || (!atual.ativo && produto.ativo)) {
			porSku.set(produto.sku, produto);
		}
	}
	return porSku;
}

/**
 * Compara o arquivo com o cadastro sem gravar nada. É a mesma análise usada
 * para gravar (`planejarImportacao`), então a prévia mostra exatamente o que
 * será feito.
 */
export function calcularPreviaImportacao({
	linhas,
	skusNoArquivo,
	produtos,
	precosReferencia,
	importarPreco,
}: CalcularPreviaParams): PreviaImportacao {
	const porSku = indexarProdutosPorSku(produtos);
	const itens: ItemPrevia[] = [];
	const problemas: ProblemaLinha[] = [];

	for (const linha of linhas) {
		const produto = porSku.get(linha.sku) ?? null;

		if (!produto && linha.descricao === null) {
			problemas.push({
				linha: linha.linha,
				sku: linha.sku,
				gravidade: "erro",
				mensagem: "Produto novo sem descrição",
			});
			continue;
		}

		const final = {
			descricao: linha.descricao ?? produto?.descricao ?? "",
			unidade_medida:
				linha.unidade_medida ??
				produto?.unidade_medida ??
				UNIDADE_PADRAO_IMPORTACAO,
			multiplo_embalagem:
				linha.multiplo_embalagem ?? produto?.multiplo_embalagem ?? 1,
		};

		const camposAlterados: CampoCadastralImportacao[] = [];
		if (produto) {
			if (final.descricao !== produto.descricao)
				camposAlterados.push("descricao");
			if (final.unidade_medida !== produto.unidade_medida) {
				camposAlterados.push("unidade_medida");
			}
			if (final.multiplo_embalagem !== produto.multiplo_embalagem) {
				camposAlterados.push("multiplo_embalagem");
			}
		}

		const precoNovo = importarPreco ? linha.preco_centavos : null;
		const precoAnterior =
			produto && precosReferencia
				? (precosReferencia.get(produto.id) ?? null)
				: null;
		let situacaoPreco: SituacaoPrecoPrevia = "sem_preco";
		if (precoNovo !== null) {
			if (precoAnterior === null) situacaoPreco = "novo";
			else if (precoNovo > precoAnterior) situacaoPreco = "subiu";
			else if (precoNovo < precoAnterior) situacaoPreco = "caiu";
			else situacaoPreco = "igual";
		}

		itens.push({
			linha,
			produto,
			situacao: !produto ? "novo" : produto.ativo ? "existente" : "reativado",
			camposAlterados,
			final,
			precoAnteriorCentavos: precoAnterior,
			precoNovoCentavos: precoNovo,
			variacaoCentesimos:
				precoNovo !== null && precoAnterior !== null
					? variacaoPercentual(precoAnterior, precoNovo)
					: null,
			situacaoPreco,
		});
	}

	const ausentes = [...porSku.values()]
		.filter((p) => p.ativo && !skusNoArquivo.has(p.sku))
		.sort((a, b) => a.sku.localeCompare(b.sku, "pt-BR", { numeric: true }));

	const contagem: Record<CategoriaPrevia, number> = {
		novos: 0,
		reativados: 0,
		alterados: 0,
		preco_subiu: 0,
		preco_caiu: 0,
		preco_novo: 0,
		inalterados: 0,
	};
	for (const item of itens) {
		for (const categoria of categoriasDoItem(item)) contagem[categoria]++;
	}

	return { itens, ausentes, problemas, contagem };
}
