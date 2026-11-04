import { describe, expect, it } from "vitest";
import type { ItemPreco } from "./item-preco.schema";
import {
	planejarReajusteTabela,
	reajustarPreco,
	sugerirInicioReajuste,
	sugerirNomeReajuste,
	validarReajusteForm,
} from "./reajuste-tabela";
import {
	diaAnterior,
	diaSeguinte,
	encerrarTabelaNaVespera,
} from "./tabela-preco";
import type { TabelaPreco } from "./tabela-preco.schema";

const TENANT = "11111111-1111-4111-8111-111111111111";
const REP = "22222222-2222-4222-8222-222222222222";
const ANTES = "2026-01-01T00:00:00.000Z";
const AGORA = "2026-11-04T12:00:00.000Z";

let seq = 0;
const novoId = () => {
	seq++;
	return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
};

const ORIGEM: TabelaPreco = {
	id: "33333333-3333-4333-8333-333333333333",
	tenant_id: TENANT,
	representada_id: REP,
	nome_tabela: "Tabela 2026",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: ANTES,
	updated_at: ANTES,
	deleted_at: null,
};

function item(preco: number, extra: Partial<ItemPreco> = {}): ItemPreco {
	return {
		id: novoId(),
		tenant_id: TENANT,
		tabela_id: ORIGEM.id,
		produto_id: novoId(),
		preco_base_centavos: preco,
		desconto_maximo_permitido: 250,
		created_at: ANTES,
		updated_at: ANTES,
		deleted_at: null,
		...extra,
	};
}

describe("diaAnterior", () => {
	it("volta um dia, inclusive na virada de mês, ano e em ano bissexto", () => {
		expect(diaAnterior("2026-03-15")).toBe("2026-03-14");
		expect(diaAnterior("2026-03-01")).toBe("2026-02-28");
		expect(diaAnterior("2028-03-01")).toBe("2028-02-29");
		expect(diaAnterior("2027-01-01")).toBe("2026-12-31");
	});
});

describe("encerrarTabelaNaVespera", () => {
	it("define o fim na véspera do início da nova", () => {
		expect(
			encerrarTabelaNaVespera(ORIGEM, TENANT, "2026-12-01", AGORA),
		).toMatchObject({
			vigencia_fim: "2026-11-30",
			updated_at: AGORA,
		});
	});

	it("antecipa um fim posterior e não mexe num fim anterior", () => {
		const comFim = { ...ORIGEM, vigencia_fim: "2027-06-30" };
		expect(
			encerrarTabelaNaVespera(comFim, TENANT, "2027-01-01", AGORA)
				?.vigencia_fim,
		).toBe("2026-12-31");
		const jaTermina = { ...ORIGEM, vigencia_fim: "2026-06-30" };
		expect(
			encerrarTabelaNaVespera(jaTermina, TENANT, "2027-01-01", AGORA),
		).toBeNull();
	});

	it("recusa nova que começa no mesmo dia ou antes da origem", () => {
		expect(() =>
			encerrarTabelaNaVespera(ORIGEM, TENANT, "2026-01-01", AGORA),
		).toThrow(/precisa começar depois/);
	});
});

describe("reajustarPreco", () => {
	it("aplica aumento e redução em centavos com half-even", () => {
		expect(reajustarPreco(1000, 550)).toBe(1055);
		expect(reajustarPreco(1000, -300)).toBe(970);
		// 333 × 5% = 16,65 → 17
		expect(reajustarPreco(333, 500)).toBe(350);
		// 10 × 25% = 2,5 → 2 (par)
		expect(reajustarPreco(10, 2500)).toBe(12);
		// 30 × 25% = 7,5 → 8 (par)
		expect(reajustarPreco(30, 2500)).toBe(38);
		expect(reajustarPreco(0, 1000)).toBe(0);
		expect(reajustarPreco(1, -9999)).toBe(0);
	});
});

describe("planejarReajusteTabela", () => {
	const input = {
		tabela_origem_id: ORIGEM.id,
		percentual_centesimos: 1000,
		nome_tabela: "Tabela 2026 +10%",
		vigencia_inicio: "2026-12-01",
		vigencia_fim: null,
	};

	it("clona os itens vivos com reajuste e encerra a origem", () => {
		const vivo = item(1999);
		const plano = planejarReajusteTabela({
			tenantId: TENANT,
			origem: ORIGEM,
			itensOrigem: [vivo, item(500, { deleted_at: AGORA })],
			input,
			agora: AGORA,
			gerarId: novoId,
		});
		expect(plano.novaTabela).toMatchObject({
			representada_id: REP,
			nome_tabela: "Tabela 2026 +10%",
			vigencia_inicio: "2026-12-01",
			ativo: true,
		});
		expect(plano.itens).toHaveLength(1);
		expect(plano.itens[0]).toMatchObject({
			tabela_id: plano.novaTabela.id,
			produto_id: vivo.produto_id,
			// 1999 × 10% = 199,9 → 200
			preco_base_centavos: 2199,
			desconto_maximo_permitido: 250,
		});
		expect(plano.origemEncerrada?.vigencia_fim).toBe("2026-11-30");
		expect(plano.comparacao).toEqual([
			{
				produto_id: vivo.produto_id,
				anterior_centavos: 1999,
				novo_centavos: 2199,
			},
		]);
	});

	it("valida percentual, nome e datas", () => {
		const planejar = (extra: object) =>
			planejarReajusteTabela({
				tenantId: TENANT,
				origem: ORIGEM,
				itensOrigem: [],
				input: { ...input, ...extra },
				agora: AGORA,
				gerarId: novoId,
			});
		expect(() => planejar({ percentual_centesimos: -10000 })).toThrow();
		expect(() => planejar({ nome_tabela: " " })).toThrow();
		expect(() => planejar({ vigencia_fim: "2026-11-01" })).toThrow();
		expect(() => planejar({ vigencia_inicio: "2025-12-31" })).toThrow(
			/precisa começar depois/,
		);
	});
});

describe("diaSeguinte", () => {
	it("avança um dia na virada de mês e ano", () => {
		expect(diaSeguinte("2026-02-28")).toBe("2026-03-01");
		expect(diaSeguinte("2028-02-28")).toBe("2028-02-29");
		expect(diaSeguinte("2026-12-31")).toBe("2027-01-01");
	});
});

describe("formulário de reajuste", () => {
	const valores = {
		tabela_origem_id: ORIGEM.id,
		tipo: "aumento" as const,
		percentual: "5,5",
		nome_tabela: "Tabela 2026 +5,50%",
		vigencia_inicio: "2026-12-01",
		vigencia_fim: "",
	};

	it("converte o percentual com sinal", () => {
		expect(validarReajusteForm(valores, ORIGEM)).toEqual({
			ok: true,
			input: {
				tabela_origem_id: ORIGEM.id,
				percentual_centesimos: 550,
				nome_tabela: "Tabela 2026 +5,50%",
				vigencia_inicio: "2026-12-01",
				vigencia_fim: null,
			},
		});
		const reducao = validarReajusteForm(
			{ ...valores, tipo: "reducao" },
			ORIGEM,
		);
		expect(reducao.ok && reducao.input.percentual_centesimos).toBe(-550);
	});

	it("aponta erros por campo", () => {
		expect(
			validarReajusteForm(
				{
					...valores,
					percentual: "0",
					nome_tabela: "",
					vigencia_inicio: "2026-01-01",
				},
				ORIGEM,
			),
		).toEqual({
			ok: false,
			erros: {
				percentual: "Informe um percentual maior que zero",
				nome_tabela: "Nome da tabela é obrigatório",
			},
		});
		expect(
			validarReajusteForm(
				{ ...valores, vigencia_inicio: "2026-01-01" },
				ORIGEM,
			),
		).toEqual({
			ok: false,
			erros: {
				vigencia_inicio:
					'Comece depois de 01/01/2026 (início de "Tabela 2026")',
			},
		});
		expect(
			validarReajusteForm(
				{ ...valores, tipo: "reducao", percentual: "100" },
				ORIGEM,
			),
		).toMatchObject({
			ok: false,
			erros: { percentual: "A redução deve ser menor que 100%" },
		});
		expect(validarReajusteForm(valores, null)).toMatchObject({
			ok: false,
			erros: { tabela_origem_id: "Escolha a tabela de origem" },
		});
	});

	it("sugere nome e início", () => {
		expect(sugerirNomeReajuste(ORIGEM, "aumento", "5,5")).toBe(
			"Tabela 2026 +5,50%",
		);
		expect(sugerirNomeReajuste(ORIGEM, "reducao", "3")).toBe(
			"Tabela 2026 -3,00%",
		);
		expect(
			sugerirNomeReajuste({ nome_tabela: "x".repeat(80) }, "aumento", "10"),
		).toHaveLength(80);
		expect(sugerirInicioReajuste(ORIGEM, "2026-11-04")).toBe("2026-11-04");
		expect(
			sugerirInicioReajuste({ vigencia_inicio: "2026-11-04" }, "2026-11-04"),
		).toBe("2026-11-05");
	});
});
