import { Button } from "./Button";

export interface ShowMoreProps {
	restantes: number;
	passo: number;
	onMostrarMais: () => void;
	onMostrarTodos: () => void;
	className?: string;
}

/** Rodapé de lista incremental: "Mostrar mais N" e "Mostrar todos". */
export function ShowMore({
	restantes,
	passo,
	onMostrarMais,
	onMostrarTodos,
	className = "",
}: ShowMoreProps) {
	if (restantes <= 0) return null;
	return (
		<div
			className={`flex flex-wrap items-center justify-center gap-2 border-t border-border px-3 py-2.5 ${className}`}
		>
			<span className="text-xs text-muted-foreground">
				Mais {restantes} {restantes === 1 ? "produto" : "produtos"}. Use a busca
				para achar mais rápido.
			</span>
			<Button variant="secondary" size="sm" onClick={onMostrarMais}>
				Mostrar mais {Math.min(passo, restantes)}
			</Button>
			{restantes > passo && (
				<Button variant="ghost" size="sm" onClick={onMostrarTodos}>
					Mostrar todos
				</Button>
			)}
		</div>
	);
}
