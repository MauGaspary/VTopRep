import { Archive, Plus, RotateCcw, Truck } from "lucide-react";
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
	SearchInput,
} from "../../../shared/components/ui";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import type { Transportadora } from "../domain/transportadora.schema";
import {
	useTodasTransportadoras,
	useTransportadoraActions,
} from "../hooks/use-transportadoras";

export function TransportadorasListView() {
	const { config } = useTenant();
	const [termoBusca, setTermoBusca] = useState("");
	const [mostrarInativas, setMostrarInativas] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const { transportadoras: todas, isLoading } = useTodasTransportadoras(
		config.id,
		termoBusca,
	);
	const { inativar, reativar } = useTransportadoraActions(config.id);

	const transportadoras = mostrarInativas
		? todas
		: todas.filter((t) => t.ativo);

	const handleInativar = async (transportadora: Transportadora) => {
		const confirmado = window.confirm(
			`Inativar a transportadora "${transportadora.nome_fantasia}"? Ela não estará disponível para novos orçamentos.`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(transportadora.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao inativar transportadora"));
		}
	};

	const handleReativar = async (transportadora: Transportadora) => {
		setErro(null);
		try {
			await reativar(transportadora.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao reativar transportadora"));
		}
	};

	return (
		<Page>
			<PageHeader
				title="Transportadoras"
				description="Transportadoras usadas nos pedidos e vinculadas como habituais dos clientes."
				action={
					<Link to="/transportadoras/nova" className={buttonClassName()}>
						<Plus aria-hidden="true" />
						Nova transportadora
					</Link>
				}
			/>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<SearchInput
					id="busca-transportadoras"
					placeholder="Filtrar por nome, razão social, CNPJ ou cidade..."
					value={termoBusca}
					onChange={setTermoBusca}
					className="flex-1"
				/>

				<div className="flex items-center justify-between gap-3 sm:justify-end">
					<span className="text-xs text-muted-foreground tabular-nums">
						{transportadoras.length}{" "}
						{transportadoras.length === 1
							? "transportadora"
							: "transportadoras"}
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

			{!isLoading && transportadoras.length === 0 && (
				<EmptyState
					icon={Truck}
					title={
						termoBusca
							? "Nenhuma transportadora encontrada para a busca."
							: "Nenhuma transportadora cadastrada ainda."
					}
					description="Cadastre as transportadoras para indicá-las nos pedidos e no espelho em PDF."
				/>
			)}

			{!isLoading && transportadoras.length > 0 && (
				<section
					aria-label="Lista de transportadoras"
					className="dense-table-region rounded-xl border border-border bg-card"
				>
					<table className="text-left text-sm">
						<thead>
							<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
								<th className="px-3.5 py-2.5">Transportadora</th>
								<th className="hidden px-3 py-2.5 md:table-cell">CNPJ</th>
								<th className="hidden px-3 py-2.5 sm:table-cell">Cidade/UF</th>
								<th className="hidden px-3 py-2.5 sm:table-cell">Telefone</th>
								<th className="px-3.5 py-2.5 text-right">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{transportadoras.map((t) => {
								const isInativa = !t.ativo;
								return (
									<tr
										key={t.id}
										className={`group transition-colors hover:bg-muted/50 ${
											isInativa ? "bg-muted/25 opacity-70" : ""
										}`}
									>
										<td className="px-3.5 py-2.5">
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<Link
														to={`/transportadoras/${t.id}/editar`}
														className="truncate font-medium text-foreground hover:text-primary"
													>
														{t.nome_fantasia}
													</Link>
													{isInativa && (
														<Badge variant="secondary">Inativa</Badge>
													)}
												</div>
												{t.razao_social && (
													<div className="truncate text-xs text-muted-foreground">
														{t.razao_social}
													</div>
												)}
											</div>
										</td>

										<td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap md:table-cell">
											{t.cnpj ? formatarCnpj(t.cnpj) : "—"}
										</td>

										<td className="hidden px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap sm:table-cell">
											{t.cidade_uf ?? "—"}
										</td>

										<td className="hidden px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap sm:table-cell">
											{t.telefone ?? "—"}
										</td>

										<td className="px-3.5 py-2.5 text-right whitespace-nowrap">
											<div className="inline-flex items-center justify-end gap-1">
												<Link
													to={`/transportadoras/${t.id}/editar`}
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
														onClick={() => handleReativar(t)}
														title="Reativar transportadora"
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
														onClick={() => handleInativar(t)}
														title="Inativar transportadora"
														aria-label={`Inativar ${t.nome_fantasia}`}
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
