import { NavLink } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";

const LINKS = [
	{ to: "/catalogo", label: "Catálogo" },
	{ to: "/representadas", label: "Representadas" },
] as const;

export function Header() {
	const { config } = useTenant();

	return (
		<header className="border-b border-border bg-card">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col">
					<span className="text-lg font-semibold text-card-foreground">
						{config.empresa.nomeFantasia}
					</span>
					<span className="text-xs text-muted-foreground">
						CNPJ: {config.empresa.cnpj}
					</span>
				</div>
				<nav aria-label="Navegação principal" className="flex gap-1">
					{LINKS.map((link) => (
						<NavLink
							key={link.to}
							to={link.to}
							className={({ isActive }) =>
								`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
									isActive
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								}`
							}
						>
							{link.label}
						</NavLink>
					))}
				</nav>
			</div>
		</header>
	);
}
