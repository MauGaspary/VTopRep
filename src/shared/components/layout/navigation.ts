import {
	DatabaseBackup,
	Factory,
	FileText,
	type LucideIcon,
	Package,
	Truck,
	Users,
} from "lucide-react";

export interface NavItem {
	to: string;
	label: string;
	/** Rótulo curto para a barra inferior do mobile, onde o espaço é estreito. */
	shortLabel?: string;
	icon: LucideIcon;
	/** Fora da barra inferior do mobile (acesso pela barra superior). */
	somenteDesktop?: boolean;
}

export interface NavGroup {
	label: string;
	items: readonly NavItem[];
}

/** Menu principal, compartilhado pela barra lateral (desktop) e pela barra inferior (mobile). */
export const NAV_GROUPS: readonly NavGroup[] = [
	{
		label: "Vendas",
		items: [
			{ to: "/pedidos", label: "Orçamentos", icon: FileText },
			{ to: "/catalogo", label: "Catálogo", icon: Package },
		],
	},
	{
		label: "Cadastros",
		items: [
			{ to: "/clientes", label: "Clientes", icon: Users },
			{ to: "/representadas", label: "Representadas", icon: Factory },
			{
				to: "/transportadoras",
				label: "Transportadoras",
				shortLabel: "Transp.",
				icon: Truck,
			},
		],
	},
	{
		label: "Aparelho",
		items: [
			{
				to: "/dados",
				label: "Dados e backup",
				icon: DatabaseBackup,
				somenteDesktop: true,
			},
		],
	},
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap(
	(grupo) => grupo.items,
);

/** Abas da barra inferior do mobile (cabem 5 com folga). */
export const NAV_ITEMS_MOBILE: readonly NavItem[] = NAV_ITEMS.filter(
	(item) => !item.somenteDesktop,
);
