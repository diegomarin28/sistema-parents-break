// Genera supabase/pruebas/paridad_plata.sql: la base contra el oráculo de plata (red de tests
// del rediseño, docs/rediseno-panel.md 4.10). Con la misma semilla que tests/red-plata.spec.js,
// arma los casos, calcula con el oráculo (tests/support/oraculo-plata.js) lo que tiene que dar y
// deja un .sql que lo compara con las funciones de la base:
//   - minutos_fin_cobro: cada minuto de dos días (la regla de los 5 minutos);
//   - redondear_pago y redondear_cobro: montos con centavos y bordes de ,5;
//   - generar_previstos_fijos: fijos inventados de todos los días (horarios cualquiera, algunos
//     después de medianoche, tarifas con centavos, con y sin términos) y el cobro y el pago de
//     cada día que crea;
//   - precio_sitting (pedido desde WhatsApp): las mismas familias con otros horarios.
// Se vuelve a generar cuando cambia el oráculo o el generador (tests/red-plata.spec.js avisa):
//   node scripts/paridad-plata-sql.js
// El .sql se corre en un Postgres LOCAL (nunca en producción), como las otras pruebas.
const fs = require('fs');
const path = require('path');
const { crearOraculoPlata } = require('../tests/support/oraculo-plata');
const { SEMILLA_FIJA, crearAzar, casoMonto, TARIFAS, hhmm } = require('../tests/support/generador-plata');

const DESTINO = path.join(__dirname, '..', 'supabase', 'pruebas', 'paridad_plata.sql');
const FIJOS = 150;
const MONTOS = 800;
const PRECIOS = 300;

function generarSQL() {
  const O = crearOraculoPlata();
  const az = crearAzar(SEMILLA_FIJA + 30);
  const lineas = [];
  const sql = s => lineas.push(s);
  const valores = (filas, porLinea = 12) => {
    const partes = [];
    for (let i = 0; i < filas.length; i += porLinea) partes.push('  ' + filas.slice(i, i + porLinea).join(', '));
    return partes.join(',\n');
  };

  sql(`-- ============================================================================
-- Paridad de plata: la base contra el oráculo de la app (red de tests del rediseño,
-- docs/rediseno-panel.md 4.10). La generó scripts/paridad-plata-sql.js con la semilla
-- ${SEMILLA_FIJA}: no se edita a mano. Datos inventados.
-- Uso: en un Postgres LOCAL (nunca en producción), crear una base con supabase/schema.sql (sin
-- las extensiones de Supabase) y correr este archivo con psql -v ON_ERROR_STOP=1. Si algo no
-- da, corta con el caso y los primeros valores distintos. Todo termina en rollback.
-- ============================================================================
begin;

create function pg_temp.verificar(caso text, ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FALLA: %', caso; end if;
  raise notice 'ok: %', caso;
end $$;
`);

  // ---- 1) minutos_fin_cobro: cada minuto de dos días (el fin puede pasar la medianoche).
  const minutos = Array.from({ length: 2880 }, (_, m) => `(${m}, ${O.redondearFinCobro(m)})`);
  sql(`-- 1) minutos_fin_cobro = redondearFinCobro (core.js) en los 2880 minutos de dos días.
create temporary table _fin (m integer, esperado integer);
insert into _fin values
${valores(minutos)};
select pg_temp.verificar('minutos_fin_cobro igual a la app en ' || (select count(*) from _fin) || ' minutos'
  || coalesce(': ' || (select string_agg(m || ' da ' || public.minutos_fin_cobro(m) || ' (app ' || esperado || ')', ', ')
                     from (select * from _fin where public.minutos_fin_cobro(m) <> esperado limit 5) x), ''),
  not exists (select 1 from _fin where public.minutos_fin_cobro(m) <> esperado));
`);

  // ---- 2) redondear_pago / redondear_cobro: los mismos montos que la red de la app.
  const montos = [];
  while (montos.length < MONTOS) {
    const n = casoMonto(az);
    if (typeof n === 'number' && Number.isFinite(n)) montos.push(n);
  }
  const filasMontos = montos.map(n => `(${String(n)}::numeric, ${O.redondearPago(n)}, ${O.redondearCobro(n)})`);
  sql(`-- 2) redondear_pago / redondear_cobro = redondearPago / redondearCobro (core.js).
create temporary table _montos (n numeric, pago numeric, cobro numeric);
insert into _montos values
${valores(filasMontos, 4)};
select pg_temp.verificar('redondear_pago igual a la app en ' || (select count(*) from _montos) || ' montos'
  || coalesce(': ' || (select string_agg(n || ' da ' || public.redondear_pago(n) || ' (app ' || pago || ')', ', ')
                     from (select * from _montos where public.redondear_pago(n) <> pago limit 5) x), ''),
  not exists (select 1 from _montos where public.redondear_pago(n) <> pago));
select pg_temp.verificar('redondear_cobro igual a la app en ' || (select count(*) from _montos) || ' montos'
  || coalesce(': ' || (select string_agg(n || ' da ' || public.redondear_cobro(n) || ' (app ' || cobro || ')', ', ')
                     from (select * from _montos where public.redondear_cobro(n) <> cobro limit 5) x), ''),
  not exists (select 1 from _montos where public.redondear_cobro(n) <> cobro));
`);

  // ---- 3) generar_previstos_fijos: un fijo por familia, todos los días; lo que crea tiene que
  // cobrar y pagar lo mismo que la app con ese horario y esa tarifa. Los términos van en una
  // fecha muy vieja (siempre redondea) o muy lejana (nunca), así no depende de qué día se corra.
  const familias = [], ninieras = [], asignaciones = [], esperados = [], tarifas = [];
  for (let i = 1; i <= FIJOS; i++) {
    const idF = `f1000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const idN = `e1000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const idA = `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const cobroH = az.de(TARIFAS.filter(Boolean)), pagoH = az.de(TARIFAS.filter(Boolean));
    const terminos = az.de([null, '2000-01-01', '2100-01-01']);
    const ini = az.entero(0, 1439);
    const fin = az.si(0.15) ? az.entero(0, ini) : (ini + az.entero(1, 600)) % 1440; // a veces termina pasada la medianoche
    const horas = O.horasSitting(hhmm(ini), hhmm(fin), fin <= ini, { terminos_aceptados_el: terminos }, '2026-10-22');
    tarifas.push({ id: idF, cobro_hora: cobroH, pago_hora: pagoH, terminos_aceptados_el: terminos });
    familias.push(`('${idF}', 'Familia Paridad ${i}', ${cobroH}, ${pagoH}, ${terminos ? `'${terminos}'` : 'null'})`);
    ninieras.push(`('${idN}', 'Niñera Paridad ${i}')`);
    asignaciones.push(`('${idA}', '${idF}', '${idN}', 'Niñera Paridad ${i}', '["L","M","X","J","V","S","D"]', '${hhmm(ini)}', '${hhmm(fin)}', current_date - 30, 'sitting')`);
    esperados.push(`('${idA}', ${O.redondearCobro(cobroH * horas.cobro)}, ${O.redondearPago(pagoH * horas.real)}, '${hhmm(ini)}-${hhmm(fin)} x ${cobroH}/${pagoH} terminos ${terminos || 'no'}')`);
  }
  sql(`-- 3) generar_previstos_fijos: cobro y pago de cada día igual a precioSegunHorario (sittings.js).
insert into familias (id, nombre, cobro_hora, pago_hora, terminos_aceptados_el) values
${valores(familias, 3)};
insert into ninieras (id, nombre) values
${valores(ninieras, 4)};
insert into asignaciones (id, familia_id, ninera_id, ninera_nombre, dias, hora_inicio, hora_fin, vigente_desde, tipo) values
${valores(asignaciones, 1)};
create temporary table _esperado (asignacion_id uuid, cobro numeric, pago numeric, caso text);
insert into _esperado values
${valores(esperados, 2)};
select public.generar_previstos_fijos(3);
select pg_temp.verificar('generar_previstos_fijos crea 3 días de cada uno de los ${FIJOS} fijos',
  (select count(*) from sittings_traslados s join _esperado e on e.asignacion_id = s.asignacion_id) = ${FIJOS * 3});
select pg_temp.verificar('generar_previstos_fijos cobra y paga igual que la app en ' || (select count(*) from _esperado) * 3 || ' días'
  || coalesce(': ' || (select string_agg(caso || ' cobra ' || cobro_familia || ' (app ' || cobro || ') y paga ' || pago_ninera || ' (app ' || pago || ')', '; ')
                     from (select e.caso, s.cobro_familia, e.cobro, s.pago_ninera, e.pago from sittings_traslados s join _esperado e using (asignacion_id)
                           where s.cobro_familia <> e.cobro or s.pago_ninera <> e.pago limit 5) x), ''),
  not exists (select 1 from sittings_traslados s join _esperado e using (asignacion_id)
              where s.cobro_familia <> e.cobro or s.pago_ninera <> e.pago));
`);

  // ---- 4) precio_sitting: el precio estimado del pedido desde WhatsApp, con las mismas familias
  // y otros horarios, contra precioSegunHorario (sittings.js).
  const precios = [];
  for (let i = 0; i < PRECIOS; i++) {
    const fam = tarifas[i % tarifas.length];
    const ini = az.entero(0, 1439);
    const fin = az.si(0.15) ? az.entero(0, ini) : (ini + az.entero(1, 600)) % 1440;
    const p = O.precioSegunHorario(fam, hhmm(ini), hhmm(fin), fin <= ini, '2026-10-22');
    precios.push(`('${fam.id}'::uuid, '${hhmm(ini)}'::time, '${hhmm(fin)}'::time, ${p.cobro ?? 'null'}::numeric, ${p.pago ?? 'null'}::numeric)`);
  }
  sql(`-- 4) precio_sitting = precioSegunHorario (sittings.js) en ${PRECIOS} horarios.
create temporary table _precio (familia_id uuid, ini time, fin time, cobro numeric, pago numeric);
insert into _precio values
${valores(precios, 2)};
select pg_temp.verificar('precio_sitting igual a la app en ' || (select count(*) from _precio) || ' horarios'
  || coalesce(': ' || (select string_agg(x.ini || '-' || x.fin || ' da ' || coalesce(x.c::text, 'vacío') || '/' || coalesce(x.p::text, 'vacío')
                          || ' (app ' || coalesce(x.cobro::text, 'vacío') || '/' || coalesce(x.pago::text, 'vacío') || ')', ', ')
                     from (select e.ini, e.fin, e.cobro, e.pago, r.cobro c, r.pago p from _precio e
                           cross join lateral public.precio_sitting(e.familia_id, '2026-10-22', e.ini, e.fin) r
                           where r.cobro is distinct from e.cobro or r.pago is distinct from e.pago limit 5) x), ''),
  not exists (select 1 from _precio e cross join lateral public.precio_sitting(e.familia_id, '2026-10-22', e.ini, e.fin) r
              where r.cobro is distinct from e.cobro or r.pago is distinct from e.pago)
  and (select count(*) from _precio e cross join lateral public.precio_sitting(e.familia_id, '2026-10-22', e.ini, e.fin) r) = ${PRECIOS});

rollback;
`);
  return lineas.join('\n');
}

if (require.main === module) {
  fs.writeFileSync(DESTINO, generarSQL());
  console.log(`Generada ${path.relative(path.join(__dirname, '..'), DESTINO)}: 2880 minutos, ${MONTOS} montos, ${FIJOS} fijos, ${PRECIOS} precios.`);
}
module.exports = { generarSQL };
