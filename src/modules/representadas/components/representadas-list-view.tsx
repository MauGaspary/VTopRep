import { useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import type { Representada } from "../domain/representada.schema";
import { ROTULOS_FRETE } from "../domain/representada-form";
import {
	useRepresentadaActions,
	useTodasRepresentadas,
} from "../hooks/use-representadas";

export function RepresentadasListView() {
	const { config } = useTenant();
	const [termoBusca, setTermoBusca] = useState("");
	const [erro, setErro] = useState<string | null>(null);
	const { representadas, isLoading } = useTodasRepresentadas(
		config.id,
		termoBusca,
	);
	const { inativar, reativar } = useRepresentadaActions(config.id);

	const handleInativar = async (representada: Representada) => {
		const confirmado = window.confirm(
			`Inativar a representada "${representada.nome_fantasia}"? Ela não estará disponível para novos orçamentos.`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(representada.id);
		} catch (e) {
			setErro(e instanceof Error ? e.message : "Erro ao inativar representada");
		}
	};

	const handleReativar = async (representada: Representada) => {
		setErro(null);
		try {
			await reativar(representada.id);
		} catch (e) {
			setErro(e instanceof Error ? e.message : "Erro ao reativar representada");
		}
	};

	return (
		<section className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-foreground">
						Representadas
					</h1>
					<p className="text-sm text-muted-foreground">
						Fábricas que você representa.
					</p>
				</div>
				<Link
					to="/representadas/nova"
					className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					+ Nova representada
				</Link>
			</div>

			<div className="flex flex-col gap-1">
				<label
					htmlFor="busca-representadas"
					className="text-sm font-medium text-foreground"
				>
					Buscar
				</label>
				<input
					id="busca-representadas"
					type="search"
					placeholder="Nome, razão social ou CNPJ..."
					value={termoBusca}
					onChange={(e) => setTermoBusca(e.target.value)}
					className="rounded-lg border border-input bg-card px-3 py-2 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			{erro && (
				<p
					role="alert"
					className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
				>
					{erro}
				</p>
			)}

			{isLoading && (
				<p className="py-6 text-center text-muted-foreground">Carregando...</p>
			)}

			{!isLoading && representadas.length === 0 && (
				<div className="rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
					{termoBusca
						? "Nenhuma representada encontrada para a busca."
						: "Nenhuma representada cadastrada ainda."}
				</div>
			)}

			{!isLoading && representadas.length > 0 && (
				<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{representadas.map((r) => {
						const isInativa = r.deleted_at !== null;
						return (
							<li
								key={r.id}
								className={`flex flex-col gap-3 rounded-lg border p-4 shadow-sm transition-opacity ${
									isInativa
										? "border-dashed border-border bg-muted/40 opacity-70"
										: "border-border bg-card"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex flex-col">
										<div className="flex items-center gap-2">
											<h2 className="font-semibold leading-tight text-card-foreground">
												{r.nome_fantasia}
											</h2>
											{isInativa && (
												<span className="inline-flex items-center rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
													Inativa
												</span>
											)}
										</div>
										<span className="text-sm text-muted-foreground">
											{r.razao_social}
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											{formatarCnpj(r.cnpj)}
										</span>
									</div>
								</div>

								<dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
									<div>
										<dt className="text-xs uppercase tracking-wide text-muted-foreground">
											Comissão
										</dt>
										<dd className="text-card-foreground">
											{formatarCentesimosPercentual(
												r.percentual_comissao_padrao,
											)}
										</dd>
									</div>
									<div>
										<dt className="text-xs uppercase tracking-wide text-muted-foreground">
											Ped. mínimo
										</dt>
										<dd className="text-card-foreground">
											{r.valor_pedido_minimo_centavos > 0
												? formatarCentavos(r.valor_pedido_minimo_centavos)
												: "—"}
										</dd>
									</div>
									<div>
										<dt className="text-xs uppercase tracking-wide text-muted-foreground">
											Frete
										</dt>
										<dd
											className="text-card-foreground"
											title={ROTULOS_FRETE[r.regras_frete_padrao]}
										>
											{r.regras_frete_padrao.replace("_", " ")}
										</dd>
									</div>
								</dl>

								<div className="flex justify-end gap-2">
									{isInativa ? (
										<button
											type="button"
											onClick={() => handleReativar(r)}
											className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
										>
											Reativar
										</button>
									) : (
										<button
											type="button"
											onClick={() => handleInativar(r)}
											className="rounded-lg px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
										>
											Inativar
										</button>
									)}
									<Link
										to={`/representadas/${r.id}/editar`}
										className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
									>
										Editar
									</Link>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
