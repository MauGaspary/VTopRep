import { isCnpjValido, normalizarCnpj } from "./cnpj";

/**
 * Normaliza CPF removendo pontuações e espaços.
 */
export function normalizarCpf(valor: string): string {
	return valor.replace(/\D/g, "");
}

function calcularDigitoCpf(digitos: string, pesoInicial: number): number {
	let soma = 0;
	for (let i = 0; i < digitos.length; i++) {
		soma += Number(digitos[i]) * (pesoInicial - i);
	}
	const resto = (soma * 10) % 11;
	return resto === 10 ? 0 : resto;
}

/**
 * Calcula os 2 dígitos verificadores para uma base de 9 dígitos.
 * Lança erro se a base for inválida.
 */
export function calcularDigitosVerificadoresCpf(base: string): string {
	const baseNormalizada = normalizarCpf(base);
	if (!/^\d{9}$/.test(baseNormalizada)) {
		throw new Error("Base de CPF deve conter 9 dígitos");
	}
	const dv1 = calcularDigitoCpf(baseNormalizada, 10);
	const dv2 = calcularDigitoCpf(`${baseNormalizada}${dv1}`, 11);
	return `${dv1}${dv2}`;
}

/**
 * Valida se um CPF é matematicamente válido pelos dígitos verificadores.
 */
export function isCpfValido(valor: string): boolean {
	const cpf = normalizarCpf(valor);
	if (cpf.length !== 11) return false;
	if (/^(\d)\1{10}$/.test(cpf)) return false;
	return cpf.slice(9) === calcularDigitosVerificadoresCpf(cpf.slice(0, 9));
}

/**
 * Normaliza qualquer documento (CPF ou CNPJ): remove pontuação/espaços e
 * converte para maiúsculas (CNPJ alfanumérico).
 */
export function normalizarCpfCnpj(valor: string): string {
	return normalizarCnpj(valor);
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
