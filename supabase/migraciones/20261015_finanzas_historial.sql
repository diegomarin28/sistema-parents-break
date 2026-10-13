-- ============================================================================
-- Migración 15/10/2026: historial de cambios de gastos generales, saldos a favor y gastos
-- extra. Pau y Delfi corrigen a mano meses anteriores desde Finanzas ("Revisar meses") y cada
-- cambio tiene que quedar registrado (quién, cuándo, valor anterior y nuevo), igual que
-- sittings_historial para los sittings.
-- Solo agrega una tabla y triggers: la app publicada no la usa y sigue igual.
-- Para volver atrás: 20261015_finanzas_historial_DESHACER.sql.
-- ============================================================================
begin;

create table if not exists public.finanzas_historial (
  id bigint generated always as identity primary key,
  tabla text not null,
  fila_id uuid not null,
  accion text not null,
  usuario text,
  cuando timestamp with time zone default now() not null,
  cambios jsonb,
  fila jsonb,
  constraint finanzas_historial_tabla_check CHECK ((tabla = ANY (ARRAY['gastos_generales'::text, 'ajustes_saldo'::text, 'gastos_extra'::text]))),
  constraint finanzas_historial_accion_check CHECK ((accion = ANY (ARRAY['alta'::text, 'cambio'::text, 'baja'::text])))
);
create index if not exists idx_finanzas_historial_fila on public.finanzas_historial using btree (tabla, fila_id, cuando desc);

-- Misma lógica que registrar_historial_sitting: el mail sale del token de la sesión.
create or replace function public.registrar_historial_finanzas()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  usr text;
  diff jsonb := '{}'::jsonb;
  k text;
  viejo jsonb;
  nuevo jsonb;
begin
  begin
    usr := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then
    usr := null;
  end;
  usr := coalesce(usr, current_user);

  if tg_op = 'INSERT' then
    insert into public.finanzas_historial (tabla, fila_id, accion, usuario, fila) values (tg_table_name, new.id, 'alta', usr, to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.finanzas_historial (tabla, fila_id, accion, usuario, fila) values (tg_table_name, old.id, 'baja', usr, to_jsonb(old));
    return old;
  else
    viejo := to_jsonb(old);
    nuevo := to_jsonb(new);
    for k in select jsonb_object_keys(nuevo) loop
      if (viejo -> k) is distinct from (nuevo -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('antes', viejo -> k, 'despues', nuevo -> k));
      end if;
    end loop;
    if diff <> '{}'::jsonb then
      insert into public.finanzas_historial (tabla, fila_id, accion, usuario, cambios) values (tg_table_name, new.id, 'cambio', usr, diff);
    end if;
    return new;
  end if;
end;
$function$;
revoke execute on function public.registrar_historial_finanzas() from public, anon, authenticated;

drop trigger if exists gastos_generales_historial_trg on public.gastos_generales;
create trigger gastos_generales_historial_trg
  after insert or update or delete on public.gastos_generales
  for each row execute function public.registrar_historial_finanzas();
drop trigger if exists ajustes_saldo_historial_trg on public.ajustes_saldo;
create trigger ajustes_saldo_historial_trg
  after insert or update or delete on public.ajustes_saldo
  for each row execute function public.registrar_historial_finanzas();
drop trigger if exists gastos_extra_historial_trg on public.gastos_extra;
create trigger gastos_extra_historial_trg
  after insert or update or delete on public.gastos_extra
  for each row execute function public.registrar_historial_finanzas();

-- Solo lectura para la app (lo escribe el trigger), como sittings_historial.
alter table public.finanzas_historial enable row level security;
drop policy if exists finanzas_historial_leer on public.finanzas_historial;
create policy finanzas_historial_leer on public.finanzas_historial as permissive for select to authenticated
  using ((select public.es_usuaria_autorizada()));

commit;
