import { createContext, type ReactNode, useEffect, useState } from "react";
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
		primaryColorHsl: "234 56% 60%",
	},
};

interface TenantProviderProps {
	children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
	const [config] = useState<TenantConfig>(defaultMockConfig);

	// White-label: aplica a cor primária do tenant ao token HSL do tema.
	useEffect(() => {
		const cor = config.visual.primaryColorHsl;
		if (!cor) return;
		const root = document.documentElement;
		root.style.setProperty("--primary", cor);
		root.style.setProperty("--ring", cor);
		return () => {
			root.style.removeProperty("--primary");
			root.style.removeProperty("--ring");
		};
	}, [config.visual.primaryColorHsl]);

	return (
		<TenantContext.Provider value={{ config }}>
			{children}
		</TenantContext.Provider>
	);
}
