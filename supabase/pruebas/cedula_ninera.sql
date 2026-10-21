-- ============================================================================
-- Prueba de 20261021_cedula_ninera.sql en un Postgres LOCAL (nunca en producción). Datos
-- inventados. Uso: una base con supabase/schema.sql (ya trae la columna) y este archivo con psql
-- -v ON_ERROR_STOP=1, o con PGlite (scripts/probar-sql.mjs, del PR del pedido desde WhatsApp):
--   PGLITE_DIR=<carpeta> node scripts/probar-sql.mjs --schema <schema de antes> \
--     --migracion supabase/migraciones/20261021_cedula_ninera.sql supabase/pruebas/cedula_ninera.sql
-- La copia desde carsitting_datos se prueba volviendo a correr el mismo update de la migración
-- sobre datos inventados.
-- ============================================================================
begin;

create function pg_temp.verificar(caso text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', caso; end if;
  raise notice 'ok: %', caso;
end $$;

select pg_temp.verificar('ninieras tiene la columna cedula',
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ninieras' and column_name = 'cedula'));

insert into ninieras (id, nombre) values
  ('e3000000-0000-4000-8000-000000000001', 'Ana Ficticia'),
  ('e3000000-0000-4000-8000-000000000002', 'Bruno Inventado'),
  ('e3000000-0000-4000-8000-000000000003', 'Carla Ejemplo');
update ninieras set cedula = '9.876.543-2' where id = 'e3000000-0000-4000-8000-000000000003';
insert into carsitting_datos (ninera_id, cedula, created_at) values
  ('e3000000-0000-4000-8000-000000000001', '1.111.111-1', '2026-09-01'),
  ('e3000000-0000-4000-8000-000000000001', ' 1.234.567-8 ', '2026-10-01'), -- la más reciente gana, sin espacios
  ('e3000000-0000-4000-8000-000000000002', '   ', '2026-10-01'),             -- vacía: no se copia
  ('e3000000-0000-4000-8000-000000000003', '5.555.555-5', '2026-10-01');    -- ya tiene: no se pisa

-- El mismo update de la migración (la columna ya existe: "add column if not exists" no hace nada).
update public.ninieras n
   set cedula = c.cedula
  from (select distinct on (ninera_id) ninera_id, trim(cedula) as cedula
          from public.carsitting_datos
         where ninera_id is not null and coalesce(trim(cedula), '') <> ''
         order by ninera_id, created_at desc) c
 where c.ninera_id = n.id and n.cedula is null;

select pg_temp.verificar('copia la cédula más reciente del formulario de car sitting',
  (select cedula = '1.234.567-8' from ninieras where id = 'e3000000-0000-4000-8000-000000000001'));
select pg_temp.verificar('una cédula vacía no se copia',
  (select cedula is null from ninieras where id = 'e3000000-0000-4000-8000-000000000002'));
select pg_temp.verificar('no pisa una cédula ya cargada',
  (select cedula = '9.876.543-2' from ninieras where id = 'e3000000-0000-4000-8000-000000000003'));

rollback;
