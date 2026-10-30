import { formatarDataBr } from "../../../shared/domain/datas";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { tabelaDisponivel } from "./preco";
import {
	type TabelaPreco,
	type TabelaPrecoInput,
	TabelaPrecoInputSchema,
	type TabelaPrecoInputValidado,
	TabelaPrecoSchema,
} from "./tabela-preco.schema";

/** Nome da tabela criada automaticamente com toda representada nova. */
export const NOME_TABELA_PADRAO = "Tabela Padrão";

export type SituacaoVigencia = "vigente" | "futura" | "encerrada";

/** Situação da vigência na data (`AAAA-MM-DD`); os dois extremos são inclusivos. */
export function situacaoVigencia(
	tabela: Pick<TabelaPreco, "vigencia_inicio" | "vigencia_fim">,
	data: string,
): SituacaoVigencia {
	if (tabela.vigencia_inicio > data) return "futura";
	if (tabela.vigencia_fim && data > tabela.vigencia_fim) return "encerrada";
	return "vigente";
}

/** Ex.: "A partir de 01/01/2026" ou "01/01/2026 a 31/12/2026". */
export function descreverVigencia(
	tabela: Pick<TabelaPreco, "vigencia_inicio" | "vigencia_fim">,
): string {
	const inicio = formatarDataBr(tabela.vigencia_inicio);
	return tabela.vigencia_fim
		? `${inicio} a ${formatarDataBr(tabela.vigencia_fim)}`
		: `A partir de ${inicio}`;
}

const compararNome = (a: TabelaPreco, b: TabelaPreco) =>
	a.nome_tabela.localeCompare(b.nome_tabela, "pt-BR", { sensitivity: "base" });

/** Cadastro da representada: ativas primeiro, depois início mais recente e nome. */
export function ordenarTabelasPreco(
	tabelas: readonly TabelaPreco[],
): TabelaPreco[] {
	return [...tabelas].sort((a, b) => {
		if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
		return (
			b.vigencia_inicio.localeCompare(a.vigencia_inicio) || compararNome(a, b)
		);
	});
}

/**
 * Tabelas em que faz sentido cadastrar preço: ativas, não excluídas e não
 * encerradas. Vigentes primeiro (início mais recente), depois as futuras.
 */
export function listarTabelasEmUso(
	tabelas: readonly TabelaPreco[],
	data: string,
): TabelaPreco[] {
	const ordem: Record<SituacaoVigencia, number> = {
		vigente: 0,
		futura: 1,
		encerrada: 2,
	};
	return tabelas
		.filter(
			(t) => tabelaDisponivel(t) && situacaoVigencia(t, data) !== "encerrada",
		)
		.sort(
			(a, b) =>
				ordem[situacaoVigencia(a, data)] - ordem[situacaoVigencia(b, data)] ||
				b.vigencia_inicio.localeCompare(a.vigencia_inicio) ||
				compararNome(a, b),
		);
}

interface CriarTabelaPrecoParams {
	tenantId: string;
	representadaId: string;
	input: TabelaPrecoInput;
	id: string;
	agora: string;
}

function montarTabela(
	dados: TabelaPrecoInputValidado,
	base: Pick<
		TabelaPreco,
		| "id"
		| "tenant_id"
		| "representada_id"
		| "created_at"
		| "updated_at"
		| "deleted_at"
	>,
): TabelaPreco {
	return TabelaPrecoSchema.parse({
		...base,
		nome_tabela: dados.nome_tabela,
		vigencia_inicio: dados.vigencia_inicio,
		vigencia_fim: dados.vigencia_fim ?? null,
		ativo: dados.ativo,
	});
}

export function criarTabelaPreco({
	tenantId,
	representadaId,
	input,
	id,
	agora,
}: CriarTabelaPrecoParams): TabelaPreco {
	return montarTabela(TabelaPrecoInputSchema.parse(input), {
		id,
		tenant_id: tenantId,
		representada_id: representadaId,
		created_at: agora,
		updated_at: agora,
		deleted_at: null,
	});
}

/** "Tabela Padrão" vigente desde `hoje`, sem data de término. */
export function criarTabelaPadrao({
	hoje,
	...params
}: Omit<CriarTabelaPrecoParams, "input"> & { hoje: string }): TabelaPreco {
	return criarTabelaPreco({
		...params,
		input: {
			nome_tabela: NOME_TABELA_PADRAO,
			vigencia_inicio: hoje,
			vigencia_fim: null,
			ativo: true,
		},
	});
}

const mesmoConteudo = (a: TabelaPreco, b: TabelaPreco) =>
	a.nome_tabela === b.nome_tabela &&
	a.vigencia_inicio === b.vigencia_inicio &&
	(a.vigencia_fim ?? null) === (b.vigencia_fim ?? null) &&
	a.ativo === b.ativo;

interface SincronizarTabelasParams {
	tenantId: string;
	representadaId: string;
	/** Tabelas já gravadas da representada (vazio na criação). */
	existentes: readonly TabelaPreco[];
	inputs: readonly TabelaPrecoInput[];
	agora: string;
	gerarId?: () => string;
}

export interface TabelasSincronizadas {
	/** Tabelas vivas resultantes, na ordem do cadastro. */
	tabelas: TabelaPreco[];
	/** Registros a persistir: novos e alterados. */
	gravar: TabelaPreco[];
}

/**
 * Reconcilia as tabelas do cadastro da representada com as gravadas:
 * - `id` de uma tabela viva da representada: atualiza, ou mantém intacta se
 *   nada mudou;
 * - sem `id`, ou `id` desconhecido/repetido: cria com id novo (impede
 *   sobrescrever tabela de outra representada ou tenant);
 * - tabela gravada ausente da lista: fica como está. Tabelas não são excluídas
 *   pelo cadastro (pedidos as referenciam); para tirá-las de uso, `ativo = false`.
 */
export function sincronizarTabelasRepresentada({
	tenantId,
	representadaId,
	existentes,
	inputs,
	agora,
	gerarId = () => crypto.randomUUID(),
}: SincronizarTabelasParams): TabelasSincronizadas {
	for (const existente of existentes) garantirMesmoTenant(existente, tenantId);

	const vivas = new Map(
		existentes
			.filter(
				(t) => t.deleted_at === null && t.representada_id === representadaId,
			)
			.map((t) => [t.id, t]),
	);
	const usadas = new Set<string>();
	const tabelas: TabelaPreco[] = [];
	const gravar: TabelaPreco[] = [];

	for (const input of inputs) {
		const dados = TabelaPrecoInputSchema.parse(input);
		const existente = dados.id !== undefined ? vivas.get(dados.id) : undefined;

		if (existente && !usadas.has(existente.id)) {
			usadas.add(existente.id);
			const candidata = montarTabela(dados, {
				id: existente.id,
				tenant_id: existente.tenant_id,
				representada_id: existente.representada_id,
				created_at: existente.created_at,
				updated_at: agora,
				deleted_at: null,
			});
			if (mesmoConteudo(existente, candidata)) {
				tabelas.push(existente);
			} else {
				tabelas.push(candidata);
				gravar.push(candidata);
			}
			continue;
		}

		const nova = montarTabela(dados, {
			id: gerarId(),
			tenant_id: tenantId,
			representada_id: representadaId,
			created_at: agora,
			updated_at: agora,
			deleted_at: null,
		});
		tabelas.push(nova);
		gravar.push(nova);
	}

	return { tabelas, gravar };
}
