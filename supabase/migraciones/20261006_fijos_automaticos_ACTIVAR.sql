-- ============================================================================
-- Fijos automáticos: ACTIVAR (06/10/2026). NO EJECUTADO: necesita el OK de Diego.
-- Correr recién DESPUÉS de mergear y publicar el PR de fijos automáticos (con la app vieja,
-- los previstos se verían como sittings ya hechos).
--
-- 1) Prende la marca que lee la app (app_config 'fijos_automaticos').
-- 2) Programa el proceso diario: 06:00 UTC = 03:00 de Montevideo (Uruguay no tiene horario
--    de verano desde 2015).
-- 3) Lo corre una vez para cargar ya los próximos 14 días.
-- ============================================================================

begin;

insert into public.app_config (id, valor, actualizado_at)
values ('fijos_automaticos', '{"activo": true, "dias": 14}'::jsonb, now())
on conflict (id) do update set valor = excluded.valor, actualizado_at = now();

select cron.schedule('generar-previstos-fijos', '0 6 * * *', $$select public.generar_previstos_fijos(14);$$);

select public.generar_previstos_fijos(14);

commit;
