import {
	Check,
	ChevronDown,
	ChevronUp,
	Minus,
	Package,
	Plus,
	Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
import { Page } from "../../../shared/components/layout/Page";
import {
	Alert,
	Badge,
	Button,
	buttonClassName,
	Combobox,
	cardClassName,
	EmptyState,
	FormField,
	Input,
	type OpcaoCombobox,
	PageHeader,
	RepresentadaBadge,
	RepresentadaDot,
	SearchInput,
	Select,
} from "../../../shared/components/ui";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { dataLocal, formatarDataBr } from "../../../shared/domain/datas";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE, TIPOS_FRETE } from "../../../shared/domain/frete";
import { ClienteQuickCreateDialog } from "../../clientes/components/cliente-quick-create-dialog";
import { useCliente, useClientes } from "../../clientes/hooks/use-clientes";
import { escolherTabelaSugerida } from "../../produtos/domain/preco";
import { correspondeBuscaProduto } from "../../produtos/domain/produto";
import type { Produto } from "../../produtos/domain/produto.schema";
import { descreverVigencia } from "../../produtos/domain/tabela-preco";
import {
	usePrecosDaTabela,
	useTabelasPadraoDoCliente,
	useTabelasVigentes,
} from "../../produtos/hooks/use-precos";
import { useTodosProdutos } from "../../produtos/hooks/use-produtos";
import { obterCorRepresentada } from "../../representadas/domain/representada";
import type { Representada } from "../../representadas/domain/representada.schema";
import { useRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	escolherContatoPadrao,
	escolherEnderecoEntregaPadrao,
	type PedidoCompleto,
} from "../domain/pedido";
import {
	CONDICOES_PAGAMENTO_PADRAO,
	ROTULOS_STATUS_PEDIDO,
} from "../domain/pedido.schema";
import {
	adicionarOuIncrementarItemForm,
	ajustarDeltaQuantidadeItemForm,
	calcularPreviaItemForm,
	calcularPreviaTotaisForm,
	chaveErroItemPedido,
	type PedidoFormErros,
	type PedidoFormValues,
	parseDescontoFormParaCentesimos,
	reprecificarItensFormPorTabela,
	validarFormularioPedido,
	valoresIniciaisPedidoForm,
} from "../domain/pedido-form";
import {
	useEspelhoPedido,
	usePedido,
	usePedidoActions,
} from "../hooks/use-pedidos";
import { EspelhoPedidoActionsBar } from "./espelho-pedido-pdf";

export function OrcamentoFormView() {
	const { id } = useParams();
	const { config } = useTenant();
	const { dados, isLoading: carregandoPedido } = usePedido(config.id, id);
	const { clientes, isLoading: carregandoClientes } = useClientes(config.id);
	const { representadas, isLoading: carregandoRepresentadas } =
		useRepresentadas(config.id);
	const { produtos, isLoading: carregandoProdutos } = useTodosProdutos(
		config.id,
	);

	if (
		(id && carregandoPedido) ||
		carregandoClientes ||
		carregandoRepresentadas ||
		carregandoProdutos
	) {
		return (
			<p className="p-6 text-center text-muted-foreground">
				Carregando ambiente de orçamento...
			</p>
		);
	}

	if (id && !dados) {
		return (
			<Page width="narrow">
				<p className="text-foreground">Orçamento ou pedido não encontrado.</p>
				<Link to="/pedidos" className="text-sm text-primary underline">
					Voltar para orçamentos e pedidos
				</Link>
			</Page>
		);
	}

	return (
		<OrcamentoForm
			key={dados?.pedido.id ?? "novo"}
			tenantId={config.id}
			original={dados ?? undefined}
			clientes={clientes}
			representadas={representadas}
			todosProdutos={produtos}
		/>
	);
}

interface OrcamentoFormProps {
	tenantId: string;
	original?: PedidoCompleto;
	clientes: Array<{
		id: string;
		razao_social: string;
		nome_fantasia?: string | null;
		cnpj_cpf: string;
	}>;
	representadas: readonly Representada[];
	todosProdutos: readonly Produto[];
}

const gerarLocalId = () => crypto.randomUUID();

function OrcamentoForm({
	tenantId,
	original,
	clientes,
	representadas,
	todosProdutos,
}: OrcamentoFormProps) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { config } = useTenant();
	const { salvarRascunho, emitir } = usePedidoActions(tenantId);
	const { espelho } = useEspelhoPedido(
		tenantId,
		original?.pedido.id,
		config.empresa,
	);
	const hoje = dataLocal(new Date());

	const produtoQueryId = searchParams.get("produtoId");
	const produtoPreSelecionado = useMemo(
		() =>
			produtoQueryId
				? todosProdutos.find((p) => p.id === produtoQueryId && p.ativo)
				: undefined,
		[produtoQueryId, todosProdutos],
	);

	const clienteInicialId =
		searchParams.get("clienteId") ?? searchParams.get("cliente") ?? "";
	const representadaInicialId =
		produtoPreSelecionado?.representada_id ??
		searchParams.get("representadaId") ??
		searchParams.get("representada") ??
		"";
	const representadaInicial = representadas.find(
		(r) => r.id === representadaInicialId,
	);

	const [valores, setValores] = useState<PedidoFormValues>(() =>
		valoresIniciaisPedidoForm(original, {
			clienteId: clienteInicialId,
			representadaId: representadaInicialId,
			tipoFrete: representadaInicial?.regras_frete_padrao ?? "CIF",
		}),
	);

	const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
	const [termoCadastroRapidoCliente, setTermoCadastroRapidoCliente] =
		useState("");

	// Rastreia se o usuário escolheu manualmente endereço, contato ou tabela
	const [enderecoManual, setEnderecoManual] = useState<boolean>(
		Boolean(original),
	);
	const [contatoManual, setContatoManual] = useState<boolean>(
		Boolean(original),
	);
	const [tabelaManual, setTabelaManual] = useState<boolean>(Boolean(original));
	const [mostrarDetalhesContexto, setMostrarDetalhesContexto] =
		useState<boolean>(Boolean(original?.pedido.observacoes));

	const [buscaCatalogo, setBuscaCatalogo] = useState("");
	const [erros, setErros] = useState<PedidoFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [avisoTabela, setAvisoTabela] = useState<string | null>(null);
	const [salvando, setSalvando] = useState(false);

	const somenteLeitura =
		original !== undefined && original.pedido.status !== "rascunho";

	// Dados reativos do cliente selecionado (endereços, contatos e tabelas padrão)
	const { dados: clienteCompleto } = useCliente(
		tenantId,
		valores.cliente_id || undefined,
		true,
	);
	const { tabelasPadrao } = useTabelasPadraoDoCliente(
		tenantId,
		valores.cliente_id || undefined,
	);

	// Tabelas vigentes da representada selecionada
	const { tabelas: tabelasVigentes, isLoading: carregandoTabelas } =
		useTabelasVigentes(tenantId, valores.representada_id || undefined, hoje);

	const tabelaPadraoDoClienteId =
		tabelasPadrao.get(valores.representada_id)?.tabela_id ?? null;

	const tabelaSugerida = useMemo(
		() => escolherTabelaSugerida(tabelasVigentes, tabelaPadraoDoClienteId),
		[tabelasVigentes, tabelaPadraoDoClienteId],
	);

	// Valores efetivos (sugeridos automaticamente quando não sobrescritos manualmente)
	const enderecosDoCliente = clienteCompleto?.enderecos ?? [];
	const contatosDoCliente = clienteCompleto?.contatos ?? [];

	const enderecoEntregaEfetivo = enderecoManual
		? valores.endereco_entrega_id
		: escolherEnderecoEntregaPadrao(enderecosDoCliente);

	const contatoEfetivo = contatoManual
		? valores.contato_id
		: escolherContatoPadrao(contatosDoCliente);

	const tabelaEfetivaId =
		tabelaManual &&
		valores.tabela_id !== "" &&
		(somenteLeitura || tabelasVigentes.some((t) => t.id === valores.tabela_id))
			? valores.tabela_id
			: (tabelaSugerida?.id ?? valores.tabela_id);

	// Preços vigentes dos produtos na tabela ativa
	const { precosPorProduto, isLoading: carregandoPrecos } = usePrecosDaTabela(
		tenantId,
		tabelaEfetivaId || undefined,
		hoje,
	);

	// Sincroniza reprecificação automática quando os preços da tabela ativa carregam/mudam
	useEffect(() => {
		if (somenteLeitura || precosPorProduto.size === 0) return;
		setValores((atual) => {
			if (atual.itens.length === 0) return atual;
			const { itens: reprecificados, produtosSemPrecoIds } =
				reprecificarItensFormPorTabela(atual.itens, precosPorProduto);
			if (produtosSemPrecoIds.length > 0) {
				setAvisoTabela(
					`${produtosSemPrecoIds.length} item(ns) do orçamento não possuem preço cadastrado na tabela selecionada e mantiveram o preço anterior.`,
				);
			} else {
				setAvisoTabela(null);
			}
			const mudou = reprecificados.some(
				(item, idx) =>
					item.preco_unitario_tabela_centavos !==
					atual.itens[idx]?.preco_unitario_tabela_centavos,
			);
			return mudou ? { ...atual, itens: reprecificados } : atual;
		});
	}, [precosPorProduto, somenteLeitura]);

	// Pré-adiciona produto vindo por query param (?produtoId=...) uma única vez
	const produtoQueryInseridoRef = useRef(false);
	useEffect(() => {
		if (
			produtoQueryInseridoRef.current ||
			original ||
			!produtoPreSelecionado ||
			produtoPreSelecionado.representada_id !== valores.representada_id
		) {
			return;
		}
		const preco = precosPorProduto.get(produtoPreSelecionado.id);
		if (!preco) return;

		produtoQueryInseridoRef.current = true;
		setValores((atual) => ({
			...atual,
			itens: adicionarOuIncrementarItemForm(
				atual.itens,
				produtoPreSelecionado.id,
				preco.preco_base_centavos,
				gerarLocalId,
			),
		}));
	}, [
		original,
		produtoPreSelecionado,
		valores.representada_id,
		precosPorProduto,
	]);

	const representadaSelecionada = useMemo(
		() => representadas.find((r) => r.id === valores.representada_id),
		[representadas, valores.representada_id],
	);

	const opcoesClientes = useMemo<OpcaoCombobox[]>(
		() =>
			clientes.map((c) => ({
				id: c.id,
				label: c.nome_fantasia
					? `${c.nome_fantasia} (${c.razao_social})`
					: c.razao_social,
				sublabel: `Doc: ${formatarCpfCnpj(c.cnpj_cpf)}`,
				keywords: [
					c.cnpj_cpf,
					formatarCpfCnpj(c.cnpj_cpf),
					c.razao_social,
					c.nome_fantasia ?? "",
				],
			})),
		[clientes],
	);

	const opcoesRepresentadas = useMemo<OpcaoCombobox<Representada>[]>(
		() =>
			representadas.map((r) => ({
				id: r.id,
				label: r.nome_fantasia,
				sublabel: `${r.razao_social} · Com. ${formatarCentesimosPercentual(r.percentual_comissao_padrao)}`,
				keywords: [r.cnpj, formatarCnpj(r.cnpj), r.razao_social],
				dados: r,
			})),
		[representadas],
	);

	const opcoesTabelas = useMemo<OpcaoCombobox[]>(
		() =>
			tabelasVigentes.map((t) => ({
				id: t.id,
				label:
					t.id === tabelaPadraoDoClienteId
						? `${t.nome_tabela} ★ Padrão do cliente`
						: t.nome_tabela,
				sublabel: `Vigência: ${descreverVigencia(t)}`,
				keywords: [t.nome_tabela],
			})),
		[tabelasVigentes, tabelaPadraoDoClienteId],
	);

	const opcoesCondicoesPagamento = useMemo<OpcaoCombobox[]>(
		() =>
			CONDICOES_PAGAMENTO_PADRAO.map((condicao) => ({
				id: condicao,
				label: condicao,
			})),
		[],
	);

	const produtosPorId = useMemo(() => {
		const mapa = new Map<string, Produto>();
		for (const p of todosProdutos) {
			mapa.set(p.id, p);
		}
		return mapa;
	}, [todosProdutos]);

	const produtosCatalogoRepresentada = useMemo(() => {
		if (!valores.representada_id) return [];
		return todosProdutos.filter(
			(p) =>
				p.ativo &&
				p.representada_id === valores.representada_id &&
				correspondeBuscaProduto(p, buscaCatalogo),
		);
	}, [todosProdutos, valores.representada_id, buscaCatalogo]);

	const quantidadeNoOrcamentoPorProduto = useMemo(() => {
		const mapa = new Map<string, number>();
		for (const item of valores.itens) {
			const qtd = Number(item.quantidade);
			if (Number.isFinite(qtd) && qtd > 0) {
				mapa.set(item.produto_id, (mapa.get(item.produto_id) ?? 0) + qtd);
			}
		}
		return mapa;
	}, [valores.itens]);

	const percentualComissaoPadrao =
		representadaSelecionada?.percentual_comissao_padrao ?? 0;

	const previaTotais = useMemo(
		() => calcularPreviaTotaisForm(valores.itens, percentualComissaoPadrao),
		[valores.itens, percentualComissaoPadrao],
	);

	const limparErro = (chave: string) => {
		setErros((atual) => ({ ...atual, [chave]: undefined }));
	};

	const handleTrocarCliente = (novoClienteId: string) => {
		setValores((atual) => ({
			...atual,
			cliente_id: novoClienteId,
			endereco_entrega_id: "",
			contato_id: "",
		}));
		setEnderecoManual(false);
		setContatoManual(false);
		setTabelaManual(false);
		limparErro("cliente_id");
	};

	const handleTrocarRepresentada = (novaRepresentadaId: string) => {
		if (novaRepresentadaId === valores.representada_id) return;
		if (valores.itens.length > 0) {
			const confirmar = window.confirm(
				"Trocar a representada removerá os itens atuais do orçamento. Deseja continuar?",
			);
			if (!confirmar) return;
		}
		const novaRep = representadas.find((r) => r.id === novaRepresentadaId);
		setValores((atual) => ({
			...atual,
			representada_id: novaRepresentadaId,
			tabela_id: "",
			tipo_frete: novaRep?.regras_frete_padrao ?? atual.tipo_frete,
			itens: [],
		}));
		setTabelaManual(false);
		setAvisoTabela(null);
		limparErro("representada_id");
		limparErro("tabela_id");
	};

	const handleTrocarTabela = (novaTabelaId: string) => {
		setValores((atual) => ({
			...atual,
			tabela_id: novaTabelaId,
		}));
		setTabelaManual(true);
		limparErro("tabela_id");
	};

	const handleAdicionarProduto = (produto: Produto) => {
		if (somenteLeitura) return;
		const preco = precosPorProduto.get(produto.id);
		if (!preco) return;

		setValores((atual) => ({
			...atual,
			itens: adicionarOuIncrementarItemForm(
				atual.itens,
				produto.id,
				preco.preco_base_centavos,
				gerarLocalId,
			),
		}));
		limparErro("itens");
	};

	const handleDeltaQuantidade = (localId: string, delta: number) => {
		if (somenteLeitura) return;
		setValores((atual) => ({
			...atual,
			itens: ajustarDeltaQuantidadeItemForm(atual.itens, localId, delta),
		}));
		limparErro(chaveErroItemPedido(localId, "quantidade"));
	};

	const handleAlterarCampoItem = (
		localId: string,
		campo: "quantidade" | "percentual_desconto",
		valor: string,
	) => {
		if (somenteLeitura) return;
		setValores((atual) => ({
			...atual,
			itens: atual.itens.map((item) =>
				item.localId === localId ? { ...item, [campo]: valor } : item,
			),
		}));
		limparErro(chaveErroItemPedido(localId, campo));
	};

	const handleRemoverItem = (localId: string) => {
		if (somenteLeitura) return;
		setValores((atual) => ({
			...atual,
			itens: atual.itens.filter((item) => item.localId !== localId),
		}));
	};

	const salvarOuEmitir = async (destinoStatus: "rascunho" | "emitido") => {
		if (somenteLeitura) return;
		setErroGeral(null);

		const valoresCompletos: PedidoFormValues = {
			...valores,
			tabela_id: tabelaEfetivaId,
			endereco_entrega_id: enderecoEntregaEfetivo,
			contato_id: contatoEfetivo,
		};

		const validacao = validarFormularioPedido(valoresCompletos);
		if (!validacao.success) {
			setErros(validacao.erros);
			setErroGeral(validacao.geral);
			return;
		}

		setErros({});
		setSalvando(true);
		try {
			if (destinoStatus === "emitido") {
				const resultado = await emitir(validacao.data, original?.pedido.id);
				navigate(`/pedidos/${resultado.pedido.id}`);
			} else {
				await salvarRascunho(validacao.data, original?.pedido.id);
				navigate("/pedidos");
			}
		} catch (e) {
			setErroGeral(
				mensagemDeErro(
					e,
					destinoStatus === "emitido"
						? "Erro ao fechar o pedido"
						: "Erro ao salvar o rascunho de orçamento",
				),
			);
		} finally {
			setSalvando(false);
		}
	};

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		void salvarOuEmitir("emitido");
	};

	const pedidoMinimoCentavos =
		representadaSelecionada?.valor_pedido_minimo_centavos ?? 0;
	const atingiuPedidoMinimo =
		pedidoMinimoCentavos === 0 ||
		previaTotais.valor_total_centavos >= pedidoMinimoCentavos;
	const usandoTabelaPadraoDoCliente =
		tabelaPadraoDoClienteId !== null &&
		tabelaEfetivaId === tabelaPadraoDoClienteId;

	return (
		<Page width="full">
			<PageHeader
				title={
					somenteLeitura
						? "Pedido emitido"
						: original
							? "Editar orçamento"
							: "Novo orçamento"
				}
				description={
					original
						? `Última atualização em ${formatarDataBr(original.pedido.updated_at.slice(0, 10))}`
						: "Selecione o contexto comercial no topo e monte o pedido com catálogo e sacola lado a lado."
				}
				back={{ to: "/pedidos", label: "Orçamentos e Pedidos" }}
				action={
					original && (
						<Badge
							variant={
								original.pedido.status === "rascunho" ? "secondary" : "success"
							}
						>
							{ROTULOS_STATUS_PEDIDO[original.pedido.status]}
						</Badge>
					)
				}
			/>

			{somenteLeitura && (
				<Alert>
					Este pedido já foi emitido e encontra-se em modo somente leitura para
					preservar a integridade comercial.
				</Alert>
			)}

			{espelho && <EspelhoPedidoActionsBar espelho={espelho} />}

			<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
				{/* 1. Barra Compacta de Contexto da Venda */}
				<fieldset
					disabled={somenteLeitura}
					className={cardClassName({
						className: "flex flex-col gap-3.5 p-3.5 md:p-4",
					})}
				>
					<legend className="sr-only">Contexto da venda</legend>

					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
						<FormField
							id="orcamento-cliente"
							label="Cliente"
							error={erros.cliente_id}
							required
						>
							<Combobox
								id="orcamento-cliente"
								name="cliente_id"
								value={valores.cliente_id}
								onChange={handleTrocarCliente}
								options={opcoesClientes}
								placeholder="Digite nome ou CPF/CNPJ..."
								emptyMessage="Nenhum cliente encontrado."
								disabled={somenteLeitura}
								hasError={Boolean(erros.cliente_id)}
								footerAction={
									!somenteLeitura
										? {
												label: (termo) =>
													termo
														? `Cadastrar novo cliente "${termo}"`
														: "Cadastrar novo cliente",
												onAction: (termo) => {
													setTermoCadastroRapidoCliente(termo);
													setModalNovoClienteAberto(true);
												},
											}
										: undefined
								}
							/>
						</FormField>

						<FormField
							id="orcamento-representada"
							label="Representada (Fábrica)"
							error={erros.representada_id}
							required
						>
							<Combobox
								id="orcamento-representada"
								name="representada_id"
								value={valores.representada_id}
								onChange={handleTrocarRepresentada}
								options={opcoesRepresentadas}
								placeholder="Digite o nome da fábrica..."
								emptyMessage="Nenhuma representada encontrada."
								disabled={somenteLeitura}
								hasError={Boolean(erros.representada_id)}
								renderOption={(opcao) => (
									<div className="flex min-w-0 flex-1 items-center gap-2">
										{opcao.dados && (
											<RepresentadaDot
												cor={obterCorRepresentada(opcao.dados)}
												size="sm"
											/>
										)}
										<div className="min-w-0 flex-1">
											<div className="truncate font-medium text-foreground">
												{opcao.label}
											</div>
											{opcao.sublabel && (
												<div className="truncate text-[11px] text-muted-foreground">
													{opcao.sublabel}
												</div>
											)}
										</div>
									</div>
								)}
							/>
						</FormField>

						<FormField
							id="orcamento-tabela"
							label={
								usandoTabelaPadraoDoCliente
									? "Tabela de preço ★ (Padrão cliente)"
									: "Tabela de preço"
							}
							error={erros.tabela_id}
							required
						>
							<Combobox
								id="orcamento-tabela"
								name="tabela_id"
								value={tabelaEfetivaId}
								onChange={handleTrocarTabela}
								options={opcoesTabelas}
								placeholder={
									!valores.representada_id
										? "Selecione a fábrica primeiro..."
										: tabelasVigentes.length === 0
											? "Nenhuma tabela vigente"
											: "Digite ou selecione a tabela..."
								}
								emptyMessage="Nenhuma tabela vigente encontrada."
								disabled={
									somenteLeitura ||
									!valores.representada_id ||
									carregandoTabelas ||
									tabelasVigentes.length === 0
								}
								hasError={Boolean(erros.tabela_id)}
							/>
						</FormField>

						<FormField
							id="orcamento-condicao"
							label="Condição de pagamento"
							error={erros.condicao_pagamento}
							required
						>
							<Combobox
								id="orcamento-condicao"
								name="condicao_pagamento"
								value={valores.condicao_pagamento}
								onChange={(novaCondicao) => {
									setValores((atual) => ({
										...atual,
										condicao_pagamento: novaCondicao,
									}));
									limparErro("condicao_pagamento");
								}}
								options={opcoesCondicoesPagamento}
								allowCustomValue
								placeholder="Digite ex: 30/60 dias, À vista..."
								emptyMessage="Pressione Enter para manter a condição digitada."
								disabled={somenteLeitura}
								hasError={Boolean(erros.condicao_pagamento)}
							/>
						</FormField>
					</div>

					{/* Atalhos de Condição de Pagamento + Botão para expandir logística/observações */}
					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
						<div className="flex flex-wrap items-center gap-1">
							{!somenteLeitura && (
								<>
									<span className="mr-1 text-[11px] text-muted-foreground">
										Pagamento rápido:
									</span>
									{CONDICOES_PAGAMENTO_PADRAO.map((condicao) => {
										const selecionada = valores.condicao_pagamento === condicao;
										return (
											<button
												key={condicao}
												type="button"
												aria-pressed={selecionada}
												onClick={() => {
													setValores((atual) => ({
														...atual,
														condicao_pagamento: condicao,
													}));
													limparErro("condicao_pagamento");
												}}
												className="cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
											>
												<Badge variant={selecionada ? "default" : "outline"}>
													{condicao}
												</Badge>
											</button>
										);
									})}
								</>
							)}
						</div>

						<div className="flex items-center gap-2">
							<span className="hidden text-xs text-muted-foreground sm:inline">
								Frete:{" "}
								<strong className="font-mono text-foreground">
									{valores.tipo_frete}
								</strong>
							</span>
							<button
								type="button"
								onClick={() => setMostrarDetalhesContexto((v) => !v)}
								className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted"
							>
								{mostrarDetalhesContexto ? (
									<>
										<ChevronUp aria-hidden="true" className="size-3.5" />
										Ocultar entrega, comprador e obs.
									</>
								) : (
									<>
										<ChevronDown aria-hidden="true" className="size-3.5" />
										Entrega, comprador, frete e obs.
									</>
								)}
							</button>
						</div>
					</div>

					{mostrarDetalhesContexto && (
						<div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-2 lg:grid-cols-4">
							<FormField
								id="orcamento-endereco"
								label="Endereço de entrega"
								error={erros.endereco_entrega_id}
							>
								<Select
									id="orcamento-endereco"
									name="endereco_entrega_id"
									value={enderecoEntregaEfetivo}
									onChange={(e) => {
										setEnderecoManual(true);
										setValores((atual) => ({
											...atual,
											endereco_entrega_id: e.target.value,
										}));
										limparErro("endereco_entrega_id");
									}}
									hasError={Boolean(erros.endereco_entrega_id)}
								>
									<option value="">
										{enderecosDoCliente.length === 0
											? "Nenhum endereço no cliente"
											: "Não especificado"}
									</option>
									{enderecosDoCliente.map((end) => (
										<option key={end.id} value={end.id}>
											[{end.tipo_endereco}] {end.endereco_completo}
										</option>
									))}
								</Select>
							</FormField>

							<FormField
								id="orcamento-contato"
								label="Contato / Comprador"
								error={erros.contato_id}
							>
								<Select
									id="orcamento-contato"
									name="contato_id"
									value={contatoEfetivo}
									onChange={(e) => {
										setContatoManual(true);
										setValores((atual) => ({
											...atual,
											contato_id: e.target.value,
										}));
										limparErro("contato_id");
									}}
									hasError={Boolean(erros.contato_id)}
								>
									<option value="">
										{contatosDoCliente.length === 0
											? "Nenhum contato no cliente"
											: "Não especificado"}
									</option>
									{contatosDoCliente.map((cont) => (
										<option key={cont.id} value={cont.id}>
											{cont.nome}
											{cont.papel ? ` (${cont.papel})` : ""} —{" "}
											{cont.telefone_whatsapp}
										</option>
									))}
								</Select>
							</FormField>

							<FormField
								id="orcamento-frete"
								label="Tipo de frete"
								error={erros.tipo_frete}
								required
							>
								<Select
									id="orcamento-frete"
									name="tipo_frete"
									value={valores.tipo_frete}
									onChange={(e) => {
										setValores((atual) => ({
											...atual,
											tipo_frete: e.target.value,
										}));
										limparErro("tipo_frete");
									}}
									hasError={Boolean(erros.tipo_frete)}
								>
									{TIPOS_FRETE.map((frete) => (
										<option key={frete} value={frete}>
											{ROTULOS_FRETE[frete]}
										</option>
									))}
								</Select>
							</FormField>

							<FormField
								id="orcamento-observacoes"
								label="Observações (opcional)"
								error={erros.observacoes}
							>
								<Input
									id="orcamento-observacoes"
									name="observacoes"
									disabled={somenteLeitura}
									value={valores.observacoes}
									onChange={(e) =>
										setValores((atual) => ({
											...atual,
											observacoes: e.target.value,
										}))
									}
									placeholder="Horário de entrega, faturamento..."
								/>
							</FormField>
						</div>
					)}
				</fieldset>

				{avisoTabela && <Alert>{avisoTabela}</Alert>}

				{/* 2. Workspace Split-View: Catálogo da Representada (Esquerda) + Sacola e Fechamento (Direita) */}
				<div
					className={`grid grid-cols-1 gap-4 ${
						somenteLeitura ? "" : "lg:grid-cols-12 lg:items-start"
					}`}
				>
					{/* Coluna Esquerda: Catálogo Rápido da Representada */}
					{!somenteLeitura && (
						<div
							className={cardClassName({
								className:
									"workspace-pane flex flex-col overflow-hidden lg:col-span-5",
							})}
						>
							<div className="flex flex-col gap-2.5 border-b border-border bg-muted/30 p-3.5">
								<div className="flex items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<h2 className="text-sm font-semibold text-foreground">
											Catálogo da fábrica
										</h2>
										{representadaSelecionada && (
											<RepresentadaBadge
												nome={representadaSelecionada.nome_fantasia}
												cor={obterCorRepresentada(representadaSelecionada)}
											/>
										)}
									</div>
									<span className="font-mono text-xs text-muted-foreground tabular-nums">
										{produtosCatalogoRepresentada.length} SKUs
									</span>
								</div>

								<SearchInput
									id="busca-catalogo-orcamento"
									placeholder="Buscar por SKU ou descrição para incluir..."
									value={buscaCatalogo}
									onChange={setBuscaCatalogo}
								/>
							</div>

							{!valores.representada_id && (
								<p className="p-6 text-center text-xs text-muted-foreground">
									Selecione uma representada acima para carregar os produtos.
								</p>
							)}

							{valores.representada_id && carregandoPrecos && (
								<p className="p-6 text-center text-xs text-muted-foreground">
									Carregando preços da tabela selecionada...
								</p>
							)}

							{valores.representada_id &&
								!carregandoPrecos &&
								produtosCatalogoRepresentada.length === 0 && (
									<div className="p-4">
										<EmptyState
											icon={Package}
											title="Nenhum produto encontrado nesta representada."
										/>
									</div>
								)}

							{valores.representada_id &&
								!carregandoPrecos &&
								produtosCatalogoRepresentada.length > 0 && (
									<ul className="max-h-[540px] divide-y divide-border overflow-y-auto">
										{produtosCatalogoRepresentada.map((produto) => {
											const preco = precosPorProduto.get(produto.id);
											const qtdAtual =
												quantidadeNoOrcamentoPorProduto.get(produto.id) ?? 0;

											return (
												<li
													key={produto.id}
													className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-muted/50 ${
														qtdAtual > 0 ? "bg-primary/5" : ""
													}`}
												>
													<div className="min-w-0 flex-1">
														<div className="flex flex-wrap items-center gap-1.5">
															<span className="rounded border border-border bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
																{produto.sku}
															</span>
															<span className="text-[11px] text-muted-foreground">
																{produto.unidade_medida}
																{produto.multiplo_embalagem > 1
																	? ` × ${produto.multiplo_embalagem}`
																	: ""}
															</span>
															{qtdAtual > 0 && (
																<Badge variant="success">
																	<Check
																		aria-hidden="true"
																		className="mr-0.5 size-3"
																	/>
																	{qtdAtual} na sacola
																</Badge>
															)}
														</div>
														<p className="mt-0.5 truncate text-xs font-medium text-foreground">
															{produto.descricao}
														</p>
													</div>

													<div className="flex shrink-0 items-center gap-2.5">
														<div className="text-right">
															{preco ? (
																<span className="font-mono text-xs font-semibold text-foreground tabular-nums">
																	{formatarCentavos(preco.preco_base_centavos)}
																</span>
															) : (
																<span className="text-[11px] text-muted-foreground">
																	Sem preço
																</span>
															)}
														</div>
														<Button
															size="sm"
															variant={qtdAtual > 0 ? "secondary" : "primary"}
															disabled={!preco}
															onClick={() => handleAdicionarProduto(produto)}
															aria-label={`Adicionar ${produto.sku} ${produto.descricao} ao orçamento`}
														>
															<Plus aria-hidden="true" />
															{qtdAtual > 0 ? "+1" : "Incluir"}
														</Button>
													</div>
												</li>
											);
										})}
									</ul>
								)}
						</div>
					)}

					{/* Coluna Direita: Sacola de Itens + Resumo Financeiro e Ações */}
					<div
						className={cardClassName({
							className: `workspace-pane flex flex-col overflow-hidden ${
								somenteLeitura ? "" : "lg:col-span-7"
							}`,
						})}
					>
						<div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
							<div>
								<h2
									id="itens-orcamento-caption"
									className="text-sm font-semibold text-foreground"
								>
									Itens do orçamento ({valores.itens.length})
								</h2>
								<p className="text-xs text-muted-foreground">
									Ajuste quantidades e descontos. Cálculo líquido com
									arredondamento bancário.
								</p>
							</div>
							<Badge variant="outline" className="font-mono tabular-nums">
								{previaTotais.quantidade_total_volumes} vol.
							</Badge>
						</div>

						{erros.itens && (
							<div className="p-3 pb-0">
								<Alert variant="destructive">{erros.itens}</Alert>
							</div>
						)}

						{valores.itens.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
								<Package
									aria-hidden="true"
									className="size-8 text-subtle-foreground"
								/>
								<p className="text-sm font-medium text-foreground">
									Sacola vazia
								</p>
								<p className="max-w-xs text-xs text-muted-foreground">
									Clique em &ldquo;Incluir&rdquo; nos produtos do catálogo ao
									lado para montar o orçamento.
								</p>
							</div>
						) : (
							<section
								aria-labelledby="itens-orcamento-caption"
								className="table-wrapper"
							>
								<table className="orcamento-itens-table text-left text-sm">
									<thead>
										<tr className="border-b border-border text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
											<th scope="col" className="px-3.5 py-2.5">
												Produto
											</th>
											<th scope="col" className="px-2.5 py-2.5 text-right">
												Tabela
											</th>
											<th scope="col" className="px-2.5 py-2.5 text-center">
												Quantidade
											</th>
											<th scope="col" className="px-2.5 py-2.5 text-center">
												Desc. (%)
											</th>
											<th scope="col" className="px-2.5 py-2.5 text-right">
												Líq. Unit.
											</th>
											<th scope="col" className="px-3 py-2.5 text-right">
												Subtotal
											</th>
											{!somenteLeitura && (
												<th scope="col" className="w-9 px-2 py-2.5 text-right">
													<span className="sr-only">Ações</span>
												</th>
											)}
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{valores.itens.map((linha) => {
											const produto = produtosPorId.get(linha.produto_id);
											const precoTabelaInfo = precosPorProduto.get(
												linha.produto_id,
											);
											const previa = calcularPreviaItemForm(linha);
											const erroQtd =
												erros[chaveErroItemPedido(linha.localId, "quantidade")];
											const erroDesc =
												erros[
													chaveErroItemPedido(
														linha.localId,
														"percentual_desconto",
													)
												];

											const descontoDigitado = parseDescontoFormParaCentesimos(
												linha.percentual_desconto,
											);
											const tetoInformativo =
												precoTabelaInfo?.desconto_maximo_permitido ?? 0;
											const acimaDoTetoInformativo =
												tetoInformativo > 0 &&
												descontoDigitado !== null &&
												descontoDigitado > tetoInformativo;

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
																	{produto?.sku ?? "SKU"}
																</span>
																<span className="text-xs font-medium">
																	{produto?.descricao ?? "Produto"}
																</span>
															</div>
															<span className="text-[11px] text-muted-foreground">
																{produto
																	? `${produto.unidade_medida} · Múlt. ${produto.multiplo_embalagem}`
																	: ""}
															</span>
														</div>
													</th>

													<td className="px-2.5 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
														{formatarCentavos(
															linha.preco_unitario_tabela_centavos,
														)}
													</td>

													<td className="px-2.5 py-2.5">
														<div className="flex flex-col items-center gap-1">
															<div className="flex items-center gap-1">
																{!somenteLeitura && (
																	<Button
																		size="sm"
																		variant="secondary"
																		className="px-2"
																		onClick={() =>
																			handleDeltaQuantidade(linha.localId, -1)
																		}
																		aria-label={`Diminuir quantidade de ${produto?.sku ?? "item"}`}
																	>
																		<Minus aria-hidden="true" />
																	</Button>
																)}
																<Input
																	aria-label={`Quantidade de ${produto?.sku ?? "item"}`}
																	name={`quantidade_${linha.localId}`}
																	inputMode="numeric"
																	autoComplete="off"
																	autoCorrect="off"
																	spellCheck={false}
																	disabled={somenteLeitura}
																	value={linha.quantidade}
																	onChange={(e) =>
																		handleAlterarCampoItem(
																			linha.localId,
																			"quantidade",
																			e.target.value,
																		)
																	}
																	hasError={Boolean(erroQtd)}
																	className="w-16 text-center font-mono tabular-nums"
																/>
																{!somenteLeitura && (
																	<Button
																		size="sm"
																		variant="secondary"
																		className="px-2"
																		onClick={() =>
																			handleDeltaQuantidade(linha.localId, 1)
																		}
																		aria-label={`Aumentar quantidade de ${produto?.sku ?? "item"}`}
																	>
																		<Plus aria-hidden="true" />
																	</Button>
																)}
															</div>
															{erroQtd && (
																<span
																	role="alert"
																	className="text-[11px] text-destructive"
																>
																	{erroQtd}
																</span>
															)}
														</div>
													</td>

													<td className="px-2.5 py-2.5">
														<div className="flex flex-col items-center gap-1">
															<Input
																aria-label={`Desconto percentual de ${produto?.sku ?? "item"}`}
																name={`desconto_${linha.localId}`}
																inputMode="decimal"
																autoComplete="off"
																autoCorrect="off"
																spellCheck={false}
																disabled={somenteLeitura}
																placeholder="0,00"
																value={linha.percentual_desconto}
																onChange={(e) =>
																	handleAlterarCampoItem(
																		linha.localId,
																		"percentual_desconto",
																		e.target.value,
																	)
																}
																hasError={Boolean(erroDesc)}
																className="w-20 text-right font-mono tabular-nums"
															/>
															{erroDesc ? (
																<span
																	role="alert"
																	className="text-[11px] text-destructive"
																>
																	{erroDesc}
																</span>
															) : acimaDoTetoInformativo ? (
																<span className="text-[10px] text-warning">
																	Máx:{" "}
																	{formatarCentesimosPercentual(
																		tetoInformativo,
																	)}
																</span>
															) : null}
														</div>
													</td>

													<td className="px-2.5 py-2.5 text-right font-mono text-xs font-medium tabular-nums whitespace-nowrap">
														{previa
															? formatarCentavos(
																	previa.preco_liquido_unitario_centavos,
																)
															: "—"}
													</td>

													<td className="px-3 py-2.5 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
														{previa
															? formatarCentavos(previa.subtotal_centavos)
															: "—"}
													</td>

													{!somenteLeitura && (
														<td className="px-2 py-2.5 text-right">
															<Button
																size="sm"
																variant="ghost"
																onClick={() => handleRemoverItem(linha.localId)}
																aria-label={`Remover ${produto?.sku ?? "item"} do orçamento`}
																className="px-1.5 text-subtle-foreground hover:text-destructive"
															>
																<Trash2
																	aria-hidden="true"
																	className="size-3.5"
																/>
															</Button>
														</td>
													)}
												</tr>
											);
										})}
									</tbody>
								</table>
							</section>
						)}

						{/* Rodapé Integrado do Painel: Totalizadores e Botões de Fechamento */}
						<div className="mt-auto flex flex-col gap-3 border-t border-border bg-muted/40 p-4">
							<div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
								<div>
									<span className="text-muted-foreground">Total tabela</span>
									<p className="font-mono font-medium text-foreground tabular-nums">
										{formatarCentavos(previaTotais.valor_tabela_total_centavos)}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Desconto total</span>
									<p className="font-mono font-medium text-foreground tabular-nums">
										{formatarCentavos(previaTotais.desconto_total_centavos)}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Comissão (
										{formatarCentesimosPercentual(
											previaTotais.percentual_comissao_padrao,
										)}
										)
									</span>
									<p className="font-mono font-semibold text-success tabular-nums">
										{formatarCentavos(previaTotais.comissao_projetada_centavos)}
									</p>
								</div>
								<div className="text-right">
									<span className="text-muted-foreground">Total líquido</span>
									<p className="font-mono text-base font-bold text-foreground tabular-nums">
										{formatarCentavos(previaTotais.valor_total_centavos)}
									</p>
								</div>
							</div>

							{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

							<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
								<div>
									{pedidoMinimoCentavos > 0 && (
										<Badge
											variant={atingiuPedidoMinimo ? "success" : "secondary"}
										>
											Mínimo fábrica: {formatarCentavos(pedidoMinimoCentavos)}
										</Badge>
									)}
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<Link
										to="/pedidos"
										className={buttonClassName({ variant: "ghost" })}
									>
										{somenteLeitura ? "Voltar" : "Cancelar"}
									</Link>
									{!somenteLeitura && (
										<>
											<Button
												variant="secondary"
												disabled={salvando}
												onClick={() => void salvarOuEmitir("rascunho")}
											>
												{salvando ? "Salvando..." : "Salvar rascunho"}
											</Button>
											<Button type="submit" disabled={salvando}>
												{salvando ? "Emitindo..." : "Fechar pedido"}
											</Button>
										</>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</form>

			<ClienteQuickCreateDialog
				open={modalNovoClienteAberto}
				tenantId={tenantId}
				termoInicial={termoCadastroRapidoCliente}
				onClose={() => setModalNovoClienteAberto(false)}
				onClienteCriado={(novoClienteId) => {
					setModalNovoClienteAberto(false);
					handleTrocarCliente(novoClienteId);
				}}
			/>
		</Page>
	);
}
