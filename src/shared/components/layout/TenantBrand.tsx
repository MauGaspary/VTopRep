import { useTenant } from "../../../config/tenant/useTenant";

function iniciais(nome: string): string {
	return nome
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((parte) => parte[0]?.toUpperCase() ?? "")
		.join("");
}

interface TenantBrandProps {
	/** Exibe o CNPJ abaixo do nome (barra lateral). */
	showCnpj?: boolean;
}

/** Marca do tenant (white-label): logo ou iniciais na cor primária + nome fantasia. */
export function TenantBrand({ showCnpj = false }: TenantBrandProps) {
	const { config } = useTenant();
	const { nomeFantasia, cnpj } = config.empresa;

	return (
		<div className="flex min-w-0 items-center gap-2.5">
			{config.visual.logoUrl ? (
				<img
					src={config.visual.logoUrl}
					alt=""
					className="size-7 shrink-0 rounded-md object-contain"
				/>
			) : (
				<span
					aria-hidden="true"
					className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
				>
					{iniciais(nomeFantasia)}
				</span>
			)}
			<div className="flex min-w-0 flex-col">
				<span className="truncate text-sm font-semibold text-sidebar-foreground">
					{nomeFantasia}
				</span>
				{showCnpj && (
					<span className="truncate font-mono text-[11px] text-muted-foreground">
						{cnpj}
					</span>
				)}
			</div>
		</div>
	);
}
