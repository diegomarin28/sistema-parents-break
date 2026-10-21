-- Deshace 20261021_cedula_ninera.sql: saca la columna cedula de ninieras (con lo que se haya
-- cargado: si ya hay cédulas que importan, respaldarlas antes).
begin;
alter table public.ninieras drop column if exists cedula;
commit;
