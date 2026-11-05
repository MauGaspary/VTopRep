import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { ClienteSchema } from "../../modules/clientes/domain/cliente.schema";
import { ClienteContatoSchema } from "../../modules/clientes/domain/cliente-contato.schema";
import { ClienteEnderecoSchema } from "../../modules/clientes/domain/cliente-endereco.schema";
import { ClienteMetricaSchema } from "../../modules/clientes/domain/cliente-metrica.schema";
import { ItemPedidoSchema } from "../../modules/pedidos/domain/item-pedido.schema";
import { PedidoSchema } from "../../modules/pedidos/domain/pedido.schema";
import { ItemPrecoSchema } from "../../modules/produtos/domain/item-preco.schema";
import { ProdutoSchema } from "../../modules/produtos/domain/produto.schema";
import { TabelaPrecoSchema } from "../../modules/produtos/domain/tabela-preco.schema";
import { RepresentadaSchema } from "../../modules/representadas/domain/representada.schema";
import { TransportadoraSchema } from "../../modules/transportadoras/domain/transportadora.schema";

/**
 * Aplica as migrações de `supabase/migrations` num PostgreSQL real (PGlite) e
 * confere RLS por tenant, papéis, integridade e a imutabilidade dos pedidos.
 * Só o schema `auth` do Supabase é simulado aqui.
 */

/** SQL de cada migração, na ordem do nome do arquivo (carimbo de data). */
const MIGRACOES: string[] = Object.entries(
	import.meta.glob("../../../supabase/migrations/*.sql", {
		query: "?raw",
		import: "default",
		eager: true,
	}),
)
	.sort(([a], [b]) => a.localeCompare(b))
	.map(([, sql]) => {
		if (typeof sql !== "string") throw new Error("Migração ilegível");
		return sql;
	});

const SIMULACAO_SUPABASE_AUTH = `
	create role anon nologin;
	create role authenticated nologin;
	create schema auth;
	create table auth.users (id uuid primary key);
	create function auth.uid() returns uuid language sql stable as
		$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
	grant usage on schema public, auth to anon, authenticated;
	grant select on auth.users to authenticated;
`;

const T1 = "00000000-0000-4000-8000-0000000000a1";
const T2 = "00000000-0000-4000-8000-0000000000a2";

const ADMIN_T1 = "00000000-0000-4000-8000-0000000000b1";
const REPRESENTANTE_T1 = "00000000-0000-4000-8000-0000000000b2";
const ADMIN_T2 = "00000000-0000-4000-8000-0000000000b3";
const SEM_ACESSO = "00000000-0000-4000-8000-0000000000b4";
const AMBOS_TENANTS = "00000000-0000-4000-8000-0000000000b5";

let db: PGlite;
let contador = 0;

/** UUID determinístico e único dentro do arquivo de teste. */
function uuid(): string {
	contador += 1;
	return `10000000-0000-4000-8000-${String(contador).padStart(12, "0")}`;
}

/** Executa como o usuário autenticado (RLS ligado) e volta ao superusuário. */
async function como<T>(userId: string, fn: () => Promise<T>): Promise<T> {
	await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
		userId,
	]);
	await db.exec("set role authenticated");
	try {
		return await fn();
	} finally {
		await db.exec("reset role");
		await db.query("select set_config('request.jwt.claim.sub', '', false)");
	}
}

interface Cadeia {
	representada: string;
	tabela: string;
	produto: string;
	cliente: string;
}

let cnpjSeq = 0;
function proximoCnpj(): string {
	cnpjSeq += 1;
	return `1122233300${String(cnpjSeq).padStart(4, "0")}`;
}

/** Cadastros mínimos de um tenant, gravados como superusuário. */
async function semearCadeia(tenant: string): Promise<Cadeia> {
	const c: Cadeia = {
		representada: uuid(),
		tabela: uuid(),
		produto: uuid(),
		cliente: uuid(),
	};
	await db.query(
		`insert into public.representadas
			(id, tenant_id, razao_social, nome_fantasia, cnpj, percentual_comissao_padrao,
			 percentual_comissao_fabrica, valor_pedido_minimo_centavos, regras_frete_padrao)
		 values ($1, $2, 'Fábrica', 'Fábrica', $3, 500, 500, 0, 'CIF')`,
		[c.representada, tenant, proximoCnpj()],
	);
	await db.query(
		`insert into public.tabelas_preco
			(id, tenant_id, representada_id, nome_tabela, vigencia_inicio)
		 values ($1, $2, $3, 'Padrão', '2026-01-01')`,
		[c.tabela, tenant, c.representada],
	);
	await db.query(
		`insert into public.produtos
			(id, tenant_id, representada_id, sku, descricao, unidade_medida)
		 values ($1, $2, $3, 'SKU-1', 'Produto', 'UN')`,
		[c.produto, tenant, c.representada],
	);
	await db.query(
		`insert into public.clientes (id, tenant_id, cnpj_cpf, razao_social)
		 values ($1, $2, $3, 'Cliente')`,
		[c.cliente, tenant, proximoCnpj()],
	);
	return c;
}

function sqlPedido(
	id: string,
	tenant: string,
	c: Cadeia,
	status: string,
	idempotencyKey: string = uuid(),
): string {
	return `insert into public.pedidos
		(id, tenant_id, cliente_id, representada_id, tabela_id, data_emissao,
		 condicao_pagamento, tipo_frete, status, valor_total_centavos,
		 comissao_projetada_centavos, idempotency_key)
		values ('${id}', '${tenant}', '${c.cliente}', '${c.representada}', '${c.tabela}',
		 now(), 'À vista', 'CIF', '${status}', 1000, 50, '${idempotencyKey}');`;
}

function sqlItem(
	id: string,
	tenant: string,
	pedido: string,
	c: Cadeia,
): string {
	return `insert into public.itens_pedido
		(id, tenant_id, pedido_id, produto_id, quantidade, preco_unitario_tabela_centavos,
		 percentual_desconto, preco_liquido_unitario_centavos, subtotal_centavos)
		values ('${id}', '${tenant}', '${pedido}', '${c.produto}', 2, 500, 0, 500, 1000);`;
}

async function contar(sql: string, params: unknown[] = []): Promise<number> {
	const r = await db.query<{ n: number | string }>(sql, params);
	return Number(r.rows[0]?.n ?? 0);
}

beforeAll(async () => {
	db = new PGlite();
	await db.exec(SIMULACAO_SUPABASE_AUTH);
	expect(MIGRACOES.length).toBeGreaterThan(0);
	for (const sql of MIGRACOES) {
		await db.exec(sql);
	}

	for (const user of [
		ADMIN_T1,
		REPRESENTANTE_T1,
		ADMIN_T2,
		SEM_ACESSO,
		AMBOS_TENANTS,
	]) {
		await db.query("insert into auth.users (id) values ($1)", [user]);
	}
	await db.query(
		`insert into public.tenants (id, slug, nome_fantasia)
		 values ($1, 'empresa-um', 'Empresa Um'), ($2, 'empresa-dois', 'Empresa Dois')`,
		[T1, T2],
	);
	const membros: [string, string, string][] = [
		[ADMIN_T1, T1, "admin"],
		[REPRESENTANTE_T1, T1, "representante"],
		[ADMIN_T2, T2, "admin"],
		[AMBOS_TENANTS, T1, "representante"],
		[AMBOS_TENANTS, T2, "representante"],
	];
	for (const [user, tenant, papel] of membros) {
		await db.query(
			"insert into public.usuarios_tenant (user_id, tenant_id, papel) values ($1, $2, $3)",
			[user, tenant, papel],
		);
	}
}, 120_000);

afterAll(async () => {
	await db.close();
});

describe("migrações Supabase: espelho dos schemas Zod", () => {
	const entidades: [string, ZodType & { shape: Record<string, unknown> }][] = [
		["representadas", RepresentadaSchema],
		["transportadoras", TransportadoraSchema],
		["clientes", ClienteSchema],
		["clientes_enderecos", ClienteEnderecoSchema],
		["clientes_contatos", ClienteContatoSchema],
		["clientes_metricas", ClienteMetricaSchema],
		["produtos", ProdutoSchema],
		["tabelas_preco", TabelaPrecoSchema],
		["itens_preco", ItemPrecoSchema],
		["pedidos", PedidoSchema],
		["itens_pedido", ItemPedidoSchema],
	];
	const SO_DO_SERVIDOR = new Set([
		"sincronizado_em",
		"criado_por",
		"created_at",
		"updated_at",
		"deleted_at",
	]);

	it.each(entidades)(
		"%s tem todas as colunas do schema Zod",
		async (tabela, schema) => {
			const r = await db.query<{ column_name: string }>(
				`select column_name from information_schema.columns
			 where table_schema = 'public' and table_name = $1`,
				[tabela],
			);
			const colunas = new Set(r.rows.map((l) => l.column_name));
			const faltando = Object.keys(schema.shape).filter((k) => !colunas.has(k));
			const extras = [...colunas].filter(
				(c) => !(c in schema.shape) && !SO_DO_SERVIDOR.has(c),
			);
			expect({ faltando, extras }).toEqual({ faltando: [], extras: [] });
		},
	);

	it("toda tabela sincronizável do app existe no servidor", async () => {
		const { ENTIDADES_SINCRONIZAVEIS } = await import(
			"../../modules/sync/domain/outbox.schema"
		);
		expect(entidades.map(([nome]) => nome).sort()).toEqual(
			[...ENTIDADES_SINCRONIZAVEIS].sort(),
		);
	});
});

describe("migrações Supabase: RLS por tenant e papéis", () => {
	it("o usuário só enxerga os dados dos seus tenants", async () => {
		const a = await semearCadeia(T1);
		const b = await semearCadeia(T2);

		const vistosPeloAdminT1 = await como(ADMIN_T1, async () =>
			(
				await db.query<{ id: string }>("select id from public.clientes")
			).rows.map((l) => l.id),
		);
		expect(vistosPeloAdminT1).toContain(a.cliente);
		expect(vistosPeloAdminT1).not.toContain(b.cliente);

		const vistosPorQuemTemOsDois = await como(AMBOS_TENANTS, async () =>
			(
				await db.query<{ id: string }>("select id from public.clientes")
			).rows.map((l) => l.id),
		);
		expect(vistosPorQuemTemOsDois).toEqual(
			expect.arrayContaining([a.cliente, b.cliente]),
		);
	});

	it("quem não é membro não enxerga nada", async () => {
		await semearCadeia(T1);
		const n = await como(SEM_ACESSO, () =>
			contar("select count(*) as n from public.clientes"),
		);
		expect(n).toBe(0);
		const tenants = await como(SEM_ACESSO, () =>
			contar("select count(*) as n from public.tenants"),
		);
		expect(tenants).toBe(0);
	});

	it("o representante grava no tenant, mas não em outro", async () => {
		await como(REPRESENTANTE_T1, () =>
			db.query(
				`insert into public.clientes (id, tenant_id, cnpj_cpf, razao_social)
				 values ($1, $2, $3, 'Novo')`,
				[uuid(), T1, proximoCnpj()],
			),
		);
		await expect(
			como(REPRESENTANTE_T1, () =>
				db.query(
					`insert into public.clientes (id, tenant_id, cnpj_cpf, razao_social)
					 values ($1, $2, $3, 'Intruso')`,
					[uuid(), T2, proximoCnpj()],
				),
			),
		).rejects.toThrow(/row-level security/);
	});

	it("UPDATE em registro de outro tenant não altera nada", async () => {
		const b = await semearCadeia(T2);
		const r = await como(ADMIN_T1, () =>
			db.query("update public.clientes set razao_social = 'X' where id = $1", [
				b.cliente,
			]),
		);
		expect(r.affectedRows).toBe(0);
	});

	it("não existe exclusão física", async () => {
		const a = await semearCadeia(T1);
		await expect(
			como(ADMIN_T1, () =>
				db.query("delete from public.clientes where id = $1", [a.cliente]),
			),
		).rejects.toThrow(/permission denied/);
	});

	it("o tenant_id de um registro não pode ser trocado", async () => {
		const a = await semearCadeia(T1);
		await expect(
			como(AMBOS_TENANTS, () =>
				db.query("update public.clientes set tenant_id = $2 where id = $1", [
					a.cliente,
					T2,
				]),
			),
		).rejects.toThrow(/tenant_id não pode ser alterado/);
	});

	it("membership inativa perde o acesso na hora", async () => {
		await semearCadeia(T1);
		await db.query(
			"update public.usuarios_tenant set ativo = false where user_id = $1 and tenant_id = $2",
			[REPRESENTANTE_T1, T1],
		);
		try {
			const n = await como(REPRESENTANTE_T1, () =>
				contar("select count(*) as n from public.clientes"),
			);
			expect(n).toBe(0);
		} finally {
			await db.query(
				"update public.usuarios_tenant set ativo = true where user_id = $1 and tenant_id = $2",
				[REPRESENTANTE_T1, T1],
			);
		}
	});

	it("tenant desativado bloqueia todos os membros", async () => {
		await semearCadeia(T2);
		await db.query("update public.tenants set ativo = false where id = $1", [
			T2,
		]);
		try {
			const n = await como(ADMIN_T2, () =>
				contar("select count(*) as n from public.clientes"),
			);
			expect(n).toBe(0);
		} finally {
			await db.query("update public.tenants set ativo = true where id = $1", [
				T2,
			]);
		}
	});

	it("só o admin gerencia membros; o representante vê só a si mesmo", async () => {
		await expect(
			como(REPRESENTANTE_T1, () =>
				db.query(
					"insert into public.usuarios_tenant (user_id, tenant_id, papel) values ($1, $2, 'representante')",
					[SEM_ACESSO, T1],
				),
			),
		).rejects.toThrow(/row-level security/);

		const doRepresentante = await como(REPRESENTANTE_T1, async () =>
			(
				await db.query<{ user_id: string }>(
					"select user_id from public.usuarios_tenant where tenant_id = $1",
					[T1],
				)
			).rows.map((l) => l.user_id),
		);
		expect(doRepresentante).toEqual([REPRESENTANTE_T1]);

		const doAdmin = await como(ADMIN_T1, async () =>
			(
				await db.query<{ user_id: string }>(
					"select user_id from public.usuarios_tenant where tenant_id = $1",
					[T1],
				)
			).rows.map((l) => l.user_id),
		);
		expect(doAdmin).toEqual(
			expect.arrayContaining([ADMIN_T1, REPRESENTANTE_T1, AMBOS_TENANTS]),
		);

		await como(ADMIN_T1, () =>
			db.query(
				"insert into public.usuarios_tenant (user_id, tenant_id, papel) values ($1, $2, 'representante')",
				[SEM_ACESSO, T1],
			),
		);
		await db.query("delete from public.usuarios_tenant where user_id = $1", [
			SEM_ACESSO,
		]);
	});

	it("o admin não gerencia membros de outro tenant", async () => {
		await expect(
			como(ADMIN_T1, () =>
				db.query(
					"insert into public.usuarios_tenant (user_id, tenant_id, papel) values ($1, $2, 'admin')",
					[SEM_ACESSO, T2],
				),
			),
		).rejects.toThrow(/row-level security/);
	});

	it("anon não lê nem grava", async () => {
		await db.exec("set role anon");
		try {
			await expect(db.query("select 1 from public.clientes")).rejects.toThrow(
				/permission denied/,
			);
		} finally {
			await db.exec("reset role");
		}
	});
});

describe("migrações Supabase: integridade", () => {
	it("recusa referência a registro de outro tenant", async () => {
		const a = await semearCadeia(T1);
		const b = await semearCadeia(T2);
		await expect(
			db.exec(sqlPedido(uuid(), T1, { ...a, cliente: b.cliente }, "rascunho")),
		).rejects.toThrow(/foreign key/);
	});

	it("aceita filho antes do pai na mesma transação (FK deferida)", async () => {
		const a = await semearCadeia(T1);
		const pedido = uuid();
		await db.exec(
			`${sqlItem(uuid(), T1, pedido, a)}${sqlPedido(pedido, T1, a, "rascunho")}`,
		);
		expect(
			await contar(
				"select count(*) as n from public.itens_pedido where pedido_id = $1",
				[pedido],
			),
		).toBe(1);
	});

	it("CNPJ e SKU repetidos só valem depois do tombstone", async () => {
		const a = await semearCadeia(T1);
		const inserirProduto = () =>
			db.query(
				`insert into public.produtos
					(id, tenant_id, representada_id, sku, descricao, unidade_medida)
				 values ($1, $2, $3, 'SKU-1', 'Outro', 'UN')`,
				[uuid(), T1, a.representada],
			);
		await expect(inserirProduto()).rejects.toThrow(/duplicate key/);
		await db.query(
			"update public.produtos set deleted_at = now() where id = $1",
			[a.produto],
		);
		await inserirProduto();
	});

	it("o mesmo SKU pode existir em outra representada", async () => {
		const a = await semearCadeia(T1);
		const outra = uuid();
		await db.query(
			`insert into public.representadas
				(id, tenant_id, razao_social, nome_fantasia, cnpj, percentual_comissao_padrao,
				 percentual_comissao_fabrica, valor_pedido_minimo_centavos, regras_frete_padrao)
			 values ($1, $2, 'Outra', 'Outra', $3, 0, 0, 0, 'FOB')`,
			[outra, T1, proximoCnpj()],
		);
		await db.query(
			`insert into public.produtos
				(id, tenant_id, representada_id, sku, descricao, unidade_medida)
			 values ($1, $2, $3, 'SKU-1', 'Mesmo código', 'UN')`,
			[uuid(), T1, outra],
		);
		expect(a.representada).not.toBe(outra);
	});

	it("recusa dinheiro negativo, SKU sem normalizar e subtotal incoerente", async () => {
		const a = await semearCadeia(T1);
		await expect(
			db.query(
				`insert into public.produtos
					(id, tenant_id, representada_id, sku, descricao, unidade_medida)
				 values ($1, $2, $3, 'minusculo', 'X', 'UN')`,
				[uuid(), T1, a.representada],
			),
		).rejects.toThrow(/check constraint/);

		const pedido = uuid();
		await db.exec(sqlPedido(pedido, T1, a, "rascunho"));
		await expect(
			db.exec(sqlItem(uuid(), T1, pedido, a).replace("1000);", "999);")),
		).rejects.toThrow(/check constraint/);
	});

	it("carimba sincronizado_em a cada gravação (checkpoint do pull)", async () => {
		const a = await semearCadeia(T1);
		const antes = await db.query<{ t: string }>(
			"select sincronizado_em::text as t from public.clientes where id = $1",
			[a.cliente],
		);
		await db.query(
			"update public.clientes set updated_at = '2000-01-01T00:00:00Z' where id = $1",
			[a.cliente],
		);
		const depois = await db.query<{ t: string }>(
			"select sincronizado_em::text as t from public.clientes where id = $1",
			[a.cliente],
		);
		expect(depois.rows[0]?.t).not.toBe(antes.rows[0]?.t);
	});
});

describe("migrações Supabase: imutabilidade dos pedidos emitidos", () => {
	it("rascunho é editável, e criado_por vem do usuário e não muda", async () => {
		const a = await semearCadeia(T1);
		const pedido = uuid();
		await como(ADMIN_T1, () => db.exec(sqlPedido(pedido, T1, a, "rascunho")));
		await como(ADMIN_T1, () =>
			db.query(
				"update public.pedidos set valor_total_centavos = 2000, criado_por = $2 where id = $1",
				[pedido, REPRESENTANTE_T1],
			),
		);
		const r = await db.query<{ valor: string; criado_por: string }>(
			"select valor_total_centavos::text as valor, criado_por from public.pedidos where id = $1",
			[pedido],
		);
		expect(r.rows[0]).toEqual({ valor: "2000", criado_por: ADMIN_T1 });
	});

	it("emitir e regravar os itens na mesma transação funciona", async () => {
		const a = await semearCadeia(T1);
		const pedido = uuid();
		const item = uuid();
		await db.exec(
			`${sqlPedido(pedido, T1, a, "rascunho")}${sqlItem(item, T1, pedido, a)}`,
		);
		await db.exec(
			`update public.pedidos set status = 'emitido', valor_total_centavos = 1500, idempotency_key = '${uuid()}' where id = '${pedido}';
			 update public.itens_pedido set quantidade = 3, subtotal_centavos = 1500 where id = '${item}';
			 ${sqlItem(uuid(), T1, pedido, a)}`,
		);
		const r = await db.query<{ status: string }>(
			"select status from public.pedidos where id = $1",
			[pedido],
		);
		expect(r.rows[0]?.status).toBe("emitido");
	});

	it("pedido já emitido recusa mudança comercial, itens, exclusão e retrocesso", async () => {
		const a = await semearCadeia(T1);
		const pedido = uuid();
		const item = uuid();
		await db.exec(
			`${sqlPedido(pedido, T1, a, "emitido")}${sqlItem(item, T1, pedido, a)}`,
		);

		await expect(
			db.query(
				"update public.pedidos set valor_total_centavos = 1 where id = $1",
				[pedido],
			),
		).rejects.toThrow(/somente-leitura/);
		await expect(
			db.query("update public.pedidos set observacoes = 'x' where id = $1", [
				pedido,
			]),
		).rejects.toThrow(/somente-leitura/);
		await expect(
			db.query("update public.pedidos set deleted_at = now() where id = $1", [
				pedido,
			]),
		).rejects.toThrow(/somente-leitura/);
		await expect(
			db.query(
				"update public.itens_pedido set quantidade = 5, subtotal_centavos = 2500 where id = $1",
				[item],
			),
		).rejects.toThrow(/itens são somente-leitura/);
		await expect(db.exec(sqlItem(uuid(), T1, pedido, a))).rejects.toThrow(
			/itens são somente-leitura/,
		);
		await expect(
			db.query("update public.pedidos set status = 'rascunho' where id = $1", [
				pedido,
			]),
		).rejects.toThrow(/Transição de status inválida/);
	});

	it("reenvio da mesma mutação (sem mudança comercial) é aceito", async () => {
		const a = await semearCadeia(T1);
		const pedido = uuid();
		await db.exec(sqlPedido(pedido, T1, a, "emitido"));
		await db.query(
			"update public.pedidos set status = status, updated_at = now() where id = $1",
			[pedido],
		);
	});

	it("segue o funil de faturamento e para nos estados finais", async () => {
		const a = await semearCadeia(T1);
		const pedido = uuid();
		await db.exec(sqlPedido(pedido, T1, a, "emitido"));
		const mudar = (status: string) =>
			db.query("update public.pedidos set status = $2 where id = $1", [
				pedido,
				status,
			]);

		await mudar("parcialmente_faturado");
		await expect(mudar("emitido")).rejects.toThrow(/Transição/);
		await mudar("faturado_total");
		await expect(mudar("cancelado")).rejects.toThrow(/Transição/);
	});

	it("emitido pode ser cancelado, e cancelado é final", async () => {
		const a = await semearCadeia(T1);
		const pedido = uuid();
		await db.exec(sqlPedido(pedido, T1, a, "emitido"));
		await db.query(
			"update public.pedidos set status = 'cancelado' where id = $1",
			[pedido],
		);
		await expect(
			db.query("update public.pedidos set status = 'emitido' where id = $1", [
				pedido,
			]),
		).rejects.toThrow(/Transição/);
	});
});
