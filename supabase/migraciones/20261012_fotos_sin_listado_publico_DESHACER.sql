-- Deshace 20261012_fotos_sin_listado_publico.sql: las dos políticas vuelven a dejar listar
-- las fotos sin sesión, con su nombre de antes.
begin;

alter policy juguetes_fotos_autorizadas_leer on storage.objects using ((bucket_id = 'juguetes-fotos'::text));
alter policy juguetes_fotos_autorizadas_leer on storage.objects rename to juguetes_fotos_public_read;

alter policy ninieras_fotos_autorizadas_leer on storage.objects using ((bucket_id = 'ninieras-fotos'::text));
alter policy ninieras_fotos_autorizadas_leer on storage.objects rename to ninieras_fotos_public_read;

commit;
