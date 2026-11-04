import { createContext, type ReactNode, useEffect, useState } from "react";
import { ajustarCorPrimariaParaTema } from "../../shared/domain/tema";
import { useTema } from "../tema/useTema";
import type { TenantConfig } from "./tenant.schema";

interface TenantContextData {
	config: TenantConfig;
}

export const TenantContext = createContext<TenantContextData | undefined>(
	undefined,
);

const defaultMockConfig: TenantConfig = {
	id: "11111111-1111-4111-a111-111111111111",
	slug: "exemplo",
	empresa: {
		nomeFantasia: "Vinitop RS",
		razaoSocial: "Vinitop RS Ltda",
		cnpj: "00.000.000/0001-00",
		telefone: "(00) 0000-0000",
	},
	visual: {
		primaryColorHsl: "228, 60%, 34%",
		secondaryColorHsl: "214, 26%, 53%",
	},
};

interface TenantProviderProps {
	children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
	const [config] = useState<TenantConfig>(defaultMockConfig);

	const { tema } = useTema();

	// White-label: aplica a cor primária do tenant ao token HSL do tema,
	// ajustada para manter contraste AA no tema claro e no escuro.
	useEffect(() => {
		const cor = config.visual.primaryColorHsl;
		if (!cor) return;
		const cores = ajustarCorPrimariaParaTema(cor, tema);
		if (!cores) return;
		const root = document.documentElement;
		root.style.setProperty("--primary", cores.primaria);
		root.style.setProperty("--ring", cores.primaria);
		root.style.setProperty("--primary-foreground", cores.textoSobrePrimaria);
		return () => {
			root.style.removeProperty("--primary");
			root.style.removeProperty("--ring");
			root.style.removeProperty("--primary-foreground");
		};
	}, [config.visual.primaryColorHsl, tema]);

	return (
		<TenantContext.Provider value={{ config }}>
			{children}
		</TenantContext.Provider>
	);
}
