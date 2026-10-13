-- Deshace 20261012_fotos_sin_listado_publico.sql: las dos políticas vuelven a dejar listar
-- las fotos sin sesión.
begin;

alter policy juguetes_fotos_public_read on storage.objects using ((bucket_id = 'juguetes-fotos'::text));
alter policy ninieras_fotos_public_read on storage.objects using ((bucket_id = 'ninieras-fotos'::text));

commit;
