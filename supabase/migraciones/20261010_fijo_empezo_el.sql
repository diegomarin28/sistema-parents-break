-- ============================================================================
-- Migración 10/10/2026: fecha real de inicio de un fijo ("empezó el"). Aprobada por Diego el
-- 05/10/2026 (propuesta 3f).
--
-- Algunos fijos empezaron antes de que existiera la app (sus meses están en los Docs de
-- Drive). vigente_desde sigue siendo desde cuándo se registra en la app: si se la llevara a
-- la fecha real, la Agenda dibujaría todos esos meses como días sin registrar. La fecha real
-- va aparte, solo para mostrarla en la ficha.
--
-- Compatible con la app publicada: una columna vacía que la app vieja no lee.
-- Para volver atrás: 20261010_fijo_empezo_el_DESHACER.sql.
-- ============================================================================

begin;

alter table public.asignaciones add column inicio_real date;

commit;
