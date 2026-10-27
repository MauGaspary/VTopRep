import { useState } from "react";
import { Badge, PageHeader, SearchInput } from "../../../shared/components/ui";
import { useCatalogo } from "../hooks/use-catalogo";

interface CatalogoViewProps {
	tenantId: string;
}

export function CatalogoView({ tenantId }: CatalogoViewProps) {
	const [termoBusca, setTermoBusca] = useState("");
	const { produtos, isLoading } = useCatalogo(tenantId, termoBusca);

	return (
		<div className="flex flex-col gap-4 p-4 w-full max-w-5xl mx-auto">
			<PageHeader
				title="Catálogo Rápido"
				description="Consulta ágil de produtos cadastrados offline."
			/>

			<SearchInput
				id="busca-catalogo"
				placeholder="Buscar por SKU ou descrição..."
				value={termoBusca}
				onChange={setTermoBusca}
			/>

			<div className="flex flex-col gap-3">
				{isLoading && (
					<div className="text-muted-foreground py-6 text-center">
						Carregando catálogo...
					</div>
				)}
				{!isLoading && produtos.length === 0 && (
					<div className="rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
						Nenhum produto encontrado.
					</div>
				)}
				{!isLoading && (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{produtos.map((produto) => (
							<div
								key={produto.id}
								className="flex flex-col p-4 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow"
							>
								<div className="flex justify-between items-start gap-2">
									<h3 className="font-semibold text-card-foreground leading-tight">
										{produto.descricao}
									</h3>
									<Badge variant="secondary" className="shrink-0">
										{produto.sku}
									</Badge>
								</div>
								<div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground grid grid-cols-2 gap-2">
									<div className="flex flex-col gap-1">
										<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
											Unidade:
										</span>
										<span className="text-card-foreground">
											{produto.unidade_medida}
										</span>
									</div>
									<div className="flex flex-col">
										<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
											Múltiplo:
										</span>
										<span className="text-card-foreground">
											{produto.multiplo_embalagem ?? "1"}
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
