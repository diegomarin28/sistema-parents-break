-- Deshace 20261015_finanzas_historial.sql. Borra el historial de gastos y saldos registrado
-- desde entonces: si hace falta conservarlo, copiar antes la tabla finanzas_historial.
begin;
drop trigger if exists gastos_generales_historial_trg on public.gastos_generales;
drop trigger if exists ajustes_saldo_historial_trg on public.ajustes_saldo;
drop trigger if exists gastos_extra_historial_trg on public.gastos_extra;
drop function if exists public.registrar_historial_finanzas();
drop table if exists public.finanzas_historial;
commit;
