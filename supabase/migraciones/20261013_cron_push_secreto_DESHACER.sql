-- Deshace 20261013_cron_push_secreto.sql. Antes, volver a publicar enviar-push-urgentes v8
-- (la que no pide clave): si no, los avisos push dejan de salir.
begin;

select cron.unschedule('enviar-push-urgentes');
select cron.schedule('enviar-push-urgentes', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://wvewzamdohrpfhpccvcz.supabase.co/functions/v1/enviar-push-urgentes',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$$);

delete from public.app_secrets where clave = 'cron_push_secret';

commit;
