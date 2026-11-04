import { useContext } from "react";
import { TemaContext } from "./TemaContext";

export function useTema() {
	const context = useContext(TemaContext);

	if (context === undefined) {
		throw new Error("useTema must be used within a TemaProvider");
	}

	return context;
}
