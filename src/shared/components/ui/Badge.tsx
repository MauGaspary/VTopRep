import type { ReactNode } from "react";

export type BadgeVariant =
	| "default"
	| "destructive"
	| "outline"
	| "secondary"
	| "success";

export interface BadgeProps {
	variant?: BadgeVariant;
	children: ReactNode;
	className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
	default: "border-primary bg-primary text-primary-foreground",
	secondary: "border-border bg-muted text-muted-foreground",
	destructive: "border-destructive/25 bg-destructive/10 text-destructive",
	success: "border-success/25 bg-success/10 text-success",
	outline: "border-border bg-transparent text-foreground",
};

export function Badge({
	variant = "default",
	children,
	className = "",
}: BadgeProps) {
	return (
		<span
			className={`inline-flex h-5 items-center rounded-md border px-1.5 text-xs leading-none font-medium ${variantStyles[variant]} ${className}`}
		>
			{children}
		</span>
	);
}
