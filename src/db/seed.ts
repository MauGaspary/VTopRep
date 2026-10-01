import { fakerPT_BR as faker } from "@faker-js/faker";
import type { Cliente } from "../modules/clientes/domain/cliente.schema";
import type { ClienteContato } from "../modules/clientes/domain/cliente-contato.schema";
import type { ClienteEndereco } from "../modules/clientes/domain/cliente-endereco.schema";
import type { ItemPreco } from "../modules/produtos/domain/item-preco.schema";
import type { Produto } from "../modules/produtos/domain/produto.schema";
import type { TabelaPreco } from "../modules/produtos/domain/tabela-preco.schema";
import type { AppDatabase } from "./database";

export async function seedDatabase(db: AppDatabase, tenantId: string) {
	// Limpar tabelas
	await Promise.all([
		db.clientes.clear(),
		db.clientes_enderecos.clear(),
		db.clientes_contatos.clear(),
		db.clientes_metricas.clear(),
		db.produtos.clear(),
		db.tabelas_preco.clear(),
		db.itens_preco.clear(),
	]);

	// Gerar 2 Representadas (apenas os UUIDs, já que não temos a tabela mapeada localmente no Dexie)
	const representada1Id = faker.string.uuid();
	const representada2Id = faker.string.uuid();
	const representadasIds = [representada1Id, representada2Id];

	// Gerar 10 Produtos
	const produtos: Produto[] = Array.from({ length: 10 }).map(() => ({
		id: faker.string.uuid(),
		tenant_id: tenantId,
		representada_id: faker.helpers.arrayElement(representadasIds),
		sku: faker.string.alphanumeric(8).toUpperCase(),
		descricao: faker.commerce.productName(),
		unidade_medida: faker.helpers.arrayElement(["CX", "UN", "PCT", "KG"]),
		multiplo_embalagem: faker.number.int({ min: 1, max: 12 }),
		ativo: true,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		deleted_at: null,
	}));
	await db.produtos.bulkAdd(produtos);

	// Gerar 2 Tabelas de Preço
	const tabelasPreco: TabelaPreco[] = representadasIds.map((repId) => ({
		id: faker.string.uuid(),
		tenant_id: tenantId,
		representada_id: repId,
		nome_tabela: `Tabela Padrão ${faker.company.name()}`,
		vigencia_inicio: faker.date.past().toISOString(),
		vigencia_fim: null,
		ativo: true,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		deleted_at: null,
	}));
	await db.tabelas_preco.bulkAdd(tabelasPreco);

	// Gerar Itens de Preço (1 para cada produto na tabela de sua representada)
	const itensPreco: ItemPreco[] = produtos.map((produto) => {
		const tabela = tabelasPreco.find(
			(t) => t.representada_id === produto.representada_id,
		);
		return {
			id: faker.string.uuid(),
			tenant_id: tenantId,
			tabela_id: tabela?.id ?? faker.string.uuid(),
			produto_id: produto.id,
			preco_base_centavos: faker.number.int({ min: 1000, max: 50000 }), // R$10.00 - R$500.00
			teto_desconto_permitido: faker.helpers.arrayElement([0, 500, 1000]), // 0%, 5%, 10%
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			deleted_at: null,
		};
	});
	await db.itens_preco.bulkAdd(itensPreco);

	// Gerar 5 Clientes com Endereços e Contatos
	for (let i = 0; i < 5; i++) {
		const clienteId = faker.string.uuid();

		const cliente: Cliente = {
			id: clienteId,
			tenant_id: tenantId,
			cnpj_cpf: faker.string.numeric(14),
			razao_social: faker.company.name(),
			nome_fantasia: faker.helpers.maybe(() => faker.company.name(), {
				probability: 0.7,
			}), // Pode ser nulo
			ativo: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			deleted_at: null,
		};
		await db.clientes.add(cliente);

		const endereco: ClienteEndereco = {
			id: faker.string.uuid(),
			cliente_id: clienteId,
			tipo_endereco: "PRINCIPAL",
			endereco_completo: `${faker.location.streetAddress()}, ${faker.location.city()}`,
			latitude: faker.location.latitude(),
			longitude: faker.location.longitude(),
		};
		await db.clientes_enderecos.add(endereco);

		const contato: ClienteContato = {
			id: faker.string.uuid(),
			cliente_id: clienteId,
			nome: faker.person.fullName(),
			papel: faker.helpers.maybe(
				() =>
					faker.helpers.arrayElement(["COMPRADOR", "FINANCEIRO", "DIRETORIA"]),
				{ probability: 0.6 },
			), // Pode ser nulo
			telefone_whatsapp: faker.phone.number(),
			email: faker.helpers.maybe(() => faker.internet.email(), {
				probability: 0.8,
			}),
		};
		await db.clientes_contatos.add(contato);
	}

	console.log("Banco de dados populado com sucesso (Faker)!");
}
