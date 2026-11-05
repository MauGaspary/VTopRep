import {
	Check,
	ChevronDown,
	ChevronUp,
	Layers,
	Package,
	Plus,
	Repeat,
} from "lucide-react";
import {
	type FormEvent,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
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
	ShowMore,
} from "../../../shared/components/ui";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { dataLocal, formatarDataBr } from "../../../shared/domain/datas";
import { formatarCentavos } from "../../../shared/domain/decimal-br";
import { somarCentavos } from "../../../shared/domain/dinheiro";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { useRegistrarEdicaoEmAndamento } from "../../../shared/hooks/use-edicao-em-andamento";
import {
	PASSO_LISTA_INCREMENTAL,
	useListaIncremental,
} from "../../../shared/hooks/use-lista-incremental";
import { ClienteQuickCreateDialog } from "../../clientes/components/cliente-quick-create-dialog";
import {
	type Cliente,
	ROTULOS_TIPO_CLIENTE,
} from "../../clientes/domain/cliente.schema";
import { useCliente, useClientes } from "../../clientes/hooks/use-clientes";
import {
	correspondeBuscaProduto,
	descreverEmbalagem,
} from "../../produtos/domain/produto";
import type { Produto } from "../../produtos/domain/produto.schema";
import { usePrecosDaTabela } from "../../produtos/hooks/use-precos";
import { useTodosProdutos } from "../../produtos/hooks/use-produtos";
import {
	formatarResumoComissaoRepresentada,
	obterCorRepresentada,
} from "../../representadas/domain/representada";
import type { Representada } from "../../representadas/domain/representada.schema";
import { useRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	opcoesComboboxTransportadoras,
	sugerirTransportadoraDoCliente,
} from "../../transportadoras/domain/transportadora";
import { useTodasTransportadoras } from "../../transportadoras/hooks/use-transportadoras";
import { type CotacaoCompleta, cotacaoEditavel } from "../domain/cotacao";
import {
	atualizarGrupoForm,
	type CotacaoFormValues,
	type GrupoOrcamentoFormValues,
	garantirGrupoForm,
	removerGrupoForm,
	validarFormularioCotacao,
	valoresIniciaisCotacaoForm,
} from "../domain/cotacao-form";
import {
	escolherContatoPadrao,
	escolherEnderecoEntregaPadrao,
	resolverPercentualComissaoPedido,
	type TotaisPedido,
} from "../domain/pedido";
import { ROTULOS_STATUS_PEDIDO } from "../domain/pedido.schema";
import {
	adicionarOuIncrementarItemForm,
	calcularPreviaTotaisForm,
	type PedidoFormErros,
} from "../domain/pedido-form";
import {
	type RepeticaoCotacao,
	ROTULOS_MOTIVO_NAO_REPETIDO,
} from "../domain/repetir-pedido";
import {
	useCotacao,
	useEspelhoCotacao,
	usePedidoActions,
	useRepeticaoCotacao,
} from "../hooks/use-pedidos";
import { EspelhoCotacaoActionsBar } from "./espelho-pedido-pdf";
import { SecaoRepresentadaSacola } from "./secao-representada-sacola";

export function OrcamentoFormView() {
	const { id } = useParams();
	const [searchParams] = useSearchParams();
	const { config } = useTenant();
	const { dados, isLoading: carregandoCotacao } = useCotacao(config.id, id);
	// `/pedidos/novo?repetir=<pedidoId>`: novo orçamento a partir de um pedido.
	const repetirId = id ? undefined : (searchParams.get("repetir") ?? undefined);
	const { repeticao, isLoading: carregandoRepeticao } = useRepeticaoCotacao(
		config.id,
		repetirId,
		dataLocal(new Date()),
	);
	const { clientes, isLoading: carregandoClientes } = useClientes(config.id);
	const { representadas, isLoading: carregandoRepresentadas } =
		useRepresentadas(config.id);
	const { produtos, isLoading: carregandoProdutos } = useTodosProdutos(
		config.id,
	);

	if (
		(id && carregandoCotacao) ||
		(repetirId && carregandoRepeticao) ||
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
			key={id ?? (repetirId ? `repetir:${repetirId}` : "novo")}
			tenantId={config.id}
			pedidoReferenciaId={id}
			original={dados ?? undefined}
			repeticao={repeticao ?? undefined}
			repeticaoNaoEncontrada={Boolean(repetirId) && repeticao === null}
			clientes={clientes}
			representadas={representadas}
			todosProdutos={produtos}
		/>
	);
}

interface OrcamentoFormProps {
	tenantId: string;
	/** Pedido pelo qual a cotação foi aberta (`/pedidos/:id`). */
	pedidoReferenciaId?: string;
	original?: CotacaoCompleta;
	/** Novo orçamento repetindo um pedido existente (preços da tabela vigente). */
	repeticao?: RepeticaoCotacao;
	repeticaoNaoEncontrada?: boolean;
	clientes: ReadonlyArray<
		Pick<
			Cliente,
			"id" | "razao_social" | "nome_fantasia" | "cnpj_cpf" | "tipo_cliente"
		>
	>;
	representadas: readonly Representada[];
	todosProdutos: readonly Produto[];
}

const gerarLocalId = () => crypto.randomUUID();

function OrcamentoForm({
	tenantId,
	pedidoReferenciaId,
	original,
	repeticao,
	repeticaoNaoEncontrada = false,
	clientes,
	representadas,
	todosProdutos,
}: OrcamentoFormProps) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { config } = useTenant();
	const { salvarCotacao } = usePedidoActions(tenantId);
	const { espelho } = useEspelhoCotacao(
		tenantId,
		original ? pedidoReferenciaId : undefined,
		config.empresa,
	);
	const hoje = dataLocal(new Date());

	const representadasPorId = useMemo(() => {
		const mapa = new Map<string, Representada>();
		for (const r of representadas) {
			mapa.set(r.id, r);
		}
		return mapa;
	}, [representadas]);

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
	const representadaInicial = representadasPorId.get(
		produtoPreSelecionado?.representada_id ??
			searchParams.get("representadaId") ??
			searchParams.get("representada") ??
			"",
	);

	const [valores, setValores] = useState<CotacaoFormValues>(
		() =>
			repeticao?.valores ??
			valoresIniciaisCotacaoForm(original, {
				clienteId: clienteInicialId,
				representada: representadaInicial,
			}),
	);
	// Valores ao abrir a tela: todo `setValores` gera um objeto novo, o que
	// basta para saber se há alterações não salvas.
	const [valoresAoAbrir] = useState(valores);
	const [representadaAtivaId, setRepresentadaAtivaId] = useState<string>(
		() =>
			original?.pedidos[0]?.pedido.representada_id ??
			repeticao?.valores.grupos[0]?.representada_id ??
			representadaInicial?.id ??
			"",
	);

	const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
	const [termoCadastroRapidoCliente, setTermoCadastroRapidoCliente] =
		useState("");

	// Rastreia se o usuário escolheu manualmente endereço, contato ou transportadora
	const [enderecoManual, setEnderecoManual] = useState<boolean>(
		Boolean(original),
	);
	const [contatoManual, setContatoManual] = useState<boolean>(
		Boolean(original),
	);
	const [transportadoraManual, setTransportadoraManual] = useState<boolean>(
		Boolean(original) || Boolean(repeticao?.valores.transportadora_id),
	);
	const [mostrarDetalhesContexto, setMostrarDetalhesContexto] =
		useState<boolean>(
			Boolean(
				original?.pedidos[0]?.pedido.observacoes ||
					repeticao?.valores.observacoes,
			),
		);

	const [buscaCatalogo, setBuscaCatalogo] = useState("");
	const [erros, setErros] = useState<PedidoFormErros>({});
	const [erroGeral, setErroGeral] = useState<string | null>(null);
	const [salvando, setSalvando] = useState(false);

	const somenteLeitura =
		original !== undefined &&
		!cotacaoEditavel(original.pedidos.map((p) => p.pedido));

	// Segura a atualização do app enquanto houver alterações não salvas.
	useRegistrarEdicaoEmAndamento(!somenteLeitura && valores !== valoresAoAbrir);

	// Dados reativos do cliente selecionado (endereços e contatos)
	const { dados: clienteCompleto } = useCliente(
		tenantId,
		valores.cliente_id || undefined,
		true,
	);
	const { transportadoras } = useTodasTransportadoras(tenantId);

	// Valores efetivos (sugeridos automaticamente quando não sobrescritos manualmente)
	const enderecosDoCliente = clienteCompleto?.enderecos ?? [];
	const contatosDoCliente = clienteCompleto?.contatos ?? [];

	const enderecoEntregaEfetivo = enderecoManual
		? valores.endereco_entrega_id
		: escolherEnderecoEntregaPadrao(enderecosDoCliente);

	const contatoEfetivo = contatoManual
		? valores.contato_id
		: escolherContatoPadrao(contatosDoCliente);

	const transportadoraHabitualId = sugerirTransportadoraDoCliente(
		clienteCompleto?.cliente,
		transportadoras,
	);
	const transportadoraEfetivaId = transportadoraManual
		? valores.transportadora_id
		: transportadoraHabitualId;
	const usandoTransportadoraHabitual =
		transportadoraHabitualId !== "" &&
		transportadoraEfetivaId === transportadoraHabitualId;

	const transportadoraOriginalId =
		original?.pedidos[0]?.pedido.transportadora_id;
	const opcoesTransportadoras = useMemo(
		() =>
			opcoesComboboxTransportadoras(transportadoras, transportadoraOriginalId),
		[transportadoras, transportadoraOriginalId],
	);

	const grupoAtivo = valores.grupos.find(
		(g) => g.representada_id === representadaAtivaId,
	);
	const representadaAtiva = representadasPorId.get(representadaAtivaId);

	// Preços da tabela da seção ativa, para o catálogo
	const { precosPorProduto: precosCatalogo, isLoading: carregandoPrecos } =
		usePrecosDaTabela(tenantId, grupoAtivo?.tabela_id || undefined, hoje);

	const atualizarGrupo = useCallback(
		(
			representadaId: string,
			alterar: (grupo: GrupoOrcamentoFormValues) => GrupoOrcamentoFormValues,
		) => {
			setValores((atual) => ({
				...atual,
				grupos: atualizarGrupoForm(atual.grupos, representadaId, alterar),
			}));
		},
		[],
	);

	// Pré-adiciona produto vindo por query param (?produtoId=...) uma única vez
	const produtoQueryInseridoRef = useRef(false);
	useEffect(() => {
		if (
			produtoQueryInseridoRef.current ||
			original ||
			!produtoPreSelecionado ||
			produtoPreSelecionado.representada_id !== grupoAtivo?.representada_id
		) {
			return;
		}
		const preco = precosCatalogo.get(produtoPreSelecionado.id);
		if (!preco) return;

		produtoQueryInseridoRef.current = true;
		atualizarGrupo(produtoPreSelecionado.representada_id, (g) => ({
			...g,
			itens: adicionarOuIncrementarItemForm(
				g.itens,
				produtoPreSelecionado.id,
				preco.preco_base_centavos,
				gerarLocalId,
			),
		}));
	}, [
		original,
		produtoPreSelecionado,
		grupoAtivo?.representada_id,
		precosCatalogo,
		atualizarGrupo,
	]);

	const clienteSelecionado = useMemo(
		() =>
			clienteCompleto?.cliente ??
			clientes.find((c) => c.id === valores.cliente_id),
		[clienteCompleto?.cliente, clientes, valores.cliente_id],
	);
	const tipoClienteAtivo = clienteSelecionado?.tipo_cliente ?? null;

	const opcoesClientes = useMemo<OpcaoCombobox[]>(
		() =>
			clientes.map((c) => {
				const tipo = c.tipo_cliente ?? "REVENDA";
				return {
					id: c.id,
					label: c.nome_fantasia
						? `${c.nome_fantasia} (${c.razao_social})`
						: c.razao_social,
					sublabel: `${ROTULOS_TIPO_CLIENTE[tipo]} · Doc: ${formatarCpfCnpj(c.cnpj_cpf)}`,
					keywords: [
						c.cnpj_cpf,
						formatarCpfCnpj(c.cnpj_cpf),
						c.razao_social,
						c.nome_fantasia ?? "",
						ROTULOS_TIPO_CLIENTE[tipo],
					],
				};
			}),
		[clientes],
	);

	const representadasNaSacola = useMemo(
		() => new Set(valores.grupos.map((g) => g.representada_id)),
		[valores.grupos],
	);

	const opcoesRepresentadas = useMemo<OpcaoCombobox<Representada>[]>(
		() =>
			representadas.map((r) => ({
				id: r.id,
				label: r.nome_fantasia,
				sublabel: `${representadasNaSacola.has(r.id) ? "Na cotação · " : ""}${r.razao_social} · Com. ${formatarResumoComissaoRepresentada(r)}`,
				keywords: [r.cnpj, formatarCnpj(r.cnpj), r.razao_social],
				dados: r,
			})),
		[representadas, representadasNaSacola],
	);

	const produtosPorId = useMemo(() => {
		const mapa = new Map<string, Produto>();
		for (const p of todosProdutos) {
			mapa.set(p.id, p);
		}
		return mapa;
	}, [todosProdutos]);

	// Filtra com prioridade baixa: a digitação não espera a lista redesenhar.
	const buscaCatalogoAdiada = useDeferredValue(buscaCatalogo);
	const produtosCatalogoRepresentada = useMemo(() => {
		if (!representadaAtivaId) return [];
		return todosProdutos.filter(
			(p) =>
				p.ativo &&
				p.representada_id === representadaAtivaId &&
				correspondeBuscaProduto(p, buscaCatalogoAdiada),
		);
	}, [todosProdutos, representadaAtivaId, buscaCatalogoAdiada]);
	const listaCatalogo = useListaIncremental(
		produtosCatalogoRepresentada,
		`${representadaAtivaId}:${buscaCatalogoAdiada}`,
	);

	const quantidadeNoOrcamentoPorProduto = useMemo(() => {
		const mapa = new Map<string, number>();
		for (const grupo of valores.grupos) {
			for (const item of grupo.itens) {
				const qtd = Number(item.quantidade);
				if (Number.isFinite(qtd) && qtd > 0) {
					mapa.set(item.produto_id, (mapa.get(item.produto_id) ?? 0) + qtd);
				}
			}
		}
		return mapa;
	}, [valores.grupos]);

	// Prévia por fábrica (comissão conforme representada × segmento do cliente)
	const previasPorGrupo = useMemo(() => {
		const mapa = new Map<
			string,
			{ percentualComissao: number; previa: TotaisPedido }
		>();
		for (const grupo of valores.grupos) {
			const rep = representadasPorId.get(grupo.representada_id);
			const percentualComissao = rep
				? resolverPercentualComissaoPedido(rep, tipoClienteAtivo)
				: 0;
			mapa.set(grupo.representada_id, {
				percentualComissao,
				previa: calcularPreviaTotaisForm(grupo.itens, percentualComissao),
			});
		}
		return mapa;
	}, [valores.grupos, representadasPorId, tipoClienteAtivo]);

	const totaisGerais = useMemo(() => {
		const previas = [...previasPorGrupo.values()].map((p) => p.previa);
		return {
			valor_tabela_total_centavos: somarCentavos(
				previas.map((p) => p.valor_tabela_total_centavos),
			),
			desconto_total_centavos: somarCentavos(
				previas.map((p) => p.desconto_total_centavos),
			),
			comissao_projetada_centavos: somarCentavos(
				previas.map((p) => p.comissao_projetada_centavos),
			),
			valor_total_centavos: somarCentavos(
				previas.map((p) => p.valor_total_centavos),
			),
			quantidade_total_volumes: somarCentavos(
				previas.map((p) => p.quantidade_total_volumes),
			),
		};
	}, [previasPorGrupo]);

	const gruposComItens = valores.grupos.filter((g) => g.itens.length > 0);
	const quantidadeItens = valores.grupos.reduce(
		(total, g) => total + g.itens.length,
		0,
	);

	const limparErro = useCallback((chave: string) => {
		setErros((atual) =>
			atual[chave] === undefined ? atual : { ...atual, [chave]: undefined },
		);
	}, []);

	const handleTrocarCliente = (novoClienteId: string) => {
		setValores((atual) => ({
			...atual,
			cliente_id: novoClienteId,
			endereco_entrega_id: "",
			contato_id: "",
			transportadora_id: "",
			// Tabelas voltam a seguir a sugestão (padrão do novo cliente)
			grupos: atual.grupos.map((g) => ({ ...g, tabela_manual: false })),
		}));
		setEnderecoManual(false);
		setContatoManual(false);
		setTransportadoraManual(false);
		limparErro("cliente_id");
	};

	/** Abre o catálogo da fábrica, criando sua seção na sacola se necessário. */
	const handleAbrirCatalogo = (novaRepresentadaId: string) => {
		const representada = representadasPorId.get(novaRepresentadaId);
		if (!representada) return;
		setValores((atual) => ({
			...atual,
			grupos: garantirGrupoForm(atual.grupos, representada),
		}));
		if (novaRepresentadaId !== representadaAtivaId) {
			setRepresentadaAtivaId(novaRepresentadaId);
			setBuscaCatalogo("");
		}
		limparErro("itens");
	};

	const handleRemoverGrupo = (grupo: GrupoOrcamentoFormValues) => {
		const nome =
			representadasPorId.get(grupo.representada_id)?.nome_fantasia ??
			"esta fábrica";
		if (
			grupo.itens.length > 0 &&
			!window.confirm(
				`Remover ${nome} da cotação? Os ${grupo.itens.length} item(ns) desta fábrica serão descartados.`,
			)
		) {
			return;
		}
		const restantes = removerGrupoForm(valores.grupos, grupo.representada_id);
		setValores((atual) => ({
			...atual,
			grupos: removerGrupoForm(atual.grupos, grupo.representada_id),
		}));
		if (grupo.representada_id === representadaAtivaId) {
			setRepresentadaAtivaId(restantes[0]?.representada_id ?? "");
		}
	};

	const handleAdicionarProduto = (produto: Produto) => {
		if (somenteLeitura || !grupoAtivo) return;
		const preco = precosCatalogo.get(produto.id);
		if (!preco) return;

		atualizarGrupo(produto.representada_id, (g) => ({
			...g,
			itens: adicionarOuIncrementarItemForm(
				g.itens,
				produto.id,
				preco.preco_base_centavos,
				gerarLocalId,
			),
		}));
		limparErro("itens");
	};

	const salvarOuEmitir = async (destinoStatus: "rascunho" | "emitido") => {
		if (somenteLeitura) return;
		setErroGeral(null);

		const validacao = validarFormularioCotacao({
			...valores,
			endereco_entrega_id: enderecoEntregaEfetivo,
			contato_id: contatoEfetivo,
			transportadora_id: transportadoraEfetivaId,
		});
		if (!validacao.success) {
			setErros(validacao.erros);
			setErroGeral(validacao.geral);
			return;
		}

		setErros({});
		setSalvando(true);
		try {
			const resultado = await salvarCotacao(
				validacao.data,
				destinoStatus,
				original ? pedidoReferenciaId : undefined,
			);
			if (destinoStatus === "emitido") {
				const primeiro = resultado.pedidos[0]?.pedido.id;
				navigate(primeiro ? `/pedidos/${primeiro}` : "/pedidos");
			} else {
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

	const multiFabrica = gruposComItens.length > 1;
	const statusOriginal = original?.pedidos[0]?.pedido.status;
	const rotuloFechar =
		gruposComItens.length > 1
			? `Fechar ${gruposComItens.length} pedidos`
			: "Fechar pedido";

	return (
		<Page width="full">
			<PageHeader
				title={
					somenteLeitura
						? valores.grupos.length > 1
							? "Pedidos emitidos da cotação"
							: "Pedido emitido"
						: original
							? "Editar orçamento"
							: "Novo orçamento"
				}
				description={
					original?.pedidos[0]
						? `Última atualização em ${formatarDataBr(original.pedidos[0].pedido.updated_at.slice(0, 10))}`
						: "Escolha o cliente, abra o catálogo de cada fábrica e monte uma cotação única — ao salvar, é gerado 1 pedido por representada."
				}
				back={{ to: "/pedidos", label: "Orçamentos e Pedidos" }}
				action={
					statusOriginal && (
						<div className="flex flex-wrap items-center gap-1.5">
							{pedidoReferenciaId && (
								<Link
									to={`/pedidos/novo?repetir=${pedidoReferenciaId}`}
									className={buttonClassName({
										variant: "secondary",
										size: "sm",
									})}
									title="Novo orçamento com os mesmos itens, usando os preços da tabela vigente"
								>
									<Repeat aria-hidden="true" />
									Repetir pedido
								</Link>
							)}
							{valores.grupos.length > 1 && (
								<Badge variant="outline">
									<Layers aria-hidden="true" className="mr-1 size-3" />
									{valores.grupos.length} fábricas
								</Badge>
							)}
							<Badge
								variant={
									statusOriginal === "rascunho" ? "secondary" : "success"
								}
							>
								{ROTULOS_STATUS_PEDIDO[statusOriginal]}
							</Badge>
						</div>
					)
				}
			/>

			{somenteLeitura && (
				<Alert variant="info">
					{valores.grupos.length > 1
						? "Os pedidos desta cotação já foram emitidos e estão em modo somente leitura para preservar a integridade comercial."
						: "Este pedido já foi emitido e encontra-se em modo somente leitura para preservar a integridade comercial."}
				</Alert>
			)}

			{repeticaoNaoEncontrada && (
				<Alert variant="warning">
					O pedido a repetir não foi encontrado. Monte o orçamento normalmente.
				</Alert>
			)}

			{repeticao && <AvisoRepeticao repeticao={repeticao} />}

			{espelho && <EspelhoCotacaoActionsBar espelho={espelho} />}

			<form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
				{/* 1. Contexto do cliente, compartilhado por todas as fábricas */}
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
							label={
								tipoClienteAtivo
									? `Cliente · ${ROTULOS_TIPO_CLIENTE[tipoClienteAtivo]}`
									: "Cliente"
							}
							error={erros.cliente_id}
							required
							className="lg:col-span-2"
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
							id="orcamento-transportadora"
							label={
								usandoTransportadoraHabitual
									? "Transportadora ★ (Habitual)"
									: "Transportadora"
							}
							error={erros.transportadora_id}
						>
							<Combobox
								id="orcamento-transportadora"
								name="transportadora_id"
								value={transportadoraEfetivaId}
								onChange={(novaTransportadoraId) => {
									setTransportadoraManual(true);
									setValores((atual) => ({
										...atual,
										transportadora_id: novaTransportadoraId,
									}));
									limparErro("transportadora_id");
								}}
								options={opcoesTransportadoras}
								placeholder={
									opcoesTransportadoras.length === 0
										? "Nenhuma transportadora cadastrada"
										: "Digite o nome, CNPJ ou cidade..."
								}
								emptyMessage="Nenhuma transportadora encontrada."
								disabled={somenteLeitura}
								hasError={Boolean(erros.transportadora_id)}
							/>
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
					</div>

					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
						<p className="text-[11px] text-muted-foreground">
							Entrega, contato, transportadora e observações valem para todas as
							fábricas. Tabela, pagamento e frete são definidos por fábrica na
							sacola.
						</p>
						<button
							type="button"
							onClick={() => setMostrarDetalhesContexto((v) => !v)}
							className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted"
						>
							{mostrarDetalhesContexto ? (
								<>
									<ChevronUp aria-hidden="true" className="size-3.5" />
									Ocultar entrega e obs.
								</>
							) : (
								<>
									<ChevronDown aria-hidden="true" className="size-3.5" />
									Entrega e observações
								</>
							)}
						</button>
					</div>

					{mostrarDetalhesContexto && (
						<div className="grid grid-cols-1 gap-3 border-t border-border pt-3 md:grid-cols-2">
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

				{/* 2. Workspace Split-View: Catálogo (Esquerda) + Sacola por fábrica (Direita) */}
				<div
					className={`grid grid-cols-1 gap-4 ${
						somenteLeitura ? "" : "lg:grid-cols-12 lg:items-start"
					}`}
				>
					{!somenteLeitura && (
						<div
							className={cardClassName({
								className: "flex flex-col overflow-hidden lg:col-span-5",
							})}
						>
							<div className="flex flex-col gap-2.5 border-b border-border bg-muted/30 p-3.5">
								<div className="flex items-center justify-between gap-2">
									<h2 className="text-sm font-semibold text-foreground">
										Catálogo da fábrica
									</h2>
									<span className="font-mono text-xs text-muted-foreground tabular-nums">
										{produtosCatalogoRepresentada.length} SKUs
									</span>
								</div>

								<FormField
									id="orcamento-representada"
									label="Representada (Fábrica)"
								>
									<Combobox
										id="orcamento-representada"
										name="representada_id"
										value={representadaAtivaId}
										onChange={handleAbrirCatalogo}
										options={opcoesRepresentadas}
										placeholder="Digite o nome da fábrica..."
										emptyMessage="Nenhuma representada encontrada."
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

								{valores.grupos.length > 1 && (
									<fieldset
										aria-label="Fábricas na cotação"
										className="flex flex-wrap items-center gap-1"
									>
										{valores.grupos.map((grupo) => {
											const rep = representadasPorId.get(grupo.representada_id);
											if (!rep) return null;
											const ativa =
												grupo.representada_id === representadaAtivaId;
											return (
												<button
													key={grupo.representada_id}
													type="button"
													aria-pressed={ativa}
													onClick={() =>
														handleAbrirCatalogo(grupo.representada_id)
													}
													className={`cursor-pointer rounded-md p-0.5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
														ativa
															? "ring-1 ring-primary"
															: "opacity-75 hover:opacity-100"
													}`}
												>
													<RepresentadaBadge
														nome={`${rep.nome_fantasia} (${grupo.itens.length})`}
														cor={obterCorRepresentada(rep)}
													/>
												</button>
											);
										})}
									</fieldset>
								)}

								<SearchInput
									id="busca-catalogo-orcamento"
									placeholder="Buscar por SKU ou descrição para incluir..."
									value={buscaCatalogo}
									onChange={setBuscaCatalogo}
								/>
							</div>

							{!representadaAtiva && (
								<p className="p-6 text-center text-xs text-muted-foreground">
									Selecione uma representada acima para carregar os produtos.
									Você pode alternar entre fábricas sem perder a sacola.
								</p>
							)}

							{representadaAtiva && carregandoPrecos && (
								<p className="p-6 text-center text-xs text-muted-foreground">
									Carregando preços da tabela selecionada...
								</p>
							)}

							{representadaAtiva &&
								!carregandoPrecos &&
								produtosCatalogoRepresentada.length === 0 && (
									<div className="p-4">
										<EmptyState
											icon={Package}
											title="Nenhum produto encontrado nesta representada."
										/>
									</div>
								)}

							{representadaAtiva &&
								!carregandoPrecos &&
								produtosCatalogoRepresentada.length > 0 && (
									<ul className="divide-y divide-border lg:max-h-[540px] lg:overflow-y-auto">
										{listaCatalogo.visiveis.map((produto) => {
											const preco = precosCatalogo.get(produto.id);
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
																{descreverEmbalagem(
																	produto.unidade_medida,
																	produto.multiplo_embalagem,
																)}
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
										{listaCatalogo.restantes > 0 && (
											<li>
												<ShowMore
													restantes={listaCatalogo.restantes}
													passo={PASSO_LISTA_INCREMENTAL}
													onMostrarMais={listaCatalogo.mostrarMais}
													onMostrarTodos={listaCatalogo.mostrarTodos}
												/>
											</li>
										)}
									</ul>
								)}
						</div>
					)}

					{/* Coluna Direita: Sacola agrupada por fábrica + Resumo e Ações */}
					<div
						className={cardClassName({
							className: `flex flex-col overflow-hidden ${
								somenteLeitura ? "" : "lg:col-span-7"
							}`,
						})}
					>
						<div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
							<div>
								<h2 className="text-sm font-semibold text-foreground">
									Sacola da cotação ({quantidadeItens}{" "}
									{quantidadeItens === 1 ? "item" : "itens"})
								</h2>
								<p className="text-xs text-muted-foreground">
									Itens agrupados por fábrica. Cálculo líquido com
									arredondamento bancário.
								</p>
							</div>
							<Badge variant="outline" className="font-mono tabular-nums">
								{totaisGerais.quantidade_total_volumes} vol.
							</Badge>
						</div>

						{erros.itens && (
							<div className="p-3 pb-0">
								<Alert variant="destructive">{erros.itens}</Alert>
							</div>
						)}

						{valores.grupos.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
								<Package
									aria-hidden="true"
									className="size-8 text-subtle-foreground"
								/>
								<p className="text-sm font-medium text-foreground">
									Sacola vazia
								</p>
								<p className="max-w-xs text-xs text-muted-foreground">
									Escolha uma fábrica no catálogo ao lado e clique em
									&ldquo;Incluir&rdquo;. Itens de várias fábricas podem entrar
									na mesma cotação.
								</p>
							</div>
						) : (
							<div className="flex flex-col">
								{valores.grupos.map((grupo) => {
									const resumo = previasPorGrupo.get(grupo.representada_id);
									return (
										<SecaoRepresentadaSacola
											key={grupo.representada_id}
											tenantId={tenantId}
											hoje={hoje}
											grupo={grupo}
											representada={representadasPorId.get(
												grupo.representada_id,
											)}
											somenteLeitura={somenteLeitura}
											ativa={grupo.representada_id === representadaAtivaId}
											percentualComissao={resumo?.percentualComissao ?? 0}
											previa={resumo?.previa ?? calcularPreviaTotaisForm([], 0)}
											erros={erros}
											produtosPorId={produtosPorId}
											onAtualizarGrupo={atualizarGrupo}
											onRemover={() => handleRemoverGrupo(grupo)}
											onVerCatalogo={() =>
												handleAbrirCatalogo(grupo.representada_id)
											}
											limparErro={limparErro}
										/>
									);
								})}
							</div>
						)}

						{/* Rodapé: Totalizadores consolidados e Botões de Fechamento */}
						<div className="mt-auto flex flex-col gap-3 border-t border-border bg-muted/40 p-4">
							<div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
								<div>
									<span className="text-muted-foreground">Total tabela</span>
									<p className="font-mono font-medium text-foreground tabular-nums">
										{formatarCentavos(totaisGerais.valor_tabela_total_centavos)}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Desconto total</span>
									<p className="font-mono font-medium text-foreground tabular-nums">
										{formatarCentavos(totaisGerais.desconto_total_centavos)}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Comissão{" "}
										{tipoClienteAtivo
											? ROTULOS_TIPO_CLIENTE[tipoClienteAtivo]
											: "projetada"}
									</span>
									<p className="font-mono font-semibold text-success tabular-nums">
										{formatarCentavos(totaisGerais.comissao_projetada_centavos)}
									</p>
								</div>
								<div className="text-right">
									<span className="text-muted-foreground">
										{multiFabrica ? "Total geral" : "Total líquido"}
									</span>
									<p className="font-mono text-base font-bold text-foreground tabular-nums">
										{formatarCentavos(totaisGerais.valor_total_centavos)}
									</p>
								</div>
							</div>

							{erroGeral && <Alert variant="destructive">{erroGeral}</Alert>}

							<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
								<p className="text-[11px] text-muted-foreground">
									{multiFabrica
										? `Cotação com ${gruposComItens.length} fábricas: gera ${gruposComItens.length} pedidos individuais vinculados.`
										: ""}
								</p>

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
												className="max-lg:hidden"
											>
												{salvando ? "Salvando..." : "Salvar rascunho"}
											</Button>
											<Button
												type="submit"
												disabled={salvando}
												className="max-lg:hidden"
											>
												{salvando ? "Emitindo..." : rotuloFechar}
											</Button>
										</>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
				{/* Celular e tablet: total e ações sempre à mão, acima da barra inferior. */}
				{!somenteLeitura && (
					<div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col gap-2 border-t border-border bg-background px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between lg:hidden">
						<div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:gap-0">
							<span className="text-xs text-muted-foreground">
								{multiFabrica ? "Total geral" : "Total líquido"} ·{" "}
								{quantidadeItens} {quantidadeItens === 1 ? "item" : "itens"}
							</span>
							<span className="font-mono text-base font-bold text-foreground tabular-nums">
								{formatarCentavos(totaisGerais.valor_total_centavos)}
							</span>
						</div>
						<div className="flex gap-2 sm:shrink-0">
							<Button
								variant="secondary"
								disabled={salvando}
								onClick={() => void salvarOuEmitir("rascunho")}
								className="flex-1 sm:flex-none"
							>
								{salvando ? "Salvando…" : "Salvar rascunho"}
							</Button>
							<Button
								type="submit"
								disabled={salvando}
								className="flex-1 sm:flex-none"
							>
								{salvando ? "Emitindo…" : rotuloFechar}
							</Button>
						</div>
					</div>
				)}
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

/** Resumo da repetição: preços atualizados e itens que ficaram de fora. */
function AvisoRepeticao({ repeticao }: { repeticao: RepeticaoCotacao }) {
	const { itensNaoRepetidos } = repeticao;
	return (
		<Alert variant={itensNaoRepetidos.length > 0 ? "warning" : "info"}>
			<p>
				Repetindo pedido anterior com os preços da tabela vigente hoje. Confira
				as condições antes de salvar.
			</p>
			{itensNaoRepetidos.length > 0 && (
				<>
					<p className="mt-1.5 font-medium">
						{itensNaoRepetidos.length} item(ns) não entraram:
					</p>
					<ul className="mt-0.5 list-disc pl-5">
						{itensNaoRepetidos.map((item) => (
							<li key={`${item.representadaId}:${item.produtoId}`}>
								{item.sku ? `${item.sku} · ` : ""}
								{item.descricao ?? "Produto não encontrado"} —{" "}
								{ROTULOS_MOTIVO_NAO_REPETIDO[item.motivo]}
							</li>
						))}
					</ul>
				</>
			)}
		</Alert>
	);
}
