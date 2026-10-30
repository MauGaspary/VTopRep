import {
	Archive,
	Factory,
	FilePlus2,
	Package,
	Plus,
	RotateCcw,
	Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	EmptyState,
	ESTILOS_COR_REPRESENTADA,
	PageHeader,
	RepresentadaDot,
	SearchInput,
	Select,
} from "../../../shared/components/ui";
import { dataLocal } from "../../../shared/domain/datas";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE } from "../../../shared/domain/frete";
import {
	formatarResumoComissaoRepresentada,
	obterCorRepresentada,
} from "../../representadas/domain/representada";
import { useRepresentadas } from "../../representadas/hooks/use-representadas";
import type { Produto } from "../domain/produto.schema";
import { descreverVigencia } from "../domain/tabela-preco";
import {
	usePrecosCatalogo,
	usePrecosDaTabela,
	useTabelasDisponiveisPorRepresentada,
} from "../hooks/use-precos";
import { useProdutoActions, useTodosProdutos } from "../hooks/use-produtos";

export interface CatalogoViewProps {
	tenantId?: string;
}

export function CatalogoView({
	tenantId: tenantIdProp,
}: CatalogoViewProps = {}) {
	const { config } = useTenant();
	const tenantId = tenantIdProp ?? config.id;
	const [searchParams, setSearchParams] = useSearchParams();
	const [termoBusca, setTermoBusca] = useState("");
	const [mostrarInativos, setMostrarInativos] = useState(false);
	const [tabelaSelecionadaId, setTabelaSelecionadaId] = useState<string>("");
	const [erro, setErro] = useState<string | null>(null);
	const hoje = useMemo(() => dataLocal(new Date()), []);

	const { representadas, isLoading: carregandoRep } =
		useRepresentadas(tenantId);
	const { produtos: todosProdutos, isLoading: carregandoProd } =
		useTodosProdutos(tenantId);
	const { precosPorProduto: precosAutomaticos } = usePrecosCatalogo(
		tenantId,
		hoje,
	);
	const { tabelasPorRepresentada } =
		useTabelasDisponiveisPorRepresentada(tenantId);
	const { precosPorProduto: precosTabelaEspecifica } = usePrecosDaTabela(
		tenantId,
		tabelaSelecionadaId || undefined,
		hoje,
	);
	const { inativar, reativar } = useProdutoActions(tenantId);

	const isLoading = carregandoRep || carregandoProd;

	const paramRepId = searchParams.get("representada");
	const representadaAtiva = useMemo(() => {
		if (representadas.length === 0) return undefined;
		if (paramRepId) {
			const encontrada = representadas.find((r) => r.id === paramRepId);
			if (encontrada) return encontrada;
		}
		return representadas[0];
	}, [representadas, paramRepId]);

	const selecionarRepresentada = (repId: string) => {
		setSearchParams({ representada: repId }, { replace: true });
		setTabelaSelecionadaId("");
	};

	const contagemPorRepresentada = useMemo(() => {
		const mapa = new Map<string, number>();
		for (const p of todosProdutos) {
			if (!mostrarInativos && !p.ativo) continue;
			mapa.set(p.representada_id, (mapa.get(p.representada_id) ?? 0) + 1);
		}
		return mapa;
	}, [todosProdutos, mostrarInativos]);

	const tabelasDaRepresentadaAtiva = useMemo(() => {
		if (!representadaAtiva) return [];
		return tabelasPorRepresentada.get(representadaAtiva.id) ?? [];
	}, [representadaAtiva, tabelasPorRepresentada]);

	const tabelaEspecificaValida = tabelasDaRepresentadaAtiva.some(
		(t) => t.id === tabelaSelecionadaId,
	)
		? tabelaSelecionadaId
		: "";

	const produtosDaRepresentada = useMemo(() => {
		if (!representadaAtiva) return [];
		const termo = termoBusca.trim().toLowerCase();
		return todosProdutos.filter((p) => {
			if (p.representada_id !== representadaAtiva.id) return false;
			if (!mostrarInativos && !p.ativo) return false;
			if (!termo) return true;
			return (
				p.sku.toLowerCase().includes(termo) ||
				p.descricao.toLowerCase().includes(termo)
			);
		});
	}, [todosProdutos, representadaAtiva, mostrarInativos, termoBusca]);

	const handleInativar = async (produto: Produto) => {
		const confirmado = window.confirm(
			`Inativar o produto "${produto.sku} - ${produto.descricao}"? Ele não aparecerá para novos pedidos.`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(produto.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao inativar produto"));
		}
	};

	const handleReativar = async (produto: Produto) => {
		setErro(null);
		try {
			await reativar(produto.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao reativar produto"));
		}
	};

	return (
		<Page width="full">
			<PageHeader
				title="Catálogo de Produtos"
				description="Navegue por representada para consultar SKUs, embalagens e tabelas de preço."
				action={
					representadaAtiva ? (
						<div className="flex items-center gap-2">
							<Link
								to={`/pedidos/novo?representada=${representadaAtiva.id}`}
								className={buttonClassName({ variant: "secondary" })}
							>
								<FilePlus2 aria-hidden="true" />
								Orçar fábrica
							</Link>
							<Link
								to={`/produtos/novo?representada=${representadaAtiva.id}`}
								className={buttonClassName()}
							>
								<Plus aria-hidden="true" />
								Novo produto
							</Link>
						</div>
					) : undefined
				}
			/>

			{erro && <Alert variant="destructive">{erro}</Alert>}

			{isLoading && (
				<p className="py-8 text-center text-muted-foreground">
					Carregando catálogo...
				</p>
			)}

			{!isLoading && representadas.length === 0 && (
				<EmptyState
					icon={Factory}
					title="Nenhuma representada ativa cadastrada"
					description="Cadastre primeiro suas representadas (fábricas) para organizar os produtos e tabelas de preço de cada uma."
					action={
						<Link to="/representadas/nova" className={buttonClassName()}>
							<Plus aria-hidden="true" />
							Cadastrar representada
						</Link>
					}
				/>
			)}

			{!isLoading && representadas.length > 0 && representadaAtiva && (
				<div className="flex flex-col gap-4 md:grid md:grid-cols-[232px_minmax(0,1fr)] md:items-start md:gap-5">
					{/* Mobile: Pílulas horizontais de Representadas */}
					<nav
						aria-label="Representadas no catálogo (mobile)"
						className="flex gap-1.5 overflow-x-auto pb-1 md:hidden"
					>
						{representadas.map((rep) => {
							const ativa = rep.id === representadaAtiva.id;
							const cor = obterCorRepresentada(rep);
							const qtd = contagemPorRepresentada.get(rep.id) ?? 0;
							return (
								<button
									key={rep.id}
									type="button"
									onClick={() => selecionarRepresentada(rep.id)}
									aria-current={ativa ? "true" : undefined}
									className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
										ativa
											? "border-foreground/20 bg-card text-foreground shadow-2xs"
											: "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
									}`}
								>
									<RepresentadaDot cor={cor} size="sm" />
									<span className="max-w-36 truncate">{rep.nome_fantasia}</span>
									<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
										{qtd}
									</span>
								</button>
							);
						})}
					</nav>

					{/* Desktop: Sub-painel lateral de Representadas */}
					<aside
						aria-label="Sub-menu de representadas"
						className="hidden flex-col rounded-xl border border-border bg-card md:flex"
					>
						<div className="flex items-center justify-between border-b border-border px-3 py-2.5">
							<span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
								Representadas
							</span>
							<span className="font-mono text-[11px] text-subtle-foreground tabular-nums">
								{representadas.length}
							</span>
						</div>

						<ul className="flex flex-col gap-0.5 p-1.5">
							{representadas.map((rep) => {
								const ativa = rep.id === representadaAtiva.id;
								const cor = obterCorRepresentada(rep);
								const estiloCor = ESTILOS_COR_REPRESENTADA[cor];
								const qtd = contagemPorRepresentada.get(rep.id) ?? 0;

								return (
									<li key={rep.id}>
										<button
											type="button"
											onClick={() => selecionarRepresentada(rep.id)}
											aria-current={ativa ? "true" : undefined}
											className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-l-2 px-2.5 py-2 text-left text-[13px] transition-colors ${
												ativa
													? `${estiloCor.activeAccent} bg-secondary font-medium text-foreground`
													: "border-l-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
											}`}
										>
											<span className="flex min-w-0 items-center gap-2">
												<RepresentadaDot cor={cor} size="sm" />
												<span className="truncate">{rep.nome_fantasia}</span>
											</span>
											<span
												className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
													ativa
														? "bg-background text-foreground"
														: "text-subtle-foreground"
												}`}
											>
												{qtd}
											</span>
										</button>
									</li>
								);
							})}
						</ul>

						<div className="mt-1 flex items-center justify-between border-t border-border px-3 py-2 text-xs">
							<Link
								to="/representadas/nova"
								className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
							>
								<Plus aria-hidden="true" className="size-3.5" />
								Nova fábrica
							</Link>
							<Link
								to="/representadas"
								className="text-subtle-foreground transition-colors hover:text-foreground"
							>
								Ver todas
							</Link>
						</div>
					</aside>

					{/* Painel Principal: Produtos da Representada Selecionada */}
					<div className="workspace-pane flex min-w-0 flex-col gap-3">
						{/* Faixa de Contexto da Representada */}
						<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex min-w-0 items-start gap-2.5">
								<RepresentadaDot
									cor={obterCorRepresentada(representadaAtiva)}
									className="mt-1.5"
								/>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<h2 className="truncate text-base font-semibold text-foreground">
											{representadaAtiva.nome_fantasia}
										</h2>
										<span className="hidden text-xs text-muted-foreground sm:inline">
											· {representadaAtiva.razao_social}
										</span>
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
										<span
											title={
												ROTULOS_FRETE[representadaAtiva.regras_frete_padrao]
											}
											className="inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px]"
										>
											Frete{" "}
											{representadaAtiva.regras_frete_padrao.replace("_", " ")}
										</span>
										<span className="font-mono text-[11px] tabular-nums">
											Comissão{" "}
											<strong className="font-medium text-foreground">
												{formatarResumoComissaoRepresentada(representadaAtiva)}
											</strong>
										</span>
										{representadaAtiva.valor_pedido_minimo_centavos > 0 && (
											<span className="font-mono text-[11px] tabular-nums">
												Ped. mín.{" "}
												<strong className="font-medium text-foreground">
													{formatarCentavos(
														representadaAtiva.valor_pedido_minimo_centavos,
													)}
												</strong>
											</span>
										)}
									</div>
								</div>
							</div>

							<div className="flex shrink-0 items-center gap-2">
								<Link
									to={`/representadas/${representadaAtiva.id}/editar`}
									className={buttonClassName({
										variant: "ghost",
										size: "sm",
									})}
								>
									<Settings2 aria-hidden="true" className="size-3.5" />
									Tabelas e regras
								</Link>
							</div>
						</div>

						{/* Barra de Filtro + Seletor de Tabela de Preço */}
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<SearchInput
								id="busca-catalogo"
								label="Buscar produto por SKU ou descrição"
								placeholder={`Buscar em ${representadaAtiva.nome_fantasia} por SKU ou descrição...`}
								value={termoBusca}
								onChange={setTermoBusca}
								className="flex-1"
							/>

							<div className="flex flex-wrap items-center gap-2">
								{tabelasDaRepresentadaAtiva.length > 0 && (
									<div className="w-full sm:w-56">
										<Select
											id="tabela-catalogo"
											aria-label="Tabela de preço para exibição"
											value={tabelaEspecificaValida}
											onChange={(e) => setTabelaSelecionadaId(e.target.value)}
										>
											<option value="">Preço vigente (automático)</option>
											{tabelasDaRepresentadaAtiva.map((tab) => (
												<option key={tab.id} value={tab.id}>
													{tab.nome_tabela} ({descreverVigencia(tab)})
												</option>
											))}
										</Select>
									</div>
								)}

								<label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground select-none hover:bg-muted">
									<input
										type="checkbox"
										checked={mostrarInativos}
										onChange={(e) => setMostrarInativos(e.target.checked)}
										className="size-3.5 accent-primary"
									/>
									Inativos
								</label>
							</div>
						</div>

						{/* Lista Densa de Produtos da Representada */}
						{produtosDaRepresentada.length === 0 ? (
							<EmptyState
								icon={Package}
								title={
									termoBusca
										? `Nenhum produto encontrado em ${representadaAtiva.nome_fantasia}.`
										: `Nenhum produto cadastrado para ${representadaAtiva.nome_fantasia}.`
								}
								description={
									termoBusca
										? "Tente buscar por outro SKU ou limpe o filtro."
										: "Adicione o primeiro item desta representada para começar a orçar."
								}
								action={
									!termoBusca ? (
										<Link
											to={`/produtos/novo?representada=${representadaAtiva.id}`}
											className={buttonClassName({ size: "sm" })}
										>
											<Plus aria-hidden="true" />
											Cadastrar produto em {representadaAtiva.nome_fantasia}
										</Link>
									) : undefined
								}
							/>
						) : (
							<section
								aria-label={`Produtos de ${representadaAtiva.nome_fantasia}`}
								className="dense-table-region rounded-xl border border-border bg-card"
							>
								<table className="text-left text-sm">
									<thead>
										<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
											<th className="w-28 px-3.5 py-2.5">SKU</th>
											<th className="px-3 py-2.5">Produto</th>
											<th className="hidden px-3 py-2.5 sm:table-cell">
												Embalagem
											</th>
											<th className="hidden px-3 py-2.5 text-right lg:table-cell">
												Desc. Máx.
											</th>
											<th className="px-3 py-2.5 text-right">Preço Base</th>
											<th className="w-28 px-3.5 py-2.5 text-right">Ações</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{produtosDaRepresentada.map((produto) => {
											const isInativo = !produto.ativo;
											const precoEspecifico = tabelaEspecificaValida
												? precosTabelaEspecifica.get(produto.id)
												: undefined;
											const precoAuto = precosAutomaticos.get(produto.id);

											const precoExibido = tabelaEspecificaValida
												? precoEspecifico?.preco_base_centavos
												: precoAuto?.preco_base_centavos;
											const descontoMaxExibido = tabelaEspecificaValida
												? precoEspecifico?.desconto_maximo_permitido
												: precoAuto?.desconto_maximo_permitido;
											const nomeTabelaSubtitulo = tabelaEspecificaValida
												? undefined
												: precoAuto?.nome_tabela;

											return (
												<tr
													key={produto.id}
													className={`group transition-colors hover:bg-muted/50 ${
														isInativo ? "bg-muted/25 opacity-65" : ""
													}`}
												>
													<td className="px-3.5 py-2.5 align-middle whitespace-nowrap">
														<span className="inline-flex items-center rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
															{produto.sku}
														</span>
													</td>

													<td className="px-3 py-2.5 align-middle">
														<div className="flex flex-wrap items-center gap-2">
															<Link
																to={`/produtos/${produto.id}/editar?representada=${representadaAtiva.id}`}
																className="font-medium text-foreground hover:text-primary"
															>
																{produto.descricao}
															</Link>
															{isInativo && (
																<Badge variant="secondary">Inativo</Badge>
															)}
														</div>
														<div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
															<span>{produto.unidade_medida}</span>
															{produto.multiplo_embalagem > 1 && (
																<span>
																	· Múlt. {produto.multiplo_embalagem}
																</span>
															)}
														</div>
													</td>

													<td className="hidden px-3 py-2.5 align-middle whitespace-nowrap sm:table-cell">
														<span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground tabular-nums">
															<strong className="font-medium text-foreground">
																{produto.unidade_medida}
															</strong>
															{produto.multiplo_embalagem > 1 && (
																<span>× {produto.multiplo_embalagem}</span>
															)}
														</span>
													</td>

													<td className="hidden px-3 py-2.5 text-right align-middle font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap lg:table-cell">
														{descontoMaxExibido !== undefined &&
														descontoMaxExibido > 0
															? `até ${formatarCentesimosPercentual(descontoMaxExibido)}`
															: "—"}
													</td>

													<td className="px-3 py-2.5 text-right align-middle whitespace-nowrap">
														{precoExibido !== undefined ? (
															<div className="flex flex-col items-end">
																<span className="font-mono text-sm font-semibold text-foreground tabular-nums">
																	{formatarCentavos(precoExibido)}
																</span>
																{nomeTabelaSubtitulo && (
																	<span className="max-w-36 truncate text-[11px] text-subtle-foreground">
																		{nomeTabelaSubtitulo}
																	</span>
																)}
															</div>
														) : (
															<Badge variant="secondary">Sem preço</Badge>
														)}
													</td>

													<td className="px-3.5 py-2.5 text-right align-middle whitespace-nowrap">
														<div className="inline-flex items-center justify-end gap-1">
															<Link
																to={`/produtos/${produto.id}/editar?representada=${representadaAtiva.id}`}
																className={buttonClassName({
																	variant: "secondary",
																	size: "sm",
																})}
															>
																Editar
															</Link>
															{isInativo ? (
																<Button
																	variant="secondary"
																	size="sm"
																	onClick={() => handleReativar(produto)}
																	title="Reativar produto"
																>
																	<RotateCcw
																		aria-hidden="true"
																		className="size-3.5"
																	/>
																	Reativar
																</Button>
															) : (
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() => handleInativar(produto)}
																	title="Inativar produto"
																	aria-label={`Inativar ${produto.sku}`}
																	className="px-2 text-subtle-foreground hover:text-destructive"
																>
																	<Archive
																		aria-hidden="true"
																		className="size-3.5"
																	/>
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
					</div>
				</div>
			)}
		</Page>
	);
}
