import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Button,
	buttonClassName,
	cardClassName,
	FormField,
	InactiveRecoveryCard,
	Input,
	PageHeader,
	Select,
} from "../../../shared/components/ui";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE, TIPOS_FRETE } from "../../../shared/domain/frete";
import {
	CnpjDuplicadoError,
	RepresentadaInativaExistenteError,
} from "../domain/representada";
import type { Representada } from "../domain/representada.schema";
import {
	type RepresentadaFormErros,
	type RepresentadaFormValues,
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
			<Page width="narrow">
				<p className="text-foreground">Representada não encontrada.</p>
				<Link to="/representadas" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</Page>
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
			setErroGeral(mensagemDeErro(err, "Erro ao reativar representada"));
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
			setErroGeral(resultado.geral);
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
				setErros((atual) => ({ ...atual, cnpj: err.message }));
			} else if (err instanceof CnpjDuplicadoError) {
				setErros((atual) => ({ ...atual, cnpj: err.message }));
			} else {
				setErroGeral(mensagemDeErro(err, "Erro ao salvar representada"));
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<Page width="narrow">
			<PageHeader
				title={editando ? "Editar representada" : "Nova representada"}
				back={{ to: "/representadas", label: "Representadas" }}
			/>

			<form
				noValidate
				onSubmit={handleSubmit}
				className={cardClassName({
					className: "flex flex-col gap-5 p-4 md:p-6",
				})}
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
					<Select
						id="regras_frete_padrao"
						value={valores.regras_frete_padrao}
						onChange={(e) => alterar("regras_frete_padrao", e.target.value)}
						hasError={Boolean(erros.regras_frete_padrao)}
					>
						{TIPOS_FRETE.map((regra) => (
							<option key={regra} value={regra}>
								{ROTULOS_FRETE[regra]}
							</option>
						))}
					</Select>
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

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Link
						to="/representadas"
						className={buttonClassName({ variant: "ghost" })}
					>
						Cancelar
					</Link>
					<Button type="submit" disabled={salvando}>
						{salvando ? "Salvando..." : "Salvar"}
					</Button>
				</div>
			</form>
		</Page>
	);
}
