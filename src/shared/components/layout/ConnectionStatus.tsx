import { useOnlineStatus } from "../../hooks/use-online-status";

interface ConnectionStatusProps {
	/** Mostra apenas o indicador, com o texto disponível só para leitores de tela. */
	compact?: boolean;
}

export function ConnectionStatus({ compact = false }: ConnectionStatusProps) {
	const online = useOnlineStatus();
	const rotulo = online ? "Online" : "Offline — alterações salvas no aparelho";

	return (
		<div
			role="status"
			className="flex items-center gap-2 text-xs text-muted-foreground"
			title={rotulo}
		>
			<span
				aria-hidden="true"
				className={`size-2 shrink-0 rounded-full ${online ? "bg-success" : "bg-warning"}`}
			/>
			<span className={compact ? "sr-only" : "truncate"}>{rotulo}</span>
		</div>
	);
}
