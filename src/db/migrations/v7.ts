import type { Transaction } from "dexie";

/**
 * Migração v6 -> v7 (Fase 2.5.1):
 * - `clientes`: adiciona `tipo_cliente` com padrão `'REVENDA'` nos registros existentes.
 * - `representadas`: preenche `percentual_comissao_fabrica` (obrigatório) a partir do
 *   `percentual_comissao_padrao` quando ausente, mantendo `percentual_comissao_revenda` opcional.
 */

type Registro = Record<string, unknown>;

export async function migrarParaV7(tx: Transaction): Promise<void> {
	await tx
		.table("clientes")
		.toCollection()
		.modify((registro: Registro) => {
			if (
				registro.tipo_cliente !== "REVENDA" &&
				registro.tipo_cliente !== "FABRICA"
			) {
				registro.tipo_cliente = "REVENDA";
			}
		});

	await tx
		.table("representadas")
		.toCollection()
		.modify((registro: Registro) => {
			const padrao =
				typeof registro.percentual_comissao_padrao === "number"
					? registro.percentual_comissao_padrao
					: 0;
			if (typeof registro.percentual_comissao_fabrica !== "number") {
				registro.percentual_comissao_fabrica = padrao;
			}
		});
}
