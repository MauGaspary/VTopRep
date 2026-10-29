import type { ReactNode } from "react";

export type AlertVariant = "info" | "destructive" | "warning";

export interface AlertProps {
	variant?: AlertVariant;
	children: ReactNode;
	className?: string;
}

const variantStyles: Record<AlertVariant, string> = {
	destructive: "border-destructive/30 bg-destructive/8 text-destructive",
	warning: "border-warning/30 bg-warning/8 text-warning",
	info: "border-border bg-muted text-foreground",
};

export function Alert({
	variant = "destructive",
	children,
	className = "",
}: AlertProps) {
	return (
		<div
			role="alert"
			className={`rounded-lg border px-3 py-2.5 text-sm ${variantStyles[variant]} ${className}`}
		>
			{children}
		</div>
	);
}
