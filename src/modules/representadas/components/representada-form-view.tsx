import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import {
	Alert,
	Button,
	FormField,
	InactiveRecoveryCard,
	Input,
} from "../../../shared/components/ui";
import {
	CnpjDuplicadoError,
	NomeFantasiaDuplicadoError,
	RazaoSocialDuplicadaError,
	RepresentadaInativaExistenteError,
} from "../domain/representada";
import type { Representada } from "../domain/representada.schema";
import { REGRAS_FRETE } from "../domain/representada.schema";
import {
	type RepresentadaFormErros,
	type RepresentadaFormValues,
	ROTULOS_FRETE,
	validarFormularioRepresentada,
	valoresIniciaisFormulario,
} from "../domain/representada-form";
import {
	useRepresentada,
	useRepresentadaActions,
} from "../hooks/use-representadas";

/** Rota /representadas/nova e /representadas/:id/editar */
export function RepresentadaFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { representada, isLoading } = useRepresentada(config.id, id, true);

	if (id && isLoading) {
		return (
			<p className="p-6 text-center text-muted-foreground">Carregando...</p>
		);
	}

	if (id && !representada) {
		return (
			<section className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
				<p className="text-foreground">Representada não encontrada.</p>
				<Link to="/representadas" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</section>
		);
	}

	return (
		<RepresentadaForm
			key={representada?.id ?? "nova"}
			tenantId={config.id}
			representada={representada ?? undefined}
		/>
	);
}

interface RepresentadaFormProps {
	tenantId: string;
	representada?: Representada;
}

function RepresentadaForm({ tenantId, representada }: RepresentadaFormProps) {
	const navigate = useNavigate();
	const { criar, atualizar, reativar } = useRepresentadaActions(tenantId);
	const [valores, setValores] = useState<RepresentadaFormValues>(() =>
		valoresIniciaisFormulario(representada),
	);
	const [erros, setErros] = useState<RepresentadaFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [inativaConflitante, setInativaConflitante] =
		useState<Representada | null>(null);
	const [salvando, setSalvando] = useState(false);

	const editando = representada !== undefined;

	const alterar = (campo: keyof RepresentadaFormValues, valor: string) => {
		setValores((atual) => ({ ...atual, [campo]: valor }));
		setErros((atual) => ({ ...atual, [campo]: undefined }));
		setInativaConflitante(null);
	};

	const handleReativarExistente = async () => {
		if (!inativaConflitante) return;
		setSalvando(true);
		setErroGeral(null);
		try {
			await reativar(inativaConflitante.id);
			navigate("/representadas");
		} catch (err) {
			setErroGeral(
				err instanceof Error ? err.message : "Erro ao reativar representada",
			);
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErroGeral(null);
		setInativaConflitante(null);

		const resultado = validarFormularioRepresentada(valores);
		if (!resultado.success) {
			setErros(resultado.erros);
			return;
		}

		setSalvando(true);
		try {
			if (representada) {
				await atualizar(representada.id, resultado.data);
			} else {
				await criar(resultado.data);
			}
			navigate("/representadas");
		} catch (err) {
			if (err instanceof RepresentadaInativaExistenteError) {
				setInativaConflitante(err.representadaInativa);
				if (err.campoConflito === "cnpj") {
					setErros((atual) => ({ ...atual, cnpj: err.message }));
				} else if (err.campoConflito === "razao_social") {
					setErros((atual) => ({ ...atual, razao_social: err.message }));
				} else if (err.campoConflito === "nome_fantasia") {
					setErros((atual) => ({ ...atual, nome_fantasia: err.message }));
				}
			} else if (err instanceof CnpjDuplicadoError) {
				setErros((atual) => ({ ...atual, cnpj: err.message }));
			} else if (err instanceof RazaoSocialDuplicadaError) {
				setErros((atual) => ({ ...atual, razao_social: err.message }));
			} else if (err instanceof NomeFantasiaDuplicadoError) {
				setErros((atual) => ({ ...atual, nome_fantasia: err.message }));
			} else {
				setErroGeral(
					err instanceof Error ? err.message : "Erro ao salvar representada",
				);
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<section className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
			<div>
				<Link
					to="/representadas"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Representadas
				</Link>
				<h1 className="mt-1 text-2xl font-semibold text-foreground">
					{editando ? "Editar representada" : "Nova representada"}
				</h1>
			</div>

			<form
				noValidate
				onSubmit={handleSubmit}
				className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm"
			>
				<FormField
					id="nome_fantasia"
					label="Nome fantasia"
					error={erros.nome_fantasia}
				>
					<Input
						id="nome_fantasia"
						value={valores.nome_fantasia}
						onChange={(e) => alterar("nome_fantasia", e.target.value)}
						autoComplete="off"
						hasError={Boolean(erros.nome_fantasia)}
					/>
				</FormField>

				<FormField
					id="razao_social"
					label="Razão social"
					error={erros.razao_social}
				>
					<Input
						id="razao_social"
						value={valores.razao_social}
						onChange={(e) => alterar("razao_social", e.target.value)}
						autoComplete="off"
						hasError={Boolean(erros.razao_social)}
					/>
				</FormField>

				<FormField id="cnpj" label="CNPJ" error={erros.cnpj}>
					<Input
						id="cnpj"
						value={valores.cnpj}
						onChange={(e) => alterar("cnpj", e.target.value)}
						placeholder="00.000.000/0000-00"
						autoComplete="off"
						maxLength={18}
						hasError={Boolean(erros.cnpj)}
						className="font-mono uppercase"
					/>
				</FormField>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<FormField
						id="percentual_comissao"
						label="Comissão padrão (%)"
						error={erros.percentual_comissao}
					>
						<Input
							id="percentual_comissao"
							value={valores.percentual_comissao}
							onChange={(e) => alterar("percentual_comissao", e.target.value)}
							inputMode="decimal"
							placeholder="5,00"
							hasError={Boolean(erros.percentual_comissao)}
						/>
					</FormField>

					<FormField
						id="valor_pedido_minimo"
						label="Pedido mínimo (R$)"
						error={erros.valor_pedido_minimo}
						help="Informativo. Deixe vazio se não houver."
					>
						<Input
							id="valor_pedido_minimo"
							value={valores.valor_pedido_minimo}
							onChange={(e) => alterar("valor_pedido_minimo", e.target.value)}
							inputMode="decimal"
							placeholder="0,00"
							hasError={Boolean(erros.valor_pedido_minimo)}
						/>
					</FormField>
				</div>

				<FormField
					id="regras_frete_padrao"
					label="Frete padrão"
					error={erros.regras_frete_padrao}
				>
					<select
						id="regras_frete_padrao"
						value={valores.regras_frete_padrao}
						onChange={(e) => alterar("regras_frete_padrao", e.target.value)}
						className={`w-full rounded-lg border bg-background px-3 py-2 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-sm ${
							erros.regras_frete_padrao ? "border-destructive" : "border-input"
						}`}
					>
						{REGRAS_FRETE.map((regra) => (
							<option key={regra} value={regra}>
								{ROTULOS_FRETE[regra]}
							</option>
						))}
					</select>
				</FormField>

				{inativaConflitante && (
					<InactiveRecoveryCard
						title="Representada inativa encontrada:"
						entityName={inativaConflitante.nome_fantasia}
						details={inativaConflitante.razao_social}
						onReativar={handleReativarExistente}
						isLoading={salvando}
					/>
				)}

				{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

				<div className="flex justify-end gap-2 pt-2">
					<Link to="/representadas">
						<Button variant="ghost">Cancelar</Button>
					</Link>
					<Button type="submit" disabled={salvando}>
						{salvando ? "Salvando..." : "Salvar"}
					</Button>
				</div>
			</form>
		</section>
	);
}
