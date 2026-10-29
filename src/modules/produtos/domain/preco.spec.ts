import { describe, expect, it } from "vitest";
import { TenantDivergenteError } from "../../../shared/domain/tenant";
import type { ClienteTabelaPreco } from "./cliente-tabela-preco.schema";
import type { ItemPreco } from "./item-preco.schema";
import {
	definirTabelaPadrao,
	escolherTabelaSugerida,
	indexarItensPreco,
	listarTabelasVigentes,
	removerTabelaPadrao,
	resolverPreco,
	resolverPrecosDaTabela,
	TabelaPrecoNaoEncontradaError,
	tabelaVigenteEm,
} from "./preco";
import type { TabelaPreco } from "./tabela-preco.schema";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const REPRESENTADA = "33333333-3333-4333-a333-333333333333";
const CLIENTE = "44444444-4444-4444-a444-444444444444";
const PRODUTO_A = "55555555-5555-4555-a555-555555555555";
const PRODUTO_B = "66666666-6666-4666-a666-666666666666";
const CRIADO_EM = "2026-01-01T00:00:00.000Z";
const AGORA = "2026-10-28T12:00:00.000Z";

const tabela = (overrides: Partial<TabelaPreco> = {}): TabelaPreco => ({
	id: crypto.randomUUID(),
	tenant_id: TENANT,
	representada_id: REPRESENTADA,
	nome_tabela: "Tabela Padrão",
	vigencia_inicio: "2026-01-01",
	vigencia_fim: null,
	ativo: true,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...overrides,
});

const itemPreco = (
	tabelaPreco: TabelaPreco,
	overrides: Partial<ItemPreco> = {},
): ItemPreco => ({
	id: crypto.randomUUID(),
	tenant_id: tabelaPreco.tenant_id,
	tabela_id: tabelaPreco.id,
	produto_id: PRODUTO_A,
	preco_base_centavos: 1000,
	desconto_maximo_permitido: 500,
	created_at: CRIADO_EM,
	updated_at: CRIADO_EM,
	deleted_at: null,
	...overrides,
});

describe("tabelaVigenteEm", () => {
	const fechada = tabela({
		vigencia_inicio: "2026-03-01",
		vigencia_fim: "2026-03-31",
	});

	it("inclui o primeiro e o último dia da vigência", () => {
		expect(tabelaVigenteEm(fechada, "2026-03-01")).toBe(true);
		expect(tabelaVigenteEm(fechada, "2026-03-31")).toBe(true);
	});

	it("exclui datas antes do início e depois do fim", () => {
		expect(tabelaVigenteEm(fechada, "2026-02-28")).toBe(false);
		expect(tabelaVigenteEm(fechada, "2026-04-01")).toBe(false);
	});

	it("trata fim nulo ou ausente como vigência em aberto", () => {
		expect(tabelaVigenteEm(tabela({ vigencia_fim: null }), "2099-12-31")).toBe(
			true,
		);
		expect(
			tabelaVigenteEm(tabela({ vigencia_fim: undefined }), "2099-12-31"),
		).toBe(true);
	});

	it("aceita vigência de um único dia", () => {
		const umDia = tabela({
			vigencia_inicio: "2026-05-10",
			vigencia_fim: "2026-05-10",
		});
		expect(tabelaVigenteEm(umDia, "2026-05-10")).toBe(true);
		expect(tabelaVigenteEm(umDia, "2026-05-11")).toBe(false);
	});
});

describe("listarTabelasVigentes", () => {
	it("mantém só as ativas, não excluídas e vigentes, da mais recente para a mais antiga", () => {
		const antiga = tabela({
			nome_tabela: "Antiga",
			vigencia_inicio: "2025-01-01",
		});
		const recente = tabela({
			nome_tabela: "Recente",
			vigencia_inicio: "2026-06-01",
		});
		const inativa = tabela({ ativo: false });
		const excluida = tabela({ deleted_at: AGORA });
		const futura = tabela({ vigencia_inicio: "2027-01-01" });
		const vencida = tabela({ vigencia_fim: "2026-02-01" });

		const vigentes = listarTabelasVigentes(
			[antiga, inativa, recente, excluida, futura, vencida],
			"2026-10-28",
		);

		expect(vigentes.map((t) => t.nome_tabela)).toEqual(["Recente", "Antiga"]);
	});

	it("desempata pelo nome quando o início é o mesmo", () => {
		const b = tabela({ nome_tabela: "Bonificação" });
		const a = tabela({ nome_tabela: "atacado" });

		expect(
			listarTabelasVigentes([b, a], "2026-10-28").map((t) => t.nome_tabela),
		).toEqual(["atacado", "Bonificação"]);
	});
});

describe("escolherTabelaSugerida", () => {
	const recente = tabela({ vigencia_inicio: "2026-06-01" });
	const antiga = tabela({ vigencia_inicio: "2025-01-01" });
	const vigentes = [recente, antiga];

	it("prefere a tabela padrão do cliente quando está vigente", () => {
		expect(escolherTabelaSugerida(vigentes, antiga.id)).toBe(antiga);
	});

	it("cai na mais recente quando não há padrão ou ela não está vigente", () => {
		expect(escolherTabelaSugerida(vigentes, null)).toBe(recente);
		expect(escolherTabelaSugerida(vigentes, crypto.randomUUID())).toBe(recente);
	});

	it("retorna null quando não há tabela vigente", () => {
		expect(escolherTabelaSugerida([], antiga.id)).toBeNull();
	});
});

describe("indexarItensPreco", () => {
	it("ignora itens excluídos, de outra tabela ou de outro tenant", () => {
		const t = tabela();
		const valido = itemPreco(t);
		const itens = [
			valido,
			itemPreco(t, { produto_id: PRODUTO_B, deleted_at: AGORA }),
			itemPreco(tabela(), { produto_id: PRODUTO_B }),
			itemPreco(t, { produto_id: PRODUTO_B, tenant_id: OUTRO_TENANT }),
		];

		const indice = indexarItensPreco(itens, t);

		expect([...indice.keys()]).toEqual([PRODUTO_A]);
		expect(indice.get(PRODUTO_A)).toBe(valido);
	});

	it("com itens duplicados para o mesmo produto, vence o atualizado por último", () => {
		const t = tabela();
		const novo = itemPreco(t, {
			preco_base_centavos: 2000,
			updated_at: "2026-10-01T00:00:00.000Z",
		});
		const velho = itemPreco(t, {
			preco_base_centavos: 1500,
			updated_at: "2026-09-01T00:00:00.000Z",
		});

		expect(indexarItensPreco([novo, velho], t).get(PRODUTO_A)).toBe(novo);
		expect(indexarItensPreco([velho, novo], t).get(PRODUTO_A)).toBe(novo);
	});
});

describe("resolverPreco", () => {
	const t = tabela({
		vigencia_inicio: "2026-01-01",
		vigencia_fim: "2026-12-31",
	});
	const itens = [
		itemPreco(t, {
			preco_base_centavos: 12345,
			desconto_maximo_permitido: 1000,
		}),
	];
	const resolver = (
		overrides: Partial<Parameters<typeof resolverPreco>[0]> = {},
	) =>
		resolverPreco({
			tenantId: TENANT,
			tabela: t,
			itens,
			produtoId: PRODUTO_A,
			data: "2026-10-28",
			...overrides,
		});

	it("retorna o preço base e o desconto máximo do produto", () => {
		expect(resolver()).toEqual({
			ok: true,
			preco: {
				tabela_id: t.id,
				produto_id: PRODUTO_A,
				preco_base_centavos: 12345,
				desconto_maximo_permitido: 1000,
			},
		});
	});

	it("aceita preço zero (bonificação)", () => {
		const gratis = [itemPreco(t, { preco_base_centavos: 0 })];
		expect(resolver({ itens: gratis })).toMatchObject({
			ok: true,
			preco: { preco_base_centavos: 0 },
		});
	});

	it.each([
		["tabela ausente", { tabela: null }, "tabela_nao_encontrada"],
		[
			"tabela excluída",
			{ tabela: { ...t, deleted_at: AGORA } },
			"tabela_nao_encontrada",
		],
		["tabela inativa", { tabela: { ...t, ativo: false } }, "tabela_inativa"],
		["data antes da vigência", { data: "2025-12-31" }, "fora_de_vigencia"],
		["data depois da vigência", { data: "2027-01-01" }, "fora_de_vigencia"],
		["produto fora da tabela", { produtoId: PRODUTO_B }, "produto_sem_preco"],
	] as const)("sem preço: %s", (_, overrides, motivo) => {
		expect(resolver(overrides)).toEqual({ ok: false, motivo });
	});

	it("recusa tabela de outro tenant", () => {
		expect(() => resolver({ tenantId: OUTRO_TENANT })).toThrow(
			TenantDivergenteError,
		);
	});
});

describe("resolverPrecosDaTabela", () => {
	it("indexa os preços da tabela por produto", () => {
		const t = tabela();
		const resultado = resolverPrecosDaTabela({
			tenantId: TENANT,
			tabela: t,
			itens: [
				itemPreco(t, { preco_base_centavos: 100 }),
				itemPreco(t, { produto_id: PRODUTO_B, preco_base_centavos: 200 }),
			],
			data: "2026-10-28",
		});

		expect(resultado.ok).toBe(true);
		if (!resultado.ok) return;
		expect(resultado.precos.get(PRODUTO_A)?.preco_base_centavos).toBe(100);
		expect(resultado.precos.get(PRODUTO_B)?.preco_base_centavos).toBe(200);
	});

	it("informa o motivo quando a tabela não pode ser usada", () => {
		expect(
			resolverPrecosDaTabela({
				tenantId: TENANT,
				tabela: tabela({ vigencia_inicio: "2027-01-01" }),
				itens: [],
				data: "2026-10-28",
			}),
		).toEqual({ ok: false, motivo: "fora_de_vigencia" });
	});
});

describe("definirTabelaPadrao", () => {
	const t = tabela();
	const ID = "77777777-7777-4777-a777-777777777777";
	const definir = (
		overrides: Partial<Parameters<typeof definirTabelaPadrao>[0]> = {},
	) =>
		definirTabelaPadrao({
			existente: null,
			tenantId: TENANT,
			clienteId: CLIENTE,
			tabela: t,
			id: ID,
			agora: AGORA,
			...overrides,
		});

	it("cria a associação com a representada da tabela", () => {
		expect(definir()).toEqual({
			id: ID,
			tenant_id: TENANT,
			cliente_id: CLIENTE,
			representada_id: REPRESENTADA,
			tabela_id: t.id,
			created_at: AGORA,
			updated_at: AGORA,
			deleted_at: null,
		});
	});

	it("troca a tabela preservando id e created_at", () => {
		const existente: ClienteTabelaPreco = {
			...definir({ agora: CRIADO_EM }),
			tabela_id: crypto.randomUUID(),
		};

		const trocada = definir({ existente, id: crypto.randomUUID() });

		expect(trocada).toMatchObject({
			id: ID,
			tabela_id: t.id,
			created_at: CRIADO_EM,
			updated_at: AGORA,
		});
	});

	it("é idempotente quando a tabela já é a padrão", () => {
		const existente = definir({ agora: CRIADO_EM });
		expect(definir({ existente })).toBe(existente);
	});

	it("recusa tabela inativa ou excluída", () => {
		expect(() => definir({ tabela: { ...t, ativo: false } })).toThrow(
			TabelaPrecoNaoEncontradaError,
		);
		expect(() => definir({ tabela: { ...t, deleted_at: AGORA } })).toThrow(
			TabelaPrecoNaoEncontradaError,
		);
	});

	it("recusa tabela ou associação de outro tenant", () => {
		expect(() => definir({ tenantId: OUTRO_TENANT })).toThrow(
			TenantDivergenteError,
		);
		const deOutroTenant = { ...definir(), tenant_id: OUTRO_TENANT };
		expect(() => definir({ existente: deOutroTenant })).toThrow(
			TenantDivergenteError,
		);
	});

	it("recusa associação de outro cliente ou representada", () => {
		const existente = definir();
		expect(() =>
			definir({ existente: { ...existente, cliente_id: crypto.randomUUID() } }),
		).toThrow();
		expect(() =>
			definir({
				existente: { ...existente, representada_id: crypto.randomUUID() },
			}),
		).toThrow();
	});
});

describe("removerTabelaPadrao", () => {
	const associacao: ClienteTabelaPreco = {
		id: crypto.randomUUID(),
		tenant_id: TENANT,
		cliente_id: CLIENTE,
		representada_id: REPRESENTADA,
		tabela_id: crypto.randomUUID(),
		created_at: CRIADO_EM,
		updated_at: CRIADO_EM,
		deleted_at: null,
	};

	it("marca o tombstone", () => {
		expect(removerTabelaPadrao(associacao, TENANT, AGORA)).toEqual({
			...associacao,
			updated_at: AGORA,
			deleted_at: AGORA,
		});
	});

	it("é idempotente", () => {
		const removida = removerTabelaPadrao(associacao, TENANT, AGORA);
		expect(
			removerTabelaPadrao(removida, TENANT, "2027-01-01T00:00:00.000Z"),
		).toBe(removida);
	});

	it("recusa outro tenant", () => {
		expect(() => removerTabelaPadrao(associacao, OUTRO_TENANT, AGORA)).toThrow(
			TenantDivergenteError,
		);
	});
});
