// Intermediaciones en Finanzas (20/10/2026): las colocaciones de Enrique y los eventos de
// empresas no aparecían en Finanzas. Ahora suman al facturado y al resultado del mes, con una
// línea aparte "Intermediaciones" (colocación: el monto entero; evento: lo cobrado a la empresa
// menos lo pagado a las niñeras), entran al balance de varios meses y se cobran / pagan desde
// Por cobrar / Por pagar. Datos ficticios.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const AHORA = '2026-10-20T12:00:00-03:00';
const COLOCACION = 'b1000000-0000-4000-8000-000000000001';
const EVENTO = 'b2000000-0000-4000-8000-000000000001';
const EVENTO_FUTURO = 'b2000000-0000-4000-8000-000000000002';
const PAGO_ANA = 'b3000000-0000-4000-8000-000000000001';
const PAGO_BRUNO = 'b3000000-0000-4000-8000-000000000002';
const PAGO_FUTURO = 'b3000000-0000-4000-8000-000000000003';
const IGNORAR_RED = [/Failed to load resource|\[Supabase\]/];

function conIntermediaciones(d = datosBase()) {
  d.intermediaciones_enrique = [
    { id: COLOCACION, ninera_id: null, ninera_nombre: 'Marta Externa', fecha: '2026-10-15', monto: 1500, comentarios: null, registrado_por: 'Prueba', created_at: '2026-10-15T12:00:00Z', cobrado: false },
  ];
  d.intermediaciones_eventos = [
    { id: EVENTO, empresa: 'Empresa Prueba SA', fecha: '2026-10-18', cobro_total: 5000, comentarios: null, registrado_por: 'Prueba', created_at: '2026-10-18T12:00:00Z', cobrado: true },
    // Evento del sábado que viene: cuenta en el mes, pero a la niñera se le paga recién ese día (E7).
    { id: EVENTO_FUTURO, empresa: 'Otra Empresa Ficticia', fecha: '2026-10-24', cobro_total: 2000, comentarios: null, registrado_por: 'Prueba', created_at: '2026-10-19T12:00:00Z', cobrado: false },
  ];
  d.intermediaciones_eventos_ninieras = [
    { id: PAGO_ANA, evento_id: EVENTO, ninera_id: ID.nAna, ninera_nombre: 'Ana Ficticia', hora_inicio: '10:00:00', hora_fin: '14:00:00', pago: 1200, pagado: false },
    { id: PAGO_BRUNO, evento_id: EVENTO, ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', hora_inicio: '10:00:00', hora_fin: '14:00:00', pago: 1000, pagado: true },
    { id: PAGO_FUTURO, evento_id: EVENTO_FUTURO, ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', hora_inicio: '18:00:00', hora_fin: '21:00:00', pago: 700, pagado: false },
  ];
  return d;
}
async function verMes(page, mes) {
  await page.evaluate(async m => { finMes = m; await cargarFinanzas(); }, mes);
  await esperarQuieta(page);
}
const num = async (page, id) => Number((await page.locator(`#${id}`).innerText()).replace(/[$.]/g, ''));
const cifras = async page => ({
  facturado: await num(page, 'fin-facturado'), cobrado: await num(page, 'fin-cobrado'),
  porCobrar: await num(page, 'fin-porcobrar'), porPagar: await num(page, 'fin-porpagar'),
  resultado: await num(page, 'fin-resultado'),
});
const porCobrar = page => page.locator('#fin-porcobrar-wrap');
const porPagar = page => page.locator('#fin-porpagar-wrap');
const modalPago = page => page.locator('.confirmoverlay [aria-label="Confirmar pago"]');
const toasts = page => page.locator('.toaststack .toast');

test.describe('intermediaciones en el resumen del mes', () => {
  test('suman al facturado y al resultado, con su línea aparte', async ({ page }) => {
    const e = await abrirApp(page, { ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await verMes(page, '2026-10');
    const antes = await cifras(page);
    await expect(page.locator('#fin-intermediaciones')).toHaveCount(0);

    e.db.intermediaciones_enrique = conIntermediaciones().intermediaciones_enrique;
    e.db.intermediaciones_eventos = conIntermediaciones().intermediaciones_eventos;
    e.db.intermediaciones_eventos_ninieras = conIntermediaciones().intermediaciones_eventos_ninieras;
    await verMes(page, '2026-10');
    const despues = await cifras(page);
    // Facturado: 1.500 + 5.000 + 2.000. Pagos de eventos: 1.200 + 1.000 + 700.
    expect(despues.facturado - antes.facturado).toBe(8500);
    expect(despues.resultado - antes.resultado).toBe(8500 - 2900);
    expect(despues.cobrado - antes.cobrado).toBe(5000);
    expect(despues.porCobrar - antes.porCobrar).toBe(3500);
    expect(despues.facturado).toBe(despues.cobrado + despues.porCobrar);
    // Por pagar: solo Ana (Bruno ya cobró y el evento de Carla todavía no pasó).
    expect(despues.porPagar - antes.porPagar).toBe(1200);
    await expect(page.locator('#fin-porpagar-futuro')).toContainText('$700');

    await expect(page.locator('#fin-intermediaciones')).toHaveText('$5.600');
    await expect(page.locator('.fin-intermediaciones')).toContainText('colocaciones $1.500 + eventos $7.000 − pagos a niñeras de eventos $2.900');
    const movs = page.locator('#fin-movs');
    await expect(movs).toContainText('Colocación Enrique — Marta Externa');
    await expect(movs).toContainText('Evento — Empresa Prueba SA');
    await expect(movs).toContainText('Pago a Ana Ficticia (evento Empresa Prueba SA)');
    verificarLimpio(e);
  });

  test('otro mes no las cuenta y el margen por familia/zona/tipo no las incluye', async ({ page }) => {
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await verMes(page, '2026-09');
    await expect(page.locator('#fin-intermediaciones')).toHaveCount(0);
    await verMes(page, '2026-10');
    await expect(page.locator('#fin-intermediaciones')).toBeVisible();
    await expect(page.locator('#fin-margen-wrap')).not.toContainText('Empresa Prueba SA');
    await expect(page.locator('#fin-margen-wrap')).not.toContainText('Enrique');
    verificarLimpio(e);
  });

  test('el balance de varios meses las suma', async ({ page }) => {
    const leerBalance = async () => {
      const t = await page.locator('#fin-balance-totales .statnum').allInnerTexts();
      return t.map(x => Number(x.replace(/[$.]/g, '')));
    };
    const e = await abrirApp(page, { ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await page.evaluate(() => cargarBalanceMultiMes(3));
    const [facturadoAntes, costosAntes] = await leerBalance();
    const d = conIntermediaciones();
    Object.assign(e.db, { intermediaciones_enrique: d.intermediaciones_enrique, intermediaciones_eventos: d.intermediaciones_eventos, intermediaciones_eventos_ninieras: d.intermediaciones_eventos_ninieras });
    await page.evaluate(() => cargarBalanceMultiMes(3));
    const [facturado, costos, resultado] = await leerBalance();
    expect(facturado - facturadoAntes).toBe(8500);
    expect(costos - costosAntes).toBe(2900);
    expect(resultado).toBe(facturado - costos);
    verificarLimpio(e);
  });

  test('si la base falla al leerlas, avisa en vez de mostrar cifras incompletas', async ({ page }) => {
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await page.route(/\/rest\/v1\/intermediaciones_enrique\?/, r => r.request().method() === 'GET'
      ? r.fulfill({ status: 500, json: { code: 'XX000', message: 'falla simulada' } }) : r.fallback());
    // Como con cualquier lectura de Finanzas que falla, el resto del mes no se pinta (el margen
    // queda en "Cargando…"): se espera el aviso, no la pantalla quieta.
    await page.evaluate(() => setModulo('finanzas'));
    await expect(page.locator('#fin-movs')).toContainText('falla simulada');
    await expect(page.locator('#fin-balance-totales')).toContainText('falla simulada');
    await expect(page.locator('#fin-facturado')).toHaveCount(0);
    await expect(toasts(page).last()).toContainText('No se pudieron leer las intermediaciones pendientes');
    verificarLimpio(e, { ignorar: IGNORAR_RED });
  });
});

test.describe('intermediaciones en Por cobrar / Por pagar', () => {
  test('Por cobrar: la colocación (Agencia Enrique) y el evento sin cobrar, con su botón', async ({ page }) => {
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    const fila = porCobrar(page).locator('.agendarow', { hasText: 'Agencia Enrique' });
    await expect(fila).toContainText('Colocación de Marta Externa');
    await expect(fila).toContainText('$1.500');
    await expect(porCobrar(page).locator('.agendarow', { hasText: 'Otra Empresa Ficticia' })).toContainText('$2.000');
    // El evento ya cobrado no aparece.
    await expect(porCobrar(page)).not.toContainText('Empresa Prueba SA');

    await fila.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(toasts(page).last()).toContainText('Marcado como cobrado');
    const w = e.escrituras.filter(x => x.tabla === 'intermediaciones_enrique');
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ metodo: 'PATCH', cuerpo: { cobrado: true }, params: { id: `eq.${COLOCACION}`, cobrado: 'eq.false' } });
    await expect(porCobrar(page)).not.toContainText('Agencia Enrique');
    expect(e.escrituras.filter(x => x.tabla === 'sittings_traslados')).toHaveLength(0);
    verificarLimpio(e);
  });

  test('Por pagar: la niñera de un evento que ya pasó, con su cuenta y la confirmación del pago', async ({ page }) => {
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    const fila = porPagar(page).locator('.agendarow', { hasText: 'Evento Empresa Prueba SA' });
    await expect(fila).toContainText('Ana Ficticia');
    await expect(fila).toContainText('0099887766');
    await expect(fila).toContainText('$1.200');
    // Bruno ya cobró y el evento de Carla es el sábado que viene (E7).
    await expect(porPagar(page)).not.toContainText('Otra Empresa Ficticia');

    await fila.locator('button', { hasText: 'Marcar pagado' }).click();
    const modal = modalPago(page);
    await expect(modal).toContainText('Confirmar pago a Ana Ficticia');
    await expect(modal.locator('.pago-otro')).toContainText('Evento Empresa Prueba SA');
    await expect(modal.locator('#pago-total')).toHaveText('$1.200');
    await modal.locator('button', { hasText: 'Cancelar' }).click();
    await expect(modal).toHaveCount(0);
    expect(e.escrituras).toHaveLength(0);

    await fila.locator('button', { hasText: 'Marcar pagado' }).click();
    await modalPago(page).locator('button', { hasText: 'Confirmar pago' }).click();
    await expect(toasts(page).last()).toContainText('Marcado como pagado');
    const w = e.escrituras.filter(x => x.tabla === 'intermediaciones_eventos_ninieras');
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ metodo: 'PATCH', cuerpo: { pagado: true }, params: { id: `eq.${PAGO_ANA}` } });
    await expect(porPagar(page)).not.toContainText('Empresa Prueba SA');
    verificarLimpio(e);
  });

  test('si otra admin ya lo marcó, avisa y no dice "Marcado"', async ({ page }) => {
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    e.db.intermediaciones_enrique[0].cobrado = true;
    await porCobrar(page).locator('.agendarow', { hasText: 'Agencia Enrique' }).locator('button').click();
    await expect(toasts(page).last()).toContainText('Ya estaba marcado como cobrado');
    verificarLimpio(e);
  });

  test('si la base falla al marcar, avisa y sigue pendiente', async ({ page }) => {
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    e.fallar = ({ tabla }) => tabla === 'intermediaciones_enrique' ? { message: 'falla simulada' } : undefined;
    await porCobrar(page).locator('.agendarow', { hasText: 'Agencia Enrique' }).locator('button').click();
    await expect(toasts(page).last()).toContainText('No se pudo actualizar: falla simulada');
    await expect(porCobrar(page)).toContainText('Agencia Enrique');
    expect(e.db.intermediaciones_enrique[0].cobrado).toBe(false);
    verificarLimpio(e, { ignorar: IGNORAR_RED });
  });

  test('doble toque en Marcar cobrado: una sola escritura', async ({ page }) => {
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    e.demoraEscrituras = 400;
    await porCobrar(page).locator('.agendarow', { hasText: 'Agencia Enrique' }).locator('button').dblclick();
    await expect(toasts(page).last()).toContainText('Marcado como cobrado');
    expect(e.escrituras.filter(x => x.tabla === 'intermediaciones_enrique')).toHaveLength(1);
    verificarLimpio(e);
  });

  test('nombre de empresa con HTML y comillas: se muestra como texto y el botón anda', async ({ page }) => {
    const d = conIntermediaciones();
    const raro = `D'Empresa "<img src=x onerror=window.__xss=1>"`;
    d.intermediaciones_eventos[0].empresa = raro;
    d.intermediaciones_eventos_ninieras[0].ninera_nombre = `Ana </div><b>O'Hara</b>`;
    const e = await abrirApp(page, { datos: d, ahora: AHORA });
    await irAModulo(page, 'finanzas');
    const fila = porPagar(page).locator('.agendarow', { hasText: raro });
    await expect(fila).toContainText(`Ana </div><b>O'Hara</b>`);
    await fila.locator('button', { hasText: 'Marcar pagado' }).click();
    await expect(modalPago(page)).toContainText(raro);
    await modalPago(page).locator('button', { hasText: 'Confirmar pago' }).click();
    await expect(toasts(page).last()).toContainText('Marcado como pagado');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    verificarLimpio(e);
  });

  test('celular de 390px: Por cobrar y Por pagar sin scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const e = await abrirApp(page, { datos: conIntermediaciones(), ahora: AHORA });
    await irAModulo(page, 'finanzas');
    await expect(porCobrar(page)).toContainText('Agencia Enrique');
    await expect(porPagar(page)).toContainText('Evento Empresa Prueba SA');
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(390);
    await porPagar(page).screenshot({ path: test.info().outputPath('por-pagar-390.png') });
    verificarLimpio(e);
  });
});
