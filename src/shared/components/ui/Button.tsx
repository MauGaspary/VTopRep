import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
	| "primary"
	| "secondary"
	| "destructive"
	| "outline"
	| "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
}

export function Button({
	variant = "primary",
	size = "md",
	className = "",
	disabled,
	children,
	...props
}: ButtonProps) {
	const baseStyles =
		"inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none";

	const sizeStyles: Record<ButtonSize, string> = {
		sm: "px-3 py-1.5 text-xs",
		md: "px-4 py-2 text-sm",
		lg: "px-5 py-2.5 text-base",
	};

	const variantStyles: Record<ButtonVariant, string> = {
		primary: "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
		secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
		destructive: "text-destructive hover:bg-destructive/10",
		outline:
			"border border-input bg-background hover:bg-muted text-foreground shadow-sm",
		ghost: "text-foreground hover:bg-muted",
	};

	return (
		<button
			type="button"
			disabled={disabled}
			className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
			{...props}
		>
			{children}
		</button>
	);
}
