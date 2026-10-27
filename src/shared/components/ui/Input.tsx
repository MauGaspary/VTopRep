import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	hasError?: boolean;
}

export function Input({ hasError, className = "", ...props }: InputProps) {
	return (
		<input
			className={`w-full rounded-lg border bg-background px-3 py-2 text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring text-sm ${
				hasError ? "border-destructive" : "border-input"
			} ${className}`}
			{...props}
		/>
	);
}
