import {
	ArrowDown,
	ArrowUp,
	FileText,
	Layers,
	Plus,
	Repeat,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Badge,
	buttonClassName,
	CartaoLista,
	CartaoListaAcoes,
	CartaoListaTopo,
	EmptyState,
	FormField,
	Input,
	ListaCards,
	ListaResponsiva,
	ListaTabela,
	PageHeader,
	RepresentadaBadge,
	Select,
} from "../../../shared/components/ui";
import { formatarDataBr } from "../../../shared/domain/datas";
import { formatarCentavos } from "../../../shared/domain/decimal-br";
import { ClienteTabs } from "../../clientes/components/cliente-tabs";
import { useCliente } from "../../clientes/hooks/use-clientes";
import { obterCorRepresentada } from "../../representadas/domain/representada";
import type { Representada } from "../../representadas/domain/representada.schema";
import { useTodasRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	CriterioOrdenacaoHistoricoSchema,
	FILTROS_HISTORICO_PADRAO,
	type FiltrosHistorico,
	FiltrosHistoricoSchema,
	filtrarHistorico,
	ORDENACAO_HISTORICO_PADRAO,
	type OrdenacaoHistorico,
	ordenarHistorico,
	ROTULOS_CRITERIO_HISTORICO,
	resumirHistoricoCliente,
} from "../domain/historico-cliente";
import {
	ROTULOS_STATUS_PEDIDO,
	STATUS_PEDIDO,
	type StatusPedido,
	StatusPedidoSchema,
} from "../domain/pedido.schema";
import { usePedidosDoCliente } from "../hooks/use-pedidos";

function varianteBadgeStatus(status: StatusPedido) {
	if (status === "rascunho") return "secondary" as const;
	if (status === "cancelado") return "destructive" as const;
	return "success" as const;
}

/** Aba "Pedidos" do cliente: histórico com ordenação, filtros e resumo. */
export function HistoricoClienteView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { dados, isLoading: carregandoCliente } = useCliente(
		config.id,
		id,
		true,
	);
	const { pedidos, isLoading: carregandoPedidos } = usePedidosDoCliente(
		config.id,
		id,
	);
	const { representadas, isLoading: carregandoRepresentadas } =
		useTodasRepresentadas(config.id);

	const [ordenacao, setOrdenacao] = useState<OrdenacaoHistorico>(
		ORDENACAO_HISTORICO_PADRAO,
	);
	const [filtros, setFiltros] = useState<FiltrosHistorico>(
		FILTROS_HISTORICO_PADRAO,
	);

	const representadasPorId = useMemo(
		() => new Map<string, Representada>(representadas.map((r) => [r.id, r])),
		[representadas],
	);

	// Só as fábricas que aparecem no histórico do cliente
	const representadasDoHistorico = useMemo(() => {
		const ids = new Set(pedidos.map((p) => p.representada_id));
		return representadas.filter((r) => ids.has(r.id));
	}, [pedidos, representadas]);

	const fabricasPorCotacao = useMemo(() => {
		const mapa = new Map<string, number>();
		for (const p of pedidos) {
			if (p.cotacao_grupo_id) {
				mapa.set(p.cotacao_grupo_id, (mapa.get(p.cotacao_grupo_id) ?? 0) + 1);
			}
		}
		return mapa;
	}, [pedidos]);

	const resumo = useMemo(() => resumirHistoricoCliente(pedidos), [pedidos]);
	const periodoInvalido = !FiltrosHistoricoSchema.safeParse(filtros).success;

	const visiveis = useMemo(
		() =>
			ordenarHistorico(
				filtrarHistorico(pedidos, filtros),
				ordenacao,
				(repId) => representadasPorId.get(repId)?.nome_fantasia ?? "",
			),
		[pedidos, filtros, ordenacao, representadasPorId],
	);

	if (carregandoCliente || carregandoPedidos || carregandoRepresentadas) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando histórico do cliente...
			</p>
		);
	}

	if (!id || !dados) {
		return (
			<Page width="narrow">
				<p className="text-foreground">Cliente não encontrado.</p>
				<Link to="/clientes" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</Page>
		);
	}

	const { cliente } = dados;
	const filtrosAtivos =
		JSON.stringify(filtros) !== JSON.stringify(FILTROS_HISTORICO_PADRAO);

	return (
		<Page width="form">
			<PageHeader
				title={cliente.razao_social}
				description="Histórico de orçamentos e pedidos do cliente"
				back={{ to: "/clientes", label: "Clientes" }}
				action={
					cliente.ativo && (
						<Link
							to={`/pedidos/novo?clienteId=${cliente.id}`}
							className={buttonClassName({ size: "sm" })}
						>
							<Plus aria-hidden="true" />
							Novo orçamento
						</Link>
					)
				}
			/>

			<ClienteTabs clienteId={cliente.id} />

			<dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
				<Indicador rotulo="Pedidos" valor={String(resumo.quantidade_pedidos)} />
				<Indicador
					rotulo="Valor total"
					valor={formatarCentavos(resumo.valor_total_centavos)}
				/>
				<Indicador
					rotulo="Ticket médio"
					valor={formatarCentavos(resumo.ticket_medio_centavos)}
				/>
				<Indicador
					rotulo="Última compra"
					valor={
						resumo.data_ultima_compra
							? formatarDataBr(resumo.data_ultima_compra)
							: "—"
					}
				/>
			</dl>
			<p className="-mt-3 text-xs text-muted-foreground">
				O resumo conta apenas pedidos emitidos ou faturados (sem orçamentos e
				cancelados).
			</p>

			{pedidos.length > 0 && (
				<fieldset className="m-0 grid grid-cols-2 gap-2.5 rounded-xl border border-border bg-card p-3 sm:grid-cols-3">
					<legend className="sr-only">Ordenação e filtros</legend>
					<FormField id="historico-ordenar" label="Ordenar por">
						<div className="flex gap-1.5">
							<Select
								id="historico-ordenar"
								value={ordenacao.criterio}
								onChange={(e) => {
									const criterio = CriterioOrdenacaoHistoricoSchema.safeParse(
										e.target.value,
									);
									if (criterio.success) {
										setOrdenacao((o) => ({ ...o, criterio: criterio.data }));
									}
								}}
							>
								{CriterioOrdenacaoHistoricoSchema.options.map((c) => (
									<option key={c} value={c}>
										{ROTULOS_CRITERIO_HISTORICO[c]}
									</option>
								))}
							</Select>
							<button
								type="button"
								onClick={() =>
									setOrdenacao((o) => ({
										...o,
										direcao: o.direcao === "desc" ? "asc" : "desc",
									}))
								}
								title={
									ordenacao.direcao === "desc"
										? "Decrescente (clique para crescente)"
										: "Crescente (clique para decrescente)"
								}
								aria-label={
									ordenacao.direcao === "desc"
										? "Ordem decrescente"
										: "Ordem crescente"
								}
								className={buttonClassName({
									variant: "secondary",
									className: "h-9 px-2.5",
								})}
							>
								{ordenacao.direcao === "desc" ? (
									<ArrowDown aria-hidden="true" />
								) : (
									<ArrowUp aria-hidden="true" />
								)}
							</button>
						</div>
					</FormField>

					<FormField id="historico-representada" label="Representada">
						<Select
							id="historico-representada"
							value={filtros.representada_id ?? ""}
							onChange={(e) =>
								setFiltros((f) => ({
									...f,
									representada_id: e.target.value || null,
								}))
							}
						>
							<option value="">Todas</option>
							{representadasDoHistorico.map((r) => (
								<option key={r.id} value={r.id}>
									{r.nome_fantasia}
								</option>
							))}
						</Select>
					</FormField>

					<FormField id="historico-status" label="Status">
						<Select
							id="historico-status"
							value={filtros.status ?? ""}
							onChange={(e) => {
								const status = StatusPedidoSchema.safeParse(e.target.value);
								setFiltros((f) => ({
									...f,
									status: status.success ? status.data : null,
								}));
							}}
						>
							<option value="">Todos</option>
							{STATUS_PEDIDO.map((s) => (
								<option key={s} value={s}>
									{ROTULOS_STATUS_PEDIDO[s]}
								</option>
							))}
						</Select>
					</FormField>

					<FormField
						id="historico-de"
						label="De"
						error={periodoInvalido ? "Período inválido" : undefined}
					>
						<Input
							id="historico-de"
							type="date"
							value={filtros.data_inicio ?? ""}
							onChange={(e) =>
								setFiltros((f) => ({
									...f,
									data_inicio: e.target.value || null,
								}))
							}
						/>
					</FormField>

					<FormField id="historico-ate" label="Até">
						<Input
							id="historico-ate"
							type="date"
							value={filtros.data_fim ?? ""}
							onChange={(e) =>
								setFiltros((f) => ({ ...f, data_fim: e.target.value || null }))
							}
						/>
					</FormField>

					<div className="flex flex-col justify-end gap-1.5">
						<label className="inline-flex h-9 cursor-pointer items-center gap-2 text-sm text-foreground">
							<input
								type="checkbox"
								checked={!filtros.incluir_rascunhos}
								onChange={(e) =>
									setFiltros((f) => ({
										...f,
										incluir_rascunhos: !e.target.checked,
									}))
								}
								className="size-4 accent-primary"
							/>
							Esconder orçamentos
						</label>
					</div>
				</fieldset>
			)}

			{pedidos.length === 0 ? (
				<EmptyState
					icon={FileText}
					title="Nenhum orçamento ou pedido para este cliente ainda."
					description="Os orçamentos e pedidos do cliente aparecem aqui, do mais recente para o mais antigo."
					action={
						cliente.ativo ? (
							<Link
								to={`/pedidos/novo?clienteId=${cliente.id}`}
								className={buttonClassName()}
							>
								<Plus aria-hidden="true" />
								Novo orçamento
							</Link>
						) : undefined
					}
				/>
			) : visiveis.length === 0 ? (
				<EmptyState
					icon={FileText}
					title="Nenhum pedido encontrado para os filtros atuais."
					action={
						filtrosAtivos ? (
							<button
								type="button"
								onClick={() => setFiltros(FILTROS_HISTORICO_PADRAO)}
								className={buttonClassName({ variant: "secondary" })}
							>
								Limpar filtros
							</button>
						) : undefined
					}
				/>
			) : (
				<ListaResponsiva>
					<ListaCards rotulo="Histórico de pedidos do cliente">
						{visiveis.map((pedido) => {
							const rep = representadasPorId.get(pedido.representada_id);
							const codigo = `#${pedido.id.slice(0, 8).toUpperCase()}`;
							const fabricas = pedido.cotacao_grupo_id
								? (fabricasPorCotacao.get(pedido.cotacao_grupo_id) ?? 0)
								: 0;
							return (
								<CartaoLista key={pedido.id}>
									<CartaoListaTopo
										titulo={
											<RepresentadaBadge
												nome={
													rep?.nome_fantasia ?? "Representada não encontrada"
												}
												cor={rep ? obterCorRepresentada(rep) : "indigo"}
											/>
										}
										destaque={
											<span className="font-mono text-sm font-semibold text-foreground tabular-nums">
												{formatarCentavos(pedido.valor_total_centavos)}
											</span>
										}
									/>
									<div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground tabular-nums">
										<span>
											{formatarDataBr(pedido.data_emissao.slice(0, 10))}
										</span>
										<span aria-hidden="true">·</span>
										<span>{codigo}</span>
										{fabricas > 1 && (
											<span className="inline-flex items-center gap-1 rounded border border-border bg-muted/60 px-1 py-0.5 font-sans text-[10px]">
												<Layers aria-hidden="true" className="size-3" />
												Cotação · {fabricas} fáb.
											</span>
										)}
										<span className="ml-auto font-sans">
											<Badge variant={varianteBadgeStatus(pedido.status)}>
												{ROTULOS_STATUS_PEDIDO[pedido.status]}
											</Badge>
										</span>
									</div>
									<CartaoListaAcoes>
										<Link
											to={`/pedidos/${pedido.id}`}
											className={buttonClassName({
												variant: "secondary",
												size: "sm",
												className: "flex-1",
											})}
										>
											Abrir
										</Link>
										{cliente.ativo && (
											<Link
												to={`/pedidos/novo?repetir=${pedido.id}`}
												title="Novo orçamento com os mesmos itens, usando os preços da tabela vigente"
												className={buttonClassName({
													variant: "secondary",
													size: "sm",
												})}
											>
												<Repeat aria-hidden="true" />
												Repetir
											</Link>
										)}
									</CartaoListaAcoes>
								</CartaoLista>
							);
						})}
					</ListaCards>
					<ListaTabela rotulo="Histórico de pedidos do cliente">
						<table className="text-left text-sm">
							<thead>
								<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
									<th className="px-3.5 py-2.5">Data / Nº</th>
									<th className="px-3 py-2.5">Representada</th>
									<th className="px-3 py-2.5">Status</th>
									<th className="px-3 py-2.5 text-right">Valor</th>
									<th className="px-3.5 py-2.5 text-right">
										<span className="sr-only">Ações</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{visiveis.map((pedido) => {
									const rep = representadasPorId.get(pedido.representada_id);
									const codigo = `#${pedido.id.slice(0, 8).toUpperCase()}`;
									const fabricas = pedido.cotacao_grupo_id
										? (fabricasPorCotacao.get(pedido.cotacao_grupo_id) ?? 0)
										: 0;
									return (
										<tr
											key={pedido.id}
											className="transition-colors hover:bg-muted/50"
										>
											<td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
												<div className="flex flex-col">
													<span className="font-mono text-xs text-foreground tabular-nums">
														{formatarDataBr(pedido.data_emissao.slice(0, 10))}
													</span>
													<Link
														to={`/pedidos/${pedido.id}`}
														className="font-mono text-[11px] text-muted-foreground hover:text-primary"
													>
														{codigo}
													</Link>
													{fabricas > 1 && (
														<span
															title={`Cotação com ${fabricas} fábricas`}
															className="mt-0.5 inline-flex w-fit items-center gap-1 rounded border border-border bg-muted/60 px-1 py-0.5 text-[10px] text-muted-foreground"
														>
															<Layers aria-hidden="true" className="size-3" />
															Cotação · {fabricas} fáb.
														</span>
													)}
												</div>
											</td>
											<td className="px-3 py-2.5 align-middle">
												<RepresentadaBadge
													nome={
														rep?.nome_fantasia ?? "Representada não encontrada"
													}
													cor={rep ? obterCorRepresentada(rep) : "indigo"}
												/>
											</td>
											<td className="px-3 py-2.5 align-middle whitespace-nowrap">
												<Badge variant={varianteBadgeStatus(pedido.status)}>
													{ROTULOS_STATUS_PEDIDO[pedido.status]}
												</Badge>
											</td>
											<td className="px-3 py-2.5 text-right align-middle font-mono text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
												{formatarCentavos(pedido.valor_total_centavos)}
											</td>
											<td className="px-3.5 py-2.5 text-right align-middle whitespace-nowrap">
												<div className="inline-flex items-center justify-end gap-1">
													{cliente.ativo && (
														<Link
															to={`/pedidos/novo?repetir=${pedido.id}`}
															title="Novo orçamento com os mesmos itens, usando os preços da tabela vigente"
															aria-label={`Repetir pedido ${codigo}`}
															className={buttonClassName({
																variant: "ghost",
																size: "sm",
															})}
														>
															<Repeat aria-hidden="true" className="size-3.5" />
															<span className="hidden sm:inline">Repetir</span>
														</Link>
													)}
													<Link
														to={`/pedidos/${pedido.id}`}
														className={buttonClassName({
															variant: "secondary",
															size: "sm",
														})}
													>
														Abrir
													</Link>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</ListaTabela>
				</ListaResponsiva>
			)}
		</Page>
	);
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
	return (
		<div className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-3.5 py-2.5">
			<dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
				{rotulo}
			</dt>
			<dd className="m-0 font-mono text-base font-semibold text-foreground tabular-nums">
				{valor}
			</dd>
		</div>
	);
}
