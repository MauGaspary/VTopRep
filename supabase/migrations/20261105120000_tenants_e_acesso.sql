-- Fase 2.11.1: tenants, membros e funções de acesso usadas pelo RLS.
--
-- Decisões (conversa de 2026-11-05):
--  * O acesso vem da tabela `usuarios_tenant` (não de claim no JWT): revogar um
--    usuário vale na hora e um usuário pode pertencer a mais de um tenant.
--  * Papéis: `admin` (inclui tudo do representante, mais gestão de usuários) e
--    `representante`.
--  * Dentro do tenant tudo é compartilhado: o RLS filtra só por `tenant_id`.

create table public.tenants (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique
		check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	nome_fantasia text not null check (btrim(nome_fantasia) <> ''),
	ativo boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.usuarios_tenant (
	user_id uuid not null references auth.users (id) on delete cascade,
	tenant_id uuid not null references public.tenants (id),
	papel text not null check (papel in ('admin', 'representante')),
	ativo boolean not null default true,
	created_at timestamptz not null default now(),
	primary key (user_id, tenant_id)
);

create index usuarios_tenant_tenant_idx on public.usuarios_tenant (tenant_id);

-- Tenants em que o usuário autenticado pode trabalhar. `security definer` para
-- ler `usuarios_tenant` sem passar pelo próprio RLS (evita recursão) e
-- `set search_path = ''` para não aceitar objetos de outro schema.
create function public.tenant_ids_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
	select ut.tenant_id
	from public.usuarios_tenant ut
	join public.tenants t on t.id = ut.tenant_id and t.ativo
	where ut.user_id = (select auth.uid()) and ut.ativo
$$;

-- Tenants em que o usuário autenticado é administrador.
create function public.tenant_ids_admin_do_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
	select ut.tenant_id
	from public.usuarios_tenant ut
	join public.tenants t on t.id = ut.tenant_id and t.ativo
	where ut.user_id = (select auth.uid()) and ut.ativo and ut.papel = 'admin'
$$;

revoke all on function public.tenant_ids_do_usuario() from public, anon;
revoke all on function public.tenant_ids_admin_do_usuario() from public, anon;
grant execute on function public.tenant_ids_do_usuario() to authenticated;
grant execute on function public.tenant_ids_admin_do_usuario() to authenticated;

alter table public.tenants enable row level security;
alter table public.usuarios_tenant enable row level security;

revoke all on public.tenants, public.usuarios_tenant from anon, authenticated;
grant select on public.tenants to authenticated;
grant select, insert, update on public.usuarios_tenant to authenticated;

-- Tenants são criados e alterados só pelo painel/serviço (sem política de escrita).
create policy tenants_select on public.tenants
	for select to authenticated
	using (id in (select public.tenant_ids_do_usuario()));

-- Cada um vê as próprias participações; o admin vê todas as do tenant.
create policy usuarios_tenant_select on public.usuarios_tenant
	for select to authenticated
	using (
		user_id = (select auth.uid())
		or tenant_id in (select public.tenant_ids_admin_do_usuario())
	);

-- Só o admin convida e altera membros. Nada é apagado: use `ativo = false`.
create policy usuarios_tenant_insert on public.usuarios_tenant
	for insert to authenticated
	with check (tenant_id in (select public.tenant_ids_admin_do_usuario()));

create policy usuarios_tenant_update on public.usuarios_tenant
	for update to authenticated
	using (tenant_id in (select public.tenant_ids_admin_do_usuario()))
	with check (tenant_id in (select public.tenant_ids_admin_do_usuario()));
