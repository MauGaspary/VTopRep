import type { ReactNode } from "react";

export interface CardStyleOptions {
	/** Registro inativo: borda tracejada e conteúdo esmaecido. */
	inactive?: boolean;
	className?: string;
}

/** Superfície elevada (borda fina, sem sombra). Útil para `<form>` e outros elementos. */
export function cardClassName({
	inactive = false,
	className = "",
}: CardStyleOptions = {}): string {
	return `rounded-xl border ${
		inactive
			? "border-dashed border-input bg-muted/40 text-card-foreground opacity-80"
			: "border-border bg-card text-card-foreground"
	} ${className}`;
}

export interface CardProps extends CardStyleOptions {
	as?: "div" | "li" | "section" | "article";
	children: ReactNode;
}

export function Card({ as: Tag = "div", children, ...style }: CardProps) {
	return <Tag className={cardClassName(style)}>{children}</Tag>;
}
