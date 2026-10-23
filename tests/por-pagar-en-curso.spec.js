// Por pagar, semana en curso (20/10/2026): a las fijas su semana les aparecía recién cuando
// cerraba (sábado, o domingo si trabajan el fin de semana) y parecía que faltaban pagos.
// Ahora la semana que todavía no cerró se ve aparte, "Semana en curso, cierra el ...", con
// lo que llevan hasta hoy y sin botón para pagar. Los días que no pasaron no entran (E7).
// 21/10/2026 (regla de Paulina y Delfina): se paga el MISMO día que cierra, cuando terminó el
// último fijo de ese día; antes se ve "cierra hoy a las HH:MM". Los dos tests de "el día que
// cierra" se adaptaron a esa regla (antes esperaban que se pagara recién al día siguiente).
// 23/10/2026 (regla de Paulina y Delfina del 21/10): las fijas se pagan SIEMPRE el sábado, también
// las que trabajan el fin de semana. La semana de pago va de domingo a sábado: lo del domingo entra
// en la semana que se paga el sábado siguiente. Los tests de Carla (fija los sábados o los domingos)
// se adaptaron: antes esperaban que su semana cerrara el domingo.
// Datos ficticios: Ana es fija de Familia Prueba Uno los lunes y miércoles.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const S = n => '70000000-0000-4000-8000-0000000002' + String(n).padStart(2, '0');
const FUTURO = S(4);
const AJ = 'a5000000-0000-4000-8000-000000000021';

function datos() {
  const d = datosBase();
  const fijo = { asignacion_id: ID.aFijo };
  d.sittings_traslados.push(
    sitting(S(1), '2026-10-12', fijo),                    // semana 11-17/10: ya cerró
    sitting(S(2), '2026-10-19', fijo),                    // semana en curso (18-24/10, cierra el 24/10)
    sitting(S(3), '2026-10-21', { ...fijo, pago_ninera: 800 }),
    sitting(FUTURO, '2026-10-26', { ...fijo, pago_ninera: 999 }), // todavía no pasó
    // Puntual de Bruno esta semana: no es fijo, se paga por día como siempre.
    sitting(S(5), '2026-10-20', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', pago_ninera: 600 }),
  );
  return d;
}
// Carla: fija con un horario los sábados. Su semana cierra igual el sábado, cuando termina ese fijo.
function conCarlaFinde(d) {
  d.asignaciones.push({ ...d.asignaciones[0], id: '40000000-0000-4000-8000-000000000021', familia_id: ID.fDos, ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', dias: ['S'] });
  d.sittings_traslados.push(sitting(S(6), '2026-10-17', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', asignacion_id: '40000000-0000-4000-8000-000000000021', pago_ninera: 500 }));
  return d;
}

const caja = page => page.locator('#fin-porpagar-wrap');
const enCurso = page => page.locator('#fin-porpagar-encurso');
const listos = page => page.locator('#fin-porpagar-wrap .agendarow:not(.fin-semana-en-curso)');

test.describe('Por pagar: semana en curso de las fijas', () => {
  test('se ve aparte, con lo que lleva hasta hoy, cuándo cierra y sin botón', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: '2026-10-21T18:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    const fila = enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Ana Ficticia' });
    await expect(fila).toContainText('Semana en curso, cierra el sábado 24/10');
    await expect(fila).toContainText('$1.550'); // 750 (lunes) + 800 (hoy), sin el del 26/10
    await expect(enCurso(page)).toContainText('todavía no cierra');
    await expect(enCurso(page).locator('button')).toHaveCount(0);
    // La semana que ya cerró sigue arriba, con su botón.
    await expect(listos(page).filter({ hasText: 'Ana Ficticia' }).filter({ hasText: /Semana del 11/ }).locator('button', { hasText: 'Marcar pagado' })).toHaveCount(1);
    // El puntual de esta semana no es de un fijo: va arriba, como siempre.
    await expect(listos(page).filter({ hasText: 'Bruno Inventado' }).filter({ hasText: '$600' })).toHaveCount(1);
    await expect(enCurso(page)).not.toContainText('Bruno Inventado');
    // El total de arriba es solo lo que se puede pagar: 750 (28/09) + 750 (12/10) + 250 + 600.
    await expect(caja(page).locator('h2 + .helper')).toHaveText('4 pendientes · $2.350');
    // Lo que todavía no pasó no aparece en ningún lado.
    await expect(caja(page)).not.toContainText('$999');
    expect(await page.evaluate(() => document.getElementById('fin-porpagar-wrap').innerHTML)).not.toContain(FUTURO);
    verificarLimpio(e);
  });

  test('el viernes dice "cierra mañana" y el sábado que cierra (sin fijo ese día) ya se paga desde temprano', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: '2026-10-23T23:59:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Ana Ficticia' })).toContainText('Semana en curso, cierra mañana');
    await page.clock.setFixedTime(new Date('2026-10-24T08:00:00-03:00'));
    await page.evaluate(() => cargarPorCobrarPorPagar());
    await expect(listos(page).filter({ hasText: /Semana del 18/ })).toContainText('$1.550');
    await expect(enCurso(page)).toHaveCount(0);
    // Marcar pagado sigue pasando por la confirmación y marca justo esos dos (no el del 26).
    await listos(page).filter({ hasText: /Semana del 18/ }).locator('button', { hasText: 'Marcar pagado' }).click();
    await page.locator('[aria-label="Confirmar pago"] button', { hasText: 'Confirmar pago' }).click();
    await expect.poll(() => e.db.sittings_traslados.filter(r => r.pagado && [S(2), S(3)].includes(r.id)).length).toBe(2);
    expect(e.db.sittings_traslados.find(r => r.id === FUTURO).pagado).toBe(false);
    verificarLimpio(e);
  });

  test('una fija que trabaja el fin de semana también cobra el sábado, cuando termina su fijo de ese día', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaFinde(datos()), ahora: '2026-10-17T18:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    const fila = enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Carla Ejemplo' });
    await expect(fila).toContainText('Semana en curso, cierra hoy a las 19:00');
    await expect(fila).toContainText('$500');
    await expect(enCurso(page)).not.toContainText('Ana Ficticia'); // Ana no tiene fijo hoy: ya se le paga
    await page.clock.setFixedTime(new Date('2026-10-17T19:00:00-03:00'));
    await page.evaluate(() => cargarPorCobrarPorPagar());
    await expect(enCurso(page)).toHaveCount(0);
    await expect(listos(page).filter({ hasText: 'Carla Ejemplo' }).filter({ hasText: /Semana del 11-oct.* al 17-oct/ }).locator('button', { hasText: 'Marcar pagado' })).toHaveCount(1);
    await expect(listos(page).filter({ hasText: 'Ana Ficticia' }).filter({ hasText: /Semana del 11/ }).locator('button', { hasText: 'Marcar pagado' })).toHaveCount(1);
    verificarLimpio(e);
  });

  test('sin nada para pagar todavía: lo dice y muestra igual la semana en curso', async ({ page }) => {
    const d = datos();
    d.sittings_traslados.forEach(r => { if (r.fecha < '2026-10-19') r.pagado = true; });
    d.sittings_traslados = d.sittings_traslados.filter(r => r.id !== S(5));
    const e = await abrirApp(page, { datos: d, ahora: '2026-10-21T18:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(caja(page)).toContainText('No hay pagos pendientes.');
    await expect(enCurso(page)).toContainText('Ana Ficticia');
    await expect(enCurso(page)).toContainText('$1.550');
    verificarLimpio(e);
  });

  test('el saldo a favor no se descuenta de la semana en curso: espera al pago', async ({ page }) => {
    const d = datos();
    d.sittings_traslados.forEach(r => { if (r.fecha < '2026-10-19') r.pagado = true; });
    d.ajustes_saldo = [{ id: AJ, sujeto: 'ninera', familia_id: null, ninera_id: ID.nAna, nombre: 'Ana Ficticia', monto: -300,
      motivo: 'Descuento de prueba', fecha: '2026-10-20', aplicado: 0, aplicaciones: [], creado_por: null, created_at: '2026-10-20T12:00:00Z' }];
    const e = await abrirApp(page, { datos: d, ahora: '2026-10-21T18:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(enCurso(page)).toContainText('$1.550');
    await expect(enCurso(page)).not.toContainText('Descuento de prueba');
    await expect(caja(page).locator('.fin-saldos-sueltos')).toContainText('Descuento de prueba');
    verificarLimpio(e);
  });

  test('nombre con HTML: se muestra como texto', async ({ page }) => {
    const d = datos();
    const raro = '<img src=x onerror="window.__xss=1">Ana';
    d.sittings_traslados.forEach(r => { if (r.ninera_id === ID.nAna) r.ninera_nombre = raro; });
    d.ninieras.find(n => n.id === ID.nAna).nombre = raro;
    d.asignaciones[0].ninera_nombre = raro;
    const e = await abrirApp(page, { datos: d, ahora: '2026-10-21T18:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(enCurso(page)).toContainText(raro);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    verificarLimpio(e);
  });
});

test.describe('Por pagar con semana en curso en el celular (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('no se sale de la pantalla', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaFinde(datos()), ahora: '2026-10-21T18:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(enCurso(page)).toContainText('Ana Ficticia');
    await page.locator('#fin-porpagar-encurso').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/por-pagar-en-curso-390.png', fullPage: false });
    verificarLimpio(e);
  });
});

// Cierre el mismo día, cuando terminó el último fijo (21/10/2026). Carla es fija los sábados
// (23/10/2026: antes era los domingos y su semana cerraba el domingo; ahora todas cierran el
// sábado). Hoy es sábado 24/10 en todos estos casos.
const A_SAB = '40000000-0000-4000-8000-000000000022';
function conCarlaSabado(d, { ini = '15:00:00', fin = '19:00:00', registrado } = {}) {
  d.asignaciones.push({ ...d.asignaciones[0], id: A_SAB, familia_id: ID.fDos, ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', dias: ['S'], hora_inicio: ini, hora_fin: fin });
  const r = registrado || { ini, fin };
  d.sittings_traslados.push(sitting(S(7), '2026-10-24', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo',
    asignacion_id: A_SAB, hora_inicio: r.ini, hora_fin: r.fin, termina_dia_siguiente: r.fin <= r.ini, pago_ninera: 500 }));
  return d;
}
const filaCarla = page => enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Carla Ejemplo' });
const listaCarla = page => listos(page).filter({ hasText: 'Carla Ejemplo' }).filter({ hasText: /Semana del 18/ });
async function aLas(page, iso) {
  await page.clock.setFixedTime(new Date(iso));
  await page.evaluate(() => cargarPorCobrarPorPagar());
}

test.describe('Por pagar: se paga el día que cierra, cuando terminó el último fijo', () => {
  test('sábado: antes de que termine su fijo, "cierra hoy a las 19:00" y sin botón; después, se paga', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaSabado(datos()), ahora: '2026-10-24T14:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(filaCarla(page)).toContainText('Semana en curso, cierra hoy a las 19:00');
    await expect(filaCarla(page)).toContainText('$500');
    await expect(listaCarla(page)).toHaveCount(0);
    await aLas(page, '2026-10-24T18:59:00-03:00');
    await expect(filaCarla(page)).toContainText('cierra hoy a las 19:00');
    await aLas(page, '2026-10-24T19:00:00-03:00');
    await expect(listaCarla(page).locator('button', { hasText: 'Marcar pagado' })).toHaveCount(1);
    await expect(filaCarla(page)).toHaveCount(0);
    verificarLimpio(e);
  });

  test('un fijo que pasa la medianoche cierra al día siguiente, a su hora', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaSabado(datos(), { ini: '21:00:00', fin: '01:00:00' }), ahora: '2026-10-24T23:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(filaCarla(page)).toContainText('cierra mañana a las 01:00');
    await aLas(page, '2026-10-25T00:30:00-03:00');
    await expect(filaCarla(page)).toContainText('cierra hoy a las 01:00');
    await aLas(page, '2026-10-25T01:00:00-03:00');
    await expect(listaCarla(page)).toHaveCount(1);
    verificarLimpio(e);
  });

  test('si ese día se registró un horario más largo que el del fijo, espera al registrado', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaSabado(datos(), { registrado: { ini: '15:00:00', fin: '21:00:00' } }), ahora: '2026-10-24T20:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(filaCarla(page)).toContainText('cierra hoy a las 21:00');
    await aLas(page, '2026-10-24T21:00:00-03:00');
    await expect(listaCarla(page)).toHaveCount(1);
    verificarLimpio(e);
  });

  test('si ese día todavía no está registrado, espera igual a la hora del fijo', async ({ page }) => {
    const d = conCarlaSabado(datos());
    d.sittings_traslados = d.sittings_traslados.filter(r => r.id !== S(7));
    d.sittings_traslados.push(sitting(S(8), '2026-10-23', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', asignacion_id: A_SAB, pago_ninera: 400 }));
    const e = await abrirApp(page, { datos: d, ahora: '2026-10-24T18:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(filaCarla(page)).toContainText('cierra hoy a las 19:00');
    verificarLimpio(e);
  });

  test('el resumen del mes usa la misma regla', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaSabado(datos()), ahora: '2026-10-24T14:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(page.locator('#fin-porpagar-semanas')).toContainText('Más $500 de semanas que todavía no cierran');
    await page.clock.setFixedTime(new Date('2026-10-24T19:30:00-03:00'));
    await irAModulo(page, 'agenda');
    await irAModulo(page, 'finanzas');
    await expect(page.locator('#fin-porpagar')).toBeVisible();
    await expect(page.locator('#fin-porpagar-semanas')).toHaveCount(0);
    verificarLimpio(e);
  });
});

test.describe('siempre el sábado (23/10/2026)', () => {
  test('lo que una fija trabaja el domingo va a la semana que se paga el sábado siguiente', async ({ page }) => {
    const d = datos();
    d.asignaciones.push({ ...d.asignaciones[0], id: A_SAB, familia_id: ID.fDos, ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', dias: ['D'] });
    d.sittings_traslados.push(
      sitting(S(9), '2026-10-18', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', asignacion_id: A_SAB, pago_ninera: 500 }),
      sitting(S(10), '2026-10-25', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', asignacion_id: A_SAB, pago_ninera: 450 }),
    );
    const e = await abrirApp(page, { datos: d, ahora: '2026-10-25T20:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    // El domingo 18 entró en la semana del 18 al 24, que ya se paga (cerró ayer sábado).
    await expect(listos(page).filter({ hasText: 'Carla Ejemplo' }).filter({ hasText: /Semana del 18-oct.* al 24-oct/ })).toContainText('$500');
    // El de hoy domingo 25 es de la semana que cierra el sábado 31.
    const fila = enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Carla Ejemplo' });
    await expect(fila).toContainText('Semana en curso, cierra el sábado 31/10');
    await expect(fila).toContainText('$450');
    verificarLimpio(e);
  });

  test('un sábado, el margen del mes cuenta la semana que ya se paga (antes esperaba al lunes)', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: '2026-10-24T10:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    // Ana cerró hoy: su semana está para pagar, y el margen la cuenta: 12/10 + 19/10 + 21/10 de
    // Familia Prueba Uno ($1.140 cada uno) = $3.420 en octubre.
    await expect(listos(page).filter({ hasText: /Semana del 18/ })).toContainText('$1.550');
    await expect(page.locator('#fin-margen-tabla')).toContainText('$3.420');
    verificarLimpio(e);
  });
});

test.describe('Por pagar: el cierre es en hora de Montevideo aunque el aparato tenga otra zona', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });
  test('a las 18:30 de Montevideo todavía no, a las 19:30 sí', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaSabado(datos()), ahora: '2026-10-24T18:30:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(filaCarla(page)).toContainText('cierra hoy a las 19:00');
    await aLas(page, '2026-10-24T19:30:00-03:00');
    await expect(listaCarla(page)).toHaveCount(1);
    verificarLimpio(e);
  });
});
