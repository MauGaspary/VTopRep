import { useMemo, useState } from "react";
import { Badge, Button } from "../../../shared/components/ui";
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
		<p className="border-t border-border px-3.5 py-2 text-xs text-muted-foreground">
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
	return (
		<section
			aria-label="Prévia dos produtos"
			className="dense-table-region max-h-[28rem] rounded-xl border border-border bg-card"
		>
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
					{itens.slice(0, LIMITE_LINHAS).map((item) => {
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
												{produto.unidade_medida} · {produto.multiplo_embalagem}
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
											.filter((c) => mostrarPreco || !c.startsWith("preco_"))
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
			<MaisLinhas total={itens.length} />
		</section>
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
	return (
		<section
			aria-label="Erros e avisos"
			className="dense-table-region max-h-[28rem] rounded-xl border border-border bg-card"
		>
			<p className="border-b border-border px-3.5 py-2 text-xs text-muted-foreground">
				Erros: {erros} (a linha fica de fora da importação) · Avisos: {avisos}{" "}
				(a linha entra normalmente)
			</p>
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
					{problemas.slice(0, LIMITE_LINHAS).map((p) => (
						<tr key={`${p.linha}-${p.gravidade}-${p.mensagem}`}>
							<td className="px-3.5 py-2 font-mono text-xs tabular-nums text-muted-foreground">
								{p.linha}
							</td>
							<td className="px-3 py-2 font-mono text-xs text-foreground">
								{p.sku ?? "—"}
							</td>
							<td className="px-3 py-2">
								<Badge
									variant={p.gravidade === "erro" ? "destructive" : "secondary"}
								>
									{p.gravidade === "erro" ? "Erro" : "Aviso"}
								</Badge>
							</td>
							<td className="px-3.5 py-2 text-foreground">{p.mensagem}</td>
						</tr>
					))}
				</tbody>
			</table>
			<MaisLinhas total={problemas.length} />
		</section>
	);
}

function ListaAusentes({ ausentes }: { ausentes: readonly Produto[] }) {
	return (
		<section
			aria-label="Produtos ausentes no arquivo"
			className="dense-table-region max-h-[28rem] rounded-xl border border-border bg-card"
		>
			<table className="text-left text-sm">
				<thead>
					<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
						<th className="px-3.5 py-2.5">SKU</th>
						<th className="px-3.5 py-2.5">Descrição</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{ausentes.slice(0, LIMITE_LINHAS).map((p) => (
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
			<MaisLinhas total={ausentes.length} />
		</section>
	);
}
