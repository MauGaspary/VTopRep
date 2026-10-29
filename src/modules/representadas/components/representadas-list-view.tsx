import { Factory, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	Card,
	EmptyState,
	PageHeader,
	SearchInput,
} from "../../../shared/components/ui";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE } from "../../../shared/domain/frete";
import type { Representada } from "../domain/representada.schema";
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
				description="Fábricas que você representa."
				action={
					<Link to="/representadas/nova" className={buttonClassName()}>
						<Plus aria-hidden="true" />
						Nova representada
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
				<EmptyState
					icon={Factory}
					title={
						termoBusca
							? "Nenhuma representada encontrada para a busca."
							: "Nenhuma representada cadastrada ainda."
					}
				/>
			)}

			{!isLoading && representadas.length > 0 && (
				<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{representadas.map((r) => {
						const isInativa = !r.ativo;
						return (
							<Card
								as="li"
								key={r.id}
								inactive={isInativa}
								className="flex flex-col gap-3 p-4"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex flex-col gap-0.5">
										<div className="flex items-center gap-2">
											<h2 className="text-[15px] leading-tight font-medium text-foreground">
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
										<dt className="text-xs text-muted-foreground">Comissão</dt>
										<dd className="font-medium tabular-nums">
											{formatarCentesimosPercentual(
												r.percentual_comissao_padrao,
											)}
										</dd>
									</div>
									<div>
										<dt className="text-xs text-muted-foreground">
											Pedido mínimo
										</dt>
										<dd className="font-medium tabular-nums">
											{r.valor_pedido_minimo_centavos > 0
												? formatarCentavos(r.valor_pedido_minimo_centavos)
												: "—"}
										</dd>
									</div>
									<div>
										<dt className="text-xs text-muted-foreground">Frete</dt>
										<dd
											className="font-medium"
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
									<Link
										to={`/representadas/${r.id}/editar`}
										className={buttonClassName({
											variant: "secondary",
											size: "sm",
										})}
									>
										Editar
									</Link>
								</div>
							</Card>
						);
					})}
				</ul>
			)}
		</Page>
	);
}
