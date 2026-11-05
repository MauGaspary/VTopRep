import { z } from "zod";
import { DataSchema, TimestampSchema } from "../../../shared/domain/datas";

export const CAMPOS_IMPORTACAO = [
	"sku",
	"descricao",
	"unidade_medida",
	"multiplo_embalagem",
	"preco",
] as const;

export const CampoImportacaoSchema = z.enum(CAMPOS_IMPORTACAO);
export type CampoImportacao = z.infer<typeof CampoImportacaoSchema>;

export const ROTULOS_CAMPO_IMPORTACAO: Record<CampoImportacao, string> = {
	sku: "SKU / código",
	descricao: "Descrição",
	unidade_medida: "Unidade",
	multiplo_embalagem: "Peças por embalagem",
	preco: "Preço",
};

/** Campos do cadastro do produto que a importação pode alterar. */
export type CampoCadastralImportacao = Exclude<
	CampoImportacao,
	"sku" | "preco"
>;

const IndiceColunaSchema = z.number().int().nonnegative();

/** Índice (0-based) da coluna do arquivo para cada campo; `null` = não importar. */
export const MapeamentoColunasSchema = z.object({
	sku: IndiceColunaSchema,
	descricao: IndiceColunaSchema.nullable(),
	unidade_medida: IndiceColunaSchema.nullable(),
	multiplo_embalagem: IndiceColunaSchema.nullable(),
	preco: IndiceColunaSchema.nullable(),
});
export type MapeamentoColunas = z.infer<typeof MapeamentoColunasSchema>;

/** Mapeamento ainda em edição na tela (o SKU pode não ter sido escolhido). */
export type MapeamentoColunasRascunho = {
	[C in CampoImportacao]: number | null;
};

const NomeColunaSchema = z.string().trim().min(1);

/**
 * Mapeamento salvo por representada, **só no aparelho** (não sincroniza).
 * Guarda o nome do cabeçalho, não a posição: a fábrica pode mudar a ordem das
 * colunas entre um arquivo e outro.
 */
export const MapeamentoImportacaoSalvoSchema = z.object({
	tenant_id: z.string().uuid(),
	representada_id: z.string().uuid(),
	colunas: z.object({
		sku: NomeColunaSchema,
		descricao: NomeColunaSchema.nullable(),
		unidade_medida: NomeColunaSchema.nullable(),
		multiplo_embalagem: NomeColunaSchema.nullable(),
		preco: NomeColunaSchema.nullable(),
	}),
	updated_at: TimestampSchema,
});
export type MapeamentoImportacaoSalvo = z.infer<
	typeof MapeamentoImportacaoSalvoSchema
>;
export type ColunasMapeamentoSalvo = MapeamentoImportacaoSalvo["colunas"];

/** Linha válida do arquivo, já normalizada. */
export const LinhaImportacaoSchema = z.object({
	/** Número da linha no arquivo (1 = primeira linha, como no Excel). */
	linha: z.number().int().positive(),
	sku: z
		.string()
		.min(1, "SKU vazio")
		.max(64, "SKU com mais de 64 caracteres")
		.refine((s) => s === s.trim().toUpperCase(), "SKU deve estar normalizado"),
	descricao: z
		.string()
		.max(255, "Descrição com mais de 255 caracteres")
		.nullable(),
	unidade_medida: z
		.string()
		.max(10, "Unidade com mais de 10 caracteres")
		.nullable(),
	multiplo_embalagem: z.number().int().positive().nullable(),
	preco_centavos: z.number().int().nonnegative().nullable(),
});
export type LinhaImportacao = z.infer<typeof LinhaImportacaoSchema>;

export const TRATAMENTOS_AUSENTES = ["manter", "inativar"] as const;
export const TratamentoAusentesSchema = z.enum(TRATAMENTOS_AUSENTES);
export type TratamentoAusentes = z.infer<typeof TratamentoAusentesSchema>;

const NomeTabelaSchema = z
	.string()
	.trim()
	.min(1, "Nome da tabela é obrigatório")
	.max(80, "Nome da tabela deve ter no máximo 80 caracteres");

/** Para onde vão os preços do arquivo. */
export const DestinoPrecosSchema = z.discriminatedUnion("tipo", [
	z.object({
		tipo: z.literal("existente"),
		tabela_id: z.string().uuid("Escolha a tabela de preço"),
	}),
	z
		.object({
			tipo: z.literal("nova"),
			nome_tabela: NomeTabelaSchema,
			vigencia_inicio: DataSchema,
			vigencia_fim: DataSchema.nullable(),
			/** Tabela encerrada na véspera do início da nova (opcional). */
			substitui_tabela_id: z.string().uuid().nullable(),
		})
		.refine((d) => !d.vigencia_fim || d.vigencia_fim >= d.vigencia_inicio, {
			message: "Fim da vigência não pode ser anterior ao início",
			path: ["vigencia_fim"],
		}),
]);
export type DestinoPrecos = z.infer<typeof DestinoPrecosSchema>;

export const OpcoesImportacaoSchema = z.object({
	representada_id: z.string().uuid(),
	/** `null` quando a coluna de preço não foi mapeada (só cadastro). */
	destino: DestinoPrecosSchema.nullable(),
	ausentes: TratamentoAusentesSchema,
});
export type OpcoesImportacao = z.infer<typeof OpcoesImportacaoSchema>;

export interface ResumoImportacao {
	criados: number;
	atualizados: number;
	reativados: number;
	inativados: number;
	precos_gravados: number;
	/** Tabela que recebeu os preços (`null` sem coluna de preço). */
	tabela_id: string | null;
	/** Tabela encerrada na véspera da nova, quando houve substituição. */
	tabela_encerrada_id: string | null;
}
