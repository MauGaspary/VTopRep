import { Plus } from "lucide-react";
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
	ESTILOS_COR_REPRESENTADA,
	FormField,
	InactiveRecoveryCard,
	Input,
	PageHeader,
	RepresentadaBadge,
	Select,
} from "../../../shared/components/ui";
import { dataLocal } from "../../../shared/domain/datas";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE, TIPOS_FRETE } from "../../../shared/domain/frete";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import { useTabelasDaRepresentada } from "../../produtos/hooks/use-precos";
import {
	CnpjDuplicadoError,
	obterCorRepresentada,
	RepresentadaInativaExistenteError,
	ROTULOS_COR_REPRESENTADA,
} from "../domain/representada";
import {
	CORES_REPRESENTADA,
	type CorRepresentada,
	type Representada,
} from "../domain/representada.schema";
import {
	type CampoTabelaPrecoForm,
	chaveErroTabelaPreco,
	novaTabelaPrecoForm,
	type RepresentadaFormErros,
	type RepresentadaFormValues,
	type TabelaPrecoFormValues,
	type TabelasPrecoFormErros,
	validarFormularioRepresentada,
	validarTabelasPrecoForm,
	valoresIniciaisFormulario,
	valoresIniciaisTabelasPrecoForm,
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
	const { tabelas, isLoading: carregandoTabelas } = useTabelasDaRepresentada(
		config.id,
		id,
	);

	if (id && (isLoading || carregandoTabelas)) {
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
			key={`${representada?.id ?? "nova"}:${tabelas.length}`}
			tenantId={config.id}
			representada={representada ?? undefined}
			tabelasIniciais={id ? tabelas : undefined}
		/>
	);
}

interface RepresentadaFormProps {
	tenantId: string;
	representada?: Representada;
	tabelasIniciais?: readonly TabelaPreco[];
}

const gerarLocalId = () => crypto.randomUUID();

function RepresentadaForm({
	tenantId,
	representada,
	tabelasIniciais,
}: RepresentadaFormProps) {
	const navigate = useNavigate();
	const { criar, atualizar, reativar } = useRepresentadaActions(tenantId);
	const hoje = dataLocal(new Date());

	const [valores, setValores] = useState<RepresentadaFormValues>(() =>
		valoresIniciaisFormulario(representada),
	);
	const [tabelas, setTabelas] = useState<TabelaPrecoFormValues[]>(() =>
		valoresIniciaisTabelasPrecoForm(tabelasIniciais, hoje, gerarLocalId),
	);
	const [erros, setErros] = useState<RepresentadaFormErros>({});
	const [errosTabelas, setErrosTabelas] = useState<TabelasPrecoFormErros>({});
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

	const adicionarTabela = () => {
		setTabelas((atual) => [
			...atual,
			novaTabelaPrecoForm(gerarLocalId, hoje, ""),
		]);
	};

	const removerTabelaNova = (index: number) => {
		setTabelas((atual) => atual.filter((_, i) => i !== index));
		setErrosTabelas({});
	};

	const alterarTabela = (
		index: number,
		campo: CampoTabelaPrecoForm,
		valor: string,
	) => {
		setTabelas((atual) =>
			atual.map((tab, i) => (i === index ? { ...tab, [campo]: valor } : tab)),
		);
		const chave = chaveErroTabelaPreco(index, campo);
		setErrosTabelas((atual) => ({ ...atual, [chave]: undefined }));
	};

	const alterarStatusTabela = (index: number, ativo: boolean) => {
		setTabelas((atual) =>
			atual.map((tab, i) => (i === index ? { ...tab, ativo } : tab)),
		);
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
		const resultadoTabelas = validarTabelasPrecoForm(tabelas);

		if (!resultado.success || !resultadoTabelas.success) {
			setErros(resultado.success ? {} : resultado.erros);
			setErrosTabelas(resultadoTabelas.success ? {} : resultadoTabelas.erros);
			setErroGeral(
				(!resultado.success ? resultado.geral : null) ??
					(!resultadoTabelas.success ? resultadoTabelas.geral : null),
			);
			return;
		}

		setErros({});
		setErrosTabelas({});
		setSalvando(true);
		try {
			if (representada) {
				await atualizar(representada.id, resultado.data, resultadoTabelas.data);
			} else {
				await criar(resultado.data, resultadoTabelas.data);
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
		<Page width="form">
			<PageHeader
				title={editando ? "Editar representada" : "Nova representada"}
				back={{ to: "/representadas", label: "Representadas" }}
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
						Dados da fábrica
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
						label="Razão social"
						error={erros.razao_social}
						required
					>
						<Input
							id="razao_social"
							value={valores.razao_social}
							onChange={(e) => alterar("razao_social", e.target.value)}
							autoComplete="off"
							hasError={Boolean(erros.razao_social)}
						/>
					</FormField>

					<FormField id="cnpj" label="CNPJ" error={erros.cnpj} required>
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
							required
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

					<FormField
						id="cor_representada"
						label="Cor identificadora no catálogo"
						error={erros.cor}
						help="Facilita diferenciar visualmente a fábrica no catálogo e nos pedidos."
					>
						<div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
							<div
								role="radiogroup"
								aria-label="Cor identificadora da representada"
								className="flex flex-wrap items-center gap-2"
							>
								<button
									type="button"
									onClick={() => alterar("cor", "")}
									aria-pressed={!valores.cor}
									className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium transition-colors ${
										!valores.cor
											? "border-primary bg-primary/10 text-foreground"
											: "border-border bg-secondary text-muted-foreground hover:text-foreground"
									}`}
								>
									Automática
								</button>
								{CORES_REPRESENTADA.map((corOpcao: CorRepresentada) => {
									const selecionada = valores.cor === corOpcao;
									const estilo = ESTILOS_COR_REPRESENTADA[corOpcao];
									return (
										<button
											key={corOpcao}
											type="button"
											title={ROTULOS_COR_REPRESENTADA[corOpcao]}
											aria-label={`Cor ${ROTULOS_COR_REPRESENTADA[corOpcao]}`}
											aria-pressed={selecionada}
											onClick={() => alterar("cor", corOpcao)}
											className={`inline-flex size-7 items-center justify-center rounded-md border transition-transform ${
												selecionada
													? "scale-105 border-foreground bg-muted ring-2 ring-ring/40"
													: "border-border bg-card hover:bg-muted"
											}`}
										>
											<span className={`size-3.5 rounded-full ${estilo.dot}`} />
										</button>
									);
								})}
							</div>

							<RepresentadaBadge
								nome={valores.nome_fantasia.trim() || "Prévia da fábrica"}
								cor={obterCorRepresentada({
									id: representada?.id ?? (valores.nome_fantasia || "nova"),
									cor: CORES_REPRESENTADA.find((c) => c === valores.cor),
								})}
							/>
						</div>
					</FormField>
				</div>

				{/* Tabelas de Preço */}
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between border-b border-border pb-2">
						<div>
							<h2 className="text-sm font-semibold text-foreground">
								Tabelas de preço
							</h2>
							<p className="text-xs text-muted-foreground">
								Os preços dos produtos serão informados para cada tabela ativa.
							</p>
						</div>
						<Button variant="ghost" size="sm" onClick={adicionarTabela}>
							<Plus aria-hidden="true" />
							Adicionar tabela
						</Button>
					</div>

					{tabelas.map((tab, idx) => {
						const erroNome =
							errosTabelas[chaveErroTabelaPreco(idx, "nome_tabela")];
						const erroInicio =
							errosTabelas[chaveErroTabelaPreco(idx, "vigencia_inicio")];
						const erroFim =
							errosTabelas[chaveErroTabelaPreco(idx, "vigencia_fim")];

						return (
							<div
								key={tab.localId}
								className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3"
							>
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<Badge variant={tab.ativo ? "success" : "secondary"}>
											{tab.ativo ? "Ativa" : "Inativa"}
										</Badge>
										{tab.id && (
											<span className="text-xs text-muted-foreground">
												Tabela salva
											</span>
										)}
									</div>
									<div className="flex items-center gap-2">
										{tab.id ? (
											<Button
												variant="secondary"
												size="sm"
												onClick={() => alterarStatusTabela(idx, !tab.ativo)}
											>
												{tab.ativo ? "Inativar tabela" : "Reativar tabela"}
											</Button>
										) : (
											tabelas.length > 1 && (
												<Button
													variant="destructive"
													size="sm"
													onClick={() => removerTabelaNova(idx)}
												>
													Remover
												</Button>
											)
										)}
									</div>
								</div>

								<FormField
									id={`tabela-nome-${tab.localId}`}
									label="Nome da tabela"
									error={erroNome}
									required
								>
									<Input
										id={`tabela-nome-${tab.localId}`}
										value={tab.nome_tabela}
										onChange={(e) =>
											alterarTabela(idx, "nome_tabela", e.target.value)
										}
										placeholder="Ex: Tabela Padrão, Atacado, Promocional..."
										autoComplete="off"
										hasError={Boolean(erroNome)}
									/>
								</FormField>

								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<FormField
										id={`tabela-inicio-${tab.localId}`}
										label="Início da vigência"
										error={erroInicio}
										required
									>
										<Input
											id={`tabela-inicio-${tab.localId}`}
											type="date"
											value={tab.vigencia_inicio}
											onChange={(e) =>
												alterarTabela(idx, "vigencia_inicio", e.target.value)
											}
											hasError={Boolean(erroInicio)}
										/>
									</FormField>

									<FormField
										id={`tabela-fim-${tab.localId}`}
										label="Fim da vigência (opcional)"
										error={erroFim}
										help="Deixe em branco para vigência em aberto"
									>
										<Input
											id={`tabela-fim-${tab.localId}`}
											type="date"
											value={tab.vigencia_fim}
											onChange={(e) =>
												alterarTabela(idx, "vigencia_fim", e.target.value)
											}
											hasError={Boolean(erroFim)}
										/>
									</FormField>
								</div>
							</div>
						);
					})}
				</div>

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
