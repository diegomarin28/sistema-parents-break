-- ============================================================================
-- Deshace 20261011_usuarias_autorizadas.sql (y la parte de Storage, si se aplicó): vuelve
-- cada política a como estaba (desde respaldo_politicas_20261011) y borra la tabla y la
-- función. El respaldo de las políticas queda, por las dudas.
-- ============================================================================

begin;

do $$
declare p record;
begin
  for p in select * from public.respaldo_politicas_20261011 loop
    if not exists (select 1 from pg_policies x where x.schemaname = p.schemaname and x.tablename = p.tablename and x.policyname = p.policyname) then
      continue;
    end if;
    if p.qual is not null and p.with_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, p.qual, p.with_check);
    elsif p.qual is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, p.qual);
    elsif p.with_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, p.with_check);
    end if;
  end loop;
end $$;

drop function public.es_usuaria_autorizada();
drop table public.usuarias_autorizadas;

commit;
