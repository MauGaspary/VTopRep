import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
	Alert,
	Badge,
	Button,
	PageHeader,
	SearchInput,
} from "../../../shared/components/ui";
import { useTodasRepresentadas } from "../../representadas/hooks/use-representadas";
import type { Produto } from "../domain/produto.schema";
import { useProdutoActions, useTodosProdutos } from "../hooks/use-produtos";

interface CatalogoViewProps {
	tenantId: string;
}

export function CatalogoView({ tenantId }: CatalogoViewProps) {
	const [termoBusca, setTermoBusca] = useState("");
	const [erro, setErro] = useState<string | null>(null);

	const { produtos, isLoading: carregandoProdutos } = useTodosProdutos(
		tenantId,
		termoBusca,
	);
	const { representadas, isLoading: carregandoRepresentadas } =
		useTodasRepresentadas(tenantId);
	const { inativar, reativar } = useProdutoActions(tenantId);

	const representadasMap = useMemo(() => {
		const mapa = new Map<string, string>();
		for (const r of representadas) {
			mapa.set(r.id, r.nome_fantasia);
		}
		return mapa;
	}, [representadas]);

	const isLoading = carregandoProdutos || carregandoRepresentadas;

	const handleInativar = async (produto: Produto) => {
		const confirmado = window.confirm(
			`Inativar o produto "${produto.sku} - ${produto.descricao}"?`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(produto.id);
		} catch (e) {
			setErro(e instanceof Error ? e.message : "Erro ao inativar produto");
		}
	};

	const handleReativar = async (produto: Produto) => {
		setErro(null);
		try {
			await reativar(produto.id);
		} catch (e) {
			setErro(e instanceof Error ? e.message : "Erro ao reativar produto");
		}
	};

	return (
		<div className="flex flex-col gap-4 p-4 w-full max-w-5xl mx-auto">
			<PageHeader
				title="Catálogo de Produtos"
				description="Consulta e gestão de produtos cadastrados offline."
				action={
					<Link to="/produtos/novo">
						<Button>+ Novo Produto</Button>
					</Link>
				}
			/>

			{erro && <Alert variant="destructive">{erro}</Alert>}

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
						{produtos.map((produto) => {
							const isInativo = !produto.ativo || produto.deleted_at !== null;
							const nomeRepresentada =
								representadasMap.get(produto.representada_id) ??
								"Representada desconhecida";

							return (
								<div
									key={produto.id}
									className={`flex flex-col justify-between p-4 border rounded-lg shadow-sm transition-shadow ${
										isInativo
											? "border-dashed border-border bg-muted/40 opacity-75"
											: "border-border bg-card hover:shadow-md"
									}`}
								>
									<div>
										<div className="flex justify-between items-start gap-2">
											<div className="flex flex-col">
												<div className="flex items-center gap-2">
													<h3 className="font-semibold text-card-foreground leading-tight">
														{produto.descricao}
													</h3>
													{isInativo && (
														<Badge variant="destructive">Inativo</Badge>
													)}
												</div>
												<span className="text-xs text-muted-foreground mt-0.5">
													{nomeRepresentada}
												</span>
											</div>
											<Badge variant="secondary" className="shrink-0 font-mono">
												{produto.sku}
											</Badge>
										</div>

										<div className="mt-3 pt-3 border-t border-border text-sm text-muted-foreground grid grid-cols-2 gap-2">
											<div className="flex flex-col">
												<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
													Unidade:
												</span>
												<span className="text-card-foreground font-medium">
													{produto.unidade_medida}
												</span>
											</div>
											<div className="flex flex-col">
												<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
													Múltiplo:
												</span>
												<span className="text-card-foreground font-medium">
													{produto.multiplo_embalagem ?? 1}
												</span>
											</div>
										</div>
									</div>

									<div className="flex justify-end gap-2 pt-3 mt-3 border-t border-border">
										{isInativo ? (
											<Button
												variant="secondary"
												size="sm"
												onClick={() => handleReativar(produto)}
											>
												Reativar
											</Button>
										) : (
											<Button
												variant="destructive"
												size="sm"
												onClick={() => handleInativar(produto)}
											>
												Inativar
											</Button>
										)}
										<Link to={`/produtos/${produto.id}/editar`}>
											<Button variant="outline" size="sm">
												Editar
											</Button>
										</Link>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
