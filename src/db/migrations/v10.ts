import type { Transaction } from "dexie";

/**
 * Migração v9 -> v10 (Fase 2.7): a tabela de preço passa a ser exclusiva da
 * representada. A store `clientes_tabelas_preco` é removida (o orçamento
 * sugere a tabela vigente mais recente da fábrica) e as mutações pendentes
 * dessa entidade saem da Outbox, já que não há mais destino para elas.
 */

type Registro = Record<string, unknown>;

export const ENTIDADE_REMOVIDA_V10 = "clientes_tabelas_preco";

export async function migrarParaV10(tx: Transaction): Promise<void> {
	await tx
		.table("outbox")
		.filter((registro: Registro) => registro.entity === ENTIDADE_REMOVIDA_V10)
		.delete();
}
