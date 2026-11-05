-- Fase 2.11.1: tabelas de negócio espelhando os schemas Zod de `src/modules/*`.
--
-- Convenções:
--  * Dinheiro em `bigint` de centavos; percentuais em `integer` de centésimos de %.
--  * `created_at`, `updated_at` e `deleted_at` vêm do aparelho (LWW por registro).
--  * `sincronizado_em` é preenchido pelo servidor a cada gravação e é o
--    checkpoint do pull (2.11.4): `updated_at` do aparelho não serve, porque um
--    aparelho offline pode enviar hoje uma edição com `updated_at` de ontem.
--  * Chaves estrangeiras compostas `(tenant_id, id)` impedem apontar para um
--    registro de outro tenant. São `deferrable initially deferred` para o
--    servidor aceitar pai e filhos na mesma transação em qualquer ordem.
--  * Unicidade só entre registros vivos (`deleted_at is null`), como no PRD 2.1.

-- ---------------------------------------------------------------------------
-- Representadas
-- ---------------------------------------------------------------------------
create table public.representadas (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	razao_social text not null check (btrim(razao_social) <> ''),
	nome_fantasia text not null check (btrim(nome_fantasia) <> ''),
	cnpj text not null check (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
	percentual_comissao_padrao integer not null
		check (percentual_comissao_padrao between 0 and 10000),
	percentual_comissao_fabrica integer not null
		check (percentual_comissao_fabrica between 0 and 10000),
	percentual_comissao_revenda integer
		check (percentual_comissao_revenda between 0 and 10000),
	valor_pedido_minimo_centavos bigint not null
		check (valor_pedido_minimo_centavos >= 0),
	regras_frete_padrao text not null
		check (regras_frete_padrao in ('CIF', 'FOB', 'FOB_REDESPACHO')),
	cor text
		check (cor in ('indigo', 'emerald', 'amber', 'rose', 'cyan', 'violet', 'blue', 'orange')),
	ativo boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	unique (tenant_id, id)
);
create unique index representadas_cnpj_uq
	on public.representadas (tenant_id, cnpj) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Transportadoras
-- ---------------------------------------------------------------------------
create table public.transportadoras (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	nome_fantasia text not null check (btrim(nome_fantasia) <> ''),
	razao_social text check (btrim(razao_social) <> ''),
	cnpj text check (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
	telefone text check (btrim(telefone) <> ''),
	cidade_uf text check (btrim(cidade_uf) <> ''),
	ativo boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	unique (tenant_id, id)
);
create unique index transportadoras_cnpj_uq
	on public.transportadoras (tenant_id, cnpj)
	where deleted_at is null and cnpj is not null;

-- ---------------------------------------------------------------------------
-- Clientes (CRM base)
-- ---------------------------------------------------------------------------
create table public.clientes (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	cnpj_cpf text not null check (cnpj_cpf ~ '^([A-Z0-9]{11}|[A-Z0-9]{14})$'),
	razao_social text not null check (btrim(razao_social) <> ''),
	nome_fantasia text,
	tipo_cliente text not null default 'REVENDA'
		check (tipo_cliente in ('REVENDA', 'FABRICA')),
	transportadora_padrao_id uuid,
	ativo boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	unique (tenant_id, id),
	foreign key (tenant_id, transportadora_padrao_id)
		references public.transportadoras (tenant_id, id)
		deferrable initially deferred
);
create unique index clientes_cnpj_cpf_uq
	on public.clientes (tenant_id, cnpj_cpf) where deleted_at is null;

create table public.clientes_enderecos (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	cliente_id uuid not null,
	tipo_endereco text not null
		check (tipo_endereco in ('PRINCIPAL', 'ENTREGA', 'COBRANCA')),
	endereco_completo text not null check (btrim(endereco_completo) <> ''),
	latitude double precision,
	longitude double precision,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	unique (tenant_id, id),
	foreign key (tenant_id, cliente_id)
		references public.clientes (tenant_id, id)
		deferrable initially deferred
);
create index clientes_enderecos_cliente_idx
	on public.clientes_enderecos (tenant_id, cliente_id);

create table public.clientes_contatos (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	cliente_id uuid not null,
	nome text not null check (btrim(nome) <> ''),
	papel text check (papel in ('COMPRADOR', 'FINANCEIRO', 'DIRETORIA')),
	telefone_whatsapp text not null check (btrim(telefone_whatsapp) <> ''),
	email text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	unique (tenant_id, id),
	foreign key (tenant_id, cliente_id)
		references public.clientes (tenant_id, id)
		deferrable initially deferred
);
create index clientes_contatos_cliente_idx
	on public.clientes_contatos (tenant_id, cliente_id);

-- Projeção/cache da Fase 4 (sem `id` próprio: a chave é o cliente).
create table public.clientes_metricas (
	cliente_id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	data_ultima_compra date,
	frequencia_recompra_dias integer not null default 30
		check (frequencia_recompra_dias > 0),
	curva_abc text check (curva_abc in ('A', 'B', 'C')),
	ticket_medio_centavos bigint not null default 0
		check (ticket_medio_centavos >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	foreign key (tenant_id, cliente_id)
		references public.clientes (tenant_id, id)
		deferrable initially deferred
);

-- ---------------------------------------------------------------------------
-- Produtos, tabelas de preço e itens de preço
-- ---------------------------------------------------------------------------
create table public.produtos (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	representada_id uuid not null,
	sku text not null
		check (sku <> '' and sku = btrim(sku) and sku = upper(sku)),
	descricao text not null check (descricao <> ''),
	unidade_medida text not null check (unidade_medida <> ''),
	multiplo_embalagem integer not null default 1 check (multiplo_embalagem > 0),
	ativo boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	unique (tenant_id, id),
	foreign key (tenant_id, representada_id)
		references public.representadas (tenant_id, id)
		deferrable initially deferred
);
-- O SKU é único por representada (fábricas diferentes podem repetir o código).
create unique index produtos_sku_uq
	on public.produtos (tenant_id, representada_id, sku) where deleted_at is null;

create table public.tabelas_preco (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	representada_id uuid not null,
	nome_tabela text not null check (nome_tabela <> ''),
	vigencia_inicio date not null,
	vigencia_fim date,
	ativo boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
	unique (tenant_id, id),
	foreign key (tenant_id, representada_id)
		references public.representadas (tenant_id, id)
		deferrable initially deferred
);
create index tabelas_preco_representada_idx
	on public.tabelas_preco (tenant_id, representada_id);

create table public.itens_preco (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	tabela_id uuid not null,
	produto_id uuid not null,
	preco_base_centavos bigint not null check (preco_base_centavos >= 0),
	desconto_maximo_permitido integer not null default 0
		check (desconto_maximo_permitido between 0 and 10000),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	foreign key (tenant_id, tabela_id)
		references public.tabelas_preco (tenant_id, id)
		deferrable initially deferred,
	foreign key (tenant_id, produto_id)
		references public.produtos (tenant_id, id)
		deferrable initially deferred
);
-- Um preço vivo por produto em cada tabela.
create unique index itens_preco_produto_uq
	on public.itens_preco (tenant_id, tabela_id, produto_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Pedidos e itens
-- ---------------------------------------------------------------------------
create table public.pedidos (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	cotacao_grupo_id uuid,
	cliente_id uuid not null,
	representada_id uuid not null,
	tabela_id uuid not null,
	endereco_entrega_id uuid,
	contato_id uuid,
	transportadora_id uuid,
	data_emissao timestamptz not null,
	condicao_pagamento text not null check (btrim(condicao_pagamento) <> ''),
	tipo_frete text not null check (tipo_frete in ('CIF', 'FOB', 'FOB_REDESPACHO')),
	status text not null check (
		status in ('rascunho', 'emitido', 'parcialmente_faturado', 'faturado_total', 'cancelado')
	),
	valor_total_centavos bigint not null check (valor_total_centavos >= 0),
	comissao_projetada_centavos bigint not null
		check (comissao_projetada_centavos >= 0),
	observacoes text,
	idempotency_key uuid not null,
	-- Quem criou o pedido, só informativo; o servidor preenche e não aceita troca.
	criado_por uuid default auth.uid() references auth.users (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	unique (tenant_id, id),
	unique (tenant_id, idempotency_key),
	foreign key (tenant_id, cliente_id)
		references public.clientes (tenant_id, id)
		deferrable initially deferred,
	foreign key (tenant_id, representada_id)
		references public.representadas (tenant_id, id)
		deferrable initially deferred,
	foreign key (tenant_id, tabela_id)
		references public.tabelas_preco (tenant_id, id)
		deferrable initially deferred,
	foreign key (tenant_id, endereco_entrega_id)
		references public.clientes_enderecos (tenant_id, id)
		deferrable initially deferred,
	foreign key (tenant_id, contato_id)
		references public.clientes_contatos (tenant_id, id)
		deferrable initially deferred,
	foreign key (tenant_id, transportadora_id)
		references public.transportadoras (tenant_id, id)
		deferrable initially deferred
);
create index pedidos_cliente_idx on public.pedidos (tenant_id, cliente_id);
create index pedidos_cotacao_idx
	on public.pedidos (tenant_id, cotacao_grupo_id) where cotacao_grupo_id is not null;

create table public.itens_pedido (
	id uuid primary key,
	tenant_id uuid not null references public.tenants (id),
	pedido_id uuid not null,
	produto_id uuid not null,
	quantidade integer not null check (quantidade > 0),
	preco_unitario_tabela_centavos bigint not null
		check (preco_unitario_tabela_centavos >= 0),
	percentual_desconto integer not null check (percentual_desconto between 0 and 10000),
	preco_liquido_unitario_centavos bigint not null
		check (preco_liquido_unitario_centavos >= 0),
	subtotal_centavos bigint not null check (subtotal_centavos >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz,
	sincronizado_em timestamptz not null default clock_timestamp(),
	-- Subtotal = quantidade x preço líquido (sem novo arredondamento).
	check (subtotal_centavos = quantidade * preco_liquido_unitario_centavos),
	foreign key (tenant_id, pedido_id)
		references public.pedidos (tenant_id, id)
		deferrable initially deferred,
	foreign key (tenant_id, produto_id)
		references public.produtos (tenant_id, id)
		deferrable initially deferred
);
create index itens_pedido_pedido_idx on public.itens_pedido (tenant_id, pedido_id);

-- ---------------------------------------------------------------------------
-- Comum às tabelas sincronizáveis: checkpoint do pull, tenant fixo, RLS e grants
-- ---------------------------------------------------------------------------
create function public.definir_sincronizado_em()
returns trigger
language plpgsql
as $$
begin
	new.sincronizado_em := clock_timestamp();
	return new;
end
$$;

create function public.impedir_troca_de_tenant()
returns trigger
language plpgsql
as $$
begin
	if new.tenant_id is distinct from old.tenant_id then
		raise exception 'tenant_id não pode ser alterado (tabela %)', tg_table_name
			using errcode = 'check_violation';
	end if;
	return new;
end
$$;

do $$
declare
	tabela text;
begin
	foreach tabela in array array[
		'representadas', 'transportadoras', 'clientes', 'clientes_enderecos',
		'clientes_contatos', 'clientes_metricas', 'produtos', 'tabelas_preco',
		'itens_preco', 'pedidos', 'itens_pedido'
	]
	loop
		execute format(
			'create index %I on public.%I (tenant_id, sincronizado_em)',
			tabela || '_sync_idx', tabela
		);
		execute format(
			'create trigger %I before insert or update on public.%I
			 for each row execute function public.definir_sincronizado_em()',
			tabela || '_sincronizado_em', tabela
		);
		execute format(
			'create trigger %I before update on public.%I
			 for each row execute function public.impedir_troca_de_tenant()',
			tabela || '_tenant_fixo', tabela
		);

		execute format('alter table public.%I enable row level security', tabela);
		execute format('revoke all on public.%I from anon, authenticated', tabela);
		-- Sem `delete`: a exclusão é lógica (`deleted_at`).
		execute format('grant select, insert, update on public.%I to authenticated', tabela);

		execute format(
			'create policy isolamento_select on public.%I for select to authenticated
			 using (tenant_id in (select public.tenant_ids_do_usuario()))',
			tabela
		);
		execute format(
			'create policy isolamento_insert on public.%I for insert to authenticated
			 with check (tenant_id in (select public.tenant_ids_do_usuario()))',
			tabela
		);
		execute format(
			'create policy isolamento_update on public.%I for update to authenticated
			 using (tenant_id in (select public.tenant_ids_do_usuario()))
			 with check (tenant_id in (select public.tenant_ids_do_usuario()))',
			tabela
		);
	end loop;
end
$$;
