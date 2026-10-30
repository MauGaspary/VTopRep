import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import {
	criarTabelaPadrao,
	criarTabelaPreco,
	descreverVigencia,
	listarTabelasEmUso,
	NOME_TABELA_PADRAO,
	ordenarTabelasPreco,
	sincronizarTabelasRepresentada,
	situacaoVigencia,
} from "./tabela-preco";
import type { TabelaPreco } from "./tabela-preco.schema";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const REPRESENTADA = "33333333-3333-4333-a333-333333333333";
const CRIADO_EM = "2026-01-01T00:00:00.000Z";
const AGORA = "2026-10-29T12:00:00.000Z";

const tabela = (overrides: Partial<TabelaPreco> = {}): TabelaPreco => ({
	id: crypto.randomUUID(),
	tenant_id: TENANT,
	representada_id: REPRESENTADA,
	nome_tabela: "Tabela Base",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...overrides,
});

describe("situacaoVigencia e descreverVigencia", () => {
	it("classifica tabela vigente, futura e encerrada", () => {
		const fechada = tabela({
			vigencia_inicio: "2026-05-01",
			vigencia_fim: "2026-05-31",
		});

		expect(situacaoVigencia(fechada, "2026-04-30")).toBe("futura");
		expect(situacaoVigencia(fechada, "2026-05-01")).toBe("vigente");
		expect(situacaoVigencia(fechada, "2026-05-31")).toBe("vigente");
		expect(situacaoVigencia(fechada, "2026-06-01")).toBe("encerrada");
	});

	it("formata a descrição da vigência em pt-BR", () => {
		expect(
			descreverVigencia({ vigencia_inicio: "2026-01-05", vigencia_fim: null }),
		).toBe("A partir de 05/01/2026");
		expect(
			descreverVigencia({
				vigencia_inicio: "2026-01-05",
				vigencia_fim: "2026-12-31",
			}),
		).toBe("05/01/2026 a 31/12/2026");
	});
});

describe("ordenarTabelasPreco e listarTabelasEmUso", () => {
	it("ordena ativas antes de inativas, e vigência mais recente primeiro", () => {
		const inativa = tabela({
			nome_tabela: "Inativa",
			vigencia_inicio: "2026-10-01",
			ativo: false,
		});
		const antiga = tabela({
			nome_tabela: "Antiga",
			vigencia_inicio: "2025-01-01",
		});
		const recente = tabela({
			nome_tabela: "Recente",
			vigencia_inicio: "2026-06-01",
		});

		expect(
			ordenarTabelasPreco([inativa, antiga, recente]).map((t) => t.nome_tabela),
		).toEqual(["Recente", "Antiga", "Inativa"]);
	});

	it("lista em uso apenas tabelas ativas, não excluídas e não encerradas (vigentes antes de futuras)", () => {
		const vigente = tabela({
			nome_tabela: "Vigente",
			vigencia_inicio: "2026-01-01",
		});
		const futura = tabela({
			nome_tabela: "Futura",
			vigencia_inicio: "2027-01-01",
		});
		const encerrada = tabela({
			nome_tabela: "Encerrada",
			vigencia_inicio: "2025-01-01",
			vigencia_fim: "2025-12-31",
		});
		const inativa = tabela({ nome_tabela: "Inativa", ativo: false });
		const excluida = tabela({ nome_tabela: "Excluída", deleted_at: AGORA });

		const emUso = listarTabelasEmUso(
			[futura, encerrada, inativa, vigente, excluida],
			"2026-10-29",
		);

		expect(emUso.map((t) => t.nome_tabela)).toEqual(["Vigente", "Futura"]);
	});
});

describe("criarTabelaPreco e criarTabelaPadrao", () => {
	it("cria a Tabela Padrão vigente a partir de hoje", () => {
		const id = "44444444-4444-4444-a444-444444444444";
		const criada = criarTabelaPadrao({
			id,
			tenantId: TENANT,
			representadaId: REPRESENTADA,
			hoje: "2026-10-29",
			agora: AGORA,
		});

		expect(criada).toEqual({
			id,
			tenant_id: TENANT,
			representada_id: REPRESENTADA,
			nome_tabela: NOME_TABELA_PADRAO,
			vigencia_inicio: "2026-10-29",
			vigencia_fim: null,
			ativo: true,
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: null,
		});
	});

	it("rejeita fim de vigência anterior ao início", () => {
		expect(() =>
			criarTabelaPreco({
				id: crypto.randomUUID(),
				tenantId: TENANT,
				representadaId: REPRESENTADA,
				agora: AGORA,
				input: {
					nome_tabela: "Promocional",
					vigencia_inicio: "2026-06-01",
					vigencia_fim: "2026-05-31",
				},
			}),
		).toThrow();
	});
});

describe("sincronizarTabelasRepresentada", () => {
	it("mantém inalteradas, atualiza alteradas e cria novas tabelas", () => {
		const inalterada = tabela({ nome_tabela: "Tabela Padrão" });
		const alterada = tabela({ nome_tabela: "Atacado" });

		const resultado = sincronizarTabelasRepresentada({
			tenantId: TENANT,
			representadaId: REPRESENTADA,
			existentes: [inalterada, alterada],
			agora: AGORA,
			inputs: [
				{
					id: inalterada.id,
					nome_tabela: "Tabela Padrão",
					vigencia_inicio: inalterada.vigencia_inicio,
					vigencia_fim: null,
					ativo: true,
				},
				{
					id: alterada.id,
					nome_tabela: "Atacado Sul",
					vigencia_inicio: alterada.vigencia_inicio,
					vigencia_fim: "2026-12-31",
					ativo: false,
				},
				{
					nome_tabela: "Varejo",
					vigencia_inicio: "2026-10-29",
					vigencia_fim: null,
					ativo: true,
				},
			],
		});

		expect(resultado.tabelas).toHaveLength(3);
		expect(resultado.tabelas[0]).toBe(inalterada);
		expect(resultado.gravar).toHaveLength(2);
		expect(resultado.gravar[0]).toMatchObject({
			id: alterada.id,
			nome_tabela: "Atacado Sul",
			vigencia_fim: "2026-12-31",
			ativo: false,
			updated_at: AGORA,
		});
		expect(resultado.gravar[1]).toMatchObject({
			nome_tabela: "Varejo",
			representada_id: REPRESENTADA,
			tenant_id: TENANT,
		});
	});

	it("recusa tabelas existentes de outro tenant", () => {
		expect(() =>
			sincronizarTabelasRepresentada({
				tenantId: OUTRO_TENANT,
				representadaId: REPRESENTADA,
				existentes: [tabela()],
				inputs: [],
				agora: AGORA,
			}),
		).toThrow(TenantDivergenteError);
	});
});
