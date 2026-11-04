import { z } from "zod";
import { DataSchema } from "../../../shared/domain/datas";
import {
	dividirHalfEven,
	somarCentavos,
} from "../../../shared/domain/dinheiro";
import {
	type Pedido,
	STATUS_PEDIDO,
	type StatusPedido,
	StatusPedidoSchema,
} from "./pedido.schema";

/** Base para a Fase 4 (recompra, Raio-X e Curva ABC). */

export const CriterioOrdenacaoHistoricoSchema = z.enum([
	"data",
	"valor",
	"status",
	"representada",
]);
export type CriterioOrdenacaoHistorico = z.infer<
	typeof CriterioOrdenacaoHistoricoSchema
>;

export const DirecaoOrdenacaoSchema = z.enum(["desc", "asc"]);
export type DirecaoOrdenacao = z.infer<typeof DirecaoOrdenacaoSchema>;

export const ROTULOS_CRITERIO_HISTORICO: Record<
	CriterioOrdenacaoHistorico,
	string
> = {
	data: "Data",
	valor: "Valor",
	status: "Status",
	representada: "Representada",
};

export const OrdenacaoHistoricoSchema = z.object({
	criterio: CriterioOrdenacaoHistoricoSchema,
	direcao: DirecaoOrdenacaoSchema,
});
export type OrdenacaoHistorico = z.infer<typeof OrdenacaoHistoricoSchema>;

/** Padrão: do mais recente para o mais antigo. */
export const ORDENACAO_HISTORICO_PADRAO: OrdenacaoHistorico = {
	criterio: "data",
	direcao: "desc",
};

export const FiltrosHistoricoSchema = z
	.object({
		representada_id: z.string().uuid().nullable(),
		status: StatusPedidoSchema.nullable(),
		/** `false` esconde os orçamentos em rascunho. */
		incluir_rascunhos: z.boolean(),
		/** Datas de calendário (`AAAA-MM-DD`), inclusivas. */
		data_inicio: DataSchema.nullable(),
		data_fim: DataSchema.nullable(),
	})
	.refine((f) => !f.data_inicio || !f.data_fim || f.data_inicio <= f.data_fim, {
		message: "A data final não pode ser anterior à inicial",
		path: ["data_fim"],
	});
export type FiltrosHistorico = z.infer<typeof FiltrosHistoricoSchema>;

export const FILTROS_HISTORICO_PADRAO: FiltrosHistorico = {
	representada_id: null,
	status: null,
	incluir_rascunhos: true,
	data_inicio: null,
	data_fim: null,
};

type PedidoHistorico = Pick<
	Pedido,
	| "id"
	| "representada_id"
	| "status"
	| "data_emissao"
	| "updated_at"
	| "valor_total_centavos"
>;

/** Dia da emissão (`AAAA-MM-DD`) a partir do timestamp UTC. */
function diaEmissao(pedido: Pick<Pedido, "data_emissao">): string {
	return pedido.data_emissao.slice(0, 10);
}

export function filtrarHistorico<T extends PedidoHistorico>(
	pedidos: readonly T[],
	filtros: FiltrosHistorico,
): T[] {
	return pedidos.filter((p) => {
		if (!filtros.incluir_rascunhos && p.status === "rascunho") return false;
		if (filtros.status && p.status !== filtros.status) return false;
		if (
			filtros.representada_id &&
			p.representada_id !== filtros.representada_id
		) {
			return false;
		}
		const dia = diaEmissao(p);
		if (filtros.data_inicio && dia < filtros.data_inicio) return false;
		if (filtros.data_fim && dia > filtros.data_fim) return false;
		return true;
	});
}

const ORDEM_STATUS: ReadonlyMap<StatusPedido, number> = new Map(
	STATUS_PEDIDO.map((status, idx) => [status, idx]),
);

/**
 * Ordena o histórico. Empates caem na data (mais recente primeiro) e depois no
 * id, para a ordem ser estável entre renderizações.
 */
export function ordenarHistorico<T extends PedidoHistorico>(
	pedidos: readonly T[],
	{ criterio, direcao }: OrdenacaoHistorico,
	nomeRepresentada: (representadaId: string) => string = () => "",
): T[] {
	const sinal = direcao === "asc" ? 1 : -1;
	const porData = (a: T, b: T) =>
		a.data_emissao.localeCompare(b.data_emissao) ||
		a.updated_at.localeCompare(b.updated_at);

	const comparar = (a: T, b: T): number => {
		switch (criterio) {
			case "data":
				return porData(a, b);
			case "valor":
				return a.valor_total_centavos - b.valor_total_centavos;
			case "status":
				return (
					(ORDEM_STATUS.get(a.status) ?? 0) - (ORDEM_STATUS.get(b.status) ?? 0)
				);
			case "representada":
				return nomeRepresentada(a.representada_id).localeCompare(
					nomeRepresentada(b.representada_id),
					"pt-BR",
					{ sensitivity: "base" },
				);
		}
	};

	return [...pedidos].sort(
		(a, b) =>
			sinal * comparar(a, b) || -porData(a, b) || a.id.localeCompare(b.id),
	);
}

/** Pedido que conta como compra: `emitido` ou superior (não rascunho nem cancelado). */
export function contaComoCompra(status: StatusPedido): boolean {
	return status !== "rascunho" && status !== "cancelado";
}

export interface ResumoHistoricoCliente {
	quantidade_pedidos: number;
	valor_total_centavos: number;
	/** Valor total / quantidade, half-even. `0` sem pedidos. */
	ticket_medio_centavos: number;
	/** Dia (`AAAA-MM-DD`) da emissão mais recente; `null` sem pedidos. */
	data_ultima_compra: string | null;
}

/** Resumo em centavos, contando apenas pedidos emitidos ou superiores. */
export function resumirHistoricoCliente(
	pedidos: readonly PedidoHistorico[],
): ResumoHistoricoCliente {
	const compras = pedidos.filter((p) => contaComoCompra(p.status));
	const valorTotal = somarCentavos(compras.map((p) => p.valor_total_centavos));
	const ultima = compras.reduce<string | null>(
		(maior, p) =>
			maior === null || p.data_emissao > maior ? p.data_emissao : maior,
		null,
	);
	return {
		quantidade_pedidos: compras.length,
		valor_total_centavos: valorTotal,
		ticket_medio_centavos:
			compras.length === 0
				? 0
				: Number(dividirHalfEven(BigInt(valorTotal), BigInt(compras.length))),
		data_ultima_compra: ultima ? ultima.slice(0, 10) : null,
	};
}
