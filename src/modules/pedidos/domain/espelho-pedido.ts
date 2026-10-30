import type { TenantConfig } from "../../../config/tenant/tenant.schema";
import { formatarCnpj } from "../../../shared/domain/cnpj";
import { formatarCpfCnpj } from "../../../shared/domain/cpf-cnpj";
import { formatarDataBr } from "../../../shared/domain/datas";
import {
	formatarCentavos,
	formatarCentesimosPercentual,
} from "../../../shared/domain/decimal-br";
import { ROTULOS_FRETE, type TipoFrete } from "../../../shared/domain/frete";
import { garantirMesmoTenant } from "../../../shared/domain/tenant";
import { normalizarTexto } from "../../../shared/domain/texto";
import type { Cliente } from "../../clientes/domain/cliente.schema";
import type { ClienteContato } from "../../clientes/domain/cliente-contato.schema";
import type { ClienteEndereco } from "../../clientes/domain/cliente-endereco.schema";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import type { Representada } from "../../representadas/domain/representada.schema";
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
	const nomeBase = espelho.cliente.nomeFantasia ?? espelho.cliente.razaoSocial;
	const slugCliente =
		normalizarTexto(nomeBase)
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 32) || "cliente";

	return `${prefixo}-${espelho.codigoCurto}-${slugCliente}-${espelho.dataEmissaoIso}.pdf`;
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

/** Gera a URL `https://wa.me/...` pronta para envio imediato do espelho no WhatsApp. */
export function gerarUrlWhatsappEspelho(
	espelho: EspelhoPedidoDados,
	telefoneOverride?: string | null,
): string {
	const texto = encodeURIComponent(gerarTextoCompartilhamentoEspelho(espelho));
	const fone = normalizarTelefoneWhatsapp(
		telefoneOverride ?? espelho.cliente.contatoTelefone,
	);
	return fone
		? `https://wa.me/${fone}?text=${texto}`
		: `https://wa.me/?text=${texto}`;
}

/** Gera a URL `mailto:...` com assunto e resumo do espelho para envio por e-mail. */
export function gerarUrlEmailEspelho(
	espelho: EspelhoPedidoDados,
	emailOverride?: string | null,
): string {
	const tipo = espelho.status === "rascunho" ? "Orçamento" : "Pedido";
	const destinatario = (
		emailOverride ??
		espelho.cliente.contatoEmail ??
		""
	).trim();
	const assunto = encodeURIComponent(
		`${tipo} #${espelho.codigoCurto} — ${espelho.representada.nomeFantasia} (${espelho.totais.valorTotalFormatado})`,
	);
	const corpo = encodeURIComponent(gerarTextoCompartilhamentoEspelho(espelho));
	return `mailto:${destinatario}?subject=${assunto}&body=${corpo}`;
}
