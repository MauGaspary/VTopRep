import { useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import {
	Alert,
	Badge,
	Button,
	PageHeader,
	SearchInput,
} from "../../../shared/components/ui";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import type { Cliente } from "../domain/cliente.schema";
import { useClienteActions, useTodosClientes } from "../hooks/use-clientes";

export function ClientesListView() {
	const { config } = useTenant();
	const [termoBusca, setTermoBusca] = useState("");
	const [erro, setErro] = useState<string | null>(null);
	const { clientes, isLoading } = useTodosClientes(config.id, termoBusca);
	const { inativar, reativar } = useClienteActions(config.id);

	const handleInativar = async (cliente: Cliente) => {
		const confirmado = window.confirm(
			`Inativar o cliente "${cliente.razao_social}"? Ele não aparecerá na seleção de novos orçamentos.`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(cliente.id);
		} catch (e) {
			setErro(e instanceof Error ? e.message : "Erro ao inativar cliente");
		}
	};

	const handleReativar = async (cliente: Cliente) => {
		setErro(null);
		try {
			await reativar(cliente.id);
		} catch (e) {
			setErro(e instanceof Error ? e.message : "Erro ao reativar cliente");
		}
	};

	return (
		<section className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
			<PageHeader
				title="Carteira de Clientes"
				description="Clientes cadastrados para cotações e emissão de pedidos."
				action={
					<Link to="/clientes/novo">
						<Button variant="primary">+ Novo cliente</Button>
					</Link>
				}
			/>

			<SearchInput
				id="busca-clientes"
				placeholder="Razão Social, Nome Fantasia ou CPF/CNPJ..."
				value={termoBusca}
				onChange={setTermoBusca}
			/>

			{erro && <Alert variant="destructive">{erro}</Alert>}

			{isLoading && (
				<p className="py-6 text-center text-muted-foreground">Carregando...</p>
			)}

			{!isLoading && clientes.length === 0 && (
				<div className="rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
					{termoBusca
						? "Nenhum cliente encontrado para a busca."
						: "Nenhum cliente cadastrado na carteira ainda."}
				</div>
			)}

			{!isLoading && clientes.length > 0 && (
				<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{clientes.map((c) => {
						const isInativo = c.deleted_at !== null;
						return (
							<li
								key={c.id}
								className={`flex flex-col justify-between gap-3 rounded-lg border p-4 shadow-sm transition-opacity ${
									isInativo
										? "border-dashed border-border bg-muted/40 opacity-70"
										: "border-border bg-card"
								}`}
							>
								<div className="flex flex-col">
									<div className="flex items-center gap-2">
										<h2 className="font-semibold leading-tight text-card-foreground">
											{c.razao_social}
										</h2>
										{isInativo && <Badge variant="destructive">Inativo</Badge>}
									</div>
									{c.nome_fantasia && (
										<span className="text-sm text-muted-foreground">
											{c.nome_fantasia}
										</span>
									)}
									<span className="font-mono text-xs text-muted-foreground mt-1">
										Doc: {formatarCpfCnpj(c.cnpj_cpf)}
									</span>
								</div>

								<div className="flex justify-end gap-2 border-t border-border pt-3">
									{isInativo ? (
										<Button
											variant="secondary"
											size="sm"
											onClick={() => handleReativar(c)}
										>
											Reativar
										</Button>
									) : (
										<Button
											variant="destructive"
											size="sm"
											onClick={() => handleInativar(c)}
										>
											Inativar
										</Button>
									)}
									<Link to={`/clientes/${c.id}/editar`}>
										<Button variant="secondary" size="sm">
											Editar
										</Button>
									</Link>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
