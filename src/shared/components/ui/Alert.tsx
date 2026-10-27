import type { ReactNode } from "react";

export type AlertVariant = "info" | "destructive" | "warning";

export interface AlertProps {
	variant?: AlertVariant;
	children: ReactNode;
	className?: string;
}

export function Alert({
	variant = "destructive",
	children,
	className = "",
}: AlertProps) {
	const variantStyles: Record<AlertVariant, string> = {
		destructive: "border-destructive/40 bg-destructive/10 text-destructive",
		warning:
			"border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
		info: "border-primary/40 bg-primary/10 text-primary",
	};

	return (
		<div
			role="alert"
			className={`rounded-lg border px-3 py-2 text-sm ${variantStyles[variant]} ${className}`}
		>
			{children}
		</div>
	);
}
