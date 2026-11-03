import {
	Document,
	Page,
	pdf,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import { Download, FileText, Mail, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import {
	Alert,
	Button,
	buttonClassName,
	Card,
} from "../../../shared/components/ui";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import {
	type EspelhoCotacaoDados,
	type EspelhoPedidoDados,
	gerarNomeArquivoEspelhoCotacaoPdf,
	gerarNomeArquivoEspelhoPdf,
	gerarTextoCompartilhamentoCotacao,
	gerarTextoCompartilhamentoEspelho,
	gerarUrlEmailCotacao,
	gerarUrlEmailEspelho,
	gerarUrlWhatsappCotacao,
	gerarUrlWhatsappEspelho,
} from "../domain/espelho-pedido";

const styles = StyleSheet.create({
	page: {
		paddingTop: 28,
		paddingBottom: 36,
		paddingHorizontal: 32,
		fontFamily: "Helvetica",
		fontSize: 9,
		color: "#111827",
		backgroundColor: "#FFFFFF",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		borderBottomWidth: 1.5,
		borderBottomColor: "#1E293B",
		paddingBottom: 12,
		marginBottom: 14,
	},
	brandBlock: {
		maxWidth: "56%",
	},
	brandTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 15,
		color: "#0F172A",
		marginBottom: 2,
	},
	brandSub: {
		fontSize: 8.5,
		color: "#475569",
		marginBottom: 1,
	},
	docBadgeBox: {
		alignItems: "flex-end",
		backgroundColor: "#F8FAFC",
		borderWidth: 1,
		borderColor: "#CBD5E1",
		borderRadius: 4,
		paddingVertical: 6,
		paddingHorizontal: 10,
	},
	docTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 9.5,
		color: "#0F172A",
		marginBottom: 2,
	},
	docCode: {
		fontFamily: "Courier",
		fontSize: 10,
		color: "#1E293B",
		marginBottom: 2,
	},
	docMeta: {
		fontSize: 8,
		color: "#475569",
	},
	gridTwoCols: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 12,
	},
	panel: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 4,
		padding: 9,
		backgroundColor: "#F8FAFC",
	},
	panelTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 8,
		color: "#475569",
		textTransform: "uppercase",
		marginBottom: 5,
		borderBottomWidth: 0.5,
		borderBottomColor: "#CBD5E1",
		paddingBottom: 3,
	},
	logisticsPanel: {
		flex: 0,
		marginBottom: 12,
	},
	sectionBlock: {
		marginBottom: 6,
	},
	sectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderBottomWidth: 1,
		borderBottomColor: "#0F172A",
		paddingBottom: 3,
		marginBottom: 3,
	},
	sectionTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 10.5,
		color: "#0F172A",
	},
	sectionCode: {
		fontFamily: "Courier",
		fontSize: 8.5,
		color: "#334155",
	},
	sectionMeta: {
		fontSize: 8,
		color: "#475569",
		marginBottom: 6,
	},
	sectionSubtotal: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: -8,
		marginBottom: 10,
		fontSize: 8,
		color: "#475569",
	},
	sectionSubtotalValue: {
		fontFamily: "Helvetica-Bold",
		fontSize: 9,
		color: "#0F172A",
	},
	fieldRow: {
		flexDirection: "row",
		marginBottom: 3,
	},
	fieldLabel: {
		fontFamily: "Helvetica-Bold",
		fontSize: 8.5,
		color: "#334155",
		width: 78,
	},
	fieldValue: {
		flex: 1,
		fontSize: 8.5,
		color: "#0F172A",
	},
	tableSectionTitle: {
		fontFamily: "Helvetica-Bold",
		fontSize: 9.5,
		color: "#0F172A",
		marginBottom: 6,
	},
	table: {
		borderWidth: 1,
		borderColor: "#CBD5E1",
		borderRadius: 4,
		marginBottom: 14,
	},
	tableHeader: {
		flexDirection: "row",
		backgroundColor: "#0F172A",
		color: "#FFFFFF",
		fontFamily: "Helvetica-Bold",
		fontSize: 8,
		paddingVertical: 6,
		paddingHorizontal: 6,
	},
	tableRow: {
		flexDirection: "row",
		borderTopWidth: 0.5,
		borderTopColor: "#E2E8F0",
		paddingVertical: 5,
		paddingHorizontal: 6,
		alignItems: "center",
	},
	tableRowAlt: {
		backgroundColor: "#F8FAFC",
	},
	colNum: {
		width: "5%",
	},
	colSku: {
		width: "14%",
		fontFamily: "Courier",
		fontSize: 8,
	},
	colDesc: {
		width: "31%",
		paddingRight: 4,
	},
	colUnid: {
		width: "8%",
		textAlign: "center",
	},
	colQtd: {
		width: "7%",
		textAlign: "right",
	},
	colPrecoTab: {
		width: "12%",
		textAlign: "right",
	},
	colDescPct: {
		width: "9%",
		textAlign: "right",
	},
	colLiquido: {
		width: "14%",
		textAlign: "right",
	},
	colSubtotal: {
		width: "14%",
		textAlign: "right",
		fontFamily: "Helvetica-Bold",
	},
	summaryRow: {
		flexDirection: "row",
		gap: 10,
		alignItems: "stretch",
	},
	obsPanel: {
		flex: 1.2,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		borderRadius: 4,
		padding: 9,
	},
	totalsPanel: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#CBD5E1",
		borderRadius: 4,
		padding: 9,
		backgroundColor: "#F8FAFC",
	},
	totalLine: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 4,
		fontSize: 8.5,
	},
	grandTotalLine: {
		flexDirection: "row",
		justifyContent: "space-between",
		borderTopWidth: 1,
		borderTopColor: "#0F172A",
		paddingTop: 6,
		marginTop: 4,
		fontFamily: "Helvetica-Bold",
		fontSize: 11,
		color: "#0F172A",
	},
	footer: {
		position: "absolute",
		bottom: 18,
		left: 32,
		right: 32,
		borderTopWidth: 0.5,
		borderTopColor: "#CBD5E1",
		paddingTop: 6,
		flexDirection: "row",
		justifyContent: "space-between",
		fontSize: 7.5,
		color: "#64748B",
	},
});

interface CabecalhoPdfProps {
	emitente: EspelhoPedidoDados["emitente"];
	titulo: string;
	codigo: string;
	meta: string;
}

function CabecalhoPdf({ emitente, titulo, codigo, meta }: CabecalhoPdfProps) {
	return (
		<View style={styles.header}>
			<View style={styles.brandBlock}>
				<Text style={styles.brandTitle}>{emitente.nomeFantasia}</Text>
				<Text style={styles.brandSub}>{emitente.razaoSocial}</Text>
				<Text style={styles.brandSub}>
					CNPJ: {emitente.cnpj}
					{emitente.telefone ? ` · Tel: ${emitente.telefone}` : ""}
				</Text>
			</View>

			<View style={styles.docBadgeBox}>
				<Text style={styles.docTitle}>{titulo}</Text>
				<Text style={styles.docCode}>Nº {codigo}</Text>
				<Text style={styles.docMeta}>{meta}</Text>
			</View>
		</View>
	);
}

function CampoPdf({ rotulo, valor }: { rotulo: string; valor: string }) {
	return (
		<View style={styles.fieldRow}>
			<Text style={styles.fieldLabel}>{rotulo}</Text>
			<Text style={styles.fieldValue}>{valor}</Text>
		</View>
	);
}

function PainelClientePdf({
	cliente,
}: {
	cliente: EspelhoPedidoDados["cliente"];
}) {
	return (
		<View style={styles.panel}>
			<Text style={styles.panelTitle}>Dados do Cliente (Comprador)</Text>
			<CampoPdf rotulo="Razão Social:" valor={cliente.razaoSocial} />
			{cliente.nomeFantasia && (
				<CampoPdf rotulo="Fantasia:" valor={cliente.nomeFantasia} />
			)}
			<CampoPdf rotulo="CPF/CNPJ:" valor={cliente.documentoFormatado} />
			<CampoPdf rotulo="Entrega:" valor={cliente.enderecoEntrega} />
			{cliente.contatoNome && (
				<CampoPdf
					rotulo="Contato:"
					valor={`${cliente.contatoNome}${
						cliente.contatoPapel ? ` (${cliente.contatoPapel})` : ""
					}${cliente.contatoTelefone ? ` · ${cliente.contatoTelefone}` : ""}`}
				/>
			)}
			{cliente.contatoEmail && (
				<CampoPdf rotulo="E-mail:" valor={cliente.contatoEmail} />
			)}
		</View>
	);
}

/** Linhas da transportadora (nome, razão social, CNPJ, cidade e telefone). */
function CamposTransportadoraPdf({
	transportadora,
}: {
	transportadora: EspelhoPedidoDados["logistica"]["transportadora"];
}) {
	return (
		<>
			<CampoPdf
				rotulo="Transportadora:"
				valor={transportadora?.nomeFantasia ?? "A definir"}
			/>
			{transportadora?.razaoSocial && (
				<CampoPdf rotulo="Razão Social:" valor={transportadora.razaoSocial} />
			)}
			{transportadora?.cnpjFormatado && (
				<CampoPdf rotulo="CNPJ:" valor={transportadora.cnpjFormatado} />
			)}
			{transportadora?.cidadeUf && (
				<CampoPdf rotulo="Cidade/UF:" valor={transportadora.cidadeUf} />
			)}
			{transportadora?.telefone && (
				<CampoPdf rotulo="Telefone:" valor={transportadora.telefone} />
			)}
		</>
	);
}

function TabelaItensPdf({ itens }: { itens: EspelhoPedidoDados["itens"] }) {
	return (
		<View style={styles.table}>
			<View style={styles.tableHeader}>
				<Text style={styles.colNum}>#</Text>
				<Text style={styles.colSku}>SKU</Text>
				<Text style={styles.colDesc}>Descrição</Text>
				<Text style={styles.colUnid}>Unid.</Text>
				<Text style={styles.colQtd}>Qtd</Text>
				<Text style={styles.colPrecoTab}>Preço Tab.</Text>
				<Text style={styles.colDescPct}>Desc.</Text>
				<Text style={styles.colLiquido}>Líq. Unit.</Text>
				<Text style={styles.colSubtotal}>Subtotal</Text>
			</View>

			{itens.map((item, idx) => (
				<View
					key={item.id}
					wrap={false}
					style={
						idx % 2 === 1
							? [styles.tableRow, styles.tableRowAlt]
							: styles.tableRow
					}
				>
					<Text style={styles.colNum}>{item.numero}</Text>
					<Text style={styles.colSku}>{item.sku}</Text>
					<Text style={styles.colDesc}>{item.descricao}</Text>
					<Text style={styles.colUnid}>
						{item.unidadeMedida} ({item.multiploEmbalagem})
					</Text>
					<Text style={styles.colQtd}>{item.quantidade}</Text>
					<Text style={styles.colPrecoTab}>{item.precoTabelaFormatado}</Text>
					<Text style={styles.colDescPct}>
						{item.descontoPercentualFormatado}
					</Text>
					<Text style={styles.colLiquido}>{item.precoLiquidoFormatado}</Text>
					<Text style={styles.colSubtotal}>{item.subtotalFormatado}</Text>
				</View>
			))}
		</View>
	);
}

function ObservacoesPdf({ observacoes }: { observacoes: string | null }) {
	return (
		<View style={styles.obsPanel}>
			<Text style={styles.panelTitle}>Observações Comerciais</Text>
			<Text style={styles.fieldValue}>
				{observacoes ?? "Sem observações adicionais registradas."}
			</Text>
		</View>
	);
}

export interface EspelhoPedidoPdfDocumentProps {
	dados: EspelhoPedidoDados;
}

/** PDF individual de um pedido (uma representada) — também usado por fábrica na cotação. */
export function EspelhoPedidoPdfDocument({
	dados,
}: EspelhoPedidoPdfDocumentProps) {
	return (
		<Document
			title={`${dados.tituloDocumento} #${dados.codigoCurto}`}
			author={dados.emitente.nomeFantasia}
			subject={`Espelho comercial — ${dados.cliente.razaoSocial}`}
		>
			<Page size="A4" style={styles.page}>
				{/* 1. Cabeçalho Institucional */}
				<CabecalhoPdf
					emitente={dados.emitente}
					titulo={dados.tituloDocumento}
					codigo={dados.codigoCurto}
					meta={`Status: ${dados.statusRotulo} · Emissão: ${dados.dataEmissaoFormatada}`}
				/>

				{/* 2. Representada & Condições Comerciais + Cliente */}
				<View style={styles.gridTwoCols}>
					<View style={styles.panel}>
						<Text style={styles.panelTitle}>
							Representada (Fábrica) & Condições
						</Text>
						<CampoPdf
							rotulo="Fantasia:"
							valor={dados.representada.nomeFantasia}
						/>
						<CampoPdf
							rotulo="Razão Social:"
							valor={dados.representada.razaoSocial}
						/>
						<CampoPdf rotulo="CNPJ:" valor={dados.representada.cnpjFormatado} />
						<CampoPdf
							rotulo="Tabela:"
							valor={dados.comercial.tabelaPrecoNome}
						/>
						<CampoPdf
							rotulo="Pagamento:"
							valor={dados.comercial.condicaoPagamento}
						/>
					</View>

					<PainelClientePdf cliente={dados.cliente} />
				</View>

				{/* 3. Bloco Logístico: frete e transportadora */}
				<View style={[styles.panel, styles.logisticsPanel]}>
					<Text style={styles.panelTitle}>Logística e Transporte</Text>
					<CampoPdf rotulo="Frete:" valor={dados.comercial.tipoFreteRotulo} />
					<CamposTransportadoraPdf
						transportadora={dados.logistica.transportadora}
					/>
				</View>

				{/* 4. Tabela de Itens */}
				<Text style={styles.tableSectionTitle}>
					Itens ({dados.totais.quantidadeItens} SKU ·{" "}
					{dados.totais.quantidadeVolumes} volumes)
				</Text>
				<TabelaItensPdf itens={dados.itens} />

				{/* 5. Observações e Totalizadores */}
				<View style={styles.summaryRow} wrap={false}>
					<ObservacoesPdf observacoes={dados.comercial.observacoes} />

					<View style={styles.totalsPanel}>
						<Text style={styles.panelTitle}>Resumo Financeiro</Text>
						<View style={styles.totalLine}>
							<Text>Volumes totais:</Text>
							<Text>{dados.totais.quantidadeVolumes} un.</Text>
						</View>
						<View style={styles.totalLine}>
							<Text>Total de tabela:</Text>
							<Text>{dados.totais.valorTabelaTotalFormatado}</Text>
						</View>
						<View style={styles.totalLine}>
							<Text>Desconto total:</Text>
							<Text>- {dados.totais.descontoTotalFormatado}</Text>
						</View>
						<View style={styles.grandTotalLine}>
							<Text>TOTAL LÍQUIDO:</Text>
							<Text>{dados.totais.valorTotalFormatado}</Text>
						</View>
					</View>
				</View>

				{/* 6. Rodapé de Auditoria */}
				<View style={styles.footer} fixed>
					<Text>
						{dados.emitente.nomeFantasia} · Espelho comercial gerado offline
					</Text>
					<Text>Idempotency Key: {dados.idempotencyKey}</Text>
				</View>
			</Page>
		</Document>
	);
}

export interface EspelhoCotacaoPdfDocumentProps {
	dados: EspelhoCotacaoDados;
}

/**
 * PDF unificado da cotação para o cliente: cabeçalho, cliente e logística uma
 * única vez, uma seção por representada e o total geral consolidado.
 */
export function EspelhoCotacaoPdfDocument({
	dados,
}: EspelhoCotacaoPdfDocumentProps) {
	return (
		<Document
			title={`${dados.tituloDocumento} #${dados.codigoCurto}`}
			author={dados.emitente.nomeFantasia}
			subject={`Cotação multi-fábrica — ${dados.cliente.razaoSocial}`}
		>
			<Page size="A4" style={styles.page}>
				<CabecalhoPdf
					emitente={dados.emitente}
					titulo={dados.tituloDocumento}
					codigo={dados.codigoCurto}
					meta={`${dados.secoes.length} fábricas · Status: ${dados.statusRotulo} · Emissão: ${dados.dataEmissaoFormatada}`}
				/>

				<View style={styles.gridTwoCols}>
					<PainelClientePdf cliente={dados.cliente} />
					<View style={styles.panel}>
						<Text style={styles.panelTitle}>Logística e Transporte</Text>
						<CamposTransportadoraPdf
							transportadora={dados.logistica.transportadora}
						/>
					</View>
				</View>

				{dados.secoes.map((secao, idx) => (
					<View key={secao.pedidoId} style={styles.sectionBlock}>
						<View style={styles.sectionHeader} wrap={false}>
							<Text style={styles.sectionTitle}>
								{idx + 1}. {secao.representada.nomeFantasia}
							</Text>
							<Text style={styles.sectionCode}>
								Pedido #{secao.codigoCurto}
							</Text>
						</View>
						<Text style={styles.sectionMeta}>
							{secao.representada.razaoSocial} · CNPJ{" "}
							{secao.representada.cnpjFormatado} · Tabela:{" "}
							{secao.comercial.tabelaPrecoNome} · Pagamento:{" "}
							{secao.comercial.condicaoPagamento} · Frete:{" "}
							{secao.comercial.tipoFreteRotulo}
						</Text>
						<TabelaItensPdf itens={secao.itens} />
						<View style={styles.sectionSubtotal} wrap={false}>
							<Text>
								{secao.totais.quantidadeItens} SKU ·{" "}
								{secao.totais.quantidadeVolumes} volumes · Desconto -{" "}
								{secao.totais.descontoTotalFormatado}
							</Text>
							<Text style={styles.sectionSubtotalValue}>
								Subtotal {secao.representada.nomeFantasia}:{" "}
								{secao.totais.valorTotalFormatado}
							</Text>
						</View>
					</View>
				))}

				<View style={styles.summaryRow} wrap={false}>
					<ObservacoesPdf observacoes={dados.observacoes} />

					<View style={styles.totalsPanel}>
						<Text style={styles.panelTitle}>Resumo por Fábrica</Text>
						{dados.secoes.map((secao) => (
							<View key={secao.pedidoId} style={styles.totalLine}>
								<Text>{secao.representada.nomeFantasia}:</Text>
								<Text>{secao.totais.valorTotalFormatado}</Text>
							</View>
						))}
						<View style={styles.totalLine}>
							<Text>Desconto total:</Text>
							<Text>- {dados.totais.descontoTotalFormatado}</Text>
						</View>
						<View style={styles.grandTotalLine}>
							<Text>TOTAL GERAL:</Text>
							<Text>{dados.totais.valorTotalFormatado}</Text>
						</View>
					</View>
				</View>

				<View style={styles.footer} fixed>
					<Text>
						{dados.emitente.nomeFantasia} · Cotação unificada gerada offline
					</Text>
					<Text
						render={({ pageNumber, totalPages }) =>
							`Página ${pageNumber}/${totalPages}`
						}
					/>
				</View>
			</Page>
		</Document>
	);
}

/** Renderiza o documento PDF do espelho do pedido em um `Blob` client-side. */
export async function gerarBlobEspelhoPedidoPdf(
	dados: EspelhoPedidoDados,
): Promise<Blob> {
	return pdf(<EspelhoPedidoPdfDocument dados={dados} />).toBlob();
}

/** Renderiza o PDF unificado da cotação (todas as fábricas) em um `Blob`. */
export async function gerarBlobEspelhoCotacaoPdf(
	dados: EspelhoCotacaoDados,
): Promise<Blob> {
	return pdf(<EspelhoCotacaoPdfDocument dados={dados} />).toBlob();
}

function baixarBlob(blob: Blob, nomeArquivo: string): void {
	const url = URL.createObjectURL(blob);
	try {
		const link = document.createElement("a");
		link.href = url;
		link.download = nomeArquivo;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/**
 * Tenta compartilhar o arquivo via Web Share API (envio em 1 toque no
 * WhatsApp/E-mail no celular); sem suporte a arquivos, faz o download.
 */
async function compartilharOuBaixarBlob(
	blob: Blob,
	nomeArquivo: string,
	titulo: string,
	texto: string,
): Promise<"compartilhado" | "baixado"> {
	const arquivo = new File([blob], nomeArquivo, { type: "application/pdf" });
	if (
		typeof navigator !== "undefined" &&
		typeof navigator.canShare === "function" &&
		typeof navigator.share === "function" &&
		navigator.canShare({ files: [arquivo] })
	) {
		await navigator.share({ title: titulo, text: texto, files: [arquivo] });
		return "compartilhado";
	}
	baixarBlob(blob, nomeArquivo);
	return "baixado";
}

/** Gera e dispara o download imediato do arquivo PDF no navegador. */
export async function baixarEspelhoPedidoPdf(
	dados: EspelhoPedidoDados,
): Promise<void> {
	baixarBlob(
		await gerarBlobEspelhoPedidoPdf(dados),
		gerarNomeArquivoEspelhoPdf(dados),
	);
}

/** Download do PDF unificado da cotação. */
export async function baixarEspelhoCotacaoPdf(
	dados: EspelhoCotacaoDados,
): Promise<void> {
	baixarBlob(
		await gerarBlobEspelhoCotacaoPdf(dados),
		gerarNomeArquivoEspelhoCotacaoPdf(dados),
	);
}

export async function compartilharOuBaixarEspelhoPedidoPdf(
	dados: EspelhoPedidoDados,
): Promise<"compartilhado" | "baixado"> {
	return compartilharOuBaixarBlob(
		await gerarBlobEspelhoPedidoPdf(dados),
		gerarNomeArquivoEspelhoPdf(dados),
		`${dados.tituloDocumento} #${dados.codigoCurto}`,
		gerarTextoCompartilhamentoEspelho(dados),
	);
}

export async function compartilharOuBaixarEspelhoCotacaoPdf(
	dados: EspelhoCotacaoDados,
): Promise<"compartilhado" | "baixado"> {
	return compartilharOuBaixarBlob(
		await gerarBlobEspelhoCotacaoPdf(dados),
		gerarNomeArquivoEspelhoCotacaoPdf(dados),
		`${dados.tituloDocumento} #${dados.codigoCurto}`,
		gerarTextoCompartilhamentoCotacao(dados),
	);
}

/** Executa uma geração de PDF controlando o estado de carregamento e o erro. */
function useGeracaoPdf() {
	const [gerando, setGerando] = useState<string | null>(null);
	const [erro, setErro] = useState<string | null>(null);

	const executar = async (
		chave: string,
		acao: () => Promise<unknown>,
		fallback: string,
	) => {
		setErro(null);
		setGerando(chave);
		try {
			await acao();
		} catch (e) {
			if (e instanceof Error && e.name === "AbortError") return;
			setErro(mensagemDeErro(e, fallback));
		} finally {
			setGerando(null);
		}
	};

	return { gerando, erro, executar };
}

interface BotoesEnvioProps {
	gerando: boolean;
	rotuloBaixar: string;
	onBaixar: () => void;
	onCompartilhar: () => void;
	urlWhatsapp: string;
	urlEmail: string;
}

function BotoesEnvio({
	gerando,
	rotuloBaixar,
	onBaixar,
	onCompartilhar,
	urlWhatsapp,
	urlEmail,
}: BotoesEnvioProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button size="sm" variant="primary" disabled={gerando} onClick={onBaixar}>
				<Download aria-hidden="true" />
				{gerando ? "Gerando PDF..." : rotuloBaixar}
			</Button>

			<Button
				size="sm"
				variant="secondary"
				disabled={gerando}
				onClick={onCompartilhar}
			>
				<Share2 aria-hidden="true" />
				Compartilhar PDF
			</Button>

			<a
				href={urlWhatsapp}
				target="_blank"
				rel="noopener noreferrer"
				className={buttonClassName({ variant: "secondary", size: "sm" })}
			>
				<MessageCircle aria-hidden="true" />
				WhatsApp
			</a>

			<a
				href={urlEmail}
				className={buttonClassName({ variant: "secondary", size: "sm" })}
			>
				<Mail aria-hidden="true" />
				E-mail
			</a>
		</div>
	);
}

interface EspelhoPedidoActionsBarProps {
	espelho: EspelhoPedidoDados;
}

/**
 * Painel de ações de exportação do espelho em PDF e envio rápido ao cliente
 * via WhatsApp ou E-mail.
 */
export function EspelhoPedidoActionsBar({
	espelho,
}: EspelhoPedidoActionsBarProps) {
	const { gerando, erro, executar } = useGeracaoPdf();

	return (
		<Card className="flex flex-col gap-3 p-4">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<div className="flex items-start gap-2.5">
					<FileText
						aria-hidden="true"
						className="mt-0.5 size-4 shrink-0 text-primary"
					/>
					<div>
						<h2 className="text-sm font-semibold text-foreground">
							Espelho PDF & Envio ao Cliente (#{espelho.codigoCurto})
						</h2>
						<p className="text-xs text-muted-foreground">
							Gere o PDF oficial offline ou envie o resumo direto por WhatsApp /
							E-mail.
						</p>
					</div>
				</div>

				<BotoesEnvio
					gerando={gerando !== null}
					rotuloBaixar="Baixar PDF"
					onBaixar={() =>
						void executar(
							"pdf",
							() => baixarEspelhoPedidoPdf(espelho),
							"Erro ao gerar o espelho PDF",
						)
					}
					onCompartilhar={() =>
						void executar(
							"pdf",
							() => compartilharOuBaixarEspelhoPedidoPdf(espelho),
							"Erro ao compartilhar o espelho PDF",
						)
					}
					urlWhatsapp={gerarUrlWhatsappEspelho(espelho)}
					urlEmail={gerarUrlEmailEspelho(espelho)}
				/>
			</div>

			{erro && <Alert variant="destructive">{erro}</Alert>}
		</Card>
	);
}

interface EspelhoCotacaoActionsBarProps {
	espelho: EspelhoCotacaoDados;
}

/**
 * Ações de PDF da cotação. Com uma única fábrica, equivale ao espelho do
 * pedido. Com várias: PDF unificado para o cliente e PDF individual por fábrica.
 */
export function EspelhoCotacaoActionsBar({
	espelho,
}: EspelhoCotacaoActionsBarProps) {
	const { gerando, erro, executar } = useGeracaoPdf();
	const [unicaSecao] = espelho.secoes;

	if (espelho.secoes.length === 1 && unicaSecao) {
		return <EspelhoPedidoActionsBar espelho={unicaSecao} />;
	}

	return (
		<Card className="flex flex-col gap-3 p-4">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
				<div className="flex items-start gap-2.5">
					<FileText
						aria-hidden="true"
						className="mt-0.5 size-4 shrink-0 text-primary"
					/>
					<div>
						<h2 className="text-sm font-semibold text-foreground">
							Cotação unificada #{espelho.codigoCurto} · {espelho.secoes.length}{" "}
							fábricas
						</h2>
						<p className="text-xs text-muted-foreground">
							PDF consolidado para o cliente ou PDF individual para enviar a
							cada fábrica.
						</p>
					</div>
				</div>

				<BotoesEnvio
					gerando={gerando !== null}
					rotuloBaixar="PDF unificado"
					onBaixar={() =>
						void executar(
							"unificado",
							() => baixarEspelhoCotacaoPdf(espelho),
							"Erro ao gerar o PDF unificado da cotação",
						)
					}
					onCompartilhar={() =>
						void executar(
							"unificado",
							() => compartilharOuBaixarEspelhoCotacaoPdf(espelho),
							"Erro ao compartilhar o PDF unificado da cotação",
						)
					}
					urlWhatsapp={gerarUrlWhatsappCotacao(espelho)}
					urlEmail={gerarUrlEmailCotacao(espelho)}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
				<span className="mr-1 text-[11px] text-muted-foreground">
					PDF individual por fábrica:
				</span>
				{espelho.secoes.map((secao) => (
					<Button
						key={secao.pedidoId}
						size="sm"
						variant="ghost"
						disabled={gerando !== null}
						onClick={() =>
							void executar(
								secao.pedidoId,
								() => baixarEspelhoPedidoPdf(secao),
								"Erro ao gerar o PDF da fábrica",
							)
						}
						title={`Baixar o pedido #${secao.codigoCurto} de ${secao.representada.nomeFantasia}`}
					>
						<Download aria-hidden="true" className="size-3.5" />
						{gerando === secao.pedidoId
							? "Gerando..."
							: `${secao.representada.nomeFantasia} · ${secao.totais.valorTotalFormatado}`}
					</Button>
				))}
			</div>

			{erro && <Alert variant="destructive">{erro}</Alert>}
		</Card>
	);
}
