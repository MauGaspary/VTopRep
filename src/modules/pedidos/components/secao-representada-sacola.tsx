import { Minus, Package, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Alert,
	Badge,
	Button,
	Combobox,
	FormField,
	Input,
	type OpcaoCombobox,
	RepresentadaDot,
	Select,
} from "../../../shared/components/ui";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { ROTULOS_FRETE, TIPOS_FRETE } from "../../../shared/domain/frete";
import { escolherTabelaSugerida } from "../../produtos/domain/preco";
import type { Produto } from "../../produtos/domain/produto.schema";
import { descreverVigencia } from "../../produtos/domain/tabela-preco";
import {
	usePrecosDaTabela,
	useTabelasVigentes,
} from "../../produtos/hooks/use-precos";
import { obterCorRepresentada } from "../../representadas/domain/representada";
import type { Representada } from "../../representadas/domain/representada.schema";
import {
	chaveErroGrupoCotacao,
	type GrupoOrcamentoFormValues,
	resolverTabelaEfetivaGrupo,
} from "../domain/cotacao-form";
import type { TotaisPedido } from "../domain/pedido";
import { CONDICOES_PAGAMENTO_PADRAO } from "../domain/pedido.schema";
import {
	ajustarDeltaQuantidadeItemForm,
	calcularPreviaItemForm,
	chaveErroItemPedido,
	type PedidoFormErros,
	parseDescontoFormParaCentesimos,
	reprecificarItensFormPorTabela,
} from "../domain/pedido-form";

const OPCOES_CONDICOES_PAGAMENTO: OpcaoCombobox[] =
	CONDICOES_PAGAMENTO_PADRAO.map((condicao) => ({
		id: condicao,
		label: condicao,
	}));

export interface SecaoRepresentadaSacolaProps {
	tenantId: string;
	hoje: string;
	grupo: GrupoOrcamentoFormValues;
	representada: Representada | undefined;
	somenteLeitura: boolean;
	/** Representada cujo catálogo está aberto no painel ao lado. */
	ativa: boolean;
	percentualComissao: number;
	previa: TotaisPedido;
	erros: PedidoFormErros;
	produtosPorId: ReadonlyMap<string, Produto>;
	/** Atualização funcional da seção (deve ser estável entre renders). */
	onAtualizarGrupo: (
		representadaId: string,
		alterar: (grupo: GrupoOrcamentoFormValues) => GrupoOrcamentoFormValues,
	) => void;
	onRemover: () => void;
	onVerCatalogo: () => void;
	limparErro: (chave: string) => void;
}

/**
 * Seção da sacola de uma representada: condições próprias do pedido da fábrica
 * (tabela, pagamento e frete), itens, subtotal e indicador de pedido mínimo.
 */
export function SecaoRepresentadaSacola({
	tenantId,
	hoje,
	grupo,
	representada,
	somenteLeitura,
	ativa,
	percentualComissao,
	previa,
	erros,
	produtosPorId,
	onAtualizarGrupo,
	onRemover,
	onVerCatalogo,
	limparErro,
}: SecaoRepresentadaSacolaProps) {
	const repId = grupo.representada_id;
	const idBase = `orcamento-${repId}`;
	const [avisoTabela, setAvisoTabela] = useState<string | null>(null);
	const onAtualizar = useCallback(
		(alterar: (grupo: GrupoOrcamentoFormValues) => GrupoOrcamentoFormValues) =>
			onAtualizarGrupo(repId, alterar),
		[onAtualizarGrupo, repId],
	);

	const { tabelas: tabelasVigentes, isLoading: carregandoTabelas } =
		useTabelasVigentes(tenantId, repId, hoje);
	const tabelaSugerida = useMemo(
		() => escolherTabelaSugerida(tabelasVigentes),
		[tabelasVigentes],
	);
	const tabelaEfetivaId = resolverTabelaEfetivaGrupo(
		grupo,
		tabelasVigentes.map((t) => t.id),
		tabelaSugerida?.id ?? null,
		somenteLeitura,
	);

	// Mantém a tabela da seção alinhada à sugestão (vigente mais recente da fábrica).
	useEffect(() => {
		if (somenteLeitura || carregandoTabelas) return;
		if (tabelaEfetivaId !== grupo.tabela_id) {
			onAtualizar((g) => ({ ...g, tabela_id: tabelaEfetivaId }));
		}
	}, [
		somenteLeitura,
		carregandoTabelas,
		tabelaEfetivaId,
		grupo.tabela_id,
		onAtualizar,
	]);

	const { precosPorProduto } = usePrecosDaTabela(
		tenantId,
		grupo.tabela_id || undefined,
		hoje,
	);

	// Reprecifica os itens da seção quando a tabela (ou seus preços) muda.
	useEffect(() => {
		if (somenteLeitura || precosPorProduto.size === 0) return;
		const { itens, produtosSemPrecoIds } = reprecificarItensFormPorTabela(
			grupo.itens,
			precosPorProduto,
		);
		setAvisoTabela(
			produtosSemPrecoIds.length > 0
				? `${produtosSemPrecoIds.length} item(ns) não possuem preço na tabela selecionada e mantiveram o preço anterior.`
				: null,
		);
		const mudou = itens.some(
			(item, idx) =>
				item.preco_unitario_tabela_centavos !==
				grupo.itens[idx]?.preco_unitario_tabela_centavos,
		);
		if (mudou) {
			onAtualizar((g) => ({
				...g,
				itens: reprecificarItensFormPorTabela(g.itens, precosPorProduto).itens,
			}));
		}
	}, [somenteLeitura, precosPorProduto, grupo.itens, onAtualizar]);

	const opcoesTabelas = useMemo<OpcaoCombobox[]>(
		() =>
			tabelasVigentes.map((t) => ({
				id: t.id,
				label: t.nome_tabela,
				sublabel: `Vigência: ${descreverVigencia(t)}`,
				keywords: [t.nome_tabela],
			})),
		[tabelasVigentes],
	);

	const cor = representada ? obterCorRepresentada(representada) : "indigo";
	const nome = representada?.nome_fantasia ?? "Representada não encontrada";
	const pedidoMinimoCentavos = representada?.valor_pedido_minimo_centavos ?? 0;
	const atingiuPedidoMinimo =
		pedidoMinimoCentavos === 0 ||
		previa.valor_total_centavos >= pedidoMinimoCentavos;

	const erroTabela = erros[chaveErroGrupoCotacao(repId, "tabela_id")];
	const erroCondicao =
		erros[chaveErroGrupoCotacao(repId, "condicao_pagamento")];
	const erroFrete = erros[chaveErroGrupoCotacao(repId, "tipo_frete")];
	const erroItens =
		erros[chaveErroGrupoCotacao(repId, "itens")] ??
		erros[chaveErroGrupoCotacao(repId, "representada_id")];

	const alterarItem = (
		localId: string,
		campo: "quantidade" | "percentual_desconto",
		valor: string,
	) => {
		onAtualizar((g) => ({
			...g,
			itens: g.itens.map((item) =>
				item.localId === localId ? { ...item, [campo]: valor } : item,
			),
		}));
		limparErro(chaveErroItemPedido(localId, campo));
	};

	const ajustarQuantidade = (localId: string, delta: 1 | -1) => {
		onAtualizar((g) => ({
			...g,
			itens: ajustarDeltaQuantidadeItemForm(g.itens, localId, delta),
		}));
		limparErro(chaveErroItemPedido(localId, "quantidade"));
	};

	const removerItem = (localId: string) =>
		onAtualizar((g) => ({
			...g,
			itens: g.itens.filter((item) => item.localId !== localId),
		}));

	/** Dados de exibição e validação de um item da sacola. */
	const descreverItem = (linha: ItemSacolaForm) => {
		const produto = produtosPorId.get(linha.produto_id);
		const descontoDigitado = parseDescontoFormParaCentesimos(
			linha.percentual_desconto,
		);
		const teto =
			precosPorProduto.get(linha.produto_id)?.desconto_maximo_permitido ?? 0;
		return {
			produto,
			sku: produto?.sku ?? "item",
			previa: calcularPreviaItemForm(linha),
			erroQtd: erros[chaveErroItemPedido(linha.localId, "quantidade")],
			erroDesc:
				erros[chaveErroItemPedido(linha.localId, "percentual_desconto")],
			teto,
			acimaDoTeto:
				teto > 0 && descontoDigitado !== null && descontoDigitado > teto,
		};
	};

	const controlesItem = (linha: ItemSacolaForm) => {
		const d = descreverItem(linha);
		return {
			...d,
			quantidade: (
				<ControleQuantidade
					sku={d.sku}
					nome={`quantidade_${linha.localId}`}
					valor={linha.quantidade}
					erro={d.erroQtd}
					somenteLeitura={somenteLeitura}
					onAlterar={(v) => alterarItem(linha.localId, "quantidade", v)}
					onAjustar={(delta) => ajustarQuantidade(linha.localId, delta)}
				/>
			),
			desconto: (
				<CampoDesconto
					sku={d.sku}
					nome={`desconto_${linha.localId}`}
					valor={linha.percentual_desconto}
					erro={d.erroDesc}
					teto={d.acimaDoTeto ? d.teto : null}
					somenteLeitura={somenteLeitura}
					onAlterar={(v) =>
						alterarItem(linha.localId, "percentual_desconto", v)
					}
				/>
			),
			remover: somenteLeitura ? null : (
				<Button
					size="sm"
					variant="ghost"
					onClick={() => removerItem(linha.localId)}
					aria-label={`Remover ${d.sku} do orçamento`}
					className="px-1.5 text-subtle-foreground hover:text-destructive"
				>
					<Trash2 aria-hidden="true" className="size-3.5" />
				</Button>
			),
		};
	};

	return (
		<section
			aria-labelledby={`${idBase}-titulo`}
			className={`flex flex-col border-b border-border last:border-b-0 ${
				ativa && !somenteLeitura ? "bg-primary/[0.03]" : ""
			}`}
		>
			{/* Cabeçalho da seção: fábrica, subtotal e ações */}
			<div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
				<div className="flex min-w-0 items-center gap-2">
					<RepresentadaDot cor={cor} />
					<h3
						id={`${idBase}-titulo`}
						className="truncate text-sm font-semibold text-foreground"
					>
						{nome}
					</h3>
					<Badge variant="outline" className="font-mono tabular-nums">
						{grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"} ·{" "}
						{previa.quantidade_total_volumes} vol.
					</Badge>
					{!somenteLeitura &&
						(ativa ? (
							<Badge variant="secondary">No catálogo</Badge>
						) : (
							<button
								type="button"
								onClick={onVerCatalogo}
								className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
							>
								<Search aria-hidden="true" className="size-3" />
								Ver catálogo
							</button>
						))}
				</div>

				<div className="flex items-center gap-2">
					<span className="font-mono text-sm font-semibold text-foreground tabular-nums">
						{formatarCentavos(previa.valor_total_centavos)}
					</span>
					{!somenteLeitura && (
						<Button
							size="sm"
							variant="ghost"
							onClick={onRemover}
							aria-label={`Remover ${nome} da cotação`}
							title="Remover fábrica da cotação"
							className="px-1.5 text-subtle-foreground hover:text-destructive"
						>
							<Trash2 aria-hidden="true" className="size-3.5" />
						</Button>
					)}
				</div>
			</div>

			{/* Condições do pedido desta fábrica */}
			<fieldset
				disabled={somenteLeitura}
				className="grid grid-cols-1 gap-2.5 px-4 pt-2.5 pb-3 sm:grid-cols-3"
			>
				<legend className="sr-only">Condições do pedido de {nome}</legend>
				<FormField
					id={`${idBase}-tabela`}
					label="Tabela"
					error={erroTabela}
					required
				>
					<Combobox
						id={`${idBase}-tabela`}
						name={`tabela_${repId}`}
						size="sm"
						value={grupo.tabela_id}
						onChange={(novaTabelaId) => {
							onAtualizar((g) => ({
								...g,
								tabela_id: novaTabelaId,
								tabela_manual: true,
							}));
							limparErro(chaveErroGrupoCotacao(repId, "tabela_id"));
						}}
						options={opcoesTabelas}
						placeholder={
							tabelasVigentes.length === 0 && !carregandoTabelas
								? "Nenhuma tabela vigente"
								: "Selecione a tabela..."
						}
						emptyMessage="Nenhuma tabela vigente encontrada."
						disabled={
							somenteLeitura ||
							carregandoTabelas ||
							tabelasVigentes.length === 0
						}
						hasError={Boolean(erroTabela)}
					/>
				</FormField>

				<FormField
					id={`${idBase}-condicao`}
					label="Condição de pagamento"
					error={erroCondicao}
					required
				>
					<Combobox
						id={`${idBase}-condicao`}
						name={`condicao_pagamento_${repId}`}
						size="sm"
						value={grupo.condicao_pagamento}
						onChange={(novaCondicao) => {
							onAtualizar((g) => ({ ...g, condicao_pagamento: novaCondicao }));
							limparErro(chaveErroGrupoCotacao(repId, "condicao_pagamento"));
						}}
						options={OPCOES_CONDICOES_PAGAMENTO}
						allowCustomValue
						placeholder="Ex: 30/60 dias, À vista..."
						emptyMessage="Pressione Enter para manter a condição digitada."
						disabled={somenteLeitura}
						hasError={Boolean(erroCondicao)}
					/>
				</FormField>

				<FormField
					id={`${idBase}-frete`}
					label="Tipo de frete"
					error={erroFrete}
					required
				>
					<Select
						id={`${idBase}-frete`}
						name={`tipo_frete_${repId}`}
						size="sm"
						value={grupo.tipo_frete}
						onChange={(e) => {
							const tipoFrete = e.target.value;
							onAtualizar((g) => ({ ...g, tipo_frete: tipoFrete }));
							limparErro(chaveErroGrupoCotacao(repId, "tipo_frete"));
						}}
						hasError={Boolean(erroFrete)}
					>
						{TIPOS_FRETE.map((frete) => (
							<option key={frete} value={frete}>
								{ROTULOS_FRETE[frete]}
							</option>
						))}
					</Select>
				</FormField>
			</fieldset>

			<div className="flex flex-col gap-2 px-4 pb-3">
				{avisoTabela && <Alert>{avisoTabela}</Alert>}
				{erroItens && <Alert variant="destructive">{erroItens}</Alert>}
			</div>

			{grupo.itens.length === 0 ? (
				<div className="flex items-center gap-2 border-t border-dashed border-border px-4 py-4 text-xs text-muted-foreground">
					<Package aria-hidden="true" className="size-4 shrink-0" />
					<span>
						Nenhum item desta fábrica ainda.{" "}
						{!somenteLeitura &&
							"Inclua produtos pelo catálogo — seções vazias são descartadas ao salvar."}
					</span>
				</div>
			) : (
				<div className="@container border-t border-border">
					{/* Pouco espaço (celular em pé): cada item em 3 linhas, sem rolagem lateral. */}
					<ul
						aria-label={`Itens de ${nome}`}
						className="divide-y divide-border @2xl:hidden"
					>
						{grupo.itens.map((linha) => {
							const c = controlesItem(linha);
							return (
								<li
									key={linha.localId}
									className="flex flex-col gap-2 px-4 py-3"
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="text-sm text-foreground">
												<span className="font-mono text-xs font-semibold">
													{c.produto?.sku ?? "SKU"}
												</span>{" "}
												<span className="font-medium">
													{c.produto?.descricao ?? "Produto"}
												</span>
											</p>
											<p className="font-mono text-[11px] text-muted-foreground tabular-nums">
												{c.produto
													? `${c.produto.unidade_medida} · Múlt. ${c.produto.multiplo_embalagem} · `
													: ""}
												Tab.{" "}
												{formatarCentavos(linha.preco_unitario_tabela_centavos)}
												{c.previa
													? ` · Líq. ${formatarCentavos(c.previa.preco_liquido_unitario_centavos)}`
													: ""}
											</p>
										</div>
										<div className="flex shrink-0 items-center gap-1">
											<span className="font-mono text-sm font-semibold text-foreground tabular-nums">
												{c.previa
													? formatarCentavos(c.previa.subtotal_centavos)
													: "—"}
											</span>
											{c.remover}
										</div>
									</div>
									<div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
										{c.quantidade}
										<div className="flex items-start gap-1.5">
											<span className="pt-2 text-xs text-muted-foreground">
												Desc.
											</span>
											{c.desconto}
											<span className="pt-2 text-xs text-muted-foreground">
												%
											</span>
										</div>
									</div>
								</li>
							);
						})}
					</ul>

					{/* Espaço suficiente: tabela com todas as colunas. */}
					<div className="dense-table-region hidden @2xl:block">
						<table className="text-left text-sm">
							<caption className="sr-only">Itens de {nome}</caption>
							<thead>
								<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
									<th scope="col" className="px-3.5 py-2">
										Produto
									</th>
									<th scope="col" className="px-2.5 py-2 text-right">
										Tabela
									</th>
									<th scope="col" className="px-2.5 py-2 text-center">
										Quantidade
									</th>
									<th scope="col" className="px-2.5 py-2 text-center">
										Desc. (%)
									</th>
									<th scope="col" className="px-2.5 py-2 text-right">
										Líq. Unit.
									</th>
									<th scope="col" className="px-3 py-2 text-right">
										Subtotal
									</th>
									{!somenteLeitura && (
										<th scope="col" className="w-9 px-2 py-2 text-right">
											<span className="sr-only">Ações</span>
										</th>
									)}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{grupo.itens.map((linha) => {
									const c = controlesItem(linha);
									return (
										<tr
											key={linha.localId}
											className="align-middle transition-colors hover:bg-muted/30"
										>
											<th
												scope="row"
												className="px-3.5 py-2.5 font-normal text-foreground"
											>
												<div className="flex flex-col">
													<div className="flex items-center gap-1.5">
														<span className="font-mono text-xs font-semibold">
															{c.produto?.sku ?? "SKU"}
														</span>
														<span className="text-xs font-medium">
															{c.produto?.descricao ?? "Produto"}
														</span>
													</div>
													<span className="text-[11px] text-muted-foreground">
														{c.produto
															? `${c.produto.unidade_medida} · Múlt. ${c.produto.multiplo_embalagem}`
															: ""}
													</span>
												</div>
											</th>
											<td className="px-2.5 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
												{formatarCentavos(linha.preco_unitario_tabela_centavos)}
											</td>
											<td className="px-2.5 py-2.5">
												<div className="flex justify-center">
													{c.quantidade}
												</div>
											</td>
											<td className="px-2.5 py-2.5">
												<div className="flex justify-center">{c.desconto}</div>
											</td>
											<td className="px-2.5 py-2.5 text-right font-mono text-xs font-medium tabular-nums whitespace-nowrap">
												{c.previa
													? formatarCentavos(
															c.previa.preco_liquido_unitario_centavos,
														)
													: "—"}
											</td>
											<td className="px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
												{c.previa
													? formatarCentavos(c.previa.subtotal_centavos)
													: "—"}
											</td>
											{c.remover && (
												<td className="px-2 py-2.5 text-right">{c.remover}</td>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Rodapé da seção: mínimo da fábrica e comissão aplicável */}
			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
				<span>
					Comissão {formatarCentesimosPercentual(percentualComissao)}:{" "}
					<strong className="font-mono font-semibold text-success tabular-nums">
						{formatarCentavos(previa.comissao_projetada_centavos)}
					</strong>
				</span>
				{pedidoMinimoCentavos > 0 && (
					<Badge variant={atingiuPedidoMinimo ? "success" : "secondary"}>
						Mínimo fábrica: {formatarCentavos(pedidoMinimoCentavos)}
						{atingiuPedidoMinimo
							? " ✓"
							: ` · faltam ${formatarCentavos(pedidoMinimoCentavos - previa.valor_total_centavos)}`}
					</Badge>
				)}
			</div>
		</section>
	);
}

type ItemSacolaForm = GrupoOrcamentoFormValues["itens"][number];

interface ControleQuantidadeProps {
	sku: string;
	nome: string;
	valor: string;
	erro: string | undefined;
	somenteLeitura: boolean;
	onAlterar: (valor: string) => void;
	onAjustar: (delta: 1 | -1) => void;
}

/** Quantidade do item com botões − / + (de 1 em 1). */
function ControleQuantidade({
	sku,
	nome,
	valor,
	erro,
	somenteLeitura,
	onAlterar,
	onAjustar,
}: ControleQuantidadeProps) {
	return (
		<div className="flex flex-col items-center gap-1">
			<div className="flex items-center gap-1">
				{!somenteLeitura && (
					<Button
						size="sm"
						variant="secondary"
						className="px-2"
						onClick={() => onAjustar(-1)}
						aria-label={`Diminuir quantidade de ${sku}`}
					>
						<Minus aria-hidden="true" />
					</Button>
				)}
				<Input
					aria-label={`Quantidade de ${sku}`}
					name={nome}
					inputMode="numeric"
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					disabled={somenteLeitura}
					value={valor}
					onChange={(e) => onAlterar(e.target.value)}
					hasError={Boolean(erro)}
					className="w-14 max-w-14 min-w-14 shrink-0 px-1.5 text-center font-mono tabular-nums"
				/>
				{!somenteLeitura && (
					<Button
						size="sm"
						variant="secondary"
						className="px-2"
						onClick={() => onAjustar(1)}
						aria-label={`Aumentar quantidade de ${sku}`}
					>
						<Plus aria-hidden="true" />
					</Button>
				)}
			</div>
			{erro && (
				<span role="alert" className="text-[11px] text-destructive">
					{erro}
				</span>
			)}
		</div>
	);
}

interface CampoDescontoProps {
	sku: string;
	nome: string;
	valor: string;
	erro: string | undefined;
	/** Desconto máximo do item quando o digitado passa dele (só aviso). */
	teto: number | null;
	somenteLeitura: boolean;
	onAlterar: (valor: string) => void;
}

/** Desconto percentual do item, com aviso quando passa do máximo da tabela. */
function CampoDesconto({
	sku,
	nome,
	valor,
	erro,
	teto,
	somenteLeitura,
	onAlterar,
}: CampoDescontoProps) {
	return (
		<div className="flex flex-col items-center gap-1">
			<Input
				aria-label={`Desconto percentual de ${sku}`}
				name={nome}
				inputMode="decimal"
				autoComplete="off"
				autoCorrect="off"
				spellCheck={false}
				disabled={somenteLeitura}
				placeholder="0,00"
				value={valor}
				onChange={(e) => onAlterar(e.target.value)}
				hasError={Boolean(erro)}
				className="w-18 max-w-18 min-w-18 shrink-0 px-2 text-right font-mono tabular-nums"
			/>
			{erro ? (
				<span role="alert" className="text-[11px] text-destructive">
					{erro}
				</span>
			) : teto !== null ? (
				<span className="text-[10px] text-warning">
					Máx: {formatarCentesimosPercentual(teto)}
				</span>
			) : null}
		</div>
	);
}
