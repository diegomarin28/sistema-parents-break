-- ============================================================================
-- Deshace 20261008_gastos_extra.sql. Guarda antes una copia de los gastos cargados en
-- respaldo_gastos_extra_deshacer. Los archivos del bucket "comprobantes" NO se borran desde
-- SQL: si hace falta, se borran desde el panel de Storage y después se borra el bucket.
-- ============================================================================

begin;

create table if not exists public.respaldo_gastos_extra_deshacer as select * from public.gastos_extra;
alter table public.respaldo_gastos_extra_deshacer enable row level security;

alter publication supabase_realtime drop table public.gastos_extra;
drop table public.gastos_extra;

drop policy if exists comprobantes_autenticados_leer on storage.objects;
drop policy if exists comprobantes_autenticados_subir on storage.objects;
drop policy if exists comprobantes_autenticados_borrar on storage.objects;

commit;
