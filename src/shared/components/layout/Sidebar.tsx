import { NavLink } from "react-router";
import { ConnectionStatus } from "./ConnectionStatus";
import { NAV_GROUPS } from "./navigation";
import { TenantBrand } from "./TenantBrand";

/** Barra lateral fixa (desktop/tablet, ≥ md). */
export function Sidebar() {
	return (
		<aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 px-3 py-4 md:flex">
			<div className="px-2">
				<TenantBrand showCnpj />
			</div>

			<nav
				aria-label="Navegação principal"
				className="flex flex-1 flex-col gap-5 overflow-y-auto"
			>
				{NAV_GROUPS.map((grupo) => (
					<div key={grupo.label} className="flex flex-col gap-0.5">
						<span className="px-2 pb-1 text-xs font-medium text-subtle-foreground">
							{grupo.label}
						</span>
						{grupo.items.map(({ to, label, icon: Icon }) => (
							<NavLink
								key={to}
								to={to}
								className={({ isActive }) =>
									`group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
										isActive
											? "bg-foreground/7 font-medium text-foreground"
											: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
									}`
								}
							>
								{({ isActive }) => (
									<>
										<Icon
											aria-hidden="true"
											className={`size-4 shrink-0 ${isActive ? "text-primary" : ""}`}
										/>
										{label}
									</>
								)}
							</NavLink>
						))}
					</div>
				))}
			</nav>

			<div className="border-t border-border px-2 pt-3">
				<ConnectionStatus />
			</div>
		</aside>
	);
}
