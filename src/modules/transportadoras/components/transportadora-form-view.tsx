import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	cardClassName,
	FormField,
	InactiveRecoveryCard,
	Input,
	PageHeader,
} from "../../../shared/components/ui";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import {
	CnpjTransportadoraDuplicadoError,
	TransportadoraInativaExistenteError,
} from "../domain/transportadora";
import type { Transportadora } from "../domain/transportadora.schema";
import {
	type TransportadoraFormErros,
	type TransportadoraFormValues,
	validarFormularioTransportadora,
	valoresIniciaisTransportadoraForm,
} from "../domain/transportadora-form";
import {
	useTransportadora,
	useTransportadoraActions,
} from "../hooks/use-transportadoras";

/** Rota /transportadoras/nova e /transportadoras/:id/editar */
export function TransportadoraFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { transportadora, isLoading } = useTransportadora(config.id, id, true);

	if (id && isLoading) {
		return (
			<p className="p-6 text-center text-muted-foreground">Carregando...</p>
		);
	}

	if (id && !transportadora) {
		return (
			<Page width="narrow">
				<p className="text-foreground">Transportadora não encontrada.</p>
				<Link to="/transportadoras" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</Page>
		);
	}

	return (
		<TransportadoraForm
			key={transportadora?.id ?? "nova"}
			tenantId={config.id}
			transportadora={transportadora ?? undefined}
		/>
	);
}

interface TransportadoraFormProps {
	tenantId: string;
	transportadora?: Transportadora;
}

function TransportadoraForm({
	tenantId,
	transportadora,
}: TransportadoraFormProps) {
	const navigate = useNavigate();
	const { criar, atualizar, reativar } = useTransportadoraActions(tenantId);

	const [valores, setValores] = useState<TransportadoraFormValues>(() =>
		valoresIniciaisTransportadoraForm(transportadora),
	);
	const [erros, setErros] = useState<TransportadoraFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [inativaConflitante, setInativaConflitante] =
		useState<Transportadora | null>(null);
	const [salvando, setSalvando] = useState(false);

	const editando = transportadora !== undefined;

	const alterar = (campo: keyof TransportadoraFormValues, valor: string) => {
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
			navigate("/transportadoras");
		} catch (err) {
			setErroGeral(mensagemDeErro(err, "Erro ao reativar transportadora"));
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErroGeral(null);
		setInativaConflitante(null);

		const resultado = validarFormularioTransportadora(valores);
		if (!resultado.success) {
			setErros(resultado.erros);
			setErroGeral(resultado.geral);
			return;
		}

		setErros({});
		setSalvando(true);
		try {
			if (transportadora) {
				await atualizar(transportadora.id, resultado.data);
			} else {
				await criar(resultado.data);
			}
			navigate("/transportadoras");
		} catch (err) {
			if (err instanceof TransportadoraInativaExistenteError) {
				setInativaConflitante(err.transportadoraInativa);
				setErros((atual) => ({ ...atual, cnpj: err.message }));
			} else if (err instanceof CnpjTransportadoraDuplicadoError) {
				setErros((atual) => ({ ...atual, cnpj: err.message }));
			} else {
				setErroGeral(mensagemDeErro(err, "Erro ao salvar transportadora"));
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<Page width="form">
			<PageHeader
				title={editando ? "Editar transportadora" : "Nova transportadora"}
				back={{ to: "/transportadoras", label: "Transportadoras" }}
				action={
					transportadora && !transportadora.ativo ? (
						<Badge variant="secondary">Inativa</Badge>
					) : undefined
				}
			/>

			<form
				noValidate
				onSubmit={handleSubmit}
				className={cardClassName({
					className: "flex flex-col gap-6 p-4 md:p-6",
				})}
			>
				<div className="flex flex-col gap-4">
					<h2 className="border-b border-border pb-2 text-sm font-semibold text-foreground">
						Dados da transportadora
					</h2>

					<FormField
						id="nome_fantasia"
						label="Nome fantasia"
						error={erros.nome_fantasia}
						required
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
						label="Razão social (opcional)"
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

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							id="cnpj"
							label="CNPJ (opcional)"
							error={erros.cnpj}
							help="Quando informado, não pode repetir entre transportadoras."
						>
							<Input
								id="cnpj"
								value={valores.cnpj}
								onChange={(e) => alterar("cnpj", e.target.value)}
								onBlur={(e) => {
									const valor = e.target.value.trim();
									if (valor !== "") alterar("cnpj", formatarCnpj(valor));
								}}
								placeholder="00.000.000/0000-00"
								autoComplete="off"
								maxLength={18}
								hasError={Boolean(erros.cnpj)}
								className="font-mono uppercase"
							/>
						</FormField>

						<FormField
							id="telefone"
							label="Telefone (opcional)"
							error={erros.telefone}
						>
							<Input
								id="telefone"
								type="tel"
								inputMode="tel"
								value={valores.telefone}
								onChange={(e) => alterar("telefone", e.target.value)}
								placeholder="(54) 3333-0000"
								autoComplete="off"
								hasError={Boolean(erros.telefone)}
							/>
						</FormField>
					</div>

					<FormField
						id="cidade_uf"
						label="Cidade/UF (opcional)"
						error={erros.cidade_uf}
						help="Sede ou praça de atendimento. Ex.: Caxias do Sul/RS"
					>
						<Input
							id="cidade_uf"
							value={valores.cidade_uf}
							onChange={(e) => alterar("cidade_uf", e.target.value)}
							placeholder="Caxias do Sul/RS"
							autoComplete="off"
							hasError={Boolean(erros.cidade_uf)}
						/>
					</FormField>
				</div>

				{transportadora && !transportadora.ativo && (
					<InactiveRecoveryCard
						title="Esta transportadora está inativa. Reative-a para salvar alterações:"
						entityName={transportadora.nome_fantasia}
						onReativar={async () => {
							setErroGeral(null);
							try {
								await reativar(transportadora.id);
							} catch (err) {
								setErroGeral(
									mensagemDeErro(err, "Erro ao reativar transportadora"),
								);
							}
						}}
						isLoading={salvando}
					/>
				)}

				{inativaConflitante && (
					<InactiveRecoveryCard
						title="Transportadora inativa encontrada:"
						entityName={inativaConflitante.nome_fantasia}
						details={
							inativaConflitante.cnpj
								? formatarCnpj(inativaConflitante.cnpj)
								: undefined
						}
						onReativar={handleReativarExistente}
						isLoading={salvando}
					/>
				)}

				{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Link
						to="/transportadoras"
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
