-- ============================================================================
-- Prueba de 20261021_redondeo_montos.sql en un Postgres LOCAL (nunca en producción).
-- Bordes de redondear_pago() y redondear_cobro(), y los previstos de un fijo cuyo monto cae
-- justo en ,5. Datos inventados.
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

-- Pago a la niñera: ,5 o menos baja (los mismos casos que tests/redondeo-montos.spec.js).
select pg_temp.verificar('pago 600 -> 600', public.redondear_pago(600) = 600);
select pg_temp.verificar('pago 600,4 -> 600', public.redondear_pago(600.4) = 600);
select pg_temp.verificar('pago 600,5 -> 600', public.redondear_pago(600.5) = 600);
select pg_temp.verificar('pago 600,6 -> 601', public.redondear_pago(600.6) = 601);
select pg_temp.verificar('pago 600,51 -> 601', public.redondear_pago(600.51) = 601);
select pg_temp.verificar('pago 0,4 -> 0', public.redondear_pago(0.4) = 0);
select pg_temp.verificar('pago 0 -> 0', public.redondear_pago(0) = 0);
select pg_temp.verificar('pago -600,5 -> -600', public.redondear_pago(-600.5) = -600);
select pg_temp.verificar('pago vacío -> vacío', public.redondear_pago(null) is null);
-- Cobro a la familia: ,5 o más sube.
select pg_temp.verificar('cobro 600 -> 600', public.redondear_cobro(600) = 600);
select pg_temp.verificar('cobro 600,4 -> 600', public.redondear_cobro(600.4) = 600);
select pg_temp.verificar('cobro 600,5 -> 601', public.redondear_cobro(600.5) = 601);
select pg_temp.verificar('cobro 600,6 -> 601', public.redondear_cobro(600.6) = 601);
select pg_temp.verificar('cobro 600,49 -> 600', public.redondear_cobro(600.49) = 600);
select pg_temp.verificar('cobro -600,5 -> -601', public.redondear_cobro(-600.5) = -601);
-- Un ,5 que llega como ,4999... por una división (50 min = 0,8333... h) sigue siendo ,5.
select pg_temp.verificar('50 min x 303 = 252,5: pago 252', public.redondear_pago(50 / 60.0 * 303) = 252);
select pg_temp.verificar('50 min x 303 = 252,5: cobro 253', public.redondear_cobro(50 / 60.0 * 303) = 253);

insert into familias (id, nombre, cobro_hora, pago_hora) values
  ('f0000000-0000-4000-8000-000000000001', 'Familia Prueba Uno', 301, 201),
  ('f0000000-0000-4000-8000-000000000002', 'Familia Prueba Dos', 303, 303),
  ('f0000000-0000-4000-8000-000000000003', 'Familia Prueba Tres', 300, 200);
insert into ninieras (id, nombre) values ('e0000000-0000-4000-8000-000000000001', 'Ana Ficticia');
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  -- 14:00 a 16:30 (2,5 h): cobro 752,5 y pago 502,5.
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '14:00', '16:30', pg_temp.hoy() - 30, 'sitting'),
  -- 14:00 a 14:50 (50 min): 252,5 los dos.
  ('a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '14:00', '14:50', pg_temp.hoy() - 30, 'sitting'),
  -- 14:00 a 17:00 (3 h): montos enteros, no cambian.
  ('a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '14:00', '17:00', pg_temp.hoy() - 30, 'sitting');

select public.generar_previstos_fijos(14);
select pg_temp.verificar('2,5 h: cobro 752,5 -> 753, pago 502,5 -> 502',
  (select bool_and(cobro_familia = 753 and pago_ninera = 502) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000001'));
select pg_temp.verificar('50 min: cobro 253, pago 252',
  (select bool_and(cobro_familia = 253 and pago_ninera = 252) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000002'));
select pg_temp.verificar('3 h: enteros, sin cambios (900 y 600)',
  (select bool_and(cobro_familia = 900 and pago_ninera = 600) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000003'));
select pg_temp.verificar('ningún previsto con centavos',
  (select bool_and(cobro_familia = trunc(cobro_familia) and pago_ninera = trunc(pago_ninera)) from sittings_traslados));

-- Cambia la tarifa: los previstos se recalculan con las mismas reglas.
update familias set cobro_hora = 300.2, pago_hora = 200.2 where id = 'f0000000-0000-4000-8000-000000000003';
select public.generar_previstos_fijos(14);
select pg_temp.verificar('3 h x 300,2 = 900,6 -> 901; 3 h x 200,2 = 600,6 -> 601',
  (select bool_and(cobro_familia = 901 and pago_ninera = 601) from sittings_traslados where familia_id = 'f0000000-0000-4000-8000-000000000003'));

rollback;
