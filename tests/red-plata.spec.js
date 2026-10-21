// Red de tests de plata (docs/rediseno-panel.md 4.10, punto 2), antes de tocar cualquier cálculo
// en el rediseño. Miles de casos inventados, con una semilla fija, comparan:
//  - la app (js/) con el oráculo: la copia congelada de las funciones de plata de hoy
//    (tests/support/oraculo-plata.js). Si alguien cambia un cálculo sin querer, salta acá;
//  - la app con la regla escrita (CLAUDE.md), armada aparte en este archivo, para que un
//    error que estuviera en las dos copias también se vea.
// La base (minutos_fin_cobro, redondear_*, generar_previstos_fijos) se compara con el mismo
// oráculo en supabase/pruebas/paridad_plata.sql (Postgres local, nunca producción).
// Otra semilla: SEMILLA=123 npx playwright test tests/red-plata.spec.js
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');
const { SEMILLA_FIJA, crearAzar, casoHorario, barridoHorarios, casoMonto, escenarioResumen, escenarioPendientes, TARIFAS, hhmm } = require('./support/generador-plata');
const { generarSQL } = require('../scripts/paridad-plata-sql');

const SEMILLA = Number(process.env.SEMILLA || SEMILLA_FIJA);
const FUENTE_ORACULO = fs.readFileSync(path.join(__dirname, 'support', 'oraculo-plata.js'), 'utf8');
// Fechas de "hoy" que cambian lo que se debe: un miércoles (semanas en curso), el sábado en que
// cierran las fijas sin finde, el domingo en que cierran todas y el lunes siguiente (lo que cerró
// ayer ya se debe). Sin el lunes, correr el cierre un día no lo atrapaba ningún caso.
const HOYS = [['miércoles', '2026-10-21T10:00:00-03:00'], ['sábado', '2026-10-24T10:00:00-03:00'], ['domingo', '2026-10-25T10:00:00-03:00'], ['lunes', '2026-10-26T10:00:00-03:00']];

async function cargarOraculo(page) {
  await page.addScriptTag({ content: FUENTE_ORACULO + '\nwindow.ORACULO = crearOraculoPlata();' });
}
// Las diferencias se muestran con los datos del caso (las primeras 5), para reproducirlo.
function sinDiferencias(lista, que) {
  expect(lista.slice(0, 5), `${lista.length} casos de ${que} no coinciden (semilla ${SEMILLA})`).toEqual([]);
}
function anotarCasos(cuantos, que) {
  test.info().annotations.push({ type: 'casos', description: `${cuantos} ${que}` });
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cerca = (a, b) => Math.abs(a - b) < 1e-6;

// ---------- La regla escrita, armada aparte (no copia el código de la app) ----------
const minutos = h => { if (!h) return null; const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
// Horas de un sitting (CLAUDE.md, términos y condiciones y "Termina al día siguiente"): la niñera
// cobra la hora real; a la familia que aceptó los términos, desde ese día, el fin se lleva a la
// media hora con 5 minutos de tolerancia (17:05 → 17:00, 17:06 → 17:30, 17:36 → 18:00). Con la
// casilla del día siguiente el fin va antes del inicio (o igual: 24 h).
function reglaHoras({ ini, fin, cruza, familia, fecha }) {
  if (!ini || !fin) return null;
  const mi = minutos(ini), finReloj = minutos(fin);
  if (cruza && finReloj > mi) return null;
  const mf = finReloj + (cruza ? 1440 : 0);
  if (mf <= mi) return null;
  const desde = familia?.terminos_aceptados_el;
  let mc = mf;
  if (desde && (!fecha || fecha >= desde)) {
    const resto = mf % 30;
    mc = Math.max(mi, resto <= 5 ? mf - resto : mf - resto + 30);
  }
  return { real: (mf - mi) / 60, cobro: (mc - mi) / 60, finCobro: mc !== mf ? hhmm(mc) : null };
}
// Montos sin centavos: el pago, ,5 o menos baja; el cobro, ,5 o más sube; primero a centavos.
function reglaRedondeo(n, cobro) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const centavos = Math.round(Math.abs(v) * 100);
  const r = cobro ? Math.floor((centavos + 50) / 100) : Math.floor((centavos + 49) / 100);
  return v < 0 && r ? -r : r;
}

test.describe('red de plata: la app contra el oráculo y la regla escrita', () => {
  test('horario: horas reales, horas cobradas y hasta qué hora se cobra', async ({ page }) => {
    const e = await abrirApp(page);
    await cargarOraculo(page);
    const az = crearAzar(SEMILLA);
    const casos = [...barridoHorarios(), ...Array.from({ length: 1000 }, () => casoHorario(az))];
    const res = await page.evaluate(cs => cs.map(c => ({
      app: horasSitting(c.ini, c.fin, c.cruza, c.familia, c.fecha),
      oraculo: ORACULO.horasSitting(c.ini, c.fin, c.cruza, c.familia, c.fecha),
    })), casos);
    const contraOraculo = [], contraRegla = [];
    res.forEach((r, i) => {
      if (!igual(r.app, r.oraculo)) contraOraculo.push({ caso: casos[i], app: r.app, oraculo: r.oraculo });
      const regla = reglaHoras(casos[i]);
      if (!igual(r.app, regla)) contraRegla.push({ caso: casos[i], app: r.app, regla });
    });
    sinDiferencias(contraOraculo, 'horario contra el oráculo');
    sinDiferencias(contraRegla, 'horario contra la regla escrita');
    expect(casos.length).toBeGreaterThan(1900);
    anotarCasos(casos.length, 'horarios');
    verificarLimpio(e);
  });

  test('montos: redondeo del cobro y del pago, y precio de un sitting por horario', async ({ page }) => {
    const e = await abrirApp(page);
    await cargarOraculo(page);
    const az = crearAzar(SEMILLA + 1);
    const montos = Array.from({ length: 800 }, () => casoMonto(az));
    // El horario de casoHorario con la familia de este caso (tarifa y términos).
    const precios = Array.from({ length: 800 }, () => {
      const { familia, ...horario } = casoHorario(az);
      return { ...horario, fam: { cobro_hora: az.de(TARIFAS), pago_hora: az.de(TARIFAS), terminos_aceptados_el: familia?.terminos_aceptados_el ?? null } };
    });
    const res = await page.evaluate(([ms, ps]) => ({
      montos: ms.map(n => ({ app: [redondearPago(n), redondearCobro(n)], oraculo: [ORACULO.redondearPago(n), ORACULO.redondearCobro(n)] })),
      precios: ps.map(p => ({
        app: precioSegunHorario(p.fam, p.ini, p.fin, p.cruza, p.fecha),
        oraculo: ORACULO.precioSegunHorario(p.fam, p.ini, p.fin, p.cruza, p.fecha),
      })),
    }), [montos, precios]);
    const malos = [];
    res.montos.forEach((r, i) => {
      const regla = [reglaRedondeo(montos[i], false), reglaRedondeo(montos[i], true)];
      if (!igual(r.app, r.oraculo) || !igual(r.app, regla)) malos.push({ monto: String(montos[i]), app: r.app, oraculo: r.oraculo, regla });
    });
    res.precios.forEach((r, i) => {
      const p = precios[i];
      const h = reglaHoras({ ...p, familia: p.fam });
      const cobroH = Number(p.fam.cobro_hora) || 0, pagoH = Number(p.fam.pago_hora) || 0;
      const regla = { cobro: h && cobroH ? reglaRedondeo(cobroH * h.cobro, true) : null, pago: h && pagoH ? reglaRedondeo(pagoH * h.real, false) : null };
      if (!igual(r.app, r.oraculo) || !igual(r.app, regla)) malos.push({ caso: p, app: r.app, oraculo: r.oraculo, regla });
    });
    sinDiferencias(malos, 'montos y precios');
    anotarCasos(montos.length + precios.length, 'montos y precios');
    verificarLimpio(e);
  });

  for (const [dia, ahora] of HOYS) {
    test(`resumen del mes, un ${dia}: facturado, cobrado, por cobrar, por pagar y resultado`, async ({ page }) => {
      const e = await abrirApp(page, { ahora });
      await cargarOraculo(page);
      const az = crearAzar(SEMILLA + 2 + HOYS.findIndex(h => h[1] === ahora));
      const hoy = ahora.slice(0, 10);
      const escenarios = Array.from({ length: 100 }, () => escenarioResumen(az, hoy));
      const res = await page.evaluate(escs => {
        const APP = { construirEsTrabajoFijo, construirEsEnCurso, resumenIntermediaciones, resumenFinancieroMes, filtrarFijosSemanaIncompleta };
        // Igual que cargarFinanzas: una fija cuya semana todavía no se puede pagar va aparte de
        // Por pagar (construirEsEnCurso; 21/10/2026: el día que cierra, después del último fijo).
        const calcular = (F, esc) => {
          const esFijo = F.construirEsTrabajoFijo(esc.asigs);
          const enCurso = F.construirEsEnCurso(esc.sits, esc.asigs);
          const inter = F.resumenIntermediaciones(esc.enrique, esc.eventos);
          return {
            resumen: F.resumenFinancieroMes(esc.sits, esc.gastosNegocio, esc.absorbidos, inter, enCurso),
            margen: F.filtrarFijosSemanaIncompleta(esc.sits, esFijo).map(r => r.id),
          };
        };
        return escs.map(esc => ({ app: calcular(APP, esc), oraculo: calcular(ORACULO, esc) }));
      }, escenarios);
      const malos = [];
      res.forEach((r, i) => {
        const esc = escenarios[i], s = r.app.resumen, it = s.intermediaciones;
        if (!igual(r.app, r.oraculo)) malos.push({ escenario: i, que: 'contra el oráculo', app: r.app, oraculo: r.oraculo });
        // La regla escrita (CLAUDE.md, Finanzas): el resultado sale de lo facturado.
        if (!cerca(s.facturado, s.cobrado + s.porCobrar)) malos.push({ escenario: i, que: 'facturado = cobrado + por cobrar', s });
        if (!cerca(s.resultado, s.facturado - s.costoNinieras - s.gastos - s.absorbidos)) malos.push({ escenario: i, que: 'resultado', s });
        const sinPagar = esc.sits.filter(x => !x.pagado).reduce((t, x) => t + x.pago_ninera, 0) + it.porPagar + it.porPagarFuturo;
        if (!cerca(s.porPagar + s.porPagarEnCurso + s.porPagarFuturo, sinPagar)) malos.push({ escenario: i, que: 'por pagar + en curso + futuro', s });
      });
      sinDiferencias(malos, `resúmenes (${dia})`);
      anotarCasos(escenarios.length, `meses (${dia})`);
      verificarLimpio(e);
    });
  }

  for (const [dia, ahora] of HOYS) {
    test(`Por cobrar y Por pagar, un ${dia}: grupos, gastos extra, saldo a favor y monto a transferir`, async ({ page }) => {
      const fijosAutomaticos = dia !== 'sábado'; // un día sin la marca, para cubrir los dos caminos
      const app_config = fijosAutomaticos ? [{ id: 'fijos_automaticos', valor: { activo: true, dias: 14 }, actualizado_at: '2026-10-04T06:00:00Z' }] : [];
      const e = await abrirApp(page, { ahora, datos: { app_config } });
      await cargarOraculo(page);
      const hoy = ahora.slice(0, 10);
      const az = crearAzar(SEMILLA + 10 + HOYS.findIndex(h => h[1] === ahora));
      const malos = [];
      const N = 100;
      for (let i = 0; i < N; i++) {
        const esc = escenarioPendientes(az, hoy, fijosAutomaticos);
        Object.assign(e.db, esc);
        const r = await page.evaluate(async () => {
          // Orden estable para comparar: por persona y período, con los ids ordenados.
          const orden = gs => gs.map(g => ({ ...g, ids: [...g.ids].sort() })).sort((a, b) => `${a.familia_id || a.ninera_id || a.nombre}|${a.bucket}`.localeCompare(`${b.familia_id || b.ninera_id || b.nombre}|${b.bucket}`));
          const calcular = async F => {
            const p = await F.calcularPendientesAgrupados();
            const ajustes = await F.cargarAjustesSaldo();
            const cobrar = structuredClone(p.gruposCobrar), pagar = structuredClone(p.gruposPagar);
            const sueltos = { familia: F.aplicarAjustesAGrupos(cobrar, ajustes, 'familia'), ninera: F.aplicarAjustesAGrupos(pagar, ajustes, 'ninera') };
            return {
              cobrar: orden(cobrar).map(g => ({ ...g, monto: F.montoGrupo(g, 'familia') })),
              pagar: orden(pagar).map(g => ({ ...g, monto: F.montoGrupo(g, 'ninera'), copiar: F.montoParaCopiar(F.montoGrupo(g, 'ninera')) })),
              sueltos, error: !!p.error,
            };
          };
          return { app: await calcular(window), oraculo: await calcular(ORACULO) };
        });
        if (!igual(r.app, r.oraculo)) { malos.push({ escenario: i, que: 'contra el oráculo', app: r.app, oraculo: r.oraculo }); continue; }
        // La regla escrita: cada registro pendiente está en un solo grupo, y nada más.
        const enGrupos = gs => gs.flatMap(g => g.ids);
        const debeCobrar = esc.sittings_traslados.filter(s => s.cobro_familia > 0 && !s.cobrado && !(s.estado === 'previsto' && s.fecha > hoy)).map(s => s.id).sort();
        const debePagar = esc.sittings_traslados.filter(s => s.pago_ninera > 0 && !s.pagado && s.fecha <= hoy).map(s => s.id).sort();
        if (!igual(enGrupos(r.app.cobrar).sort(), debeCobrar)) malos.push({ escenario: i, que: 'registros en Por cobrar', app: enGrupos(r.app.cobrar), debeCobrar });
        if (!igual(enGrupos(r.app.pagar).sort(), debePagar)) malos.push({ escenario: i, que: 'registros en Por pagar', app: enGrupos(r.app.pagar), debePagar });
        // El total de cada grupo es la suma de sus registros y sus gastos; un descuento nunca lo deja en negativo.
        const montoDe = (id, campo) => esc.sittings_traslados.find(s => s.id === id)[campo];
        for (const [gs, campo] of [[r.app.cobrar, 'cobro_familia'], [r.app.pagar, 'pago_ninera']]) {
          for (const g of gs) {
            const suma = g.ids.reduce((t, id) => t + montoDe(id, campo), 0) + (g.gastos || []).reduce((t, x) => t + x.monto, 0);
            if (!cerca(g.total, suma)) malos.push({ escenario: i, que: 'total del grupo', g, suma });
            if (g.totalNeto < -1e-6) malos.push({ escenario: i, que: 'saldo a favor dejó un grupo en negativo', g });
          }
        }
        // Un gasto que pagó la niñera se cobra (si no lo absorbe Parents Break) y se reintegra.
        for (const gx of esc.gastos_extra.filter(x => x.pagado_por === 'ninera')) {
          const s = esc.sittings_traslados.find(x => x.id === gx.sitting_id);
          const enCobro = r.app.cobrar.some(g => (g.gastos || []).some(x => x.id === gx.id));
          const enPago = r.app.pagar.some(g => (g.gastos || []).some(x => x.id === gx.id));
          if (enCobro !== (!gx.cobrado && !gx.absorbe_pb)) malos.push({ escenario: i, que: 'gasto extra en Por cobrar', gx });
          if (enPago !== (!gx.reintegrado && s.fecha <= hoy)) malos.push({ escenario: i, que: 'gasto extra en Por pagar', gx });
        }
      }
      sinDiferencias(malos, `Por cobrar y Por pagar (${dia})`);
      anotarCasos(N, `bases chicas (${dia})`);
      verificarLimpio(e);
    });
  }

  test('lo que se ve en Por cobrar y Por pagar es lo que dice el oráculo', async ({ page }) => {
    const ahora = HOYS[0][1];
    const app_config = [{ id: 'fijos_automaticos', valor: { activo: true, dias: 14 }, actualizado_at: '2026-10-04T06:00:00Z' }];
    const e = await abrirApp(page, { ahora, datos: { app_config } });
    await irAModulo(page, 'finanzas');
    await cargarOraculo(page);
    const az = crearAzar(SEMILLA + 20);
    const malos = [];
    const N = 60;
    for (let i = 0; i < N; i++) {
      // Cada escenario en otro de los días de HOYS: cambia qué semanas ya cerraron.
      const hoyCaso = HOYS[i % HOYS.length][1];
      await page.clock.setFixedTime(new Date(hoyCaso));
      Object.assign(e.db, escenarioPendientes(az, hoyCaso.slice(0, 10), true));
      const r = await page.evaluate(async () => {
        await cargarPorCobrarPorPagar();
        // Lo que se ve: nombre y monto de cada fila (en la semana en curso, lo que "lleva").
        const filas = sel => [...document.querySelectorAll(sel)].map(f => [f.children[0].children[0].textContent.trim(), Number(f.children[1].querySelector('span').textContent.replace(/[^0-9-]/g, ''))]);
        const visto = {
          cobrar: filas('#fin-porcobrar-wrap .agendarow'),
          pagar: filas('#fin-porpagar-wrap .agendarow:not(.fin-semana-en-curso)'),
          enCurso: filas('#fin-porpagar-wrap .fin-semana-en-curso'),
        };
        // Misma composición que cargarPorCobrarPorPagar (finanzas.js), con las funciones del oráculo.
        const O = ORACULO, hoyISO = todayISO();
        const { gruposCobrar, gruposPagar } = await O.calcularPendientesAgrupados();
        const inter = await O.intermediacionesPendientes();
        const listaCobrar = gruposCobrar.filter(g => g.frec !== 'semanal' || O.finDeSemanaDesde(g.bucket) < hoyISO);
        const enCurso = g => g.frec === 'semanal' && !O.semanaFijoCerrada(g.cierre);
        const listaPagar = gruposPagar.filter(g => !enCurso(g));
        const ajustes = await O.cargarAjustesSaldo();
        O.aplicarAjustesAGrupos(listaCobrar, ajustes, 'familia');
        O.aplicarAjustesAGrupos(listaPagar, ajustes, 'ninera');
        const oraculo = {
          cobrar: [...listaCobrar, ...inter.cobrar].map(g => [g.nombre, O.montoGrupo(g, 'familia')]),
          pagar: [...listaPagar, ...inter.pagar].map(g => [g.nombre, O.montoGrupo(g, 'ninera')]),
          enCurso: gruposPagar.filter(enCurso).map(g => [g.nombre, O.redondearPago(g.total)]),
        };
        return { visto, oraculo };
      });
      const ordenar = l => l.map(x => x.join(' $')).sort();
      for (const k of ['cobrar', 'pagar', 'enCurso']) {
        if (!igual(ordenar(r.visto[k]), ordenar(r.oraculo[k]))) malos.push({ escenario: i, lista: k, visto: r.visto[k], oraculo: r.oraculo[k] });
      }
    }
    sinDiferencias(malos, 'pantallas de Por cobrar y Por pagar');
    anotarCasos(N, 'pantallas de Finanzas');
    verificarLimpio(e);
  });

  test('la prueba SQL de paridad está al día con el oráculo y la semilla', () => {
    // Si cambia el oráculo o el generador, hay que volver a generarla: node scripts/paridad-plata-sql.js
    const enRepo = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'pruebas', 'paridad_plata.sql'), 'utf8');
    expect(enRepo === generarSQL(), 'supabase/pruebas/paridad_plata.sql está desactualizada: node scripts/paridad-plata-sql.js').toBe(true);
  });
});
