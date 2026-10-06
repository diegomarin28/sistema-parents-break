-- ============================================================================
-- Migración 11/10/2026: usuarias autorizadas. Aprobada por Diego el 06/10/2026.
--
-- Hasta acá las políticas RLS dejaban entrar a CUALQUIER usuario con sesión: si se colaba
-- una cuenta (registro abierto por error, una invitación mal mandada), veía y modificaba
-- todo. El registro público ya está apagado en el panel; esto es la segunda llave: solo las
-- cuentas de usuarias_autorizadas (activas) pasan las políticas.
--
-- - Tabla usuarias_autorizadas (RLS sin políticas: desde la app nadie la lee ni la escribe;
--   se administra con SQL). Las cuentas van solo por id (el repo es público).
-- - es_usuaria_autorizada(): security definer, la usan las políticas como
--   (select public.es_usuaria_autorizada()) para que se evalúe una vez por consulta.
-- - Las 35 políticas de public pasan a usarla (ALTER POLICY: mismo nombre, comando y rol).
--   Antes se guarda una copia de todas en respaldo_politicas_20261011.
-- - Antes del commit se prueba sola: cada una de las cuentas autorizadas lee sittings,
--   familias y niñeras; una cuenta inventada y anon no leen nada. Si algo no da, no cambia nada.
-- - Storage va aparte (20261011_usuarias_autorizadas_storage.sql): sus políticas son de
--   otro dueño y conviene que un error ahí no frene esto.
--
-- Compatible con la app publicada: las cuentas autorizadas ven y hacen lo mismo que antes.
-- Las Edge Functions usan la service role (no pasan por RLS) y el cron corre como postgres.
-- Para volver atrás: 20261011_usuarias_autorizadas_DESHACER.sql.
-- ============================================================================

begin;

create table public.respaldo_politicas_20261011 as
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public', 'storage');
alter table public.respaldo_politicas_20261011 enable row level security;

create table public.usuarias_autorizadas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null check (rol in ('duena', 'desarrollo', 'socia')),
  activa boolean not null default true,
  alta_en timestamp with time zone not null default now()
);
alter table public.usuarias_autorizadas enable row level security;

create function public.es_usuaria_autorizada()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.usuarias_autorizadas where user_id = auth.uid() and activa)
$$;
-- anon también la ejecuta (le da siempre false): sin el permiso, un pedido sin sesión daba
-- error en vez de cero filas como hasta ahora.
revoke execute on function public.es_usuaria_autorizada() from public;
grant execute on function public.es_usuaria_autorizada() to authenticated, anon;

insert into public.usuarias_autorizadas (user_id, rol)
select u.id, v.rol
  from (values
    ('09052c8e-5af3-4dd6-9660-fbc66d75fbb8'::uuid, 'duena'),
    ('9a23d206-e75a-4f7f-8c29-9715e48d8b18'::uuid, 'duena'),
    ('9f533839-a102-4e58-975c-6bd999dd0c02'::uuid, 'desarrollo'),
    ('b51ddc96-4953-44c7-ae88-2ad0b9c06e47'::uuid, 'socia')
  ) v(id, rol)
  join auth.users u on u.id = v.id;

do $$
declare p record; n integer := 0;
begin
  if (select count(*) from public.usuarias_autorizadas) <> 4 then
    raise exception 'Se esperaban 4 cuentas autorizadas y hay %', (select count(*) from public.usuarias_autorizadas);
  end if;
  for p in select * from pg_policies where schemaname = 'public' loop
    -- Solo las dos formas conocidas ("true" o auth.role() = authenticated). Otra cosa: frena.
    if coalesce(p.qual, 'true') not in ('true', '(( SELECT auth.role() AS role) = ''authenticated''::text)')
       or coalesce(p.with_check, 'true') not in ('true', '(( SELECT auth.role() AS role) = ''authenticated''::text)') then
      raise exception 'Política inesperada: %.% (%)', p.tablename, p.policyname, p.qual;
    end if;
    if p.cmd in ('SELECT', 'DELETE') then
      execute format('alter policy %I on public.%I using ((select public.es_usuaria_autorizada()))', p.policyname, p.tablename);
    elsif p.cmd = 'INSERT' then
      execute format('alter policy %I on public.%I with check ((select public.es_usuaria_autorizada()))', p.policyname, p.tablename);
    else
      execute format('alter policy %I on public.%I using ((select public.es_usuaria_autorizada())) with check ((select public.es_usuaria_autorizada()))', p.policyname, p.tablename);
    end if;
    n := n + 1;
  end loop;
  if n <> 35 then raise exception 'Se esperaban 35 políticas en public y hay %', n; end if;
end $$;

-- Prueba antes del commit: cada cuenta autorizada lee lo de siempre; una inventada y anon, nada.
do $$
declare u record; n_sit integer; n_fam integer; n_nin integer;
begin
  for u in select user_id from public.usuarias_autorizadas loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.user_id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n_sit from public.sittings_traslados;
    select count(*) into n_fam from public.familias;
    select count(*) into n_nin from public.ninieras;
    execute 'reset role';
    if n_sit = 0 or n_fam = 0 or n_nin = 0 then
      raise exception 'La cuenta % no ve los datos (sittings %, familias %, niñeras %)', u.user_id, n_sit, n_fam, n_nin;
    end if;
    raise notice 'ok: % ve % sittings, % familias, % niñeras', u.user_id, n_sit, n_fam, n_nin;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000ff', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n_sit from public.sittings_traslados;
  select count(*) into n_fam from public.familias;
  execute 'reset role';
  if n_sit <> 0 or n_fam <> 0 then raise exception 'Una cuenta no autorizada ve datos (% sittings)', n_sit; end if;
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  select count(*) into n_sit from public.sittings_traslados;
  execute 'reset role';
  if n_sit <> 0 then raise exception 'anon ve datos (% sittings)', n_sit; end if;
  raise notice 'ok: una cuenta no autorizada y anon no ven nada';
end $$;

commit;
