import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import {
	type ItemPreco,
	ItemPrecoSchema,
} from "../../produtos/domain/item-preco.schema";
import { indexarItensPreco } from "../../produtos/domain/preco";
import {
	atualizarProduto,
	criarProduto,
	inativarProduto,
	reativarProduto,
} from "../../produtos/domain/produto";
import type { Produto } from "../../produtos/domain/produto.schema";
import {
	criarTabelaPreco,
	encerrarTabelaNaVespera,
} from "../../produtos/domain/tabela-preco";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import {
	type LinhaImportacao,
	type OpcoesImportacao,
	OpcoesImportacaoSchema,
	type ResumoImportacao,
} from "./importacao.schema";
import type { ProblemaLinha } from "./linhas";
import { calcularPreviaImportacao, type PreviaImportacao } from "./previa";

export class ImportacaoInvalidaError extends Error {
	constructor(mensagem: string) {
		super(mensagem);
		this.name = "ImportacaoInvalidaError";
	}
}

export interface RegistroPlanejado<T> {
	registro: T;
	existiaAntes: boolean;
}

export interface PlanoImportacao {
	produtos: RegistroPlanejado<Produto>[];
	tabelas: RegistroPlanejado<TabelaPreco>[];
	itensPreco: RegistroPlanejado<ItemPreco>[];
	resumo: ResumoImportacao;
	problemas: ProblemaLinha[];
}

interface PlanejarImportacaoParams {
	tenantId: string;
	opcoes: OpcoesImportacao;
	linhas: readonly LinhaImportacao[];
	skusNoArquivo: ReadonlySet<string>;
	/** Produtos não excluídos da representada. */
	produtos: readonly Produto[];
	/** Tabelas não excluídas da representada. */
	tabelas: readonly TabelaPreco[];
	/** Itens de preço da tabela de destino, quando ela já existe. */
	itensTabelaDestino: readonly ItemPreco[];
	agora: string;
	gerarId: () => string;
}

/** Tabela da representada utilizável como destino ou substituída. */
function obterTabela(
	tabelas: readonly TabelaPreco[],
	id: string,
	representadaId: string,
	papel: string,
): TabelaPreco {
	const tabela = tabelas.find(
		(t) =>
			t.id === id &&
			t.representada_id === representadaId &&
			t.deleted_at === null,
	);
	if (!tabela) {
		throw new ImportacaoInvalidaError(
			`A ${papel} não foi encontrada nesta representada.`,
		);
	}
	return tabela;
}

/** Referência de preços para a prévia: os itens vivos de uma tabela. */
export function precosDaTabela(
	tabela: TabelaPreco,
	itens: readonly ItemPreco[],
): Map<string, number> {
	return new Map(
		[...indexarItensPreco(itens, tabela)].map(([produtoId, item]) => [
			produtoId,
			item.preco_base_centavos,
		]),
	);
}

/**
 * Transforma o arquivo validado nos registros a gravar (sem tocar no banco).
 * - Produto novo: cria (unidade `UN` e múltiplo 1 quando não vierem).
 * - Existente: atualiza só os campos que vieram preenchidos; inativo é reativado.
 * - Preço: grava na tabela de destino (existente ou nova). Linha sem preço não
 *   mexe no preço que já existe.
 * - Ausentes no arquivo: mantidos, ou inativados se pedido.
 * - Nova tabela pode substituir outra, encerrada na véspera do início da nova.
 * Pedidos já gravados não mudam: o item do pedido guarda o próprio preço.
 */
export function planejarImportacao({
	tenantId,
	opcoes: opcoesBrutas,
	linhas,
	skusNoArquivo,
	produtos,
	tabelas,
	itensTabelaDestino,
	agora,
	gerarId,
}: PlanejarImportacaoParams): PlanoImportacao {
	const opcoes = OpcoesImportacaoSchema.parse(opcoesBrutas);
	const repId = opcoes.representada_id;
	for (const p of produtos) garantirMesmoTenant(p, tenantId);
	for (const t of tabelas) garantirMesmoTenant(t, tenantId);
	for (const i of itensTabelaDestino) garantirMesmoTenant(i, tenantId);
	const produtosDaRep = produtos.filter((p) => p.representada_id === repId);

	const planoTabelas: RegistroPlanejado<TabelaPreco>[] = [];
	let tabelaDestino: TabelaPreco | null = null;
	let itensDestino = new Map<string, ItemPreco>();
	let tabelaEncerradaId: string | null = null;
	const { destino } = opcoes;

	if (destino?.tipo === "existente") {
		tabelaDestino = obterTabela(
			tabelas,
			destino.tabela_id,
			repId,
			"tabela de destino",
		);
		if (!tabelaDestino.ativo) {
			throw new ImportacaoInvalidaError(
				`A tabela "${tabelaDestino.nome_tabela}" está inativa. Reative-a na representada ou crie uma nova tabela.`,
			);
		}
		itensDestino = indexarItensPreco(itensTabelaDestino, tabelaDestino);
	} else if (destino?.tipo === "nova") {
		tabelaDestino = criarTabelaPreco({
			tenantId,
			representadaId: repId,
			input: {
				nome_tabela: destino.nome_tabela,
				vigencia_inicio: destino.vigencia_inicio,
				vigencia_fim: destino.vigencia_fim,
				ativo: true,
			},
			id: gerarId(),
			agora,
		});
		planoTabelas.push({ registro: tabelaDestino, existiaAntes: false });
		if (destino.substitui_tabela_id) {
			const substituida = obterTabela(
				tabelas,
				destino.substitui_tabela_id,
				repId,
				"tabela substituída",
			);
			const encerrada = encerrarTabelaNaVespera(
				substituida,
				tenantId,
				destino.vigencia_inicio,
				agora,
			);
			if (encerrada) {
				planoTabelas.push({ registro: encerrada, existiaAntes: true });
				tabelaEncerradaId = encerrada.id;
			}
		}
	}

	const previa: PreviaImportacao = calcularPreviaImportacao({
		linhas,
		skusNoArquivo,
		produtos: produtosDaRep,
		precosReferencia:
			tabelaDestino && destino?.tipo === "existente"
				? precosDaTabela(tabelaDestino, itensTabelaDestino)
				: null,
		importarPreco: tabelaDestino !== null,
	});

	const planoProdutos: RegistroPlanejado<Produto>[] = [];
	const planoItens: RegistroPlanejado<ItemPreco>[] = [];
	const resumo: ResumoImportacao = {
		criados: 0,
		atualizados: 0,
		reativados: 0,
		inativados: 0,
		precos_gravados: 0,
		tabela_id: tabelaDestino?.id ?? null,
		tabela_encerrada_id: tabelaEncerradaId,
	};

	for (const item of previa.itens) {
		const input = {
			representada_id: repId,
			sku: item.linha.sku,
			...item.final,
		};
		let produto: Produto;
		if (!item.produto) {
			produto = criarProduto({ tenantId, input, id: gerarId(), agora });
			planoProdutos.push({ registro: produto, existiaAntes: false });
			resumo.criados++;
		} else {
			produto = item.produto;
			if (!produto.ativo) {
				produto = reativarProduto(produto, tenantId, agora);
				resumo.reativados++;
			}
			if (item.camposAlterados.length > 0) {
				produto = atualizarProduto(produto, tenantId, input, agora);
				resumo.atualizados++;
			}
			if (produto !== item.produto) {
				planoProdutos.push({ registro: produto, existiaAntes: true });
			}
		}

		const preco = item.precoNovoCentavos;
		if (!tabelaDestino || preco === null) continue;
		const existente = itensDestino.get(produto.id);
		if (existente) {
			if (existente.preco_base_centavos === preco) continue;
			planoItens.push({
				registro: ItemPrecoSchema.parse({
					...existente,
					preco_base_centavos: preco,
					updated_at: agora,
				}),
				existiaAntes: true,
			});
		} else {
			planoItens.push({
				registro: ItemPrecoSchema.parse({
					id: gerarId(),
					tenant_id: tenantId,
					tabela_id: tabelaDestino.id,
					produto_id: produto.id,
					preco_base_centavos: preco,
					desconto_maximo_permitido: 0,
					created_at: agora,
					updated_at: agora,
					deleted_at: null,
				}),
				existiaAntes: false,
			});
		}
		resumo.precos_gravados++;
	}

	if (opcoes.ausentes === "inativar") {
		for (const ausente of previa.ausentes) {
			planoProdutos.push({
				registro: inativarProduto(ausente, tenantId, agora),
				existiaAntes: true,
			});
			resumo.inativados++;
		}
	}

	if (
		planoProdutos.length === 0 &&
		planoItens.length === 0 &&
		planoTabelas.length === 0
	) {
		throw new ImportacaoInvalidaError(
			"Nada a gravar: o arquivo não traz mudanças para esta representada.",
		);
	}

	return {
		produtos: planoProdutos,
		tabelas: planoTabelas,
		itensPreco: planoItens,
		resumo,
		problemas: previa.problemas,
	};
}
