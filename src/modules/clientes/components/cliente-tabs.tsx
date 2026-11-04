import { FileText, UserRound } from "lucide-react";
import { NavLink } from "react-router";

interface ClienteTabsProps {
	clienteId: string;
}

const ABAS = [
	{ sufixo: "editar", rotulo: "Dados", icone: UserRound },
	{ sufixo: "pedidos", rotulo: "Pedidos", icone: FileText },
] as const;

/** Abas da tela do cliente: cadastro e histórico de pedidos. */
export function ClienteTabs({ clienteId }: ClienteTabsProps) {
	return (
		<nav
			aria-label="Seções do cliente"
			className="flex items-center gap-1 border-b border-border"
		>
			{ABAS.map(({ sufixo, rotulo, icone: Icone }) => (
				<NavLink
					key={sufixo}
					to={`/clientes/${clienteId}/${sufixo}`}
					end
					className={({ isActive }) =>
						`-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
							isActive
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`
					}
				>
					<Icone aria-hidden="true" className="size-4" />
					{rotulo}
				</NavLink>
			))}
		</nav>
	);
}
