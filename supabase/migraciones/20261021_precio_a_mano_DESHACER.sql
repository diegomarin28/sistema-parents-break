-- Deshace 20261021_precio_a_mano.sql: saca la columna precio_motivo (con los motivos que se
-- hayan cargado: si importan, respaldarlos antes). Si la app nueva ya está publicada, sigue
-- andando: sin la columna guarda sin el motivo y avisa.
begin;
alter table public.sittings_traslados drop constraint if exists sittings_traslados_precio_motivo_check;
alter table public.sittings_traslados drop column if exists precio_motivo;
commit;
