// Siempre clara (21/10/2026, Paulina y Delfina): fondo blanco aunque el celular o la compu estén en
// modo oscuro, con los campos y las barras en claro.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');

test.use({ colorScheme: 'dark' });

for (const [nombre, modulo] of [['Hoy', null], ['Postulantes (formulario)', 'rrhh'], ['Finanzas', 'finanzas']]) {
  test(`con el aparato en modo oscuro, ${nombre} se ve claro`, async ({ page }) => {
    const e = await abrirApp(page);
    if (modulo) await irAModulo(page, modulo);
    const colores = await page.evaluate(() => {
      const fondo = el => getComputedStyle(el).backgroundColor;
      const campo = document.querySelector('input, select, textarea');
      return {
        prefiereOscuro: matchMedia('(prefers-color-scheme: dark)').matches,
        esquema: getComputedStyle(document.documentElement).colorScheme,
        body: fondo(document.body),
        tarjeta: document.querySelector('.card') ? fondo(document.querySelector('.card')) : null,
        campo: campo ? getComputedStyle(campo).colorScheme : null,
      };
    });
    expect(colores.prefiereOscuro).toBe(true); // el aparato sí está en oscuro
    expect(colores.esquema).toContain('light');
    expect(colores.esquema).not.toContain('dark');
    const claro = rgb => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return r > 230 && g > 230 && b > 230; };
    expect(claro(colores.body)).toBe(true);
    if (colores.tarjeta) expect(claro(colores.tarjeta)).toBe(true);
    if (colores.campo) expect(colores.campo).not.toContain('dark');
    verificarLimpio(e);
  });
}

test('el HTML lo pide para el navegador, no solo para el CSS', async ({ page }) => {
  const e = await abrirApp(page);
  expect(await page.locator('meta[name="color-scheme"]').getAttribute('content')).toBe('only light');
  verificarLimpio(e);
});
