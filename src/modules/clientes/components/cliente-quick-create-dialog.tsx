import { X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
	Alert,
	Button,
	FormField,
	HomonymWarning,
	InactiveRecoveryCard,
	Input,
} from "../../../shared/components/ui";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import {
	ClienteInativoExistenteError,
	CpfCnpjDuplicadoError,
} from "../domain/cliente";
import {
	type Cliente,
	ROTULOS_TIPO_CLIENTE,
	TIPOS_CLIENTE,
} from "../domain/cliente.schema";
import {
	type ClienteFormErros,
	type ClienteFormValues,
	chaveErroContato,
	chaveErroEndereco,
	novoContatoForm,
	novoEnderecoForm,
	validarFormularioCliente,
	valoresIniciaisCadastroRapidoCliente,
} from "../domain/cliente-form";
import { useClienteActions, useHomonimosCliente } from "../hooks/use-clientes";

export interface ClienteQuickCreateDialogProps {
	open: boolean;
	tenantId: string;
	termoInicial?: string;
	onClose: () => void;
	onClienteCriado: (clienteId: string) => void;
}

const gerarLocalId = () => crypto.randomUUID();

export function ClienteQuickCreateDialog({
	open,
	tenantId,
	termoInicial = "",
	onClose,
	onClienteCriado,
}: ClienteQuickCreateDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const { criar, reativar } = useClienteActions(tenantId);

	const [valores, setValores] = useState<ClienteFormValues>(() =>
		valoresIniciaisCadastroRapidoCliente(termoInicial),
	);
	const [enderecoPrincipal, setEnderecoPrincipal] = useState("");
	const [contatoNome, setContatoNome] = useState("");
	const [contatoTelefone, setContatoTelefone] = useState("");
	const [erros, setErros] = useState<ClienteFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [inativoConflitante, setInativoConflitante] = useState<Cliente | null>(
		null,
	);
	const [salvando, setSalvando] = useState(false);

	// Reinicializa os campos quando o modal abre com novo termo digitado
	useEffect(() => {
		if (!open) return;
		setValores(valoresIniciaisCadastroRapidoCliente(termoInicial));
		setEnderecoPrincipal("");
		setContatoNome("");
		setContatoTelefone("");
		setErros({});
		setErroGeral(null);
		setInativoConflitante(null);
	}, [open, termoInicial]);

	// Gerencia abertura via showModal(), atributo closedby="any" e fallback de light-dismiss
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		dialog.setAttribute("closedby", "any");

		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}

		const handleClose = () => {
			onClose();
		};
		dialog.addEventListener("close", handleClose);

		let removerClickFallback: (() => void) | undefined;
		if (!("closedBy" in HTMLDialogElement.prototype)) {
			const handleBackdropClick = (event: MouseEvent) => {
				if (event.target !== dialog) return;
				const rect = dialog.getBoundingClientRect();
				const isDialogContent =
					rect.top <= event.clientY &&
					event.clientY <= rect.top + rect.height &&
					rect.left <= event.clientX &&
					event.clientX <= rect.left + rect.width;
				if (!isDialogContent) {
					dialog.close();
				}
			};
			dialog.addEventListener("click", handleBackdropClick);
			removerClickFallback = () =>
				dialog.removeEventListener("click", handleBackdropClick);
		}

		return () => {
			dialog.removeEventListener("close", handleClose);
			removerClickFallback?.();
		};
	}, [open, onClose]);

	const homonimos = useHomonimosCliente(tenantId, {
		razao_social: valores.razao_social,
		nome_fantasia: valores.nome_fantasia,
	});

	const alterarCampo = (
		campo: "cnpj_cpf" | "razao_social" | "nome_fantasia" | "tipo_cliente",
		valor: string,
	) => {
		setValores((atual) => ({ ...atual, [campo]: valor }));
		setErros((atual) => ({ ...atual, [campo]: undefined }));
		setInativoConflitante(null);
	};

	const handleReativarExistente = async () => {
		if (!inativoConflitante) return;
		setSalvando(true);
		setErroGeral(null);
		try {
			await reativar(inativoConflitante.id);
			onClienteCriado(inativoConflitante.id);
		} catch (err) {
			setErroGeral(mensagemDeErro(err, "Erro ao reativar cliente"));
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setErroGeral(null);
		setInativoConflitante(null);

		const enderecosParaValidar =
			enderecoPrincipal.trim() !== ""
				? [
						{
							...novoEnderecoForm(gerarLocalId),
							tipo_endereco: "PRINCIPAL",
							endereco_completo: enderecoPrincipal,
						},
					]
				: [];

		const contatosParaValidar =
			contatoNome.trim() !== "" || contatoTelefone.trim() !== ""
				? [
						{
							...novoContatoForm(gerarLocalId),
							nome: contatoNome,
							papel: "COMPRADOR",
							telefone_whatsapp: contatoTelefone,
							email: "",
						},
					]
				: [];

		const validacao = validarFormularioCliente({
			...valores,
			enderecos: enderecosParaValidar,
			contatos: contatosParaValidar,
		});

		if (!validacao.success) {
			setErros(validacao.erros);
			setErroGeral(validacao.geral);
			return;
		}

		setErros({});
		setSalvando(true);
		try {
			const salvo = await criar(validacao.data);
			onClienteCriado(salvo.cliente.id);
		} catch (err) {
			if (err instanceof ClienteInativoExistenteError) {
				setInativoConflitante(err.clienteInativo);
				setErros({ cnpj_cpf: err.message });
			} else if (err instanceof CpfCnpjDuplicadoError) {
				setErros({ cnpj_cpf: err.message });
			} else {
				setErroGeral(mensagemDeErro(err, "Erro ao cadastrar cliente"));
			}
		} finally {
			setSalvando(false);
		}
	};

	const erroEndereco = erros[chaveErroEndereco(0, "endereco_completo")];
	const erroContatoNome = erros[chaveErroContato(0, "nome")];
	const erroContatoTelefone = erros[chaveErroContato(0, "telefone_whatsapp")];

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="quick-create-cliente-title"
			className="m-auto w-full max-w-lg rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
		>
			<form
				noValidate
				onSubmit={handleSubmit}
				className="flex flex-col gap-4 p-4 md:p-5"
			>
				<div className="flex items-start justify-between gap-2 border-b border-border pb-3">
					<div>
						<h2
							id="quick-create-cliente-title"
							className="text-base font-semibold text-foreground"
						>
							Cadastro rápido de cliente
						</h2>
						<p className="text-xs text-muted-foreground">
							O cliente será salvo na carteira e selecionado imediatamente neste
							orçamento.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Fechar janela"
						className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<X aria-hidden="true" className="size-4" />
					</button>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<FormField
						id="quick-cliente-cnpj-cpf"
						label="CPF ou CNPJ"
						error={erros.cnpj_cpf}
						required
					>
						<Input
							id="quick-cliente-cnpj-cpf"
							autoFocus
							value={valores.cnpj_cpf}
							onChange={(e) => alterarCampo("cnpj_cpf", e.target.value)}
							placeholder="00.000.000/0000-00"
							autoComplete="off"
							hasError={Boolean(erros.cnpj_cpf)}
							className="font-mono uppercase"
						/>
					</FormField>

					<FormField
						id="quick-cliente-fantasia"
						label="Nome Fantasia (opcional)"
						error={erros.nome_fantasia}
					>
						<Input
							id="quick-cliente-fantasia"
							value={valores.nome_fantasia}
							onChange={(e) => alterarCampo("nome_fantasia", e.target.value)}
							placeholder="Ex: Mercado Central"
							autoComplete="off"
							hasError={Boolean(erros.nome_fantasia)}
						/>
					</FormField>
				</div>

				<FormField
					id="quick-cliente-razao"
					label="Razão Social ou Nome Completo"
					error={erros.razao_social}
					required
				>
					<Input
						id="quick-cliente-razao"
						value={valores.razao_social}
						onChange={(e) => alterarCampo("razao_social", e.target.value)}
						placeholder="Ex: Comércio de Alimentos Central Ltda"
						autoComplete="off"
						hasError={Boolean(erros.razao_social)}
					/>
				</FormField>

				<fieldset className="flex flex-col gap-1.5">
					<legend className="text-xs font-medium text-muted-foreground">
						Segmento comercial (comissão)
					</legend>
					<div className="grid grid-cols-2 gap-2">
						{TIPOS_CLIENTE.map((tipo) => {
							const selecionado = valores.tipo_cliente === tipo;
							return (
								<label
									key={tipo}
									className={`flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors select-none ${
										selecionado
											? "border-primary bg-primary/10 text-foreground"
											: "border-border bg-secondary/50 text-muted-foreground hover:bg-muted hover:text-foreground"
									}`}
								>
									<input
										type="radio"
										name="quick_tipo_cliente"
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
				</fieldset>

				<HomonymWarning
					title="Já existe cliente com este nome na carteira:"
					description="Nomes repetidos são permitidos (ex.: filiais). Confira se não é duplicado."
					items={homonimos.map(({ registro }) => ({
						id: registro.id,
						nome: registro.nome_fantasia
							? `${registro.razao_social} · ${registro.nome_fantasia}`
							: registro.razao_social,
						detalhe: formatarCpfCnpj(registro.cnpj_cpf),
						inativo: !registro.ativo,
					}))}
				/>

				<div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
					<span className="text-xs font-medium text-muted-foreground">
						Entrega e comprador (opcionais agora)
					</span>

					<FormField
						id="quick-cliente-endereco"
						label="Endereço principal / entrega"
						error={erroEndereco}
					>
						<Input
							id="quick-cliente-endereco"
							value={enderecoPrincipal}
							onChange={(e) => {
								setEnderecoPrincipal(e.target.value);
								setErros((atual) => ({
									...atual,
									[chaveErroEndereco(0, "endereco_completo")]: undefined,
								}));
							}}
							placeholder="Rua, número, bairro, cidade - UF"
							autoComplete="off"
							hasError={Boolean(erroEndereco)}
						/>
					</FormField>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<FormField
							id="quick-cliente-contato-nome"
							label="Nome do comprador"
							error={erroContatoNome}
						>
							<Input
								id="quick-cliente-contato-nome"
								value={contatoNome}
								onChange={(e) => {
									setContatoNome(e.target.value);
									setErros((atual) => ({
										...atual,
										[chaveErroContato(0, "nome")]: undefined,
									}));
								}}
								placeholder="Ex: Carlos"
								autoComplete="off"
								hasError={Boolean(erroContatoNome)}
							/>
						</FormField>

						<FormField
							id="quick-cliente-contato-tel"
							label="Telefone / WhatsApp"
							error={erroContatoTelefone}
						>
							<Input
								id="quick-cliente-contato-tel"
								value={contatoTelefone}
								onChange={(e) => {
									setContatoTelefone(e.target.value);
									setErros((atual) => ({
										...atual,
										[chaveErroContato(0, "telefone_whatsapp")]: undefined,
									}));
								}}
								placeholder="(51) 99999-9999"
								autoComplete="off"
								hasError={Boolean(erroContatoTelefone)}
							/>
						</FormField>
					</div>
				</div>

				{inativoConflitante && (
					<InactiveRecoveryCard
						title="Cliente inativo encontrado com este documento:"
						entityName={inativoConflitante.razao_social}
						details={formatarCpfCnpj(inativoConflitante.cnpj_cpf)}
						onReativar={handleReativarExistente}
						isLoading={salvando}
					/>
				)}

				{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

				<div className="flex justify-end gap-2 border-t border-border pt-3">
					<Button variant="ghost" onClick={onClose} disabled={salvando}>
						Cancelar
					</Button>
					<Button type="submit" disabled={salvando}>
						{salvando ? "Salvando..." : "Salvar e selecionar"}
					</Button>
				</div>
			</form>
		</dialog>
	);
}
