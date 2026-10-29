import { useSyncExternalStore } from "react";

function assinar(onChange: () => void): () => void {
	window.addEventListener("online", onChange);
	window.addEventListener("offline", onChange);
	return () => {
		window.removeEventListener("online", onChange);
		window.removeEventListener("offline", onChange);
	};
}

/** Indica se o navegador tem conexão de rede (o app segue funcionando offline). */
export function useOnlineStatus(): boolean {
	return useSyncExternalStore(
		assinar,
		() => navigator.onLine,
		() => true,
	);
}
