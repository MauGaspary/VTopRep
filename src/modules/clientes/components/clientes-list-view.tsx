import { Archive, FilePlus2, Plus, RotateCcw, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	EmptyState,
	PageHeader,
	SearchInput,
} from "../../../shared/components/ui";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import type { Cliente } from "../domain/cliente.schema";
import { useClienteActions, useTodosClientes } from "../hooks/use-clientes";

export function ClientesListView() {
	const { config } = useTenant();
	const [termoBusca, setTermoBusca] = useState("");
	const [mostrarInativos, setMostrarInativos] = useState(false);
	const [erro, setErro] = useState<string | null>(null);
	const { clientes: todosClientes, isLoading } = useTodosClientes(
		config.id,
		termoBusca,
	);
	const { inativar, reativar } = useClienteActions(config.id);

	const clientes = mostrarInativos
		? todosClientes
		: todosClientes.filter((c) => c.ativo);

	const handleInativar = async (cliente: Cliente) => {
		const confirmado = window.confirm(
			`Inativar o cliente "${cliente.razao_social}"? Ele não aparecerá na seleção de novos orçamentos.`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(cliente.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao inativar cliente"));
		}
	};

	const handleReativar = async (cliente: Cliente) => {
		setErro(null);
		try {
			await reativar(cliente.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao reativar cliente"));
		}
	};

	return (
		<Page>
			<PageHeader
				title="Carteira de Clientes"
				description="Clientes cadastrados para cotações, tabelas personalizadas e emissão de pedidos."
				action={
					<Link to="/clientes/novo" className={buttonClassName()}>
						<Plus aria-hidden="true" />
						Novo cliente
					</Link>
				}
			/>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<SearchInput
					id="busca-clientes"
					placeholder="Filtrar por razão social, nome fantasia ou CPF/CNPJ..."
					value={termoBusca}
					onChange={setTermoBusca}
					className="flex-1"
				/>

				<div className="flex items-center justify-between gap-3 sm:justify-end">
					<span className="text-xs text-muted-foreground tabular-nums">
						{clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
					</span>
					<label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground select-none hover:bg-muted">
						<input
							type="checkbox"
							checked={mostrarInativos}
							onChange={(e) => setMostrarInativos(e.target.checked)}
							className="size-3.5 accent-primary"
						/>
						Mostrar inativos
					</label>
				</div>
			</div>

			{erro && <Alert variant="destructive">{erro}</Alert>}

			{isLoading && (
				<p className="py-6 text-center text-muted-foreground">Carregando...</p>
			)}

			{!isLoading && clientes.length === 0 && (
				<EmptyState
					icon={Users}
					title={
						termoBusca
							? "Nenhum cliente encontrado para a busca."
							: "Nenhum cliente cadastrado na carteira ainda."
					}
					description="Adicione clientes para vincular tabelas de preço padrão e emitir pedidos."
				/>
			)}

			{!isLoading && clientes.length > 0 && (
				<section
					aria-label="Lista de clientes da carteira"
					className="dense-table-region rounded-xl border border-border bg-card"
				>
					<table className="text-left text-sm">
						<thead>
							<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
								<th className="px-3.5 py-2.5">Cliente</th>
								<th className="hidden px-3 py-2.5 sm:table-cell">Documento</th>
								<th className="hidden px-3 py-2.5 md:table-cell">Tipo</th>
								<th className="px-3.5 py-2.5 text-right">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{clientes.map((c) => {
								const isInativo = !c.ativo;
								const isPj = c.cnpj_cpf.length === 14;
								return (
									<tr
										key={c.id}
										className={`group transition-colors hover:bg-muted/50 ${
											isInativo ? "bg-muted/25 opacity-65" : ""
										}`}
									>
										<td className="px-3.5 py-2.5 align-middle">
											<div className="flex flex-col">
												<div className="flex flex-wrap items-center gap-2">
													<Link
														to={`/clientes/${c.id}/editar`}
														className="font-medium text-foreground hover:text-primary"
													>
														{c.razao_social}
													</Link>
													{isInativo && (
														<Badge variant="secondary">Inativo</Badge>
													)}
												</div>
												{c.nome_fantasia && (
													<span className="text-xs text-muted-foreground">
														{c.nome_fantasia}
													</span>
												)}
												<span className="mt-0.5 font-mono text-xs text-muted-foreground sm:hidden">
													{formatarCpfCnpj(c.cnpj_cpf)}
												</span>
											</div>
										</td>

										<td className="hidden px-3 py-2.5 align-middle font-mono text-xs text-muted-foreground whitespace-nowrap sm:table-cell">
											{formatarCpfCnpj(c.cnpj_cpf)}
										</td>

										<td className="hidden px-3 py-2.5 align-middle whitespace-nowrap md:table-cell">
											<span className="inline-flex h-5 items-center rounded border border-border bg-muted/50 px-1.5 font-mono text-[11px] text-muted-foreground">
												{isPj ? "PJ · CNPJ" : "PF · CPF"}
											</span>
										</td>

										<td className="px-3.5 py-2.5 text-right align-middle whitespace-nowrap">
											<div className="inline-flex items-center justify-end gap-1">
												{!isInativo && (
													<Link
														to={`/pedidos/novo?clienteId=${c.id}`}
														className={buttonClassName({
															variant: "primary",
															size: "sm",
														})}
														title="Iniciar novo orçamento para este cliente"
													>
														<FilePlus2
															aria-hidden="true"
															className="size-3.5"
														/>
														Orçar
													</Link>
												)}
												<Link
													to={`/clientes/${c.id}/editar`}
													className={buttonClassName({
														variant: "secondary",
														size: "sm",
													})}
												>
													Editar
												</Link>
												{isInativo ? (
													<Button
														variant="secondary"
														size="sm"
														onClick={() => handleReativar(c)}
														title="Reativar cliente"
													>
														<RotateCcw
															aria-hidden="true"
															className="size-3.5"
														/>
														Reativar
													</Button>
												) : (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => handleInativar(c)}
														title="Inativar cliente"
														aria-label={`Inativar ${c.razao_social}`}
														className="px-2 text-subtle-foreground hover:text-destructive"
													>
														<Archive aria-hidden="true" className="size-3.5" />
													</Button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</section>
			)}
		</Page>
	);
}
