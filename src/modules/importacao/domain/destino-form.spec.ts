import { describe, expect, it } from "vitest";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import {
	nomeTabelaDoArquivo,
	validarDestinoForm,
	valoresIniciaisDestino,
} from "./destino-form";

const TENANT = "11111111-1111-4111-8111-111111111111";
const REP = "22222222-2222-4222-8222-222222222222";
const ANTES = "2026-01-01T00:00:00.000Z";
const HOJE = "2026-11-04";

const tabela = (extra: Partial<TabelaPreco>): TabelaPreco => ({
	id: crypto.randomUUID(),
	tenant_id: TENANT,
	representada_id: REP,
	nome_tabela: "Tabela",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: ANTES,
	updated_at: ANTES,
	deleted_at: null,
	...extra,
});

describe("nomeTabelaDoArquivo", () => {
	it("tira a extensão e os sublinhados", () => {
		expect(nomeTabelaDoArquivo("Tabela_Precos_2027.csv")).toBe(
			"Tabela Precos 2027",
		);
		expect(nomeTabelaDoArquivo(`${"x".repeat(100)}.csv`)).toHaveLength(80);
	});
});

describe("valoresIniciaisDestino", () => {
	it("sugere atualizar a vigente mais recente e substituí-la numa nova", () => {
		const antiga = tabela({ nome_tabela: "Antiga" });
		const recente = tabela({
			nome_tabela: "Recente",
			vigencia_inicio: "2026-06-01",
		});
		expect(
			valoresIniciaisDestino({
				tabelas: [antiga, recente],
				hoje: HOJE,
				nomeArquivo: "t.csv",
			}),
		).toEqual({
			tipo: "existente",
			tabela_id: recente.id,
			nome_tabela: "t",
			vigencia_inicio: HOJE,
			vigencia_fim: "",
			substitui_tabela_id: recente.id,
		});
	});

	it("tabela criada hoje não é sugerida como substituída", () => {
		const hoje = tabela({ vigencia_inicio: HOJE });
		expect(
			valoresIniciaisDestino({
				tabelas: [hoje],
				hoje: HOJE,
				nomeArquivo: "t.csv",
			}).substitui_tabela_id,
		).toBe("");
	});

	it("sem tabela ativa, sugere criar uma nova", () => {
		const inativa = tabela({ ativo: false });
		expect(
			valoresIniciaisDestino({
				tabelas: [inativa],
				hoje: HOJE,
				nomeArquivo: "t.csv",
			}),
		).toMatchObject({ tipo: "nova", tabela_id: "" });
	});
});

describe("validarDestinoForm", () => {
	const t = tabela({});
	const base = {
		tipo: "nova" as const,
		tabela_id: "",
		nome_tabela: "2027",
		vigencia_inicio: "2027-01-01",
		vigencia_fim: "",
		substitui_tabela_id: t.id,
	};

	it("monta o destino da nova tabela", () => {
		expect(validarDestinoForm(base, [t])).toEqual({
			ok: true,
			destino: {
				tipo: "nova",
				nome_tabela: "2027",
				vigencia_inicio: "2027-01-01",
				vigencia_fim: null,
				substitui_tabela_id: t.id,
			},
		});
	});

	it("aponta erros por campo", () => {
		expect(
			validarDestinoForm({ ...base, nome_tabela: " ", vigencia_inicio: "" }, [
				t,
			]),
		).toEqual({
			ok: false,
			erros: {
				nome_tabela: "Nome da tabela é obrigatório",
				vigencia_inicio: "Informe a data de início",
			},
		});
		expect(
			validarDestinoForm({ ...base, vigencia_fim: "2026-12-01" }, [t]),
		).toMatchObject({
			ok: false,
			erros: {
				vigencia_fim: "Fim da vigência não pode ser anterior ao início",
			},
		});
	});

	it("exige que a nova comece depois da substituída", () => {
		expect(
			validarDestinoForm({ ...base, vigencia_inicio: "2026-01-01" }, [t]),
		).toMatchObject({
			ok: false,
			erros: {
				vigencia_inicio: expect.stringContaining("comece depois de 01/01/2026"),
			},
		});
	});

	it("tabela existente precisa estar ativa", () => {
		const inativa = tabela({ ativo: false });
		expect(
			validarDestinoForm(
				{ ...base, tipo: "existente", tabela_id: inativa.id },
				[inativa],
			),
		).toEqual({ ok: false, erros: { tabela_id: "Escolha uma tabela ativa" } });
		expect(
			validarDestinoForm({ ...base, tipo: "existente", tabela_id: t.id }, [t]),
		).toEqual({
			ok: true,
			destino: { tipo: "existente", tabela_id: t.id },
		});
	});
});
