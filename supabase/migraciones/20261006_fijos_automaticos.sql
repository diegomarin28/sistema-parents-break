-- ============================================================================
-- Migración 06/10/2026: fijos automáticos (estructura). NO EJECUTADA: necesita el OK de
-- Diego, aparte.
--
-- Qué hace: los sittings de los fijos se cargan solos como "previstos" para los próximos
-- 14 días; el día que ocurren pasan solos a "confirmado". Decisiones del 05/10/2026:
-- previstos solo en la Agenda, confirmación automática con una lista corta para revisar
-- en Hoy, y "previsto del mes" aparte en Finanzas.
--
-- Compatible con la app publicada: solo agrega columnas (con default o vacías), una tabla y una
-- función que nadie llama. Hasta correr 20261006_fijos_automaticos_ACTIVAR.sql (después de
-- mergear y publicar el PR) no se genera ningún previsto y la app sigue igual que hoy.
--
-- Orden: 1) esta migración  2) mergear el PR  3) _ACTIVAR.
-- Para volver atrás: _DESACTIVAR.sql y después _DESHACER.sql.
-- ============================================================================

begin;

-- 1) Respaldo de los sittings tal como están (la migración no los modifica, pero por regla).
create table if not exists public.respaldo_sittings_traslados_20261006 as select * from public.sittings_traslados;
alter table public.respaldo_sittings_traslados_20261006 enable row level security; -- sin políticas: la app no la ve

-- 2) Sittings: estado, si lo generó el proceso automático y cuándo se revisó en Hoy.
--    Todo lo que ya existe y todo lo que cargue la app a mano queda 'confirmado'.
alter table public.sittings_traslados
  add column estado text default 'confirmado' not null,
  add column generado_automatico boolean default false not null,
  add column revisado_at timestamp with time zone;
alter table public.sittings_traslados
  add constraint sittings_traslados_estado_check check (estado in ('previsto', 'confirmado'));
-- El proceso nunca crea dos veces el mismo día de un fijo.
create unique index sittings_fijo_dia_automatico on public.sittings_traslados (asignacion_id, fecha) where generado_automatico;
create index idx_sittings_previstos on public.sittings_traslados (estado, fecha) where estado = 'previsto';

-- 2b) Precio fijo de un traslado fijo (05/10/2026): los traslados de un fijo cobran siempre lo
--     mismo (no dependen de los km), y puede ser distinto según el día (lunes a un lugar,
--     martes y jueves a otro). Vacío = como antes, el del último traslado.
alter table public.asignaciones
  add column cobro_traslado numeric,
  add column pago_traslado numeric;

-- 3) Pausas de un fijo (vacaciones): en ese rango no se generan previstos y la Agenda no
--    dibuja el fijo, sin terminarlo.
create table public.asignaciones_pausas (
  id uuid default gen_random_uuid() primary key,
  asignacion_id uuid not null references public.asignaciones(id) on delete cascade,
  desde date not null,
  hasta date not null,
  motivo text,
  creado_por text,
  created_at timestamp with time zone default now() not null,
  constraint asignaciones_pausas_rango_check check (hasta >= desde)
);
create index idx_asignaciones_pausas on public.asignaciones_pausas (asignacion_id, desde, hasta);
alter table public.asignaciones_pausas enable row level security;
create policy solo_autenticados_todo on public.asignaciones_pausas as permissive for all to public
  using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');
alter publication supabase_realtime add table public.asignaciones_pausas;

-- 4) El proceso. Lo corre pg_cron todos los días a las 03:00 de Montevideo (lo programa
--    _ACTIVAR) y la app lo llama después de cada cambio en un fijo, para que la ventana
--    quede al día enseguida. Hace, en orden:
--    a) lo previsto de hoy o antes pasa a 'confirmado' (llegó el día);
--    b) borra los previstos automáticos que ya no corresponden (fijo terminado, otro
--       horario o niñera desde una fecha, día sacado, pausa);
--    c) recalcula los previstos automáticos que nadie tocó (niñera, horario o tarifa nuevos,
--       o el precio del traslado cargado en el fijo);
--    d) crea los que faltan, de mañana a hoy + p_dias, salvo que ese día ya tenga una fila
--       de ese fijo (cargada a mano, "no fue", reemplazo) o de esa familia con esa niñera.
--    Un previsto que alguien edita desde la app deja de ser automático
--    (generado_automatico = false): el proceso no lo vuelve a tocar.
create or replace function public.generar_previstos_fijos(p_dias integer default 14)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  hoy date := (now() at time zone 'America/Montevideo')::date;
  n_confirmados integer;
  n_borrados integer;
  n_actualizados integer;
  n_creados integer;
begin
  if p_dias is null or p_dias < 1 or p_dias > 60 then
    raise exception 'p_dias tiene que estar entre 1 y 60 (vino %)', p_dias;
  end if;
  -- Dos corridas a la vez (la de las 03:00 y una de la app) se esperan una a la otra.
  perform pg_advisory_xact_lock(hashtext('generar_previstos_fijos'));

  update sittings_traslados set estado = 'confirmado' where estado = 'previsto' and fecha <= hoy;
  get diagnostics n_confirmados = row_count;

  -- Se puede llamar más de una vez en la misma transacción (por ejemplo desde _ACTIVAR).
  drop table if exists pg_temp._previstos_deseados;
  create temporary table _previstos_deseados on commit drop as
  with dias as (
    select a.*, f.nombre as fam_nombre, f.cobro_hora as fam_cobro_hora, f.pago_hora as fam_pago_hora, d::date as dia
      from asignaciones a
      join familias f on f.id = a.familia_id
     cross join generate_series(hoy + 1, hoy + p_dias, interval '1 day') d
     where jsonb_typeof(a.dias) = 'array'
       and a.dias ? (array['D','L','M','X','J','V','S'])[extract(dow from d)::integer + 1]
       and a.hora_inicio is not null
       and (a.vigente_desde is null or a.vigente_desde <= d::date)
       and (a.vigente_hasta is null or a.vigente_hasta >= d::date)
       and not exists (select 1 from asignaciones_pausas p where p.asignacion_id = a.id and d::date between p.desde and p.hasta)
  ), con_horas as (
    select dias.*,
           coalesce(dias.tipo, 'sitting') as tipo_fijo,
           (dias.hora_fin is not null and dias.hora_fin <= dias.hora_inicio) as cruza,
           case when dias.hora_fin is null then null
                else (extract(epoch from dias.hora_fin) - extract(epoch from dias.hora_inicio)) / 3600.0
                     + case when dias.hora_fin <= dias.hora_inicio then 24 else 0 end
           end as horas
      from dias
  )
  select c.id as asignacion_id, c.dia as fecha, c.familia_id, c.fam_nombre as familia_nombre,
         c.ninera_id, c.ninera_nombre, c.tipo_fijo as tipo, c.hora_inicio, c.hora_fin,
         c.cruza as termina_dia_siguiente,
         case when c.tipo_fijo = 'traslado' then coalesce(c.cobro_traslado, t.cobro_familia, 0)
              else round(coalesce(c.horas, 0) * coalesce(c.fam_cobro_hora, 0)) end as cobro_familia,
         case when c.tipo_fijo = 'traslado' then coalesce(c.pago_traslado, t.pago_ninera, 0)
              else round(coalesce(c.horas, 0) * coalesce(c.fam_pago_hora, 0)) end as pago_ninera
    from con_horas c
    -- Un traslado no se cobra por hora: el precio cargado en el fijo o, si no tiene, el del
    -- último traslado de ese fijo o de esa familia (lo mismo que precarga la app).
    left join lateral (
      select s.cobro_familia, s.pago_ninera
        from sittings_traslados s
       where c.tipo_fijo = 'traslado' and (c.cobro_traslado is null or c.pago_traslado is null)
         and s.tipo = 'traslado' and not s.cancelado and s.estado = 'confirmado'
         and (s.asignacion_id = c.id or s.familia_id = c.familia_id)
       order by (s.asignacion_id = c.id) desc, s.fecha desc
       limit 1
    ) t on true;

  delete from sittings_traslados s
   where s.generado_automatico and s.estado = 'previsto' and s.fecha > hoy
     and not exists (select 1 from _previstos_deseados d where d.asignacion_id = s.asignacion_id and d.fecha = s.fecha);
  get diagnostics n_borrados = row_count;

  update sittings_traslados s
     set ninera_id = d.ninera_id, ninera_nombre = d.ninera_nombre, familia_nombre = d.familia_nombre,
         tipo = d.tipo, hora_inicio = d.hora_inicio, hora_fin = d.hora_fin,
         termina_dia_siguiente = d.termina_dia_siguiente,
         cobro_familia = d.cobro_familia, pago_ninera = d.pago_ninera
    from _previstos_deseados d
   where s.generado_automatico and s.estado = 'previsto' and s.fecha > hoy
     and d.asignacion_id = s.asignacion_id and d.fecha = s.fecha
     and (s.ninera_id, s.ninera_nombre, s.familia_nombre, s.tipo, s.hora_inicio, s.hora_fin, s.termina_dia_siguiente, s.cobro_familia, s.pago_ninera)
         is distinct from
         (d.ninera_id, d.ninera_nombre, d.familia_nombre, d.tipo, d.hora_inicio, d.hora_fin, d.termina_dia_siguiente, d.cobro_familia, d.pago_ninera);
  get diagnostics n_actualizados = row_count;

  insert into sittings_traslados (tipo, registrado_por, asignacion_id, familia_id, familia_nombre, ninera_id,
         ninera_nombre, fecha, hora_inicio, hora_fin, termina_dia_siguiente, cobro_familia, pago_ninera,
         cobrado, pagado, cancelado, estado, generado_automatico, notas)
  select d.tipo, 'Automático', d.asignacion_id, d.familia_id, d.familia_nombre, d.ninera_id,
         d.ninera_nombre, d.fecha, d.hora_inicio, d.hora_fin, d.termina_dia_siguiente, d.cobro_familia, d.pago_ninera,
         false, false, false, 'previsto', true,
         case when d.tipo = 'traslado' then 'Traslado fijo' else 'Sitting fijo' end || ' — cargado automáticamente'
    from _previstos_deseados d
   where not exists (select 1 from sittings_traslados s where s.asignacion_id = d.asignacion_id and s.fecha = d.fecha)
     and not exists (select 1 from sittings_traslados s
                      where s.asignacion_id is null and s.fecha = d.fecha and s.familia_id = d.familia_id
                        and lower(trim(s.ninera_nombre)) = lower(trim(d.ninera_nombre)));
  get diagnostics n_creados = row_count;

  return jsonb_build_object('confirmados', n_confirmados, 'borrados', n_borrados,
                            'actualizados', n_actualizados, 'creados', n_creados, 'hoy', hoy);
end;
$function$;
revoke execute on function public.generar_previstos_fijos(integer) from public, anon;
grant execute on function public.generar_previstos_fijos(integer) to authenticated;

commit;
