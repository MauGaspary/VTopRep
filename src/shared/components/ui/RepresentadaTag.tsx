import type { CorRepresentada } from "../../../modules/representadas/domain/representada.schema";

export interface EstiloCorRepresentada {
	dot: string;
	badge: string;
	activeAccent: string;
	swatch: string;
}

export const ESTILOS_COR_REPRESENTADA: Record<
	CorRepresentada,
	EstiloCorRepresentada
> = {
	indigo: {
		dot: "bg-indigo-500",
		badge:
			"border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
		activeAccent: "border-l-indigo-500",
		swatch: "bg-indigo-500 ring-indigo-500/40",
	},
	emerald: {
		dot: "bg-emerald-500",
		badge:
			"border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		activeAccent: "border-l-emerald-500",
		swatch: "bg-emerald-500 ring-emerald-500/40",
	},
	amber: {
		dot: "bg-amber-500",
		badge:
			"border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
		activeAccent: "border-l-amber-500",
		swatch: "bg-amber-500 ring-amber-500/40",
	},
	rose: {
		dot: "bg-rose-500",
		badge: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
		activeAccent: "border-l-rose-500",
		swatch: "bg-rose-500 ring-rose-500/40",
	},
	cyan: {
		dot: "bg-cyan-500",
		badge: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
		activeAccent: "border-l-cyan-500",
		swatch: "bg-cyan-500 ring-cyan-500/40",
	},
	violet: {
		dot: "bg-violet-500",
		badge:
			"border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
		activeAccent: "border-l-violet-500",
		swatch: "bg-violet-500 ring-violet-500/40",
	},
	blue: {
		dot: "bg-blue-500",
		badge: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300",
		activeAccent: "border-l-blue-500",
		swatch: "bg-blue-500 ring-blue-500/40",
	},
	orange: {
		dot: "bg-orange-500",
		badge:
			"border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
		activeAccent: "border-l-orange-500",
		swatch: "bg-orange-500 ring-orange-500/40",
	},
};

export interface RepresentadaDotProps {
	cor: CorRepresentada;
	size?: "sm" | "md";
	className?: string;
}

export function RepresentadaDot({
	cor,
	size = "md",
	className = "",
}: RepresentadaDotProps) {
	const dim = size === "sm" ? "size-2" : "size-2.5";
	return (
		<span
			aria-hidden="true"
			className={`inline-block shrink-0 rounded-full ${dim} ${ESTILOS_COR_REPRESENTADA[cor].dot} ${className}`}
		/>
	);
}

export interface RepresentadaBadgeProps {
	nome: string;
	cor: CorRepresentada;
	className?: string;
}

export function RepresentadaBadge({
	nome,
	cor,
	className = "",
}: RepresentadaBadgeProps) {
	const estilo = ESTILOS_COR_REPRESENTADA[cor];
	return (
		<span
			className={`inline-flex h-5 max-w-full items-center gap-1.5 rounded-md border px-1.5 text-xs leading-none font-medium ${estilo.badge} ${className}`}
		>
			<span
				aria-hidden="true"
				className={`size-1.5 shrink-0 rounded-full ${estilo.dot}`}
			/>
			<span className="truncate">{nome}</span>
		</span>
	);
}
