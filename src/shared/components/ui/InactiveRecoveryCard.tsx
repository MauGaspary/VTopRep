import { Button } from "./Button";

export interface InactiveRecoveryCardProps {
	title?: string;
	entityName: string;
	details?: string;
	onReativar: () => void;
	isLoading?: boolean;
}

export function InactiveRecoveryCard({
	title = "Registro inativo encontrado:",
	entityName,
	details,
	onReativar,
	isLoading = false,
}: InactiveRecoveryCardProps) {
	return (
		<div
			role="alert"
			className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<p className="font-semibold text-primary">{title}</p>
				<p className="text-muted-foreground">
					"{entityName}" {details ? `(${details})` : ""}
				</p>
			</div>
			<Button
				type="button"
				onClick={onReativar}
				disabled={isLoading}
				className="shrink-0"
			>
				{isLoading ? "Reativando..." : "Reativar agora"}
			</Button>
		</div>
	);
}
