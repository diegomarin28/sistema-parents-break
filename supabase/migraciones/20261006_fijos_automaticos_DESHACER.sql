-- ============================================================================
-- Deshace 20261006_fijos_automaticos.sql (la estructura). Antes hay que correr
-- _DESACTIVAR.sql si se había activado: este archivo se niega a seguir si quedan previstos.
-- Los sittings confirmados que generó el proceso quedan como sittings comunes.
-- ============================================================================

begin;

do $$
begin
  if exists (select 1 from public.sittings_traslados where estado = 'previsto') then
    raise exception 'Quedan sittings previstos: corré primero 20261006_fijos_automaticos_DESACTIVAR.sql';
  end if;
end $$;

drop function if exists public.generar_previstos_fijos(integer);

alter publication supabase_realtime drop table public.asignaciones_pausas;
drop table if exists public.asignaciones_pausas;

drop index if exists public.idx_sittings_previstos;
drop index if exists public.sittings_fijo_dia_automatico;
alter table public.sittings_traslados drop constraint if exists sittings_traslados_estado_check;
alter table public.sittings_traslados
  drop column if exists revisado_at,
  drop column if exists generado_automatico,
  drop column if exists estado;

alter table public.asignaciones
  drop column if exists pago_traslado,
  drop column if exists cobro_traslado;

delete from public.app_config where id = 'fijos_automaticos';

-- El respaldo public.respaldo_sittings_traslados_20261006 se deja: se borra a mano cuando
-- ya no haga falta.

commit;
