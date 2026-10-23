/**
 * Conversão entre texto pt-BR com 2 casas decimais e inteiros escalados por 100.
 *
 * Usado para centavos (R$ 1.500,50 => 150050) e centésimos de percentual
 * (5,25% => 525). Nenhuma aritmética de ponto flutuante é usada na conversão.
 */

const FORMATO_BR = /^\d+(,\d{1,2})?$/;
const DECIMAL_COM_PONTO = /^\d+\.\d{1,2}$/;

/**
 * Converte texto em inteiro escalado por 100.
 * Aceita "1.500,50", "1500,5", "1500", "R$ 10,00", "5,25%" e "5.25".
 * Retorna `null` para entradas inválidas, negativas ou com mais de 2 casas.
 */
export function parseDecimalBrParaInteiro(valor: string): number | null {
	let texto = valor.replace(/R\$|%|\s/g, "");
	if (texto === "") return null;

	if (!texto.includes(",") && DECIMAL_COM_PONTO.test(texto)) {
		texto = texto.replace(".", ",");
	} else {
		texto = texto.replace(/\./g, "");
	}

	if (!FORMATO_BR.test(texto)) return null;

	const [parteInteira, parteDecimal = ""] = texto.split(",");
	const resultado = Number(`${parteInteira}${parteDecimal.padEnd(2, "0")}`);

	return Number.isSafeInteger(resultado) ? resultado : null;
}

/** Formata inteiro escalado por 100 como "1.500,50" (sem símbolo). */
export function formatarInteiroComoDecimalBr(valor: number): string {
	if (!Number.isSafeInteger(valor)) {
		throw new Error("Valor deve ser um inteiro seguro");
	}
	const sinal = valor < 0 ? "-" : "";
	const absoluto = Math.abs(valor);
	const parteInteira = Math.trunc(absoluto / 100)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	const parteDecimal = (absoluto % 100).toString().padStart(2, "0");
	return `${sinal}${parteInteira},${parteDecimal}`;
}

/** Formata centavos como moeda: 150050 => "R$ 1.500,50". */
export function formatarCentavos(centavos: number): string {
	return `R$ ${formatarInteiroComoDecimalBr(centavos)}`;
}

/** Formata centésimos de percentual: 525 => "5,25%". */
export function formatarCentesimosPercentual(centesimos: number): string {
	return `${formatarInteiroComoDecimalBr(centesimos)}%`;
}
