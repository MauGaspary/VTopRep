import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	Card,
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
				description="Clientes cadastrados para cotações e emissão de pedidos."
				action={
					<Link to="/clientes/novo" className={buttonClassName()}>
						<Plus aria-hidden="true" />
						Novo cliente
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
				<EmptyState
					icon={Users}
					title={
						termoBusca
							? "Nenhum cliente encontrado para a busca."
							: "Nenhum cliente cadastrado na carteira ainda."
					}
				/>
			)}

			{!isLoading && clientes.length > 0 && (
				<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{clientes.map((c) => {
						const isInativo = !c.ativo;
						return (
							<Card
								as="li"
								key={c.id}
								inactive={isInativo}
								className="flex flex-col justify-between gap-3 p-4"
							>
								<div className="flex flex-col gap-0.5">
									<div className="flex items-center gap-2">
										<h2 className="text-[15px] leading-tight font-medium text-foreground">
											{c.razao_social}
										</h2>
										{isInativo && <Badge variant="destructive">Inativo</Badge>}
									</div>
									{c.nome_fantasia && (
										<span className="text-sm text-muted-foreground">
											{c.nome_fantasia}
										</span>
									)}
									<span className="mt-1 font-mono text-xs text-muted-foreground">
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
									<Link
										to={`/clientes/${c.id}/editar`}
										className={buttonClassName({
											variant: "secondary",
											size: "sm",
										})}
									>
										Editar
									</Link>
								</div>
							</Card>
						);
					})}
				</ul>
			)}
		</Page>
	);
}
