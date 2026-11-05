import { z } from "zod";
import { TimestampSchema } from "../../../shared/domain/datas";
import { ClienteSchema } from "../../clientes/domain/cliente.schema";
import { ClienteContatoSchema } from "../../clientes/domain/cliente-contato.schema";
import { ClienteEnderecoSchema } from "../../clientes/domain/cliente-endereco.schema";
import { ClienteMetricaSchema } from "../../clientes/domain/cliente-metrica.schema";
import { MapeamentoImportacaoSalvoSchema } from "../../importacao/domain/importacao.schema";
import { ItemPedidoSchema } from "../../pedidos/domain/item-pedido.schema";
import { PedidoSchema } from "../../pedidos/domain/pedido.schema";
import { ItemPrecoSchema } from "../../produtos/domain/item-preco.schema";
import { ProdutoSchema } from "../../produtos/domain/produto.schema";
import { TabelaPrecoSchema } from "../../produtos/domain/tabela-preco.schema";
import { RepresentadaSchema } from "../../representadas/domain/representada.schema";
import { OutboxMutationSchema } from "../../sync/domain/outbox.schema";
import { TransportadoraSchema } from "../../transportadoras/domain/transportadora.schema";

/** Identifica o arquivo como backup deste app. */
export const FORMATO_BACKUP = "vtop-rep-backup";

/**
 * Versão do formato do arquivo (cabeçalho + `tabelas`). Muda só se a
 * estrutura do arquivo mudar; mudanças nos registros seguem `versao_banco`.
 */
export const VERSAO_FORMATO_BACKUP = 1;

/**
 * Todas as tabelas do tenant no Dexie, inclusive a Outbox pendente e o
 * mapeamento de colunas do CSV (dado só do aparelho, mas útil na restauração).
 * Pais antes de filhos, na mesma ordem de `ENTIDADES_SINCRONIZAVEIS`.
 */
export const TabelasBackupSchema = z.object({
	representadas: z.array(RepresentadaSchema),
	transportadoras: z.array(TransportadoraSchema),
	clientes: z.array(ClienteSchema),
	clientes_enderecos: z.array(ClienteEnderecoSchema),
	clientes_contatos: z.array(ClienteContatoSchema),
	clientes_metricas: z.array(ClienteMetricaSchema),
	produtos: z.array(ProdutoSchema),
	tabelas_preco: z.array(TabelaPrecoSchema),
	itens_preco: z.array(ItemPrecoSchema),
	pedidos: z.array(PedidoSchema),
	itens_pedido: z.array(ItemPedidoSchema),
	outbox: z.array(OutboxMutationSchema),
	mapeamentos_importacao: z.array(MapeamentoImportacaoSalvoSchema),
});

export type TabelasBackup = z.infer<typeof TabelasBackupSchema>;
export type TabelaBackup = keyof TabelasBackup;

export const TabelaBackupSchema = TabelasBackupSchema.keyof();
export const TABELAS_BACKUP = TabelaBackupSchema.options;

/** Cabeçalho lido antes do conteúdo, para recusar cedo com mensagem clara. */
export const CabecalhoBackupSchema = z.object({
	formato: z.literal(FORMATO_BACKUP),
	versao_formato: z.number().int().positive(),
	/** Versão do banco Dexie (`db.verno`) em que o backup foi gerado. */
	versao_banco: z.number().int().positive(),
	tenant_id: z.string().uuid(),
	/** Nome fantasia do tenant, só para exibição. */
	tenant_nome: z.string(),
	exportado_em: TimestampSchema,
});

export type CabecalhoBackup = z.infer<typeof CabecalhoBackupSchema>;

export const BackupLocalSchema = CabecalhoBackupSchema.extend({
	tabelas: TabelasBackupSchema,
});

export type BackupLocal = z.infer<typeof BackupLocalSchema>;

/** Quantidade de registros por tabela. */
export type ContagemBackup = Record<TabelaBackup, number>;

export const ROTULOS_TABELA_BACKUP: Record<TabelaBackup, string> = {
	representadas: "Representadas",
	transportadoras: "Transportadoras",
	clientes: "Clientes",
	clientes_enderecos: "Endereços de clientes",
	clientes_contatos: "Contatos de clientes",
	clientes_metricas: "Métricas de clientes",
	produtos: "Produtos",
	tabelas_preco: "Tabelas de preço",
	itens_preco: "Preços",
	pedidos: "Orçamentos e pedidos",
	itens_pedido: "Itens de pedidos",
	outbox: "Alterações a sincronizar",
	mapeamentos_importacao: "Mapeamentos de CSV",
};
