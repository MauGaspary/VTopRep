import { useState } from "react";
import { useCatalogo } from "../hooks/use-catalogo";

interface CatalogoViewProps {
	tenantId: string;
}

export function CatalogoView({ tenantId }: CatalogoViewProps) {
	const [termoBusca, setTermoBusca] = useState("");
	const { produtos, isLoading } = useCatalogo(tenantId, termoBusca);

	return (
		<div className="flex flex-col gap-4 p-4 w-full max-w-4xl mx-auto">
			<div className="flex flex-col gap-2">
				<label
					htmlFor="busca-catalogo"
					className="text-sm font-medium text-slate-700"
				>
					Buscar Produtos
				</label>
				<input
					id="busca-catalogo"
					type="search"
					placeholder="Buscar por SKU ou descrição..."
					value={termoBusca}
					onChange={(e) => setTermoBusca(e.target.value)}
					className="px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
				/>
			</div>

			<div className="flex flex-col gap-3">
				{isLoading && (
					<div className="text-slate-500 py-4 text-center">
						Carregando catálogo...
					</div>
				)}
				{!isLoading && produtos.length === 0 && (
					<div className="text-slate-500 py-4 text-center">
						Nenhum produto encontrado.
					</div>
				)}
				{!isLoading && (
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						{produtos.map((produto) => (
							<div
								key={produto.id}
								className="flex flex-col p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
							>
								<div className="flex justify-between items-start gap-2">
									<h3 className="font-semibold text-slate-900 leading-tight">
										{produto.descricao}
									</h3>
									<span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
										{produto.sku}
									</span>
								</div>
								<div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-500 grid grid-cols-2 gap-2">
									<div className="flex flex-col gap-1">
										<span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
											Unidade:
										</span>
										<span className="text-slate-700">
											{produto.unidade_medida}
										</span>
									</div>
									<div className="flex flex-col">
										<span className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
											Múltiplo:
										</span>
										<span className="text-slate-700">
											{produto.multiplo_embalagem}
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
