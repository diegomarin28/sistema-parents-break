-- Deshace 20261021_pedidos_whatsapp.sql: borra las funciones precio_sitting() y
-- reservar_llamada_pedido() y las tablas pedidos_whatsapp y pedidos_whatsapp_uso (con lo que
-- tengan: si ya hay datos que importan, respaldarlos antes).
begin;
drop function if exists public.reservar_llamada_pedido(text, boolean, integer);
drop table if exists public.pedidos_whatsapp_uso;
drop function if exists public.precio_sitting(uuid, date, time without time zone, time without time zone);
alter publication supabase_realtime drop table public.pedidos_whatsapp;
drop table if exists public.pedidos_whatsapp;
commit;
