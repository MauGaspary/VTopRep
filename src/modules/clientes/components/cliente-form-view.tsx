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
	formatarCpfCnpj,
	isCpfOuCnpjValido,
	normalizarCpfCnpj,
} from "../../../shared/domain/cpf-cnpj";
import {
	ClienteInativoExistenteError,
	CpfCnpjDuplicadoError,
	NomeFantasiaClienteDuplicadoError,
	RazaoSocialClienteDuplicadaError,
} from "../domain/cliente";
import type { Cliente } from "../domain/cliente.schema";
import {
	type ClienteContatoInput,
	PAPEL_CONTATO,
} from "../domain/cliente-contato.schema";
import {
	type ClienteEnderecoInput,
	TIPO_ENDERECO,
} from "../domain/cliente-endereco.schema";
import { useCliente, useClienteActions } from "../hooks/use-clientes";

export function ClienteFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { dados, isLoading } = useCliente(config.id, id, true);

	if (id && isLoading) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando cliente...
			</p>
		);
	}

	if (id && !dados) {
		return (
			<section className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-4">
				<p className="text-foreground">Cliente não encontrado.</p>
				<Link to="/clientes" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</section>
		);
	}

	return (
		<ClienteForm
			key={dados?.cliente.id ?? "novo"}
			tenantId={config.id}
			clienteOriginal={dados?.cliente}
			enderecosIniciais={dados?.enderecos}
			contatosIniciais={dados?.contatos}
		/>
	);
}

interface ClienteFormProps {
	tenantId: string;
	clienteOriginal?: Cliente;
	enderecosIniciais?: ClienteEnderecoInput[];
	contatosIniciais?: ClienteContatoInput[];
}

function ClienteForm({
	tenantId,
	clienteOriginal,
	enderecosIniciais = [],
	contatosIniciais = [],
}: ClienteFormProps) {
	const navigate = useNavigate();
	const { criar, atualizar, reativar } = useClienteActions(tenantId);

	// Dados do Cliente
	const [cnpjCpf, setCnpjCpf] = useState(
		clienteOriginal ? formatarCpfCnpj(clienteOriginal.cnpj_cpf) : "",
	);
	const [razaoSocial, setRazaoSocial] = useState(
		clienteOriginal?.razao_social ?? "",
	);
	const [nomeFantasia, setNomeFantasia] = useState(
		clienteOriginal?.nome_fantasia ?? "",
	);

	// Endereços e Contatos
	const [enderecos, setEnderecos] = useState<
		Array<ClienteEnderecoInput & { localId: string }>
	>(() =>
		enderecosIniciais.map((e) => ({
			...e,
			localId: e.id ?? crypto.randomUUID(),
		})),
	);
	const [contatos, setContatos] = useState<
		Array<ClienteContatoInput & { localId: string }>
	>(() =>
		contatosIniciais.map((c) => ({
			...c,
			localId: c.id ?? crypto.randomUUID(),
		})),
	);

	// Feedback
	const [erros, setErros] = useState<Record<string, string>>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [inativoConflitante, setInativoConflitante] = useState<Cliente | null>(
		null,
	);
	const [salvando, setSalvando] = useState(false);

	const editando = clienteOriginal !== undefined;

	// Gestão de Endereços
	const adicionarEndereco = () => {
		setEnderecos((prev) => [
			...prev,
			{
				localId: crypto.randomUUID(),
				tipo_endereco: "PRINCIPAL",
				endereco_completo: "",
			},
		]);
	};

	const removerEndereco = (index: number) => {
		setEnderecos((prev) => prev.filter((_, i) => i !== index));
	};

	const alterarEndereco = (
		index: number,
		campo: keyof ClienteEnderecoInput,
		valor: string,
	) => {
		setEnderecos((prev) =>
			prev.map((end, i) => (i === index ? { ...end, [campo]: valor } : end)),
		);
	};

	// Gestão de Contatos
	const adicionarContato = () => {
		setContatos((prev) => [
			...prev,
			{
				localId: crypto.randomUUID(),
				nome: "",
				papel: "COMPRADOR",
				telefone_whatsapp: "",
				email: "",
			},
		]);
	};

	const removerContato = (index: number) => {
		setContatos((prev) => prev.filter((_, i) => i !== index));
	};

	const alterarContato = (
		index: number,
		campo: keyof ClienteContatoInput,
		valor: string,
	) => {
		setContatos((prev) =>
			prev.map((cont, i) => (i === index ? { ...cont, [campo]: valor } : cont)),
		);
	};

	const handleReativarExistente = async () => {
		if (!inativoConflitante) return;
		setSalvando(true);
		setErroGeral(null);
		try {
			await reativar(inativoConflitante.id);
			navigate("/clientes");
		} catch (err) {
			setErroGeral(
				err instanceof Error ? err.message : "Erro ao reativar cliente",
			);
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setErros({});
		setErroGeral(null);
		setInativoConflitante(null);

		const novosErros: Record<string, string> = {};

		if (!razaoSocial.trim()) {
			novosErros.razao_social = "Razão Social / Nome é obrigatório";
		}

		if (!cnpjCpf.trim()) {
			novosErros.cnpj_cpf = "CPF ou CNPJ é obrigatório";
		} else if (!isCpfOuCnpjValido(cnpjCpf)) {
			novosErros.cnpj_cpf = "Documento (CPF ou CNPJ) inválido";
		}

		// Validação de endereços preenchidos
		enderecos.forEach((end, idx) => {
			if (!end.endereco_completo.trim()) {
				novosErros[`endereco_${idx}`] = "Endereço completo não pode ser vazio";
			}
		});

		// Validação de contatos preenchidos
		contatos.forEach((cont, idx) => {
			if (!cont.nome.trim()) {
				novosErros[`contato_nome_${idx}`] = "Nome do contato é obrigatório";
			}
			if (!cont.telefone_whatsapp.trim()) {
				novosErros[`contato_tel_${idx}`] = "Telefone é obrigatório";
			}
		});

		if (Object.keys(novosErros).length > 0) {
			setErros(novosErros);
			return;
		}

		setSalvando(true);
		try {
			const payload = {
				cliente: {
					cnpj_cpf: normalizarCpfCnpj(cnpjCpf),
					razao_social: razaoSocial.trim(),
					nome_fantasia: nomeFantasia.trim() || null,
				},
				enderecos: enderecos.filter((end) => end.endereco_completo.trim()),
				contatos: contatos.filter((cont) => cont.nome.trim()),
			};

			if (clienteOriginal) {
				await atualizar(clienteOriginal.id, payload);
			} else {
				await criar(payload);
			}
			navigate("/clientes");
		} catch (err) {
			if (err instanceof ClienteInativoExistenteError) {
				setInativoConflitante(err.clienteInativo);
				if (err.campoConflito === "cnpj_cpf") {
					setErros((prev) => ({ ...prev, cnpj_cpf: err.message }));
				} else if (err.campoConflito === "razao_social") {
					setErros((prev) => ({ ...prev, razao_social: err.message }));
				} else if (err.campoConflito === "nome_fantasia") {
					setErros((prev) => ({ ...prev, nome_fantasia: err.message }));
				}
			} else if (err instanceof CpfCnpjDuplicadoError) {
				setErros((prev) => ({ ...prev, cnpj_cpf: err.message }));
			} else if (err instanceof RazaoSocialClienteDuplicadaError) {
				setErros((prev) => ({ ...prev, razao_social: err.message }));
			} else if (err instanceof NomeFantasiaClienteDuplicadoError) {
				setErros((prev) => ({ ...prev, nome_fantasia: err.message }));
			} else {
				setErroGeral(
					err instanceof Error ? err.message : "Erro ao salvar cliente",
				);
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<section className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
			<div>
				<Link
					to="/clientes"
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					← Clientes
				</Link>
				<h1 className="mt-1 text-2xl font-semibold text-foreground">
					{editando ? "Editar Cliente" : "Novo Cliente"}
				</h1>
			</div>

			<form
				noValidate
				onSubmit={handleSubmit}
				className="flex flex-col gap-6 rounded-lg border border-border bg-card p-4 shadow-sm"
			>
				{/* Dados Principais */}
				<div className="flex flex-col gap-4">
					<h2 className="text-lg font-medium text-foreground border-b border-border pb-2">
						Dados Gerais
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
								value={cnpjCpf}
								onChange={(e) => {
									setCnpjCpf(e.target.value);
									setErros((prev) => ({ ...prev, cnpj_cpf: "" }));
									setInativoConflitante(null);
								}}
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
								value={razaoSocial}
								onChange={(e) => {
									setRazaoSocial(e.target.value);
									setErros((prev) => ({ ...prev, razao_social: "" }));
									setInativoConflitante(null);
								}}
								autoComplete="off"
								hasError={Boolean(erros.razao_social)}
							/>
						</FormField>
					</div>

					<FormField
						id="nome_fantasia"
						label="Nome Fantasia (Opcional)"
						error={erros.nome_fantasia}
					>
						<Input
							id="nome_fantasia"
							value={nomeFantasia}
							onChange={(e) => {
								setNomeFantasia(e.target.value);
								setErros((prev) => ({ ...prev, nome_fantasia: "" }));
								setInativoConflitante(null);
							}}
							autoComplete="off"
							hasError={Boolean(erros.nome_fantasia)}
						/>
					</FormField>
				</div>

				{/* Endereços */}
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between border-b border-border pb-2">
						<h2 className="text-lg font-medium text-foreground">Endereços</h2>
						<Button
							variant="ghost"
							size="sm"
							onClick={adicionarEndereco}
							className="text-primary hover:text-primary"
						>
							+ Adicionar Endereço
						</Button>
					</div>

					{enderecos.length === 0 && (
						<p className="text-xs text-muted-foreground italic">
							Nenhum endereço cadastrado no momento.
						</p>
					)}

					{enderecos.map((end, idx) => (
						<div
							key={end.localId}
							className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3"
						>
							<div className="flex items-center justify-between gap-2">
								<select
									value={end.tipo_endereco}
									onChange={(e) =>
										alterarEndereco(idx, "tipo_endereco", e.target.value)
									}
									className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								>
									{TIPO_ENDERECO.map((tipo) => (
										<option key={tipo} value={tipo}>
											{tipo}
										</option>
									))}
								</select>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => removerEndereco(idx)}
								>
									Remover
								</Button>
							</div>
							<Input
								value={end.endereco_completo}
								onChange={(e) =>
									alterarEndereco(idx, "endereco_completo", e.target.value)
								}
								placeholder="Rua, número, complemento, bairro, cidade - UF"
								hasError={Boolean(erros[`endereco_${idx}`])}
							/>
							{erros[`endereco_${idx}`] && (
								<span role="alert" className="text-xs text-destructive">
									{erros[`endereco_${idx}`]}
								</span>
							)}
						</div>
					))}
				</div>

				{/* Contatos */}
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between border-b border-border pb-2">
						<h2 className="text-lg font-medium text-foreground">Contatos</h2>
						<Button
							variant="ghost"
							size="sm"
							onClick={adicionarContato}
							className="text-primary hover:text-primary"
						>
							+ Adicionar Contato
						</Button>
					</div>

					{contatos.length === 0 && (
						<p className="text-xs text-muted-foreground italic">
							Nenhum contato cadastrado no momento.
						</p>
					)}

					{contatos.map((cont, idx) => (
						<div
							key={cont.localId}
							className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3"
						>
							<div className="flex items-center justify-between gap-2">
								<select
									value={cont.papel ?? "COMPRADOR"}
									onChange={(e) => alterarContato(idx, "papel", e.target.value)}
									className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
								>
									{PAPEL_CONTATO.map((papel) => (
										<option key={papel} value={papel}>
											{papel}
										</option>
									))}
								</select>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => removerContato(idx)}
								>
									Remover
								</Button>
							</div>

							<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
								<div>
									<Input
										value={cont.nome}
										onChange={(e) =>
											alterarContato(idx, "nome", e.target.value)
										}
										placeholder="Nome do contato"
										hasError={Boolean(erros[`contato_nome_${idx}`])}
									/>
									{erros[`contato_nome_${idx}`] && (
										<span role="alert" className="text-xs text-destructive">
											{erros[`contato_nome_${idx}`]}
										</span>
									)}
								</div>
								<div>
									<Input
										value={cont.telefone_whatsapp}
										onChange={(e) =>
											alterarContato(idx, "telefone_whatsapp", e.target.value)
										}
										placeholder="Telefone / WhatsApp"
										hasError={Boolean(erros[`contato_tel_${idx}`])}
									/>
									{erros[`contato_tel_${idx}`] && (
										<span role="alert" className="text-xs text-destructive">
											{erros[`contato_tel_${idx}`]}
										</span>
									)}
								</div>
								<div>
									<Input
										value={cont.email ?? ""}
										onChange={(e) =>
											alterarContato(idx, "email", e.target.value)
										}
										placeholder="E-mail (opcional)"
									/>
								</div>
							</div>
						</div>
					))}
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

				<div className="flex justify-end gap-2 pt-2 border-t border-border">
					<Link to="/clientes">
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
