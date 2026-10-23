/**
 * Utilitários puros de CNPJ.
 *
 * Suporta o formato numérico tradicional e o CNPJ alfanumérico
 * (IN RFB nº 2.229/2024): 12 caracteres alfanuméricos de raiz/ordem
 * seguidos de 2 dígitos verificadores numéricos. O valor de cada
 * caractere no cálculo do DV é `charCode - 48` (0-9 => 0-9, A => 17, ...).
 */

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

const FORMATO_NORMALIZADO = /^[A-Z0-9]{12}\d{2}$/;
const BASE_VALIDA = /^[A-Z0-9]{12}$/;

/** Remove pontuação/espaços e converte para maiúsculas. */
export function normalizarCnpj(valor: string): string {
	return valor.replace(/[.\-/\s]/g, "").toUpperCase();
}

function calcularDigito(caracteres: string, pesos: readonly number[]): number {
	let soma = 0;
	for (let i = 0; i < pesos.length; i++) {
		soma += (caracteres.charCodeAt(i) - 48) * pesos[i];
	}
	const resto = soma % 11;
	return resto < 2 ? 0 : 11 - resto;
}

/**
 * Calcula os 2 dígitos verificadores para uma base de 12 caracteres.
 * Lança erro se a base for inválida.
 */
export function calcularDigitosVerificadoresCnpj(base: string): string {
	const baseNormalizada = normalizarCnpj(base);
	if (!BASE_VALIDA.test(baseNormalizada)) {
		throw new Error("Base de CNPJ deve conter 12 caracteres alfanuméricos");
	}
	const dv1 = calcularDigito(baseNormalizada, PESOS_DV1);
	const dv2 = calcularDigito(`${baseNormalizada}${dv1}`, PESOS_DV2);
	return `${dv1}${dv2}`;
}

/** Valida um CNPJ (formatado ou não). */
export function isCnpjValido(valor: string): boolean {
	const cnpj = normalizarCnpj(valor);
	if (!FORMATO_NORMALIZADO.test(cnpj)) return false;
	if (/^(.)\1{13}$/.test(cnpj)) return false;

	const esperado = calcularDigitosVerificadoresCnpj(cnpj.slice(0, 12));
	return cnpj.slice(12) === esperado;
}

/** Formata como XX.XXX.XXX/XXXX-XX. Retorna a entrada original se não tiver 14 caracteres. */
export function formatarCnpj(valor: string): string {
	const cnpj = normalizarCnpj(valor);
	if (cnpj.length !== 14) return valor;
	return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
