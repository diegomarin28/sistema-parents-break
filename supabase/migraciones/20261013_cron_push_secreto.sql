-- ============================================================================
-- Migración 13/10/2026 (S4): solo el cron puede disparar enviar-push-urgentes.
-- Se genera una clave al azar en app_secrets ('cron_push_secret', solo la lee la clave de
-- servicio) y el cron la manda en el encabezado x-cron-secret. La Edge Function (v9) rechaza
-- los pedidos sin esa clave.
-- Orden: primero esta migración (la función de hoy ignora el encabezado: no cambia nada),
-- después se publica la función nueva.
-- Para volver atrás: 20261013_cron_push_secreto_DESHACER.sql (y volver a publicar la v8).
-- ============================================================================

begin;

create table if not exists public.respaldo_cron_20261013 as
  select jobid, jobname, schedule, command, now() as respaldado_en from cron.job where jobname = 'enviar-push-urgentes';
alter table public.respaldo_cron_20261013 enable row level security;

insert into public.app_secrets (clave, valor)
values ('cron_push_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (clave) do nothing;

-- Se saca la tarea y se vuelve a crear con el mismo nombre y horario, con el comando nuevo.
select cron.unschedule('enviar-push-urgentes');
select cron.schedule('enviar-push-urgentes', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://wvewzamdohrpfhpccvcz.supabase.co/functions/v1/enviar-push-urgentes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select valor from public.app_secrets where clave = 'cron_push_secret')
    ),
    body := '{}'::jsonb
  );
$$);

do $$
begin
  if (select count(*) from cron.job where jobname = 'enviar-push-urgentes' and command like '%x-cron-secret%') <> 1 then
    raise exception 'La tarea enviar-push-urgentes no quedó con el encabezado nuevo';
  end if;
end $$;

commit;
