-- Deshace 20261021_carsitting_union.sql: saca el trigger, la función y las columnas telefono y
-- mail de carsitting_datos (con lo que tengan: si ya llegaron respuestas, respaldarlas antes).
-- Las uniones que ya hizo (ninera_id) quedan como están. Si carsitting-webhook v6 ya está
-- publicada, volver antes a la v5: la v6 manda celular y mail, que sin estas columnas fallan.
begin;
drop trigger if exists carsitting_vincular on public.carsitting_datos;
drop function if exists public.vincular_carsitting();
alter table public.carsitting_datos drop column if exists telefono;
alter table public.carsitting_datos drop column if exists mail;
commit;
