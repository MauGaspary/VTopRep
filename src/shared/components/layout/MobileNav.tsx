import { NavLink } from "react-router";
import { ConnectionStatus } from "./ConnectionStatus";
import { NAV_ITEMS } from "./navigation";
import { TenantBrand } from "./TenantBrand";

/** Barra superior compacta (mobile, < md). */
export function MobileTopBar() {
	return (
		<header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
			<TenantBrand />
			<ConnectionStatus compact />
		</header>
	);
}

/** Barra de abas inferior (mobile, < md), ao alcance do polegar. */
export function MobileBottomNav() {
	return (
		<nav
			aria-label="Navegação principal"
			className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
		>
			<ul
				className="grid"
				style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, 1fr)` }}
			>
				{NAV_ITEMS.map(({ to, label, icon: Icon }) => (
					<li key={to}>
						<NavLink
							to={to}
							className={({ isActive }) =>
								`flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset ${
									isActive
										? "text-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`
							}
						>
							{({ isActive }) => (
								<>
									<Icon
										aria-hidden="true"
										className={`size-5 ${isActive ? "text-primary" : ""}`}
									/>
									{label}
								</>
							)}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
