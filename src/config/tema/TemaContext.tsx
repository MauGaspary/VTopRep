import {
	createContext,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import {
	ATRIBUTO_TEMA,
	CHAVE_PREFERENCIA_TEMA,
	corDaBarraDoSistema,
	lerPreferenciaTema,
	type PreferenciaTema,
	resolverTema,
	type Tema,
} from "../../shared/domain/tema";
import {
	type PreferenciaTemaRepository,
	preferenciaTemaRepository,
} from "../../shared/repositories/preferencia-tema.repository";

interface TemaContextData {
	preferencia: PreferenciaTema;
	/** Tema aplicado na tela (resolve `sistema`). */
	tema: Tema;
	definirPreferencia: (preferencia: PreferenciaTema) => void;
}

export const TemaContext = createContext<TemaContextData | undefined>(
	undefined,
);

const CONSULTA_SISTEMA_ESCURO = "(prefers-color-scheme: dark)";

function consultaSistema(): MediaQueryList | null {
	return typeof window !== "undefined" &&
		typeof window.matchMedia === "function"
		? window.matchMedia(CONSULTA_SISTEMA_ESCURO)
		: null;
}

function assinarSistema(onChange: () => void): () => void {
	const consulta = consultaSistema();
	consulta?.addEventListener("change", onChange);
	return () => consulta?.removeEventListener("change", onChange);
}

/** Acompanha ao vivo o `prefers-color-scheme` do aparelho. */
function useSistemaEscuro(): boolean {
	return useSyncExternalStore(
		assinarSistema,
		() => consultaSistema()?.matches ?? false,
		() => false,
	);
}

interface TemaProviderProps {
	children: ReactNode;
	repositorio?: PreferenciaTemaRepository;
}

export function TemaProvider({
	children,
	repositorio = preferenciaTemaRepository,
}: TemaProviderProps) {
	const [preferencia, setPreferencia] = useState<PreferenciaTema>(() =>
		repositorio.obter(),
	);
	const sistemaEscuro = useSistemaEscuro();
	const tema = resolverTema(preferencia, sistemaEscuro);

	// Aplica no <html>; o script do index.html já fez o mesmo antes do React.
	useEffect(() => {
		const raiz = document.documentElement;
		raiz.setAttribute(ATRIBUTO_TEMA, tema);
		raiz.style.colorScheme = tema === "escuro" ? "dark" : "light";

		// Barra do sistema: guarda a cor da marca (vinda do build) na primeira vez.
		const meta = document.querySelector<HTMLMetaElement>(
			'meta[name="theme-color"]',
		);
		if (meta) {
			meta.dataset.corMarca ??= meta.content;
			meta.content = corDaBarraDoSistema(tema, meta.dataset.corMarca);
		}
	}, [tema]);

	// Outra aba mudou a preferência: acompanha.
	useEffect(() => {
		const aoMudarArmazenamento = (evento: StorageEvent) => {
			if (evento.key === CHAVE_PREFERENCIA_TEMA) {
				setPreferencia(lerPreferenciaTema(evento.newValue));
			}
		};
		window.addEventListener("storage", aoMudarArmazenamento);
		return () => window.removeEventListener("storage", aoMudarArmazenamento);
	}, []);

	const definirPreferencia = useCallback(
		(nova: PreferenciaTema) => {
			repositorio.salvar(nova);
			setPreferencia(nova);
		},
		[repositorio],
	);

	const valor = useMemo(
		() => ({ preferencia, tema, definirPreferencia }),
		[preferencia, tema, definirPreferencia],
	);

	return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}
