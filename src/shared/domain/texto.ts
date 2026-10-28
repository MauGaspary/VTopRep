/** Marcas diacríticas (acentos) separadas da letra base pelo NFD. */
const DIACRITICOS = /\p{Mn}/gu;

/** Normaliza texto para comparações e buscas case/acento-insensíveis. */
export function normalizarTexto(texto: string): string {
	return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase().trim();
}
