import type { ReactNode } from "react";
import { LembreteBackupBanner } from "../../../modules/backup/components/lembrete-backup-banner";
import { useSolicitarArmazenamentoPersistente } from "../../hooks/use-armazenamento";
import { AvisoNovaVersao } from "./AvisoNovaVersao";
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
	useSolicitarArmazenamentoPersistente();

	return (
		<div className="flex min-h-svh">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2">
				<MobileTopBar />
				<main className="min-w-0 flex-1 overflow-x-clip bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:rounded-xl lg:border lg:border-border lg:pb-0">
					<LembreteBackupBanner />
					{children}
				</main>
			</div>
			<MobileBottomNav />
			<AvisoNovaVersao />
		</div>
	);
}
