/** Situação do armazenamento do navegador (IndexedDB e caches do app). */
export interface EstadoArmazenamento {
	/** O navegador expõe a Storage API (`navigator.storage`). */
	suportado: boolean;
	/**
	 * Com armazenamento persistente o navegador não apaga os dados para liberar
	 * espaço; só o usuário, limpando os dados do site.
	 */
	persistente: boolean;
	usadoBytes: number | null;
	cotaBytes: number | null;
}

export const ESTADO_ARMAZENAMENTO_DESCONHECIDO: EstadoArmazenamento = {
	suportado: false,
	persistente: false,
	usadoBytes: null,
	cotaBytes: null,
};

const UNIDADES = ["B", "KB", "MB", "GB", "TB"] as const;

const formatoUmaCasa = new Intl.NumberFormat("pt-BR", {
	maximumFractionDigits: 1,
});

/** `1536` → `"1,5 KB"` (base 1024, uma casa decimal; só exibição). */
export function formatarBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	let valor = bytes;
	let unidade = 0;
	while (valor >= 1024 && unidade < UNIDADES.length - 1) {
		valor /= 1024;
		unidade++;
	}
	const texto =
		unidade === 0 ? String(Math.round(valor)) : formatoUmaCasa.format(valor);
	return `${texto} ${UNIDADES[unidade]}`;
}

/** Percentual usado da cota (0 a 100); `null` sem dados. */
export function percentualUsado(estado: EstadoArmazenamento): number | null {
	const { usadoBytes, cotaBytes } = estado;
	if (usadoBytes === null || cotaBytes === null || cotaBytes <= 0) return null;
	return Math.min(100, Math.max(0, (usadoBytes / cotaBytes) * 100));
}
