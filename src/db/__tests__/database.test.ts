import { beforeEach, describe, expect, it } from "vitest";
import { ClienteSchema } from "../../modules/clientes/domain/cliente.schema";
import { ClienteContatoSchema } from "../../modules/clientes/domain/cliente-contato.schema";
import { db } from "../database";

describe("AppDatabase", () => {
	beforeEach(async () => {
		await db.clientes.clear();
		await db.clientes_contatos.clear();
	});

	it("should persist and retrieve a Cliente correctly with isolated tenant_id and optional fields omitted", async () => {
		const tenantId = crypto.randomUUID();
		const clienteId = crypto.randomUUID();

		const clienteData = {
			id: clienteId,
			tenant_id: tenantId,
			cnpj_cpf: "11222333000181",
			razao_social: "Empresa Teste LTDA",
			// omitted nome_fantasia
			ativo: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			deleted_at: null,
		};

		// Validating against Zod schema before insertion
		const validCliente = ClienteSchema.parse(clienteData);

		await db.clientes.add(validCliente);

		const retrieved = await db.clientes.get(validCliente.id);
		expect(retrieved).toEqual(validCliente);
		expect(retrieved?.tenant_id).toBe(tenantId);
		expect(retrieved?.nome_fantasia).toBeUndefined();
	});

	it("should accept ClienteContato without optional fields", () => {
		const contatoData = {
			id: crypto.randomUUID(),
			cliente_id: crypto.randomUUID(),
			nome: "Teste Contato",
			telefone_whatsapp: "51999999999",
			// omitted papel and email
		};

		const valid = ClienteContatoSchema.parse(contatoData);
		expect(valid.papel).toBeUndefined();
		expect(valid.email).toBeUndefined();
	});

	it("should reject invalid Cliente according to Zod schema", () => {
		const invalidClienteData = {
			id: crypto.randomUUID(),
			tenant_id: crypto.randomUUID(),
			// missing cnpj_cpf (this makes it fail validation)
			razao_social: "Empresa Teste LTDA",
			nome_fantasia: "Empresa Teste",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			deleted_at: null,
		};

		expect(() => ClienteSchema.parse(invalidClienteData)).toThrow();
	});
});
