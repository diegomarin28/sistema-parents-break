-- ============================================================================
-- Deshace 20261007_saldo_a_favor.sql. Antes guarda una copia de los ajustes cargados (si
-- había) en respaldo_ajustes_saldo_deshacer.
-- ============================================================================

begin;

create table if not exists public.respaldo_ajustes_saldo_deshacer as select * from public.ajustes_saldo;
alter table public.respaldo_ajustes_saldo_deshacer enable row level security;

alter publication supabase_realtime drop table public.ajustes_saldo;
drop table public.ajustes_saldo;

commit;
