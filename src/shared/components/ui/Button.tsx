import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
	| "primary"
	| "secondary"
	| "destructive"
	| "outline"
	| "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonStyleOptions {
	variant?: ButtonVariant;
	size?: ButtonSize;
	className?: string;
}

const baseStyles =
	"inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-[background-color,color,filter] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

// Alturas compactas no desktop; alvos de toque ≥ 44px em telas sensíveis ao toque.
const sizeStyles: Record<ButtonSize, string> = {
	sm: "h-7 px-2.5 text-xs pointer-coarse:h-9",
	md: "h-8 px-3.5 text-sm pointer-coarse:h-11",
	lg: "h-10 px-4 text-sm pointer-coarse:h-12",
};

const variantStyles: Record<ButtonVariant, string> = {
	primary:
		"bg-primary text-primary-foreground hover:brightness-110 active:brightness-95",
	secondary:
		"border border-border bg-secondary text-secondary-foreground hover:bg-muted",
	destructive: "text-destructive hover:bg-destructive/10",
	outline: "border border-input bg-transparent text-foreground hover:bg-muted",
	ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

/** Classes do botão, para aplicar o mesmo visual em `<Link>` sem aninhar `<button>`. */
export function buttonClassName({
	variant = "primary",
	size = "md",
	className = "",
}: ButtonStyleOptions = {}): string {
	return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
}

export function Button({
	variant = "primary",
	size = "md",
	className = "",
	children,
	...props
}: ButtonProps) {
	return (
		<button
			type="button"
			className={buttonClassName({ variant, size, className })}
			{...props}
		>
			{children}
		</button>
	);
}
