-- Deshace 20261021_pedidos_whatsapp.sql: borra la función precio_sitting() y la tabla
-- pedidos_whatsapp (con los tickets que tenga: si ya hay datos que importan, respaldarlos antes).
begin;
drop function if exists public.precio_sitting(uuid, date, time without time zone, time without time zone);
alter publication supabase_realtime drop table public.pedidos_whatsapp;
drop table if exists public.pedidos_whatsapp;
commit;
