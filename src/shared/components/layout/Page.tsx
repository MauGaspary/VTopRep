import type { ReactNode } from "react";

export type PageWidth = "narrow" | "form" | "wide";

const widthStyles: Record<PageWidth, string> = {
	narrow: "max-w-2xl",
	form: "max-w-3xl",
	wide: "max-w-5xl",
};

interface PageProps {
	width?: PageWidth;
	children: ReactNode;
}

/** Contêiner padrão de uma tela dentro do painel de conteúdo. */
export function Page({ width = "wide", children }: PageProps) {
	return (
		<section
			className={`mx-auto flex w-full ${widthStyles[width]} flex-col gap-5 px-4 py-5 md:px-8 md:py-8`}
		>
			{children}
		</section>
	);
}
