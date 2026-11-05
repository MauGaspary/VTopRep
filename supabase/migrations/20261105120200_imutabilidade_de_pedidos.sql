-- Fase 2.11.1: imutabilidade remota dos pedidos emitidos (PRD 2.1 e 3.2).
--
-- Um pedido fora de `rascunho` é somente-leitura: só `status` (nas transições
-- do funil), `updated_at` e `sincronizado_em` podem mudar. Um UPDATE que não
-- altera nada comercial (reenvio da mesma mutação pela Outbox) é aceito.
--
-- Transições aceitas a partir de pedido não-rascunho (provisório: a Fase 3
-- confirma as regras do funil de faturamento e ajusta esta função):
--   emitido               -> parcialmente_faturado | faturado_total | cancelado
--   parcialmente_faturado -> faturado_total
-- `faturado_total` e `cancelado` são finais.

-- Pedidos gravados nesta transação enquanto ainda eram novos ou rascunho. O
-- aparelho envia o pedido e depois seus itens: sem esta lista, os itens de um
-- pedido que acabou de ser emitido seriam recusados. O valor vale só dentro da
-- transação (`set_config(..., true)`).
create function public.registrar_pedido_em_gravacao(p_pedido uuid)
returns void
language plpgsql
as $$
begin
	perform set_config(
		'app.pedidos_em_gravacao',
		coalesce(current_setting('app.pedidos_em_gravacao', true), '') || p_pedido::text || ',',
		true
	);
end
$$;

create function public.proteger_pedido_emitido()
returns trigger
language plpgsql
as $$
declare
	ignorados constant text[] := array['status', 'updated_at', 'sincronizado_em'];
begin
	if tg_op = 'INSERT' then
		perform public.registrar_pedido_em_gravacao(new.id);
		return new;
	end if;

	-- `criado_por` é decidido pelo servidor na criação e nunca muda.
	new.criado_por := old.criado_por;

	if old.status = 'rascunho' then
		perform public.registrar_pedido_em_gravacao(new.id);
		return new;
	end if;

	if (to_jsonb(new) - ignorados) is distinct from (to_jsonb(old) - ignorados) then
		raise exception 'Pedido % já está %: os campos comerciais são somente-leitura',
			old.id, old.status
			using errcode = 'check_violation';
	end if;

	if new.status <> old.status and not (
		(old.status = 'emitido'
			and new.status in ('parcialmente_faturado', 'faturado_total', 'cancelado'))
		or (old.status = 'parcialmente_faturado' and new.status = 'faturado_total')
	) then
		raise exception 'Transição de status inválida: % -> %', old.status, new.status
			using errcode = 'check_violation';
	end if;

	return new;
end
$$;

create trigger pedidos_imutabilidade
	before insert or update on public.pedidos
	for each row execute function public.proteger_pedido_emitido();

-- Itens só mudam enquanto o pedido é rascunho (ou foi gravado agora). Pedido
-- ainda inexistente passa: a chave estrangeira deferida acusa a falta no commit.
create function public.pedido_aceita_itens(p_pedido uuid)
returns boolean
language sql
stable
as $$
	select coalesce(
		(
			select p.status = 'rascunho'
				or position(
					p.id::text || ',' in coalesce(current_setting('app.pedidos_em_gravacao', true), '')
				) > 0
			from public.pedidos p
			where p.id = p_pedido
		),
		true
	)
$$;

create function public.proteger_item_de_pedido_emitido()
returns trigger
language plpgsql
as $$
begin
	if not public.pedido_aceita_itens(new.pedido_id)
		or (tg_op = 'UPDATE' and not public.pedido_aceita_itens(old.pedido_id)) then
		raise exception 'Pedido já emitido: os itens são somente-leitura'
			using errcode = 'check_violation';
	end if;
	return new;
end
$$;

create trigger itens_pedido_imutabilidade
	before insert or update on public.itens_pedido
	for each row execute function public.proteger_item_de_pedido_emitido();
