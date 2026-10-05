-- ============================================================================
-- Migración 05/10/2026 (PR 2): vigencia y tipo de los fijos, historial de cambios
-- de sittings y cierre del bucket candidatas-fotos.
--
-- Pensada para correr ANTES de mergear el PR 2 sin romper la app que está en
-- producción: todo lo nuevo es opcional (columnas nullable con default), un trigger
-- que la app no ve, y dos políticas que nadie usa. La app vieja sigue funcionando
-- igual hasta que se publique la nueva.
--
-- Se ejecuta entera en una transacción. Si algo falla, no queda nada a medias.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Respaldo de las asignaciones tal como están hoy (antes de tocar nada).
-- ----------------------------------------------------------------------------
create table if not exists public.respaldo_asignaciones_20261005 as select * from public.asignaciones; -- si ya existe, se conserva la primera copia
alter table public.respaldo_asignaciones_20261005 enable row level security; -- sin políticas: la app no la ve

-- ----------------------------------------------------------------------------
-- 2) Asignaciones: vigencia (desde/hasta, ambos inclusive) y tipo.
--    vigente_desde tiene default "hoy en Montevideo" para que lo que cree la app
--    vieja entre la migración y el merge no se proyecte hacia el pasado.
-- ----------------------------------------------------------------------------
alter table public.asignaciones
  add column vigente_desde date default ((now() at time zone 'America/Montevideo')::date),
  add column vigente_hasta date,
  add column tipo text default 'sitting';
alter table public.asignaciones
  add constraint asignaciones_tipo_check check (tipo is null or tipo in ('sitting', 'traslado')),
  add constraint asignaciones_vigencia_check check (vigente_hasta is null or vigente_desde is null or vigente_hasta >= vigente_desde);

-- Fechas de inicio (acordadas el 05/10/2026):
--   * Sol Lucía Quintans en María Paz Martínez: desde el 29/09, los dos fijos.
--   * El resto (Laura Pouquette): provisorio = día de creación en Montevideo. Se corrige
--     después desde la app (Editar vigencia), sin SQL.
update public.asignaciones
   set vigente_desde = (created_at at time zone 'America/Montevideo')::date;
update public.asignaciones
   set vigente_desde = date '2026-09-29'
 where id in ('24692770-60af-4af0-b69e-bfc4bdf2d654', '437cd45e-a271-43e0-ba1e-d9b164987926');

-- Tipo: los dos fijos de María Paz son traslados; el resto, sitting.
update public.asignaciones set tipo = 'sitting';
update public.asignaciones
   set tipo = 'traslado'
 where id in ('24692770-60af-4af0-b69e-bfc4bdf2d654', '437cd45e-a271-43e0-ba1e-d9b164987926');

-- ninera_id: hoy está vacío en todas. Se completa solo cuando el nombre coincide con
-- exactamente UNA niñera (sin mayúsculas ni espacios de más); si no, queda como está.
update public.asignaciones a
   set ninera_id = n.id
  from public.ninieras n
 where a.ninera_id is null
   and lower(trim(n.nombre)) = lower(trim(a.ninera_nombre))
   and (select count(*) from public.ninieras n2 where lower(trim(n2.nombre)) = lower(trim(a.ninera_nombre))) = 1;

create index if not exists idx_asignaciones_vigencia on public.asignaciones (familia_id, vigente_desde, vigente_hasta);

-- ----------------------------------------------------------------------------
-- 3) Historial de cambios de sittings: quién cambió qué y cuándo.
--    Lo escribe solo el trigger; la app solo lo puede leer.
-- ----------------------------------------------------------------------------
create table public.sittings_historial (
  id bigint generated always as identity primary key,
  sitting_id uuid not null,
  accion text not null check (accion in ('alta', 'cambio', 'baja')),
  usuario text,
  cuando timestamp with time zone default now() not null,
  cambios jsonb,   -- en 'cambio': solo las columnas que cambiaron, {"col": {"antes": x, "despues": y}}
  fila jsonb       -- en 'alta' y 'baja': la fila completa (así un borrado queda reconstruible)
);
create index idx_sittings_historial_sitting on public.sittings_historial (sitting_id, cuando desc);
alter table public.sittings_historial enable row level security;
create policy sittings_historial_leer on public.sittings_historial as permissive for select to authenticated
  using (true);

create or replace function public.registrar_historial_sitting()
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
    insert into public.sittings_historial (sitting_id, accion, usuario, fila) values (new.id, 'alta', usr, to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.sittings_historial (sitting_id, accion, usuario, fila) values (old.id, 'baja', usr, to_jsonb(old));
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
      insert into public.sittings_historial (sitting_id, accion, usuario, cambios) values (new.id, 'cambio', usr, diff);
    end if;
    return new;
  end if;
end;
$function$;
revoke execute on function public.registrar_historial_sitting() from public, anon, authenticated;

create trigger sittings_historial_trg
  after insert or update or delete on public.sittings_traslados
  for each row execute function public.registrar_historial_sitting();

-- ----------------------------------------------------------------------------
-- 4) Bucket candidatas-fotos: cerrar subida y listado anónimos.
--    La única que sube fotos es la Edge Function candidatas-webhook, con la clave de
--    servicio (no pasa por estas políticas). La app muestra las fotos por su URL
--    pública, que sigue funcionando porque el bucket es público.
-- ----------------------------------------------------------------------------
drop policy if exists candidatas_fotos_service_write on storage.objects;
drop policy if exists candidatas_fotos_public_read on storage.objects;

commit;
