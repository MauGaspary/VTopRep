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
	/** Um botão só que alterna o tema (barra superior do celular). */
	compact?: boolean;
}

/** Seletor segmentado Claro / Escuro / Sistema (rádios nativos) ou, compacto, um botão que alterna. */
export function ThemeToggle({ compact = false }: ThemeToggleProps) {
	const { preferencia, definirPreferencia } = useTema();
	const nome = useId();

	if (compact) {
		// Barra superior do celular: um botão só, que alterna Claro → Escuro → Sistema.
		const opcoes = PreferenciaTemaSchema.options;
		const proxima = opcoes[(opcoes.indexOf(preferencia) + 1) % opcoes.length];
		const Icone = ICONES[preferencia];
		const rotulo = ROTULOS_PREFERENCIA_TEMA[preferencia];
		return (
			<button
				type="button"
				onClick={() => definirPreferencia(proxima)}
				aria-label={`Tema ${rotulo.toLowerCase()}. Tocar para usar ${ROTULOS_PREFERENCIA_TEMA[proxima].toLowerCase()}`}
				title={`Tema ${rotulo.toLowerCase()}`}
				className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
			>
				<Icone aria-hidden="true" className="size-4" />
			</button>
		);
	}

	return (
		<fieldset className="m-0 grid min-w-0 grid-cols-3 gap-0.5 rounded-lg border border-border bg-muted p-0.5">
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
						<span>{rotulo}</span>
					</label>
				);
			})}
		</fieldset>
	);
}
