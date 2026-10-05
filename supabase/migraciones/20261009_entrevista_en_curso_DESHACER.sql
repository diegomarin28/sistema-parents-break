-- ============================================================================
-- Deshace 20261009_entrevista_en_curso.sql. Las entrevistas que estaban a medias quedan como
-- entrevistas comunes (con los puntajes que tenían): antes se guarda una copia de esas filas
-- en respaldo_entrevistas_en_curso_deshacer.
-- ============================================================================

begin;

create table if not exists public.respaldo_entrevistas_en_curso_deshacer as
  select * from public.entrevistas where estado = 'en_curso';
alter table public.respaldo_entrevistas_en_curso_deshacer enable row level security;

alter table public.entrevistas drop constraint if exists entrevistas_estado_check;
alter table public.entrevistas
  drop column if exists actualizado_at,
  drop column if exists borrador,
  drop column if exists estado;

commit;
