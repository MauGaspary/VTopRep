import { dividirHalfEven } from "../../../shared/domain/dinheiro";

/**
 * Números vindos de planilhas, convertidos por análise de texto (nunca por
 * ponto flutuante). Aceita "1.234,56", "1234.56", "R$ 1.234,56" e "1,234.56".
 */

export type SeparadorDecimal = "," | ".";

/** Remove símbolo de moeda, espaços (inclusive não separáveis) e `%`. */
function limparNumero(valor: string): string {
	return valor.replace(/R\$/gi, "").replace(/[\s %]/g, "");
}

function contar(texto: string, caractere: string): number {
	return texto.split(caractere).length - 1;
}

/** Separador que o valor indica sem ambiguidade, ou `null` (ex.: "1.234"). */
function votoSeparadorDecimal(valor: string): SeparadorDecimal | null {
	const texto = limparNumero(valor);
	if (!/^-?[\d.,]+$/.test(texto)) return null;
	const virgulas = contar(texto, ",");
	const pontos = contar(texto, ".");

	if (virgulas > 0 && pontos > 0) {
		return texto.lastIndexOf(",") > texto.lastIndexOf(".") ? "," : ".";
	}
	if (virgulas + pontos === 0) return null;
	const separador: SeparadorDecimal = virgulas > 0 ? "," : ".";
	// Separador repetido só pode ser de milhar: o decimal é o outro.
	if (virgulas > 1 || pontos > 1) return separador === "," ? "." : ",";
	const casas = texto.length - texto.indexOf(separador) - 1;
	return casas === 3 ? null : separador;
}

/**
 * Decide o separador decimal de uma coluna inteira pelos valores sem
 * ambiguidade. Sem votos (ou empate), vale a vírgula, padrão brasileiro: assim
 * "1.234" é lido como mil duzentos e trinta e quatro.
 */
export function detectarSeparadorDecimal(
	valores: readonly string[],
): SeparadorDecimal {
	let virgula = 0;
	let ponto = 0;
	for (const valor of valores) {
		const voto = votoSeparadorDecimal(valor);
		if (voto === ",") virgula++;
		if (voto === ".") ponto++;
	}
	return ponto > virgula ? "." : ",";
}

export type ResultadoPrecoCsv =
	| { ok: true; centavos: number; arredondado: boolean }
	| { ok: false; erro: string };

const INTEIRO_COM_MILHAR = (milhar: string) =>
	new RegExp(`^\\d{1,3}(\\${milhar}\\d{3})+$`);

/**
 * Converte um preço em centavos. Mais de 2 casas decimais são arredondadas
 * (*half-even*) e sinalizadas em `arredondado` (ex.: "12,3456" → 1235).
 */
export function parsePrecoCsv(
	valor: string,
	separadorDecimal: SeparadorDecimal,
): ResultadoPrecoCsv {
	const texto = limparNumero(valor);
	if (texto === "") return { ok: false, erro: "Preço vazio" };
	if (texto.startsWith("-") || /^\(.*\)$/.test(texto)) {
		return { ok: false, erro: `Preço negativo: "${valor.trim()}"` };
	}
	const invalido = {
		ok: false,
		erro: `Preço inválido: "${valor.trim()}"`,
	} as const;
	if (!/^[\d.,]+$/.test(texto)) return invalido;

	const milhar = separadorDecimal === "," ? "." : ",";
	if (contar(texto, separadorDecimal) > 1) return invalido;
	const [parteInteiraBruta = "", parteDecimal = ""] =
		texto.split(separadorDecimal);

	let parteInteira = parteInteiraBruta;
	if (parteInteira.includes(milhar)) {
		if (!INTEIRO_COM_MILHAR(milhar).test(parteInteira)) return invalido;
		parteInteira = parteInteira.split(milhar).join("");
	}
	if (!/^\d*$/.test(parteInteira) || !/^\d*$/.test(parteDecimal)) {
		return invalido;
	}
	if (parteInteira === "" && parteDecimal === "") return invalido;

	const digitos = BigInt(`${parteInteira || "0"}${parteDecimal}`);
	const escala = 10n ** BigInt(parteDecimal.length);
	const centavos = Number(dividirHalfEven(digitos * 100n, escala));
	if (!Number.isSafeInteger(centavos)) {
		return { ok: false, erro: `Preço muito alto: "${valor.trim()}"` };
	}
	return {
		ok: true,
		centavos,
		arredondado: /[1-9]/.test(parteDecimal.slice(2)),
	};
}

/**
 * Inteiro positivo (múltiplo de embalagem). Aceita "12", "12,00", "12.0" e
 * "1.000"; recusa frações ("1,5") e zero.
 */
export function parseInteiroPositivoCsv(valor: string): number | null {
	let texto = limparNumero(valor);
	texto = /^\d{1,3}(\.\d{3})+$/.test(texto)
		? texto.replace(/\./g, "")
		: texto.replace(/[.,]0+$/, "");
	if (!/^\d+$/.test(texto)) return null;
	const numero = Number(texto);
	return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}
