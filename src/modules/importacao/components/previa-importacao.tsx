import { useMemo, useState } from "react";
import {
	Badge,
	Button,
	CartaoLista,
	CartaoListaTopo,
	ListaCards,
	ListaResponsiva,
	ListaTabela,
} from "../../../shared/components/ui";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { ProblemaLinha } from "../domain/linhas";
import {
	CATEGORIAS_PREVIA,
	type CategoriaPrevia,
	categoriasDoItem,
	type ItemPrevia,
	type PreviaImportacao,
	ROTULOS_CATEGORIA_ITEM,
	ROTULOS_CATEGORIA_PREVIA,
} from "../domain/previa";

/** Linhas exibidas por vez: a prévia de arquivos grandes continua leve. */
const LIMITE_LINHAS = 200;

type Filtro = CategoriaPrevia | "todos" | "problemas" | "ausentes";

function formatarVariacao(centesimos: number): string {
	const sinal = centesimos > 0 ? "+" : centesimos < 0 ? "−" : "";
	return `${sinal}${formatarCentesimosPercentual(Math.abs(centesimos))}`;
}

const VARIANTE_CATEGORIA: Record<
	CategoriaPrevia,
	"success" | "secondary" | "destructive" | "outline" | "default"
> = {
	novos: "success",
	reativados: "success",
	alterados: "outline",
	preco_subiu: "destructive",
	preco_caiu: "success",
	preco_novo: "outline",
	inalterados: "secondary",
};

interface PreviaImportacaoTabelaProps {
	previa: PreviaImportacao;
	problemas: readonly ProblemaLinha[];
	/** Rótulo da tabela usada na comparação de preços (`null` = sem comparação). */
	referenciaPrecos: string | null;
	mostrarPreco: boolean;
}

export function PreviaImportacaoTabela({
	previa,
	problemas,
	referenciaPrecos,
	mostrarPreco,
}: PreviaImportacaoTabelaProps) {
	const [filtro, setFiltro] = useState<Filtro>("todos");
	const erros = problemas.filter((p) => p.gravidade === "erro").length;
	const avisos = problemas.length - erros;

	const itensFiltrados = useMemo(
		() =>
			filtro === "todos"
				? previa.itens
				: previa.itens.filter((i) =>
						categoriasDoItem(i).some((c) => c === filtro),
					),
		[previa.itens, filtro],
	);

	const opcoes: { valor: Filtro; rotulo: string; total: number }[] = [
		{ valor: "todos", rotulo: "Todos", total: previa.itens.length },
		...CATEGORIAS_PREVIA.filter(
			(c) =>
				previa.contagem[c] > 0 && (mostrarPreco || !c.startsWith("preco_")),
		).map((c) => ({
			valor: c,
			rotulo: ROTULOS_CATEGORIA_PREVIA[c],
			total: previa.contagem[c],
		})),
		...(previa.ausentes.length > 0
			? [
					{
						valor: "ausentes" as const,
						rotulo: "Ausentes no arquivo",
						total: previa.ausentes.length,
					},
				]
			: []),
		...(problemas.length > 0
			? [
					{
						valor: "problemas" as const,
						rotulo: `Erros e avisos`,
						total: problemas.length,
					},
				]
			: []),
	];

	return (
		<div className="flex flex-col gap-3">
			<div
				role="toolbar"
				aria-label="Filtrar prévia"
				className="flex flex-wrap gap-1.5"
			>
				{opcoes.map((o) => (
					<Button
						key={o.valor}
						size="sm"
						variant={filtro === o.valor ? "primary" : "secondary"}
						aria-pressed={filtro === o.valor}
						onClick={() => setFiltro(o.valor)}
					>
						{o.rotulo}
						<span className="font-mono tabular-nums opacity-80">{o.total}</span>
					</Button>
				))}
			</div>

			{filtro === "problemas" ? (
				<ListaProblemas problemas={problemas} erros={erros} avisos={avisos} />
			) : filtro === "ausentes" ? (
				<ListaAusentes ausentes={previa.ausentes} />
			) : (
				<TabelaItens
					itens={itensFiltrados}
					referenciaPrecos={referenciaPrecos}
					mostrarPreco={mostrarPreco}
				/>
			)}
		</div>
	);
}

function MaisLinhas({ total }: { total: number }) {
	if (total <= LIMITE_LINHAS) return null;
	return (
		<p className="px-1 text-xs text-muted-foreground">
			Mostrando {LIMITE_LINHAS} de {total}. Use os filtros para ver outras
			linhas; todas serão gravadas.
		</p>
	);
}

function TabelaItens({
	itens,
	referenciaPrecos,
	mostrarPreco,
}: {
	itens: readonly ItemPrevia[];
	referenciaPrecos: string | null;
	mostrarPreco: boolean;
}) {
	if (itens.length === 0) {
		return (
			<p className="rounded-xl border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground">
				Nenhuma linha nesta categoria.
			</p>
		);
	}
	const visiveis = itens.slice(0, LIMITE_LINHAS);
	return (
		<ListaResponsiva>
			<div className="max-h-[28rem] overflow-y-auto pr-1 @2xl:hidden">
				<ListaCards rotulo="Prévia dos produtos">
					{visiveis.map((item) => {
						const { produto, final, camposAlterados } = item;
						const mudou = (campo: (typeof camposAlterados)[number]) =>
							camposAlterados.includes(campo);
						const categorias = categoriasDoItem(item).filter(
							(c) => mostrarPreco || !c.startsWith("preco_"),
						);
						return (
							<CartaoLista key={item.linha.linha}>
								<CartaoListaTopo
									titulo={
										<>
											<div className="flex flex-wrap items-center gap-1.5">
												<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
													#{item.linha.linha}
												</span>
												<span className="font-mono text-xs font-semibold text-foreground">
													{item.linha.sku}
												</span>
												<span className="font-mono text-xs text-muted-foreground">
													· {final.unidade_medida} · {final.multiplo_embalagem}
												</span>
											</div>
											<span
												className={
													mudou("descricao")
														? "text-xs font-medium text-foreground"
														: "text-xs text-muted-foreground"
												}
											>
												{final.descricao}
											</span>
											{produto && mudou("descricao") && (
												<span className="text-[11px] text-subtle-foreground line-through">
													{produto.descricao}
												</span>
											)}
										</>
									}
									destaque={
										mostrarPreco ? (
											<div className="flex flex-col items-end font-mono tabular-nums">
												<span className="text-sm font-semibold text-foreground">
													{item.precoNovoCentavos !== null
														? formatarCentavos(item.precoNovoCentavos)
														: "sem preço"}
												</span>
												{item.precoAnteriorCentavos !== null && (
													<span className="text-[11px] text-muted-foreground">
														Atual:{" "}
														{formatarCentavos(item.precoAnteriorCentavos)}
													</span>
												)}
												{item.variacaoCentesimos !== null &&
													item.variacaoCentesimos !== 0 && (
														<span
															className={`text-[11px] ${
																item.variacaoCentesimos > 0
																	? "text-destructive"
																	: "text-success"
															}`}
														>
															{formatarVariacao(item.variacaoCentesimos)}
														</span>
													)}
											</div>
										) : undefined
									}
								/>
								{categorias.length > 0 && (
									<div className="flex flex-wrap gap-1">
										{categorias.map((c) => (
											<Badge key={c} variant={VARIANTE_CATEGORIA[c]}>
												{ROTULOS_CATEGORIA_ITEM[c]}
											</Badge>
										))}
									</div>
								)}
							</CartaoLista>
						);
					})}
				</ListaCards>
			</div>
			<ListaTabela rotulo="Prévia dos produtos">
				<div className="max-h-[28rem] overflow-y-auto">
					<table className="text-left text-sm">
						<thead>
							<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
								<th className="px-3.5 py-2.5">Linha</th>
								<th className="px-3 py-2.5">SKU / Descrição</th>
								<th className="px-3 py-2.5">Un. / Mult.</th>
								{mostrarPreco && (
									<>
										<th
											className="px-3 py-2.5 text-right"
											title={referenciaPrecos ?? undefined}
										>
											Preço atual
										</th>
										<th className="px-3 py-2.5 text-right">Preço novo</th>
									</>
								)}
								<th className="px-3.5 py-2.5">Situação</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{visiveis.map((item) => {
								const { produto, final, camposAlterados } = item;
								const mudou = (campo: (typeof camposAlterados)[number]) =>
									camposAlterados.includes(campo);
								return (
									<tr key={item.linha.linha} className="align-top">
										<td className="px-3.5 py-2 font-mono text-xs text-muted-foreground tabular-nums">
											{item.linha.linha}
										</td>
										<td className="px-3 py-2">
											<div className="flex flex-col">
												<span className="font-mono text-xs text-foreground">
													{item.linha.sku}
												</span>
												<span
													className={
														mudou("descricao")
															? "text-foreground"
															: "text-muted-foreground"
													}
												>
													{final.descricao}
												</span>
												{produto && mudou("descricao") && (
													<span className="text-xs text-subtle-foreground line-through">
														{produto.descricao}
													</span>
												)}
											</div>
										</td>
										<td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted-foreground">
											<span
												className={
													mudou("unidade_medida")
														? "font-semibold text-foreground"
														: ""
												}
											>
												{final.unidade_medida}
											</span>
											{" · "}
											<span
												className={
													mudou("multiplo_embalagem")
														? "font-semibold text-foreground"
														: ""
												}
											>
												{final.multiplo_embalagem}
											</span>
											{produto &&
												(mudou("unidade_medida") ||
													mudou("multiplo_embalagem")) && (
													<span className="block text-subtle-foreground line-through">
														{produto.unidade_medida} ·{" "}
														{produto.multiplo_embalagem}
													</span>
												)}
										</td>
										{mostrarPreco && (
											<>
												<td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
													{item.precoAnteriorCentavos !== null
														? formatarCentavos(item.precoAnteriorCentavos)
														: "—"}
												</td>
												<td className="px-3 py-2 text-right font-mono text-sm whitespace-nowrap text-foreground tabular-nums">
													{item.precoNovoCentavos !== null
														? formatarCentavos(item.precoNovoCentavos)
														: "sem preço"}
													{item.variacaoCentesimos !== null &&
														item.variacaoCentesimos !== 0 && (
															<span
																className={`block text-[11px] ${
																	item.variacaoCentesimos > 0
																		? "text-destructive"
																		: "text-success"
																}`}
															>
																{formatarVariacao(item.variacaoCentesimos)}
															</span>
														)}
												</td>
											</>
										)}
										<td className="px-3.5 py-2">
											<div className="flex flex-wrap gap-1">
												{categoriasDoItem(item)
													.filter(
														(c) => mostrarPreco || !c.startsWith("preco_"),
													)
													.map((c) => (
														<Badge key={c} variant={VARIANTE_CATEGORIA[c]}>
															{ROTULOS_CATEGORIA_ITEM[c]}
														</Badge>
													))}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</ListaTabela>
			<MaisLinhas total={itens.length} />
		</ListaResponsiva>
	);
}

function ListaProblemas({
	problemas,
	erros,
	avisos,
}: {
	problemas: readonly ProblemaLinha[];
	erros: number;
	avisos: number;
}) {
	const visiveis = problemas.slice(0, LIMITE_LINHAS);
	return (
		<ListaResponsiva>
			<p className="px-1 text-xs text-muted-foreground">
				Erros: {erros} (a linha fica de fora da importação) · Avisos: {avisos}{" "}
				(a linha entra normalmente)
			</p>
			<div className="max-h-[28rem] overflow-y-auto pr-1 @2xl:hidden">
				<ListaCards rotulo="Erros e avisos">
					{visiveis.map((p) => (
						<CartaoLista key={`${p.linha}-${p.gravidade}-${p.mensagem}`}>
							<CartaoListaTopo
								titulo={
									<>
										<div className="flex items-center gap-1.5">
											<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
												Linha {p.linha}
											</span>
											<span className="font-mono text-xs font-semibold text-foreground">
												{p.sku ?? "—"}
											</span>
										</div>
										<span className="text-xs text-foreground">
											{p.mensagem}
										</span>
									</>
								}
								destaque={
									<Badge
										variant={
											p.gravidade === "erro" ? "destructive" : "secondary"
										}
									>
										{p.gravidade === "erro" ? "Erro" : "Aviso"}
									</Badge>
								}
							/>
						</CartaoLista>
					))}
				</ListaCards>
			</div>
			<ListaTabela rotulo="Erros e avisos">
				<div className="max-h-[28rem] overflow-y-auto">
					<table className="text-left text-sm">
						<thead>
							<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
								<th className="px-3.5 py-2.5">Linha</th>
								<th className="px-3 py-2.5">SKU</th>
								<th className="px-3 py-2.5">Tipo</th>
								<th className="px-3.5 py-2.5">Mensagem</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{visiveis.map((p) => (
								<tr key={`${p.linha}-${p.gravidade}-${p.mensagem}`}>
									<td className="px-3.5 py-2 font-mono text-xs text-muted-foreground tabular-nums">
										{p.linha}
									</td>
									<td className="px-3 py-2 font-mono text-xs text-foreground">
										{p.sku ?? "—"}
									</td>
									<td className="px-3 py-2">
										<Badge
											variant={
												p.gravidade === "erro" ? "destructive" : "secondary"
											}
										>
											{p.gravidade === "erro" ? "Erro" : "Aviso"}
										</Badge>
									</td>
									<td className="px-3.5 py-2 text-foreground">{p.mensagem}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</ListaTabela>
			<MaisLinhas total={problemas.length} />
		</ListaResponsiva>
	);
}

function ListaAusentes({ ausentes }: { ausentes: readonly Produto[] }) {
	const visiveis = ausentes.slice(0, LIMITE_LINHAS);
	return (
		<ListaResponsiva>
			<div className="max-h-[28rem] overflow-y-auto pr-1 @2xl:hidden">
				<ListaCards rotulo="Produtos ausentes no arquivo">
					{visiveis.map((p) => (
						<CartaoLista key={p.id}>
							<CartaoListaTopo
								titulo={
									<>
										<span className="font-mono text-xs font-semibold text-foreground">
											{p.sku}
										</span>
										<span className="text-xs text-muted-foreground">
											{p.descricao}
										</span>
									</>
								}
							/>
						</CartaoLista>
					))}
				</ListaCards>
			</div>
			<ListaTabela rotulo="Produtos ausentes no arquivo">
				<div className="max-h-[28rem] overflow-y-auto">
					<table className="text-left text-sm">
						<thead>
							<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
								<th className="px-3.5 py-2.5">SKU</th>
								<th className="px-3.5 py-2.5">Descrição</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{visiveis.map((p) => (
								<tr key={p.id}>
									<td className="px-3.5 py-2 font-mono text-xs text-foreground">
										{p.sku}
									</td>
									<td className="px-3.5 py-2 text-muted-foreground">
										{p.descricao}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</ListaTabela>
			<MaisLinhas total={ausentes.length} />
		</ListaResponsiva>
	);
}
