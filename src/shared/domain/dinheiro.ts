/**
 * Aritmética monetária em centavos inteiros.
 *
 * Toda multiplicação/divisão é feita em `BigInt` para não perder precisão
 * nem estourar `Number.MAX_SAFE_INTEGER` em produtos intermediários. O
 * arredondamento é bancário (*half-even*): empates exatos vão para o par.
 */

/** 100,00% expresso em centésimos de percentual. */
export const CEM_POR_CENTO_CENTESIMOS = 10000;

function garantirInteiroSeguro(valor: number, nome: string): bigint {
	if (!Number.isSafeInteger(valor)) {
		throw new RangeError(
			`${nome} deve ser um inteiro seguro (recebido ${valor})`,
		);
	}
	return BigInt(valor);
}

function paraNumero(valor: bigint): number {
	const numero = Number(valor);
	if (!Number.isSafeInteger(numero)) {
		throw new RangeError("Resultado excede o limite de inteiro seguro");
	}
	return numero;
}

/** Divide `numerador / denominador` arredondando half-even. */
export function dividirHalfEven(
	numerador: bigint,
	denominador: bigint,
): bigint {
	if (denominador === 0n) {
		throw new RangeError("Divisão por zero");
	}

	const negativo = numerador < 0n !== denominador < 0n;
	const n = numerador < 0n ? -numerador : numerador;
	const d = denominador < 0n ? -denominador : denominador;

	let quociente = n / d;
	const dobroResto = (n % d) * 2n;
	if (dobroResto > d || (dobroResto === d && quociente % 2n === 1n)) {
		quociente += 1n;
	}

	return negativo ? -quociente : quociente;
}

/** Arredonda `centavos * numerador / denominador` (half-even). */
export function multiplicarPorFracao(
	centavos: number,
	numerador: number,
	denominador: number,
): number {
	const resultado = dividirHalfEven(
		garantirInteiroSeguro(centavos, "centavos") *
			garantirInteiroSeguro(numerador, "numerador"),
		garantirInteiroSeguro(denominador, "denominador"),
	);
	return paraNumero(resultado);
}

/**
 * Aplica um percentual em centésimos (500 = 5,00%) sobre um valor em centavos.
 * Ex.: comissão de 5,00% sobre R$ 1.000,00 => `aplicarPercentual(100000, 500)` = 5000.
 */
export function aplicarPercentual(
	centavos: number,
	centesimosPercentual: number,
): number {
	return multiplicarPorFracao(
		centavos,
		centesimosPercentual,
		CEM_POR_CENTO_CENTESIMOS,
	);
}

/** Soma valores em centavos, garantindo que o total continue um inteiro seguro. */
export function somarCentavos(valores: readonly number[]): number {
	let total = 0n;
	for (const valor of valores) {
		total += garantirInteiroSeguro(valor, "centavos");
	}
	return paraNumero(total);
}
