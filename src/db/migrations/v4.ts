import type { Transaction } from "dexie";
import { z } from "zod";

/**
 * Migração v3 -> v4. Registros legados chegam sem tipo do Dexie, então são
 * tratados como `Record<string, unknown>` e os campos são checados antes do uso.
 */

type Registro = Record<string, unknown>;

const ReferenciaClienteSchema = z.object({
	id: z.string(),
	tenant_id: z.string(),
});

const ReferenciaFilhoSchema = z.object({
	id: z.string(),
	cliente_id: z.unknown(),
});

const DATA_HORA_ISO = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Até a v3 não existia exclusão: todo `deleted_at` preenchido era uma
 * inativação. A partir da v4, `ativo` é o estado de negócio e `deleted_at`
 * fica reservado ao tombstone de sincronização.
 */
function separarAtivoDeExclusao(registro: Registro): void {
	if (registro.deleted_at !== null && registro.deleted_at !== undefined) {
		registro.ativo = false;
		registro.deleted_at = null;
	} else if (typeof registro.ativo !== "boolean") {
		registro.ativo = true;
	}
}

/** Converte timestamps ISO gravados em campos de data pura para `AAAA-MM-DD`. */
function paraDataPura(registro: Registro, campo: string): void {
	const valor = registro[campo];
	if (typeof valor === "string" && DATA_HORA_ISO.test(valor)) {
		registro[campo] = valor.slice(0, 10);
	}
}

function renomearCampo(registro: Registro, de: string, para: string): void {
	if (de in registro) {
		if (!(para in registro)) {
			registro[para] = registro[de];
		}
		Reflect.deleteProperty(registro, de);
	}
}

async function preencherTenantDosFilhos(
	tx: Transaction,
	tenantPorCliente: ReadonlyMap<string, string>,
	tabela: "clientes_enderecos" | "clientes_contatos",
): Promise<void> {
	const filhos = z
		.array(ReferenciaFilhoSchema)
		.parse(await tx.table(tabela).toArray());

	// Filhos sem cliente pai não são alcançáveis pela UI e não têm tenant a herdar.
	const orfaos = filhos
		.filter(
			(f) =>
				typeof f.cliente_id !== "string" || !tenantPorCliente.has(f.cliente_id),
		)
		.map((f) => f.id);
	if (orfaos.length > 0) {
		await tx.table(tabela).bulkDelete(orfaos);
	}

	await tx
		.table(tabela)
		.toCollection()
		.modify((registro: Registro) => {
			const clienteId = registro.cliente_id;
			if (typeof clienteId === "string") {
				registro.tenant_id = tenantPorCliente.get(clienteId);
			}
		});
}

export async function migrarParaV4(tx: Transaction): Promise<void> {
	const clientes = z
		.array(ReferenciaClienteSchema)
		.parse(await tx.table("clientes").toArray());
	const tenantPorCliente = new Map(clientes.map((c) => [c.id, c.tenant_id]));

	await preencherTenantDosFilhos(tx, tenantPorCliente, "clientes_enderecos");
	await preencherTenantDosFilhos(tx, tenantPorCliente, "clientes_contatos");

	await tx.table("clientes").toCollection().modify(separarAtivoDeExclusao);
	await tx.table("representadas").toCollection().modify(separarAtivoDeExclusao);

	await tx
		.table("produtos")
		.toCollection()
		.modify((registro: Registro) => {
			separarAtivoDeExclusao(registro);
			if (typeof registro.sku === "string") {
				registro.sku = registro.sku.trim().toUpperCase();
			}
			const multiplo = registro.multiplo_embalagem;
			if (
				typeof multiplo !== "number" ||
				!Number.isInteger(multiplo) ||
				multiplo < 1
			) {
				registro.multiplo_embalagem = 1;
			}
		});

	await tx
		.table("itens_preco")
		.toCollection()
		.modify((registro: Registro) => {
			renomearCampo(
				registro,
				"teto_desconto_permitido",
				"desconto_maximo_permitido",
			);
			if (typeof registro.desconto_maximo_permitido !== "number") {
				registro.desconto_maximo_permitido = 0;
			}
		});

	await tx
		.table("tabelas_preco")
		.toCollection()
		.modify((registro: Registro) => {
			paraDataPura(registro, "vigencia_inicio");
			paraDataPura(registro, "vigencia_fim");
		});

	await tx
		.table("clientes_metricas")
		.toCollection()
		.modify((registro: Registro) => {
			paraDataPura(registro, "data_ultima_compra");
		});

	await tx
		.table("outbox")
		.toCollection()
		.modify((registro: Registro) => {
			renomearCampo(registro, "tenantId", "tenant_id");
			renomearCampo(registro, "idempotencyKey", "idempotency_key");
			renomearCampo(registro, "retryCount", "retry_count");
			renomearCampo(registro, "lastError", "last_error");
			renomearCampo(registro, "createdAt", "created_at");
		});
}
