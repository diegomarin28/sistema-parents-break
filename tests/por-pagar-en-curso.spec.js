// Por pagar, semana en curso (20/10/2026): a las fijas su semana les aparecía recién cuando
// cerraba (sábado, o domingo si trabajan el fin de semana) y parecía que faltaban pagos.
// Ahora la semana que todavía no cerró se ve aparte, "Semana en curso, cierra el ...", con
// lo que llevan hasta hoy y sin botón para pagar. Los días que no pasaron no entran (E7).
// Datos ficticios: Ana es fija de Familia Prueba Uno los lunes y miércoles (cierra el sábado).
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
    sitting(S(1), '2026-10-12', fijo),                    // semana 12-17/10: ya cerró
    sitting(S(2), '2026-10-19', fijo),                    // semana en curso (cierra el 24/10)
    sitting(S(3), '2026-10-21', { ...fijo, pago_ninera: 800 }),
    sitting(FUTURO, '2026-10-26', { ...fijo, pago_ninera: 999 }), // todavía no pasó
    // Puntual de Bruno esta semana: no es fijo, se paga por día como siempre.
    sitting(S(5), '2026-10-20', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', pago_ninera: 600 }),
  );
  return d;
}
// Carla: fija con un horario los sábados, así que su semana cierra el domingo.
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
    await expect(listos(page).filter({ hasText: 'Ana Ficticia' }).filter({ hasText: /Semana del 12/ }).locator('button', { hasText: 'Marcar pagado' })).toHaveCount(1);
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

  test('el día que cierra dice "cierra hoy" y al día siguiente pasa a pagarse', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: '2026-10-24T10:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Ana Ficticia' })).toContainText('Semana en curso, cierra hoy');
    await page.clock.setFixedTime(new Date('2026-10-25T10:00:00-03:00'));
    await page.evaluate(() => cargarPorCobrarPorPagar());
    await expect(listos(page).filter({ hasText: /Semana del 19/ })).toContainText('$1.550');
    await expect(enCurso(page)).toHaveCount(0);
    // Marcar pagado sigue pasando por la confirmación y marca justo esos dos (no el del 26).
    await listos(page).filter({ hasText: /Semana del 19/ }).locator('button', { hasText: 'Marcar pagado' }).click();
    await page.locator('[aria-label="Confirmar pago"] button', { hasText: 'Confirmar pago' }).click();
    await expect.poll(() => e.db.sittings_traslados.filter(r => r.pagado && [S(2), S(3)].includes(r.id)).length).toBe(2);
    expect(e.db.sittings_traslados.find(r => r.id === FUTURO).pagado).toBe(false);
    verificarLimpio(e);
  });

  test('una fija que trabaja el fin de semana cierra el domingo', async ({ page }) => {
    const e = await abrirApp(page, { datos: conCarlaFinde(datos()), ahora: '2026-10-17T20:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    const fila = enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Carla Ejemplo' });
    await expect(fila).toContainText('Semana en curso, cierra el domingo 18/10');
    await expect(fila).toContainText('$500');
    // Ana, en cambio, cierra hoy sábado.
    await expect(enCurso(page).locator('.fin-semana-en-curso', { hasText: 'Ana Ficticia' })).toContainText('cierra hoy');
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
