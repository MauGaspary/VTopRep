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
			className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"
		>
			<div className="flex flex-col gap-0.5">
				<p className="font-medium">{title}</p>
				<p className="text-muted-foreground">
					"{entityName}" {details ? `(${details})` : ""}
				</p>
			</div>
			<Button type="button" onClick={onReativar} disabled={isLoading}>
				{isLoading ? "Reativando..." : "Reativar agora"}
			</Button>
		</div>
	);
}
