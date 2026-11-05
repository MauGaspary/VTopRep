import { z } from "zod";
import { dataLocal } from "../../../shared/domain/datas";
import {
	type BackupLocal,
	BackupLocalSchema,
	CabecalhoBackupSchema,
	type ContagemBackup,
	FORMATO_BACKUP,
	ROTULOS_TABELA_BACKUP,
	TABELAS_BACKUP,
	type TabelaBackup,
	TabelaBackupSchema,
	type TabelasBackup,
	TabelasBackupSchema,
	VERSAO_FORMATO_BACKUP,
} from "./backup.schema";

/** Erro com mensagem pronta para a tela (arquivo recusado, dado inconsistente). */
export class BackupInvalidoError extends Error {
	constructor(mensagem: string) {
		super(mensagem);
		this.name = "BackupInvalidoError";
	}
}

const TenantIdSchema = z.string().uuid("tenantId inválido");

/** Chave primária de cada tabela no Dexie, para detectar registros repetidos. */
function chaveDoRegistro(tabela: TabelaBackup, registro: object): string {
	if (tabela === "clientes_metricas" && "cliente_id" in registro) {
		return String(registro.cliente_id);
	}
	if (
		tabela === "mapeamentos_importacao" &&
		"tenant_id" in registro &&
		"representada_id" in registro
	) {
		return `${String(registro.tenant_id)}|${String(registro.representada_id)}`;
	}
	return "id" in registro ? String(registro.id) : "";
}

/**
 * Confere o que o Zod não vê: todo registro pertence ao tenant do backup e não
 * há chave repetida na mesma tabela. Devolve a primeira inconsistência.
 */
export function verificarIntegridadeBackup(
	tabelas: TabelasBackup,
	tenantId: string,
): string | null {
	for (const tabela of TABELAS_BACKUP) {
		const chaves = new Set<string>();
		const registros: readonly object[] = tabelas[tabela];
		for (const [indice, registro] of registros.entries()) {
			if (!("tenant_id" in registro) || registro.tenant_id !== tenantId) {
				return `${ROTULOS_TABELA_BACKUP[tabela]}: o registro ${indice + 1} pertence a outra empresa.`;
			}
			const chave = chaveDoRegistro(tabela, registro);
			if (chaves.has(chave)) {
				return `${ROTULOS_TABELA_BACKUP[tabela]}: o registro ${indice + 1} está repetido.`;
			}
			chaves.add(chave);
		}
	}
	return null;
}

/** Traduz o primeiro problema do Zod para "Clientes, registro 13 (cnpj_cpf): ...". */
function descreverIssue(issue: z.core.$ZodIssue): string {
	const [raiz, tabela, indice, ...campo] = issue.path;
	const tabelaValida = TabelaBackupSchema.safeParse(tabela);
	if (raiz === "tabelas" && tabelaValida.success) {
		const rotulo = ROTULOS_TABELA_BACKUP[tabelaValida.data];
		if (typeof indice !== "number") return `${rotulo}: ${issue.message}`;
		const sufixoCampo = campo.length > 0 ? ` (${campo.join(".")})` : "";
		return `${rotulo}, registro ${indice + 1}${sufixoCampo}: ${issue.message}`;
	}
	const caminho = issue.path.join(".");
	return caminho ? `${caminho}: ${issue.message}` : issue.message;
}

export interface MontarBackupParams {
	tenantId: string;
	tenantNome: string;
	versaoBanco: number;
	agora: string;
	tabelas: unknown;
}

/**
 * Monta o arquivo de backup validado. Falha já na exportação se algum registro
 * local não passar pelo schema: um backup que não pode ser restaurado não
 * protege nada.
 */
export function montarBackup({
	tenantId,
	tenantNome,
	versaoBanco,
	agora,
	tabelas,
}: MontarBackupParams): BackupLocal {
	const tenant = TenantIdSchema.parse(tenantId);
	const resultado = BackupLocalSchema.safeParse({
		formato: FORMATO_BACKUP,
		versao_formato: VERSAO_FORMATO_BACKUP,
		versao_banco: versaoBanco,
		tenant_id: tenant,
		tenant_nome: tenantNome,
		exportado_em: agora,
		tabelas,
	});
	if (!resultado.success) {
		const issue = resultado.error.issues[0];
		throw new BackupInvalidoError(
			`Não foi possível gerar o backup. ${issue ? descreverIssue(issue) : ""}`.trim(),
		);
	}
	const inconsistencia = verificarIntegridadeBackup(
		resultado.data.tabelas,
		tenant,
	);
	if (inconsistencia) {
		throw new BackupInvalidoError(
			`Não foi possível gerar o backup. ${inconsistencia}`,
		);
	}
	return resultado.data;
}

export interface LerBackupParams {
	tenantId: string;
	/** Versão do banco deste app (`db.verno`). */
	versaoBanco: number;
}

export type ResultadoLeituraBackup =
	| { ok: true; backup: BackupLocal }
	| { ok: false; erro: string };

/**
 * Lê e valida o arquivo inteiro antes de qualquer gravação. Recusa arquivo
 * que não é backup, de outra empresa, de outra versão do banco ou com
 * qualquer registro inválido.
 */
export function lerArquivoBackup(
	texto: string,
	{ tenantId, versaoBanco }: LerBackupParams,
): ResultadoLeituraBackup {
	let bruto: unknown;
	try {
		bruto = JSON.parse(texto);
	} catch {
		return {
			ok: false,
			erro: "O arquivo não é um backup do app (conteúdo ilegível).",
		};
	}

	const cabecalho = CabecalhoBackupSchema.safeParse(bruto);
	if (!cabecalho.success) {
		return {
			ok: false,
			erro: "O arquivo não é um backup do app ou está incompleto.",
		};
	}
	const { versao_formato, versao_banco, tenant_id } = cabecalho.data;

	if (versao_formato > VERSAO_FORMATO_BACKUP) {
		return {
			ok: false,
			erro: "Este backup foi gerado por uma versão mais nova do app. Atualize o app e tente de novo.",
		};
	}
	if (versao_formato !== VERSAO_FORMATO_BACKUP) {
		return { ok: false, erro: "Formato de backup não suportado." };
	}
	if (tenant_id !== tenantId) {
		return {
			ok: false,
			erro: `Este backup é de outra empresa (${cabecalho.data.tenant_nome || "sem nome"}) e não pode ser restaurado aqui.`,
		};
	}
	if (versao_banco > versaoBanco) {
		return {
			ok: false,
			erro: `Este backup foi gerado por uma versão mais nova do app (banco v${versao_banco}; este aparelho usa v${versaoBanco}). Atualize o app e tente de novo.`,
		};
	}
	if (versao_banco < versaoBanco) {
		return {
			ok: false,
			erro: `Este backup é de uma versão anterior do app (banco v${versao_banco}; este aparelho usa v${versaoBanco}) e não é compatível.`,
		};
	}

	const completo = BackupLocalSchema.safeParse(bruto);
	if (!completo.success) {
		const issue = completo.error.issues[0];
		return {
			ok: false,
			erro: `Backup com dado inválido. ${issue ? descreverIssue(issue) : ""}`.trim(),
		};
	}

	const inconsistencia = verificarIntegridadeBackup(
		completo.data.tabelas,
		tenantId,
	);
	if (inconsistencia) {
		return { ok: false, erro: `Backup inconsistente. ${inconsistencia}` };
	}

	return { ok: true, backup: completo.data };
}

/**
 * Registros prontos para gravar na restauração. Mutações que estavam "em
 * envio" quando o backup foi feito voltam para a fila (`pending`).
 */
export function tabelasParaRestaurar(backup: BackupLocal): TabelasBackup {
	const tabelas = TabelasBackupSchema.parse(backup.tabelas);
	return {
		...tabelas,
		outbox: tabelas.outbox.map((m) =>
			m.status === "syncing" ? { ...m, status: "pending" } : m,
		),
	};
}

export function contarRegistrosBackup(tabelas: TabelasBackup): ContagemBackup {
	return montarContagem((tabela) => tabelas[tabela].length);
}

/** Monta a contagem de todas as tabelas a partir de uma função por tabela. */
export function montarContagem(
	quantidade: (tabela: TabelaBackup) => number,
): ContagemBackup {
	return {
		representadas: quantidade("representadas"),
		transportadoras: quantidade("transportadoras"),
		clientes: quantidade("clientes"),
		clientes_enderecos: quantidade("clientes_enderecos"),
		clientes_contatos: quantidade("clientes_contatos"),
		clientes_metricas: quantidade("clientes_metricas"),
		produtos: quantidade("produtos"),
		tabelas_preco: quantidade("tabelas_preco"),
		itens_preco: quantidade("itens_preco"),
		pedidos: quantidade("pedidos"),
		itens_pedido: quantidade("itens_pedido"),
		outbox: quantidade("outbox"),
		mapeamentos_importacao: quantidade("mapeamentos_importacao"),
	};
}

export function totalRegistros(contagem: ContagemBackup): number {
	return TABELAS_BACKUP.reduce((soma, tabela) => soma + contagem[tabela], 0);
}

/** Conteúdo do arquivo `.json` (compacto: catálogos grandes passam de MBs). */
export function serializarBackup(backup: BackupLocal): string {
	return JSON.stringify(backup);
}

/** Ex.: `backup-exemplo-2026-11-04-1530.json` (data e hora locais). */
export function nomeArquivoBackup(slug: string, instante: Date): string {
	const hora = String(instante.getHours()).padStart(2, "0");
	const minuto = String(instante.getMinutes()).padStart(2, "0");
	const slugSeguro =
		slug
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "dados";
	return `backup-${slugSeguro}-${dataLocal(instante)}-${hora}${minuto}.json`;
}
