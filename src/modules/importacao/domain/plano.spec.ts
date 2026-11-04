import { describe, expect, it } from "vitest";
import type { ItemPreco } from "../../produtos/domain/item-preco.schema";
import type { Produto } from "../../produtos/domain/produto.schema";
import type { TabelaPreco } from "../../produtos/domain/tabela-preco.schema";
import type { LinhaImportacao, OpcoesImportacao } from "./importacao.schema";
import { ImportacaoInvalidaError, planejarImportacao } from "./plano";
import { calcularPreviaImportacao, variacaoPercentual } from "./previa";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OUTRO_TENANT = "99999999-9999-4999-8999-999999999999";
const REP = "22222222-2222-4222-8222-222222222222";
const ANTES = "2026-01-01T00:00:00.000Z";
const AGORA = "2026-11-04T12:00:00.000Z";

let seq = 0;
const novoId = () => {
	seq++;
	return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
};

function produto(sku: string, extra: Partial<Produto> = {}): Produto {
	return {
		id: novoId(),
		tenant_id: TENANT,
		representada_id: REP,
		sku,
		descricao: `Produto ${sku}`,
		unidade_medida: "UN",
		multiplo_embalagem: 1,
		ativo: true,
		created_at: ANTES,
		updated_at: ANTES,
		deleted_at: null,
		...extra,
	};
}

function tabela(extra: Partial<TabelaPreco> = {}): TabelaPreco {
	return {
		id: novoId(),
		tenant_id: TENANT,
		representada_id: REP,
		nome_tabela: "Tabela 2026",
		vigencia_inicio: "2026-01-01",
		vigencia_fim: null,
		ativo: true,
		created_at: ANTES,
		updated_at: ANTES,
		deleted_at: null,
		...extra,
	};
}

function item(t: TabelaPreco, p: Produto, preco: number): ItemPreco {
	return {
		id: novoId(),
		tenant_id: TENANT,
		tabela_id: t.id,
		produto_id: p.id,
		preco_base_centavos: preco,
		desconto_maximo_permitido: 500,
		created_at: ANTES,
		updated_at: ANTES,
		deleted_at: null,
	};
}

function linha(
	numero: number,
	sku: string,
	extra: Partial<LinhaImportacao> = {},
): LinhaImportacao {
	return {
		linha: numero,
		sku,
		descricao: `Produto ${sku}`,
		unidade_medida: null,
		multiplo_embalagem: null,
		preco_centavos: null,
		...extra,
	};
}

describe("variacaoPercentual", () => {
	it("calcula em centésimos de % com half-even", () => {
		expect(variacaoPercentual(1000, 1100)).toBe(1000);
		expect(variacaoPercentual(300, 200)).toBe(-3333);
		expect(variacaoPercentual(3, 4)).toBe(3333);
		expect(variacaoPercentual(0, 100)).toBeNull();
	});
});

describe("calcularPreviaImportacao", () => {
	const existente = produto("A1");
	const inativo = produto("B1", { ativo: false });
	const ausente = produto("C1");
	const referencia = new Map([
		[existente.id, 1000],
		[inativo.id, 500],
	]);

	const previa = calcularPreviaImportacao({
		linhas: [
			linha(2, "A1", { descricao: "Novo nome", preco_centavos: 1100 }),
			linha(3, "B1", { descricao: "Produto B1", preco_centavos: 400 }),
			linha(4, "N1", { preco_centavos: 700 }),
			linha(5, "N2", { descricao: null }),
		],
		skusNoArquivo: new Set(["A1", "B1", "N1", "N2", "Z9"]),
		produtos: [existente, inativo, ausente],
		precosReferencia: referencia,
		importarPreco: true,
	});

	it("classifica cada linha", () => {
		const [a, b, n] = previa.itens;
		expect(a).toMatchObject({
			situacao: "existente",
			camposAlterados: ["descricao"],
			situacaoPreco: "subiu",
			precoAnteriorCentavos: 1000,
			variacaoCentesimos: 1000,
		});
		expect(b).toMatchObject({ situacao: "reativado", situacaoPreco: "caiu" });
		expect(n).toMatchObject({
			situacao: "novo",
			situacaoPreco: "novo",
			final: { unidade_medida: "UN", multiplo_embalagem: 1 },
		});
		expect(previa.contagem).toEqual({
			novos: 1,
			reativados: 1,
			alterados: 1,
			preco_subiu: 1,
			preco_caiu: 1,
			preco_novo: 1,
			inalterados: 0,
		});
	});

	it("produto novo sem descrição vira erro", () => {
		expect(previa.problemas).toEqual([
			{
				linha: 5,
				sku: "N2",
				gravidade: "erro",
				mensagem: "Produto novo sem descrição",
			},
		]);
	});

	it("lista ausentes ativos (inativos ausentes não contam)", () => {
		expect(previa.ausentes.map((p) => p.sku)).toEqual(["C1"]);
	});

	it("produto sem mudança é inalterado; célula vazia mantém o cadastro", () => {
		const p = produto("D1", { unidade_medida: "CX", multiplo_embalagem: 6 });
		const r = calcularPreviaImportacao({
			linhas: [linha(2, "D1", { descricao: null, preco_centavos: 900 })],
			skusNoArquivo: new Set(["D1"]),
			produtos: [p],
			precosReferencia: new Map([[p.id, 900]]),
			importarPreco: true,
		});
		expect(r.itens[0]).toMatchObject({
			camposAlterados: [],
			situacaoPreco: "igual",
			final: {
				descricao: "Produto D1",
				unidade_medida: "CX",
				multiplo_embalagem: 6,
			},
		});
		expect(r.contagem.inalterados).toBe(1);
	});
});

describe("planejarImportacao", () => {
	const base = () => {
		const a1 = produto("A1");
		const b1 = produto("B1", { ativo: false });
		const c1 = produto("C1");
		const t = tabela();
		return {
			a1,
			b1,
			c1,
			t,
			params: {
				tenantId: TENANT,
				linhas: [
					linha(2, "A1", { preco_centavos: 1100 }),
					linha(3, "B1", { preco_centavos: 400 }),
					linha(4, "N1", { preco_centavos: 700, unidade_medida: "CX" }),
				],
				skusNoArquivo: new Set(["A1", "B1", "N1"]),
				produtos: [a1, b1, c1],
				tabelas: [t],
				itensTabelaDestino: [item(t, a1, 1000), item(t, b1, 400)],
				agora: AGORA,
				gerarId: novoId,
			},
		};
	};

	const opcoes = (extra: Partial<OpcoesImportacao>): OpcoesImportacao => ({
		representada_id: REP,
		destino: null,
		ausentes: "manter",
		...extra,
	});

	it("atualiza a tabela existente: cria, reativa e grava só os preços que mudaram", () => {
		const { a1, b1, t, params } = base();
		const plano = planejarImportacao({
			...params,
			opcoes: opcoes({ destino: { tipo: "existente", tabela_id: t.id } }),
		});

		expect(plano.tabelas).toEqual([]);
		expect(plano.resumo).toEqual({
			criados: 1,
			atualizados: 0,
			reativados: 1,
			inativados: 0,
			precos_gravados: 2,
			tabela_id: t.id,
			tabela_encerrada_id: null,
		});

		const reativado = plano.produtos.find((p) => p.registro.id === b1.id);
		expect(reativado).toMatchObject({
			existiaAntes: true,
			registro: { ativo: true, updated_at: AGORA },
		});
		const novo = plano.produtos.find((p) => p.registro.sku === "N1");
		expect(novo).toMatchObject({
			existiaAntes: false,
			registro: {
				unidade_medida: "CX",
				multiplo_embalagem: 1,
				tenant_id: TENANT,
			},
		});

		const precoA1 = plano.itensPreco.find(
			(i) => i.registro.produto_id === a1.id,
		);
		// Atualiza o item existente e preserva o desconto máximo
		expect(precoA1).toMatchObject({
			existiaAntes: true,
			registro: { preco_base_centavos: 1100, desconto_maximo_permitido: 500 },
		});
		// B1 já tinha 400: não regrava
		expect(plano.itensPreco.some((i) => i.registro.produto_id === b1.id)).toBe(
			false,
		);
	});

	it("cria nova tabela e encerra a substituída na véspera", () => {
		const { t, params } = base();
		const plano = planejarImportacao({
			...params,
			itensTabelaDestino: [],
			opcoes: opcoes({
				destino: {
					tipo: "nova",
					nome_tabela: "Tabela 2027",
					vigencia_inicio: "2027-01-01",
					vigencia_fim: null,
					substitui_tabela_id: t.id,
				},
			}),
		});
		const [nova, encerrada] = plano.tabelas;
		expect(nova).toMatchObject({
			existiaAntes: false,
			registro: { nome_tabela: "Tabela 2027", vigencia_inicio: "2027-01-01" },
		});
		expect(encerrada).toMatchObject({
			existiaAntes: true,
			registro: { id: t.id, vigencia_fim: "2026-12-31" },
		});
		expect(plano.itensPreco).toHaveLength(3);
		expect(
			plano.itensPreco.every((i) => i.registro.tabela_id === nova?.registro.id),
		).toBe(true);
		expect(plano.resumo.tabela_encerrada_id).toBe(t.id);
	});

	it("inativa ausentes só quando pedido", () => {
		const { c1, t, params } = base();
		const manter = planejarImportacao({
			...params,
			opcoes: opcoes({ destino: { tipo: "existente", tabela_id: t.id } }),
		});
		expect(manter.produtos.some((p) => p.registro.id === c1.id)).toBe(false);

		const inativar = planejarImportacao({
			...params,
			opcoes: opcoes({
				destino: { tipo: "existente", tabela_id: t.id },
				ausentes: "inativar",
			}),
		});
		expect(
			inativar.produtos.find((p) => p.registro.id === c1.id)?.registro.ativo,
		).toBe(false);
		expect(inativar.resumo.inativados).toBe(1);
	});

	it("sem coluna de preço, grava só o cadastro", () => {
		const { params } = base();
		const plano = planejarImportacao({
			...params,
			linhas: [linha(2, "A1", { descricao: "Renomeado", preco_centavos: 999 })],
			opcoes: opcoes({}),
		});
		expect(plano.itensPreco).toEqual([]);
		expect(plano.resumo).toMatchObject({ atualizados: 1, tabela_id: null });
	});

	it("recusa tabela inativa, de outra representada ou nova que começa antes da substituída", () => {
		const { t, params } = base();
		const inativa = tabela({ ativo: false });
		const deOutra = tabela({
			representada_id: "33333333-3333-4333-8333-333333333333",
		});
		const comTabelas = { ...params, tabelas: [t, inativa, deOutra] };

		expect(() =>
			planejarImportacao({
				...comTabelas,
				opcoes: opcoes({
					destino: { tipo: "existente", tabela_id: inativa.id },
				}),
			}),
		).toThrow(ImportacaoInvalidaError);
		expect(() =>
			planejarImportacao({
				...comTabelas,
				opcoes: opcoes({
					destino: { tipo: "existente", tabela_id: deOutra.id },
				}),
			}),
		).toThrow(ImportacaoInvalidaError);
		expect(() =>
			planejarImportacao({
				...comTabelas,
				opcoes: opcoes({
					destino: {
						tipo: "nova",
						nome_tabela: "Velha",
						vigencia_inicio: "2026-01-01",
						vigencia_fim: null,
						substitui_tabela_id: t.id,
					},
				}),
			}),
		).toThrow(/precisa começar depois de 01\/01\/2026/);
	});

	it("recusa quando não há nada a gravar", () => {
		const { a1, t, params } = base();
		expect(() =>
			planejarImportacao({
				...params,
				linhas: [linha(2, "A1", { preco_centavos: 1000 })],
				itensTabelaDestino: [item(t, a1, 1000)],
				opcoes: opcoes({ destino: { tipo: "existente", tabela_id: t.id } }),
			}),
		).toThrow(/Nada a gravar/);
	});

	it("recusa registros de outro tenant", () => {
		const { params } = base();
		expect(() =>
			planejarImportacao({
				...params,
				produtos: [produto("X1", { tenant_id: OUTRO_TENANT })],
				opcoes: opcoes({}),
			}),
		).toThrow(/outro tenant/);
	});
});
