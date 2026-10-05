-- ============================================================================
-- Fijos automáticos: DESACTIVAR (deshace _ACTIVAR). Vuelve al funcionamiento de antes:
-- los fijos solo se dibujan en la Agenda y se registran a mano.
--
-- - Apaga el proceso diario y la marca de la app.
-- - Borra los previstos automáticos que todavía no pasaron y que nadie tocó.
-- - Los previstos que alguien editó a mano quedan como sittings confirmados (se ven en
--   Sittings y en Finanzas, como cualquier sitting cargado por adelantado).
-- - Lo que ya pasó (confirmado) no se toca.
-- ============================================================================

begin;

select cron.unschedule('generar-previstos-fijos') where exists (select 1 from cron.job where jobname = 'generar-previstos-fijos');

update public.app_config set valor = '{"activo": false}'::jsonb, actualizado_at = now() where id = 'fijos_automaticos';

delete from public.sittings_traslados
 where generado_automatico and estado = 'previsto'
   and fecha > (now() at time zone 'America/Montevideo')::date;

update public.sittings_traslados set estado = 'confirmado' where estado = 'previsto';

commit;
