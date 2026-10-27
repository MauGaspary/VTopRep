import { useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import {
	Alert,
	Badge,
	Button,
	PageHeader,
	SearchInput,
} from "../../../shared/components/ui";
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
			<PageHeader
				title="Representadas"
				description="Fábricas que você representa."
				action={
					<Link to="/representadas/nova">
						<Button variant="primary">+ Nova representada</Button>
					</Link>
				}
			/>

			<SearchInput
				id="busca-representadas"
				placeholder="Nome, razão social ou CNPJ..."
				value={termoBusca}
				onChange={setTermoBusca}
			/>

			{erro && <Alert variant="destructive">{erro}</Alert>}

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
												<Badge variant="destructive">Inativa</Badge>
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
										<Button
											variant="secondary"
											size="sm"
											onClick={() => handleReativar(r)}
										>
											Reativar
										</Button>
									) : (
										<Button
											variant="destructive"
											size="sm"
											onClick={() => handleInativar(r)}
										>
											Inativar
										</Button>
									)}
									<Link to={`/representadas/${r.id}/editar`}>
										<Button variant="secondary" size="sm">
											Editar
										</Button>
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
