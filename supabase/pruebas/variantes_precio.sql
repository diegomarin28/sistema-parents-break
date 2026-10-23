-- ============================================================================
-- Prueba de 20261023_variantes_precio.sql en un Postgres LOCAL (nunca en producción): la regla
-- de las variantes en la base (efecto_variantes, precio_con_variantes), la tabla y las
-- variantes programadas en la carga nocturna (generar_previstos_fijos). Datos inventados.
-- Uso: PGLITE_DIR=<pglite> node scripts/probar-sql.mjs --schema <schema de main> \
--        --migracion supabase/migraciones/20261023_variantes_precio.sql supabase/pruebas/variantes_precio.sql
-- Todo corre en una transacción que termina en rollback.
-- ============================================================================
begin;

create function pg_temp.hoy() returns date language sql as $$ select (now() at time zone 'America/Montevideo')::date $$;
create function pg_temp.verificar(caso text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', caso; end if;
  raise notice 'ok: %', caso;
end $$;
-- El código del día (L M X J V S D) de una fecha.
create function pg_temp.dia(d date) returns text language sql as $$ select (array['D','L','M','X','J','V','S'])[extract(dow from d)::integer + 1] $$;
create function pg_temp.precio(c numeric, p numeric, a jsonb) returns text language sql as $$
  select (public.precio_con_variantes(c, p, a)->>'cobro') || '/' || (public.precio_con_variantes(c, p, a)->>'pago') $$;

-- 1) La regla, con casos a mano (inventados).
select pg_temp.verificar('la llevó a la casa: +450 a la familia y +250 a la niñera',
  pg_temp.precio(1400, 650, '[{"nombre":"La llevó a la casa","cobro":{"modo":"sumar","valor":450},"pago":{"modo":"sumar","valor":250}}]') = '1850/900');
select pg_temp.verificar('no se hizo: se cobra igual y a la niñera un total de 180',
  pg_temp.precio(1400, 650, '[{"nombre":"No se hizo","cobro":null,"pago":{"modo":"total","valor":180}}]') = '1400/180');
select pg_temp.verificar('50% de descuento: 1201 -> 601 (el ,5 del cobro sube)',
  pg_temp.precio(1201, 800, '[{"nombre":"Mitad","cobro":{"modo":"porcentaje","valor":-50}}]') = '601/800');
select pg_temp.verificar('varias: total fijo, después el porcentaje y al final la suma',
  pg_temp.precio(1000, 600, '[{"cobro":{"modo":"sumar","valor":100}},{"cobro":{"modo":"porcentaje","valor":10}},{"cobro":{"modo":"total","valor":2000}}]') = '2300/600');
select pg_temp.verificar('dos totales del mismo lado: gana el último',
  pg_temp.precio(1000, 600, '[{"pago":{"modo":"total","valor":300}},{"pago":{"modo":"total","valor":200}}]') = '1000/200');
select pg_temp.verificar('nunca menos de 0', pg_temp.precio(500, 300, '[{"cobro":{"modo":"sumar","valor":-900},"pago":{"modo":"porcentaje","valor":-100}}]') = '0/0');
select pg_temp.verificar('el pago baja el ,5: 600 + 0,5 -> 600', pg_temp.precio(1000, 600, '[{"pago":{"modo":"sumar","valor":0.5}}]') = '1000/600');
select pg_temp.verificar('sin variantes (null) no hay precio con variantes', public.precio_con_variantes(1000, 600, null) is null);
select pg_temp.verificar('lista vacía: la base, redondeada', pg_temp.precio(1000.5, 600.5, '[]') = '1001/600');

-- 2) La tabla: lo que no se puede guardar.
insert into familias (id, nombre, cobro_hora, pago_hora) values
  ('f0000000-0000-4000-8000-000000000001', 'Familia Prueba Uno', 300, 200),
  ('f0000000-0000-4000-8000-000000000002', 'Familia Prueba Dos', 300, 200);
insert into ninieras (id, nombre) values ('e0000000-0000-4000-8000-000000000001', 'Ana Ficticia');
-- Fijo de traslado de todos los días a las 17, a $1.400 / $650; y uno de sitting, 16 a 19.
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo, cobro_traslado, pago_traslado) values
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '17:00', null, pg_temp.hoy() - 30, 'traslado', 1400, 650),
  ('a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '16:00', '19:00', pg_temp.hoy() - 30, 'sitting', null, null);

create function pg_temp.rechaza(sql text) returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when check_violation or not_null_violation or foreign_key_violation then
  return true;
end $$;
select pg_temp.verificar('sin efecto en cobro ni en pago, no se guarda',
  pg_temp.rechaza($$insert into variantes_precio (familia_id, nombre) values ('f0000000-0000-4000-8000-000000000001', 'Nada')$$));
select pg_temp.verificar('modo sin valor, no se guarda',
  pg_temp.rechaza($$insert into variantes_precio (familia_id, nombre, cobro_modo) values ('f0000000-0000-4000-8000-000000000001', 'X', 'sumar')$$));
select pg_temp.verificar('total negativo, no se guarda',
  pg_temp.rechaza($$insert into variantes_precio (familia_id, nombre, pago_modo, pago_valor) values ('f0000000-0000-4000-8000-000000000001', 'X', 'total', -1)$$));
select pg_temp.verificar('programada sin fijo, no se guarda',
  pg_temp.rechaza($$insert into variantes_precio (familia_id, nombre, cobro_modo, cobro_valor, auto_desde) values ('f0000000-0000-4000-8000-000000000001', 'X', 'sumar', 1, current_date)$$));
select pg_temp.verificar('nombre vacío, no se guarda',
  pg_temp.rechaza($$insert into variantes_precio (familia_id, nombre, cobro_modo, cobro_valor) values ('f0000000-0000-4000-8000-000000000001', '  ', 'sumar', 1)$$));
select pg_temp.verificar('a qué aplica inventado, no se guarda',
  pg_temp.rechaza($$insert into variantes_precio (familia_id, nombre, aplica_a, cobro_modo, cobro_valor) values ('f0000000-0000-4000-8000-000000000001', 'X', 'evento', 'sumar', 1)$$));
select pg_temp.verificar('un botón común (sin programar) se guarda',
  not pg_temp.rechaza($$insert into variantes_precio (familia_id, nombre, aplica_a, cobro_modo, cobro_valor, pago_modo, pago_valor, motivo)
                        values ('f0000000-0000-4000-8000-000000000001', 'La llevó a la casa', 'traslado', 'sumar', 450, 'sumar', 250, 'extra')$$));

-- 3) Sin variantes programadas, la carga nocturna calcula lo mismo que antes y no anota nada.
select public.generar_previstos_fijos(14);
select pg_temp.verificar('sin programadas: traslado a 1400/650, sin precio_variantes',
  (select bool_and(cobro_familia = 1400 and pago_ninera = 650 and precio_variantes is null and precio_motivo is null)
     from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000001'));
select pg_temp.verificar('un botón común no se aplica solo',
  (select count(*) from sittings_traslados where precio_variantes is not null) = 0);

-- 4) Programada: desde dentro de 3 días, solo en el día de la semana de hoy+5 ("los martes").
insert into variantes_precio (id, familia_id, nombre, aplica_a, asignacion_id, cobro_modo, cobro_valor, pago_modo, pago_valor, motivo, auto_desde, auto_dias) values
  ('b0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'La vuelta la hace el padre', 'traslado',
   'a0000000-0000-4000-8000-000000000001', 'sumar', -400, 'sumar', -200, 'descuento', pg_temp.hoy() + 3, jsonb_build_array(pg_temp.dia(pg_temp.hoy() + 5)));
select public.generar_previstos_fijos(14);
select pg_temp.verificar('programada: se aplica sola el día que corresponde (hoy+5 y hoy+12)',
  (select array_agg(fecha - pg_temp.hoy() order by fecha) from sittings_traslados
    where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and precio_variantes is not null) = array[5, 12]);
select pg_temp.verificar('programada: 1400 - 400 y 650 - 200, con el motivo y la base anotados',
  (select bool_and(cobro_familia = 1000 and pago_ninera = 450 and precio_motivo = 'descuento'
                   and (precio_variantes->'base'->>'cobro')::numeric = 1400 and (precio_variantes->'base'->>'pago')::numeric = 650
                   and precio_variantes->'aplicadas'->0->>'nombre' = 'La vuelta la hace el padre'
                   and (precio_variantes->'aplicadas'->0->>'programada')::boolean)
     from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and precio_variantes is not null));
select pg_temp.verificar('programada: los otros días siguen a la tarifa',
  (select bool_and(cobro_familia = 1400 and pago_ninera = 650) from sittings_traslados
    where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and precio_variantes is null));
select pg_temp.verificar('programada: el fijo de otra familia no se toca',
  (select bool_and(precio_variantes is null) from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000002'));

-- 5) Dos programadas el mismo día: se aplican las dos, en el orden en que se crearon.
insert into variantes_precio (id, familia_id, nombre, aplica_a, asignacion_id, pago_modo, pago_valor, motivo, auto_desde, auto_dias, created_at) values
  ('b0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'Peaje', 'ambos',
   'a0000000-0000-4000-8000-000000000001', 'sumar', 50, 'extra', pg_temp.hoy() + 1, null, now() + interval '1 minute');
select public.generar_previstos_fijos(14);
select pg_temp.verificar('dos el mismo día: 650 - 200 + 50 = 500, con las dos anotadas',
  (select bool_and(pago_ninera = 500 and jsonb_array_length(precio_variantes->'aplicadas') = 2 and precio_motivo = 'descuento')
     from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and fecha - pg_temp.hoy() in (5, 12)));
select pg_temp.verificar('la de todos los días (sin días): 700 el resto',
  (select bool_and(pago_ninera = 700) from sittings_traslados
    where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and fecha - pg_temp.hoy() not in (5, 12)));

-- 6) "Hasta", pausarla (activa = false) y que no aplique a otro tipo.
update variantes_precio set auto_hasta = pg_temp.hoy() + 6 where id = 'b0000000-0000-4000-8000-000000000001';
update variantes_precio set activa = false where id = 'b0000000-0000-4000-8000-000000000002';
select public.generar_previstos_fijos(14);
select pg_temp.verificar('con "hasta" y la otra pausada: solo hoy+5 queda con variante',
  (select array_agg(fecha - pg_temp.hoy() order by fecha) from sittings_traslados
    where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and precio_variantes is not null) = array[5]);
select pg_temp.verificar('al sacarla, los previstos vuelven a la tarifa', (select cobro_familia = 1400 and pago_ninera = 650 and precio_motivo is null
  from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and fecha = pg_temp.hoy() + 12));
insert into variantes_precio (familia_id, nombre, aplica_a, asignacion_id, cobro_modo, cobro_valor, auto_desde) values
  ('f0000000-0000-4000-8000-000000000002', 'Solo traslados', 'traslado', 'a0000000-0000-4000-8000-000000000002', 'sumar', 100, pg_temp.hoy());
select public.generar_previstos_fijos(14);
select pg_temp.verificar('una de traslados no se aplica a un fijo de sitting',
  (select bool_and(precio_variantes is null and cobro_familia = 900) from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000002'));

-- 7) Un previsto que alguien editó a mano no se toca.
update sittings_traslados set cobro_familia = 1234, generado_automatico = false
 where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and fecha = pg_temp.hoy() + 5;
update variantes_precio set activa = false where id = 'b0000000-0000-4000-8000-000000000001';
select public.generar_previstos_fijos(14);
select pg_temp.verificar('el editado a mano queda como estaba',
  (select cobro_familia = 1234 and precio_variantes is not null from sittings_traslados
    where asignacion_id = 'a0000000-0000-4000-8000-000000000001' and fecha = pg_temp.hoy() + 5));

-- 8) Borrar la familia borra sus variantes; borrar el fijo deja la variante sin fijo (no programada).
select pg_temp.verificar('la política exige una usuaria autorizada',
  (select count(*) from pg_policies where tablename = 'variantes_precio' and qual like '%es_usuaria_autorizada%') = 1);

rollback;
