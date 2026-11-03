import type { TenantConfig } from "../../../config/tenant/tenant.schema";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { formatarDataBr } from "../../../shared/domain/datas";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { somarCentavos } from "../../../shared/domain/dinheiro";
import { ROTULOS_FRETE, type TipoFrete } from "../../../shared/domain/frete";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { normalizarTexto } from "../../../shared/domain/texto";
import type { Cliente } from "../../clientes/domain/cliente.schema";
import type { ClienteContato } from "../../clientes/domain/cliente-contato.schema";
import type { ClienteEndereco } from "../../clientes/domain/cliente-endereco.schema";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import type { Representada } from "../../representadas/domain/representada.schema";
import type { Transportadora } from "../../transportadoras/domain/transportadora.schema";
import {
	calcularItemPedido,
	calcularTotaisPedido,
	type PedidoCompleto,
	resolverPercentualComissaoPedido,
} from "./pedido";
import { ROTULOS_STATUS_PEDIDO, type StatusPedido } from "./pedido.schema";

export interface EspelhoItemPedido {
	numero: number;
	id: string;
	produtoId: string;
	sku: string;
	descricao: string;
	unidadeMedida: string;
	multiploEmbalagem: number;
	quantidade: number;
	precoTabelaCentavos: number;
	precoTabelaFormatado: string;
	percentualDesconto: number;
	descontoPercentualFormatado: string;
	precoLiquidoCentavos: number;
	precoLiquidoFormatado: string;
	subtotalCentavos: number;
	subtotalFormatado: string;
}

export interface EspelhoTotaisPedido {
	quantidadeItens: number;
	quantidadeVolumes: number;
	valorTabelaTotalCentavos: number;
	valorTabelaTotalFormatado: string;
	descontoTotalCentavos: number;
	descontoTotalFormatado: string;
	valorTotalCentavos: number;
	valorTotalFormatado: string;
}

export interface EspelhoPedidoDados {
	pedidoId: string;
	tenantId: string;
	codigoCurto: string;
	idempotencyKey: string;
	status: StatusPedido;
	statusRotulo: string;
	tituloDocumento: string;
	dataEmissaoIso: string;
	dataEmissaoFormatada: string;
	emitente: {
		nomeFantasia: string;
		razaoSocial: string;
		cnpj: string;
		telefone: string | null;
	};
	representada: {
		id: string;
		nomeFantasia: string;
		razaoSocial: string;
		cnpjFormatado: string;
	};
	cliente: {
		id: string;
		razaoSocial: string;
		nomeFantasia: string | null;
		documentoFormatado: string;
		enderecoEntrega: string;
		contatoNome: string | null;
		contatoPapel: string | null;
		contatoTelefone: string | null;
		contatoEmail: string | null;
	};
	/** Bloco logístico: transportadora do pedido (`null` quando não definida). */
	logistica: {
		transportadora: {
			nomeFantasia: string;
			razaoSocial: string | null;
			cnpjFormatado: string | null;
			telefone: string | null;
			cidadeUf: string | null;
		} | null;
	};
	comercial: {
		tabelaPrecoNome: string;
		condicaoPagamento: string;
		tipoFrete: TipoFrete;
		tipoFreteRotulo: string;
		observacoes: string | null;
	};
	itens: EspelhoItemPedido[];
	totais: EspelhoTotaisPedido;
}

export interface MontarEspelhoPedidoParams {
	tenantId: string;
	empresa: TenantConfig["empresa"];
	pedidoCompleto: PedidoCompleto;
	cliente: Cliente;
	representada: Representada;
	tabelaPreco?: TabelaPreco | null;
	enderecoEntrega?: ClienteEndereco | null;
	contato?: ClienteContato | null;
	transportadora?: Transportadora | null;
	produtosPorId: ReadonlyMap<string, Produto>;
}

function formatarCnpjSeguro(valor: string): string {
	const limpo = valor.replace(/[^0-9A-Za-z]/g, "");
	return limpo.length === 14 ? formatarCnpj(limpo) : valor;
}

/**
 * Monta os dados consolidados e formatados do espelho de orçamento/pedido,
 * validando isolamento de tenant em todas as entidades relacionadas.
 */
export function montarEspelhoPedido({
	tenantId,
	empresa,
	pedidoCompleto,
	cliente,
	representada,
	tabelaPreco,
	enderecoEntrega,
	contato,
	transportadora,
	produtosPorId,
}: MontarEspelhoPedidoParams): EspelhoPedidoDados {
	const { pedido, itens } = pedidoCompleto;

	garantirMesmoTenant(pedido, tenantId);
	garantirMesmoTenant(cliente, tenantId);
	garantirMesmoTenant(representada, tenantId);
	if (tabelaPreco) {
		garantirMesmoTenant(tabelaPreco, tenantId);
	}
	if (enderecoEntrega) {
		garantirMesmoTenant(enderecoEntrega, tenantId);
	}
	if (contato) {
		garantirMesmoTenant(contato, tenantId);
	}
	if (transportadora) {
		garantirMesmoTenant(transportadora, tenantId);
	}

	const itensVivos = itens.filter((i) => i.deleted_at === null);
	const itensEspelho: EspelhoItemPedido[] = itensVivos.map((item, idx) => {
		garantirMesmoTenant(item, tenantId);
		const produto = produtosPorId.get(item.produto_id);
		if (produto) {
			garantirMesmoTenant(produto, tenantId);
		}
		const calculo = calcularItemPedido({
			quantidade: item.quantidade,
			preco_unitario_tabela_centavos: item.preco_unitario_tabela_centavos,
			percentual_desconto: item.percentual_desconto,
		});

		return {
			numero: idx + 1,
			id: item.id,
			produtoId: item.produto_id,
			sku: produto?.sku ?? "—",
			descricao: produto?.descricao ?? "Produto",
			unidadeMedida: produto?.unidade_medida ?? "UN",
			multiploEmbalagem: produto?.multiplo_embalagem ?? 1,
			quantidade: calculo.quantidade,
			precoTabelaCentavos: calculo.preco_unitario_tabela_centavos,
			precoTabelaFormatado: formatarCentavos(
				calculo.preco_unitario_tabela_centavos,
			),
			percentualDesconto: calculo.percentual_desconto,
			descontoPercentualFormatado: formatarCentesimosPercentual(
				calculo.percentual_desconto,
			),
			precoLiquidoCentavos: calculo.preco_liquido_unitario_centavos,
			precoLiquidoFormatado: formatarCentavos(
				calculo.preco_liquido_unitario_centavos,
			),
			subtotalCentavos: calculo.subtotal_centavos,
			subtotalFormatado: formatarCentavos(calculo.subtotal_centavos),
		};
	});

	const totaisCalculados = calcularTotaisPedido(
		itensVivos,
		resolverPercentualComissaoPedido(representada, cliente.tipo_cliente),
	);

	const dataEmissaoIso = pedido.data_emissao.slice(0, 10);
	const codigoCurto = pedido.id.slice(0, 8).toUpperCase();
	const rascunho = pedido.status === "rascunho";

	return {
		pedidoId: pedido.id,
		tenantId,
		codigoCurto,
		idempotencyKey: pedido.idempotency_key,
		status: pedido.status,
		statusRotulo: ROTULOS_STATUS_PEDIDO[pedido.status],
		tituloDocumento: rascunho
			? "ESPELHO DE ORÇAMENTO COMERCIAL"
			: "ESPELHO DE PEDIDO DE VENDA",
		dataEmissaoIso,
		dataEmissaoFormatada: formatarDataBr(dataEmissaoIso),
		emitente: {
			nomeFantasia: empresa.nomeFantasia,
			razaoSocial: empresa.razaoSocial,
			cnpj: formatarCnpjSeguro(empresa.cnpj),
			telefone: empresa.telefone?.trim() || null,
		},
		representada: {
			id: representada.id,
			nomeFantasia: representada.nome_fantasia,
			razaoSocial: representada.razao_social,
			cnpjFormatado: formatarCnpjSeguro(representada.cnpj),
		},
		cliente: {
			id: cliente.id,
			razaoSocial: cliente.razao_social,
			nomeFantasia: cliente.nome_fantasia ?? null,
			documentoFormatado: formatarCpfCnpj(cliente.cnpj_cpf),
			enderecoEntrega: enderecoEntrega
				? `[${enderecoEntrega.tipo_endereco}] ${enderecoEntrega.endereco_completo}`
				: "Não especificado",
			contatoNome: contato?.nome ?? null,
			contatoPapel: contato?.papel ?? null,
			contatoTelefone: contato?.telefone_whatsapp ?? null,
			contatoEmail: contato?.email ?? null,
		},
		logistica: {
			transportadora: transportadora
				? {
						nomeFantasia: transportadora.nome_fantasia,
						razaoSocial: transportadora.razao_social,
						cnpjFormatado: transportadora.cnpj
							? formatarCnpjSeguro(transportadora.cnpj)
							: null,
						telefone: transportadora.telefone,
						cidadeUf: transportadora.cidade_uf,
					}
				: null,
		},
		comercial: {
			tabelaPrecoNome: tabelaPreco?.nome_tabela ?? "Tabela comercial",
			condicaoPagamento: pedido.condicao_pagamento,
			tipoFrete: pedido.tipo_frete,
			tipoFreteRotulo: ROTULOS_FRETE[pedido.tipo_frete],
			observacoes: pedido.observacoes,
		},
		itens: itensEspelho,
		totais: {
			quantidadeItens: totaisCalculados.quantidade_itens,
			quantidadeVolumes: totaisCalculados.quantidade_total_volumes,
			valorTabelaTotalCentavos: totaisCalculados.valor_tabela_total_centavos,
			valorTabelaTotalFormatado: formatarCentavos(
				totaisCalculados.valor_tabela_total_centavos,
			),
			descontoTotalCentavos: totaisCalculados.desconto_total_centavos,
			descontoTotalFormatado: formatarCentavos(
				totaisCalculados.desconto_total_centavos,
			),
			valorTotalCentavos: totaisCalculados.valor_total_centavos,
			valorTotalFormatado: formatarCentavos(
				totaisCalculados.valor_total_centavos,
			),
		},
	};
}

function slugCliente(cliente: EspelhoPedidoDados["cliente"]): string {
	const nomeBase = cliente.nomeFantasia ?? cliente.razaoSocial;
	return (
		normalizarTexto(nomeBase)
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 32) || "cliente"
	);
}

/**
 * Gera um nome de arquivo determinístico e seguro para sistemas de arquivos
 * (ex.: `pedido-A1B2C3D4-mercado-bom-preco-2026-10-30.pdf`).
 */
export function gerarNomeArquivoEspelhoPdf(
	espelho: Pick<
		EspelhoPedidoDados,
		"status" | "codigoCurto" | "cliente" | "dataEmissaoIso"
	>,
): string {
	const prefixo = espelho.status === "rascunho" ? "orcamento" : "pedido";
	return `${prefixo}-${espelho.codigoCurto}-${slugCliente(espelho.cliente)}-${espelho.dataEmissaoIso}.pdf`;
}

/**
 * Monta o texto estruturado do espelho do orçamento/pedido para envio rápido
 * por WhatsApp ou corpo de e-mail ao comprador.
 */
export function gerarTextoCompartilhamentoEspelho(
	espelho: EspelhoPedidoDados,
): string {
	const tipo = espelho.status === "rascunho" ? "Orçamento" : "Pedido";
	const nomeCliente =
		espelho.cliente.nomeFantasia ?? espelho.cliente.razaoSocial;
	const linhasItens = espelho.itens.map(
		(item) =>
			`• ${item.quantidade}x [${item.sku}] ${item.descricao} — ${item.precoLiquidoFormatado}/un (${item.subtotalFormatado})`,
	);

	const blocos = [
		`*${espelho.tituloDocumento} #${espelho.codigoCurto}*`,
		`Data: ${espelho.dataEmissaoFormatada} | Status: ${espelho.statusRotulo}`,
		`Representada: ${espelho.representada.nomeFantasia}`,
		`Cliente: ${nomeCliente} (${espelho.cliente.documentoFormatado})`,
		"",
		`*Itens do ${tipo} (${espelho.totais.quantidadeVolumes} vol.):*`,
		...linhasItens,
		"",
		`*Total Líquido: ${espelho.totais.valorTotalFormatado}*`,
		`Condição de pagamento: ${espelho.comercial.condicaoPagamento}`,
		`Frete: ${espelho.comercial.tipoFreteRotulo}`,
	];

	const transportadora = espelho.logistica.transportadora;
	if (transportadora) {
		const detalhes = [transportadora.cidadeUf, transportadora.telefone]
			.filter((parte): parte is string => Boolean(parte))
			.join(" · ");
		blocos.push(
			`Transportadora: ${transportadora.nomeFantasia}${detalhes ? ` (${detalhes})` : ""}`,
		);
	}

	if (espelho.comercial.observacoes) {
		blocos.push(`Observações: ${espelho.comercial.observacoes}`);
	}

	return blocos.join("\n");
}

/** Normaliza telefone para discagem no WhatsApp (`wa.me`), adicionando DDI 55 para números BR. */
export function normalizarTelefoneWhatsapp(
	telefone?: string | null,
): string | null {
	if (!telefone) return null;
	const digitos = telefone.replace(/\D/g, "").replace(/^0+/, "");
	if (digitos.length === 10 || digitos.length === 11) {
		return `55${digitos}`;
	}
	if (digitos.length >= 12 && digitos.length <= 15) {
		return digitos;
	}
	return null;
}

function montarUrlWhatsapp(texto: string, telefone?: string | null): string {
	const textoCodificado = encodeURIComponent(texto);
	const fone = normalizarTelefoneWhatsapp(telefone);
	return fone
		? `https://wa.me/${fone}?text=${textoCodificado}`
		: `https://wa.me/?text=${textoCodificado}`;
}

function montarUrlEmail(
	destinatario: string | null | undefined,
	assunto: string,
	corpo: string,
): string {
	return `mailto:${(destinatario ?? "").trim()}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

/** Gera a URL `https://wa.me/...` pronta para envio imediato do espelho no WhatsApp. */
export function gerarUrlWhatsappEspelho(
	espelho: EspelhoPedidoDados,
	telefoneOverride?: string | null,
): string {
	return montarUrlWhatsapp(
		gerarTextoCompartilhamentoEspelho(espelho),
		telefoneOverride ?? espelho.cliente.contatoTelefone,
	);
}

/** Gera a URL `mailto:...` com assunto e resumo do espelho para envio por e-mail. */
export function gerarUrlEmailEspelho(
	espelho: EspelhoPedidoDados,
	emailOverride?: string | null,
): string {
	const tipo = espelho.status === "rascunho" ? "Orçamento" : "Pedido";
	return montarUrlEmail(
		emailOverride ?? espelho.cliente.contatoEmail,
		`${tipo} #${espelho.codigoCurto} — ${espelho.representada.nomeFantasia} (${espelho.totais.valorTotalFormatado})`,
		gerarTextoCompartilhamentoEspelho(espelho),
	);
}

// ---------------------------------------------------------------------------
// Cotação multi-representada: espelho unificado (todas as fábricas)
// ---------------------------------------------------------------------------

export class EspelhoCotacaoInconsistenteError extends Error {
	constructor(mensagem: string) {
		super(mensagem);
		this.name = "EspelhoCotacaoInconsistenteError";
	}
}

/**
 * Espelho unificado da cotação para o cliente: cabeçalho, cliente e logística
 * uma única vez, uma seção por representada e o total consolidado.
 */
export interface EspelhoCotacaoDados {
	cotacaoGrupoId: string | null;
	tenantId: string;
	codigoCurto: string;
	status: StatusPedido;
	statusRotulo: string;
	tituloDocumento: string;
	dataEmissaoIso: string;
	dataEmissaoFormatada: string;
	emitente: EspelhoPedidoDados["emitente"];
	cliente: EspelhoPedidoDados["cliente"];
	logistica: EspelhoPedidoDados["logistica"];
	observacoes: string | null;
	/** Um espelho individual por representada (também usado no PDF por fábrica). */
	secoes: EspelhoPedidoDados[];
	totais: EspelhoTotaisPedido;
}

/**
 * Consolida os espelhos individuais de uma cotação. Todas as seções precisam
 * ser do mesmo tenant e do mesmo cliente.
 */
export function montarEspelhoCotacao(
	secoes: readonly EspelhoPedidoDados[],
	cotacaoGrupoId: string | null,
): EspelhoCotacaoDados {
	const [primeira] = secoes;
	if (!primeira) {
		throw new EspelhoCotacaoInconsistenteError(
			"A cotação não possui pedidos para montar o espelho.",
		);
	}
	for (const secao of secoes) {
		if (
			secao.tenantId !== primeira.tenantId ||
			secao.cliente.id !== primeira.cliente.id
		) {
			throw new EspelhoCotacaoInconsistenteError(
				"Os pedidos da cotação pertencem a clientes ou tenants diferentes.",
			);
		}
	}

	const rascunho = secoes.every((s) => s.status === "rascunho");
	const status = rascunho
		? "rascunho"
		: (secoes.find((s) => s.status !== "rascunho")?.status ?? primeira.status);
	const dataEmissaoIso = secoes
		.map((s) => s.dataEmissaoIso)
		.reduce((maior, atual) => (atual > maior ? atual : maior));
	const somar = (valor: (t: EspelhoTotaisPedido) => number) =>
		somarCentavos(secoes.map((s) => valor(s.totais)));
	const valorTabelaTotalCentavos = somar((t) => t.valorTabelaTotalCentavos);
	const descontoTotalCentavos = somar((t) => t.descontoTotalCentavos);
	const valorTotalCentavos = somar((t) => t.valorTotalCentavos);

	return {
		cotacaoGrupoId,
		tenantId: primeira.tenantId,
		codigoCurto: (cotacaoGrupoId ?? primeira.pedidoId)
			.slice(0, 8)
			.toUpperCase(),
		status,
		statusRotulo: ROTULOS_STATUS_PEDIDO[status],
		tituloDocumento: rascunho
			? "COTAÇÃO MULTI-FÁBRICA"
			: "PEDIDOS DA COTAÇÃO (UNIFICADO)",
		dataEmissaoIso,
		dataEmissaoFormatada: formatarDataBr(dataEmissaoIso),
		emitente: primeira.emitente,
		cliente: primeira.cliente,
		logistica: primeira.logistica,
		observacoes: primeira.comercial.observacoes,
		secoes: [...secoes],
		totais: {
			quantidadeItens: somar((t) => t.quantidadeItens),
			quantidadeVolumes: somar((t) => t.quantidadeVolumes),
			valorTabelaTotalCentavos,
			valorTabelaTotalFormatado: formatarCentavos(valorTabelaTotalCentavos),
			descontoTotalCentavos,
			descontoTotalFormatado: formatarCentavos(descontoTotalCentavos),
			valorTotalCentavos,
			valorTotalFormatado: formatarCentavos(valorTotalCentavos),
		},
	};
}

/** Ex.: `cotacao-A1B2C3D4-mercado-bom-preco-2026-10-30.pdf`. */
export function gerarNomeArquivoEspelhoCotacaoPdf(
	espelho: Pick<
		EspelhoCotacaoDados,
		"codigoCurto" | "cliente" | "dataEmissaoIso"
	>,
): string {
	return `cotacao-${espelho.codigoCurto}-${slugCliente(espelho.cliente)}-${espelho.dataEmissaoIso}.pdf`;
}

/** Texto do espelho unificado (WhatsApp/E-mail), com uma seção por fábrica. */
export function gerarTextoCompartilhamentoCotacao(
	espelho: EspelhoCotacaoDados,
): string {
	const nomeCliente =
		espelho.cliente.nomeFantasia ?? espelho.cliente.razaoSocial;

	const blocos = [
		`*${espelho.tituloDocumento} #${espelho.codigoCurto}*`,
		`Data: ${espelho.dataEmissaoFormatada} | Status: ${espelho.statusRotulo}`,
		`Cliente: ${nomeCliente} (${espelho.cliente.documentoFormatado})`,
	];

	for (const secao of espelho.secoes) {
		blocos.push(
			"",
			`*${secao.representada.nomeFantasia}* — Pedido #${secao.codigoCurto}`,
			`Pagamento: ${secao.comercial.condicaoPagamento} | Frete: ${secao.comercial.tipoFreteRotulo}`,
			...secao.itens.map(
				(item) =>
					`• ${item.quantidade}x [${item.sku}] ${item.descricao} — ${item.precoLiquidoFormatado}/un (${item.subtotalFormatado})`,
			),
			`Subtotal ${secao.representada.nomeFantasia}: ${secao.totais.valorTotalFormatado}`,
		);
	}

	blocos.push(
		"",
		`*Total Geral (${espelho.secoes.length} fábricas): ${espelho.totais.valorTotalFormatado}*`,
	);

	const transportadora = espelho.logistica.transportadora;
	if (transportadora) {
		blocos.push(`Transportadora: ${transportadora.nomeFantasia}`);
	}
	if (espelho.observacoes) {
		blocos.push(`Observações: ${espelho.observacoes}`);
	}

	return blocos.join("\n");
}

/** URL do WhatsApp com o texto do espelho unificado da cotação. */
export function gerarUrlWhatsappCotacao(espelho: EspelhoCotacaoDados): string {
	return montarUrlWhatsapp(
		gerarTextoCompartilhamentoCotacao(espelho),
		espelho.cliente.contatoTelefone,
	);
}

/** URL `mailto:` com o resumo do espelho unificado da cotação. */
export function gerarUrlEmailCotacao(espelho: EspelhoCotacaoDados): string {
	return montarUrlEmail(
		espelho.cliente.contatoEmail,
		`Cotação #${espelho.codigoCurto} — ${espelho.secoes.length} fábricas (${espelho.totais.valorTotalFormatado})`,
		gerarTextoCompartilhamentoCotacao(espelho),
	);
}
