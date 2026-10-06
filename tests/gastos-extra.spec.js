// Gastos extra con comprobante (08/10/2026). Al cargar o editar un sitting/traslado se
// agregan gastos (concepto, monto, foto del ticket obligatoria) y quién los pagó:
// la niñera (se cobra a la familia y se le reintegra) o la familia (saldo a su favor).
// No cuentan como ganancia. Hoy en los tests = domingo 04/10/2026.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const SIT_28 = '70000000-0000-4000-8000-000000000003'; // Ana, Familia Prueba Uno, lunes 28/09, $1.140 / $750
const GASTO = 'b6000000-0000-4000-8000-000000000001';
const TICKET = { name: 'ticket.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };
const gasto = extra => ({ id: GASTO, sitting_id: SIT_28, concepto: 'Almuerzo para la niña', monto: 300, pagado_por: 'ninera',
  comprobante: `${SIT_28}/ticket.jpg`, cobrado: false, reintegrado: false, ajuste_id: null, creado_por: null,
  created_at: '2026-09-28T20:00:00Z', ...extra });
function datosCon(...gastos) {
  const d = datosBase();
  d.gastos_extra = gastos;
  d.ajustes_saldo = [];
  return d;
}
async function elegirAutocomplete(page, input, texto) {
  const item = page.locator(`${input}-dropdown .autocomplete-item`, { hasText: texto }).first();
  await expect(async () => {
    await page.fill(input, '');
    await page.fill(input, texto.slice(0, 5));
    await expect(item).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await item.click();
  await page.waitForTimeout(200);
}
async function nuevoTraslado(page) {
  await irAModulo(page, 'sittings');
  await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
  await page.locator('#sit-tipo-traslado').click();
  await elegirAutocomplete(page, '#sit-familia', 'Familia Prueba Dos');
  await elegirAutocomplete(page, '#sit-ninera', 'Bruno Inventado');
  await page.fill('#sit-fecha', '2026-10-01');
  await page.evaluate(() => setHoraSelect('sit-hora', '13:00'));
  await page.fill('#sit-cobro', '956');
  await page.fill('#sit-pago', '559');
}
async function agregarGasto(page, { concepto, monto, pagoPor, foto = true }) {
  await page.locator('#sit-gasto-agregar').click();
  const fila = page.locator('#sit-gastos-nuevos .gasto-nuevo').last();
  if (concepto) await fila.locator('.gasto-concepto').fill(concepto);
  if (monto) await fila.locator('.gasto-monto').fill(String(monto));
  if (pagoPor) await fila.locator('.gasto-pagado-por').selectOption(pagoPor);
  if (foto) await fila.locator('.gasto-foto').setInputFiles(TICKET);
}
const toasts = page => page.locator('.toaststack .toast');

test.describe('cargar gastos extra en el formulario', () => {
  test('lo pagó la niñera: sube el ticket al bucket privado y guarda el gasto vinculado', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon() });
    await nuevoTraslado(page);
    await agregarGasto(page, { concepto: 'Almuerzo para la niña', monto: 320, pagoPor: 'ninera' });
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(toasts(page).filter({ hasText: 'Registro guardado.' })).toBeVisible();
    const sit = e.db.sittings_traslados.find(s => s.fecha === '2026-10-01' && s.tipo === 'traslado');
    expect(sit).toBeTruthy();
    const subidas = e.escrituras.filter(w => w.tabla.startsWith('/storage/v1/object/comprobantes/'));
    expect(subidas).toHaveLength(1);
    expect(subidas[0].tabla).toContain(`/comprobantes/${sit.id}/`);
    expect(e.db.gastos_extra).toHaveLength(1);
    expect(e.db.gastos_extra[0]).toMatchObject({ sitting_id: sit.id, concepto: 'Almuerzo para la niña', monto: 320, pagado_por: 'ninera', ajuste_id: null });
    expect(e.db.gastos_extra[0].comprobante).toMatch(new RegExp(`^${sit.id}/.+\\.jpg$`));
    // No toca lo que se cobra ni se paga por el traslado.
    expect(sit).toMatchObject({ cobro_familia: 956, pago_ninera: 559 });
    verificarLimpio(e);
  });

  test('lo pagó la familia: queda como saldo a favor de la familia', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon() });
    await nuevoTraslado(page);
    await agregarGasto(page, { concepto: 'Uber', monto: 225, pagoPor: 'familia' });
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(toasts(page).filter({ hasText: 'Registro guardado.' })).toBeVisible();
    expect(e.db.ajustes_saldo).toHaveLength(1);
    expect(e.db.ajustes_saldo[0]).toMatchObject({ sujeto: 'familia', familia_id: ID.fDos, monto: -225 });
    expect(e.db.ajustes_saldo[0].motivo).toContain('Uber');
    expect(e.db.gastos_extra[0]).toMatchObject({ pagado_por: 'familia', ajuste_id: e.db.ajustes_saldo[0].id });
    verificarLimpio(e);
  });

  test('sin foto del ticket no guarda nada', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon() });
    await nuevoTraslado(page);
    await agregarGasto(page, { concepto: 'Almuerzo', monto: 300, pagoPor: 'ninera', foto: false });
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(toasts(page).filter({ hasText: 'Falta la foto del ticket de "Almuerzo".' })).toBeVisible();
    expect(e.escrituras.filter(w => w.metodo === 'POST')).toHaveLength(0);
    verificarLimpio(e);
  });

  test('al editar se ven los gastos; "Quitar" borra el gasto, su saldo y su ticket', async ({ page }) => {
    const d = datosCon(gasto({ pagado_por: 'familia', ajuste_id: 'a5000000-0000-4000-8000-000000000009' }));
    d.ajustes_saldo = [{ id: 'a5000000-0000-4000-8000-000000000009', sujeto: 'familia', familia_id: ID.fUno, ninera_id: null, nombre: 'Familia Prueba Uno',
      monto: -300, motivo: 'Gasto extra que pagó la familia: Almuerzo para la niña (28/09)', fecha: '2026-09-28', aplicado: 0, aplicaciones: [], creado_por: null, created_at: '2026-09-28T20:00:00Z' }];
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => abrirModalSitForm(id), SIT_28);
    const fila = page.locator('#sit-gastos-existentes .gasto-existente');
    await expect(fila).toContainText('Almuerzo para la niña');
    await expect(fila).toContainText('lo pagó la familia');
    await fila.locator('button', { hasText: 'Quitar' }).click();
    await page.locator('#confirm-si').click();
    await expect(toasts(page).filter({ hasText: 'Gasto quitado.' })).toBeVisible();
    expect(e.db.gastos_extra).toHaveLength(0);
    expect(e.db.ajustes_saldo).toHaveLength(0);
    expect(e.escrituras.some(w => w.tabla.startsWith('/storage/v1/object/comprobantes') && w.metodo === 'DELETE')).toBe(true);
    verificarLimpio(e);
  });
});

test.describe('Por cobrar y Por pagar', () => {
  test('lo pagó la niñera: se cobra a la familia, se reintegra a la niñera y no suma al facturado', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(gasto()) });
    await irAModulo(page, 'finanzas');
    const pagar = page.locator('#fin-porpagar-wrap .agendarow', { hasText: 'Ana Ficticia' });
    await expect(pagar).toContainText('Reintegro de gasto: $300 · Almuerzo para la niña');
    await expect(pagar).toContainText('Servicios: $750');
    await expect(pagar).toContainText('$1.050');
    const cobrar = page.locator('#fin-porcobrar-wrap .agendarow', { hasText: 'Familia Prueba Uno' });
    await expect(cobrar).toContainText('Gasto extra: $300 · Almuerzo para la niña');
    await expect(cobrar).toContainText('$2.580');
    await page.evaluate(async () => { finMes = '2026-09'; await cargarFinanzas(); });
    await esperarQuieta(page);
    await expect(page.locator('#fin-facturado')).toHaveText('$3.870'); // sin el gasto

    await pagar.locator('button', { hasText: 'Marcar pagado' }).click();
    await expect(page.locator('#pago-detalle')).toContainText('Reintegro de gasto extra');
    await expect(page.locator('#pago-total')).toHaveText('$1.050');
    await page.locator('#pago-confirmar').click();
    await expect(toasts(page).filter({ hasText: 'Marcado como pagado.' })).toBeVisible();
    expect(e.db.gastos_extra[0]).toMatchObject({ reintegrado: true, cobrado: false });

    await page.locator('#fin-porcobrar-wrap .agendarow', { hasText: 'Familia Prueba Uno' }).locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(toasts(page).filter({ hasText: 'Marcado como cobrado.' })).toBeVisible();
    expect(e.db.gastos_extra[0]).toMatchObject({ reintegrado: true, cobrado: true });
    verificarLimpio(e);
  });

  test('un gasto de un sitting ya cobrado y pagado aparece igual, solo', async ({ page }) => {
    const d = datosCon(gasto({ sitting_id: '70000000-0000-4000-8000-000000000001' })); // 14/09, cobrado y pagado
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'finanzas');
    const pagar = page.locator('#fin-porpagar-wrap .agendarow', { hasText: 'Reintegro de gasto' });
    await expect(pagar).toContainText('Ana Ficticia');
    await expect(pagar).toContainText('$300');
    await pagar.locator('button', { hasText: 'Marcar pagado' }).click();
    await expect(page.locator('#pago-total')).toHaveText('$300');
    await page.locator('#pago-confirmar').click();
    await expect(toasts(page).filter({ hasText: 'Marcado como pagado.' })).toBeVisible();
    expect(e.db.gastos_extra[0].reintegrado).toBe(true);
    verificarLimpio(e);
  });
});

test('PDF para las madres: lista los gastos extra con quién los pagó', async ({ page }) => {
  const e = await abrirApp(page, { datos: datosCon(gasto()) });
  await irAModulo(page, 'sittings');
  await page.evaluate(() => {
    const sel = document.getElementById('sithist-familia');
    sel.value = [...sel.options].find(o => o.textContent === 'Familia Prueba Uno').value;
  });
  await page.evaluate(() => abrirModalExportarHistorialPDF());
  await page.fill('#exphist-desde', '2026-09-01');
  await page.fill('#exphist-hasta', '2026-09-30');
  await page.locator('#editmodal button', { hasText: 'Ver vista previa' }).click();
  await expect(page.locator('#exphist-gastos')).toContainText('Almuerzo para la niña');
  await expect(page.locator('#exphist-gastos')).toContainText('La niñera (se cobra)');
  await expect(page.locator('#exphist-preview')).toContainText('Gastos extra a cargo de la familia: $300');
  verificarLimpio(e);
});

test('con la base sin migrar el formulario no muestra gastos extra y guarda como antes', async ({ page }) => {
  const e = await abrirApp(page, { baseSinMigrar: true });
  await nuevoTraslado(page);
  await expect(page.locator('#sit-gasto-agregar')).toHaveCount(0);
  await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
  await expect(toasts(page).filter({ hasText: 'Registro guardado.' })).toBeVisible();
  verificarLimpio(e, { ignorar: [/status of 404/] });
});

// Borrar un registro con gastos (06/10/2026, testing de la noche): la base borra los gastos en
// cascada, pero el saldo a favor de un gasto que pagó la familia quedaba vivo y se le seguía
// descontando; los tickets quedaban en el bucket.
test.describe('borrar un registro que tiene gastos extra', () => {
  const AJ = 'a5000000-0000-4000-8000-000000000009';
  function datosConGastoDeLaFamilia(extraGasto = {}, extraAjuste = {}) {
    const d = datosCon(gasto({ pagado_por: 'familia', ajuste_id: AJ, ...extraGasto }));
    d.ajustes_saldo = [{ id: AJ, sujeto: 'familia', familia_id: ID.fUno, ninera_id: null, nombre: 'Familia Prueba Uno', monto: -300,
      motivo: 'Gasto extra que pagó la familia: Almuerzo para la niña (28/09)', fecha: '2026-09-28', aplicado: 0, aplicaciones: [], creado_por: null, created_at: '2026-09-28T20:00:00Z', ...extraAjuste }];
    return d;
  }
  const borroTicket = e => e.escrituras.some(w => w.tabla.startsWith('/storage/v1/object/comprobantes') && w.metodo === 'DELETE');

  test('desde Sittings: borra el registro, el saldo a favor que generó y el ticket', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConGastoDeLaFamilia() });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => { eliminarSitting(id); }, SIT_28);
    await expect(page.locator('.confirmoverlay.show')).toContainText('También se borra su gasto extra y el saldo a favor que generó la familia');
    await page.locator('#confirm-si').click();
    await expect(toasts(page).filter({ hasText: 'Registro eliminado.' })).toBeVisible();
    expect(e.db.sittings_traslados.some(s => s.id === SIT_28)).toBe(false);
    expect(e.db.ajustes_saldo).toEqual([]);
    expect(borroTicket(e)).toBe(true);
    verificarLimpio(e);
  });

  test('desde la Agenda: el mismo cuidado', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConGastoDeLaFamilia() });
    await irAModulo(page, 'agenda');
    await page.evaluate(id => { eliminarRegistroDesdeAgenda(id); }, SIT_28);
    await expect(page.locator('.confirmoverlay.show')).toContainText('También se borra su gasto extra');
    await page.locator('#confirm-si').click();
    await expect(toasts(page).filter({ hasText: 'Registro eliminado.' })).toBeVisible();
    expect(e.db.ajustes_saldo).toEqual([]);
    expect(borroTicket(e)).toBe(true);
    verificarLimpio(e);
  });

  test('un gasto ya cobrado o reintegrado: no deja borrar el registro', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(gasto({ reintegrado: true })) });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => { eliminarSitting(id); }, SIT_28);
    await expect(toasts(page).filter({ hasText: 'ya se cobraron o se reintegraron: no se puede eliminar' })).toBeVisible();
    await expect(page.locator('.confirmoverlay.show')).toHaveCount(0);
    expect(e.db.sittings_traslados.some(s => s.id === SIT_28)).toBe(true);
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });

  test('el saldo a favor del gasto ya se usó en un cobro: no deja borrar el registro', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConGastoDeLaFamilia({}, { aplicado: 300 }) });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => { eliminarSitting(id); }, SIT_28);
    await expect(toasts(page).filter({ hasText: 'ya se usó en un cobro: no se puede eliminar' })).toBeVisible();
    expect(e.db.sittings_traslados.some(s => s.id === SIT_28)).toBe(true);
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });

  test('sin gastos: se borra como siempre', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon() });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => { eliminarSitting(id); }, SIT_28);
    await expect(page.locator('.confirmoverlay.show')).toHaveText(/¿Eliminar este registro\? No se puede deshacer\./);
    await expect(page.locator('.confirmoverlay.show')).not.toContainText('gasto');
    await page.locator('#confirm-si').click();
    await expect(toasts(page).filter({ hasText: 'Registro eliminado.' })).toBeVisible();
    expect(e.escrituras.map(w => `${w.tabla} ${w.metodo}`)).toEqual(['sittings_traslados DELETE']);
    verificarLimpio(e);
  });
});

test('si falla un gasto: avisa cuál falta y no muestra además "Registro guardado"', async ({ page }) => {
  const e = await abrirApp(page, { datos: datosCon() });
  await nuevoTraslado(page);
  await agregarGasto(page, { concepto: 'Almuerzo', monto: 300, pagoPor: 'ninera' });
  await agregarGasto(page, { concepto: 'Uber', monto: 225, pagoPor: 'ninera' });
  e.fallar = ({ tabla }) => tabla === 'gastos_extra' ? { message: 'falla simulada' } : undefined;
  await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
  const aviso = toasts(page).filter({ hasText: 'El registro se guardó, pero no se pudo guardar el gasto "Almuerzo"' });
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('Tampoco se cargó "Uber".');
  await expect(aviso).toContainText('editando el registro');
  await page.waitForTimeout(300);
  await expect(toasts(page).filter({ hasText: 'Registro guardado.' })).toHaveCount(0);
  verificarLimpio(e, { ignorar: [/status of 500/] });
});
