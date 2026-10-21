-- ============================================================================
-- Migración 21/10/2026: cédula de la niñera (la pide la ficha de Niñeras de las maquetas).
--
-- Hasta ahora la cédula solo existía en carsitting_datos, que es del formulario de car sitting:
-- una fila por formulario, solo para quienes hacen traslados, y hoy vacía. No sirve como lugar
-- principal, así que la cédula pasa a ser una columna de ninieras. Si alguna niñera ya la cargó
-- en el formulario de car sitting, se copia la más reciente (hoy no hay ninguna).
-- En la entrevista se carga en la ficha de la candidata (notas_ficha, como los demás datos
-- corregidos) y pasa a la niñera al contratarla: eso va en el PR de Postulantes del rediseño.
--
-- Compatible con la app publicada: es una columna nueva y vacía, la app no la lee todavía. Solo
-- completa la columna nueva (no pisa ningún dato), así que no hace falta respaldo. Se puede
-- correr dos veces. Se deshace con 20261021_cedula_ninera_DESHACER.sql.
-- ============================================================================
begin;

alter table public.ninieras add column if not exists cedula text;

update public.ninieras n
   set cedula = c.cedula
  from (select distinct on (ninera_id) ninera_id, trim(cedula) as cedula
          from public.carsitting_datos
         where ninera_id is not null and coalesce(trim(cedula), '') <> ''
         order by ninera_id, created_at desc) c
 where c.ninera_id = n.id and n.cedula is null;

commit;
