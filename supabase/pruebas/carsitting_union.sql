-- ============================================================================
-- Prueba de 20261021_carsitting_union.sql en un Postgres LOCAL (nunca en producción): cómo se
-- une sola una respuesta del formulario de car sitting con su niñera (vincular_carsitting).
-- Datos inventados.
-- Uso: PGLITE_DIR=<carpeta con pglite> node scripts/probar-sql.mjs supabase/pruebas/carsitting_union.sql
-- (o en psql -v ON_ERROR_STOP=1 sobre una base creada con supabase/schema.sql). Todo termina en
-- rollback.
-- ============================================================================
begin;

create function pg_temp.verificar(caso text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', caso; end if;
  raise notice 'ok: %', caso;
end $$;
-- A quién quedó unida una respuesta (por el nombre que escribió en el formulario).
create function pg_temp.unida(p_nombre text) returns uuid language sql as $$
  select ninera_id from public.carsitting_datos where nombre_completo = p_nombre
$$;

insert into candidatas (id, nombre, apellido, mail) values
  ('c3000000-0000-4000-8000-000000000001', 'Ana', 'Ficticia', 'Ana.Ficticia@Ejemplo.test'),
  ('c3000000-0000-4000-8000-000000000002', 'Carla', 'Ejemplo', 'carla@ejemplo.test'),
  ('c3000000-0000-4000-8000-000000000003', 'Carla', 'Repetida', 'carla@ejemplo.test');
insert into ninieras (id, nombre, telefono, candidata_id, activa, tipo) values
  ('e3000000-0000-4000-8000-000000000001', 'Ana Ficticia', '098 000 001', 'c3000000-0000-4000-8000-000000000001', true, 'Ambas'),
  ('e3000000-0000-4000-8000-000000000002', 'Bruno Inventado', '+598 98 000 002', null, true, 'Traslados'),
  ('e3000000-0000-4000-8000-000000000003', 'Carla Ejemplo', '098000003', 'c3000000-0000-4000-8000-000000000002', true, 'Ambas'),
  ('e3000000-0000-4000-8000-000000000004', 'Carla Repetida', '098000004', 'c3000000-0000-4000-8000-000000000003', true, 'Niñera'),
  ('e3000000-0000-4000-8000-000000000005', 'Dora Vieja', '098000005', null, false, 'Traslados'),
  ('e3000000-0000-4000-8000-000000000006', 'Dora Nueva', '098000005', null, true, 'Traslados'),
  ('e3000000-0000-4000-8000-000000000007', 'Elena Sola Inactiva', '098000007', null, false, 'Traslados'),
  ('e3000000-0000-4000-8000-000000000008', 'José Ñúñez', null, null, true, 'Traslados'),
  ('e3000000-0000-4000-8000-000000000009', 'Fabi Doble', '098000009', null, true, 'Ambas'),
  ('e3000000-0000-4000-8000-000000000010', 'Fabi Doble', '098000010', null, true, 'Ambas');

-- 1) Celular, en cualquier formato.
insert into carsitting_datos (nombre_completo, telefono) values
  ('María Ana F.', '098000001'),             -- nombre distinto, mismo celular que Ana
  ('Bruno', '098 000 002'),                  -- la ficha lo tiene con +598
  ('Carlita', '+59898000003');
select pg_temp.verificar('celular igual con otro nombre: Ana', pg_temp.unida('María Ana F.') = 'e3000000-0000-4000-8000-000000000001');
select pg_temp.verificar('098 000 002 es el +598 98 000 002 de la ficha: Bruno', pg_temp.unida('Bruno') = 'e3000000-0000-4000-8000-000000000002');
select pg_temp.verificar('+59898000003 es el 098000003: Carla', pg_temp.unida('Carlita') = 'e3000000-0000-4000-8000-000000000003');

-- 2) Dos niñeras con el mismo celular: gana la activa; si la única es inactiva, esa.
insert into carsitting_datos (nombre_completo, telefono) values ('Dora', '098000005'), ('Elena', '098000007');
select pg_temp.verificar('celular de una activa y una inactiva: la activa', pg_temp.unida('Dora') = 'e3000000-0000-4000-8000-000000000006');
select pg_temp.verificar('celular de una sola inactiva: esa', pg_temp.unida('Elena') = 'e3000000-0000-4000-8000-000000000007');

-- 3) Mail (el de la candidata), sin importar mayúsculas ni espacios.
insert into carsitting_datos (nombre_completo, mail) values ('A. F.', '  ana.ficticia@ejemplo.TEST ');
select pg_temp.verificar('mail con otras mayúsculas: Ana', pg_temp.unida('A. F.') = 'e3000000-0000-4000-8000-000000000001');
insert into carsitting_datos (nombre_completo, mail) values ('C. E.', 'carla@ejemplo.test');
select pg_temp.verificar('mail de dos niñeras activas: no adivina', pg_temp.unida('C. E.') is null);

-- 4) Nombre, como antes: sin tildes, mayúsculas ni espacios de más.
insert into carsitting_datos (nombre_completo) values ('  jose   ÑUÑEZ ');
select pg_temp.verificar('nombre con tildes y espacios: José Ñúñez', pg_temp.unida('  jose   ÑUÑEZ ') = 'e3000000-0000-4000-8000-000000000008');
insert into carsitting_datos (nombre_completo) values ('fabi doble');
select pg_temp.verificar('nombre de dos activas: no adivina', pg_temp.unida('fabi doble') is null);

-- 5) El celular manda sobre el nombre; un celular que no es de nadie sigue con el nombre.
insert into carsitting_datos (nombre_completo, telefono) values ('Bruno Inventado ', '098000003');
select pg_temp.verificar('celular de Carla aunque escribió el nombre de Bruno: Carla',
  (select ninera_id from carsitting_datos where nombre_completo = 'Bruno Inventado ') = 'e3000000-0000-4000-8000-000000000003');
insert into carsitting_datos (nombre_completo, telefono) values ('Ana Ficticia', '091 999 999');
select pg_temp.verificar('celular desconocido y nombre exacto: Ana', pg_temp.unida('Ana Ficticia') = 'e3000000-0000-4000-8000-000000000001');
insert into carsitting_datos (nombre_completo, telefono) values ('Nadie Conocida', '12345');
select pg_temp.verificar('nada coincide (y un celular corto no cuenta): sin identificar', pg_temp.unida('Nadie Conocida') is null);

-- 6) Lo hecho a mano no se pisa.
insert into carsitting_datos (nombre_completo, telefono, ninera_id) values ('Unida a mano', '098000001', 'e3000000-0000-4000-8000-000000000002');
select pg_temp.verificar('si ya viene unida, la deja como está', pg_temp.unida('Unida a mano') = 'e3000000-0000-4000-8000-000000000002');
update carsitting_datos set ninera_id = 'e3000000-0000-4000-8000-000000000009' where nombre_completo = 'fabi doble';
select pg_temp.verificar('unir a mano una sin identificar', pg_temp.unida('fabi doble') = 'e3000000-0000-4000-8000-000000000009');
update carsitting_datos set ninera_id = null where nombre_completo = 'María Ana F.';
select pg_temp.verificar('desunir a mano no la vuelve a unir sola', pg_temp.unida('María Ana F.') is null);

-- 7) Si le corrigen el celular a una sin identificar, se une.
update carsitting_datos set telefono = '098000002' where nombre_completo = 'Nadie Conocida';
select pg_temp.verificar('corregir el celular de una sin identificar la une', pg_temp.unida('Nadie Conocida') = 'e3000000-0000-4000-8000-000000000002');

select pg_temp.verificar('las columnas nuevas están y la tabla sigue con RLS',
  (select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'carsitting_datos' and column_name in ('telefono', 'mail'))
  and (select relrowsecurity from pg_class where oid = 'public.carsitting_datos'::regclass));

rollback;
