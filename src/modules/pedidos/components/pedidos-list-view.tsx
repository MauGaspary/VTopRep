import { Download, FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTenant } from "../../../config/tenant/useTenant";
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
import { formatarDataBr } from "../../../shared/domain/datas";
import { formatarCentavos } from "../../../shared/domain/decimal-br";
import { mensagemDeErro } from "../../../shared/domain/formulario";
import { ROTULOS_FRETE } from "../../../shared/domain/frete";
import { normalizarTexto } from "../../../shared/domain/texto";
import { useTodosClientes } from "../../clientes/hooks/use-clientes";
import { useTodasRepresentadas } from "../../representadas/hooks/use-representadas";
import {
	type Pedido,
	ROTULOS_STATUS_PEDIDO,
	type StatusPedido,
} from "../domain/pedido.schema";
import { usePedidoActions, usePedidos } from "../hooks/use-pedidos";
import { baixarEspelhoPedidoPdf } from "./espelho-pedido-pdf";

type FiltroStatus = "todos" | "rascunho" | "emitido";

const OPCOES_FILTRO: readonly { valor: FiltroStatus; rotulo: string }[] = [
	{ valor: "todos", rotulo: "Todos" },
	{ valor: "rascunho", rotulo: "Orçamentos (Rascunho)" },
	{ valor: "emitido", rotulo: "Pedidos Emitidos" },
];

function varianteBadgeStatus(status: StatusPedido) {
	if (status === "rascunho") return "secondary" as const;
	if (status === "cancelado") return "destructive" as const;
	return "success" as const;
}

export function PedidosListView() {
	const { config } = useTenant();
	const [termoBusca, setTermoBusca] = useState("");
	const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
	const [erro, setErro] = useState<string | null>(null);
	const [gerandoPdfId, setGerandoPdfId] = useState<string | null>(null);

	const { pedidos, isLoading: carregandoPedidos } = usePedidos(config.id);
	const { clientes, isLoading: carregandoClientes } = useTodosClientes(
		config.id,
	);
	const { representadas, isLoading: carregandoRepresentadas } =
		useTodasRepresentadas(config.id);
	const { excluirRascunho, obterEspelhoPorId } = usePedidoActions(config.id);

	const clientesPorId = useMemo(() => {
		const mapa = new Map<string, string>();
		for (const c of clientes) {
			mapa.set(c.id, c.nome_fantasia ?? c.razao_social);
		}
		return mapa;
	}, [clientes]);

	const representadasPorId = useMemo(() => {
		const mapa = new Map<string, string>();
		for (const r of representadas) {
			mapa.set(r.id, r.nome_fantasia);
		}
		return mapa;
	}, [representadas]);

	const pedidosFiltrados = useMemo(() => {
		const termo = normalizarTexto(termoBusca);
		return pedidos.filter((pedido) => {
			if (filtroStatus === "rascunho" && pedido.status !== "rascunho") {
				return false;
			}
			if (filtroStatus === "emitido" && pedido.status === "rascunho") {
				return false;
			}
			if (termo === "") return true;

			const nomeCliente = normalizarTexto(
				clientesPorId.get(pedido.cliente_id) ?? "",
			);
			const nomeRep = normalizarTexto(
				representadasPorId.get(pedido.representada_id) ?? "",
			);
			const condicao = normalizarTexto(pedido.condicao_pagamento);

			return (
				nomeCliente.includes(termo) ||
				nomeRep.includes(termo) ||
				condicao.includes(termo)
			);
		});
	}, [pedidos, filtroStatus, termoBusca, clientesPorId, representadasPorId]);

	const isLoading =
		carregandoPedidos || carregandoClientes || carregandoRepresentadas;

	const handleExcluirRascunho = async (pedido: Pedido) => {
		const nomeCliente = clientesPorId.get(pedido.cliente_id) ?? "Cliente";
		const confirmado = window.confirm(
			`Excluir o rascunho de orçamento de "${nomeCliente}"?`,
		);
		if (!confirmado) return;
		setErro(null);
		try {
			await excluirRascunho(pedido.id);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao excluir rascunho de orçamento"));
		}
	};

	const handleBaixarPdf = async (pedidoId: string) => {
		setErro(null);
		setGerandoPdfId(pedidoId);
		try {
			const espelho = await obterEspelhoPorId(pedidoId, config.empresa);
			if (!espelho) {
				setErro("Não foi possível carregar os dados do espelho para o PDF.");
				return;
			}
			await baixarEspelhoPedidoPdf(espelho);
		} catch (e) {
			setErro(mensagemDeErro(e, "Erro ao gerar o espelho PDF"));
		} finally {
			setGerandoPdfId(null);
		}
	};

	return (
		<Page>
			<PageHeader
				title="Orçamentos e Pedidos"
				description="Elabore orçamentos ágeis em campo e acompanhe os pedidos emitidos."
				action={
					<Link to="/pedidos/novo" className={buttonClassName()}>
						<Plus aria-hidden="true" />
						Novo orçamento
					</Link>
				}
			/>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap gap-1.5">
					{OPCOES_FILTRO.map((opcao) => {
						const ativo = filtroStatus === opcao.valor;
						return (
							<Button
								key={opcao.valor}
								size="sm"
								variant={ativo ? "primary" : "secondary"}
								aria-pressed={ativo}
								onClick={() => setFiltroStatus(opcao.valor)}
							>
								{opcao.rotulo}
							</Button>
						);
					})}
				</div>
				<div className="w-full sm:max-w-xs">
					<SearchInput
						id="busca-pedidos"
						placeholder="Cliente, representada ou condição..."
						value={termoBusca}
						onChange={setTermoBusca}
					/>
				</div>
			</div>

			{erro && <Alert variant="destructive">{erro}</Alert>}

			{isLoading && (
				<p className="py-6 text-center text-muted-foreground">
					Carregando orçamentos e pedidos...
				</p>
			)}

			{!isLoading && pedidosFiltrados.length === 0 && (
				<EmptyState
					icon={FileText}
					title={
						termoBusca || filtroStatus !== "todos"
							? "Nenhum orçamento ou pedido encontrado para o filtro atual."
							: "Nenhum orçamento ou pedido registrado ainda."
					}
					description="Inicie uma cotação selecionando o cliente, a representada e os itens do catálogo."
					action={
						<Link to="/pedidos/novo" className={buttonClassName()}>
							<Plus aria-hidden="true" />
							Criar primeiro orçamento
						</Link>
					}
				/>
			)}

			{!isLoading && pedidosFiltrados.length > 0 && (
				<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{pedidosFiltrados.map((pedido) => {
						const nomeCliente =
							clientesPorId.get(pedido.cliente_id) ?? "Cliente não encontrado";
						const nomeRep =
							representadasPorId.get(pedido.representada_id) ??
							"Representada não encontrada";
						const dataCurta = pedido.data_emissao.slice(0, 10);
						const rascunho = pedido.status === "rascunho";

						return (
							<Card
								as="li"
								key={pedido.id}
								className="flex flex-col justify-between gap-3 p-4"
							>
								<div className="flex flex-col gap-2">
									<div className="flex items-start justify-between gap-2">
										<div className="flex flex-col">
											<h2 className="text-[15px] leading-tight font-medium text-foreground">
												{nomeCliente}
											</h2>
											<span className="mt-0.5 text-xs text-muted-foreground">
												{nomeRep} · {formatarDataBr(dataCurta)}
											</span>
										</div>
										<Badge variant={varianteBadgeStatus(pedido.status)}>
											{ROTULOS_STATUS_PEDIDO[pedido.status]}
										</Badge>
									</div>

									<dl className="grid grid-cols-2 gap-2 border-t border-border pt-2.5 text-xs sm:grid-cols-4">
										<div className="flex flex-col">
											<dt className="text-muted-foreground">Valor total</dt>
											<dd className="font-semibold text-foreground tabular-nums">
												{formatarCentavos(pedido.valor_total_centavos)}
											</dd>
										</div>
										<div className="flex flex-col">
											<dt className="text-muted-foreground">Comissão proj.</dt>
											<dd className="font-medium text-foreground tabular-nums">
												{formatarCentavos(pedido.comissao_projetada_centavos)}
											</dd>
										</div>
										<div className="flex flex-col">
											<dt className="text-muted-foreground">Pagamento</dt>
											<dd className="truncate font-medium text-foreground">
												{pedido.condicao_pagamento}
											</dd>
										</div>
										<div className="flex flex-col">
											<dt className="text-muted-foreground">Frete</dt>
											<dd
												className="truncate font-medium text-foreground"
												title={ROTULOS_FRETE[pedido.tipo_frete]}
											>
												{pedido.tipo_frete}
											</dd>
										</div>
									</dl>
								</div>

								<div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
									{rascunho && (
										<Button
											variant="destructive"
											size="sm"
											onClick={() => handleExcluirRascunho(pedido)}
										>
											Excluir rascunho
										</Button>
									)}
									<Button
										variant="secondary"
										size="sm"
										disabled={gerandoPdfId === pedido.id}
										onClick={() => void handleBaixarPdf(pedido.id)}
									>
										<Download aria-hidden="true" />
										{gerandoPdfId === pedido.id ? "Gerando..." : "PDF"}
									</Button>
									<Link
										to={`/pedidos/${pedido.id}`}
										className={buttonClassName({
											variant: rascunho ? "primary" : "secondary",
											size: "sm",
										})}
									>
										{rascunho ? "Continuar orçamento" : "Ver pedido"}
									</Link>
								</div>
							</Card>
						);
					})}
				</ul>
			)}
		</Page>
	);
}
