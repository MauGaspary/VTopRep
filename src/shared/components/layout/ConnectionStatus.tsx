import { useTenant } from "../../../config/tenant/useTenant";
import { useOutboxResumo } from "../../../modules/sync/hooks/use-outbox";
import { useOnlineStatus } from "../../hooks/use-online-status";

interface ConnectionStatusProps {
	/** Mostra apenas o indicador, com o texto disponível só para leitores de tela. */
	compact?: boolean;
}

export function ConnectionStatus({ compact = false }: ConnectionStatusProps) {
	const online = useOnlineStatus();
	const { config } = useTenant();
	const { resumo } = useOutboxResumo(config.id);

	const sufixoFila =
		resumo.falhas > 0
			? ` · ${resumo.falhas} falha(s) na fila`
			: resumo.pendentes > 0
				? ` · ${resumo.pendentes} na fila`
				: "";

	const rotulo = online
		? `Online${sufixoFila}`
		: `Offline — alterações salvas no aparelho${sufixoFila}`;

	const corIndicador = !online
		? "bg-warning"
		: resumo.falhas > 0
			? "bg-destructive"
			: "bg-success";

	return (
		<div
			role="status"
			className="flex items-center gap-2 text-xs text-muted-foreground"
			title={rotulo}
		>
			<span
				aria-hidden="true"
				className={`size-2 shrink-0 rounded-full ${corIndicador}`}
			/>
			<span className={compact ? "sr-only" : "truncate"}>{rotulo}</span>
		</div>
	);
}
