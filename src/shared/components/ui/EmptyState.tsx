import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: ReactNode;
}

/** Estado vazio de listas (nenhum registro ou busca sem resultado). */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-6 py-12 text-center">
			{Icon && (
				<span className="mb-1 flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
					<Icon aria-hidden="true" className="size-5" />
				</span>
			)}
			<p className="font-medium text-foreground">{title}</p>
			{description && (
				<p className="max-w-sm text-sm text-muted-foreground">{description}</p>
			)}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}
