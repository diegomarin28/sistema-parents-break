-- ============================================================================
-- Migración 21/10/2026: respuestas del formulario de car sitting unidas a la niñera.
--
-- Hasta ahora carsitting-webhook unía la respuesta con la niñera solo si el nombre escrito en el
-- formulario era idéntico al de la ficha (sin tildes ni mayúsculas). "María José Pérez" en el
-- formulario y "Majo Pérez" en la ficha quedaban sin unir, y la app la seguía mostrando como
-- que faltaba. Ahora:
-- 1) carsitting_datos guarda también el celular y el mail que vengan en el formulario (hay que
--    agregar la pregunta del celular al formulario de Google y prender "recopilar correos").
-- 2) vincular_carsitting(): al entrar una respuesta sin niñera, la base la une sola, en este
--    orden: por celular (los últimos 8 dígitos: 099 123 456, +598 99 123 456 y 99123456 son el
--    mismo), por mail (el de la candidata de esa niñera) y por nombre (como antes). Solo une si
--    hay una sola niñera posible (si hay dos, prefiere la activa). Si no, queda "Sin
--    identificar" y se une a mano desde Niñeras > Car sitting. Nunca pisa una unión hecha.
--
-- Compatible con la app publicada: dos columnas nuevas y un trigger que solo completa
-- ninera_id cuando viene vacío. Hoy carsitting_datos no tiene filas: el update del final no toca
-- nada (si para cuando se aplique llegó alguna, solo le completa la niñera). Orden: primero esta
-- migración y después carsitting-webhook v6 (que manda celular y mail). Se deshace con
-- 20261021_carsitting_union_DESHACER.sql.
-- ============================================================================
begin;

alter table public.carsitting_datos add column if not exists telefono text;
alter table public.carsitting_datos add column if not exists mail text;

create or replace function public.vincular_carsitting()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_tel text := right(regexp_replace(coalesce(new.telefono, ''), '\D', '', 'g'), 8);
  v_mail text := lower(trim(coalesce(new.mail, '')));
  v_nombre text := regexp_replace(translate(lower(trim(coalesce(new.nombre_completo, ''))),
                     'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'), '\s+', ' ', 'g');
  v_activas uuid[];
  v_todas uuid[];
begin
  if new.ninera_id is not null then
    return new;
  end if;

  -- 1) Celular: los últimos 8 dígitos (con 0 adelante, con +598 o sin nada es el mismo número).
  if length(v_tel) = 8 then
    select array_agg(n.id) filter (where n.activa), array_agg(n.id)
      into v_activas, v_todas
      from public.ninieras n
     where right(regexp_replace(coalesce(n.telefono, ''), '\D', '', 'g'), 8) = v_tel;
    if cardinality(v_activas) = 1 then new.ninera_id := v_activas[1]; return new; end if;
    if coalesce(cardinality(v_activas), 0) = 0 and cardinality(v_todas) = 1 then new.ninera_id := v_todas[1]; return new; end if;
  end if;

  -- 2) Mail: el que dejó como candidata (la niñera no tiene mail propio).
  if v_mail <> '' then
    select array_agg(n.id) filter (where n.activa), array_agg(n.id)
      into v_activas, v_todas
      from public.ninieras n
      join public.candidatas c on c.id = n.candidata_id
     where lower(trim(coalesce(c.mail, ''))) = v_mail;
    if cardinality(v_activas) = 1 then new.ninera_id := v_activas[1]; return new; end if;
    if coalesce(cardinality(v_activas), 0) = 0 and cardinality(v_todas) = 1 then new.ninera_id := v_todas[1]; return new; end if;
  end if;

  -- 3) Nombre: igual al de la ficha sin tildes, mayúsculas ni espacios de más (lo de antes).
  if v_nombre <> '' then
    select array_agg(n.id) filter (where n.activa), array_agg(n.id)
      into v_activas, v_todas
      from public.ninieras n
     where regexp_replace(translate(lower(trim(n.nombre)),
             'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'), '\s+', ' ', 'g') = v_nombre;
    if cardinality(v_activas) = 1 then new.ninera_id := v_activas[1]; return new; end if;
    if coalesce(cardinality(v_activas), 0) = 0 and cardinality(v_todas) = 1 then new.ninera_id := v_todas[1]; return new; end if;
  end if;

  return new;
end
$function$;
revoke execute on function public.vincular_carsitting() from public, anon, authenticated;

-- Solo al entrar una respuesta o si le corrigen el celular, el mail o el nombre. Unir o desunir
-- a mano (cambiar ninera_id) no lo dispara.
create trigger carsitting_vincular
  before insert or update of telefono, mail, nombre_completo on public.carsitting_datos
  for each row execute function public.vincular_carsitting();

-- Las que hubieran llegado sin unir, se prueban de nuevo (hoy no hay ninguna).
update public.carsitting_datos set nombre_completo = nombre_completo where ninera_id is null;

commit;
