import { Archive, Factory, Package, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
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
	RepresentadaDot,
	SearchInput,
} from "../../../shared/components/ui";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE } from "../../../shared/domain/frete";
import { obterCorRepresentada } from "../domain/representada";
import type { Representada } from "../domain/representada.schema";
import {
	useRepresentadaActions,
	useTodasRepresentadas,
} from "../hooks/use-representadas";

export function RepresentadasListView() {
	const { config } = useTenant();
	const [termoBusca, setTermoBusca] = useState("");
	const [mostrarInativas, setMostrarInativas] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const { representadas: todasRepresentadas, isLoading } =
		useTodasRepresentadas(config.id, termoBusca);
	const { inativar, reativar } = useRepresentadaActions(config.id);

	const representadas = mostrarInativas
		? todasRepresentadas
		: todasRepresentadas.filter((r) => r.ativo);

	const handleInativar = async (representada: Representada) => {
		const confirmado = window.confirm(
			`Inativar a representada "${representada.nome_fantasia}"? Ela não estará disponível para novos orçamentos.`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(representada.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao inativar representada"));
		}
	};

	const handleReativar = async (representada: Representada) => {
		setErro(null);
		try {
			await reativar(representada.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao reativar representada"));
		}
	};

	return (
		<Page>
			<PageHeader
				title="Representadas"
				description="Fábricas representadas, regras comerciais e tabelas de preço."
				action={
					<Link to="/representadas/nova" className={buttonClassName()}>
						<Plus aria-hidden="true" />
						Nova representada
					</Link>
				}
			/>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<SearchInput
					id="busca-representadas"
					placeholder="Filtrar por nome fantasia, razão social ou CNPJ..."
					value={termoBusca}
					onChange={setTermoBusca}
					className="flex-1"
				/>

				<div className="flex items-center justify-between gap-3 sm:justify-end">
					<span className="text-xs text-muted-foreground tabular-nums">
						{representadas.length}{" "}
						{representadas.length === 1 ? "fábrica" : "fábricas"}
					</span>
					<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground select-none hover:bg-muted">
						<input
							type="checkbox"
							checked={mostrarInativas}
							onChange={(e) => setMostrarInativas(e.target.checked)}
							className="size-3.5 accent-primary"
						/>
						Mostrar inativas
					</label>
				</div>
			</div>

			{erro && <Alert variant="destructive">{erro}</Alert>}

			{isLoading && (
				<p className="py-6 text-center text-muted-foreground">Carregando...</p>
			)}

			{!isLoading && representadas.length === 0 && (
				<EmptyState
					icon={Factory}
					title={
						termoBusca
							? "Nenhuma representada encontrada para a busca."
							: "Nenhuma representada cadastrada ainda."
					}
					description="Cadastre suas representadas para organizar o catálogo e as tabelas de preço."
				/>
			)}

			{!isLoading && representadas.length > 0 && (
				<section
					aria-label="Lista de representadas"
					className="dense-table-region rounded-xl border border-border bg-card"
				>
					<table className="text-left text-sm">
						<thead>
							<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
								<th className="px-3.5 py-2.5">Fábrica</th>
								<th className="hidden px-3 py-2.5 md:table-cell">CNPJ</th>
								<th className="px-3 py-2.5 text-right">Comissão</th>
								<th className="hidden px-3 py-2.5 text-right sm:table-cell">
									Ped. Mínimo
								</th>
								<th className="hidden px-3 py-2.5 sm:table-cell">Frete</th>
								<th className="px-3.5 py-2.5 text-right">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{representadas.map((r) => {
								const isInativa = !r.ativo;
								const cor = obterCorRepresentada(r);
								return (
									<tr
										key={r.id}
										className={`group transition-colors hover:bg-muted/50 ${
											isInativa ? "bg-muted/25 opacity-70" : ""
										}`}
									>
										<td className="px-3.5 py-2.5">
											<div className="flex items-center gap-2.5">
												<RepresentadaDot cor={cor} />
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<Link
															to={`/representadas/${r.id}/editar`}
															className="truncate font-medium text-foreground hover:text-primary"
														>
															{r.nome_fantasia}
														</Link>
														{isInativa && (
															<Badge variant="secondary">Inativa</Badge>
														)}
													</div>
													<div className="truncate text-xs text-muted-foreground">
														{r.razao_social}
													</div>
												</div>
											</div>
										</td>

										<td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap md:table-cell">
											{formatarCnpj(r.cnpj)}
										</td>

										<td className="px-3 py-2.5 text-right font-mono text-xs font-medium text-foreground tabular-nums whitespace-nowrap">
											{formatarCentesimosPercentual(
												r.percentual_comissao_padrao,
											)}
										</td>

										<td className="hidden px-3 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap sm:table-cell">
											{r.valor_pedido_minimo_centavos > 0
												? formatarCentavos(r.valor_pedido_minimo_centavos)
												: "—"}
										</td>

										<td className="hidden px-3 py-2.5 whitespace-nowrap sm:table-cell">
											<span
												title={ROTULOS_FRETE[r.regras_frete_padrao]}
												className="inline-flex h-5 items-center rounded-md border border-border bg-muted/60 px-1.5 font-mono text-[11px] text-muted-foreground"
											>
												{r.regras_frete_padrao.replace("_", " ")}
											</span>
										</td>

										<td className="px-3.5 py-2.5 text-right whitespace-nowrap">
											<div className="inline-flex items-center justify-end gap-1">
												<Link
													to={`/catalogo?representada=${r.id}`}
													className={buttonClassName({
														variant: "ghost",
														size: "sm",
													})}
													title="Ver produtos desta representada no catálogo"
												>
													<Package aria-hidden="true" className="size-3.5" />
													<span className="hidden lg:inline">Catálogo</span>
												</Link>
												<Link
													to={`/representadas/${r.id}/editar`}
													className={buttonClassName({
														variant: "secondary",
														size: "sm",
													})}
												>
													Editar
												</Link>
												{isInativa ? (
													<Button
														variant="secondary"
														size="sm"
														onClick={() => handleReativar(r)}
														title="Reativar representada"
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
														onClick={() => handleInativar(r)}
														title="Inativar representada"
														aria-label={`Inativar ${r.nome_fantasia}`}
														className="px-2 text-subtle-foreground hover:text-destructive"
													>
														<Archive aria-hidden="true" className="size-3.5" />
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
