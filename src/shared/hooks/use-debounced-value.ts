import { useEffect, useState } from "react";

/** Devolve `valor` só depois que ele ficar `atrasoMs` sem mudar (ex.: enquanto o usuário digita). */
export function useDebouncedValue<T>(valor: T, atrasoMs: number): T {
	const [atrasado, setAtrasado] = useState(valor);

	useEffect(() => {
		const timer = setTimeout(() => setAtrasado(valor), atrasoMs);
		return () => clearTimeout(timer);
	}, [valor, atrasoMs]);

	return atrasado;
}
