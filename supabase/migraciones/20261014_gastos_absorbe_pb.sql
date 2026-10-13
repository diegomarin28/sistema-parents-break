-- ============================================================================
-- Migración 14/10/2026: gastos extra que absorbe Parents Break (por ejemplo, un Uber porque
-- algo salió mal). No se le cobran a la familia, se le reintegran a la niñera que lo pagó y
-- bajan el resultado del mes en Finanzas. No van al PDF de la familia.
-- Solo agrega una columna con valor por defecto: la app publicada la ignora.
-- Para volver atrás: 20261014_gastos_absorbe_pb_DESHACER.sql.
-- ============================================================================
begin;

alter table public.gastos_extra add column if not exists absorbe_pb boolean not null default false;
comment on column public.gastos_extra.absorbe_pb is 'Lo absorbe Parents Break: no se cobra a la familia; se reintegra a la niñera y resta del resultado del mes.';

commit;
