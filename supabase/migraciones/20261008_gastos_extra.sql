-- ============================================================================
-- Migración 08/10/2026: gastos extra con comprobante. NO EJECUTADA: necesita el OK de
-- Diego. Va DESPUÉS de 20261007_saldo_a_favor.sql (usa ajustes_saldo).
--
-- Pedido del 05/10/2026 (caso real: la niñera de un fijo de traslados compra comida para la
-- niña con su plata). Al cargar o editar un sitting o traslado se agregan gastos extra
-- (concepto, monto, foto del ticket obligatoria) diciendo quién los pagó:
--   - la niñera: se le cobra a la familia tal cual (sin recargo) y se le reintegra a la
--     niñera en su pago;
--   - la familia (por ejemplo un Uber que pagó ella): queda como saldo a favor de la familia.
-- No cuentan como ganancia ni margen. Los tickets van a un bucket PRIVADO: solo los ven las
-- usuarias logueadas, con un link que vence.
--
-- Compatible con la app publicada: solo agrega una tabla y un bucket que la app vieja no usa.
-- Para volver atrás: 20261008_gastos_extra_DESHACER.sql.
-- ============================================================================

begin;

create table public.gastos_extra (
  id uuid default gen_random_uuid() primary key,
  sitting_id uuid not null references public.sittings_traslados(id) on delete cascade,
  concepto text not null,
  monto numeric not null,
  pagado_por text not null,
  -- Ruta del ticket en el bucket privado "comprobantes" (sitting_id/archivo).
  comprobante text not null,
  -- Lo pagó la niñera: si ya se le cobró a la familia y si ya se le devolvió a la niñera.
  cobrado boolean default false not null,
  reintegrado boolean default false not null,
  -- Lo pagó la familia: el ajuste de saldo a favor que generó.
  ajuste_id uuid references public.ajustes_saldo(id) on delete set null,
  creado_por text,
  created_at timestamp with time zone default now() not null,
  constraint gastos_extra_monto_check check (monto > 0),
  constraint gastos_extra_pagado_por_check check (pagado_por in ('ninera', 'familia'))
);
create index idx_gastos_extra_sitting on public.gastos_extra (sitting_id);
create index idx_gastos_extra_pendientes on public.gastos_extra (pagado_por) where not cobrado or not reintegrado;
alter table public.gastos_extra enable row level security;
create policy solo_autenticados_todo on public.gastos_extra as permissive for all to public
  using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');
alter publication supabase_realtime add table public.gastos_extra;

-- Bucket privado para los tickets: sin lectura pública.
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;
create policy comprobantes_autenticados_leer on storage.objects as permissive for select to public
  using (((bucket_id = 'comprobantes'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy comprobantes_autenticados_subir on storage.objects as permissive for insert to public
  with check (((bucket_id = 'comprobantes'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));
create policy comprobantes_autenticados_borrar on storage.objects as permissive for delete to public
  using (((bucket_id = 'comprobantes'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));

commit;
