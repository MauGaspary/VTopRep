import { createContext, type ReactNode, useEffect, useState } from "react";
import { ajustarCorPrimariaParaTema } from "../../shared/domain/tema";
import { useTema } from "../tema/useTema";
import { type TenantConfig, tenantConfigSchema } from "./tenant.schema";
import { TENANT_PADRAO } from "./tenant-padrao";

interface TenantContextData {
	config: TenantConfig;
}

export const TenantContext = createContext<TenantContextData | undefined>(
	undefined,
);

const configPadrao: TenantConfig = tenantConfigSchema.parse(TENANT_PADRAO);

interface TenantProviderProps {
	children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
	const [config] = useState<TenantConfig>(configPadrao);

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
