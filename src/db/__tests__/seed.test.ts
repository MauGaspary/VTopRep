import { beforeEach, describe, expect, it } from "vitest";
import { ClienteSchema } from "../../modules/clientes/domain/cliente.schema";
import { ClienteContatoSchema } from "../../modules/clientes/domain/cliente-contato.schema";
import { ClienteEnderecoSchema } from "../../modules/clientes/domain/cliente-endereco.schema";
import { ItemPrecoSchema } from "../../modules/produtos/domain/item-preco.schema";
import { ProdutoSchema } from "../../modules/produtos/domain/produto.schema";
import { TabelaPrecoSchema } from "../../modules/produtos/domain/tabela-preco.schema";
import { criarRepresentada } from "../../modules/representadas/domain/representada";
import { RepresentadaSchema } from "../../modules/representadas/domain/representada.schema";
import { db } from "../database";
import { seedDatabase } from "../seed";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";

describe("seedDatabase", () => {
	beforeEach(async () => {
		await Promise.all(db.tables.map((tabela) => tabela.clear()));
	});

	it("gera apenas registros válidos pelos schemas de domínio", async () => {
		await seedDatabase(db, TENANT);

		const validar = <T>(
			schema: { parse: (valor: unknown) => T },
			lista: unknown[],
		) => {
			for (const item of lista) {
				expect(() => schema.parse(item)).not.toThrow();
			}
		};

		validar(RepresentadaSchema, await db.representadas.toArray());
		validar(ProdutoSchema, await db.produtos.toArray());
		validar(TabelaPrecoSchema, await db.tabelas_preco.toArray());
		validar(ItemPrecoSchema, await db.itens_preco.toArray());
		validar(ClienteSchema, await db.clientes.toArray());
		validar(ClienteEnderecoSchema, await db.clientes_enderecos.toArray());
		validar(ClienteContatoSchema, await db.clientes_contatos.toArray());

		expect(await db.representadas.count()).toBe(2);
		expect(await db.produtos.count()).toBe(10);
		expect(await db.clientes.count()).toBe(5);
	});

	it("substitui apenas os dados do tenant informado", async () => {
		const deOutroTenant = criarRepresentada({
			tenantId: OUTRO_TENANT,
			id: crypto.randomUUID(),
			agora: new Date().toISOString(),
			input: {
				razao_social: "Outra Fábrica Ltda",
				nome_fantasia: "Outra",
				cnpj: "11.222.333/0001-81",
				percentual_comissao_padrao: 500,
				valor_pedido_minimo_centavos: 0,
				regras_frete_padrao: "CIF",
			},
		});
		await db.representadas.add(deOutroTenant);

		await seedDatabase(db, TENANT);
		await seedDatabase(db, TENANT);

		expect(await db.representadas.get(deOutroTenant.id)).toEqual(deOutroTenant);
		expect(
			await db.representadas.where("tenant_id").equals(TENANT).count(),
		).toBe(2);
		expect(await db.clientes.where("tenant_id").equals(TENANT).count()).toBe(5);
	});
});
