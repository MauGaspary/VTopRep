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
	type EspelhoPedidoDados,
	gerarNomeArquivoEspelhoPdf,
	gerarTextoCompartilhamentoEspelho,
	gerarUrlEmailEspelho,
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

export interface EspelhoPedidoPdfDocumentProps {
	dados: EspelhoPedidoDados;
}

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
				<View style={styles.header}>
					<View style={styles.brandBlock}>
						<Text style={styles.brandTitle}>{dados.emitente.nomeFantasia}</Text>
						<Text style={styles.brandSub}>{dados.emitente.razaoSocial}</Text>
						<Text style={styles.brandSub}>
							CNPJ: {dados.emitente.cnpj}
							{dados.emitente.telefone
								? ` · Tel: ${dados.emitente.telefone}`
								: ""}
						</Text>
					</View>

					<View style={styles.docBadgeBox}>
						<Text style={styles.docTitle}>{dados.tituloDocumento}</Text>
						<Text style={styles.docCode}>Nº {dados.codigoCurto}</Text>
						<Text style={styles.docMeta}>
							Status: {dados.statusRotulo} · Emissão:{" "}
							{dados.dataEmissaoFormatada}
						</Text>
					</View>
				</View>

				{/* 2. Representada & Condições Comerciais + Cliente */}
				<View style={styles.gridTwoCols}>
					<View style={styles.panel}>
						<Text style={styles.panelTitle}>
							Representada (Fábrica) & Condições
						</Text>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>Fantasia:</Text>
							<Text style={styles.fieldValue}>
								{dados.representada.nomeFantasia}
							</Text>
						</View>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>Razão Social:</Text>
							<Text style={styles.fieldValue}>
								{dados.representada.razaoSocial}
							</Text>
						</View>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>CNPJ:</Text>
							<Text style={styles.fieldValue}>
								{dados.representada.cnpjFormatado}
							</Text>
						</View>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>Tabela:</Text>
							<Text style={styles.fieldValue}>
								{dados.comercial.tabelaPrecoNome}
							</Text>
						</View>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>Pagamento:</Text>
							<Text style={styles.fieldValue}>
								{dados.comercial.condicaoPagamento}
							</Text>
						</View>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>Frete:</Text>
							<Text style={styles.fieldValue}>
								{dados.comercial.tipoFreteRotulo}
							</Text>
						</View>
					</View>

					<View style={styles.panel}>
						<Text style={styles.panelTitle}>Dados do Cliente (Comprador)</Text>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>Razão Social:</Text>
							<Text style={styles.fieldValue}>{dados.cliente.razaoSocial}</Text>
						</View>
						{dados.cliente.nomeFantasia && (
							<View style={styles.fieldRow}>
								<Text style={styles.fieldLabel}>Fantasia:</Text>
								<Text style={styles.fieldValue}>
									{dados.cliente.nomeFantasia}
								</Text>
							</View>
						)}
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>CPF/CNPJ:</Text>
							<Text style={styles.fieldValue}>
								{dados.cliente.documentoFormatado}
							</Text>
						</View>
						<View style={styles.fieldRow}>
							<Text style={styles.fieldLabel}>Entrega:</Text>
							<Text style={styles.fieldValue}>
								{dados.cliente.enderecoEntrega}
							</Text>
						</View>
						{dados.cliente.contatoNome && (
							<View style={styles.fieldRow}>
								<Text style={styles.fieldLabel}>Contato:</Text>
								<Text style={styles.fieldValue}>
									{dados.cliente.contatoNome}
									{dados.cliente.contatoPapel
										? ` (${dados.cliente.contatoPapel})`
										: ""}
									{dados.cliente.contatoTelefone
										? ` · ${dados.cliente.contatoTelefone}`
										: ""}
								</Text>
							</View>
						)}
						{dados.cliente.contatoEmail && (
							<View style={styles.fieldRow}>
								<Text style={styles.fieldLabel}>E-mail:</Text>
								<Text style={styles.fieldValue}>
									{dados.cliente.contatoEmail}
								</Text>
							</View>
						)}
					</View>
				</View>

				{/* 3. Tabela de Itens */}
				<Text style={styles.tableSectionTitle}>
					Itens ({dados.totais.quantidadeItens} SKU ·{" "}
					{dados.totais.quantidadeVolumes} volumes)
				</Text>
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

					{dados.itens.map((item, idx) => (
						<View
							key={item.id}
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
							<Text style={styles.colPrecoTab}>
								{item.precoTabelaFormatado}
							</Text>
							<Text style={styles.colDescPct}>
								{item.descontoPercentualFormatado}
							</Text>
							<Text style={styles.colLiquido}>
								{item.precoLiquidoFormatado}
							</Text>
							<Text style={styles.colSubtotal}>{item.subtotalFormatado}</Text>
						</View>
					))}
				</View>

				{/* 4. Observações e Totalizadores */}
				<View style={styles.summaryRow}>
					<View style={styles.obsPanel}>
						<Text style={styles.panelTitle}>Observações Comerciais</Text>
						<Text style={styles.fieldValue}>
							{dados.comercial.observacoes ??
								"Sem observações adicionais registradas."}
						</Text>
					</View>

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

				{/* 5. Rodapé de Auditoria */}
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

/** Renderiza o documento PDF do espelho do pedido em um `Blob` client-side. */
export async function gerarBlobEspelhoPedidoPdf(
	dados: EspelhoPedidoDados,
): Promise<Blob> {
	return pdf(<EspelhoPedidoPdfDocument dados={dados} />).toBlob();
}

/** Gera e dispara o download imediato do arquivo PDF no navegador. */
export async function baixarEspelhoPedidoPdf(
	dados: EspelhoPedidoDados,
): Promise<void> {
	const blob = await gerarBlobEspelhoPedidoPdf(dados);
	const nomeArquivo = gerarNomeArquivoEspelhoPdf(dados);
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
 * Tenta compartilhar o arquivo PDF diretamente via Web Share API (ideal para
 * envio em 1 toque no WhatsApp/E-mail no celular); caso o navegador não
 * suporte compartilhamento de arquivos, faz o download do PDF.
 */
export async function compartilharOuBaixarEspelhoPedidoPdf(
	dados: EspelhoPedidoDados,
): Promise<"compartilhado" | "baixado"> {
	const blob = await gerarBlobEspelhoPedidoPdf(dados);
	const nomeArquivo = gerarNomeArquivoEspelhoPdf(dados);
	const arquivo = new File([blob], nomeArquivo, { type: "application/pdf" });
	const texto = gerarTextoCompartilhamentoEspelho(dados);

	if (
		typeof navigator !== "undefined" &&
		typeof navigator.canShare === "function" &&
		typeof navigator.share === "function" &&
		navigator.canShare({ files: [arquivo] })
	) {
		await navigator.share({
			title: `${dados.tituloDocumento} #${dados.codigoCurto}`,
			text: texto,
			files: [arquivo],
		});
		return "compartilhado";
	}

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
	return "baixado";
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
	const [gerandoPdf, setGerandoPdf] = useState(false);
	const [erroPdf, setErroPdf] = useState<string | null>(null);

	const handleBaixarPdf = async () => {
		setErroPdf(null);
		setGerandoPdf(true);
		try {
			await baixarEspelhoPedidoPdf(espelho);
		} catch (e) {
			setErroPdf(mensagemDeErro(e, "Erro ao gerar o espelho PDF"));
		} finally {
			setGerandoPdf(false);
		}
	};

	const handleCompartilharPdf = async () => {
		setErroPdf(null);
		setGerandoPdf(true);
		try {
			await compartilharOuBaixarEspelhoPedidoPdf(espelho);
		} catch (e) {
			if (e instanceof Error && e.name === "AbortError") {
				return;
			}
			setErroPdf(mensagemDeErro(e, "Erro ao compartilhar o espelho PDF"));
		} finally {
			setGerandoPdf(false);
		}
	};

	const urlWhatsapp = gerarUrlWhatsappEspelho(espelho);
	const urlEmail = gerarUrlEmailEspelho(espelho);

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

				<div className="flex flex-wrap items-center gap-2">
					<Button
						size="sm"
						variant="primary"
						disabled={gerandoPdf}
						onClick={() => void handleBaixarPdf()}
					>
						<Download aria-hidden="true" />
						{gerandoPdf ? "Gerando PDF..." : "Baixar PDF"}
					</Button>

					<Button
						size="sm"
						variant="secondary"
						disabled={gerandoPdf}
						onClick={() => void handleCompartilharPdf()}
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
			</div>

			{erroPdf && <Alert variant="destructive">{erroPdf}</Alert>}
		</Card>
	);
}
