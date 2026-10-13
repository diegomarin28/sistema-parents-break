-- Deshace 20261014_gastos_absorbe_pb.sql. Los gastos que estaban marcados como absorbidos
-- pasan a ser gastos comunes de la niñera (se cobran a la familia): revisarlos antes.
begin;
alter table public.gastos_extra drop column if exists absorbe_pb;
commit;
