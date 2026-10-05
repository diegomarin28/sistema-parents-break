-- Deshace la migración 20261005_vigencia_fijos_historial_sittings.sql, por si hiciera falta
-- volver atrás. Solo correrlo con OK explícito de Diego.
-- Ojo: borra el historial de cambios acumulado y las columnas de vigencia/tipo. Las
-- asignaciones vuelven a quedar como en respaldo_asignaciones_20261005 (niñera, días, horario),
-- salvo las que se hayan creado o cambiado después de la migración.
begin;

drop trigger if exists sittings_historial_trg on public.sittings_traslados;
drop function if exists public.registrar_historial_sitting();
drop table if exists public.sittings_historial;

drop index if exists public.idx_asignaciones_vigencia;
alter table public.asignaciones
  drop constraint if exists asignaciones_vigencia_check,
  drop constraint if exists asignaciones_tipo_check,
  drop column if exists vigente_desde,
  drop column if exists vigente_hasta,
  drop column if exists tipo;
-- ninera_id vuelve a como estaba antes (en el respaldo estaba vacío en todas).
update public.asignaciones a set ninera_id = r.ninera_id
  from public.respaldo_asignaciones_20261005 r where r.id = a.id;

create policy candidatas_fotos_public_read on storage.objects as permissive for select to public
  using ((bucket_id = 'candidatas-fotos'::text));
create policy candidatas_fotos_service_write on storage.objects as permissive for insert to public
  with check ((bucket_id = 'candidatas-fotos'::text));

commit;
