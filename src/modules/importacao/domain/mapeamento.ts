import { normalizarTexto } from "../../../shared/domain/texto";
import {
	CAMPOS_IMPORTACAO,
	type CampoImportacao,
	type ColunasMapeamentoSalvo,
	type MapeamentoColunas,
	type MapeamentoColunasRascunho,
} from "./importacao.schema";

/** Cabeçalho comparável: sem acento, caixa, espaços e pontuação. */
export function normalizarCabecalho(nome: string): string {
	return normalizarTexto(nome).replace(/[^a-z0-9]/g, "");
}

/** Nomes comuns de cabeçalho por campo, do mais específico ao mais genérico. */
const SINONIMOS: Record<CampoImportacao, readonly string[]> = {
	sku: [
		"sku",
		"codigo",
		"cod",
		"codproduto",
		"codigoproduto",
		"codigodoproduto",
		"referencia",
		"ref",
		"codref",
		"codigoreferencia",
	],
	preco: [
		"preco",
		"precounitario",
		"precotabela",
		"precovenda",
		"valor",
		"valorunitario",
		"vlr",
		"vlrunitario",
		"vlunitario",
	],
	multiplo_embalagem: [
		"multiplo",
		"multiploembalagem",
		"multiplodeembalagem",
		"embalagem",
		"emb",
		"qtdembalagem",
		"qtdemb",
		"qtdcaixa",
		"caixacom",
	],
	unidade_medida: [
		"un",
		"und",
		"unid",
		"unidade",
		"um",
		"unidademedida",
		"unidadedemedida",
	],
	descricao: [
		"descricao",
		"descricaoproduto",
		"descricaodoproduto",
		"produto",
		"nome",
		"nomeproduto",
	],
};

/** Prefixos que identificam o campo quando o nome não é exato ("Preço R$ 2026"). */
const PREFIXOS: Record<CampoImportacao, readonly string[]> = {
	sku: ["codigo", "sku", "referencia"],
	preco: ["preco", "valor", "vlr"],
	multiplo_embalagem: ["multiplo", "qtdemb", "qtdcaixa"],
	unidade_medida: ["unidade"],
	descricao: ["descricao"],
};

/** Ordem de atribuição: campos mais distintivos escolhem a coluna primeiro. */
const ORDEM_ATRIBUICAO: readonly CampoImportacao[] = [
	"sku",
	"preco",
	"multiplo_embalagem",
	"unidade_medida",
	"descricao",
];

function pontuar(campo: CampoImportacao, cabecalho: string): number {
	const nome = normalizarCabecalho(cabecalho);
	if (nome === "") return 0;
	if (SINONIMOS[campo].includes(nome)) return 2;
	return PREFIXOS[campo].some((p) => nome.startsWith(p)) ? 1 : 0;
}

export const MAPEAMENTO_VAZIO: MapeamentoColunasRascunho = {
	sku: null,
	descricao: null,
	unidade_medida: null,
	multiplo_embalagem: null,
	preco: null,
};

/** Adivinha as colunas pelo nome do cabeçalho. Cada coluna é usada uma vez. */
export function adivinharMapeamento(
	cabecalho: readonly string[],
): MapeamentoColunasRascunho {
	const mapeamento = { ...MAPEAMENTO_VAZIO };
	const usadas = new Set<number>();
	for (const campo of ORDEM_ATRIBUICAO) {
		let melhor: number | null = null;
		let melhorPontos = 0;
		for (const [indice, nome] of cabecalho.entries()) {
			if (usadas.has(indice)) continue;
			const pontos = pontuar(campo, nome);
			if (pontos > melhorPontos) {
				melhor = indice;
				melhorPontos = pontos;
			}
		}
		if (melhor !== null) {
			mapeamento[campo] = melhor;
			usadas.add(melhor);
		}
	}
	return mapeamento;
}

/**
 * Mapeamento inicial: o salvo para a representada (pelo nome do cabeçalho)
 * e, para os campos cujo nome não existe mais no arquivo, a adivinhação.
 */
export function sugerirMapeamento(
	cabecalho: readonly string[],
	salvo: ColunasMapeamentoSalvo | null,
): MapeamentoColunasRascunho {
	const adivinhado = adivinharMapeamento(cabecalho);
	if (!salvo) return adivinhado;

	const indicePorNome = new Map<string, number>();
	cabecalho.forEach((nome, indice) => {
		const chave = normalizarCabecalho(nome);
		if (chave && !indicePorNome.has(chave)) indicePorNome.set(chave, indice);
	});

	const resultado = { ...MAPEAMENTO_VAZIO };
	const usadas = new Set<number>();
	for (const campo of CAMPOS_IMPORTACAO) {
		const nomeSalvo = salvo[campo];
		const indice =
			nomeSalvo === null
				? undefined
				: indicePorNome.get(normalizarCabecalho(nomeSalvo));
		if (indice !== undefined) {
			resultado[campo] = indice;
			usadas.add(indice);
		}
	}
	for (const campo of CAMPOS_IMPORTACAO) {
		const palpite = adivinhado[campo];
		// Campo salvo como "não importar" continua de fora.
		if (resultado[campo] !== null || salvo[campo] === null) continue;
		if (palpite !== null && !usadas.has(palpite)) {
			resultado[campo] = palpite;
			usadas.add(palpite);
		}
	}
	return resultado;
}

/** Nomes do cabeçalho para guardar; exige SKU escolhido. */
export function colunasParaSalvar(
	cabecalho: readonly string[],
	mapeamento: MapeamentoColunas,
): ColunasMapeamentoSalvo {
	const nome = (indice: number | null) => {
		if (indice === null) return null;
		const texto = cabecalho[indice]?.trim() ?? "";
		return texto === "" ? null : texto;
	};
	return {
		sku: nome(mapeamento.sku) ?? `Coluna ${mapeamento.sku + 1}`,
		descricao: nome(mapeamento.descricao),
		unidade_medida: nome(mapeamento.unidade_medida),
		multiplo_embalagem: nome(mapeamento.multiplo_embalagem),
		preco: nome(mapeamento.preco),
	};
}

/** Mapeamento pronto para importar, ou a lista de problemas. */
export function validarMapeamento(
	mapeamento: MapeamentoColunasRascunho,
): { ok: true; mapeamento: MapeamentoColunas } | { ok: false; erro: string } {
	const { sku } = mapeamento;
	if (sku === null) {
		return { ok: false, erro: "Escolha a coluna do SKU (código do produto)." };
	}
	const indices = CAMPOS_IMPORTACAO.map((c) => mapeamento[c]).filter(
		(i): i is number => i !== null,
	);
	if (new Set(indices).size !== indices.length) {
		return {
			ok: false,
			erro: "A mesma coluna foi escolhida para dois campos.",
		};
	}
	return { ok: true, mapeamento: { ...mapeamento, sku } };
}

const LINHAS_ANALISADAS = 30;

/**
 * Linha do cabeçalho (índice 0-based). Planilhas de fábrica costumam ter
 * título, logotipo ou data antes. Vence a primeira linha com mais nomes
 * reconhecidos (com pelo menos 2); sem nenhuma, a primeira linha com o
 * maior número de células preenchidas.
 */
export function detectarLinhaCabecalho(linhas: readonly string[][]): number {
	const analisadas = linhas.slice(0, LINHAS_ANALISADAS);
	let melhorIndice = -1;
	let melhorReconhecidos = 1;
	for (const [indice, linha] of analisadas.entries()) {
		const m = adivinharMapeamento(linha);
		const reconhecidos = CAMPOS_IMPORTACAO.filter((c) => m[c] !== null).length;
		if (reconhecidos > melhorReconhecidos) {
			melhorIndice = indice;
			melhorReconhecidos = reconhecidos;
		}
	}
	if (melhorIndice >= 0) return melhorIndice;

	const preenchidas = analisadas.map(
		(l) => l.filter((c) => c.trim() !== "").length,
	);
	const maximo = Math.max(0, ...preenchidas);
	return Math.max(0, preenchidas.indexOf(maximo));
}

/** Letra da coluna como no Excel: 0 → "A", 25 → "Z", 26 → "AA". */
export function letraColuna(indice: number): string {
	let n = indice + 1;
	let letras = "";
	while (n > 0) {
		const resto = (n - 1) % 26;
		letras = String.fromCharCode(65 + resto) + letras;
		n = Math.floor((n - 1) / 26);
	}
	return letras;
}
