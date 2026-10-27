import { isCnpjValido } from "./cnpj";

/**
 * Normaliza CPF removendo pontuações e espaços.
 */
export function normalizarCpf(valor: string): string {
	return valor.replace(/\D/g, "");
}

/**
 * Valida se um CPF é matematicamente válido pelos dígitos verificadores.
 */
export function isCpfValido(valor: string): boolean {
	const cpf = normalizarCpf(valor);
	if (cpf.length !== 11) return false;
	if (/^(\d)\1{10}$/.test(cpf)) return false;

	// 1º dígito verificador
	let soma = 0;
	for (let i = 0; i < 9; i++) {
		soma += Number(cpf[i]) * (10 - i);
	}
	let resto = (soma * 10) % 11;
	const dv1 = resto === 10 || resto === 11 ? 0 : resto;
	if (dv1 !== Number(cpf[9])) return false;

	// 2º dígito verificador
	soma = 0;
	for (let i = 0; i < 10; i++) {
		soma += Number(cpf[i]) * (11 - i);
	}
	resto = (soma * 10) % 11;
	const dv2 = resto === 10 || resto === 11 ? 0 : resto;
	return dv2 === Number(cpf[10]);
}

/**
 * Normaliza qualquer documento (CPF ou CNPJ).
 */
export function normalizarCpfCnpj(valor: string): string {
	return valor.replace(/[.\-/\s]/g, "").toUpperCase();
}

/**
 * Valida se a string é um CPF ou CNPJ válido.
 */
export function isCpfOuCnpjValido(valor: string): boolean {
	const limpo = normalizarCpfCnpj(valor);
	if (limpo.length === 11) {
		return isCpfValido(limpo);
	}
	if (limpo.length === 14) {
		return isCnpjValido(limpo);
	}
	return false;
}

/**
 * Formata CPF (XXX.XXX.XXX-XX) ou CNPJ (XX.XXX.XXX/XXXX-XX).
 */
export function formatarCpfCnpj(valor: string): string {
	const limpo = normalizarCpfCnpj(valor);
	if (limpo.length === 11) {
		return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9, 11)}`;
	}
	if (limpo.length === 14) {
		return `${limpo.slice(0, 2)}.${limpo.slice(2, 5)}.${limpo.slice(5, 8)}/${limpo.slice(8, 12)}-${limpo.slice(12, 14)}`;
	}
	return valor;
}
