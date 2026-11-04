import { z } from "zod";
import { DataSchema, formatarDataBr } from "../../../shared/domain/datas";
import {
	formatarCentesimosPercentual,
	parseDecimalBrParaInteiro,
} from "../../../shared/domain/decimal-br";
import { aplicarPercentual } from "../../../shared/domain/dinheiro";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { type ItemPreco, ItemPrecoSchema } from "./item-preco.schema";
import { indexarItensPreco } from "./preco";
import {
	criarTabelaPreco,
	diaSeguinte,
	encerrarTabelaNaVespera,
} from "./tabela-preco";
import type { TabelaPreco } from "./tabela-preco.schema";

/** Maior redução aceita: -99,99% (com -100% todos os preços zerariam). */
export const REDUCAO_MAXIMA_CENTESIMOS = -9999;
/** Maior aumento aceito: +1.000,00%. */
export const AUMENTO_MAXIMO_CENTESIMOS = 100000;

export const ReajusteTabelaInputSchema = z
	.object({
		tabela_origem_id: z.string().uuid("Escolha a tabela de origem"),
		/** Centésimos de %, com sinal: `550` = +5,50%; `-300` = -3,00%. */
		percentual_centesimos: z
			.number()
			.int("Percentual inválido")
			.min(REDUCAO_MAXIMA_CENTESIMOS, "A redução deve ser menor que 100%")
			.max(AUMENTO_MAXIMO_CENTESIMOS, "O aumento deve ser de até 1.000%"),
		nome_tabela: z
			.string()
			.trim()
			.min(1, "Nome da tabela é obrigatório")
			.max(80, "Nome da tabela deve ter no máximo 80 caracteres"),
		vigencia_inicio: DataSchema,
		vigencia_fim: DataSchema.nullable(),
	})
	.refine((d) => !d.vigencia_fim || d.vigencia_fim >= d.vigencia_inicio, {
		message: "Fim da vigência não pode ser anterior ao início",
		path: ["vigencia_fim"],
	});

export type ReajusteTabelaInput = z.input<typeof ReajusteTabelaInputSchema>;

/** Preço reajustado em centavos: `preço + preço × percentual` (half-even). */
export function reajustarPreco(
	centavos: number,
	percentualCentesimos: number,
): number {
	return Math.max(
		0,
		centavos + aplicarPercentual(centavos, percentualCentesimos),
	);
}

export interface ItemReajustado {
	produto_id: string;
	anterior_centavos: number;
	novo_centavos: number;
}

export interface PlanoReajuste {
	novaTabela: TabelaPreco;
	itens: ItemPreco[];
	/** Origem encerrada na véspera da nova; `null` se ela já terminava antes. */
	origemEncerrada: TabelaPreco | null;
	comparacao: ItemReajustado[];
}

interface PlanejarReajusteParams {
	tenantId: string;
	origem: TabelaPreco;
	itensOrigem: readonly ItemPreco[];
	input: ReajusteTabelaInput;
	agora: string;
	gerarId: () => string;
}

/**
 * Clona a tabela com todos os preços reajustados e a nova vigência. A origem
 * é encerrada na véspera do início da nova (decisão do produto: evita vender
 * pelo preço antigo por engano). Pedidos já gravados não mudam.
 */
export function planejarReajusteTabela({
	tenantId,
	origem,
	itensOrigem,
	input,
	agora,
	gerarId,
}: PlanejarReajusteParams): PlanoReajuste {
	const dados = ReajusteTabelaInputSchema.parse(input);
	garantirMesmoTenant(origem, tenantId);
	if (dados.tabela_origem_id !== origem.id) {
		throw new Error("Tabela de origem divergente do reajuste.");
	}

	const origemEncerrada = encerrarTabelaNaVespera(
		origem,
		tenantId,
		dados.vigencia_inicio,
		agora,
	);
	const novaTabela = criarTabelaPreco({
		tenantId,
		representadaId: origem.representada_id,
		input: {
			nome_tabela: dados.nome_tabela,
			vigencia_inicio: dados.vigencia_inicio,
			vigencia_fim: dados.vigencia_fim,
			ativo: true,
		},
		id: gerarId(),
		agora,
	});

	const itens: ItemPreco[] = [];
	const comparacao: ItemReajustado[] = [];
	for (const item of indexarItensPreco(itensOrigem, origem).values()) {
		const novo = reajustarPreco(
			item.preco_base_centavos,
			dados.percentual_centesimos,
		);
		itens.push(
			ItemPrecoSchema.parse({
				id: gerarId(),
				tenant_id: tenantId,
				tabela_id: novaTabela.id,
				produto_id: item.produto_id,
				preco_base_centavos: novo,
				desconto_maximo_permitido: item.desconto_maximo_permitido,
				created_at: agora,
				updated_at: agora,
				deleted_at: null,
			}),
		);
		comparacao.push({
			produto_id: item.produto_id,
			anterior_centavos: item.preco_base_centavos,
			novo_centavos: novo,
		});
	}

	return { novaTabela, itens, origemEncerrada, comparacao };
}

/** Campos do formulário de reajuste (texto, como na tela). */
export interface ReajusteFormValues {
	tabela_origem_id: string;
	tipo: "aumento" | "reducao";
	/** Percentual em texto pt-BR, sem sinal (ex.: "5,5"). */
	percentual: string;
	nome_tabela: string;
	vigencia_inicio: string;
	vigencia_fim: string;
}

export type CampoReajusteForm = Exclude<keyof ReajusteFormValues, "tipo">;

export type ResultadoReajusteForm =
	| { ok: true; input: ReajusteTabelaInput }
	| { ok: false; erros: Partial<Record<CampoReajusteForm, string>> };

/** Converte e valida o formulário; a nova precisa começar depois da origem. */
export function validarReajusteForm(
	valores: ReajusteFormValues,
	origem: TabelaPreco | null,
): ResultadoReajusteForm {
	const erros: Partial<Record<CampoReajusteForm, string>> = {};
	const percentual = parseDecimalBrParaInteiro(valores.percentual);
	if (percentual === null || percentual === 0) {
		erros.percentual = "Informe um percentual maior que zero";
	}
	if (!origem) erros.tabela_origem_id = "Escolha a tabela de origem";

	const resultado = ReajusteTabelaInputSchema.safeParse({
		tabela_origem_id: valores.tabela_origem_id,
		percentual_centesimos:
			percentual === null
				? 0
				: valores.tipo === "reducao"
					? -percentual
					: percentual,
		nome_tabela: valores.nome_tabela,
		vigencia_inicio: valores.vigencia_inicio,
		vigencia_fim: valores.vigencia_fim || null,
	});
	if (!resultado.success) {
		for (const issue of resultado.error.issues) {
			const [campo] = issue.path;
			const chave: CampoReajusteForm | null =
				campo === "percentual_centesimos"
					? "percentual"
					: campo === "nome_tabela" ||
							campo === "vigencia_inicio" ||
							campo === "vigencia_fim" ||
							campo === "tabela_origem_id"
						? campo
						: null;
			if (chave && !erros[chave]) {
				erros[chave] =
					chave === "vigencia_inicio"
						? "Informe a data de início"
						: issue.message;
			}
		}
	}
	if (
		origem &&
		resultado.success &&
		resultado.data.vigencia_inicio <= origem.vigencia_inicio
	) {
		erros.vigencia_inicio = `Comece depois de ${formatarDataBr(origem.vigencia_inicio)} (início de "${origem.nome_tabela}")`;
	}
	if (Object.keys(erros).length > 0 || !resultado.success) {
		return { ok: false, erros };
	}
	return { ok: true, input: resultado.data };
}

/** Nome sugerido: "Tabela 2026 +5,50%". */
export function sugerirNomeReajuste(
	origem: Pick<TabelaPreco, "nome_tabela">,
	tipo: ReajusteFormValues["tipo"],
	percentual: string,
): string {
	const valor = parseDecimalBrParaInteiro(percentual);
	if (valor === null || valor === 0) return origem.nome_tabela.slice(0, 80);
	const sufixo = ` ${tipo === "reducao" ? "-" : "+"}${formatarCentesimosPercentual(valor)}`;
	return `${origem.nome_tabela.slice(0, 80 - sufixo.length)}${sufixo}`;
}

/** Início sugerido: hoje, ou o dia seguinte ao início da origem se ela começa hoje ou depois. */
export function sugerirInicioReajuste(
	origem: Pick<TabelaPreco, "vigencia_inicio">,
	hoje: string,
): string {
	return hoje > origem.vigencia_inicio
		? hoje
		: diaSeguinte(origem.vigencia_inicio);
}
