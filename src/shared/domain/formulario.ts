import { z } from "zod";

export interface ErrosMapeados<C extends string> {
	erros: Partial<Record<C, string>>;
	/** Mensagem para problemas que não pertencem a nenhum campo do formulário. */
	geral: string | null;
}

/**
 * Traduz issues do Zod para erros por campo do formulário. Caminhos sem campo
 * correspondente vão para `geral`, para que nenhum erro se perca em silêncio.
 * Mantém apenas a primeira mensagem de cada campo.
 */
export function mapearIssues<C extends string>(
	issues: readonly z.core.$ZodIssue[],
	campoDoCaminho: (caminho: readonly PropertyKey[]) => C | undefined,
	errosIniciais: Partial<Record<C, string>> = {},
): ErrosMapeados<C> {
	const erros: Partial<Record<C, string>> = { ...errosIniciais };
	let geral: string | null = null;

	for (const issue of issues) {
		const campo = campoDoCaminho(issue.path);
		if (campo === undefined) {
			geral ??= issue.message;
		} else if (erros[campo] === undefined) {
			erros[campo] = issue.message;
		}
	}

	return { erros, geral };
}

/** Mensagem legível para exibir na UI. Nunca devolve o JSON cru de um `ZodError`. */
export function mensagemDeErro(erro: unknown, fallback: string): string {
	if (erro instanceof z.ZodError) {
		return erro.issues[0]?.message ?? fallback;
	}
	if (erro instanceof Error && erro.message) {
		return erro.message;
	}
	return fallback;
}
