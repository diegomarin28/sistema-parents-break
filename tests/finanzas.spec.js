// Resumen de Finanzas (PR 2, 05/10/2026): Facturado / Cobrado / Por cobrar / Por pagar, y el
// resultado del mes calculado sobre lo facturado (error E1: nunca más una pérdida falsa por
// cobros sin marcar).
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting } = require('./support/datos');

async function verMes(page, mes) {
  await page.evaluate(async m => { finMes = m; await cargarFinanzas(); }, mes);
  await esperarQuieta(page);
}
const cifra = (page, id) => page.locator(`#${id}`).innerText();

test('setiembre en los datos ficticios: cada cifra del resumen', async ({ page }) => {
  // Sittings de setiembre: 3 de $1.140/$750 (uno cobrado y pagado, uno pagado) y un
  // traslado de $450/$250. Gastos: $500 de insumos + $800 de gasto fijo.
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await verMes(page, '2026-09');
  expect(await cifra(page, 'fin-facturado')).toBe('$3.870');
  expect(await cifra(page, 'fin-cobrado')).toBe('$1.140');
  expect(await cifra(page, 'fin-porcobrar')).toBe('$2.730');
  expect(await cifra(page, 'fin-porpagar')).toBe('$1.000');
  expect(await cifra(page, 'fin-resultado')).toBe('$70'); // 3.870 − 2.500 − 1.300
  verificarLimpio(e);
});

test('marcar cobrado cambia lo cobrado pero no el resultado del mes', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await verMes(page, '2026-09');
  const resultadoAntes = await cifra(page, 'fin-resultado');
  const pendientes = await page.evaluate(() => finSitsTodosDelMes.filter(r => !r.cobrado).map(r => r.id));
  await page.evaluate(ids => marcarGrupoResuelto(ids, 'cobrado'), pendientes);
  await expect(page.locator('#fin-cobrado')).toHaveText('$3.870');
  await expect(page.locator('#fin-porcobrar')).toHaveText('$0');
  expect(await cifra(page, 'fin-resultado')).toBe(resultadoAntes);
  verificarLimpio(e);
});

test('todo pagado a niñeras y nada cobrado todavía no da pérdida (caso real de setiembre)', async ({ page }) => {
  const datos = datosBase();
  datos.sittings_traslados = datos.sittings_traslados.map(r => ({ ...r, cobrado: false, pagado: true }));
  datos.gastos_generales = [];
  datos.gastos_fijos = [];
  const e = await abrirApp(page, { datos });
  await irAModulo(page, 'finanzas');
  await verMes(page, '2026-09');
  expect(await cifra(page, 'fin-cobrado')).toBe('$0');
  expect(await cifra(page, 'fin-resultado')).toBe('$1.370'); // 3.870 − 2.500
  await expect(page.locator('#fin-summary .fin-resultado')).not.toContainText('-');
  verificarLimpio(e);
});

test('facturado siempre es cobrado + por cobrar', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  for (const mes of ['2026-09', '2026-10']) {
    await verMes(page, mes);
    const n = async id => Number((await cifra(page, id)).replace(/[$.]/g, ''));
    expect(await n('fin-facturado')).toBe(await n('fin-cobrado') + await n('fin-porcobrar'));
  }
  verificarLimpio(e);
});

test('el balance de varios meses usa lo facturado, no solo lo cobrado', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  const datosGrafico = await page.evaluate(() => finBalanceChart.config.data.datasets.map(d => [d.label, d.data]));
  // Últimos 6 meses (may..oct); setiembre es el penúltimo.
  expect(datosGrafico[0][0]).toBe('Facturado');
  expect(datosGrafico[0][1][4]).toBe(3870);
  expect(datosGrafico[1][1][4]).toBe(2500 + 500 + 800);
  verificarLimpio(e);
});

// 05/10/2026: el "Por pagar a niñeras" del resumen deja afuera los días que todavía no
// pasaron, igual que la lista de Por pagar (E7). Facturado y resultado sí los cuentan.
test.describe('Por pagar del resumen sin días futuros', () => {
  function datosConFuturo() {
    const d = datosBase();
    d.sittings_traslados.push(
      sitting('70000000-0000-4000-8000-000000000091', '2026-10-02', {}),
      sitting('70000000-0000-4000-8000-000000000092', '2026-10-10', {}),
    );
    return d;
  }
  test('hoy 04/10: cuenta el del 02/10 y avisa el del 10/10 aparte', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFuturo() });
    await irAModulo(page, 'finanzas');
    await verMes(page, '2026-10');
    // Con espera: al entrar a Finanzas el mes actual se carga dos veces (el módulo y verMes).
    await expect(page.locator('#fin-porpagar')).toHaveText('$750');
    await expect(page.locator('#fin-porpagar-futuro')).toHaveText('Sin contar $750 de días que todavía no pasaron.');
    await expect(page.locator('#fin-facturado')).toHaveText('$2.280');
    verificarLimpio(e);
  });
  test('cuando llega el día entra en Por pagar y desaparece el aviso', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFuturo(), ahora: '2026-10-10T09:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await verMes(page, '2026-10');
    await expect(page.locator('#fin-porpagar')).toHaveText('$1.500');
    await expect(page.locator('#fin-porpagar-futuro')).toHaveCount(0);
    verificarLimpio(e);
  });
});
