import { normalizarTexto } from "./texto";

export interface OpcaoCombobox<T = unknown> {
	id: string;
	label: string;
	sublabel?: string;
	keywords?: readonly string[];
	dados?: T;
}

function extrairAlfanumerico(valor: string): string {
	return normalizarTexto(valor).replace(/[^a-z0-9]/g, "");
}

/**
 * Filtra e ordena opções de um Combobox a partir do texto digitado.
 * Prioriza opções cujo rótulo principal começa com o termo pesquisado,
 * seguido por correspondências parciais no rótulo, sub-rótulo ou palavras-chave
 * (incluindo documentos CPF/CNPJ com ou sem pontuação).
 */
export function filtrarOpcoesCombobox<T>(
	opcoes: readonly OpcaoCombobox<T>[],
	termoBusca: string,
): OpcaoCombobox<T>[] {
	const termoNormalizado = normalizarTexto(termoBusca);
	if (termoNormalizado === "") {
		return [...opcoes];
	}

	const termoCompacto = extrairAlfanumerico(termoBusca);

	const pontuadas: Array<{
		opcao: OpcaoCombobox<T>;
		prioridade: number;
		indiceOriginal: number;
	}> = [];

	opcoes.forEach((opcao, indiceOriginal) => {
		const labelNorm = normalizarTexto(opcao.label);
		const sublabelNorm = normalizarTexto(opcao.sublabel ?? "");
		const keywordsNorm = (opcao.keywords ?? []).map(normalizarTexto);

		if (labelNorm.startsWith(termoNormalizado)) {
			pontuadas.push({ opcao, prioridade: 1, indiceOriginal });
			return;
		}

		if (labelNorm.includes(termoNormalizado)) {
			pontuadas.push({ opcao, prioridade: 2, indiceOriginal });
			return;
		}

		if (
			sublabelNorm.includes(termoNormalizado) ||
			keywordsNorm.some((k) => k.includes(termoNormalizado))
		) {
			pontuadas.push({ opcao, prioridade: 3, indiceOriginal });
			return;
		}

		if (termoCompacto.length >= 2) {
			const alvosCompactos = [
				extrairAlfanumerico(opcao.label),
				extrairAlfanumerico(opcao.sublabel ?? ""),
				...(opcao.keywords ?? []).map(extrairAlfanumerico),
			];
			if (alvosCompactos.some((alvo) => alvo.includes(termoCompacto))) {
				pontuadas.push({ opcao, prioridade: 4, indiceOriginal });
			}
		}
	});

	pontuadas.sort((a, b) => {
		if (a.prioridade !== b.prioridade) {
			return a.prioridade - b.prioridade;
		}
		return a.indiceOriginal - b.indiceOriginal;
	});

	return pontuadas.map((item) => item.opcao);
}

/**
 * Calcula o próximo índice destacado na lista do Combobox via setas do teclado.
 */
export function calcularIndiceDestacadoCombobox(
	indiceAtual: number,
	totalOpcoes: number,
	direcao: "proximo" | "anterior",
): number {
	if (totalOpcoes <= 0) return -1;
	if (indiceAtual < 0 || indiceAtual >= totalOpcoes) {
		return direcao === "proximo" ? 0 : totalOpcoes - 1;
	}
	if (direcao === "proximo") {
		return (indiceAtual + 1) % totalOpcoes;
	}
	return (indiceAtual - 1 + totalOpcoes) % totalOpcoes;
}
