-- ============================================================================
-- Prueba de 20261021_precio_a_mano.sql en un Postgres LOCAL (nunca en producción). Datos
-- inventados. Uso: PGLITE_DIR=<carpeta con pglite> node scripts/probar-sql.mjs supabase/pruebas/precio_a_mano.sql
-- Todo termina en rollback.
-- ============================================================================
begin;

create function pg_temp.verificar(caso text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', caso; end if;
  raise notice 'ok: %', caso;
end $$;
create function pg_temp.falla(sentencia text) returns boolean language plpgsql as $$
begin
  execute sentencia;
  return false;
exception when others then
  return true;
end $$;

insert into sittings_traslados (id, tipo, familia_nombre, ninera_nombre, fecha, cobro_familia, pago_ninera) values
  ('c6000000-0000-4000-8000-000000000001', 'sitting', 'Familia Prueba Uno', 'Ana Ficticia', '2026-10-10', 600, 792);
select pg_temp.verificar('un registro de antes queda sin motivo', (select precio_motivo is null from sittings_traslados where id = 'c6000000-0000-4000-8000-000000000001'));
update sittings_traslados set precio_motivo = 'descuento' where id = 'c6000000-0000-4000-8000-000000000001';
select pg_temp.verificar('descuento entra', (select precio_motivo = 'descuento' from sittings_traslados where id = 'c6000000-0000-4000-8000-000000000001'));
select pg_temp.verificar('extra, sin_servicio y otro también',
  not pg_temp.falla($$update sittings_traslados set precio_motivo = 'extra' where id = 'c6000000-0000-4000-8000-000000000001'$$)
  and not pg_temp.falla($$update sittings_traslados set precio_motivo = 'sin_servicio' where id = 'c6000000-0000-4000-8000-000000000001'$$)
  and not pg_temp.falla($$update sittings_traslados set precio_motivo = 'otro' where id = 'c6000000-0000-4000-8000-000000000001'$$));
select pg_temp.verificar('un motivo inventado no entra', pg_temp.falla($$update sittings_traslados set precio_motivo = 'regalo' where id = 'c6000000-0000-4000-8000-000000000001'$$));
select pg_temp.verificar('el cambio queda en el historial',
  exists (select 1 from sittings_historial where sitting_id = 'c6000000-0000-4000-8000-000000000001' and cambios ? 'precio_motivo'));

rollback;
