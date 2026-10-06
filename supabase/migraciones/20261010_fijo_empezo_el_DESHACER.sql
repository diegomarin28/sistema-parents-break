-- Deshace 20261010_fijo_empezo_el.sql (se pierde el dato "empezó el": anotarlo antes si hace falta).
begin;
alter table public.asignaciones drop column if exists inicio_real;
commit;
