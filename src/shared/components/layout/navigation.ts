import { Factory, type LucideIcon, Package, Users } from "lucide-react";

export interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
}

export interface NavGroup {
	label: string;
	items: readonly NavItem[];
}

/** Menu principal, compartilhado pela barra lateral (desktop) e pela barra inferior (mobile). */
export const NAV_GROUPS: readonly NavGroup[] = [
	{
		label: "Vendas",
		items: [{ to: "/catalogo", label: "Catálogo", icon: Package }],
	},
	{
		label: "Cadastros",
		items: [
			{ to: "/clientes", label: "Clientes", icon: Users },
			{ to: "/representadas", label: "Representadas", icon: Factory },
		],
	},
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap(
	(grupo) => grupo.items,
);
