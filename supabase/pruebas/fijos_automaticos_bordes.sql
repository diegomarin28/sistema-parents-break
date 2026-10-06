-- ============================================================================
-- Casos borde de generar_previstos_fijos en un Postgres LOCAL (nunca en producción).
-- Complementa fijos_automaticos.sql: acá el "hoy" de la función se fija a mano para probar
-- fin de mes y de año, pausas que cruzan semanas, cambios desde una fecha futura, etc.
-- Para eso se arma una COPIA de la función en pg_temp (la de public no se toca) con el
-- "hoy" leído de pg_temp.reloj. Datos inventados. Todo termina en rollback.
-- Uso: igual que fijos_automaticos.sql (base con schema.sql + la migración aplicada).
-- ============================================================================
begin;

create temporary table reloj (hoy date);
insert into reloj values ('2026-10-06');
do $$
declare def text;
begin
  def := pg_get_functiondef('public.generar_previstos_fijos(integer)'::regprocedure);
  def := replace(def, 'public.generar_previstos_fijos(', 'pg_temp.generar_con_reloj(');
  def := replace(def, '(now() at time zone ''America/Montevideo'')::date', '(select r.hoy from pg_temp.reloj r)');
  if position('pg_temp.reloj' in def) = 0 then raise exception 'no se pudo fijar el reloj de la copia'; end if;
  execute def;
end $$;

create function pg_temp.verificar(caso text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', caso; end if;
  raise notice 'ok: %', caso;
end $$;
create temporary table _resultado (r jsonb);
create function pg_temp.correr(dia date) returns jsonb language plpgsql as $$
declare x jsonb;
begin
  update pg_temp.reloj set hoy = dia;
  x := pg_temp.generar_con_reloj(14);
  delete from _resultado; insert into _resultado values (x);
  return x;
end $$;
create function pg_temp.ultimo(k text) returns integer language sql as $$ select (r->>k)::integer from _resultado $$;
create function pg_temp.fechas(asig uuid) returns text language sql as $$
  select coalesce(string_agg(to_char(fecha, 'DD/MM'), ' ' order by fecha), '') from sittings_traslados where asignacion_id = asig $$;

insert into familias (id, nombre, cobro_hora, pago_hora) values
  ('f0000000-0000-4000-8000-000000000001', 'Familia Prueba Uno', 300, 200),
  ('f0000000-0000-4000-8000-000000000002', 'Familia Prueba Dos', 300, 200);
insert into ninieras (id, nombre) values
  ('e0000000-0000-4000-8000-000000000001', 'Ana Ficticia'),
  ('e0000000-0000-4000-8000-000000000002', 'Bruno Inventado');

-- 1. Fin de año: viernes 25/12/2026, fijo lunes y miércoles. La ventana (26/12 a 08/01)
--    cruza el año; los días de la semana tienen que seguir dando bien.
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","X"]', '16:00', '19:00', '2026-12-01', 'sitting');
select pg_temp.correr('2026-12-25');
select pg_temp.verificar('fin de año: lunes y miércoles de los dos años', pg_temp.fechas('a0000000-0000-4000-8000-000000000001') = '28/12 30/12 04/01 06/01');
select pg_temp.verificar('fin de año: todo previsto', (select bool_and(estado = 'previsto') from sittings_traslados));
-- Llega el 28/12: se confirma solo ese día y se agrega el próximo miércoles (13/01? no: la ventana llega al 11/01, que es lunes).
select pg_temp.correr('2026-12-28');
select pg_temp.verificar('día siguiente: confirma el 28/12 y suma el 11/01', pg_temp.ultimo('confirmados') = 1 and pg_temp.ultimo('creados') = 1
  and pg_temp.fechas('a0000000-0000-4000-8000-000000000001') = '28/12 30/12 04/01 06/01 11/01');
delete from sittings_traslados; delete from asignaciones;

-- 2. Fin de febrero (2027 no es bisiesto): fijo de todos los días.
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '16:00', '19:00', '2027-01-01', 'sitting');
select pg_temp.correr('2027-02-20');
select pg_temp.verificar('fin de febrero: 14 días, del 21/02 al 06/03, sin 29/02', pg_temp.ultimo('creados') = 14
  and (select min(fecha) = '2027-02-21' and max(fecha) = '2027-03-06' from sittings_traslados)
  and exists (select 1 from sittings_traslados where fecha = '2027-02-28') and exists (select 1 from sittings_traslados where fecha = '2027-03-01'));
-- Dos corridas seguidas el mismo día no cambian nada.
select pg_temp.correr('2027-02-20');
select pg_temp.verificar('dos corridas seguidas: nada', pg_temp.ultimo('creados') + pg_temp.ultimo('actualizados') + pg_temp.ultimo('borrados') + pg_temp.ultimo('confirmados') = 0);
-- Un día sin correr (la de las 03:00 falló): al otro día confirma los dos días que pasaron.
select pg_temp.correr('2027-02-23');
select pg_temp.verificar('un día sin correr: confirma los atrasados', pg_temp.ultimo('confirmados') = 3 and pg_temp.ultimo('creados') = 3
  and (select count(*) from sittings_traslados where estado = 'confirmado') = 3);
delete from sittings_traslados; delete from asignaciones;

-- 3. Pausa que cruza semanas: martes 06/10/2026, fijo lunes y miércoles, pausa del miércoles
--    07/10 al lunes 19/10. Quedan solo el 05/10 (ya pasó, no está) y el 21/10 en adelante.
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","X"]', '16:00', '19:00', '2026-09-01', 'sitting');
select pg_temp.correr('2026-10-06');
select pg_temp.verificar('sin pausa: 07 12 14 19', pg_temp.fechas('a0000000-0000-4000-8000-000000000003') = '07/10 12/10 14/10 19/10');
-- El 14/10 alguien le cambió el horario a mano antes de la pausa.
update sittings_traslados set hora_fin = '20:00', cobro_familia = 1200, pago_ninera = 800, generado_automatico = false where fecha = '2026-10-14';
insert into asignaciones_pausas (asignacion_id, desde, hasta) values ('a0000000-0000-4000-8000-000000000003', '2026-10-07', '2026-10-19');
select pg_temp.correr('2026-10-06');
select pg_temp.verificar('pausa: borra 3 automáticos de las dos semanas', pg_temp.ultimo('borrados') = 3);
select pg_temp.verificar('pausa: el editado a mano queda (lo decide la app)', pg_temp.fechas('a0000000-0000-4000-8000-000000000003') = '14/10');
-- Pasa la pausa: la ventana del 13/10 ya llega al 27/10.
select pg_temp.correr('2026-10-13');
select pg_temp.verificar('después de la pausa: 21 26 y el editado', pg_temp.fechas('a0000000-0000-4000-8000-000000000003') = '14/10 21/10 26/10');
-- Ojo: el editado a mano dentro de la pausa, si nadie lo borra, se confirma el día que llega.
select pg_temp.correr('2026-10-14');
select pg_temp.verificar('editado dentro de la pausa: se confirma igual (la app avisa al pausar)', (select estado from sittings_traslados where fecha = '2026-10-14') = 'confirmado');
delete from sittings_traslados; delete from asignaciones_pausas; delete from asignaciones;

-- 4. Cambio de tarifa con previstos cargados: los ya confirmados (pasados) no cambian.
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V","S","D"]', '16:00', '19:00', '2026-09-01', 'sitting');
select pg_temp.correr('2026-10-06');
select pg_temp.correr('2026-10-08'); -- 07 y 08 confirmados
update familias set cobro_hora = 350, pago_hora = 230 where id = 'f0000000-0000-4000-8000-000000000001';
select pg_temp.correr('2026-10-08');
select pg_temp.verificar('tarifa nueva: recalcula solo los 14 futuros', pg_temp.ultimo('actualizados') = 14
  and (select bool_and(cobro_familia = 1050 and pago_ninera = 690) from sittings_traslados where fecha > '2026-10-08')
  and (select bool_and(cobro_familia = 900 and pago_ninera = 600) from sittings_traslados where fecha <= '2026-10-08'));
-- Tarifa con decimales: redondea a pesos enteros.
update familias set cobro_hora = 333.33 where id = 'f0000000-0000-4000-8000-000000000001';
select pg_temp.correr('2026-10-08');
select pg_temp.verificar('tarifa con decimales: redondea (3 h × 333,33 = 1000)', (select bool_and(cobro_familia = 1000) from sittings_traslados where fecha > '2026-10-08'));
-- Familia sin tarifa: el previsto queda en $0 (la app tiene que avisarlo).
update familias set cobro_hora = null, pago_hora = null where id = 'f0000000-0000-4000-8000-000000000001';
select pg_temp.correr('2026-10-08');
select pg_temp.verificar('familia sin tarifa: previstos en $0', (select bool_and(cobro_familia = 0 and pago_ninera = 0) from sittings_traslados where fecha > '2026-10-08'));
update familias set cobro_hora = 300, pago_hora = 200 where id = 'f0000000-0000-4000-8000-000000000001';
delete from sittings_traslados; delete from asignaciones;

-- 5. Cambio de niñera desde una fecha futura (con un reemplazo cargado a mano después de esa fecha).
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","X"]', '16:00', '19:00', '2026-09-01', 'sitting');
select pg_temp.correr('2026-10-06');
update sittings_traslados set ninera_id = 'e0000000-0000-4000-8000-000000000002', ninera_nombre = 'Bruno Inventado', generado_automatico = false where fecha = '2026-10-19';
-- Desde el lunes 12/10 la hace Bruno: la app cierra el fijo el 11/10 y abre otro.
update asignaciones set vigente_hasta = '2026-10-11' where id = 'a0000000-0000-4000-8000-000000000005';
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'Bruno Inventado',
   '["L","X"]', '16:00', '19:00', '2026-10-12', 'sitting');
select pg_temp.correr('2026-10-06');
select pg_temp.verificar('niñera nueva desde el 12: el viejo conserva el 07 y el editado', pg_temp.fechas('a0000000-0000-4000-8000-000000000005') = '07/10 19/10');
select pg_temp.verificar('niñera nueva desde el 12: el nuevo tiene 12 14 19', pg_temp.fechas('a0000000-0000-4000-8000-000000000006') = '12/10 14/10 19/10');
select pg_temp.verificar('el 19/10 quedan DOS filas si nadie borra el editado (la app lo pregunta)', (select count(*) from sittings_traslados where fecha = '2026-10-19') = 2);
delete from sittings_traslados; delete from asignaciones;

-- 6. Fijo que termina en medio de la ventana y otro que empieza en medio de la ventana.
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, vigente_hasta, tipo) values
  ('a0000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["L","M","X","J","V"]', '08:00', '12:00', '2026-09-01', '2026-10-09', 'sitting'),
  ('a0000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'Bruno Inventado',
   '["V"]', '18:00', '21:00', '2026-10-16', null, 'sitting');
select pg_temp.correr('2026-10-06');
select pg_temp.verificar('termina el viernes 09: 07 08 09', pg_temp.fechas('a0000000-0000-4000-8000-000000000007') = '07/10 08/10 09/10');
select pg_temp.verificar('empieza el viernes 16: solo 16', pg_temp.fechas('a0000000-0000-4000-8000-000000000008') = '16/10');
delete from sittings_traslados; delete from asignaciones;

-- 7. Horario que cruza la medianoche: de 21 a 01 (4 h) y de 20 a 20 (se toma como 24 h).
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia',
   '["V"]', '21:00', '01:00', '2026-09-01', 'sitting'),
  ('a0000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'Bruno Inventado',
   '["S"]', '20:00', '00:00', '2026-09-01', 'sitting');
select pg_temp.correr('2026-10-06');
select pg_temp.verificar('21 a 01: 4 h, termina al día siguiente, fecha = día en que empieza', (select bool_and(termina_dia_siguiente and cobro_familia = 1200 and pago_ninera = 800 and extract(dow from fecha) = 5) from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000009'));
select pg_temp.verificar('20 a 00: 4 h y termina al día siguiente', (select bool_and(termina_dia_siguiente and cobro_familia = 1200) from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000010'));
delete from sittings_traslados; delete from asignaciones;

-- 8. Fijo sin hora de fin (sitting): queda en $0. Fijo sin días (lista vacía): no carga nada.
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
  ('a0000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Ana Ficticia', '["L"]', '16:00', null, '2026-09-01', 'sitting'),
  ('a0000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'Bruno Inventado', '[]', '16:00', '19:00', '2026-09-01', 'sitting');
select pg_temp.correr('2026-10-06');
select pg_temp.verificar('sitting sin hora de fin: $0', (select bool_and(cobro_familia = 0) from sittings_traslados where asignacion_id = 'a0000000-0000-4000-8000-000000000011'));
select pg_temp.verificar('sin días: nada', pg_temp.fechas('a0000000-0000-4000-8000-000000000012') = '');
delete from sittings_traslados; delete from asignaciones;

-- 9. Vigencia al revés (hasta antes que desde): la base no la deja guardar.
select pg_temp.verificar('vigencia al revés: la frena la base', exists (select 1 from pg_constraint where conname = 'asignaciones_vigencia_check'));

rollback;
