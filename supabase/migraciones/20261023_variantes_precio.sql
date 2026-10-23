-- ============================================================================
-- Migración 23/10/2026: variantes de precio por familia.
--
-- Los casos especiales se anotaban a mano en las notas y se cambiaba el monto (la niñera llevó al
-- chico a la casa y se suma algo a la madre y a la niñera; no se hizo, se cobra igual y a la niñera
-- se le paga un monto fijo; un descuento por porcentaje). Ahora:
--   - variantes_precio: las variantes de cada familia (nombre, a qué aplica, qué le hace al
--     cobro y al pago: sumar, total fijo o porcentaje), que se usan como botón de un toque al
--     registrar. Opcionalmente solo para un fijo, y programadas para aplicarse solas a ese fijo
--     desde una fecha y en ciertos días. Las cargan Paulina y Delfina desde la app.
--   - sittings_traslados.precio_variantes: la base y cuáles se aplicaron (copiadas tal cual, así
--     el registro no cambia si después se edita o se borra la variante).
--   - efecto_variantes() y precio_con_variantes(): la misma regla que aplicarVariantes() en
--     js/core.js (las compara supabase/pruebas/paridad_plata.sql).
--   - generar_previstos_fijos aplica las variantes programadas a los previstos.
--
-- Compatible con la app publicada: tabla y columna nuevas, vacías, que la app de hoy no usa; sin
-- variantes, generar_previstos_fijos calcula exactamente lo mismo que antes. No toca filas: no
-- hace falta respaldo. Se deshace con 20261023_variantes_precio_DESHACER.sql.
-- ============================================================================
begin;

create table public.variantes_precio (
  id uuid default gen_random_uuid() not null,
  familia_id uuid not null references public.familias(id) on delete cascade,
  nombre text not null,
  -- 'sitting', 'traslado' o 'ambos'.
  aplica_a text default 'ambos'::text not null,
  -- Solo para ese fijo (opcional). Programada: se aplica sola a ese fijo desde auto_desde, hasta
  -- auto_hasta (opcional) y en los días auto_dias (códigos L M X J V S D; vacío = todos).
  asignacion_id uuid references public.asignaciones(id) on delete set null,
  -- Qué le hace al cobro y al pago: 'sumar' (valor puede ser negativo), 'total' o 'porcentaje'
  -- (-50 = la mitad). Vacío = ese lado no cambia.
  cobro_modo text,
  cobro_valor numeric,
  pago_modo text,
  pago_valor numeric,
  -- Mismo motivo que sittings_traslados.precio_motivo.
  motivo text,
  auto_desde date,
  auto_hasta date,
  auto_dias jsonb,
  activa boolean default true not null,
  creado_por text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint variantes_precio_pkey PRIMARY KEY (id),
  constraint variantes_precio_nombre_check CHECK ((length(btrim(nombre)) >= 1 AND length(nombre) <= 60)),
  constraint variantes_precio_aplica_a_check CHECK ((aplica_a = ANY (ARRAY['sitting'::text, 'traslado'::text, 'ambos'::text]))),
  constraint variantes_precio_cobro_modo_check CHECK ((cobro_modo = ANY (ARRAY['sumar'::text, 'total'::text, 'porcentaje'::text]))),
  constraint variantes_precio_pago_modo_check CHECK ((pago_modo = ANY (ARRAY['sumar'::text, 'total'::text, 'porcentaje'::text]))),
  constraint variantes_precio_cobro_check CHECK (((cobro_modo IS NULL) = (cobro_valor IS NULL))),
  constraint variantes_precio_pago_check CHECK (((pago_modo IS NULL) = (pago_valor IS NULL))),
  constraint variantes_precio_efecto_check CHECK (((cobro_modo IS NOT NULL) OR (pago_modo IS NOT NULL))),
  constraint variantes_precio_total_check CHECK ((((cobro_modo IS DISTINCT FROM 'total'::text) OR (cobro_valor >= (0)::numeric)) AND ((pago_modo IS DISTINCT FROM 'total'::text) OR (pago_valor >= (0)::numeric)))),
  constraint variantes_precio_motivo_check CHECK ((motivo = ANY (ARRAY['descuento'::text, 'extra'::text, 'sin_servicio'::text, 'otro'::text]))),
  constraint variantes_precio_auto_check CHECK (((auto_desde IS NULL) OR (asignacion_id IS NOT NULL))),
  constraint variantes_precio_auto_hasta_check CHECK (((auto_hasta IS NULL) OR ((auto_desde IS NOT NULL) AND (auto_hasta >= auto_desde)))),
  constraint variantes_precio_auto_dias_check CHECK (((auto_dias IS NULL) OR (jsonb_typeof(auto_dias) = 'array'::text)))
);
create index idx_variantes_precio_familia on public.variantes_precio using btree (familia_id);
create index idx_variantes_precio_programadas on public.variantes_precio using btree (asignacion_id) where (auto_desde is not null);
alter table public.variantes_precio enable row level security;
create policy solo_autenticados_todo on public.variantes_precio as permissive for all to public
  using ((select public.es_usuaria_autorizada())) with check ((select public.es_usuaria_autorizada()));
alter publication supabase_realtime add table public.variantes_precio;

-- La base y las variantes aplicadas: {"base": {"cobro", "pago"}, "aplicadas": [{"id", "nombre",
-- "cobro": {"modo", "valor"}, "pago": {...}, "motivo", "libre", "programada"}]}. Vacío = sin variantes.
alter table public.sittings_traslados add column if not exists precio_variantes jsonb;

-- De un lado (cobro o pago): primero el total fijo (si hay varios, el último), después los
-- porcentajes y al final las sumas; a centavos y nunca menos de 0. Igual que efectoVariantes().
create or replace function public.efecto_variantes(p_base numeric, p_efectos jsonb)
returns numeric
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v numeric := coalesce(p_base, 0);
  e jsonb;
begin
  for e in select x from jsonb_array_elements(coalesce(p_efectos, '[]'::jsonb)) with ordinality t(x, i) where x->>'modo' = 'total' order by i loop
    v := coalesce((e->>'valor')::numeric, 0);
  end loop;
  for e in select x from jsonb_array_elements(coalesce(p_efectos, '[]'::jsonb)) with ordinality t(x, i) where x->>'modo' = 'porcentaje' order by i loop
    v := v * (1 + coalesce((e->>'valor')::numeric, 0) / 100);
  end loop;
  for e in select x from jsonb_array_elements(coalesce(p_efectos, '[]'::jsonb)) with ordinality t(x, i) where x->>'modo' = 'sumar' order by i loop
    v := v + coalesce((e->>'valor')::numeric, 0);
  end loop;
  return greatest(round(v, 2), 0);
end;
$function$;
revoke execute on function public.efecto_variantes(numeric, jsonb) from public, anon;
grant execute on function public.efecto_variantes(numeric, jsonb) to authenticated;

-- Cobro y pago con las variantes aplicadas, sin centavos (redondear_cobro / redondear_pago).
-- Igual que aplicarVariantes() en js/core.js; la puede usar la app de niñeras más adelante.
create or replace function public.precio_con_variantes(p_cobro numeric, p_pago numeric, p_aplicadas jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $function$
  select case when p_aplicadas is null then null else jsonb_build_object(
    'cobro', public.redondear_cobro(public.efecto_variantes(p_cobro,
      (select coalesce(jsonb_agg(a->'cobro' order by i), '[]'::jsonb) from jsonb_array_elements(p_aplicadas) with ordinality t(a, i) where jsonb_typeof(a->'cobro') = 'object'))),
    'pago', public.redondear_pago(public.efecto_variantes(p_pago,
      (select coalesce(jsonb_agg(a->'pago' order by i), '[]'::jsonb) from jsonb_array_elements(p_aplicadas) with ordinality t(a, i) where jsonb_typeof(a->'pago') = 'object'))))
  end
$function$;
revoke execute on function public.precio_con_variantes(numeric, numeric, jsonb) from public, anon;
grant execute on function public.precio_con_variantes(numeric, numeric, jsonb) to authenticated;

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
    select a.*, f.nombre as fam_nombre, f.cobro_hora as fam_cobro_hora, f.pago_hora as fam_pago_hora,
           f.terminos_aceptados_el as fam_terminos, d::date as dia
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
           end as horas,
           -- Términos y condiciones (20/10/2026): desde el día que los aceptó, a la familia se
           -- le cobra con el fin redondeado (minutos_fin_cobro); a la niñera, la hora real.
           case when dias.hora_fin is null then null
                when dias.fam_terminos is null or dias.dia < dias.fam_terminos then null
                else greatest(public.minutos_fin_cobro(
                       (extract(epoch from dias.hora_fin) / 60)::integer
                       + case when dias.hora_fin <= dias.hora_inicio then 1440 else 0 end)
                     - (extract(epoch from dias.hora_inicio) / 60)::integer, 0) / 60.0
           end as horas_cobro
      from dias
  )
  -- Montos sin centavos (21/10/2026): el cobro con redondear_cobro y el pago con redondear_pago.
  , base as (
  select c.id as asignacion_id, c.dia as fecha, c.familia_id, c.fam_nombre as familia_nombre,
         c.ninera_id, c.ninera_nombre, c.tipo_fijo as tipo, c.hora_inicio, c.hora_fin,
         c.cruza as termina_dia_siguiente,
         (array['D','L','M','X','J','V','S'])[extract(dow from c.dia)::integer + 1] as dia_codigo,
         case when c.tipo_fijo = 'traslado' then coalesce(c.cobro_traslado, t.cobro_familia, 0)
              else public.redondear_cobro(coalesce(c.horas_cobro, c.horas, 0) * coalesce(c.fam_cobro_hora, 0)) end as cobro_base,
         case when c.tipo_fijo = 'traslado' then coalesce(c.pago_traslado, t.pago_ninera, 0)
              else public.redondear_pago(coalesce(c.horas, 0) * coalesce(c.fam_pago_hora, 0)) end as pago_base
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
    ) t on true
  )
  -- Variantes programadas (23/10/2026): las de ese fijo que rigen ese día ("desde el 1/11, los
  -- martes la vuelta la hace el padre"), en el orden en que se crearon. Quedan anotadas en
  -- precio_variantes (la base y cuáles se aplicaron) y el motivo, el de la primera.
  select b.asignacion_id, b.fecha, b.familia_id, b.familia_nombre, b.ninera_id, b.ninera_nombre, b.tipo,
         b.hora_inicio, b.hora_fin, b.termina_dia_siguiente,
         coalesce((public.precio_con_variantes(b.cobro_base, b.pago_base, v.aplicadas)->>'cobro')::numeric, b.cobro_base) as cobro_familia,
         coalesce((public.precio_con_variantes(b.cobro_base, b.pago_base, v.aplicadas)->>'pago')::numeric, b.pago_base) as pago_ninera,
         case when v.aplicadas is null then null
              else jsonb_build_object('base', jsonb_build_object('cobro', b.cobro_base, 'pago', b.pago_base), 'aplicadas', v.aplicadas) end as precio_variantes,
         v.motivo as precio_motivo
    from base b
    left join lateral (
      select jsonb_agg(jsonb_build_object(
               'id', vp.id, 'nombre', vp.nombre, 'motivo', vp.motivo, 'programada', true,
               'cobro', case when vp.cobro_modo is null then null else jsonb_build_object('modo', vp.cobro_modo, 'valor', vp.cobro_valor) end,
               'pago', case when vp.pago_modo is null then null else jsonb_build_object('modo', vp.pago_modo, 'valor', vp.pago_valor) end)
               order by vp.created_at, vp.id) as aplicadas,
             (array_agg(vp.motivo order by vp.created_at, vp.id))[1] as motivo
        from variantes_precio vp
       where vp.asignacion_id = b.asignacion_id and vp.activa
         and vp.auto_desde is not null and vp.auto_desde <= b.fecha
         and (vp.auto_hasta is null or vp.auto_hasta >= b.fecha)
         and (vp.auto_dias is null or vp.auto_dias ? b.dia_codigo)
         and vp.aplica_a in (b.tipo, 'ambos')
    ) v on true;

  delete from sittings_traslados s
   where s.generado_automatico and s.estado = 'previsto' and s.fecha > hoy
     and not exists (select 1 from _previstos_deseados d where d.asignacion_id = s.asignacion_id and d.fecha = s.fecha);
  get diagnostics n_borrados = row_count;

  update sittings_traslados s
     set ninera_id = d.ninera_id, ninera_nombre = d.ninera_nombre, familia_nombre = d.familia_nombre,
         tipo = d.tipo, hora_inicio = d.hora_inicio, hora_fin = d.hora_fin,
         termina_dia_siguiente = d.termina_dia_siguiente,
         cobro_familia = d.cobro_familia, pago_ninera = d.pago_ninera,
         precio_variantes = d.precio_variantes, precio_motivo = d.precio_motivo
    from _previstos_deseados d
   where s.generado_automatico and s.estado = 'previsto' and s.fecha > hoy
     and d.asignacion_id = s.asignacion_id and d.fecha = s.fecha
     and (s.ninera_id, s.ninera_nombre, s.familia_nombre, s.tipo, s.hora_inicio, s.hora_fin, s.termina_dia_siguiente, s.cobro_familia, s.pago_ninera, s.precio_variantes, s.precio_motivo)
         is distinct from
         (d.ninera_id, d.ninera_nombre, d.familia_nombre, d.tipo, d.hora_inicio, d.hora_fin, d.termina_dia_siguiente, d.cobro_familia, d.pago_ninera, d.precio_variantes, d.precio_motivo);
  get diagnostics n_actualizados = row_count;

  insert into sittings_traslados (tipo, registrado_por, asignacion_id, familia_id, familia_nombre, ninera_id,
         ninera_nombre, fecha, hora_inicio, hora_fin, termina_dia_siguiente, cobro_familia, pago_ninera,
         precio_variantes, precio_motivo, cobrado, pagado, cancelado, estado, generado_automatico, notas)
  select d.tipo, 'Automático', d.asignacion_id, d.familia_id, d.familia_nombre, d.ninera_id,
         d.ninera_nombre, d.fecha, d.hora_inicio, d.hora_fin, d.termina_dia_siguiente, d.cobro_familia, d.pago_ninera,
         d.precio_variantes, d.precio_motivo, false, false, false, 'previsto', true,
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
