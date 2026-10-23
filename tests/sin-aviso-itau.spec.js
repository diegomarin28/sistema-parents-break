// Aviso del extracto de Itaú apagado (23/10/2026): ya no usan Itaú y el lector de Mercado Pago
// todavía no está. Ni Finanzas, ni la campanita, ni el puntito de Finanzas avisan que falta subir
// el extracto; la conciliación sigue a mano para quien quiera subir uno. Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');
const { datosBase } = require('./support/datos');

const hace30dias = { id: 'ultima_conciliacion_cobros', valor: {}, actualizado_at: '2026-09-04T12:00:00Z' };
// Nada pendiente de pagar: lo único que podría prender el puntito sería el extracto.
function sinPendientes(app_config = []) {
  const d = datosBase();
  d.sittings_traslados.forEach(s => { s.pagado = true; });
  d.app_config = app_config;
  return d;
}

for (const [caso, app_config] of [['nunca se subió uno', []], ['el último es de hace 30 días', [hace30dias]]]) {
  test(`${caso}: Finanzas, la campanita y el puntito no avisan del extracto`, async ({ page }) => {
    const e = await abrirApp(page, { datos: sinPendientes(app_config) });
    await irAModulo(page, 'finanzas');
    await expect(page.locator('#fin-porpagar-wrap')).toContainText('Por pagar');
    await expect(page.locator('#fin-extracto-aviso')).toBeEmpty();
    await page.evaluate(() => cargarNotificaciones());
    expect(await page.evaluate(() => notifItems.filter(n => n.tipo === 'extracto').length)).toBe(0);
    await page.evaluate(() => actualizarFinanzasBadge());
    await expect(page.locator('#finanzas-navdot .navdot')).toHaveCount(0);
    // En las preferencias de notificaciones tampoco aparece el switch del extracto.
    expect(await page.evaluate(() => TIPOS_NOTIF.map(t => t.tipo))).not.toContain('extracto');
    verificarLimpio(e);
  });
}

test('la conciliación con un extracto sigue a mano en Finanzas', async ({ page }) => {
  const e = await abrirApp(page, { datos: sinPendientes() });
  await irAModulo(page, 'finanzas');
  await expect(page.locator('#fin-conciliar-file')).toHaveCount(1);
  verificarLimpio(e);
});
