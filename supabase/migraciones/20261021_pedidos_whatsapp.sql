-- ============================================================================
-- Migración 21/10/2026: pedido desde WhatsApp (la parte de atrás, sin pantalla todavía).
--
-- 1) pedidos_whatsapp: el ticket que arma la Edge Function pedido-whatsapp a partir del texto
--    que una admin pega de los mensajes de una madre. Queda como borrador hasta que una admin lo
--    confirma (y recién ahí se crea la solicitud) o lo descarta. Guarda el texto pegado y la
--    respuesta del modelo para poder revisar qué se entendió.
-- 2) precio_sitting(): cobro y pago de un sitting con la tarifa de la familia y las reglas de
--    siempre (fin redondeado si aceptó los términos, montos sin centavos), la misma cuenta que
--    generar_previstos_fijos. La usa la función para el precio estimado del ticket.
-- 3) Tope diario: pedidos_whatsapp_uso anota cada llamada al modelo (los pedidos guardados y las
--    pruebas con probar, que no se guardan) y reservar_llamada_pedido() no deja pasar más de las
--    del tope en el día de Montevideo, entre todas las cuentas. La clave de Anthropic se paga por
--    uso: es el freno si algo llama en loop.
--
-- Compatible con la app publicada: solo agrega tablas y funciones nuevas; no toca nada que
-- la app use. No modifica filas, así que no hace falta respaldo. Se deshace con
-- 20261021_pedidos_whatsapp_DESHACER.sql.
-- ============================================================================
begin;

create table public.pedidos_whatsapp (
  id uuid default gen_random_uuid() not null,
  creado_el timestamp with time zone default now() not null,
  creado_por text,
  texto text not null,
  estado text default 'borrador'::text not null,
  tipo text,
  familia_id uuid,
  familia_texto text,
  servicio text,
  fecha date,
  hora_inicio time without time zone,
  hora_fin time without time zone,
  termina_dia_siguiente boolean default false not null,
  horario_aproximado boolean default false not null,
  horario_nota text,
  chicos_cantidad integer,
  chicos_edades text,
  zona text,
  notas text,
  dudas jsonb default '[]'::jsonb not null,
  cobro_estimado numeric,
  pago_estimado numeric,
  solicitud_id uuid,
  modelo text,
  respuesta jsonb,
  tokens_entrada integer,
  tokens_salida integer,
  constraint pedidos_whatsapp_pkey PRIMARY KEY (id),
  constraint pedidos_whatsapp_texto_check CHECK ((char_length(texto) between 1 and 6000)),
  constraint pedidos_whatsapp_estado_check CHECK ((estado = ANY (ARRAY['borrador'::text, 'confirmado'::text, 'descartado'::text]))),
  constraint pedidos_whatsapp_tipo_check CHECK ((tipo = ANY (ARRAY['pedido_nuevo'::text, 'cambio'::text, 'cancelacion'::text, 'otra_cosa'::text]))),
  constraint pedidos_whatsapp_servicio_check CHECK ((servicio = ANY (ARRAY['sitting'::text, 'traslado'::text]))),
  constraint pedidos_whatsapp_chicos_check CHECK ((chicos_cantidad between 1 and 12))
);
alter table public.pedidos_whatsapp add constraint pedidos_whatsapp_familia_id_fkey FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE SET NULL;
alter table public.pedidos_whatsapp add constraint pedidos_whatsapp_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL;
create index pedidos_whatsapp_creado_el_idx on public.pedidos_whatsapp using btree (creado_el desc);
create index pedidos_whatsapp_familia_id_idx on public.pedidos_whatsapp using btree (familia_id);
create index pedidos_whatsapp_solicitud_id_idx on public.pedidos_whatsapp using btree (solicitud_id);
alter table public.pedidos_whatsapp enable row level security;
-- La app (la pantalla que viene) lee, confirma y descarta; la función escribe con la clave de servicio.
create policy solo_autenticados_todo on public.pedidos_whatsapp as permissive for all to public
  using ((select public.es_usuaria_autorizada())) with check ((select public.es_usuaria_autorizada()));
alter publication supabase_realtime add table public.pedidos_whatsapp;

-- Cobro y pago de un sitting según la tarifa de la familia (21/10/2026). Misma cuenta que
-- generar_previstos_fijos: un fin igual o antes del inicio es al día siguiente; a la familia que
-- aceptó los términos, desde ese día, se le cobra con el fin redondeado (minutos_fin_cobro); a
-- la niñera, la hora real; montos con redondear_cobro / redondear_pago. Sin tarifa, ese monto
-- va vacío. Es la misma regla que precioSegunHorario() en js/sittings.js (lo prueba
-- supabase/pruebas/paridad_plata.sql): si cambia una, cambia la otra.
create or replace function public.precio_sitting(p_familia_id uuid, p_fecha date, p_hora_inicio time without time zone, p_hora_fin time without time zone)
returns table (horas numeric, horas_cobro numeric, cobro numeric, pago numeric)
language sql
stable
set search_path to ''
as $function$
  with h as (
    select f.cobro_hora, f.pago_hora,
           (extract(epoch from p_hora_fin) - extract(epoch from p_hora_inicio)) / 3600.0
             + case when p_hora_fin <= p_hora_inicio then 24 else 0 end as horas,
           case when f.terminos_aceptados_el is null or p_fecha < f.terminos_aceptados_el then null
                else greatest(public.minutos_fin_cobro(
                       (extract(epoch from p_hora_fin) / 60)::integer
                       + case when p_hora_fin <= p_hora_inicio then 1440 else 0 end)
                     - (extract(epoch from p_hora_inicio) / 60)::integer, 0) / 60.0
           end as horas_cobro
      from public.familias f
     where f.id = p_familia_id and p_hora_inicio is not null and p_hora_fin is not null
  )
  select h.horas, coalesce(h.horas_cobro, h.horas),
         case when coalesce(h.cobro_hora, 0) > 0 then public.redondear_cobro(coalesce(h.horas_cobro, h.horas) * h.cobro_hora) end,
         case when coalesce(h.pago_hora, 0) > 0 then public.redondear_pago(h.horas * h.pago_hora) end
    from h
$function$;
revoke execute on function public.precio_sitting(uuid, date, time without time zone, time without time zone) from public, anon, authenticated;

-- Tope diario de llamadas al modelo (21/10/2026). Una fila por llamada, se guarde o no el pedido.
create table public.pedidos_whatsapp_uso (
  id uuid default gen_random_uuid() not null,
  creado_el timestamp with time zone default now() not null,
  creado_por text,
  probar boolean default false not null,
  tokens_entrada integer,
  tokens_salida integer,
  constraint pedidos_whatsapp_uso_pkey PRIMARY KEY (id)
);
create index pedidos_whatsapp_uso_creado_el_idx on public.pedidos_whatsapp_uso using btree (creado_el);
alter table public.pedidos_whatsapp_uso enable row level security;
-- Solo lectura para las admin (la pantalla puede mostrar cuántas quedan); escribe la función.
create policy solo_autorizadas_leer on public.pedidos_whatsapp_uso as permissive for select to public
  using ((select public.es_usuaria_autorizada()));

-- Reserva una llamada si hoy (en Montevideo) van menos de p_tope entre todas las cuentas, y
-- devuelve su id; si ya se llegó, null y no anota nada. El candado hace que dos pedidos al mismo
-- tiempo no pasen los dos con 99. Se reserva antes de llamar al modelo, así que una llamada que
-- después falla igual cuenta (mejor de más que de menos).
create or replace function public.reservar_llamada_pedido(p_creado_por text, p_probar boolean, p_tope integer)
returns uuid
language plpgsql
volatile
set search_path to ''
as $function$
declare
  v_id uuid;
  v_desde timestamp with time zone := date_trunc('day', now() at time zone 'America/Montevideo') at time zone 'America/Montevideo';
begin
  perform pg_advisory_xact_lock(hashtext('public.reservar_llamada_pedido'));
  if (select count(*) from public.pedidos_whatsapp_uso where creado_el >= v_desde) >= p_tope then
    return null;
  end if;
  insert into public.pedidos_whatsapp_uso (creado_por, probar) values (p_creado_por, coalesce(p_probar, false))
  returning id into v_id;
  return v_id;
end
$function$;
revoke execute on function public.reservar_llamada_pedido(text, boolean, integer) from public, anon, authenticated;

commit;
