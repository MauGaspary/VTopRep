import { Search } from "lucide-react";
import { Input } from "./Input";

export interface SearchInputProps {
	id?: string;
	/** Rótulo acessível. Fica visualmente oculto; o ícone e o placeholder dão o contexto. */
	label?: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function SearchInput({
	id = "busca",
	label = "Buscar",
	placeholder = "Digite para buscar...",
	value,
	onChange,
	className = "",
}: SearchInputProps) {
	return (
		<div className={`relative ${className}`}>
			<label htmlFor={id} className="sr-only">
				{label}
			</label>
			<Search
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground"
			/>
			<Input
				id={id}
				type="search"
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="pl-9"
			/>
		</div>
	);
}
