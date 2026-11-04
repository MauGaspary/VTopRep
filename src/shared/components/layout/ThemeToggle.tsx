import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { useId } from "react";
import { useTema } from "../../../config/tema/useTema";
import {
	type PreferenciaTema,
	PreferenciaTemaSchema,
	ROTULOS_PREFERENCIA_TEMA,
} from "../../domain/tema";

const ICONES: Record<PreferenciaTema, LucideIcon> = {
	claro: Sun,
	escuro: Moon,
	sistema: Monitor,
};

interface ThemeToggleProps {
	/** Só os ícones (barra superior do mobile); o rótulo fica no `title`. */
	compact?: boolean;
}

/** Seletor segmentado Claro / Escuro / Sistema (rádios nativos). */
export function ThemeToggle({ compact = false }: ThemeToggleProps) {
	const { preferencia, definirPreferencia } = useTema();
	const nome = useId();

	return (
		<fieldset
			className={`m-0 min-w-0 gap-0.5 rounded-lg border border-border bg-muted p-0.5 ${
				compact ? "flex" : "grid grid-cols-3"
			}`}
		>
			<legend className="sr-only">Tema</legend>
			{PreferenciaTemaSchema.options.map((opcao) => {
				const Icone = ICONES[opcao];
				const rotulo = ROTULOS_PREFERENCIA_TEMA[opcao];
				const ativo = preferencia === opcao;
				return (
					<label
						key={opcao}
						title={`Tema ${rotulo.toLowerCase()}`}
						className={`flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/50 pointer-coarse:h-9 ${
							ativo
								? "bg-card text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<input
							type="radio"
							name={nome}
							value={opcao}
							checked={ativo}
							onChange={() => definirPreferencia(opcao)}
							className="sr-only"
						/>
						<Icone aria-hidden="true" className="size-3.5 shrink-0" />
						<span className={compact ? "sr-only" : undefined}>{rotulo}</span>
					</label>
				);
			})}
		</fieldset>
	);
}
