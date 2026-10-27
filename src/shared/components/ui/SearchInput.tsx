import { Input } from "./Input";

export interface SearchInputProps {
	id?: string;
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
		<div className={`flex flex-col gap-1 ${className}`}>
			{label && (
				<label htmlFor={id} className="text-sm font-medium text-foreground">
					{label}
				</label>
			)}
			<Input
				id={id}
				type="search"
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
}
