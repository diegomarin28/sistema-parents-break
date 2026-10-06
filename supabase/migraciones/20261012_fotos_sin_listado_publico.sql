-- ============================================================================
-- Migración 12/10/2026 (S2): las fotos de niñeras y de juguetes ya no se pueden LISTAR sin
-- sesión. Las dos políticas *_public_read dejaban que cualquiera, sin cuenta, pidiera la lista
-- de archivos de esos buckets (y viera los nombres). Pasan a pedir una cuenta autorizada,
-- igual que subir y borrar.
-- Las fotos se siguen viendo por su link: los buckets son públicos y la URL pública
-- (getPublicUrl, lo que usa la app) no pasa por estas políticas. No se borran (drop): la app
-- sube con upsert, que necesita poder leer el bucket con la sesión.
-- Para volver atrás: 20261012_fotos_sin_listado_publico_DESHACER.sql.
-- ============================================================================

begin;

-- Respaldo de las dos políticas tal como estaban.
create table if not exists public.respaldo_politicas_fotos_20261012 as
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check, now() as respaldado_en
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('juguetes_fotos_public_read', 'ninieras_fotos_public_read');
alter table public.respaldo_politicas_fotos_20261012 enable row level security;

do $$
begin
  if (select count(*) from public.respaldo_politicas_fotos_20261012) <> 2 then
    raise exception 'Se esperaban las 2 políticas *_public_read';
  end if;
end $$;

alter policy juguetes_fotos_public_read on storage.objects
  using (((bucket_id = 'juguetes-fotos'::text) AND ( SELECT public.es_usuaria_autorizada() AS es_usuaria_autorizada)));
alter policy juguetes_fotos_public_read on storage.objects rename to juguetes_fotos_autorizadas_leer;

alter policy ninieras_fotos_public_read on storage.objects
  using (((bucket_id = 'ninieras-fotos'::text) AND ( SELECT public.es_usuaria_autorizada() AS es_usuaria_autorizada)));
alter policy ninieras_fotos_public_read on storage.objects rename to ninieras_fotos_autorizadas_leer;

commit;
