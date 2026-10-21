-- ============================================================================
-- Migración 21/10/2026: marca de precio puesto a mano, con su motivo.
--
-- Revisando octubre aparecieron registros cuyo cobro no es horas × tarifa (con la regla de
-- términos y redondeo), sin forma de saber si fue a propósito (un descuento) o un error. Desde
-- ahora, cuando el precio de un sitting no coincide con el de la tarifa, la app pide por qué y lo
-- guarda acá: 'descuento', 'extra', 'sin_servicio' (se cobra aunque no hubo servicio) u 'otro'
-- (el detalle va en las notas). Vacío = el precio es el de la tarifa.
--
-- Compatible con la app publicada: columna nueva y vacía, que la app de hoy no usa. No modifica
-- filas (los registros de octubre quedan como están, a pedido de Diego): no hace falta respaldo.
-- Los cambios quedan en sittings_historial como siempre (trigger). Se deshace con
-- 20261021_precio_a_mano_DESHACER.sql.
-- ============================================================================
begin;

alter table public.sittings_traslados add column if not exists precio_motivo text;
alter table public.sittings_traslados drop constraint if exists sittings_traslados_precio_motivo_check;
alter table public.sittings_traslados add constraint sittings_traslados_precio_motivo_check
  CHECK ((precio_motivo = ANY (ARRAY['descuento'::text, 'extra'::text, 'sin_servicio'::text, 'otro'::text])));

commit;
