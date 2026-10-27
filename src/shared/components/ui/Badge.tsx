import type { ReactNode } from "react";

export type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

export interface BadgeProps {
	variant?: BadgeVariant;
	children: ReactNode;
	className?: string;
}

export function Badge({
	variant = "default",
	children,
	className = "",
}: BadgeProps) {
	const variantStyles: Record<BadgeVariant, string> = {
		default: "bg-primary text-primary-foreground",
		secondary: "bg-muted text-muted-foreground",
		destructive:
			"bg-destructive/10 text-destructive border border-destructive/20",
		outline: "border border-border text-foreground",
	};

	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}
		>
			{children}
		</span>
	);
}
