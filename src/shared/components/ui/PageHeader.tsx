import type { ReactNode } from "react";

export interface PageHeaderProps {
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}

export function PageHeader({
	title,
	description,
	action,
	className = "",
}: PageHeaderProps) {
	return (
		<div
			className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
		>
			<div>
				<h1 className="text-2xl font-semibold text-foreground">{title}</h1>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{action && <div>{action}</div>}
		</div>
	);
}
