// Por cobrar / Por pagar en tarjetas (23/10/2026, pedido de Diego con captura): una sola tarjeta
// por familia (o por niñera) con todos sus pendientes adentro, agrupados por fecha, aunque cobre
// "diario". Cerrada: el total y "Marcar todo cobrado". Abierta: el detalle en un recuadro y abajo
// "Marcar cobrado lo tildado ($X)", que se actualiza al tildar, y "Marcar todo cobrado ($Y)".
// "¿Cuánto pagó?" busca en todos los pendientes de la familia. Hoy = viernes 23/10/2026.
// Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const AHORA = '2026-10-23T12:00:00-03:00';
const D = n => '73000000-0000-4000-8000-0000000000' + String(n).padStart(2, '0');
const GASTO = 'b8000000-0000-4000-8000-000000000001';
const AJ = 'a8000000-0000-4000-8000-000000000001';
const deDos = { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', pagado: true };

// Familia Prueba Dos cobra "diario": antes eran 4 líneas (13, 15, 20 y 22/10), ahora una tarjeta.
function datos({ gastos = [], ajustes = [] } = {}) {
  const d = datosBase();
  d.familias.find(f => f.id === ID.fDos).frecuencia_cobro = 'diario';
  d.sittings_traslados = [
    sitting(D(1), '2026-10-13', { ...deDos, cobro_familia: 950 }),
    sitting(D(2), '2026-10-15', { ...deDos, cobro_familia: 1140, hora_inicio: '15:00:00', hora_fin: '18:00:00' }),
    sitting(D(3), '2026-10-20', { ...deDos, cobro_familia: 760, ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado' }),
    sitting(D(4), '2026-10-22', { ...deDos, cobro_familia: 1520 }),
  ];
  d.gastos_extra = gastos;
  d.ajustes_saldo = ajustes;
  return d;
}
const gasto = { id: GASTO, sitting_id: D(2), concepto: 'Taxi de vuelta', monto: 300, pagado_por: 'ninera', comprobante: `${D(2)}/t.jpg`,
  cobrado: false, reintegrado: true, ajuste_id: null, creado_por: null, absorbe_pb: false, created_at: '2026-10-15T22:00:00Z' };
const ajuste = { id: AJ, sujeto: 'familia', familia_id: ID.fDos, ninera_id: null, nombre: 'Familia Prueba Dos', monto: -500,
  motivo: 'Pagó de más en setiembre', fecha: '2026-10-01', aplicado: 0, aplicaciones: [], creado_por: null, created_at: '2026-10-01T12:00:00Z' };

const porCobrar = page => page.locator('#fin-porcobrar-wrap');
const tarjeta = (box, nombre) => box.locator('.fin-pend', { hasText: nombre });
const dia = (t, fecha) => t.locator('.fin-det-dia', { hasText: fecha });
const casillaDia = (t, fecha) => dia(t, fecha).locator('.fin-det-fila').first().locator('input[type=checkbox]');
const cobrados = e => e.db.sittings_traslados.filter(s => s.cobrado).map(s => s.id).sort();
async function abrir(t) {
  await t.locator('.fin-pend-cabeza').click();
  await expect(t.locator('.fin-det-fila').first()).toBeVisible();
}

test('una sola tarjeta por familia aunque cobre "diario", con el total y los días adentro', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
  await irAModulo(page, 'finanzas');
  const t = tarjeta(porCobrar(page), 'Familia Prueba Dos');
  await expect(t).toHaveCount(1);
  await expect(t.locator('.agendarow').first()).toContainText('$4.370'); // 950 + 1.140 + 760 + 1.520
  await expect(t.locator('.agendarow').first()).toContainText('4 pendientes');
  await abrir(t);
  await expect(t.locator('.fin-det-caja')).toBeVisible();
  await expect(t.locator('.fin-det-dia')).toHaveCount(4);
  for (const f of ['13/10', '15/10', '20/10', '22/10']) await expect(dia(t, f)).toHaveCount(1);
  const fila = dia(t, '20/10').locator('.fin-det-fila').first();
  await expect(fila).toContainText('16:00–19:00');
  await expect(fila).toContainText('Bruno Inventado');
  await expect(fila).toContainText('$760');
  verificarLimpio(e);
});

test('un registro viejo que trae la familia solo por el nombre va en la misma tarjeta', async ({ page }) => {
  const d = datos();
  d.sittings_traslados.push(sitting(D(5), '2026-10-21', { ...deDos, familia_id: null, cobro_familia: 400 }));
  const e = await abrirApp(page, { datos: d, ahora: AHORA });
  await irAModulo(page, 'finanzas');
  const t = tarjeta(porCobrar(page), 'Familia Prueba Dos');
  await expect(t).toHaveCount(1);
  await expect(t.locator('.agendarow').first()).toContainText('$4.770');
  await expect(t.locator('.agendarow').first()).toContainText('5 pendientes');
  verificarLimpio(e);
});

test('cerrada tiene un solo "Marcar todo cobrado"; abierta, los dos botones abajo con el monto, que se actualiza al tildar', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
  await irAModulo(page, 'finanzas');
  const t = tarjeta(porCobrar(page), 'Familia Prueba Dos');
  await expect(t.locator('button', { hasText: /^Marcar/ })).toHaveCount(1);
  await expect(t.locator('button', { hasText: 'Marcar todo cobrado' })).toHaveCount(1);
  await abrir(t);
  const tildado = t.locator('.fin-det-botones button', { hasText: 'Marcar cobrado lo tildado' });
  const todo = t.locator('.fin-det-botones button', { hasText: 'Marcar todo cobrado' });
  await expect(t.locator('button', { hasText: /^Marcar/ })).toHaveCount(2); // el de arriba se va
  await expect(tildado).toHaveText('Marcar cobrado lo tildado ($4.370)');
  await expect(todo).toHaveText('Marcar todo cobrado ($4.370)');
  await casillaDia(t, '22/10').uncheck();
  await expect(tildado).toHaveText('Marcar cobrado lo tildado ($2.850)');
  await expect(todo).toHaveText('Marcar todo cobrado ($4.370)');
  // "Marcar todo" marca todo aunque haya algo destildado.
  await todo.click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' })).toBeVisible();
  expect(cobrados(e)).toEqual([D(1), D(2), D(3), D(4)]);
  verificarLimpio(e);
});

test('"¿Cuánto pagó?" busca en todos los días de la familia: $2.090 tilda el 13 y el 15', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
  await irAModulo(page, 'finanzas');
  const t = tarjeta(porCobrar(page), 'Familia Prueba Dos');
  await abrir(t);
  await t.locator('.fin-det-pagado').fill('2090');
  await expect(casillaDia(t, '13/10')).toBeChecked();
  await expect(casillaDia(t, '15/10')).toBeChecked();
  await expect(casillaDia(t, '20/10')).not.toBeChecked();
  await expect(casillaDia(t, '22/10')).not.toBeChecked();
  await t.locator('.fin-det-botones button', { hasText: 'Marcar cobrado lo tildado ($2.090)' }).click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' })).toBeVisible();
  expect(cobrados(e)).toEqual([D(1), D(2)]);
  // Lo que queda sigue en la misma tarjeta, con el total nuevo.
  await expect(tarjeta(porCobrar(page), 'Familia Prueba Dos').locator('.agendarow').first()).toContainText('$2.280');
  verificarLimpio(e);
});

test('el gasto va debajo de su sitting y el saldo a favor en un renglón propio al final', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos({ gastos: [gasto], ajustes: [ajuste] }), ahora: AHORA });
  await irAModulo(page, 'finanzas');
  const t = tarjeta(porCobrar(page), 'Familia Prueba Dos');
  await expect(t.locator('.agendarow').first()).toContainText('$4.170'); // 4.370 + 300 − 500
  await abrir(t);
  await expect(dia(t, '15/10').locator('.fin-det-fila')).toHaveCount(2);
  await expect(dia(t, '15/10').locator('.fin-det-fila').nth(1)).toContainText('Taxi de vuelta');
  const saldo = t.locator('.fin-det-saldos .fin-det-fila');
  await expect(saldo).toHaveCount(1);
  await expect(saldo).toContainText('Pagó de más en setiembre');
  await expect(saldo).toContainText('−$500');
  // El saldo es lo último del detalle, después de todos los días.
  const ultima = t.locator('.fin-det-fila').last();
  await expect(ultima).toContainText('Pagó de más en setiembre');
  verificarLimpio(e);
});

test('Por pagar: una tarjeta por niñera con la semana del fijo y los puntuales; paga solo lo tildado', async ({ page }) => {
  const d = datosBase();
  d.sittings_traslados = [
    sitting(D(11), '2026-10-12', { asignacion_id: ID.aFijo, cobrado: true }),                     // semana del 11 al 17: cerró
    sitting(D(12), '2026-10-14', { asignacion_id: ID.aFijo, cobrado: true }),
    sitting(D(13), '2026-10-20', { ...deDos, ninera_id: ID.nAna, ninera_nombre: 'Ana Ficticia', pagado: false, cobrado: true, pago_ninera: 600 }), // puntual
  ];
  const e = await abrirApp(page, { datos: d, ahora: AHORA });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await irAModulo(page, 'finanzas');
  const t = tarjeta(page.locator('#fin-porpagar-wrap'), 'Ana Ficticia');
  await expect(t).toHaveCount(1);
  await expect(t.locator('.agendarow').first()).toContainText('$2.100');
  await expect(t.locator('button', { hasText: 'Marcar todo pagado' })).toHaveCount(1);
  await abrir(t);
  await expect(t.locator('.fin-det-dia')).toHaveCount(3);
  await casillaDia(t, '20/10').uncheck();
  await expect(t.locator('.fin-det-botones button', { hasText: 'Marcar pagado lo tildado' })).toHaveText('Marcar pagado lo tildado ($1.500)');
  await t.locator('button', { hasText: 'Copiar monto' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('1500');
  await t.locator('.fin-det-botones button', { hasText: 'Marcar pagado lo tildado' }).click();
  await expect(page.locator('#pago-total')).toHaveText('$1.500');
  await page.locator('#pago-confirmar').click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como pagado.' })).toBeVisible();
  expect(e.db.sittings_traslados.filter(s => s.pagado).map(s => s.id).sort()).toEqual([D(11), D(12)]);
  verificarLimpio(e);
});

for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
  test(`a ${ancho} px: renglones de 44 px, casillas grandes, sin scroll de costado (captura)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    const e = await abrirApp(page, { datos: datos({ gastos: [gasto], ajustes: [ajuste] }), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    const t = tarjeta(porCobrar(page), 'Familia Prueba Dos');
    await t.scrollIntoViewIfNeeded();
    await porCobrar(page).screenshot({ path: `test-results/tarjetas-${ancho}-cerrada.png` });
    await abrir(t);
    for (const f of await t.locator('.fin-det-fila').all()) {
      expect((await f.boundingBox()).height).toBeGreaterThanOrEqual(44);
      expect((await f.locator('input[type=checkbox]').boundingBox()).width).toBeGreaterThanOrEqual(24);
    }
    for (const b of await t.locator('.fin-det-botones button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
    await t.screenshot({ path: `test-results/tarjetas-${ancho}-abierta.png` });
    verificarLimpio(e);
  });
}
