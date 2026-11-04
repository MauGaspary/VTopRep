import { normalizarSku } from "../../produtos/domain/produto";
import {
	type LinhaImportacao,
	LinhaImportacaoSchema,
	type MapeamentoColunas,
} from "./importacao.schema";
import {
	detectarSeparadorDecimal,
	parseInteiroPositivoCsv,
	parsePrecoCsv,
} from "./numero-csv";

export type GravidadeProblema = "erro" | "aviso";

/** Erro tira a linha da importação; aviso só informa. */
export interface ProblemaLinha {
	linha: number;
	sku: string | null;
	gravidade: GravidadeProblema;
	mensagem: string;
}

export interface LinhasExtraidas {
	linhas: LinhaImportacao[];
	problemas: ProblemaLinha[];
	/** Linhas de dados não vazias encontradas após o cabeçalho. */
	total: number;
	/**
	 * Todos os SKUs presentes no arquivo, inclusive os de linhas com erro: um
	 * produto cuja linha tem erro não é "ausente" e nunca é inativado por isso.
	 */
	skus: Set<string>;
}

interface ExtrairLinhasParams {
	linhas: readonly string[][];
	/** Índice 0-based da linha do cabeçalho; os dados começam na seguinte. */
	linhaCabecalho: number;
	mapeamento: MapeamentoColunas;
}

const celula = (linha: readonly string[], indice: number | null) =>
	indice === null ? "" : (linha[indice] ?? "").trim();

const textoOuNull = (texto: string) =>
	texto === "" ? null : texto.replace(/\s+/g, " ");

function mesmaLinha(a: LinhaImportacao, b: LinhaImportacao): boolean {
	return (
		a.descricao === b.descricao &&
		a.unidade_medida === b.unidade_medida &&
		a.multiplo_embalagem === b.multiplo_embalagem &&
		a.preco_centavos === b.preco_centavos
	);
}

/**
 * Lê as linhas de dados com o mapeamento escolhido e valida cada uma.
 * - Linhas totalmente vazias são ignoradas.
 * - Preço vazio = produto sem preço nesta importação (aviso); com mais de 2
 *   casas decimais é arredondado *half-even* (aviso).
 * - SKU repetido com os mesmos dados: vale a primeira (aviso). Com dados
 *   diferentes: todas as ocorrências viram erro, porque não há como saber
 *   qual está certa.
 */
export function extrairLinhasImportacao({
	linhas,
	linhaCabecalho,
	mapeamento,
}: ExtrairLinhasParams): LinhasExtraidas {
	const dados = linhas
		.map((celulas, indice) => ({ celulas, numero: indice + 1 }))
		.slice(linhaCabecalho + 1)
		.filter(({ celulas }) => celulas.some((c) => c.trim() !== ""));

	const separadorDecimal = detectarSeparadorDecimal(
		dados.map(({ celulas }) => celula(celulas, mapeamento.preco)),
	);

	const problemas: ProblemaLinha[] = [];
	const validas: LinhaImportacao[] = [];
	const skus = new Set<string>();

	for (const { celulas, numero } of dados) {
		const skuBruto = celula(celulas, mapeamento.sku);
		const sku = skuBruto === "" ? null : normalizarSku(skuBruto);
		if (sku) skus.add(sku);
		const erros: string[] = [];
		const avisos: string[] = [];

		let preco: number | null = null;
		const precoBruto = celula(celulas, mapeamento.preco);
		if (mapeamento.preco !== null) {
			if (precoBruto === "") {
				avisos.push("Sem preço: o produto não recebe preço nesta importação");
			} else {
				const resultado = parsePrecoCsv(precoBruto, separadorDecimal);
				if (!resultado.ok) {
					erros.push(resultado.erro);
				} else {
					preco = resultado.centavos;
					if (resultado.arredondado) {
						avisos.push(
							`Preço "${precoBruto}" tem mais de 2 casas decimais e foi arredondado`,
						);
					}
				}
			}
		}

		let multiplo: number | null = null;
		const multiploBruto = celula(celulas, mapeamento.multiplo_embalagem);
		if (multiploBruto !== "") {
			multiplo = parseInteiroPositivoCsv(multiploBruto);
			if (multiplo === null) {
				erros.push(
					`Múltiplo de embalagem inválido: "${multiploBruto}" (use um inteiro maior que zero)`,
				);
			}
		}

		const unidade = textoOuNull(celula(celulas, mapeamento.unidade_medida));
		const candidata = LinhaImportacaoSchema.safeParse({
			linha: numero,
			sku: sku ?? "",
			descricao: textoOuNull(celula(celulas, mapeamento.descricao)),
			unidade_medida: unidade === null ? null : unidade.toUpperCase(),
			multiplo_embalagem: multiplo,
			preco_centavos: preco,
		});
		if (!candidata.success) {
			erros.push(...candidata.error.issues.map((i) => i.message));
		}

		for (const mensagem of avisos) {
			problemas.push({ linha: numero, sku, gravidade: "aviso", mensagem });
		}
		if (erros.length > 0 || !candidata.success) {
			for (const mensagem of erros) {
				problemas.push({ linha: numero, sku, gravidade: "erro", mensagem });
			}
			continue;
		}
		validas.push(candidata.data);
	}

	const porSku = new Map<string, LinhaImportacao[]>();
	for (const linha of validas) {
		const grupo = porSku.get(linha.sku) ?? [];
		grupo.push(linha);
		porSku.set(linha.sku, grupo);
	}

	const resultado: LinhaImportacao[] = [];
	for (const linha of validas) {
		const grupo = porSku.get(linha.sku) ?? [linha];
		const [primeira] = grupo;
		if (grupo.length === 1 || !primeira) {
			resultado.push(linha);
			continue;
		}
		const todasIguais = grupo.every((l) => mesmaLinha(l, primeira));
		if (todasIguais) {
			if (linha === primeira) {
				resultado.push(linha);
			} else {
				problemas.push({
					linha: linha.linha,
					sku: linha.sku,
					gravidade: "aviso",
					mensagem: `SKU repetido (igual à linha ${primeira.linha}); linha ignorada`,
				});
			}
			continue;
		}
		const outras = grupo.filter((l) => l !== linha).map((l) => l.linha);
		problemas.push({
			linha: linha.linha,
			sku: linha.sku,
			gravidade: "erro",
			mensagem: `SKU repetido com dados diferentes (também ${
				outras.length === 1 ? "na linha" : "nas linhas"
			} ${outras.join(", ")})`,
		});
	}

	problemas.sort(
		(a, b) =>
			a.linha - b.linha ||
			(a.gravidade === b.gravidade ? 0 : a.gravidade === "erro" ? -1 : 1),
	);
	return { linhas: resultado, problemas, total: dados.length, skus };
}
