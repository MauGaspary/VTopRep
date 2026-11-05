import {
	CheckCircle2,
	Download,
	HardDrive,
	type LucideIcon,
	ShieldCheck,
	Upload,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useId, useState } from "react";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	cardClassName,
	PageHeader,
} from "../../../shared/components/ui";
import {
	formatarBytes,
	percentualUsado,
} from "../../../shared/domain/armazenamento";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { useArmazenamento } from "../../../shared/hooks/use-armazenamento";
import {
	contarRegistrosBackup,
	lerArquivoBackup,
	nomeArquivoBackup,
	serializarBackup,
	totalRegistros,
} from "../domain/backup";
import {
	type BackupLocal,
	type ContagemBackup,
	ROTULOS_TABELA_BACKUP,
	TABELAS_BACKUP,
	type TabelaBackup,
} from "../domain/backup.schema";
import { descreverUltimoBackup } from "../domain/lembrete-backup";
import {
	useBackupActions,
	useContagemDados,
	usePreferenciasBackup,
} from "../hooks/use-backup";

/** Backups de catálogos grandes ficam em poucos MB; isto barra arquivos errados. */
const TAMANHO_MAXIMO_BACKUP_BYTES = 200 * 1024 * 1024;

/** Tabelas mostradas no resumo do backup (as demais entram no total). */
const TABELAS_RESUMO: readonly TabelaBackup[] = [
	"clientes",
	"representadas",
	"produtos",
	"pedidos",
	"outbox",
];

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
	dateStyle: "short",
	timeStyle: "short",
});

const formatoNumero = new Intl.NumberFormat("pt-BR");

function formatarDataHora(instante: string): string {
	return formatoDataHora.format(new Date(instante));
}

function baixarArquivo(conteudo: string, nome: string): number {
	const blob = new Blob([conteudo], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = nome;
	document.body.appendChild(link);
	link.click();
	link.remove();
	// Dá tempo de o navegador iniciar o download antes de liberar a URL.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	return blob.size;
}

export function DadosAparelhoView() {
	const { config } = useTenant();
	const { contagem, total } = useContagemDados(config.id);

	return (
		<Page width="form">
			<PageHeader
				title="Dados e backup"
				description="Orçamentos, clientes e catálogo ficam guardados neste aparelho. Enquanto não houver sincronização com o servidor, o backup é a única cópia fora dele."
			/>
			<ArmazenamentoCard totalRegistros={total} />
			<ExportarBackupCard contagem={contagem} />
			<RestaurarBackupCard contagemAtual={contagem} />
		</Page>
	);
}

function TituloCard({
	icone: Icone,
	titulo,
	acessorio,
}: {
	icone: LucideIcon;
	titulo: string;
	acessorio?: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3">
			<h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Icone aria-hidden="true" className="size-4 text-muted-foreground" />
				{titulo}
			</h2>
			{acessorio}
		</div>
	);
}

function ArmazenamentoCard({ totalRegistros }: { totalRegistros: number }) {
	const { estado, carregando, solicitarPersistencia } = useArmazenamento();
	const [recusado, setRecusado] = useState(false);
	const percentual = percentualUsado(estado);

	const pedirProtecao = async () => {
		setRecusado(!(await solicitarPersistencia()));
	};

	return (
		<section
			className={cardClassName({ className: "flex flex-col gap-4 p-4" })}
		>
			<TituloCard
				icone={HardDrive}
				titulo="Armazenamento neste aparelho"
				acessorio={
					carregando ? null : estado.persistente ? (
						<Badge variant="success">Protegido</Badge>
					) : (
						<Badge variant="secondary">Proteção não garantida</Badge>
					)
				}
			/>

			{!carregando && (
				<p className="text-sm text-muted-foreground">
					{!estado.suportado
						? "Este navegador não informa se os dados estão protegidos. Faça backups com frequência."
						: estado.persistente
							? "O navegador não vai apagar estes dados para liberar espaço. Eles só somem se alguém limpar os dados do site ou desinstalar o app."
							: "Sem proteção, o navegador pode apagar os dados quando o aparelho fica sem espaço. Instalar o app na tela inicial costuma liberar a proteção."}
				</p>
			)}

			{estado.usadoBytes !== null && (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-baseline justify-between gap-3 text-sm">
						<span className="text-foreground">
							{formatarBytes(estado.usadoBytes)} usados
							{estado.cotaBytes !== null &&
								` de ${formatarBytes(estado.cotaBytes)} disponíveis`}
						</span>
						<span className="shrink-0 text-xs text-muted-foreground">
							{formatoNumero.format(totalRegistros)} registros
						</span>
					</div>
					{percentual !== null && (
						<div
							// O texto acima já informa o uso; a barra é só visual.
							aria-hidden="true"
							className="h-1.5 overflow-hidden rounded-full bg-muted"
						>
							<div
								className="h-full rounded-full bg-primary"
								style={{ width: `${Math.max(percentual, 1)}%` }}
							/>
						</div>
					)}
				</div>
			)}

			{estado.suportado && !estado.persistente && !carregando && (
				<div className="flex flex-col gap-2">
					<div>
						<Button variant="secondary" onClick={() => void pedirProtecao()}>
							<ShieldCheck aria-hidden="true" />
							Pedir proteção ao navegador
						</Button>
					</div>
					{recusado && (
						<Alert variant="warning">
							O navegador não concedeu a proteção agora. Ele costuma conceder
							depois que o app é instalado ou usado com frequência. Até lá,
							mantenha o backup em dia.
						</Alert>
					)}
				</div>
			)}
		</section>
	);
}

function ResumoContagem({ contagem }: { contagem: ContagemBackup }) {
	return (
		<dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
			{TABELAS_RESUMO.map((tabela) => (
				<div key={tabela} className="flex flex-col gap-0.5">
					<dt className="text-xs text-muted-foreground">
						{ROTULOS_TABELA_BACKUP[tabela]}
					</dt>
					<dd className="text-sm font-medium text-foreground tabular-nums">
						{formatoNumero.format(contagem[tabela])}
					</dd>
				</div>
			))}
		</dl>
	);
}

function ExportarBackupCard({
	contagem,
}: {
	contagem: ContagemBackup | undefined;
}) {
	const { config } = useTenant();
	const { exportar } = useBackupActions(config.id, config.empresa.nomeFantasia);
	const { preferencias, registrarBackup } = usePreferenciasBackup(config.id);
	const [exportando, setExportando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const [salvo, setSalvo] = useState<{ nome: string; bytes: number } | null>(
		null,
	);

	const baixarBackup = async () => {
		setErro(null);
		setSalvo(null);
		setExportando(true);
		try {
			const backup = await exportar();
			const nome = nomeArquivoBackup(config.slug, new Date());
			const bytes = baixarArquivo(serializarBackup(backup), nome);
			registrarBackup();
			setSalvo({ nome, bytes });
		} catch (e) {
			setErro(mensagemDeErro(e, "Não foi possível gerar o backup."));
		} finally {
			setExportando(false);
		}
	};

	return (
		<section
			className={cardClassName({ className: "flex flex-col gap-4 p-4" })}
		>
			<TituloCard
				icone={Download}
				titulo="Exportar backup"
				acessorio={
					<span className="text-xs text-muted-foreground">
						{descreverUltimoBackup(preferencias.ultimo_backup_em, new Date())}
					</span>
				}
			/>
			<p className="text-sm text-muted-foreground">
				Baixa um arquivo com todos os dados da empresa neste aparelho, inclusive
				as alterações que ainda não foram sincronizadas. Guarde-o fora do
				aparelho (Google Drive, e-mail ou computador).
			</p>

			{contagem && <ResumoContagem contagem={contagem} />}

			<div>
				<Button
					onClick={() => void baixarBackup()}
					disabled={exportando || !contagem}
				>
					<Download aria-hidden="true" />
					{exportando ? "Gerando backup..." : "Baixar backup"}
				</Button>
			</div>

			{erro && <Alert>{erro}</Alert>}
			{salvo && (
				<Alert variant="info">
					<span className="flex items-start gap-2">
						<CheckCircle2
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-success"
						/>
						<span>
							Backup baixado: <span className="font-mono">{salvo.nome}</span> (
							{formatarBytes(salvo.bytes)}). Confira se o arquivo está na pasta
							de downloads.
						</span>
					</span>
				</Alert>
			)}
		</section>
	);
}

function RestaurarBackupCard({
	contagemAtual,
}: {
	contagemAtual: ContagemBackup | undefined;
}) {
	const { config } = useTenant();
	const { restaurar, versaoBanco } = useBackupActions(
		config.id,
		config.empresa.nomeFantasia,
	);
	const inputId = useId();
	const confirmacaoId = useId();
	const [lido, setLido] = useState<{
		nome: string;
		backup: BackupLocal;
	} | null>(null);
	const [erro, setErro] = useState<string | null>(null);
	const [confirmado, setConfirmado] = useState(false);
	const [restaurando, setRestaurando] = useState(false);
	const [restaurados, setRestaurados] = useState<number | null>(null);

	const escolherArquivo = async (e: ChangeEvent<HTMLInputElement>) => {
		const arquivo = e.target.files?.[0];
		e.target.value = "";
		if (!arquivo) return;
		setErro(null);
		setLido(null);
		setConfirmado(false);
		setRestaurados(null);
		if (arquivo.size > TAMANHO_MAXIMO_BACKUP_BYTES) {
			setErro("Arquivo grande demais para ser um backup do app.");
			return;
		}
		try {
			const resultado = lerArquivoBackup(await arquivo.text(), {
				tenantId: config.id,
				versaoBanco,
			});
			if (resultado.ok) {
				setLido({ nome: arquivo.name, backup: resultado.backup });
			} else {
				setErro(resultado.erro);
			}
		} catch (erroLeitura) {
			setErro(mensagemDeErro(erroLeitura, "Não foi possível ler o arquivo."));
		}
	};

	const confirmarRestauracao = async () => {
		if (!lido || !confirmado) return;
		setErro(null);
		setRestaurando(true);
		try {
			const contagem = await restaurar(lido.backup);
			setRestaurados(totalRegistros(contagem));
			setLido(null);
			setConfirmado(false);
		} catch (e) {
			setErro(
				mensagemDeErro(
					e,
					"Não foi possível restaurar o backup. Os dados do aparelho não foram alterados.",
				),
			);
		} finally {
			setRestaurando(false);
		}
	};

	const contagemBackup = lido
		? contarRegistrosBackup(lido.backup.tabelas)
		: null;
	const tabelasComDados = contagemBackup
		? TABELAS_BACKUP.filter(
				(t) => contagemBackup[t] > 0 || (contagemAtual?.[t] ?? 0) > 0,
			)
		: [];

	return (
		<section
			className={cardClassName({ className: "flex flex-col gap-4 p-4" })}
		>
			<TituloCard icone={Upload} titulo="Restaurar backup" />
			<p className="text-sm text-muted-foreground">
				Use para recuperar os dados num aparelho novo ou depois de uma limpeza
				do navegador. O arquivo é conferido inteiro antes de qualquer alteração.
			</p>

			<div>
				<label
					htmlFor={inputId}
					className={buttonClassName({
						variant: "secondary",
						className: "cursor-pointer",
					})}
				>
					<Upload aria-hidden="true" />
					Escolher arquivo de backup
				</label>
				<input
					id={inputId}
					type="file"
					accept=".json,application/json"
					className="sr-only"
					onChange={(e) => void escolherArquivo(e)}
				/>
			</div>

			{erro && <Alert>{erro}</Alert>}

			{restaurados !== null && (
				<Alert variant="info">
					<span className="flex items-start gap-2">
						<CheckCircle2
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-success"
						/>
						Dados restaurados: {formatoNumero.format(restaurados)} registros.
					</span>
				</Alert>
			)}

			{lido && contagemBackup && (
				<div className="flex flex-col gap-4 rounded-lg border border-border p-3">
					<div className="flex flex-col gap-0.5 text-sm">
						<span className="font-medium text-foreground">{lido.nome}</span>
						<span className="text-muted-foreground">
							Backup de {lido.backup.tenant_nome} gerado em{" "}
							{formatarDataHora(lido.backup.exportado_em)}
						</span>
					</div>

					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border text-xs text-muted-foreground">
								<th className="py-1.5 text-left font-medium">Dados</th>
								<th className="py-1.5 text-right font-medium">
									Neste aparelho
								</th>
								<th className="py-1.5 text-right font-medium">No backup</th>
							</tr>
						</thead>
						<tbody>
							{tabelasComDados.map((tabela) => (
								<tr
									key={tabela}
									className="border-b border-border last:border-0"
								>
									<td className="py-1.5 text-foreground">
										{ROTULOS_TABELA_BACKUP[tabela]}
									</td>
									<td className="py-1.5 text-right text-muted-foreground tabular-nums">
										{formatoNumero.format(contagemAtual?.[tabela] ?? 0)}
									</td>
									<td className="py-1.5 text-right text-foreground tabular-nums">
										{formatoNumero.format(contagemBackup[tabela])}
									</td>
								</tr>
							))}
						</tbody>
					</table>

					<Alert variant="warning">
						A restauração{" "}
						<strong>substitui todos os dados deste aparelho</strong> pelos do
						backup. O que foi criado ou alterado depois de{" "}
						{formatarDataHora(lido.backup.exportado_em)} será perdido. Na
						dúvida, baixe antes um backup dos dados atuais.
					</Alert>

					<label
						htmlFor={confirmacaoId}
						className="flex cursor-pointer items-start gap-2 text-sm text-foreground"
					>
						<input
							id={confirmacaoId}
							type="checkbox"
							checked={confirmado}
							onChange={(e) => setConfirmado(e.target.checked)}
							className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--destructive))]"
						/>
						Entendo que os dados atuais deste aparelho serão substituídos.
					</label>

					<div className="flex flex-wrap gap-2">
						<Button
							variant="destructive"
							className="border border-destructive/40"
							disabled={!confirmado || restaurando}
							onClick={() => void confirmarRestauracao()}
						>
							{restaurando ? "Restaurando..." : "Substituir dados do aparelho"}
						</Button>
						<Button
							variant="ghost"
							disabled={restaurando}
							onClick={() => {
								setLido(null);
								setConfirmado(false);
							}}
						>
							Cancelar
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
