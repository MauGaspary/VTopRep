/**
 * Leitura de arquivos CSV (RFC 4180) exportados por planilhas.
 *
 * Funções puras, sem dependência de navegador além de `TextDecoder`: o mesmo
 * código roda nos testes (Node) e no app.
 */

export const SEPARADORES_CSV = [";", ",", "\t"] as const;
export type SeparadorCsv = (typeof SEPARADORES_CSV)[number];

export type EncodingCsv = "utf-8" | "windows-1252";

export const ROTULOS_SEPARADOR_CSV: Record<SeparadorCsv, string> = {
	";": "ponto e vírgula (;)",
	",": "vírgula (,)",
	"\t": "tabulação",
};

export const ROTULOS_ENCODING_CSV: Record<EncodingCsv, string> = {
	"utf-8": "UTF-8",
	"windows-1252": "Windows-1252 (Excel)",
};

/** Marca de ordem de bytes (U+FEFF) que o Excel põe no início do UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

/**
 * Decodifica os bytes do arquivo. Tenta UTF-8 estrito e, se houver byte
 * inválido, usa Windows-1252 (padrão do Excel em português). Remove o BOM.
 */
export function decodificarCsv(bytes: Uint8Array): {
	texto: string;
	encoding: EncodingCsv;
} {
	let texto: string;
	let encoding: EncodingCsv;
	try {
		texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
		encoding = "utf-8";
	} catch {
		texto = new TextDecoder("windows-1252").decode(bytes);
		encoding = "windows-1252";
	}
	return { texto: texto.startsWith(BOM) ? texto.slice(1) : texto, encoding };
}

/** Quantas vezes cada separador aparece fora de aspas, por linha. */
function contarSeparadoresPorLinha(
	texto: string,
	limiteLinhas: number,
): Map<SeparadorCsv, number[]> {
	const contagens = new Map<SeparadorCsv, number[]>(
		SEPARADORES_CSV.map((s) => [s, []]),
	);
	let atual = new Map<SeparadorCsv, number>();
	let entreAspas = false;
	let linhaTemConteudo = false;
	let linhas = 0;

	const fecharLinha = () => {
		if (linhaTemConteudo) {
			for (const s of SEPARADORES_CSV) {
				contagens.get(s)?.push(atual.get(s) ?? 0);
			}
			linhas++;
		}
		atual = new Map();
		linhaTemConteudo = false;
	};

	for (let i = 0; i < texto.length && linhas < limiteLinhas; i++) {
		const c = texto[i];
		if (c === '"') {
			entreAspas = !entreAspas;
			linhaTemConteudo = true;
			continue;
		}
		if (entreAspas) continue;
		if (c === "\n" || c === "\r") {
			fecharLinha();
			continue;
		}
		if (c === ";" || c === "," || c === "\t") {
			atual.set(c, (atual.get(c) ?? 0) + 1);
		}
		if (c.trim() !== "") linhaTemConteudo = true;
	}
	fecharLinha();
	return contagens;
}

/**
 * Detecta o separador olhando as primeiras linhas: vence o que aparece na
 * maior quantidade de linhas com a mesma contagem (colunas consistentes).
 * Empate favorece `;`, padrão do Excel em português.
 */
export function detectarSeparadorCsv(texto: string): SeparadorCsv {
	const contagens = contarSeparadoresPorLinha(texto, 30);
	let melhor: SeparadorCsv = ";";
	let melhorPontuacao = -1;

	for (const separador of SEPARADORES_CSV) {
		const porLinha = contagens.get(separador) ?? [];
		const frequencia = new Map<number, number>();
		for (const n of porLinha) {
			if (n > 0) frequencia.set(n, (frequencia.get(n) ?? 0) + 1);
		}
		let linhasConsistentes = 0;
		let colunas = 0;
		for (const [n, vezes] of frequencia) {
			if (
				vezes > linhasConsistentes ||
				(vezes === linhasConsistentes && n > colunas)
			) {
				linhasConsistentes = vezes;
				colunas = n;
			}
		}
		// Linhas consistentes pesam mais; colunas desempatam.
		const pontuacao = linhasConsistentes * 1000 + colunas;
		if (pontuacao > melhorPontuacao) {
			melhor = separador;
			melhorPontuacao = pontuacao;
		}
	}
	return melhor;
}

/**
 * Converte o texto em linhas e células: campos entre aspas, aspas duplicadas
 * (`""`), quebras de linha dentro de aspas e finais `\r\n`, `\n` ou `\r`.
 * Linhas totalmente vazias no fim do arquivo são descartadas.
 */
export function parseCsv(texto: string, separador: SeparadorCsv): string[][] {
	const linhas: string[][] = [];
	let linha: string[] = [];
	let campo = "";
	let entreAspas = false;
	let i = 0;

	const fecharCampo = () => {
		linha.push(campo);
		campo = "";
	};
	const fecharLinha = () => {
		fecharCampo();
		linhas.push(linha);
		linha = [];
	};

	while (i < texto.length) {
		const c = texto[i];
		if (entreAspas) {
			if (c === '"') {
				if (texto[i + 1] === '"') {
					campo += '"';
					i += 2;
					continue;
				}
				entreAspas = false;
				i++;
				continue;
			}
			campo += c;
			i++;
			continue;
		}

		if (c === '"' && campo.trim() === "") {
			campo = "";
			entreAspas = true;
		} else if (c === separador) {
			fecharCampo();
		} else if (c === "\r" || c === "\n") {
			fecharLinha();
			if (c === "\r" && texto[i + 1] === "\n") i++;
		} else {
			campo += c;
		}
		i++;
	}
	if (campo !== "" || linha.length > 0 || entreAspas) fecharLinha();

	while (
		linhas.length > 0 &&
		(linhas[linhas.length - 1] ?? []).every((c) => c.trim() === "")
	) {
		linhas.pop();
	}
	return linhas;
}

export interface CsvLido {
	linhas: string[][];
	separador: SeparadorCsv;
	encoding: EncodingCsv;
}

/** Decodifica, detecta o separador (se não informado) e lê o arquivo. */
export function lerCsv(bytes: Uint8Array, separador?: SeparadorCsv): CsvLido {
	const { texto, encoding } = decodificarCsv(bytes);
	const sep = separador ?? detectarSeparadorCsv(texto);
	return { linhas: parseCsv(texto, sep), separador: sep, encoding };
}
