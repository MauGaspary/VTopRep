import { beforeEach, describe, expect, it } from "vitest";
import { ClienteSchema } from "../../modules/clientes/domain/cliente.schema";
import { db } from "../database";

describe("AppDatabase", () => {
	beforeEach(async () => {
		await db.clientes.clear();
	});

	it("should persist and retrieve a Cliente correctly with isolated tenant_id", async () => {
		const tenantId = crypto.randomUUID();
		const clienteId = crypto.randomUUID();

		const clienteData = {
			id: clienteId,
			tenant_id: tenantId,
			cnpj_cpf: "12345678901234",
			razao_social: "Empresa Teste LTDA",
			nome_fantasia: "Empresa Teste",
			contato_comprador: "João",
			telefone_whatsapp: "11999999999",
			endereco_completo: "Rua Teste, 123",
			latitude: null,
			longitude: null,
			frequencia_recompra_dias_estimada: 30,
			data_ultima_compra: null,
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
	});

	it("should reject invalid Cliente according to Zod schema", () => {
		const invalidClienteData = {
			id: crypto.randomUUID(),
			tenant_id: crypto.randomUUID(),
			// missing cnpj_cpf (this makes it fail validation)
			razao_social: "Empresa Teste LTDA",
			nome_fantasia: "Empresa Teste",
			contato_comprador: "João",
			telefone_whatsapp: "11999999999",
			endereco_completo: "Rua Teste, 123",
			latitude: null,
			longitude: null,
			frequencia_recompra_dias_estimada: -10, // Invalid: should be positive
			data_ultima_compra: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			deleted_at: null,
		};

		expect(() => ClienteSchema.parse(invalidClienteData)).toThrow();
	});
});
