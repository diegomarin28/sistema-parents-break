-- ============================================================================
-- Migración 09/10/2026: entrevista a medias. NO EJECUTADA: necesita el OK de Diego.
--
-- Pedido del 05/10/2026: poder guardar una entrevista incompleta y terminarla después. Queda
-- con estado 'en_curso', visible en "Candidatas guardadas" y en la candidata a entrevistar,
-- con "Seguir entrevista". Al completarla pasa a 'completa' (la misma fila, no otra).
-- Todo lo que ya existe queda 'completa'.
--
-- Compatible con la app publicada: solo agrega columnas con default (o vacías).
-- Para volver atrás: 20261009_entrevista_en_curso_DESHACER.sql.
-- ============================================================================

begin;

alter table public.entrevistas
  add column estado text default 'completa' not null,
  -- Lo que se escribió en la pantalla y no tiene columna propia (capacitación extra), para
  -- retomarla tal cual.
  add column borrador jsonb default '{}'::jsonb not null,
  add column actualizado_at timestamp with time zone default now() not null;
alter table public.entrevistas
  add constraint entrevistas_estado_check check (estado in ('en_curso', 'completa'));

commit;
