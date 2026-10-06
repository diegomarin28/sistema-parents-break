-- ============================================================================
-- Migración 11/10/2026 (segunda parte): usuarias autorizadas también en Storage.
-- Las 9 políticas de Storage que pedían "con sesión" (comprobantes; escribir y borrar fotos
-- de niñeras y juguetes) pasan a pedir una cuenta autorizada. La lectura pública de las
-- fotos por link (*_public_read) no cambia. Requiere 20261011_usuarias_autorizadas.sql.
-- Para volver atrás: 20261011_usuarias_autorizadas_DESHACER.sql (las restaura también).
-- ============================================================================

begin;

do $$
declare p record; n integer := 0;
  viejo constant text := '( SELECT auth.role() AS role) = ''authenticated''::text';
  nuevo constant text := '( SELECT public.es_usuaria_autorizada() AS es_usuaria_autorizada)';
begin
  for p in select * from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and (coalesce(qual, '') like '%' || viejo || '%' or coalesce(with_check, '') like '%' || viejo || '%') loop
    if p.qual is not null and p.with_check is not null then
      execute format('alter policy %I on storage.objects using (%s) with check (%s)', p.policyname, replace(p.qual, viejo, nuevo), replace(p.with_check, viejo, nuevo));
    elsif p.qual is not null then
      execute format('alter policy %I on storage.objects using (%s)', p.policyname, replace(p.qual, viejo, nuevo));
    else
      execute format('alter policy %I on storage.objects with check (%s)', p.policyname, replace(p.with_check, viejo, nuevo));
    end if;
    n := n + 1;
  end loop;
  if n <> 9 then raise exception 'Se esperaban 9 políticas de Storage y hay %', n; end if;
end $$;

commit;
