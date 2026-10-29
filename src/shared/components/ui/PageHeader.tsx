import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

export interface PageHeaderProps {
	title: string;
	description?: string;
	action?: ReactNode;
	/** Link de retorno exibido acima do título (ex.: formulário → lista). */
	back?: { to: string; label: string };
	className?: string;
}

export function PageHeader({
	title,
	description,
	action,
	back,
	className = "",
}: PageHeaderProps) {
	return (
		<div
			className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
		>
			<div className="flex flex-col gap-1">
				{back && (
					<Link
						to={back.to}
						className="-ml-1 inline-flex w-fit items-center gap-0.5 rounded-md px-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
					>
						<ChevronLeft aria-hidden="true" className="size-4" />
						{back.label}
					</Link>
				)}
				<h1 className="text-xl font-semibold tracking-tight text-foreground">
					{title}
				</h1>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{action && <div className="flex shrink-0 gap-2">{action}</div>}
		</div>
	);
}
