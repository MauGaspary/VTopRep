import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	EmptyState,
	PageHeader,
	RepresentadaBadge,
	SearchInput,
} from "../../../shared/components/ui";
import { formatarDataBr } from "../../../shared/domain/datas";
import { formatarCentavos } from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE } from "../../../shared/domain/frete";
import { normalizarTexto } from "../../../shared/domain/texto";
import { useTodosClientes } from "../../clientes/hooks/use-clientes";
import { obterCorRepresentada } from "../../representadas/domain/representada";
import type { Representada } from "../../representadas/domain/representada.schema";
import { useTodasRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	type Pedido,
	ROTULOS_STATUS_PEDIDO,
	type StatusPedido,
} from "../domain/pedido.schema";
import { usePedidoActions, usePedidos } from "../hooks/use-pedidos";
import { baixarEspelhoPedidoPdf } from "./espelho-pedido-pdf";

type FiltroStatus = "todos" | "rascunho" | "emitido";

const OPCOES_FILTRO: readonly { valor: FiltroStatus; rotulo: string }[] = [
	{ valor: "todos", rotulo: "Todos" },
	{ valor: "rascunho", rotulo: "Orçamentos" },
	{ valor: "emitido", rotulo: "Emitidos" },
];

function varianteBadgeStatus(status: StatusPedido) {
	if (status === "rascunho") return "secondary" as const;
	if (status === "cancelado") return "destructive" as const;
	return "success" as const;
}

export function PedidosListView() {
	const { config } = useTenant();
	const [termoBusca, setTermoBusca] = useState("");
	const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
	const [erro, setErro] = useState<string | null>(null);
	const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);

	const { pedidos, isLoading: carregandoPedidos } = usePedidos(config.id);
	const { clientes, isLoading: carregandoClientes } = useTodosClientes(
		config.id,
	);
	const { representadas, isLoading: carregandoRepresentadas } =
		useTodasRepresentadas(config.id);
	const { excluirRascunho, obterEspelhoPorId } = usePedidoActions(config.id);

	const clientesPorId = useMemo(() => {
		const mapa = new Map<string, string>();
		for (const c of clientes) {
			mapa.set(c.id, c.nome_fantasia ?? c.razao_social);
		}
		return mapa;
	}, [clientes]);

	const representadasPorId = useMemo(() => {
		const mapa = new Map<string, Representada>();
		for (const r of representadas) {
			mapa.set(r.id, r);
		}
		return mapa;
	}, [representadas]);

	const metricas = useMemo(() => {
		let rascunhosCount = 0;
		let emitidosCount = 0;
		let totalOrcamentosCentavos = 0;
		let totalEmitidosCentavos = 0;
		let comissaoEmitidosCentavos = 0;

		for (const p of pedidos) {
			if (p.status === "rascunho") {
				rascunhosCount += 1;
				totalOrcamentosCentavos += p.valor_total_centavos;
			} else if (p.status !== "cancelado") {
				emitidosCount += 1;
				totalEmitidosCentavos += p.valor_total_centavos;
				comissaoEmitidosCentavos += p.comissao_projetada_centavos;
			}
		}

		return {
			rascunhosCount,
			emitidosCount,
			totalOrcamentosCentavos,
			totalEmitidosCentavos,
			comissaoEmitidosCentavos,
		};
	}, [pedidos]);

	const pedidosFiltrados = useMemo(() => {
		const termo = normalizarTexto(termoBusca);
		return pedidos.filter((pedido) => {
			if (filtroStatus === "rascunho" && pedido.status !== "rascunho") {
				return false;
			}
			if (filtroStatus === "emitido" && pedido.status === "rascunho") {
				return false;
			}
			if (termo === "") return true;

			const nomeCliente = normalizarTexto(
				clientesPorId.get(pedido.cliente_id) ?? "",
			);
			const nomeRep = normalizarTexto(
				representadasPorId.get(pedido.representada_id)?.nome_fantasia ?? "",
			);
			const condicao = normalizarTexto(pedido.condicao_pagamento);
			const codigo = normalizarTexto(pedido.id.slice(0, 8));

			return (
				nomeCliente.includes(termo) ||
				nomeRep.includes(termo) ||
				condicao.includes(termo) ||
				codigo.includes(termo)
			);
		});
	}, [pedidos, filtroStatus, termoBusca, clientesPorId, representadasPorId]);

	const isLoading =
		carregandoPedidos || carregandoClientes || carregandoRepresentadas;

	const handleExcluirRascunho = async (pedido: Pedido) => {
		const nomeCliente = clientesPorId.get(pedido.cliente_id) ?? "Cliente";
		const confirmado = window.confirm(
			`Excluir o rascunho de orçamento de "${nomeCliente}"?`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await excluirRascunho(pedido.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao excluir rascunho de orçamento"));
		}
	};

	const handleBaixarPdf = async (pedidoId: string) => {
		setErro(null);
		setGerandoPdfId(pedidoId);
		try {
			const espelho = await obterEspelhoPorId(pedidoId, config.empresa);
			if (!espelho) {
				setErro("Não foi possível carregar os dados do espelho para o PDF.");
				return;
			}
			await baixarEspelhoPedidoPdf(espelho);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao gerar o espelho PDF"));
		} finally {
			setGerandoPdfId(null);
		}
	};

	return (
		<Page>
			<PageHeader
				title="Orçamentos e Pedidos"
				description="Elabore orçamentos ágeis em campo, gere espelhos em PDF e acompanhe pedidos emitidos."
				action={
					<Link to="/pedidos/novo" className={buttonClassName()}>
						<Plus aria-hidden="true" />
						Novo orçamento
					</Link>
				}
			/>

			{/* Resumo executivo estilo Linear */}
			{!isLoading && pedidos.length > 0 && (
				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
					<div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3">
						<span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
							Orçamentos em aberto ({metricas.rascunhosCount})
						</span>
						<span className="font-mono text-lg font-semibold text-foreground tabular-nums">
							{formatarCentavos(metricas.totalOrcamentosCentavos)}
						</span>
					</div>
					<div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3">
						<span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
							Pedidos fechados ({metricas.emitidosCount})
						</span>
						<span className="font-mono text-lg font-semibold text-foreground tabular-nums">
							{formatarCentavos(metricas.totalEmitidosCentavos)}
						</span>
					</div>
					<div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-4 py-3">
						<span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
							Comissão projetada (fechados)
						</span>
						<span className="font-mono text-lg font-semibold text-success tabular-nums">
							{formatarCentavos(metricas.comissaoEmitidosCentavos)}
						</span>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
				<div
					role="tablist"
					aria-label="Filtrar pedidos por status"
					className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/60 p-1"
				>
					{OPCOES_FILTRO.map((opcao) => {
						const ativo = filtroStatus === opcao.valor;
						const contagem =
							opcao.valor === "todos"
								? pedidos.length
								: opcao.valor === "rascunho"
									? metricas.rascunhosCount
									: metricas.emitidosCount;
						return (
							<button
								key={opcao.valor}
								type="button"
								role="tab"
								aria-selected={ativo}
								onClick={() => setFiltroStatus(opcao.valor)}
								className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
									ativo
										? "bg-card text-foreground shadow-2xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<span>{opcao.rotulo}</span>
								<span className="font-mono text-[11px] text-subtle-foreground tabular-nums">
									{contagem}
								</span>
							</button>
						);
					})}
				</div>

				<div className="w-full sm:max-w-xs">
					<SearchInput
						id="busca-pedidos"
						placeholder="Buscar por cliente, fábrica, #código..."
						value={termoBusca}
						onChange={setTermoBusca}
					/>
				</div>
			</div>

			{erro && <Alert variant="destructive">{erro}</Alert>}

			{isLoading && (
				<p className="py-6 text-center text-muted-foreground">
					Carregando orçamentos e pedidos...
				</p>
			)}

			{!isLoading && pedidosFiltrados.length === 0 && (
				<EmptyState
					icon={FileText}
					title={
						termoBusca || filtroStatus !== "todos"
							? "Nenhum orçamento ou pedido encontrado para o filtro atual."
							: "Nenhum orçamento ou pedido registrado ainda."
					}
					description="Inicie uma cotação selecionando o cliente, a representada e os itens do catálogo."
					action={
						<Link to="/pedidos/novo" className={buttonClassName()}>
							<Plus aria-hidden="true" />
							Criar primeiro orçamento
						</Link>
					}
				/>
			)}

			{!isLoading && pedidosFiltrados.length > 0 && (
				<section
					aria-label="Lista de orçamentos e pedidos"
					className="dense-table-region rounded-xl border border-border bg-card"
				>
					<table className="text-left text-sm">
						<thead>
							<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
								<th className="w-28 px-3.5 py-2.5">Código / Data</th>
								<th className="px-3 py-2.5">Cliente</th>
								<th className="hidden px-3 py-2.5 md:table-cell">
									Representada
								</th>
								<th className="hidden px-3 py-2.5 lg:table-cell">Condição</th>
								<th className="px-3 py-2.5">Status</th>
								<th className="px-3 py-2.5 text-right">Valor Total</th>
								<th className="px-3.5 py-2.5 text-right">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{pedidosFiltrados.map((pedido) => {
								const nomeCliente =
									clientesPorId.get(pedido.cliente_id) ??
									"Cliente não encontrado";
								const rep = representadasPorId.get(pedido.representada_id);
								const nomeRep =
									rep?.nome_fantasia ?? "Representada não encontrada";
								const corRep = rep
									? obterCorRepresentada(rep)
									: ("indigo" as const);
								const dataCurta = pedido.data_emissao.slice(0, 10);
								const codigoCurto = `#${pedido.id.slice(0, 8).toUpperCase()}`;
								const rascunho = pedido.status === "rascunho";

								return (
									<tr
										key={pedido.id}
										className="group transition-colors hover:bg-muted/50"
									>
										<td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
											<div className="flex flex-col">
												<Link
													to={`/pedidos/${pedido.id}`}
													className="font-mono text-xs font-medium text-foreground hover:text-primary"
												>
													{codigoCurto}
												</Link>
												<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
													{formatarDataBr(dataCurta)}
												</span>
											</div>
										</td>

										<td className="px-3 py-2.5 align-middle">
											<div className="flex flex-col gap-0.5">
												<Link
													to={`/pedidos/${pedido.id}`}
													className="font-medium text-foreground hover:text-primary"
												>
													{nomeCliente}
												</Link>
												<div className="md:hidden">
													<RepresentadaBadge nome={nomeRep} cor={corRep} />
												</div>
											</div>
										</td>

										<td className="hidden px-3 py-2.5 align-middle whitespace-nowrap md:table-cell">
											<RepresentadaBadge nome={nomeRep} cor={corRep} />
										</td>

										<td className="hidden px-3 py-2.5 align-middle text-xs text-muted-foreground whitespace-nowrap lg:table-cell">
											<div className="flex items-center gap-1.5">
												<span className="truncate">
													{pedido.condicao_pagamento}
												</span>
												<span
													title={ROTULOS_FRETE[pedido.tipo_frete]}
													className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[10px]"
												>
													{pedido.tipo_frete}
												</span>
											</div>
										</td>

										<td className="px-3 py-2.5 align-middle whitespace-nowrap">
											<Badge variant={varianteBadgeStatus(pedido.status)}>
												{ROTULOS_STATUS_PEDIDO[pedido.status]}
											</Badge>
										</td>

										<td className="px-3 py-2.5 text-right align-middle whitespace-nowrap">
											<div className="flex flex-col items-end">
												<span className="font-mono text-sm font-semibold text-foreground tabular-nums">
													{formatarCentavos(pedido.valor_total_centavos)}
												</span>
												<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
													Com.{" "}
													{formatarCentavos(pedido.comissao_projetada_centavos)}
												</span>
											</div>
										</td>

										<td className="px-3.5 py-2.5 text-right align-middle whitespace-nowrap">
											<div className="inline-flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="sm"
													disabled={gerandoPdfId === pedido.id}
													onClick={() => void handleBaixarPdf(pedido.id)}
													title="Baixar espelho do pedido em PDF"
												>
													<Download aria-hidden="true" className="size-3.5" />
													<span className="hidden sm:inline">
														{gerandoPdfId === pedido.id ? "..." : "PDF"}
													</span>
												</Button>
												<Link
													to={`/pedidos/${pedido.id}`}
													className={buttonClassName({
														variant: rascunho ? "primary" : "secondary",
														size: "sm",
													})}
												>
													{rascunho ? "Continuar" : "Abrir"}
												</Link>
												{rascunho && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleExcluirRascunho(pedido)}
														title="Excluir rascunho"
														aria-label={`Excluir rascunho ${codigoCurto}`}
														className="px-2 text-subtle-foreground hover:text-destructive"
													>
														<Trash2 aria-hidden="true" className="size-3.5" />
													</Button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</section>
			)}
		</Page>
	);
}
