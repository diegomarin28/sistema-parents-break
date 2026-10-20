-- ============================================================================
-- Prueba de 20261020_terminos_redondeo.sql en un Postgres LOCAL (nunca en producción).
-- Bordes del redondeo del fin para el cobro y los previstos de los fijos con y sin
-- términos aceptados. Datos inventados.
-- Uso: crear una base con supabase/schema.sql (sin las extensiones de Supabase), aplicar
-- la migración y correr este archivo con psql -v ON_ERROR_STOP=1. Si algo no da, corta con
-- el nombre del caso. Todo corre en una transacción que termina en rollback.
-- ============================================================================
begin;

create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Montevideo')::date $$;
create function pg_temp.verificar(caso text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', caso; end if;
  raise notice 'ok: %', caso;
end $$;
-- minutos_fin_cobro('17:36') en HH:MM, para leer los casos más fácil.
create function pg_temp.fin(h text) returns text language sql as $$
  select to_char(make_interval(mins => public.minutos_fin_cobro((extract(epoch from h::interval) / 60)::integer)), 'HH24:MI')
$$;

-- La regla, borde por borde (los mismos casos que tests/terminos.spec.js).
select pg_temp.verificar('17:00 -> 17:00', pg_temp.fin('17:00') = '17:00');
select pg_temp.verificar('17:04 -> 17:00', pg_temp.fin('17:04') = '17:00');
select pg_temp.verificar('17:05 -> 17:00 (tolerancia)', pg_temp.fin('17:05') = '17:00');
select pg_temp.verificar('17:06 -> 17:30', pg_temp.fin('17:06') = '17:30');
select pg_temp.verificar('17:30 -> 17:30', pg_temp.fin('17:30') = '17:30');
select pg_temp.verificar('17:35 -> 17:30 (tolerancia)', pg_temp.fin('17:35') = '17:30');
select pg_temp.verificar('17:36 -> 18:00', pg_temp.fin('17:36') = '18:00');
select pg_temp.verificar('23:36 -> 24:00 (medianoche)', public.minutos_fin_cobro(23*60+36) = 24*60);
select pg_temp.verificar('01:06 del día siguiente -> 01:30', public.minutos_fin_cobro(24*60+66) = 24*60+90);

insert into familias (id, nombre, cobro_hora, pago_hora, terminos_aceptados_el) values
  ('f0000000-0000-4000-8000-000000000001', 'Familia Prueba Uno', 300, 200, pg_temp.hoy()),
  ('f0000000-0000-4000-8000-000000000002', 'Familia Prueba Dos', 300, 200, null),
  ('f0000000-0000-4000-8000-000000000003', 'Familia Prueba Tres', 300, 200, pg_temp.hoy() + 5);
insert into ninieras (id, nombre) values ('e0000000-0000-4000-8000-000000000001', 'Ana Ficticia');
-- Todos los días, 14:00 a 17:36 (3,6 h reales).
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '14:00', '17:36', pg_temp.hoy() - 30, 'sitting'),
  ('a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '14:00', '17:36', pg_temp.hoy() - 30, 'sitting'),
  ('a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '14:00', '17:36', pg_temp.hoy() - 30, 'sitting');

select public.generar_previstos_fijos(14);
select pg_temp.verificar('aceptó: se cobra hasta las 18:00 (4 h), a la niñera la hora real (3,6 h)',
  (select bool_and(cobro_familia = 1200 and pago_ninera = 720 and hora_fin = '17:36') from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000001'));
select pg_temp.verificar('sin la casilla: todo con la hora real',
  (select bool_and(cobro_familia = 1080 and pago_ninera = 720) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000002'));
select pg_temp.verificar('aceptó desde hoy+5: antes, hora real; desde ese día, redondeado',
  (select bool_and(cobro_familia = case when fecha >= pg_temp.hoy() + 5 then 1200 else 1080 end and pago_ninera = 720)
     from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000003'));

-- Fin con tolerancia: 17:05 se cobra hasta las 17:00 (3 h).
update asignaciones set hora_fin = '17:05' where id = 'a0000000-0000-4000-8000-000000000001';
select public.generar_previstos_fijos(14);
select pg_temp.verificar('17:05: se cobran 3 h, a la niñera 3 h 05',
  (select bool_and(cobro_familia = 900 and pago_ninera = round(185 / 60.0 * 200)) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000001'));

-- Pasa la medianoche: 20:00 a 01:06 se cobra hasta la 01:30 (5,5 h).
update asignaciones set hora_inicio = '20:00', hora_fin = '01:06' where id = 'a0000000-0000-4000-8000-000000000001';
select public.generar_previstos_fijos(14);
select pg_temp.verificar('cruza la medianoche: se cobra hasta la 01:30',
  (select bool_and(termina_dia_siguiente and cobro_familia = 1650 and pago_ninera = round(306 / 60.0 * 200)) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000001'));
-- Termina 23:36: se cobra hasta las 24:00.
update asignaciones set hora_inicio = '20:00', hora_fin = '23:36' where id = 'a0000000-0000-4000-8000-000000000001';
select public.generar_previstos_fijos(14);
select pg_temp.verificar('23:36: se cobra hasta las 24:00 (4 h)',
  (select bool_and(not termina_dia_siguiente and cobro_familia = 1200 and pago_ninera = 720) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000001'));

-- Sacar la marca: los previstos que nadie tocó vuelven a la hora real.
update familias set terminos_aceptados_el = null where id = 'f0000000-0000-4000-8000-000000000001';
select public.generar_previstos_fijos(14);
select pg_temp.verificar('sin la marca: vuelve a la hora real',
  (select bool_and(cobro_familia = 1080) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000001'));

-- La función de la regla solo la usa generar_previstos_fijos: no se llama desde la app.
select pg_temp.verificar('authenticated no ejecuta minutos_fin_cobro', not has_function_privilege('authenticated', 'public.minutos_fin_cobro(integer)', 'execute'));
select pg_temp.verificar('anon no ejecuta minutos_fin_cobro', not has_function_privilege('anon', 'public.minutos_fin_cobro(integer)', 'execute'));

rollback;
