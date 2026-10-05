-- ============================================================================
-- Migración 07/10/2026: saldo a favor (ajustes de saldo). NO EJECUTADA: necesita el OK de
-- Diego.
--
-- Pedido del 05/10/2026: cuando una niñera le debe plata a Parents Break (se le pagó un
-- sitting que hizo otra) o una familia pagó de más, la diferencia queda como un ajuste que
-- se descuenta (o se suma) en el próximo pago o cobro, con una línea visible en Por pagar /
-- Por cobrar, en la ficha y en el PDF para las madres. Se puede cargar a mano.
--
-- Compatible con la app publicada: solo agrega una tabla nueva que la app vieja no lee.
-- Para volver atrás: 20261007_saldo_a_favor_DESHACER.sql.
-- ============================================================================

begin;

create table public.ajustes_saldo (
  id uuid default gen_random_uuid() primary key,
  -- De quién es el saldo: de una familia (se aplica en sus cobros) o de una niñera (en sus pagos).
  sujeto text not null,
  familia_id uuid references public.familias(id),
  ninera_id uuid references public.ninieras(id),
  nombre text not null,
  -- Positivo: se SUMA al próximo cobro (familia) o pago (niñera).
  -- Negativo: se DESCUENTA (saldo a favor de la familia, o niñera que le debe a Parents Break).
  monto numeric not null,
  motivo text not null,
  fecha date default ((now() at time zone 'America/Montevideo')::date) not null,
  -- Cuánto ya se usó (en valor absoluto) y en qué cobros/pagos: un saldo más grande que el
  -- próximo pago se va usando de a partes.
  aplicado numeric default 0 not null,
  aplicaciones jsonb default '[]'::jsonb not null,
  creado_por text,
  created_at timestamp with time zone default now() not null,
  constraint ajustes_saldo_sujeto_check check (
    (sujeto = 'familia' and familia_id is not null) or (sujeto = 'ninera' and ninera_id is not null)),
  constraint ajustes_saldo_monto_check check (monto <> 0),
  constraint ajustes_saldo_aplicado_check check (aplicado >= 0 and aplicado <= abs(monto))
);
create index idx_ajustes_saldo_familia on public.ajustes_saldo (familia_id) where familia_id is not null;
create index idx_ajustes_saldo_ninera on public.ajustes_saldo (ninera_id) where ninera_id is not null;
alter table public.ajustes_saldo enable row level security;
create policy solo_autenticados_todo on public.ajustes_saldo as permissive for all to public
  using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');
alter publication supabase_realtime add table public.ajustes_saldo;

commit;
