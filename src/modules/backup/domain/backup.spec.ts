import { describe, expect, it } from "vitest";
import { criarMutacaoParaRegistro } from "../../sync/domain/outbox";
import type { Transportadora } from "../../transportadoras/domain/transportadora.schema";
import {
	BackupInvalidoError,
	contarRegistrosBackup,
	lerArquivoBackup,
	montarBackup,
	nomeArquivoBackup,
	serializarBackup,
	tabelasParaRestaurar,
	totalRegistros,
	verificarIntegridadeBackup,
} from "./backup";
import {
	type BackupLocal,
	FORMATO_BACKUP,
	TABELAS_BACKUP,
	type TabelasBackup,
	VERSAO_FORMATO_BACKUP,
} from "./backup.schema";

const TENANT = "11111111-1111-4111-a111-111111111111";
const OUTRO_TENANT = "22222222-2222-4222-a222-222222222222";
const AGORA = "2026-11-04T15:30:00.000Z";
const VERSAO_BANCO = 11;

function transportadora(
	overrides: Partial<Transportadora> = {},
): Transportadora {
	return {
		id: "33333333-3333-4333-a333-333333333333",
		tenant_id: TENANT,
		nome_fantasia: "Rodo Sul",
		razao_social: null,
		cnpj: null,
		telefone: null,
		cidade_uf: "Caxias do Sul/RS",
		ativo: true,
		created_at: AGORA,
		updated_at: AGORA,
		deleted_at: null,
		...overrides,
	};
}

function tabelasVazias(): TabelasBackup {
	return {
		representadas: [],
		transportadoras: [],
		clientes: [],
		clientes_enderecos: [],
		clientes_contatos: [],
		clientes_metricas: [],
		produtos: [],
		tabelas_preco: [],
		itens_preco: [],
		pedidos: [],
		itens_pedido: [],
		outbox: [],
		mapeamentos_importacao: [],
	};
}

function tabelasExemplo(): TabelasBackup {
	const registro = transportadora();
	return {
		...tabelasVazias(),
		transportadoras: [registro],
		outbox: [
			criarMutacaoParaRegistro({
				id: "44444444-4444-4444-a444-444444444444",
				idempotencyKey: "55555555-5555-4555-a555-555555555555",
				tenantId: TENANT,
				entity: "transportadoras",
				registro,
				existiaAntes: false,
				agora: AGORA,
			}),
		],
		mapeamentos_importacao: [
			{
				tenant_id: TENANT,
				representada_id: "66666666-6666-4666-a666-666666666666",
				colunas: {
					sku: "Código",
					descricao: "Descrição",
					unidade_medida: null,
					multiplo_embalagem: null,
					preco: "Preço",
				},
				updated_at: AGORA,
			},
		],
	};
}

function backupExemplo(tabelas: TabelasBackup = tabelasExemplo()): BackupLocal {
	return montarBackup({
		tenantId: TENANT,
		tenantNome: "Vinitop RS",
		versaoBanco: VERSAO_BANCO,
		agora: AGORA,
		tabelas,
	});
}

const ler = (texto: string) =>
	lerArquivoBackup(texto, { tenantId: TENANT, versaoBanco: VERSAO_BANCO });

function erroDe(texto: string): string {
	const resultado = ler(texto);
	if (resultado.ok) throw new Error("esperava recusa do backup");
	return resultado.erro;
}

/** Backup serializado com partes do JSON trocadas (arquivo "editado"). */
function arquivoAlterado(alterar: (json: Record<string, unknown>) => void) {
	const json: Record<string, unknown> = JSON.parse(
		serializarBackup(backupExemplo()),
	);
	alterar(json);
	return JSON.stringify(json);
}

describe("montarBackup", () => {
	it("monta o cabeçalho versionado e mantém todas as tabelas", () => {
		const backup = backupExemplo();

		expect(backup).toMatchObject({
			formato: FORMATO_BACKUP,
			versao_formato: VERSAO_FORMATO_BACKUP,
			versao_banco: VERSAO_BANCO,
			tenant_id: TENANT,
			tenant_nome: "Vinitop RS",
			exportado_em: AGORA,
		});
		expect(Object.keys(backup.tabelas).sort()).toEqual(
			[...TABELAS_BACKUP].sort(),
		);
		expect(backup.tabelas.outbox[0]?.status).toBe("pending");
	});

	it("recusa registro local inválido apontando tabela, linha e campo", () => {
		const tabelas = {
			...tabelasVazias(),
			transportadoras: [transportadora(), { ...transportadora(), id: "x" }],
		};
		expect(() => backupExemplo(tabelas)).toThrow(BackupInvalidoError);
		expect(() => backupExemplo(tabelas)).toThrow(
			/Transportadoras, registro 2 \(id\)/,
		);
	});

	it("recusa registro de outro tenant e tenantId inválido", () => {
		const tabelas = {
			...tabelasVazias(),
			transportadoras: [transportadora({ tenant_id: OUTRO_TENANT })],
		};
		expect(() => backupExemplo(tabelas)).toThrow(/outra empresa/);
		expect(() =>
			montarBackup({
				tenantId: "abc",
				tenantNome: "",
				versaoBanco: VERSAO_BANCO,
				agora: AGORA,
				tabelas: tabelasVazias(),
			}),
		).toThrow();
	});
});

describe("lerArquivoBackup", () => {
	it("aceita o próprio arquivo exportado (ida e volta pelo JSON)", () => {
		const backup = backupExemplo();
		const resultado = ler(serializarBackup(backup));

		expect(resultado).toEqual({ ok: true, backup });
	});

	it("recusa conteúdo que não é JSON ou não é backup", () => {
		expect(erroDe("não é json")).toMatch(/ilegível/);
		expect(erroDe("{}")).toMatch(/não é um backup/);
		expect(erroDe("[]")).toMatch(/não é um backup/);
		expect(
			erroDe(arquivoAlterado((j) => Object.assign(j, { formato: "outro" }))),
		).toMatch(/não é um backup/);
	});

	it("recusa backup de outro tenant, mostrando o nome da empresa", () => {
		const erro = erroDe(
			arquivoAlterado((j) =>
				Object.assign(j, {
					tenant_id: OUTRO_TENANT,
					tenant_nome: "Outra Representação",
				}),
			),
		);
		expect(erro).toMatch(/outra empresa \(Outra Representação\)/);
	});

	it("recusa versão do banco anterior ou mais nova", () => {
		expect(
			erroDe(arquivoAlterado((j) => Object.assign(j, { versao_banco: 10 }))),
		).toMatch(/versão anterior do app \(banco v10; este aparelho usa v11\)/);
		expect(
			erroDe(arquivoAlterado((j) => Object.assign(j, { versao_banco: 12 }))),
		).toMatch(/versão mais nova do app.*Atualize/);
	});

	it("recusa formato de arquivo mais novo", () => {
		expect(
			erroDe(arquivoAlterado((j) => Object.assign(j, { versao_formato: 2 }))),
		).toMatch(/versão mais nova do app/);
	});

	it("valida o arquivo inteiro: um registro inválido recusa tudo", () => {
		const erro = erroDe(
			arquivoAlterado((j) => {
				const tabelas = tabelasExemplo();
				Object.assign(j, {
					tabelas: {
						...tabelas,
						transportadoras: [{ ...transportadora(), nome_fantasia: "" }],
					},
				});
			}),
		);
		expect(erro).toMatch(/Transportadoras, registro 1 \(nome_fantasia\)/);
	});

	it("recusa tabela ausente no arquivo", () => {
		const erro = erroDe(
			arquivoAlterado((j) => {
				const { pedidos: _pedidos, ...semPedidos } = tabelasExemplo();
				Object.assign(j, { tabelas: semPedidos });
			}),
		);
		expect(erro).toMatch(/Orçamentos e pedidos/);
	});

	it("recusa registro de outro tenant escondido numa tabela", () => {
		const erro = erroDe(
			arquivoAlterado((j) => {
				Object.assign(j, {
					tabelas: {
						...tabelasExemplo(),
						transportadoras: [transportadora({ tenant_id: OUTRO_TENANT })],
					},
				});
			}),
		);
		expect(erro).toMatch(/Transportadoras: o registro 1 pertence a outra/);
	});

	it("recusa chave repetida na mesma tabela", () => {
		const erro = erroDe(
			arquivoAlterado((j) => {
				Object.assign(j, {
					tabelas: {
						...tabelasExemplo(),
						transportadoras: [transportadora(), transportadora()],
					},
				});
			}),
		);
		expect(erro).toMatch(/registro 2 está repetido/);
	});
});

describe("verificarIntegridadeBackup", () => {
	it("usa a chave composta do mapeamento de CSV", () => {
		const tabelas = tabelasExemplo();
		const [mapeamento] = tabelas.mapeamentos_importacao;
		if (!mapeamento) throw new Error("fixture sem mapeamento");

		expect(verificarIntegridadeBackup(tabelas, TENANT)).toBeNull();
		expect(
			verificarIntegridadeBackup(
				{
					...tabelas,
					mapeamentos_importacao: [
						mapeamento,
						{
							...mapeamento,
							representada_id: "77777777-7777-4777-a777-777777777777",
						},
					],
				},
				TENANT,
			),
		).toBeNull();
		expect(
			verificarIntegridadeBackup(
				{ ...tabelas, mapeamentos_importacao: [mapeamento, mapeamento] },
				TENANT,
			),
		).toMatch(/repetido/);
	});
});

describe("tabelasParaRestaurar", () => {
	it("devolve à fila as mutações que estavam em envio", () => {
		const tabelas = tabelasExemplo();
		const [mutacao] = tabelas.outbox;
		if (!mutacao) throw new Error("fixture sem mutação");
		const backup = backupExemplo({
			...tabelas,
			outbox: [
				{ ...mutacao, status: "syncing" },
				{
					...mutacao,
					id: "88888888-8888-4888-a888-888888888888",
					status: "failed",
					retry_count: 2,
					last_error: "timeout",
				},
			],
		});

		const restaurar = tabelasParaRestaurar(backup);

		expect(restaurar.outbox.map((m) => m.status)).toEqual([
			"pending",
			"failed",
		]);
		expect(restaurar.outbox[1]).toMatchObject({
			retry_count: 2,
			last_error: "timeout",
		});
	});
});

describe("contagem", () => {
	it("conta os registros por tabela e no total", () => {
		const contagem = contarRegistrosBackup(tabelasExemplo());

		expect(contagem.transportadoras).toBe(1);
		expect(contagem.outbox).toBe(1);
		expect(contagem.mapeamentos_importacao).toBe(1);
		expect(contagem.pedidos).toBe(0);
		expect(totalRegistros(contagem)).toBe(3);
	});
});

describe("nomeArquivoBackup", () => {
	it("usa o slug sem acentos e a data e hora locais", () => {
		const instante = new Date(2026, 10, 4, 9, 5);
		expect(nomeArquivoBackup("exemplo", instante)).toBe(
			"backup-exemplo-2026-11-04-0905.json",
		);
		expect(nomeArquivoBackup("Representações São João", instante)).toBe(
			"backup-representacoes-sao-joao-2026-11-04-0905.json",
		);
		expect(nomeArquivoBackup("***", instante)).toBe(
			"backup-dados-2026-11-04-0905.json",
		);
	});
});
