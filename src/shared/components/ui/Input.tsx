import type { InputHTMLAttributes } from "react";

export type FieldSize = "sm" | "md";

const fieldSizeStyles: Record<FieldSize, string> = {
	sm: "h-7 px-2 text-xs pointer-coarse:h-9",
	// `text-base` no toque evita o zoom automático do iOS ao focar o campo.
	md: "h-9 px-3 text-sm pointer-coarse:h-11 pointer-coarse:text-base",
};

/** Visual compartilhado por campos de texto e seleção (`Input`, `Select`). */
export function fieldClassName(
	hasError: boolean | undefined,
	size: FieldSize = "md",
): string {
	return `rounded-lg border bg-background text-foreground transition-[border-color,box-shadow] placeholder:text-subtle-foreground focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${fieldSizeStyles[size]} ${
		hasError
			? "border-destructive focus:ring-destructive/25"
			: "border-input focus:border-primary/60 focus:ring-ring/25"
	}`;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	hasError?: boolean;
}

export function Input({ hasError, className = "", ...props }: InputProps) {
	return (
		<input
			className={`w-full ${fieldClassName(hasError)} ${className}`}
			{...props}
		/>
	);
}
