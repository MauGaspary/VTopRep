import { Package, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	Card,
	EmptyState,
	PageHeader,
	SearchInput,
} from "../../../shared/components/ui";
import { dataLocal } from "../../../shared/domain/datas";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { useTodasRepresentadas } from "../../representadas/hooks/use-representadas";
import type { Produto } from "../domain/produto.schema";
import { usePrecosCatalogo } from "../hooks/use-precos";
import { useProdutoActions, useTodosProdutos } from "../hooks/use-produtos";

interface CatalogoViewProps {
	tenantId: string;
}

export function CatalogoView({ tenantId }: CatalogoViewProps) {
	const [termoBusca, setTermoBusca] = useState("");
	const [erro, setErro] = useState<string | null>(null);
	const hoje = dataLocal(new Date());

	const { produtos, isLoading: carregandoProdutos } = useTodosProdutos(
		tenantId,
		termoBusca,
	);
	const { representadas, isLoading: carregandoRepresentadas } =
		useTodasRepresentadas(tenantId);
	const { precosPorProduto, isLoading: carregandoPrecos } = usePrecosCatalogo(
		tenantId,
		hoje,
	);
	const { inativar, reativar } = useProdutoActions(tenantId);

	const representadasMap = useMemo(() => {
		const mapa = new Map<string, string>();
		for (const r of representadas) {
			mapa.set(r.id, r.nome_fantasia);
		}
		return mapa;
	}, [representadas]);

	const isLoading =
		carregandoProdutos || carregandoRepresentadas || carregandoPrecos;

	const handleInativar = async (produto: Produto) => {
		const confirmado = window.confirm(
			`Inativar o produto "${produto.sku} - ${produto.descricao}"?`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await inativar(produto.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao inativar produto"));
		}
	};

	const handleReativar = async (produto: Produto) => {
		setErro(null);
		try {
			await reativar(produto.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao reativar produto"));
		}
	};

	return (
		<Page>
			<PageHeader
				title="Catálogo de Produtos"
				description="Consulta e gestão de produtos cadastrados offline."
				action={
					<>
						<Link
							to="/pedidos/novo"
							className={buttonClassName({ variant: "secondary" })}
						>
							Novo orçamento
						</Link>
						<Link to="/produtos/novo" className={buttonClassName()}>
							<Plus aria-hidden="true" />
							Novo produto
						</Link>
					</>
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
					<p className="py-6 text-center text-muted-foreground">
						Carregando catálogo...
					</p>
				)}
				{!isLoading && produtos.length === 0 && (
					<EmptyState icon={Package} title="Nenhum produto encontrado." />
				)}
				{!isLoading && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{produtos.map((produto) => {
							const isInativo = !produto.ativo;
							const nomeRepresentada =
								representadasMap.get(produto.representada_id) ??
								"Representada desconhecida";
							const precoCatalogo = precosPorProduto.get(produto.id);

							return (
								<Card
									key={produto.id}
									inactive={isInativo}
									className="flex flex-col justify-between p-4"
								>
									<div>
										<div className="flex justify-between items-start gap-2">
											<div className="flex flex-col">
												<div className="flex items-center gap-2">
													<h3 className="text-[15px] leading-tight font-medium text-foreground">
														{produto.descricao}
													</h3>
													{isInativo && (
														<Badge variant="destructive">Inativo</Badge>
													)}
												</div>
												<span className="mt-0.5 text-xs text-muted-foreground">
													{nomeRepresentada}
												</span>
											</div>
											<Badge variant="secondary" className="shrink-0 font-mono">
												{produto.sku}
											</Badge>
										</div>

										<dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
											<div className="flex flex-col">
												<dt className="text-xs text-muted-foreground">
													Preço base
												</dt>
												<dd
													className="font-medium tabular-nums"
													title={
														precoCatalogo
															? `${precoCatalogo.nome_tabela}${precoCatalogo.desconto_maximo_permitido > 0 ? ` · Desc. máx: ${formatarCentesimosPercentual(precoCatalogo.desconto_maximo_permitido)}` : ""}`
															: undefined
													}
												>
													{precoCatalogo ? (
														formatarCentavos(precoCatalogo.preco_base_centavos)
													) : (
														<span className="text-xs text-muted-foreground">
															Sem preço
														</span>
													)}
												</dd>
											</div>
											<div className="flex flex-col">
												<dt className="text-xs text-muted-foreground">
													Unidade
												</dt>
												<dd className="font-medium">
													{produto.unidade_medida}
												</dd>
											</div>
											<div className="flex flex-col">
												<dt className="text-xs text-muted-foreground">
													Múltiplo
												</dt>
												<dd className="font-medium tabular-nums">
													{produto.multiplo_embalagem ?? 1}
												</dd>
											</div>
										</dl>
									</div>

									<div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
										{!isInativo && precoCatalogo && (
											<Link
												to={`/pedidos/novo?produtoId=${produto.id}&representadaId=${produto.representada_id}`}
												className={buttonClassName({
													variant: "primary",
													size: "sm",
												})}
											>
												Orçar
											</Link>
										)}
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
										<Link
											to={`/produtos/${produto.id}/editar`}
											className={buttonClassName({
												variant: "secondary",
												size: "sm",
											})}
										>
											Editar
										</Link>
									</div>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</Page>
	);
}
