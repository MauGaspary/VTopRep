import { Plus } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Button,
	buttonClassName,
	Combobox,
	cardClassName,
	FormField,
	HomonymWarning,
	InactiveRecoveryCard,
	Input,
	PageHeader,
	Select,
} from "../../../shared/components/ui";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { opcoesComboboxTransportadoras } from "../../transportadoras/domain/transportadora";
import type { Transportadora } from "../../transportadoras/domain/transportadora.schema";
import { useTodasTransportadoras } from "../../transportadoras/hooks/use-transportadoras";
import {
	type ClienteCompleto,
	ClienteInativoExistenteError,
	CpfCnpjDuplicadoError,
	TransportadoraPadraoInvalidaError,
} from "../domain/cliente";
import {
	type Cliente,
	ROTULOS_TIPO_CLIENTE,
	TIPOS_CLIENTE,
} from "../domain/cliente.schema";
import { PAPEL_CONTATO } from "../domain/cliente-contato.schema";
import { TIPO_ENDERECO } from "../domain/cliente-endereco.schema";
import {
	type CampoContatoForm,
	type CampoEnderecoForm,
	type ClienteFormErros,
	type ClienteFormValues,
	chaveErroContato,
	chaveErroEndereco,
	novoContatoForm,
	novoEnderecoForm,
	validarFormularioCliente,
	valoresIniciaisClienteForm,
} from "../domain/cliente-form";
import {
	useCliente,
	useClienteActions,
	useHomonimosCliente,
} from "../hooks/use-clientes";
import { ClienteTabs } from "./cliente-tabs";

export function ClienteFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { dados, isLoading } = useCliente(config.id, id, true);
	const { transportadoras, isLoading: carregandoTransportadoras } =
		useTodasTransportadoras(config.id);

	if ((id && isLoading) || carregandoTransportadoras) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando cliente...
			</p>
		);
	}

	if (id && !dados) {
		return (
			<Page width="narrow">
				<p className="text-foreground">Cliente não encontrado.</p>
				<Link to="/clientes" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</Page>
		);
	}

	return (
		<ClienteForm
			key={dados?.cliente.id ?? "novo"}
			tenantId={config.id}
			original={dados ?? undefined}
			transportadoras={transportadoras}
		/>
	);
}

interface ClienteFormProps {
	tenantId: string;
	original?: ClienteCompleto;
	transportadoras: readonly Transportadora[];
}

const gerarLocalId = () => crypto.randomUUID();

function ClienteForm({
	tenantId,
	original,
	transportadoras,
}: ClienteFormProps) {
	const navigate = useNavigate();
	const { criar, atualizar, reativar } = useClienteActions(tenantId);
	const clienteOriginal = original?.cliente;

	const [valores, setValores] = useState<ClienteFormValues>(() =>
		valoresIniciaisClienteForm(original),
	);
	const [erros, setErros] = useState<ClienteFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [inativoConflitante, setInativoConflitante] = useState<Cliente | null>(
		null,
	);
	const [salvando, setSalvando] = useState(false);
	const homonimos = useHomonimosCliente(
		tenantId,
		{
			razao_social: valores.razao_social,
			nome_fantasia: valores.nome_fantasia,
		},
		clienteOriginal?.id,
	);

	const editando = clienteOriginal !== undefined;

	const opcoesTransportadoras = useMemo(
		() =>
			opcoesComboboxTransportadoras(
				transportadoras,
				clienteOriginal?.transportadora_padrao_id,
			),
		[transportadoras, clienteOriginal?.transportadora_padrao_id],
	);

	const limparErro = (chave: string) =>
		setErros((atual) => ({ ...atual, [chave]: undefined }));

	const alterarCampo = (
		campo:
			| "cnpj_cpf"
			| "razao_social"
			| "nome_fantasia"
			| "tipo_cliente"
			| "transportadora_padrao_id",
		valor: string,
	) => {
		setValores((atual) => ({ ...atual, [campo]: valor }));
		limparErro(campo);
		setInativoConflitante(null);
	};

	// Gestão de Endereços
	const adicionarEndereco = () => {
		setValores((atual) => ({
			...atual,
			enderecos: [...atual.enderecos, novoEnderecoForm(gerarLocalId)],
		}));
	};

	const removerEndereco = (index: number) => {
		setValores((atual) => ({
			...atual,
			enderecos: atual.enderecos.filter((_, i) => i !== index),
		}));
		setErros({});
	};

	const alterarEndereco = (
		index: number,
		campo: CampoEnderecoForm,
		valor: string,
	) => {
		setValores((atual) => ({
			...atual,
			enderecos: atual.enderecos.map((end, i) =>
				i === index ? { ...end, [campo]: valor } : end,
			),
		}));
		limparErro(chaveErroEndereco(index, campo));
	};

	// Gestão de Contatos
	const adicionarContato = () => {
		setValores((atual) => ({
			...atual,
			contatos: [...atual.contatos, novoContatoForm(gerarLocalId)],
		}));
	};

	const removerContato = (index: number) => {
		setValores((atual) => ({
			...atual,
			contatos: atual.contatos.filter((_, i) => i !== index),
		}));
		setErros({});
	};

	const alterarContato = (
		index: number,
		campo: CampoContatoForm,
		valor: string,
	) => {
		setValores((atual) => ({
			...atual,
			contatos: atual.contatos.map((cont, i) =>
				i === index ? { ...cont, [campo]: valor } : cont,
			),
		}));
		limparErro(chaveErroContato(index, campo));
	};

	const handleReativarExistente = async () => {
		if (!inativoConflitante) return;
		setSalvando(true);
		setErroGeral(null);
		try {
			await reativar(inativoConflitante.id);
			navigate("/clientes");
		} catch (err) {
			setErroGeral(mensagemDeErro(err, "Erro ao reativar cliente"));
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErroGeral(null);
		setInativoConflitante(null);

		const resultado = validarFormularioCliente(valores);
		if (!resultado.success) {
			setErros(resultado.erros);
			setErroGeral(resultado.geral);
			return;
		}
		setErros({});

		setSalvando(true);
		try {
			if (clienteOriginal) {
				await atualizar(clienteOriginal.id, resultado.data);
			} else {
				await criar(resultado.data);
			}
			navigate("/clientes");
		} catch (err) {
			if (err instanceof ClienteInativoExistenteError) {
				setInativoConflitante(err.clienteInativo);
				setErros({ cnpj_cpf: err.message });
			} else if (err instanceof CpfCnpjDuplicadoError) {
				setErros({ cnpj_cpf: err.message });
			} else if (err instanceof TransportadoraPadraoInvalidaError) {
				setErros({ transportadora_padrao_id: err.message });
			} else {
				setErroGeral(mensagemDeErro(err, "Erro ao salvar cliente"));
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<Page width="form">
			<PageHeader
				title={
					editando && clienteOriginal
						? clienteOriginal.razao_social
						: "Novo cliente"
				}
				description={editando ? "Editar cadastro do cliente" : undefined}
				back={{ to: "/clientes", label: "Clientes" }}
			/>

			{clienteOriginal && <ClienteTabs clienteId={clienteOriginal.id} />}

			<form
				noValidate
				onSubmit={handleSubmit}
				className={cardClassName({
					className: "flex flex-col gap-8 p-4 md:p-6",
				})}
			>
				{/* Dados Principais */}
				<div className="flex flex-col gap-4">
					<h2 className="border-b border-border pb-2 text-sm font-semibold text-foreground">
						Dados gerais
					</h2>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							id="cnpj_cpf"
							label="CPF ou CNPJ"
							error={erros.cnpj_cpf}
							required
						>
							<Input
								id="cnpj_cpf"
								value={valores.cnpj_cpf}
								onChange={(e) => alterarCampo("cnpj_cpf", e.target.value)}
								placeholder="000.000.000-00 ou 00.000.000/0000-00"
								autoComplete="off"
								hasError={Boolean(erros.cnpj_cpf)}
								className="font-mono uppercase"
							/>
						</FormField>

						<FormField
							id="razao_social"
							label="Razão Social ou Nome Completo"
							error={erros.razao_social}
							required
						>
							<Input
								id="razao_social"
								value={valores.razao_social}
								onChange={(e) => alterarCampo("razao_social", e.target.value)}
								autoComplete="off"
								hasError={Boolean(erros.razao_social)}
							/>
						</FormField>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							id="nome_fantasia"
							label="Nome Fantasia (Opcional)"
							error={erros.nome_fantasia}
						>
							<Input
								id="nome_fantasia"
								value={valores.nome_fantasia}
								onChange={(e) => alterarCampo("nome_fantasia", e.target.value)}
								autoComplete="off"
								hasError={Boolean(erros.nome_fantasia)}
							/>
						</FormField>

						<fieldset className="flex flex-col gap-1.5">
							<legend className="text-xs font-medium text-muted-foreground">
								Segmento comercial (comissão){" "}
								<span className="text-destructive">*</span>
							</legend>
							<div className="grid grid-cols-2 gap-2">
								{TIPOS_CLIENTE.map((tipo) => {
									const selecionado = valores.tipo_cliente === tipo;
									return (
										<label
											key={tipo}
											className={`flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors select-none ${
												selecionado
													? "border-primary bg-primary/10 text-foreground"
													: "border-border bg-secondary/50 text-muted-foreground hover:bg-muted hover:text-foreground"
											}`}
										>
											<input
												type="radio"
												name="tipo_cliente"
												value={tipo}
												checked={selecionado}
												onChange={(e) =>
													alterarCampo("tipo_cliente", e.target.value)
												}
												className="size-3.5 accent-primary"
											/>
											{ROTULOS_TIPO_CLIENTE[tipo]}
										</label>
									);
								})}
							</div>
							{erros.tipo_cliente ? (
								<span role="alert" className="text-xs text-destructive">
									{erros.tipo_cliente}
								</span>
							) : (
								<span className="text-xs text-muted-foreground">
									Define automaticamente a alíquota de comissão nas
									representadas.
								</span>
							)}
						</fieldset>
					</div>

					<HomonymWarning
						title="Já existe cliente com este nome na carteira:"
						description="Nomes repetidos são permitidos (ex.: filiais ou redes). Confira se não é um cadastro duplicado."
						items={homonimos.map(({ registro }) => ({
							id: registro.id,
							nome: registro.nome_fantasia
								? `${registro.razao_social} · ${registro.nome_fantasia}`
								: registro.razao_social,
							detalhe: formatarCpfCnpj(registro.cnpj_cpf),
							inativo: !registro.ativo,
						}))}
					/>
				</div>

				{/* Logística */}
				<div className="flex flex-col gap-3">
					<div className="border-b border-border pb-2">
						<h2 className="text-sm font-semibold text-foreground">Logística</h2>
						<p className="text-xs text-muted-foreground">
							A transportadora habitual é sugerida automaticamente ao iniciar um
							orçamento para este cliente.
						</p>
					</div>

					<FormField
						id="transportadora_padrao_id"
						label="Transportadora habitual (opcional)"
						error={erros.transportadora_padrao_id}
						help={
							opcoesTransportadoras.length === 0
								? "Nenhuma transportadora ativa cadastrada."
								: undefined
						}
					>
						<Combobox
							id="transportadora_padrao_id"
							name="transportadora_padrao_id"
							value={valores.transportadora_padrao_id}
							onChange={(id) => alterarCampo("transportadora_padrao_id", id)}
							options={opcoesTransportadoras}
							placeholder="Digite o nome, CNPJ ou cidade..."
							emptyMessage="Nenhuma transportadora encontrada."
							hasError={Boolean(erros.transportadora_padrao_id)}
						/>
					</FormField>
				</div>

				{/* Endereços */}
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between border-b border-border pb-2">
						<h2 className="text-sm font-semibold text-foreground">Endereços</h2>
						<Button variant="ghost" size="sm" onClick={adicionarEndereco}>
							<Plus aria-hidden="true" />
							Adicionar endereço
						</Button>
					</div>

					{valores.enderecos.length === 0 && (
						<p className="text-xs text-muted-foreground italic">
							Nenhum endereço cadastrado no momento.
						</p>
					)}

					{valores.enderecos.map((end, idx) => {
						const erroTipo = erros[chaveErroEndereco(idx, "tipo_endereco")];
						const erroEndereco =
							erros[chaveErroEndereco(idx, "endereco_completo")];
						return (
							<div
								key={end.localId}
								className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3"
							>
								<div className="flex items-center justify-between gap-2">
									<Select
										size="sm"
										aria-label="Tipo de endereço"
										value={end.tipo_endereco}
										onChange={(e) =>
											alterarEndereco(idx, "tipo_endereco", e.target.value)
										}
										hasError={Boolean(erroTipo)}
									>
										{TIPO_ENDERECO.map((tipo) => (
											<option key={tipo} value={tipo}>
												{tipo}
											</option>
										))}
									</Select>
									<Button
										variant="destructive"
										size="sm"
										onClick={() => removerEndereco(idx)}
									>
										Remover
									</Button>
								</div>
								{erroTipo && (
									<span role="alert" className="text-xs text-destructive">
										{erroTipo}
									</span>
								)}
								<Input
									aria-label="Endereço completo"
									value={end.endereco_completo}
									onChange={(e) =>
										alterarEndereco(idx, "endereco_completo", e.target.value)
									}
									placeholder="Rua, número, complemento, bairro, cidade - UF"
									hasError={Boolean(erroEndereco)}
								/>
								{erroEndereco && (
									<span role="alert" className="text-xs text-destructive">
										{erroEndereco}
									</span>
								)}
							</div>
						);
					})}
				</div>

				{/* Contatos */}
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between border-b border-border pb-2">
						<h2 className="text-sm font-semibold text-foreground">Contatos</h2>
						<Button variant="ghost" size="sm" onClick={adicionarContato}>
							<Plus aria-hidden="true" />
							Adicionar contato
						</Button>
					</div>

					{valores.contatos.length === 0 && (
						<p className="text-xs text-muted-foreground italic">
							Nenhum contato cadastrado no momento.
						</p>
					)}

					{valores.contatos.map((cont, idx) => {
						const erroNome = erros[chaveErroContato(idx, "nome")];
						const erroTelefone =
							erros[chaveErroContato(idx, "telefone_whatsapp")];
						const erroEmail = erros[chaveErroContato(idx, "email")];
						const erroPapel = erros[chaveErroContato(idx, "papel")];
						return (
							<div
								key={cont.localId}
								className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3"
							>
								<div className="flex items-center justify-between gap-2">
									<Select
										size="sm"
										aria-label="Papel do contato"
										value={cont.papel}
										onChange={(e) =>
											alterarContato(idx, "papel", e.target.value)
										}
										hasError={Boolean(erroPapel)}
									>
										<option value="">SEM PAPEL</option>
										{PAPEL_CONTATO.map((papel) => (
											<option key={papel} value={papel}>
												{papel}
											</option>
										))}
									</Select>
									<Button
										variant="destructive"
										size="sm"
										onClick={() => removerContato(idx)}
									>
										Remover
									</Button>
								</div>
								{erroPapel && (
									<span role="alert" className="text-xs text-destructive">
										{erroPapel}
									</span>
								)}

								<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
									<div>
										<Input
											aria-label="Nome do contato"
											value={cont.nome}
											onChange={(e) =>
												alterarContato(idx, "nome", e.target.value)
											}
											placeholder="Nome do contato"
											hasError={Boolean(erroNome)}
										/>
										{erroNome && (
											<span role="alert" className="text-xs text-destructive">
												{erroNome}
											</span>
										)}
									</div>
									<div>
										<Input
											aria-label="Telefone / WhatsApp"
											value={cont.telefone_whatsapp}
											onChange={(e) =>
												alterarContato(idx, "telefone_whatsapp", e.target.value)
											}
											placeholder="Telefone / WhatsApp"
											hasError={Boolean(erroTelefone)}
										/>
										{erroTelefone && (
											<span role="alert" className="text-xs text-destructive">
												{erroTelefone}
											</span>
										)}
									</div>
									<div>
										<Input
											aria-label="E-mail"
											type="email"
											value={cont.email}
											onChange={(e) =>
												alterarContato(idx, "email", e.target.value)
											}
											placeholder="E-mail (opcional)"
											hasError={Boolean(erroEmail)}
										/>
										{erroEmail && (
											<span role="alert" className="text-xs text-destructive">
												{erroEmail}
											</span>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Alerta de inativo conflitante */}
				{inativoConflitante && (
					<InactiveRecoveryCard
						title="Cliente inativo encontrado na carteira:"
						entityName={inativoConflitante.razao_social}
						details={formatarCpfCnpj(inativoConflitante.cnpj_cpf)}
						onReativar={handleReativarExistente}
						isLoading={salvando}
					/>
				)}

				{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

				<div className="flex justify-end gap-2 border-t border-border pt-4">
					<Link
						to="/clientes"
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
