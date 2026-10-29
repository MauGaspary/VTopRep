import type { ReactNode } from "react";
import { MobileBottomNav, MobileTopBar } from "./MobileNav";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
	children: ReactNode;
}

/**
 * Estrutura do app: barra lateral sobre o fundo `sidebar` e o conteúdo num
 * painel elevado (≥ md). No mobile, barra superior + abas inferiores.
 */
export function AppShell({ children }: AppShellProps) {
	return (
		<div className="flex min-h-svh">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
				<MobileTopBar />
				<main className="flex-1 bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:rounded-xl md:border md:border-border md:pb-0">
					{children}
				</main>
			</div>
			<MobileBottomNav />
		</div>
	);
}
