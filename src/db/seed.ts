import { fakerPT_BR as faker } from "@faker-js/faker";
import { criarClienteCompleto } from "../modules/clientes/domain/cliente";
import {
	type ItemPreco,
	ItemPrecoSchema,
} from "../modules/produtos/domain/item-preco.schema";
import { criarProduto } from "../modules/produtos/domain/produto";
import {
	type TabelaPreco,
	TabelaPrecoSchema,
} from "../modules/produtos/domain/tabela-preco.schema";
import { criarRepresentada } from "../modules/representadas/domain/representada";
import { calcularDigitosVerificadoresCnpj } from "../shared/domain/cnpj";
import {
	calcularDigitosVerificadoresCpf,
	isCpfOuCnpjValido,
} from "../shared/domain/cpf-cnpj";
import type { AppDatabase } from "./database";

/** Gera documentos válidos e distintos entre si. */
function criarGeradorDocumentos() {
	const usados = new Set<string>();
	const gerar = (montar: () => string) => {
		for (;;) {
			const documento = montar();
			if (isCpfOuCnpjValido(documento) && !usados.has(documento)) {
				usados.add(documento);
				return documento;
			}
		}
	};

	return {
		cnpj: () =>
			gerar(() => {
				const base = faker.string.numeric(12);
				return `${base}${calcularDigitosVerificadoresCnpj(base)}`;
			}),
		cpf: () =>
			gerar(() => {
				const base = faker.string.numeric(9);
				return `${base}${calcularDigitosVerificadoresCpf(base)}`;
			}),
	};
}

/**
 * Remove todos os registros do tenant em todas as tabelas (inclusive pedidos
 * e outbox). Dados de outros tenants não são tocados.
 */
export async function limparDadosDoTenant(
	db: AppDatabase,
	tenantId: string,
): Promise<void> {
	await db.transaction("rw", db.tables, async () => {
		await Promise.all(
			db.tables.map((tabela) =>
				tabela.where("tenant_id").equals(tenantId).delete(),
			),
		);
	});
}

/**
 * Substitui os dados do tenant por dados falsos (apenas desenvolvimento).
 * Todos os registros passam pelas funções de domínio / schemas Zod.
 */
export async function seedDatabase(db: AppDatabase, tenantId: string) {
	const agora = () => new Date().toISOString();
	const documentos = criarGeradorDocumentos();

	const representadas = [
		{ sufixo: "Indústria e Comércio Ltda", comissao: 500, minimo: 150000 },
		{ sufixo: "S/A", comissao: 750, minimo: 300000 },
	].map(({ sufixo, comissao, minimo }, indice) =>
		criarRepresentada({
			tenantId,
			id: faker.string.uuid(),
			agora: agora(),
			input: {
				razao_social: `${faker.company.name()} ${sufixo}`,
				nome_fantasia: faker.company.name(),
				cnpj: documentos.cnpj(),
				percentual_comissao_padrao: comissao,
				valor_pedido_minimo_centavos: minimo,
				regras_frete_padrao: indice === 0 ? "CIF" : "FOB",
			},
		}),
	);

	const skusUsados = new Set<string>();
	const produtos = Array.from({ length: 10 }, () => {
		const representada = faker.helpers.arrayElement(representadas);
		let sku = "";
		do {
			sku = faker.string.alphanumeric(8).toUpperCase();
		} while (skusUsados.has(`${representada.id}:${sku}`));
		skusUsados.add(`${representada.id}:${sku}`);

		return criarProduto({
			tenantId,
			id: faker.string.uuid(),
			agora: agora(),
			input: {
				representada_id: representada.id,
				sku,
				descricao: faker.commerce.productName(),
				unidade_medida: faker.helpers.arrayElement(["CX", "UN", "PCT", "KG"]),
				multiplo_embalagem: faker.number.int({ min: 1, max: 12 }),
			},
		});
	});

	const tabelasPreco: TabelaPreco[] = representadas.map((representada) =>
		TabelaPrecoSchema.parse({
			id: faker.string.uuid(),
			tenant_id: tenantId,
			representada_id: representada.id,
			nome_tabela: `Tabela Padrão ${representada.nome_fantasia}`,
			vigencia_inicio: faker.date.past().toISOString().slice(0, 10),
			vigencia_fim: null,
			ativo: true,
			created_at: agora(),
			updated_at: agora(),
			deleted_at: null,
		}),
	);

	// 1 item de preço por produto, na tabela da sua representada
	const itensPreco: ItemPreco[] = produtos.flatMap((produto) => {
		const tabela = tabelasPreco.find(
			(t) => t.representada_id === produto.representada_id,
		);
		if (!tabela) return [];
		return ItemPrecoSchema.parse({
			id: faker.string.uuid(),
			tenant_id: tenantId,
			tabela_id: tabela.id,
			produto_id: produto.id,
			preco_base_centavos: faker.number.int({ min: 1000, max: 50000 }), // R$ 10,00 - R$ 500,00
			desconto_maximo_permitido: faker.helpers.arrayElement([0, 500, 1000]), // 0%, 5%, 10%
			created_at: agora(),
			updated_at: agora(),
			deleted_at: null,
		});
	});

	const clientes = Array.from({ length: 5 }, () =>
		criarClienteCompleto({
			tenantId,
			agora: agora(),
			clienteInput: {
				cnpj_cpf: faker.datatype.boolean()
					? documentos.cnpj()
					: documentos.cpf(),
				razao_social: faker.company.name(),
				nome_fantasia: faker.helpers.maybe(() => faker.company.name(), {
					probability: 0.7,
				}),
			},
			enderecosInput: [
				{
					tipo_endereco: "PRINCIPAL",
					endereco_completo: `${faker.location.streetAddress()}, ${faker.location.city()}`,
					latitude: faker.location.latitude(),
					longitude: faker.location.longitude(),
				},
			],
			contatosInput: [
				{
					nome: faker.person.fullName(),
					papel: faker.helpers.maybe(
						() =>
							faker.helpers.arrayElement([
								"COMPRADOR",
								"FINANCEIRO",
								"DIRETORIA",
							] as const),
						{ probability: 0.6 },
					),
					telefone_whatsapp: faker.phone.number(),
					email: faker.helpers.maybe(
						() => faker.internet.email({ allowSpecialCharacters: false }),
						{ probability: 0.8 },
					),
				},
			],
		}),
	);

	await limparDadosDoTenant(db, tenantId);
	await db.transaction("rw", db.tables, async () => {
		await db.representadas.bulkAdd(representadas);
		await db.produtos.bulkAdd(produtos);
		await db.tabelas_preco.bulkAdd(tabelasPreco);
		await db.itens_preco.bulkAdd(itensPreco);
		await db.clientes.bulkAdd(clientes.map((c) => c.cliente));
		await db.clientes_enderecos.bulkAdd(clientes.flatMap((c) => c.enderecos));
		await db.clientes_contatos.bulkAdd(clientes.flatMap((c) => c.contatos));
	});
}
