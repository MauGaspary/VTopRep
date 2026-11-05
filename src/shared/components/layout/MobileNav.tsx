import { DatabaseBackup } from "lucide-react";
import { NavLink } from "react-router";
import { ConnectionStatus } from "./ConnectionStatus";
import { NAV_ITEMS_MOBILE } from "./navigation";
import { TenantBrand } from "./TenantBrand";
import { ThemeToggle } from "./ThemeToggle";

/** Barra superior compacta (mobile, < md). */
export function MobileTopBar() {
	return (
		<header className="sticky top-0 z-30 flex h-12 items-center justify-between gap-3 border-b border-border bg-background px-4 lg:hidden">
			<TenantBrand />
			<div className="flex shrink-0 items-center gap-3">
				<NavLink
					to="/dados"
					aria-label="Dados e backup"
					title="Dados e backup"
					className={({ isActive }) =>
						`flex size-9 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
							isActive
								? "bg-foreground/7 text-primary"
								: "text-muted-foreground hover:text-foreground"
						}`
					}
				>
					<DatabaseBackup aria-hidden="true" className="size-4" />
				</NavLink>
				<ThemeToggle compact />
				<ConnectionStatus compact />
			</div>
		</header>
	);
}

/** Barra de abas inferior (mobile, < md), ao alcance do polegar. */
export function MobileBottomNav() {
	return (
		<nav
			aria-label="Navegação principal"
			className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden"
		>
			<ul
				className="grid"
				style={{
					gridTemplateColumns: `repeat(${NAV_ITEMS_MOBILE.length}, minmax(0, 1fr))`,
				}}
			>
				{NAV_ITEMS_MOBILE.map(({ to, label, shortLabel, icon: Icon }) => (
					<li key={to} className="min-w-0">
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
									<span className="max-w-full truncate px-0.5">
										{shortLabel ?? label}
									</span>
								</>
							)}
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
