import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { type FieldSize, fieldClassName } from "./Input";

export interface SelectProps
	extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
	hasError?: boolean;
	/** `sm`: seletor compacto e de largura automática (ex.: tipo de um item em lista). */
	size?: FieldSize;
}

export function Select({
	hasError,
	size = "md",
	className = "",
	children,
	...props
}: SelectProps) {
	const compacto = size === "sm";

	return (
		<div className={`relative ${compacto ? "w-fit" : "w-full"}`}>
			<select
				className={`w-full appearance-none ${compacto ? "pr-7" : "pr-9"} ${fieldClassName(hasError, size)} ${className}`}
				{...props}
			>
				{children}
			</select>
			<ChevronDown
				aria-hidden="true"
				className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${
					compacto ? "right-2 size-3.5" : "right-3 size-4"
				}`}
			/>
		</div>
	);
}
