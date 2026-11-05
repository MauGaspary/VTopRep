import { z } from "zod";

/** Escolha do usuário. `sistema` segue o `prefers-color-scheme` do aparelho. */
export const PreferenciaTemaSchema = z.enum(["claro", "escuro", "sistema"]);
export type PreferenciaTema = z.infer<typeof PreferenciaTemaSchema>;

/** Tema efetivamente aplicado na tela. */
export type Tema = "claro" | "escuro";

/** Claro é o padrão: uso em campo, sob luz do dia. */
export const PREFERENCIA_TEMA_PADRAO: PreferenciaTema = "claro";

/**
 * Chave do `localStorage`. O script inline do `index.html` lê a mesma chave
 * para aplicar o tema antes de o React montar.
 */
export const CHAVE_PREFERENCIA_TEMA = "vtop:tema";

/** Atributo do `<html>` que liga os tokens escuros e a variante `dark:`. */
export const ATRIBUTO_TEMA = "data-tema";

export const ROTULOS_PREFERENCIA_TEMA: Record<PreferenciaTema, string> = {
	claro: "Claro",
	escuro: "Escuro",
	sistema: "Sistema",
};

/** Valor salvo ausente ou inválido volta para o padrão. */
export function lerPreferenciaTema(valor: unknown): PreferenciaTema {
	const resultado = PreferenciaTemaSchema.safeParse(valor);
	return resultado.success ? resultado.data : PREFERENCIA_TEMA_PADRAO;
}

export function resolverTema(
	preferencia: PreferenciaTema,
	sistemaEscuro: boolean,
): Tema {
	if (preferencia === "sistema") return sistemaEscuro ? "escuro" : "claro";
	return preferencia;
}

// --- Cor primária do tenant (white-label) nos dois temas -------------------

export interface CorHsl {
	h: number;
	s: number;
	l: number;
}

const NUMERO = String.raw`(-?\d+(?:\.\d+)?)`;
const PADRAO_HSL = new RegExp(
	String.raw`^\s*(?:hsla?\(\s*)?${NUMERO}(?:deg)?\s*[,\s]\s*${NUMERO}%\s*[,\s]\s*${NUMERO}%\s*\)?\s*$`,
	"i",
);

/** Aceita `"228, 60%, 34%"`, `"228 60% 34%"` e `"hsl(228 60% 34%)"`. */
export function lerCorHsl(valor: string): CorHsl | null {
	const m = PADRAO_HSL.exec(valor);
	if (!m) return null;
	const h = Number(m[1]);
	const s = Number(m[2]);
	const l = Number(m[3]);
	if (s < 0 || s > 100 || l < 0 || l > 100) return null;
	return { h: ((h % 360) + 360) % 360, s, l };
}

/** Formato dos tokens de `index.css` (`H S% L%`, sem o `hsl()`). */
export function formatarCorHsl({ h, s, l }: CorHsl): string {
	const arredondar = (n: number) => Math.round(n * 10) / 10;
	return `${arredondar(h)} ${arredondar(s)}% ${arredondar(l)}%`;
}

function hslParaRgb({ h, s, l }: CorHsl): [number, number, number] {
	const sat = s / 100;
	const lum = l / 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = sat * Math.min(lum, 1 - lum);
	const f = (n: number) =>
		lum - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
	return [f(0), f(8), f(4)];
}

/** Cor em `#rrggbb` (ex.: `theme_color` do manifesto do PWA). */
export function corHslParaHex(cor: CorHsl): string {
	return `#${hslParaRgb(cor)
		.map((c) =>
			Math.round(c * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/** Luminância relativa (WCAG 2.x). */
export function luminanciaRelativa(cor: CorHsl): number {
	const [r, g, b] = hslParaRgb(cor).map((c) =>
		c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function razaoContraste(a: CorHsl, b: CorHsl): number {
	const la = luminanciaRelativa(a);
	const lb = luminanciaRelativa(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Fundos dos cards em cada tema (espelham `--card` de `index.css`). */
const FUNDO_POR_TEMA: Record<Tema, CorHsl> = {
	claro: { h: 0, s: 0, l: 100 },
	escuro: { h: 210, s: 5, l: 8 },
};

const TEXTO_CLARO: CorHsl = { h: 0, s: 0, l: 100 };
const TEXTO_ESCURO: CorHsl = { h: 210, s: 6, l: 6 };

/** Contraste mínimo AA para texto normal. */
export const CONTRASTE_MINIMO_AA = 4.5;

export interface CoresPrimarias {
	/** Token `--primary` / `--ring`. */
	primaria: string;
	/** Token `--primary-foreground` (texto sobre botões primários). */
	textoSobrePrimaria: string;
}

/**
 * Ajusta a cor primária do tenant para ser legível como texto, ícone e anel de
 * foco sobre o fundo do tema (contraste AA), preservando matiz e saturação: no
 * escuro clareia, no claro escurece. O texto dos botões primários é o branco
 * ou o quase-preto, o que tiver mais contraste. Cor inválida → `null`.
 */
export function ajustarCorPrimariaParaTema(
	corTenant: string,
	tema: Tema,
): CoresPrimarias | null {
	const original = lerCorHsl(corTenant);
	if (!original) return null;

	const fundo = FUNDO_POR_TEMA[tema];
	const passo = tema === "escuro" ? 1 : -1;
	let cor = original;
	while (
		razaoContraste(cor, fundo) < CONTRASTE_MINIMO_AA &&
		cor.l + passo >= 0 &&
		cor.l + passo <= 100
	) {
		cor = { ...cor, l: cor.l + passo };
	}

	const texto =
		razaoContraste(cor, TEXTO_CLARO) >= razaoContraste(cor, TEXTO_ESCURO)
			? TEXTO_CLARO
			: TEXTO_ESCURO;

	return {
		primaria: formatarCorHsl(cor),
		textoSobrePrimaria: formatarCorHsl(texto),
	};
}
