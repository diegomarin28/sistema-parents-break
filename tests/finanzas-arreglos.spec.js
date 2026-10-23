// Arreglos chicos de Finanzas (21/10/2026):
// 1. Por pagar: "Copiar" la cuenta y "Copiar monto" (pagan de a una desde Mercado Pago, en el
//    celular); sin cuenta, "Falta la cuenta" con el link a la ficha.
// 2. Resumen: "Por pagar a niñeras" sin las semanas que todavía no cierran (van aparte), y en
//    el mes actual cuánto de la lista es de meses anteriores.
// 3. El puntito rojo de Finanzas avisa también por niñeras de eventos sin pagar.
// 4. Si la base falla al leer Finanzas, nada queda en "Cargando…": error y Reintentar.
// Datos ficticios: Ana es fija de Familia Prueba Uno (su semana de pago va de lunes a sábado).
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const AHORA = '2026-10-21T18:00:00-03:00'; // miércoles
const S = n => '70000000-0000-4000-8000-0000000003' + String(n).padStart(2, '0');
const IGNORAR_RED = [/Failed to load resource|\[Supabase\]/];
const porPagar = page => page.locator('#fin-porpagar-wrap');
const toasts = page => page.locator('.toaststack .toast');

function datos() {
  const d = datosBase();
  const fijo = { asignacion_id: ID.aFijo };
  d.sittings_traslados.push(
    sitting(S(1), '2026-10-12', fijo),                                 // semana que ya cerró: 750
    sitting(S(2), '2026-10-19', fijo),                                 // semana en curso: 750
    sitting(S(3), '2026-10-21', { ...fijo, pago_ninera: 800 }),        // semana en curso: 800
    sitting(S(4), '2026-10-26', { ...fijo, pago_ninera: 999 }),        // todavía no pasó
    // Puntual de Carla (sin cuenta cargada), con centavos.
    sitting(S(5), '2026-10-20', { familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', pago_ninera: 600.5 }),
  );
  return d;
}
// El portapapeles de verdad no anda en todos los navegadores de test: se reemplaza y se
// guarda lo copiado (o se hace fallar, para ver el plan B).
async function espiarPortapapeles(page, { falla = false } = {}) {
  await page.evaluate(f => {
    window.__copiado = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async t => { if (f) throw new Error('sin permiso'); window.__copiado.push(t); },
    } });
  }, falla);
}
const copiado = page => page.evaluate(() => window.__copiado);

test.describe('Por pagar: copiar cuenta y monto', () => {
  test('"Copiar" copia solo la cuenta y "Copiar monto" el número, sin $ ni puntos', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await espiarPortapapeles(page);
    const ana = porPagar(page).locator('.agendarow', { hasText: 'Ana Ficticia' }).filter({ hasText: /Semana del 12/ });
    await expect(ana.locator('.fin-cuenta')).toContainText('0099887766');
    await ana.locator('.fin-cuenta button', { hasText: 'Copiar' }).click();
    await expect(toasts(page).last()).toContainText('Cuenta copiada');
    await ana.locator('button', { hasText: 'Copiar monto' }).click();
    await expect(toasts(page).last()).toContainText('Monto copiado');
    const carla = porPagar(page).locator('.agendarow', { hasText: 'Carla Ejemplo' });
    await carla.locator('button', { hasText: 'Copiar monto' }).click();
    // 600,5 se copia sin centavos con la regla del pago: ,5 baja (21/10/2026). Desde el 23/10 la
    // tarjeta de Ana junta sus dos semanas cerradas (28/09 y 12/10): $1.500.
    expect(await copiado(page)).toEqual(['0099887766', '1500', '600']);
    // Copiar no escribe nada en la base.
    expect(e.escrituras).toHaveLength(0);
    verificarLimpio(e);
  });

  test('sin cuenta cargada: "Falta la cuenta" con el link que abre su ficha', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    const carla = porPagar(page).locator('.agendarow', { hasText: 'Carla Ejemplo' });
    await expect(carla.locator('.fin-falta-cuenta')).toContainText('Falta la cuenta');
    await expect(carla.locator('.fin-cuenta')).toHaveCount(0);
    await carla.locator('.fin-falta-cuenta a', { hasText: 'Cargarla en su ficha' }).click();
    await expect(page.locator('#editmodal')).toContainText('Carla Ejemplo');
    await expect(page.locator('#editmodal')).toContainText('Cuenta bancaria');
    verificarLimpio(e);
  });

  test('si el navegador no deja copiar, muestra el dato para copiarlo a mano', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await espiarPortapapeles(page, { falla: true });
    await porPagar(page).locator('.agendarow', { hasText: 'Ana Ficticia' }).filter({ hasText: /Semana del 12/ }).locator('.fin-cuenta button').click();
    await expect(page.locator('#copiar-a-mano')).toHaveValue('0099887766');
    verificarLimpio(e);
  });

  test('celular de 390px: los botones entran y no hay scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    const ana = porPagar(page).locator('.agendarow', { hasText: 'Ana Ficticia' }).filter({ hasText: /Semana del 12/ });
    for (const texto of ['Copiar', 'Copiar monto', 'Marcar todo pagado']) {
      const box = await ana.locator('button', { hasText: new RegExp(`^${texto}$`) }).boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(30);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await porPagar(page).screenshot({ path: test.info().outputPath('por-pagar-copiar-390.png') });
    verificarLimpio(e);
  });
});

test.describe('resumen: Por pagar a niñeras como la lista', () => {
  test('las semanas que no cierran van aparte y se aclara lo de meses anteriores', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    // Octubre ya pagable: 750 (semana del 12) + 600,5 (Carla), sin centavos con la regla del
    // pago (,5 baja). Septiembre en la lista: 750 + 250.
    await expect(page.locator('#fin-porpagar')).toHaveText('$1.350');
    await expect(page.locator('#fin-porpagar-semanas')).toHaveText('Más $1.550 de semanas que todavía no cierran.');
    await expect(page.locator('#fin-porpagar-futuro')).toHaveText('Sin contar $999 de días que todavía no pasaron.');
    await expect(page.locator('#fin-porpagar-previos')).toHaveText('En la lista de Por pagar hay $1.000 más de meses anteriores.');
    // Mes de octubre + meses anteriores = el total de la lista.
    await expect(porPagar(page).locator('h2 + .helper')).toContainText('$2.350');
    verificarLimpio(e);
  });

  test('en otro mes no aparece la aclaración de meses anteriores', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await page.evaluate(async () => { finMes = '2026-09'; await cargarFinanzas(); });
    await esperarQuieta(page);
    await expect(page.locator('#fin-porpagar')).toHaveText('$1.000');
    await expect(page.locator('#fin-porpagar-previos')).toHaveCount(0);
    await expect(page.locator('#fin-porpagar-semanas')).toHaveCount(0);
    verificarLimpio(e);
  });

  test('sin nada de meses anteriores ni semanas en curso, solo el total', async ({ page }) => {
    const d = datosBase();
    d.sittings_traslados = d.sittings_traslados.map(r => ({ ...r, pagado: true }));
    const e = await abrirApp(page, { datos: d, ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await expect(page.locator('#fin-porpagar')).toHaveText('$0');
    await expect(page.locator('#fin-porpagar-previos')).toHaveCount(0);
    await expect(page.locator('#fin-porpagar-semanas')).toHaveCount(0);
    verificarLimpio(e);
  });
});

test.describe('puntito rojo de Finanzas', () => {
  function sinOtrosAvisos() {
    const d = datosBase();
    d.sittings_traslados = d.sittings_traslados.map(r => ({ ...r, pagado: true }));
    d.app_config = [{ id: 'ultima_conciliacion_cobros', valor: null, actualizado_at: '2026-10-20T12:00:00Z' }];
    d.intermediaciones_eventos = [
      { id: 'b2000000-0000-4000-8000-000000000001', empresa: 'Empresa Prueba SA', fecha: '2026-10-18', cobro_total: 5000, comentarios: null, registrado_por: 'Prueba', created_at: '2026-10-18T12:00:00Z', cobrado: true },
      { id: 'b2000000-0000-4000-8000-000000000002', empresa: 'Otra Empresa Ficticia', fecha: '2026-10-24', cobro_total: 2000, comentarios: null, registrado_por: 'Prueba', created_at: '2026-10-19T12:00:00Z', cobrado: false },
    ];
    return d;
  }
  const pago = (id, evento, pagado) => ({ id, evento_id: evento, ninera_id: ID.nAna, ninera_nombre: 'Ana Ficticia', hora_inicio: null, hora_fin: null, pago: 1200, pagado });
  const punto = page => page.locator('#finanzas-navdot .navdot');
  const actualizar = page => page.evaluate(() => actualizarFinanzasBadge());

  test('se prende por una niñera de un evento que ya pasó y no se pagó', async ({ page }) => {
    const d = sinOtrosAvisos();
    d.intermediaciones_eventos_ninieras = [pago('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', false)];
    const e = await abrirApp(page, { datos: d, ahora: AHORA });
    await actualizar(page);
    await expect(punto(page)).toHaveCount(1);
    verificarLimpio(e);
  });

  test('no se prende si está pagado o si el evento todavía no pasó', async ({ page }) => {
    const d = sinOtrosAvisos();
    d.intermediaciones_eventos_ninieras = [
      pago('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', true),
      pago('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', false),
    ];
    const e = await abrirApp(page, { datos: d, ahora: AHORA });
    await actualizar(page);
    await expect(punto(page)).toHaveCount(0);
    verificarLimpio(e);
  });
});

test.describe('si la base falla al leer Finanzas', () => {
  test('el resumen, el margen y Por pagar muestran el error y Reintentar vuelve a cargar', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos(), ahora: AHORA });
    let fallar = true;
    await page.route(/\/rest\/v1\/sittings_traslados\?/, r => fallar && r.request().method() === 'GET'
      ? r.fulfill({ status: 500, json: { code: 'XX000', message: 'falla simulada' } }) : r.fallback());
    await page.evaluate(() => setModulo('finanzas'));
    await expect(page.locator('#fin-margen-tabla')).toContainText('falla simulada');
    await expect(page.locator('#fin-margen-tabla button', { hasText: 'Reintentar' })).toBeVisible();
    await expect(page.locator('#fin-movs')).toContainText('falla simulada');
    // Por pagar no dice "No hay pagos pendientes" cuando en realidad no pudo leerlos.
    await expect(porPagar(page)).toContainText('falla simulada');
    await expect(porPagar(page)).not.toContainText('No hay pagos pendientes');
    await expect(page.locator('#fin-facturado')).toHaveCount(0);
    await expect(page.locator('#app .spinner')).toHaveCount(0);

    fallar = false;
    await page.locator('#fin-margen-tabla button', { hasText: 'Reintentar' }).click();
    await esperarQuieta(page);
    await expect(page.locator('#fin-facturado')).toBeVisible();
    await expect(page.locator('#fin-margen-tabla')).not.toContainText('falla simulada');
    await expect(porPagar(page)).toContainText('Ana Ficticia');
    verificarLimpio(e, { ignorar: IGNORAR_RED });
  });
});
