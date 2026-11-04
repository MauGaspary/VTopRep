import { formatarDataBr } from "../../../shared/domain/datas";
import { mapearIssues } from "../../../shared/domain/formulario";
import {
	escolherTabelaSugerida,
	listarTabelasVigentes,
	tabelaDisponivel,
} from "../../produtos/domain/preco";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import { type DestinoPrecos, DestinoPrecosSchema } from "./importacao.schema";

/** Campos do formulário "para onde vão os preços" (texto, como na tela). */
export interface DestinoFormValues {
	tipo: "existente" | "nova";
	tabela_id: string;
	nome_tabela: string;
	vigencia_inicio: string;
	vigencia_fim: string;
	/** `""` = não substitui nenhuma tabela. */
	substitui_tabela_id: string;
}

export type CampoDestinoForm = Exclude<keyof DestinoFormValues, "tipo">;
export type DestinoFormErros = Partial<Record<CampoDestinoForm, string>>;

/** Nome sugerido para a nova tabela a partir do nome do arquivo. */
export function nomeTabelaDoArquivo(nomeArquivo: string): string {
	const semExtensao = nomeArquivo.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ");
	return semExtensao.trim().slice(0, 80);
}

/**
 * Valores iniciais: atualizar a tabela vigente mais recente, se houver; senão,
 * criar uma nova a partir de hoje. Ao escolher "nova", a substituída sugerida é
 * a vigente mais recente que começou antes de hoje.
 */
export function valoresIniciaisDestino({
	tabelas,
	hoje,
	nomeArquivo,
}: {
	tabelas: readonly TabelaPreco[];
	hoje: string;
	nomeArquivo: string;
}): DestinoFormValues {
	const sugerida = escolherTabelaSugerida(listarTabelasVigentes(tabelas, hoje));
	const ativa = sugerida ?? tabelas.find(tabelaDisponivel) ?? null;
	return {
		tipo: ativa ? "existente" : "nova",
		tabela_id: ativa?.id ?? "",
		nome_tabela: nomeTabelaDoArquivo(nomeArquivo),
		vigencia_inicio: hoje,
		vigencia_fim: "",
		substitui_tabela_id:
			sugerida && sugerida.vigencia_inicio < hoje ? sugerida.id : "",
	};
}

export type ResultadoDestinoForm =
	| { ok: true; destino: DestinoPrecos }
	| { ok: false; erros: DestinoFormErros };

/** Converte e valida o formulário, inclusive contra as tabelas da representada. */
export function validarDestinoForm(
	valores: DestinoFormValues,
	tabelas: readonly TabelaPreco[],
): ResultadoDestinoForm {
	const bruto =
		valores.tipo === "existente"
			? { tipo: "existente", tabela_id: valores.tabela_id }
			: {
					tipo: "nova",
					nome_tabela: valores.nome_tabela,
					vigencia_inicio: valores.vigencia_inicio,
					vigencia_fim: valores.vigencia_fim || null,
					substitui_tabela_id: valores.substitui_tabela_id || null,
				};
	const resultado = DestinoPrecosSchema.safeParse(bruto);
	if (!resultado.success) {
		const { erros } = mapearIssues<CampoDestinoForm>(
			resultado.error.issues,
			(caminho) => {
				const [campo] = caminho;
				return campo === "tabela_id" ||
					campo === "nome_tabela" ||
					campo === "vigencia_inicio" ||
					campo === "vigencia_fim"
					? campo
					: undefined;
			},
		);
		if (erros.vigencia_inicio)
			erros.vigencia_inicio = "Informe a data de início";
		return { ok: false, erros };
	}

	const destino = resultado.data;
	if (destino.tipo === "existente") {
		const tabela = tabelas.find((t) => t.id === destino.tabela_id);
		if (!tabela || !tabelaDisponivel(tabela)) {
			return { ok: false, erros: { tabela_id: "Escolha uma tabela ativa" } };
		}
	} else if (destino.substitui_tabela_id) {
		const substituida = tabelas.find(
			(t) => t.id === destino.substitui_tabela_id,
		);
		if (!substituida) {
			return {
				ok: false,
				erros: { substitui_tabela_id: "Tabela não encontrada" },
			};
		}
		if (destino.vigencia_inicio <= substituida.vigencia_inicio) {
			return {
				ok: false,
				erros: {
					vigencia_inicio: `Para substituir "${substituida.nome_tabela}", comece depois de ${formatarDataBr(substituida.vigencia_inicio)}`,
				},
			};
		}
	}
	return { ok: true, destino };
}
