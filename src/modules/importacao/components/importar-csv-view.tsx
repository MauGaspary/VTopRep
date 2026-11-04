import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { type ChangeEvent, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Button,
	buttonClassName,
	cardClassName,
	FormField,
	Input,
	PageHeader,
	Select,
} from "../../../shared/components/ui";
import {
	decodificarCsv,
	detectarSeparadorCsv,
	type EncodingCsv,
	parseCsv,
	ROTULOS_ENCODING_CSV,
	ROTULOS_SEPARADOR_CSV,
	SEPARADORES_CSV,
	type SeparadorCsv,
} from "../../../shared/domain/csv";
import { dataLocal, formatarDataBr } from "../../../shared/domain/datas";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { tabelaDisponivel } from "../../produtos/domain/preco";
import type { Produto } from "../../produtos/domain/produto.schema";
import {
	descreverVigencia,
	diaAnterior,
} from "../../produtos/domain/tabela-preco";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import {
	useItensDaTabela,
	useTabelasDaRepresentada,
} from "../../produtos/hooks/use-precos";
import { useTodosProdutos } from "../../produtos/hooks/use-produtos";
import type { Representada } from "../../representadas/domain/representada.schema";
import { useRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	type DestinoFormValues,
	validarDestinoForm,
	valoresIniciaisDestino,
} from "../domain/destino-form";
import {
	CAMPOS_IMPORTACAO,
	type CampoImportacao,
	type ColunasMapeamentoSalvo,
	type MapeamentoColunasRascunho,
	type ResumoImportacao,
	ROTULOS_CAMPO_IMPORTACAO,
	type TratamentoAusentes,
} from "../domain/importacao.schema";
import { extrairLinhasImportacao } from "../domain/linhas";
import {
	colunasParaSalvar,
	detectarLinhaCabecalho,
	letraColuna,
	sugerirMapeamento,
	validarMapeamento,
} from "../domain/mapeamento";
import { calcularPreviaImportacao } from "../domain/previa";
import {
	useImportacaoActions,
	useMapeamentoSalvo,
} from "../hooks/use-importacao";
import { PreviaImportacaoTabela } from "./previa-importacao";

/** Limite de tamanho: planilhas de preço passam de longe abaixo disso. */
const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
const LINHAS_AMOSTRA = 5;

interface ArquivoLido {
	/** Muda a cada arquivo escolhido, para reiniciar a configuração. */
	chave: string;
	nome: string;
	texto: string;
	encoding: EncodingCsv;
	separador: SeparadorCsv;
}

/** Arquivos do Excel são ZIP (começam com "PK"). */
function pareceXlsx(nome: string, bytes: Uint8Array): boolean {
	return /\.xlsx?$/i.test(nome) || (bytes[0] === 0x50 && bytes[1] === 0x4b);
}

export function ImportarCsvView() {
	const { config } = useTenant();
	const tenantId = config.id;
	const [searchParams, setSearchParams] = useSearchParams();
	const { representadas, isLoading } = useRepresentadas(tenantId);
	const [arquivo, setArquivo] = useState<ArquivoLido | null>(null);
	const [erroArquivo, setErroArquivo] = useState<string | null>(null);
	const [resultado, setResultado] = useState<{
		resumo: ResumoImportacao;
		representada: Representada;
	} | null>(null);
	const inputId = useId();

	const representadaId = searchParams.get("representada") ?? "";
	const representada =
		representadas.find((r) => r.id === representadaId) ?? null;
	const { mapeamentoSalvo, isLoading: carregandoMapeamento } =
		useMapeamentoSalvo(tenantId, representada?.id);

	const escolherArquivo = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;
		setErroArquivo(null);
		setResultado(null);
		if (file.size > TAMANHO_MAXIMO_BYTES) {
			setErroArquivo("Arquivo muito grande (máximo 20 MB).");
			return;
		}
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			if (pareceXlsx(file.name, bytes)) {
				setErroArquivo(
					'Este é um arquivo do Excel. No Excel, use "Salvar como" → "CSV (separado por vírgulas)" e escolha o arquivo .csv.',
				);
				return;
			}
			const { texto, encoding } = decodificarCsv(bytes);
			if (texto.trim() === "") {
				setErroArquivo("O arquivo está vazio.");
				return;
			}
			setArquivo({
				chave: `${file.name}:${file.lastModified}:${Date.now()}`,
				nome: file.name,
				texto,
				encoding,
				separador: detectarSeparadorCsv(texto),
			});
		} catch (erro) {
			setErroArquivo(mensagemDeErro(erro, "Não foi possível ler o arquivo."));
		}
	};

	const voltarCatalogo = representada
		? `/catalogo?representada=${representada.id}`
		: "/catalogo";

	return (
		<Page width="full">
			<PageHeader
				title="Importar produtos e preços"
				description="Atualize o catálogo de uma fábrica a partir de uma planilha CSV (no Excel: Salvar como → CSV)."
				back={{ to: voltarCatalogo, label: "Catálogo" }}
			/>

			{resultado ? (
				<ResultadoImportacaoCard
					resultado={resultado.resumo}
					representada={resultado.representada}
					onNovaImportacao={() => {
						setResultado(null);
						setArquivo(null);
					}}
				/>
			) : (
				<>
					<div
						className={cardClassName({
							className: "grid gap-4 p-4 sm:grid-cols-[minmax(0,18rem)_1fr]",
						})}
					>
						<FormField id="importar-representada" label="Representada" required>
							<Select
								id="importar-representada"
								value={representada?.id ?? ""}
								disabled={isLoading}
								onChange={(e) => {
									setSearchParams(
										e.target.value ? { representada: e.target.value } : {},
										{ replace: true },
									);
								}}
							>
								<option value="">Escolha a fábrica</option>
								{representadas.map((r) => (
									<option key={r.id} value={r.id}>
										{r.nome_fantasia}
									</option>
								))}
							</Select>
						</FormField>

						<div className="flex flex-col gap-1.5">
							<span className="text-[13px] leading-none font-medium text-foreground">
								Arquivo CSV
							</span>
							<div className="flex flex-wrap items-center gap-2">
								<label
									htmlFor={inputId}
									className={buttonClassName({
										variant: arquivo ? "secondary" : "primary",
										className: representada
											? "cursor-pointer"
											: "pointer-events-none opacity-50",
									})}
								>
									<Upload aria-hidden="true" />
									{arquivo ? "Trocar arquivo" : "Escolher arquivo"}
								</label>
								<input
									id={inputId}
									type="file"
									accept=".csv,.txt,text/csv,text/plain"
									className="sr-only"
									disabled={!representada}
									onChange={escolherArquivo}
								/>
								{arquivo && (
									<span className="inline-flex items-center gap-1.5 text-sm text-foreground">
										<FileSpreadsheet
											aria-hidden="true"
											className="size-4 text-muted-foreground"
										/>
										{arquivo.nome}
										<span className="text-xs text-muted-foreground">
											({ROTULOS_ENCODING_CSV[arquivo.encoding]})
										</span>
									</span>
								)}
							</div>
							<span className="text-xs text-muted-foreground">
								{representada
									? "Separador ; ou , e acentos do Excel são detectados automaticamente."
									: "Escolha a representada primeiro."}
							</span>
						</div>
					</div>

					{erroArquivo && <Alert variant="destructive">{erroArquivo}</Alert>}

					{arquivo && representada && !carregandoMapeamento && (
						<ConfiguracaoImportacao
							key={`${representada.id}:${arquivo.chave}`}
							tenantId={tenantId}
							representada={representada}
							arquivo={arquivo}
							colunasSalvas={mapeamentoSalvo?.colunas ?? null}
							onConcluido={(resumo) => setResultado({ resumo, representada })}
						/>
					)}
				</>
			)}
		</Page>
	);
}

interface ConfiguracaoImportacaoProps {
	tenantId: string;
	representada: Representada;
	arquivo: ArquivoLido;
	colunasSalvas: ColunasMapeamentoSalvo | null;
	onConcluido: (resumo: ResumoImportacao) => void;
}

function ConfiguracaoImportacao({
	tenantId,
	representada,
	arquivo,
	colunasSalvas,
	onConcluido,
}: ConfiguracaoImportacaoProps) {
	const hoje = useMemo(() => dataLocal(new Date()), []);
	const { tabelas, isLoading: carregandoTabelas } = useTabelasDaRepresentada(
		tenantId,
		representada.id,
	);
	const { produtos, isLoading: carregandoProdutos } = useTodosProdutos(
		tenantId,
		undefined,
		representada.id,
	);

	const [separador, setSeparador] = useState<SeparadorCsv>(arquivo.separador);
	const linhas = useMemo(
		() => parseCsv(arquivo.texto, separador),
		[arquivo.texto, separador],
	);
	const [linhaCabecalho, setLinhaCabecalho] = useState(() =>
		detectarLinhaCabecalho(linhas),
	);
	const cabecalho = linhas[linhaCabecalho] ?? [];
	const [mapeamento, setMapeamento] = useState<MapeamentoColunasRascunho>(() =>
		sugerirMapeamento(cabecalho, colunasSalvas),
	);

	const trocarSeparador = (novo: SeparadorCsv) => {
		const novasLinhas = parseCsv(arquivo.texto, novo);
		const novoCabecalho = detectarLinhaCabecalho(novasLinhas);
		setSeparador(novo);
		setLinhaCabecalho(novoCabecalho);
		setMapeamento(
			sugerirMapeamento(novasLinhas[novoCabecalho] ?? [], colunasSalvas),
		);
	};
	const trocarCabecalho = (indice: number) => {
		setLinhaCabecalho(indice);
		setMapeamento(sugerirMapeamento(linhas[indice] ?? [], colunasSalvas));
	};

	if (carregandoTabelas || carregandoProdutos) {
		return (
			<p className="py-6 text-center text-muted-foreground">
				Carregando cadastro da fábrica...
			</p>
		);
	}
	if (linhas.length === 0) {
		return <Alert variant="destructive">O arquivo não tem linhas.</Alert>;
	}

	return (
		<>
			<section
				className={cardClassName({ className: "flex flex-col gap-4 p-4" })}
			>
				<header className="flex flex-col gap-0.5">
					<h2 className="text-sm font-semibold text-foreground">
						1. Colunas do arquivo
					</h2>
					<p className="text-xs text-muted-foreground">
						Ligue cada campo a uma coluna. As escolhas ficam salvas neste
						aparelho para as próximas importações de{" "}
						{representada.nome_fantasia}.
					</p>
				</header>

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<FormField id="importar-separador" label="Separador">
						<Select
							id="importar-separador"
							value={separador}
							onChange={(e) => {
								const novo = SEPARADORES_CSV.find((s) => s === e.target.value);
								if (novo) trocarSeparador(novo);
							}}
						>
							{SEPARADORES_CSV.map((s) => (
								<option key={s} value={s}>
									{ROTULOS_SEPARADOR_CSV[s]}
								</option>
							))}
						</Select>
					</FormField>
					<FormField
						id="importar-cabecalho"
						label="Linha do cabeçalho"
						help={`${linhas.length} linhas no arquivo`}
					>
						<Select
							id="importar-cabecalho"
							value={String(linhaCabecalho)}
							onChange={(e) => trocarCabecalho(Number(e.target.value))}
						>
							{linhas.slice(0, 30).map((l, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: a posição da linha é a identidade
								<option key={i} value={i}>
									{i + 1}:{" "}
									{l
										.filter((c) => c.trim())
										.join(" · ")
										.slice(0, 48) || "(vazia)"}
								</option>
							))}
						</Select>
					</FormField>
				</div>

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
					{CAMPOS_IMPORTACAO.map((campo) => (
						<SeletorColuna
							key={campo}
							campo={campo}
							cabecalho={cabecalho}
							valor={mapeamento[campo]}
							onChange={(indice) =>
								setMapeamento((m) => ({ ...m, [campo]: indice }))
							}
						/>
					))}
				</div>

				<AmostraArquivo
					linhas={linhas}
					linhaCabecalho={linhaCabecalho}
					mapeamento={mapeamento}
				/>
			</section>

			<EtapaPrevia
				tenantId={tenantId}
				representada={representada}
				arquivoNome={arquivo.nome}
				hoje={hoje}
				linhas={linhas}
				linhaCabecalho={linhaCabecalho}
				cabecalho={cabecalho}
				mapeamento={mapeamento}
				tabelas={tabelas}
				produtos={produtos}
				onConcluido={onConcluido}
			/>
		</>
	);
}

function SeletorColuna({
	campo,
	cabecalho,
	valor,
	onChange,
}: {
	campo: CampoImportacao;
	cabecalho: readonly string[];
	valor: number | null;
	onChange: (indice: number | null) => void;
}) {
	const id = `importar-coluna-${campo}`;
	return (
		<FormField
			id={id}
			label={ROTULOS_CAMPO_IMPORTACAO[campo]}
			required={campo === "sku"}
		>
			<Select
				id={id}
				value={valor === null ? "" : String(valor)}
				hasError={campo === "sku" && valor === null}
				onChange={(e) =>
					onChange(e.target.value === "" ? null : Number(e.target.value))
				}
			>
				<option value="">
					{campo === "sku" ? "Escolha a coluna" : "Não importar"}
				</option>
				{cabecalho.map((nome, indice) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a posição da coluna é a identidade
					<option key={indice} value={indice}>
						{letraColuna(indice)} · {nome.trim() || "(sem nome)"}
					</option>
				))}
			</Select>
		</FormField>
	);
}

function AmostraArquivo({
	linhas,
	linhaCabecalho,
	mapeamento,
}: {
	linhas: readonly string[][];
	linhaCabecalho: number;
	mapeamento: MapeamentoColunasRascunho;
}) {
	const cabecalho = linhas[linhaCabecalho] ?? [];
	const amostra = linhas
		.slice(linhaCabecalho + 1)
		.filter((l) => l.some((c) => c.trim() !== ""))
		.slice(0, LINHAS_AMOSTRA);
	const colunas = Math.max(cabecalho.length, ...amostra.map((l) => l.length));
	const campoDaColuna = new Map<number, CampoImportacao>();
	for (const campo of CAMPOS_IMPORTACAO) {
		const indice = mapeamento[campo];
		if (indice !== null) campoDaColuna.set(indice, campo);
	}

	return (
		<section
			aria-label="Primeiras linhas do arquivo"
			className="dense-table-region rounded-lg border border-border"
		>
			<table className="text-left text-xs">
				<thead>
					<tr className="border-b border-border">
						{Array.from({ length: colunas }, (_, i) => {
							const campo = campoDaColuna.get(i);
							return (
								<th
									// biome-ignore lint/suspicious/noArrayIndexKey: colunas do arquivo não têm id
									key={i}
									className={`px-2.5 py-1.5 font-medium whitespace-nowrap ${
										campo
											? "bg-primary/10 text-foreground"
											: "text-muted-foreground"
									}`}
								>
									<span className="block text-[10px] tracking-wider uppercase">
										{campo ? ROTULOS_CAMPO_IMPORTACAO[campo] : letraColuna(i)}
									</span>
									{cabecalho[i]?.trim() || "—"}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{amostra.map((linha, r) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: amostra estática do arquivo
						<tr key={r}>
							{Array.from({ length: colunas }, (_, i) => (
								<td
									// biome-ignore lint/suspicious/noArrayIndexKey: colunas do arquivo não têm id
									key={i}
									className={`max-w-56 truncate px-2.5 py-1.5 font-mono whitespace-nowrap ${
										campoDaColuna.has(i)
											? "text-foreground"
											: "text-subtle-foreground"
									}`}
								>
									{linha[i] ?? ""}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

interface EtapaPreviaProps {
	tenantId: string;
	representada: Representada;
	arquivoNome: string;
	hoje: string;
	linhas: readonly string[][];
	linhaCabecalho: number;
	cabecalho: readonly string[];
	mapeamento: MapeamentoColunasRascunho;
	tabelas: readonly TabelaPreco[];
	produtos: readonly Produto[];
	onConcluido: (resumo: ResumoImportacao) => void;
}

function EtapaPrevia({
	tenantId,
	representada,
	arquivoNome,
	hoje,
	linhas,
	linhaCabecalho,
	cabecalho,
	mapeamento,
	tabelas,
	produtos,
	onConcluido,
}: EtapaPreviaProps) {
	const { importar, salvarMapeamento } = useImportacaoActions(tenantId);
	const [destinoForm, setDestinoForm] = useState<DestinoFormValues>(() =>
		valoresIniciaisDestino({ tabelas, hoje, nomeArquivo: arquivoNome }),
	);
	const [ausentes, setAusentes] = useState<TratamentoAusentes>("manter");
	const [gravando, setGravando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);

	const mapeamentoValido = validarMapeamento(mapeamento);
	const importarPreco = mapeamento.preco !== null;
	const tabelasAtivas = tabelas.filter(tabelaDisponivel);
	const destinoValidado = validarDestinoForm(destinoForm, tabelas);
	const errosDestino = destinoValidado.ok ? {} : destinoValidado.erros;

	// Preços de comparação: a tabela atualizada ou, numa tabela nova, a substituída.
	const tabelaReferencia =
		destinoForm.tipo === "existente"
			? tabelas.find((t) => t.id === destinoForm.tabela_id)
			: tabelas.find((t) => t.id === destinoForm.substitui_tabela_id);
	const { itensPorProduto, isLoading: carregandoPrecos } = useItensDaTabela(
		tenantId,
		importarPreco ? tabelaReferencia?.id : undefined,
	);
	const precosReferencia = useMemo(
		() =>
			tabelaReferencia
				? new Map(
						[...itensPorProduto].map(([id, item]) => [
							id,
							item.preco_base_centavos,
						]),
					)
				: null,
		[itensPorProduto, tabelaReferencia],
	);

	const extraidas = useMemo(() => {
		const valido = validarMapeamento(mapeamento);
		return valido.ok
			? extrairLinhasImportacao({
					linhas,
					linhaCabecalho,
					mapeamento: valido.mapeamento,
				})
			: null;
	}, [linhas, linhaCabecalho, mapeamento]);
	const previa = useMemo(
		() =>
			extraidas
				? calcularPreviaImportacao({
						linhas: extraidas.linhas,
						skusNoArquivo: extraidas.skus,
						produtos,
						precosReferencia,
						importarPreco,
					})
				: null,
		[extraidas, produtos, precosReferencia, importarPreco],
	);

	const problemas = useMemo(
		() =>
			[...(extraidas?.problemas ?? []), ...(previa?.problemas ?? [])].sort(
				(a, b) => a.linha - b.linha,
			),
		[extraidas, previa],
	);
	const linhasComErro = new Set(
		problemas.filter((p) => p.gravidade === "erro").map((p) => p.linha),
	).size;
	const aGravar = previa?.itens.length ?? 0;
	const podeImportar =
		mapeamentoValido.ok &&
		previa !== null &&
		aGravar + (ausentes === "inativar" ? previa.ausentes.length : 0) > 0 &&
		(!importarPreco || destinoValidado.ok) &&
		!gravando;

	const alterarDestino = <K extends keyof DestinoFormValues>(
		campo: K,
		valor: DestinoFormValues[K],
	) => setDestinoForm((d) => ({ ...d, [campo]: valor }));

	const gravar = async () => {
		if (!mapeamentoValido.ok || !extraidas || !previa) return;
		const destino =
			importarPreco && destinoValidado.ok ? destinoValidado.destino : null;
		if (importarPreco && !destino) return;
		if (
			ausentes === "inativar" &&
			previa.ausentes.length > 0 &&
			!window.confirm(
				`${previa.ausentes.length} produto(s) de ${representada.nome_fantasia} que não estão no arquivo serão inativados. Continuar?`,
			)
		) {
			return;
		}
		setGravando(true);
		setErro(null);
		try {
			const resumo = await importar({
				opcoes: { representada_id: representada.id, destino, ausentes },
				linhas: extraidas.linhas,
				skusNoArquivo: extraidas.skus,
			});
			await salvarMapeamento(
				representada.id,
				colunasParaSalvar(cabecalho, mapeamentoValido.mapeamento),
			);
			onConcluido(resumo);
		} catch (e) {
			setErro(mensagemDeErro(e, "Não foi possível importar o arquivo."));
		} finally {
			setGravando(false);
		}
	};

	const substituida = tabelas.find(
		(t) => t.id === destinoForm.substitui_tabela_id,
	);

	return (
		<>
			{importarPreco && (
				<section
					className={cardClassName({ className: "flex flex-col gap-4 p-4" })}
				>
					<header className="flex flex-col gap-0.5">
						<h2 className="text-sm font-semibold text-foreground">
							2. Tabela de preço
						</h2>
						<p className="text-xs text-muted-foreground">
							Pedidos já gravados não mudam: cada item guarda o preço da época.
						</p>
					</header>

					<fieldset className="m-0 flex flex-wrap gap-x-5 gap-y-2 border-0 p-0">
						<legend className="sr-only">Destino dos preços</legend>
						<Opcao
							nome="importar-destino"
							marcado={destinoForm.tipo === "existente"}
							disabled={tabelasAtivas.length === 0}
							onChange={() => alterarDestino("tipo", "existente")}
						>
							Atualizar uma tabela existente
						</Opcao>
						<Opcao
							nome="importar-destino"
							marcado={destinoForm.tipo === "nova"}
							onChange={() => alterarDestino("tipo", "nova")}
						>
							Criar uma nova tabela
						</Opcao>
					</fieldset>

					{destinoForm.tipo === "existente" ? (
						<FormField
							id="importar-tabela"
							label="Tabela"
							required
							error={errosDestino.tabela_id}
							className="max-w-md"
						>
							<Select
								id="importar-tabela"
								value={destinoForm.tabela_id}
								hasError={Boolean(errosDestino.tabela_id)}
								onChange={(e) => alterarDestino("tabela_id", e.target.value)}
							>
								<option value="">Escolha a tabela</option>
								{tabelasAtivas.map((t) => (
									<option key={t.id} value={t.id}>
										{t.nome_tabela} — {descreverVigencia(t)}
									</option>
								))}
							</Select>
						</FormField>
					) : (
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<FormField
								id="importar-nome-tabela"
								label="Nome da nova tabela"
								required
								error={errosDestino.nome_tabela}
							>
								<Input
									id="importar-nome-tabela"
									value={destinoForm.nome_tabela}
									maxLength={80}
									hasError={Boolean(errosDestino.nome_tabela)}
									onChange={(e) =>
										alterarDestino("nome_tabela", e.target.value)
									}
								/>
							</FormField>
							<FormField
								id="importar-inicio"
								label="Início da vigência"
								required
								error={errosDestino.vigencia_inicio}
								help="Pode ser uma data futura"
							>
								<Input
									id="importar-inicio"
									type="date"
									value={destinoForm.vigencia_inicio}
									hasError={Boolean(errosDestino.vigencia_inicio)}
									onChange={(e) =>
										alterarDestino("vigencia_inicio", e.target.value)
									}
								/>
							</FormField>
							<FormField
								id="importar-fim"
								label="Fim da vigência"
								error={errosDestino.vigencia_fim}
								help="Vazio = sem data de término"
							>
								<Input
									id="importar-fim"
									type="date"
									value={destinoForm.vigencia_fim}
									hasError={Boolean(errosDestino.vigencia_fim)}
									onChange={(e) =>
										alterarDestino("vigencia_fim", e.target.value)
									}
								/>
							</FormField>
							<FormField
								id="importar-substitui"
								label="Substitui a tabela"
								error={errosDestino.substitui_tabela_id}
							>
								<Select
									id="importar-substitui"
									value={destinoForm.substitui_tabela_id}
									onChange={(e) =>
										alterarDestino("substitui_tabela_id", e.target.value)
									}
								>
									<option value="">Nenhuma (as duas ficam vigentes)</option>
									{tabelasAtivas.map((t) => (
										<option key={t.id} value={t.id}>
											{t.nome_tabela} — {descreverVigencia(t)}
										</option>
									))}
								</Select>
							</FormField>
							{substituida &&
								destinoValidado.ok &&
								destinoForm.vigencia_inicio && (
									<p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
										"{substituida.nome_tabela}" passa a valer até{" "}
										{formatarDataBr(diaAnterior(destinoForm.vigencia_inicio))}.
										Depois disso, o orçamento oferece só a nova tabela.
									</p>
								)}
						</div>
					)}
				</section>
			)}

			<section
				className={cardClassName({ className: "flex flex-col gap-4 p-4" })}
			>
				<header className="flex flex-col gap-0.5">
					<h2 className="text-sm font-semibold text-foreground">
						{importarPreco ? "3." : "2."} Prévia das mudanças
					</h2>
					<p className="text-xs text-muted-foreground">
						Nada é gravado até você confirmar.
						{importarPreco &&
							(tabelaReferencia
								? ` Preços comparados com "${tabelaReferencia.nome_tabela}".`
								: " Sem tabela para comparar: todos os preços aparecem como novos.")}
					</p>
				</header>

				{!mapeamentoValido.ok ? (
					<Alert variant="warning">{mapeamentoValido.erro}</Alert>
				) : !previa || (importarPreco && carregandoPrecos) ? (
					<p className="text-sm text-muted-foreground">Calculando prévia...</p>
				) : (
					<>
						{linhasComErro > 0 && (
							<Alert variant="warning">
								{linhasComErro}{" "}
								{linhasComErro === 1
									? "linha tem erro e fica"
									: "linhas têm erro e ficam"}{" "}
								de fora. Veja em "Erros e avisos"; corrija a planilha e importe
								de novo se precisar.
							</Alert>
						)}
						<PreviaImportacaoTabela
							previa={previa}
							problemas={problemas}
							referenciaPrecos={tabelaReferencia?.nome_tabela ?? null}
							mostrarPreco={importarPreco}
						/>

						{previa.ausentes.length > 0 && (
							<fieldset className="m-0 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
								<legend className="px-1 text-[13px] font-medium text-foreground">
									{previa.ausentes.length}{" "}
									{previa.ausentes.length === 1
										? "produto ativo não está no arquivo"
										: "produtos ativos não estão no arquivo"}
								</legend>
								<Opcao
									nome="importar-ausentes"
									marcado={ausentes === "manter"}
									onChange={() => setAusentes("manter")}
								>
									Manter como estão
								</Opcao>
								<Opcao
									nome="importar-ausentes"
									marcado={ausentes === "inativar"}
									onChange={() => setAusentes("inativar")}
								>
									Inativar (saem do catálogo e do orçamento; dá para reativar
									depois)
								</Opcao>
							</fieldset>
						)}
					</>
				)}

				{erro && <Alert variant="destructive">{erro}</Alert>}

				<div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-3">
					{previa && (
						<span className="text-xs text-muted-foreground">
							{aGravar} {aGravar === 1 ? "linha válida" : "linhas válidas"}
							{previa.contagem.novos > 0 &&
								` · ${previa.contagem.novos} ${previa.contagem.novos === 1 ? "novo" : "novos"}`}
							{ausentes === "inativar" &&
								previa.ausentes.length > 0 &&
								` · ${previa.ausentes.length} a inativar`}
						</span>
					)}
					<Button onClick={gravar} disabled={!podeImportar}>
						{gravando ? "Importando..." : "Importar"}
					</Button>
				</div>
			</section>
		</>
	);
}

function Opcao({
	nome,
	marcado,
	disabled,
	onChange,
	children,
}: {
	nome: string;
	marcado: boolean;
	disabled?: boolean;
	onChange: () => void;
	children: string;
}) {
	return (
		<label
			className={`inline-flex items-center gap-2 text-sm text-foreground ${
				disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
			}`}
		>
			<input
				type="radio"
				name={nome}
				checked={marcado}
				disabled={disabled}
				onChange={onChange}
				className="size-4 accent-primary"
			/>
			{children}
		</label>
	);
}

function ResultadoImportacaoCard({
	resultado,
	representada,
	onNovaImportacao,
}: {
	resultado: ResumoImportacao;
	representada: Representada;
	onNovaImportacao: () => void;
}) {
	const itens = [
		{ rotulo: "Produtos criados", valor: resultado.criados },
		{ rotulo: "Cadastros atualizados", valor: resultado.atualizados },
		{ rotulo: "Reativados", valor: resultado.reativados },
		{ rotulo: "Inativados", valor: resultado.inativados },
		{ rotulo: "Preços gravados", valor: resultado.precos_gravados },
	];
	return (
		<section
			className={cardClassName({ className: "flex flex-col gap-4 p-5" })}
		>
			<div className="flex items-center gap-2 text-success">
				<CheckCircle2 aria-hidden="true" className="size-5" />
				<h2 className="text-base font-semibold">Importação concluída</h2>
			</div>
			<dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
				{itens.map((i) => (
					<div
						key={i.rotulo}
						className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2"
					>
						<dt className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
							{i.rotulo}
						</dt>
						<dd className="m-0 font-mono text-base font-semibold text-foreground tabular-nums">
							{i.valor}
						</dd>
					</div>
				))}
			</dl>
			{resultado.tabela_encerrada_id && (
				<p className="text-sm text-muted-foreground">
					A tabela substituída passou a valer até a véspera do início da nova.
				</p>
			)}
			<p className="text-xs text-muted-foreground">
				As mudanças ficam na fila de sincronização com o servidor.
			</p>
			<div className="flex flex-wrap gap-2">
				<Link
					to={`/catalogo?representada=${representada.id}`}
					className={buttonClassName()}
				>
					Ver catálogo de {representada.nome_fantasia}
				</Link>
				<Button variant="secondary" onClick={onNovaImportacao}>
					Importar outro arquivo
				</Button>
			</div>
		</section>
	);
}
