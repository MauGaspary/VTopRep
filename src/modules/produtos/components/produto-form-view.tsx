import { Factory } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	cardClassName,
	EmptyState,
	FormField,
	InactiveRecoveryCard,
	Input,
	PageHeader,
	Select,
} from "../../../shared/components/ui";
import { dataLocal } from "../../../shared/domain/datas";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { useRepresentadas } from "../../representadas/hooks/use-representadas";
import type { ItemPreco } from "../domain/item-preco.schema";
import {
	ProdutoInativoExistenteError,
	SkuDuplicadoError,
} from "../domain/produto";
import { type Produto, UNIDADES_MEDIDA_PADRAO } from "../domain/produto.schema";
import {
	type CampoPrecoTabelaForm,
	chaveErroPrecoTabela,
	type PrecosProdutoFormErros,
	type PrecoTabelaFormValues,
	type ProdutoFormErros,
	type ProdutoFormValues,
	validarFormularioProduto,
	validarPrecosProdutoForm,
	valoresIniciaisPrecosProdutoForm,
	valoresIniciaisProdutoForm,
} from "../domain/produto-form";
import { descreverVigencia, situacaoVigencia } from "../domain/tabela-preco";
import { useItensPrecoDoProduto, useTabelasEmUso } from "../hooks/use-precos";
import { useProduto, useProdutoActions } from "../hooks/use-produtos";

export function ProdutoFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { produto, isLoading: carregandoProduto } = useProduto(
		config.id,
		id,
		true,
	);
	const { representadas, isLoading: carregandoRepresentadas } =
		useRepresentadas(config.id);
	const { itensPorTabela, isLoading: carregandoItens } = useItensPrecoDoProduto(
		config.id,
		id,
	);

	if (id && (carregandoProduto || carregandoItens)) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando produto...
			</p>
		);
	}

	if (id && !produto) {
		return (
			<Page width="narrow">
				<p className="text-foreground">Produto não encontrado.</p>
				<Link to="/catalogo" className="text-sm text-primary underline">
					Voltar para o catálogo
				</Link>
			</Page>
		);
	}

	if (carregandoRepresentadas) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando representadas...
			</p>
		);
	}

	return (
		<ProdutoForm
			key={produto?.id ?? "novo"}
			tenantId={config.id}
			produto={produto ?? undefined}
			representadas={representadas}
			itensPorTabela={itensPorTabela}
		/>
	);
}

interface ProdutoFormProps {
	tenantId: string;
	produto?: Produto;
	representadas: Array<{ id: string; nome_fantasia: string }>;
	itensPorTabela: ReadonlyMap<string, ItemPreco>;
}

interface EdicaoPreco {
	preco_base?: string;
	desconto_maximo?: string;
}

function ProdutoForm({
	tenantId,
	produto,
	representadas,
	itensPorTabela,
}: ProdutoFormProps) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { criar, atualizar, reativar } = useProdutoActions(tenantId);
	const hoje = dataLocal(new Date());

	const paramRepId = searchParams.get("representada");
	const defaultRepId =
		paramRepId && representadas.some((r) => r.id === paramRepId)
			? paramRepId
			: representadas.length > 0
				? representadas[0].id
				: "";

	const [valores, setValores] = useState<ProdutoFormValues>(() =>
		valoresIniciaisProdutoForm(produto, defaultRepId),
	);
	const destinoCatalogo = valores.representada_id
		? `/catalogo?representada=${valores.representada_id}`
		: "/catalogo";
	const [edicoesPreco, setEdicoesPreco] = useState<Record<string, EdicaoPreco>>(
		{},
	);
	const [erros, setErros] = useState<ProdutoFormErros>({});
	const [errosPrecos, setErrosPrecos] = useState<PrecosProdutoFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [inativoConflitante, setInativoConflitante] = useState<Produto | null>(
		null,
	);
	const [salvando, setSalvando] = useState(false);

	const { tabelas: tabelasEmUso, isLoading: carregandoTabelas } =
		useTabelasEmUso(tenantId, valores.representada_id || undefined, hoje);

	const linhasPreco = useMemo<PrecoTabelaFormValues[]>(() => {
		const base = valoresIniciaisPrecosProdutoForm(tabelasEmUso, itensPorTabela);
		return base.map((linha) => {
			const edicao = edicoesPreco[linha.tabela_id];
			if (!edicao) return linha;
			return {
				...linha,
				preco_base: edicao.preco_base ?? linha.preco_base,
				desconto_maximo: edicao.desconto_maximo ?? linha.desconto_maximo,
			};
		});
	}, [tabelasEmUso, itensPorTabela, edicoesPreco]);

	const editando = produto !== undefined;

	const alterar = (campo: keyof ProdutoFormValues, valor: string) => {
		setValores((atual) => ({ ...atual, [campo]: valor }));
		setErros((atual) => ({ ...atual, [campo]: undefined }));
		setInativoConflitante(null);
	};

	const alterarPrecoTabela = (
		tabelaId: string,
		campo: CampoPrecoTabelaForm,
		valor: string,
	) => {
		setEdicoesPreco((atual) => ({
			...atual,
			[tabelaId]: {
				...atual[tabelaId],
				[campo]: valor,
			},
		}));
		const chave = chaveErroPrecoTabela(tabelaId, campo);
		setErrosPrecos((atual) => ({ ...atual, [chave]: undefined }));
	};

	const handleReativar = async () => {
		if (!inativoConflitante) return;
		setSalvando(true);
		setErroGeral(null);
		try {
			await reativar(inativoConflitante.id);
			navigate(destinoCatalogo);
		} catch (err) {
			setErroGeral(mensagemDeErro(err, "Erro ao reativar produto"));
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setErroGeral(null);
		setInativoConflitante(null);

		const validacao = validarFormularioProduto(valores);
		const validacaoPrecos = validarPrecosProdutoForm(linhasPreco);

		if (!validacao.success || !validacaoPrecos.success) {
			setErros(validacao.success ? {} : validacao.erros);
			setErrosPrecos(validacaoPrecos.success ? {} : validacaoPrecos.erros);
			setErroGeral(
				(!validacao.success ? validacao.geral : null) ??
					(!validacaoPrecos.success ? validacaoPrecos.geral : null),
			);
			return;
		}

		setErros({});
		setErrosPrecos({});
		setSalvando(true);
		try {
			if (editando) {
				await atualizar(produto.id, validacao.data, validacaoPrecos.data);
			} else {
				await criar(validacao.data, validacaoPrecos.data);
			}
			navigate(`/catalogo?representada=${validacao.data.representada_id}`);
		} catch (err) {
			if (err instanceof ProdutoInativoExistenteError) {
				setInativoConflitante(err.produtoInativo);
				setErros((atual) => ({ ...atual, sku: err.message }));
			} else if (err instanceof SkuDuplicadoError) {
				setErros((atual) => ({ ...atual, sku: err.message }));
			} else {
				setErroGeral(mensagemDeErro(err, "Erro ao salvar produto"));
			}
		} finally {
			setSalvando(false);
		}
	};

	return (
		<Page width="form">
			<PageHeader
				title={editando ? "Editar produto" : "Novo produto"}
				back={{ to: destinoCatalogo, label: "Catálogo" }}
			/>

			{representadas.length === 0 ? (
				<EmptyState
					icon={Factory}
					title="Nenhuma representada ativa cadastrada"
					description="É obrigatório vincular o produto a uma representada."
					action={
						<Link to="/representadas/nova" className={buttonClassName()}>
							Cadastrar representada
						</Link>
					}
				/>
			) : (
				<form
					noValidate
					onSubmit={handleSubmit}
					className={cardClassName({
						className: "flex flex-col gap-6 p-4 md:p-6",
					})}
				>
					<div className="flex flex-col gap-5">
						<h2 className="border-b border-border pb-2 text-sm font-semibold text-foreground">
							Dados do produto
						</h2>

						<FormField
							id="representada_id"
							label="Representada vinculada"
							error={erros.representada_id}
							required
						>
							<Select
								id="representada_id"
								value={valores.representada_id}
								onChange={(e) => alterar("representada_id", e.target.value)}
								hasError={Boolean(erros.representada_id)}
							>
								<option value="">Selecione a representada...</option>
								{representadas.map((r) => (
									<option key={r.id} value={r.id}>
										{r.nome_fantasia}
									</option>
								))}
							</Select>
						</FormField>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div className="sm:col-span-1">
								<FormField
									id="sku"
									label="Código / SKU"
									error={erros.sku}
									required
								>
									<Input
										id="sku"
										value={valores.sku}
										onChange={(e) => alterar("sku", e.target.value)}
										placeholder="Ex: PROD-001"
										autoComplete="off"
										hasError={Boolean(erros.sku)}
										className="font-mono uppercase"
									/>
								</FormField>
							</div>

							<div className="sm:col-span-2">
								<FormField
									id="descricao"
									label="Descrição do produto"
									error={erros.descricao}
									required
								>
									<Input
										id="descricao"
										value={valores.descricao}
										onChange={(e) => alterar("descricao", e.target.value)}
										placeholder="Ex: Parafuso Sextavado Aço Inox 1/2"
										autoComplete="off"
										hasError={Boolean(erros.descricao)}
									/>
								</FormField>
							</div>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<FormField
								id="unidade_medida"
								label="Unidade de medida"
								error={erros.unidade_medida}
								required
							>
								<div className="flex flex-col gap-2">
									<Input
										id="unidade_medida"
										value={valores.unidade_medida}
										onChange={(e) => alterar("unidade_medida", e.target.value)}
										placeholder="Ex: UN, CX, KG"
										autoComplete="off"
										hasError={Boolean(erros.unidade_medida)}
										className="uppercase"
									/>
									<div className="flex flex-wrap gap-1">
										{UNIDADES_MEDIDA_PADRAO.map((unidade) => {
											const selecionada =
												valores.unidade_medida.toUpperCase() === unidade;
											return (
												<button
													key={unidade}
													type="button"
													aria-pressed={selecionada}
													onClick={() => alterar("unidade_medida", unidade)}
													className="cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
												>
													<Badge variant={selecionada ? "default" : "outline"}>
														{unidade}
													</Badge>
												</button>
											);
										})}
									</div>
								</div>
							</FormField>

							<FormField
								id="multiplo_embalagem"
								label="Múltiplo de embalagem"
								error={erros.multiplo_embalagem}
								help="Quantidade mínima de venda por fardo/caixa (padrão: 1)"
							>
								<Input
									id="multiplo_embalagem"
									inputMode="numeric"
									value={valores.multiplo_embalagem}
									onChange={(e) =>
										alterar("multiplo_embalagem", e.target.value)
									}
									hasError={Boolean(erros.multiplo_embalagem)}
								/>
							</FormField>
						</div>
					</div>

					{/* Preços por tabela da representada */}
					<div className="flex flex-col gap-3">
						<div className="border-b border-border pb-2">
							<h2 className="text-sm font-semibold text-foreground">
								Preços por tabela
							</h2>
							<p className="text-xs text-muted-foreground">
								Informe o preço base nas tabelas ativas da representada. Deixe
								em branco caso o produto não participe de uma tabela específica.
							</p>
						</div>

						{!valores.representada_id && (
							<p className="text-xs text-muted-foreground italic">
								Selecione uma representada acima para informar os preços.
							</p>
						)}

						{valores.representada_id && carregandoTabelas && (
							<p className="text-xs text-muted-foreground">
								Carregando tabelas de preço...
							</p>
						)}

						{valores.representada_id &&
							!carregandoTabelas &&
							linhasPreco.length === 0 && (
								<div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
									<span>
										Nenhuma tabela de preço ativa encontrada para esta
										representada.
									</span>
									<Link
										to={`/representadas/${valores.representada_id}/editar`}
										className="font-medium text-primary underline"
									>
										Gerenciar tabelas
									</Link>
								</div>
							)}

						{linhasPreco.map((linha) => {
							const erroPreco =
								errosPrecos[
									chaveErroPrecoTabela(linha.tabela_id, "preco_base")
								];
							const erroDesconto =
								errosPrecos[
									chaveErroPrecoTabela(linha.tabela_id, "desconto_maximo")
								];
							const situacao = situacaoVigencia(linha, hoje);

							return (
								<div
									key={linha.tabela_id}
									className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-foreground">
												{linha.nome_tabela}
											</span>
											<Badge
												variant={
													situacao === "vigente" ? "success" : "secondary"
												}
											>
												{situacao === "vigente" ? "Vigente" : "Vigência futura"}
											</Badge>
										</div>
										<span className="text-xs text-muted-foreground">
											{descreverVigencia(linha)}
										</span>
									</div>

									<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
										<FormField
											id={`preco-base-${linha.tabela_id}`}
											label="Preço base (R$)"
											error={erroPreco}
										>
											<Input
												id={`preco-base-${linha.tabela_id}`}
												inputMode="decimal"
												placeholder="0,00"
												value={linha.preco_base}
												onChange={(e) =>
													alterarPrecoTabela(
														linha.tabela_id,
														"preco_base",
														e.target.value,
													)
												}
												hasError={Boolean(erroPreco)}
											/>
										</FormField>

										<FormField
											id={`desconto-max-${linha.tabela_id}`}
											label="Desconto máximo (%)"
											error={erroDesconto}
											help="Informativo (padrão: 0,00%)"
										>
											<Input
												id={`desconto-max-${linha.tabela_id}`}
												inputMode="decimal"
												placeholder="0,00"
												value={linha.desconto_maximo}
												onChange={(e) =>
													alterarPrecoTabela(
														linha.tabela_id,
														"desconto_maximo",
														e.target.value,
													)
												}
												hasError={Boolean(erroDesconto)}
											/>
										</FormField>
									</div>
								</div>
							);
						})}
					</div>

					{inativoConflitante && (
						<InactiveRecoveryCard
							title="Produto inativo encontrado com este SKU:"
							entityName={`${inativoConflitante.sku} - ${inativoConflitante.descricao}`}
							onReativar={handleReativar}
							isLoading={salvando}
						/>
					)}

					{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

					<div className="flex justify-end gap-2 border-t border-border pt-4">
						<Link
							to={destinoCatalogo}
							className={buttonClassName({ variant: "ghost" })}
						>
							Cancelar
						</Link>
						<Button type="submit" disabled={salvando}>
							{salvando ? "Salvando..." : "Salvar produto"}
						</Button>
					</div>
				</form>
			)}
		</Page>
	);
}
