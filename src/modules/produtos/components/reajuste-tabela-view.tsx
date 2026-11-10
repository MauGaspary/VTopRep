import { CheckCircle2, Percent } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Button,
	buttonClassName,
	CartaoLista,
	CartaoListaTopo,
	cardClassName,
	EmptyState,
	FormField,
	Input,
	ListaCards,
	ListaResponsiva,
	ListaTabela,
	PageHeader,
	Select,
} from "../../../shared/components/ui";
import { dataLocal, formatarDataBr } from "../../../shared/domain/datas";
import { formatarCentavos } from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { useRepresentada } from "../../representadas/hooks/use-representadas";
import { escolherTabelaSugerida, listarTabelasVigentes } from "../domain/preco";
import type { Produto } from "../domain/produto.schema";
import {
	type ReajusteFormValues,
	reajustarPreco,
	sugerirInicioReajuste,
	sugerirNomeReajuste,
	validarReajusteForm,
} from "../domain/reajuste-tabela";
import { descreverVigencia, diaAnterior } from "../domain/tabela-preco";
import type { TabelaPreco } from "../domain/tabela-preco.schema";
import {
	useItensDaTabela,
	useReajusteTabela,
	useTabelasDaRepresentada,
} from "../hooks/use-precos";
import { useTodosProdutos } from "../hooks/use-produtos";
import type { ResultadoReajuste } from "../repositories/preco.repository";

const LIMITE_LINHAS = 200;

/** Clonar uma tabela da representada com reajuste percentual e nova vigência. */
export function ReajusteTabelaView() {
	const { id } = useParams();
	const [searchParams] = useSearchParams();
	const { config } = useTenant();
	const tenantId = config.id;
	const hoje = useMemo(() => dataLocal(new Date()), []);
	const { representada, isLoading: carregandoRep } = useRepresentada(
		tenantId,
		id,
	);
	const { tabelas, isLoading: carregandoTabelas } = useTabelasDaRepresentada(
		tenantId,
		id,
	);

	if (carregandoRep || carregandoTabelas) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando tabelas...
			</p>
		);
	}
	if (!id || !representada) {
		return (
			<Page width="narrow">
				<p className="text-foreground">Representada não encontrada.</p>
				<Link to="/representadas" className="text-sm text-primary underline">
					Voltar para a lista
				</Link>
			</Page>
		);
	}

	const pedida = tabelas.find((t) => t.id === searchParams.get("tabela"));
	const inicial =
		pedida ??
		escolherTabelaSugerida(listarTabelasVigentes(tabelas, hoje)) ??
		tabelas[0] ??
		null;

	return (
		<Page width="form">
			<PageHeader
				title="Reajustar tabela de preço"
				description={`${representada.nome_fantasia}: cria uma nova tabela com todos os preços reajustados.`}
				back={{
					to: `/representadas/${representada.id}/editar`,
					label: representada.nome_fantasia,
				}}
			/>
			{tabelas.length === 0 || !inicial ? (
				<EmptyState
					icon={Percent}
					title="Esta representada não tem tabelas de preço."
					description="Cadastre uma tabela na representada antes de reajustar."
				/>
			) : (
				<FormularioReajuste
					tenantId={tenantId}
					representadaId={representada.id}
					tabelas={tabelas}
					origemInicial={inicial}
					hoje={hoje}
				/>
			)}
		</Page>
	);
}

function FormularioReajuste({
	tenantId,
	representadaId,
	tabelas,
	origemInicial,
	hoje,
}: {
	tenantId: string;
	representadaId: string;
	tabelas: readonly TabelaPreco[];
	origemInicial: TabelaPreco;
	hoje: string;
}) {
	const { reajustar } = useReajusteTabela(tenantId);
	const { produtos } = useTodosProdutos(tenantId, undefined, representadaId);
	const [valores, setValores] = useState<ReajusteFormValues>(() => ({
		tabela_origem_id: origemInicial.id,
		tipo: "aumento",
		percentual: "",
		nome_tabela: origemInicial.nome_tabela,
		vigencia_inicio: sugerirInicioReajuste(origemInicial, hoje),
		vigencia_fim: "",
	}));
	const [nomeEditado, setNomeEditado] = useState(false);
	const [tentouGravar, setTentouGravar] = useState(false);
	const [gravando, setGravando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const [resultado, setResultado] = useState<ResultadoReajuste | null>(null);

	const origem = tabelas.find((t) => t.id === valores.tabela_origem_id) ?? null;
	const { itensPorProduto, isLoading: carregandoItens } = useItensDaTabela(
		tenantId,
		origem?.id,
	);
	const validacao = validarReajusteForm(valores, origem);
	const erros = tentouGravar && !validacao.ok ? validacao.erros : {};

	const atualizar = (parcial: Partial<ReajusteFormValues>) => {
		setValores((atual) => {
			const novo = { ...atual, ...parcial };
			const origemNova = tabelas.find((t) => t.id === novo.tabela_origem_id);
			if (!nomeEditado && origemNova) {
				novo.nome_tabela = sugerirNomeReajuste(
					origemNova,
					novo.tipo,
					novo.percentual,
				);
			}
			if (parcial.tabela_origem_id && origemNova) {
				novo.vigencia_inicio = sugerirInicioReajuste(origemNova, hoje);
			}
			return novo;
		});
	};

	const produtosPorId = useMemo(
		() => new Map<string, Produto>(produtos.map((p) => [p.id, p])),
		[produtos],
	);
	const comparacao = useMemo(() => {
		const percentual = validacao.ok ? validacao.input.percentual_centesimos : 0;
		return [...itensPorProduto.values()]
			.map((item) => ({
				produtoId: item.produto_id,
				produto: produtosPorId.get(item.produto_id),
				anterior: item.preco_base_centavos,
				novo: reajustarPreco(item.preco_base_centavos, percentual),
			}))
			.sort((a, b) =>
				(a.produto?.sku ?? "").localeCompare(b.produto?.sku ?? "", "pt-BR", {
					numeric: true,
				}),
			);
	}, [itensPorProduto, produtosPorId, validacao]);

	const gravar = async () => {
		setTentouGravar(true);
		if (!validacao.ok) return;
		setGravando(true);
		setErro(null);
		try {
			setResultado(await reajustar(validacao.input));
		} catch (e) {
			setErro(mensagemDeErro(e, "Não foi possível criar a tabela reajustada."));
		} finally {
			setGravando(false);
		}
	};

	if (resultado) {
		return (
			<section
				className={cardClassName({ className: "flex flex-col gap-3 p-5" })}
			>
				<div className="flex items-center gap-2 text-success">
					<CheckCircle2 aria-hidden="true" className="size-5" />
					<h2 className="text-base font-semibold">Tabela reajustada criada</h2>
				</div>
				<p className="text-sm text-foreground">
					"{resultado.tabela.nome_tabela}" (
					{descreverVigencia(resultado.tabela)}) com {resultado.itens}{" "}
					{resultado.itens === 1 ? "preço" : "preços"}.
				</p>
				{resultado.origemEncerrada?.vigencia_fim && (
					<p className="text-sm text-muted-foreground">
						"{resultado.origemEncerrada.nome_tabela}" passou a valer até{" "}
						{formatarDataBr(resultado.origemEncerrada.vigencia_fim)}.
					</p>
				)}
				<div className="flex flex-wrap gap-2">
					<Link
						to={`/catalogo?representada=${representadaId}`}
						className={buttonClassName()}
					>
						Ver catálogo
					</Link>
					<Link
						to={`/representadas/${representadaId}/editar`}
						className={buttonClassName({ variant: "secondary" })}
					>
						Voltar para a representada
					</Link>
				</div>
			</section>
		);
	}

	const vespera =
		origem &&
		validacao.ok &&
		(!origem.vigencia_fim || origem.vigencia_fim >= valores.vigencia_inicio)
			? diaAnterior(valores.vigencia_inicio)
			: null;

	return (
		<>
			<section
				className={cardClassName({
					className: "grid gap-4 p-4 sm:grid-cols-2",
				})}
			>
				<FormField
					id="reajuste-origem"
					label="Tabela de origem"
					required
					error={erros.tabela_origem_id}
					className="sm:col-span-2"
				>
					<Select
						id="reajuste-origem"
						value={valores.tabela_origem_id}
						onChange={(e) => atualizar({ tabela_origem_id: e.target.value })}
					>
						{tabelas.map((t) => (
							<option key={t.id} value={t.id}>
								{t.nome_tabela} — {descreverVigencia(t)}
								{t.ativo ? "" : " (inativa)"}
							</option>
						))}
					</Select>
				</FormField>

				<fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
					<legend className="mb-1.5 text-[13px] leading-none font-medium text-foreground">
						Reajuste <span className="text-destructive">*</span>
					</legend>
					<div className="flex gap-2">
						<div className="w-32 shrink-0">
							<Select
								aria-label="Tipo de reajuste"
								value={valores.tipo}
								onChange={(e) =>
									atualizar({
										tipo: e.target.value === "reducao" ? "reducao" : "aumento",
									})
								}
							>
								<option value="aumento">Aumento</option>
								<option value="reducao">Redução</option>
							</Select>
						</div>
						<div className="relative flex-1">
							<Input
								id="reajuste-percentual"
								aria-label="Percentual"
								inputMode="decimal"
								placeholder="0,00"
								value={valores.percentual}
								hasError={Boolean(erros.percentual)}
								onChange={(e) => atualizar({ percentual: e.target.value })}
								className="pr-8 text-right font-mono"
							/>
							<span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
								%
							</span>
						</div>
					</div>
					{erros.percentual && (
						<span role="alert" className="text-xs text-destructive">
							{erros.percentual}
						</span>
					)}
				</fieldset>

				<FormField
					id="reajuste-nome"
					label="Nome da nova tabela"
					required
					error={erros.nome_tabela}
				>
					<Input
						id="reajuste-nome"
						value={valores.nome_tabela}
						maxLength={80}
						hasError={Boolean(erros.nome_tabela)}
						onChange={(e) => {
							setNomeEditado(true);
							setValores((v) => ({ ...v, nome_tabela: e.target.value }));
						}}
					/>
				</FormField>

				<FormField
					id="reajuste-inicio"
					label="Início da vigência"
					required
					error={
						erros.vigencia_inicio ??
						(!validacao.ok && valores.vigencia_inicio
							? validacao.erros.vigencia_inicio
							: undefined)
					}
					help="Pode ser uma data futura"
				>
					<Input
						id="reajuste-inicio"
						type="date"
						value={valores.vigencia_inicio}
						hasError={Boolean(erros.vigencia_inicio)}
						onChange={(e) => atualizar({ vigencia_inicio: e.target.value })}
					/>
				</FormField>

				<FormField
					id="reajuste-fim"
					label="Fim da vigência"
					error={erros.vigencia_fim}
					help="Vazio = sem data de término"
				>
					<Input
						id="reajuste-fim"
						type="date"
						value={valores.vigencia_fim}
						hasError={Boolean(erros.vigencia_fim)}
						onChange={(e) => atualizar({ vigencia_fim: e.target.value })}
					/>
				</FormField>

				{origem && vespera && (
					<Alert variant="info" className="sm:col-span-2">
						"{origem.nome_tabela}" passa a valer até {formatarDataBr(vespera)}.
						A partir de {formatarDataBr(valores.vigencia_inicio)}, o orçamento
						oferece só a tabela reajustada. Pedidos já gravados não mudam.
					</Alert>
				)}
			</section>

			<section
				className={cardClassName({ className: "flex flex-col gap-3 p-4" })}
			>
				<header className="flex items-baseline justify-between gap-2">
					<h2 className="text-sm font-semibold text-foreground">Prévia</h2>
					<span className="text-xs text-muted-foreground">
						{comparacao.length} {comparacao.length === 1 ? "preço" : "preços"}
					</span>
				</header>
				{carregandoItens ? (
					<p className="text-sm text-muted-foreground">Carregando preços...</p>
				) : comparacao.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						A tabela de origem não tem preços. A nova tabela será criada vazia.
					</p>
				) : (
					<ListaResponsiva>
						<div className="max-h-[24rem] overflow-y-auto pr-1 @2xl:hidden">
							<ListaCards rotulo="Prévia dos preços reajustados">
								{comparacao.slice(0, LIMITE_LINHAS).map((c) => (
									<CartaoLista key={c.produtoId}>
										<CartaoListaTopo
											titulo={
												<>
													<span className="font-mono text-xs font-semibold text-foreground">
														{c.produto?.sku ?? "—"}
													</span>
													<span className="text-xs text-muted-foreground">
														{c.produto?.descricao ?? "Produto não encontrado"}
													</span>
												</>
											}
											destaque={
												<div className="flex flex-col items-end font-mono tabular-nums">
													<span className="text-sm font-semibold text-foreground">
														{formatarCentavos(c.novo)}
													</span>
													<span className="text-[11px] text-muted-foreground">
														Atual: {formatarCentavos(c.anterior)}
													</span>
												</div>
											}
										/>
									</CartaoLista>
								))}
							</ListaCards>
						</div>
						<ListaTabela rotulo="Prévia dos preços reajustados">
							<div className="max-h-[24rem] overflow-y-auto">
								<table className="text-left text-sm">
									<thead>
										<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
											<th className="px-3.5 py-2.5">SKU / Descrição</th>
											<th className="px-3 py-2.5 text-right">Atual</th>
											<th className="px-3.5 py-2.5 text-right">Novo</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{comparacao.slice(0, LIMITE_LINHAS).map((c) => (
											<tr key={c.produtoId}>
												<td className="px-3.5 py-2">
													<span className="block font-mono text-xs text-foreground">
														{c.produto?.sku ?? "—"}
													</span>
													<span className="text-muted-foreground">
														{c.produto?.descricao ?? "Produto não encontrado"}
													</span>
												</td>
												<td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
													{formatarCentavos(c.anterior)}
												</td>
												<td className="px-3.5 py-2 text-right font-mono text-sm text-foreground tabular-nums">
													{formatarCentavos(c.novo)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</ListaTabela>
						{comparacao.length > LIMITE_LINHAS && (
							<p className="px-1 text-xs text-muted-foreground">
								Mostrando {LIMITE_LINHAS} de {comparacao.length}; todos serão
								reajustados.
							</p>
						)}
					</ListaResponsiva>
				)}

				{erro && <Alert variant="destructive">{erro}</Alert>}
				<div className="flex justify-end border-t border-border pt-3">
					<Button onClick={gravar} disabled={gravando}>
						{gravando ? "Criando..." : "Criar tabela reajustada"}
					</Button>
				</div>
			</section>
		</>
	);
}
