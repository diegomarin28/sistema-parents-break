// Gastos a la vista y fijos sin precio (13/10/2026, caso real con datos inventados acá):
// la comida de un traslado se cobró dos veces porque no se veía que se sumaba aparte, y un
// fijo de traslado sin precio copió un precio con la comida sumada a todo el mes.
// Hoy en los tests = domingo 04/10/2026.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const SIT_28 = '70000000-0000-4000-8000-000000000003'; // Ana, Familia Prueba Uno, 28/09, $1.140 / $750
const GASTO = 'b6000000-0000-4000-8000-000000000001';
const TICKET = { name: 'ticket.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };
const gasto = extra => ({ id: GASTO, sitting_id: SIT_28, concepto: 'Almuerzo', monto: 427, pagado_por: 'ninera',
  comprobante: `${SIT_28}/ticket.jpg`, cobrado: false, reintegrado: false, ajuste_id: null, creado_por: null,
  created_at: '2026-09-28T20:00:00Z', absorbe_pb: false, ...extra });
function datosCon(...gastos) {
  const d = datosBase();
  d.gastos_extra = gastos;
  d.ajustes_saldo = [];
  return d;
}
const escrituras = (e, tabla, metodo) => e.escrituras.filter(w => w.tabla === tabla && w.metodo === metodo);
const toasts = page => page.locator('.toaststack .toast');
async function abrirRegistro(page, id) {
  await irAModulo(page, 'sittings');
  await page.evaluate(i => abrirModalSitForm(i), id);
  await expect(page.locator('#sit-gastos-box')).toContainText('Gastos extra');
}

test.describe('total con gastos a la vista', () => {
  test('registro guardado y lista de Sittings: "$1.140 + gastos $427 = $1.567"', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(gasto()) });
    await irAModulo(page, 'sittings');
    await page.evaluate(() => { sitMes = '2026-09'; return cargarSitLista(); });
    await expect(page.locator('#sit-list-wrap .sit-total-fila').first()).toHaveText('+ gastos $427 = $1.567');
    await page.evaluate(i => abrirModalSitForm(i), SIT_28);
    await expect(page.locator('.sit-total-gastos')).toContainText('Sitting $1.140 + gastos $427 = $1.567');
    verificarLimpio(e);
  });

  test('Finanzas, Por cobrar: "Servicios $X + gastos $Y = $Z"', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(gasto()) });
    await irAModulo(page, 'finanzas');
    await expect(page.locator('#fin-porcobrar-wrap .fin-total-gastos').first()).toContainText('+ gastos $427 = $');
    verificarLimpio(e);
  });

  test('PDF de la familia: un único "Total a pagar" y la cuenta para transferir', async ({ page }) => {
    const d = datosCon(gasto());
    d.app_config = [...(d.app_config || []), { id: 'cuenta_cobro', valor: { texto: 'Banco Prueba 0001234567' }, actualizado_at: '2026-10-01T00:00:00Z' }];
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'sittings');
    await page.evaluate(() => {
      const sel = document.getElementById('sithist-familia');
      sel.value = [...sel.options].find(o => o.textContent === 'Familia Prueba Uno').value;
    });
    await page.evaluate(() => abrirModalExportarHistorialPDF());
    await page.fill('#exphist-desde', '2026-09-28');
    await page.fill('#exphist-hasta', '2026-09-28');
    await page.locator('#editmodal button', { hasText: 'Ver vista previa' }).click();
    await expect(page.locator('#exphist-total-pagar')).toHaveText('Total a pagar: $1.567');
    await expect(page.locator('#exphist-cuenta')).toHaveValue('Banco Prueba 0001234567');
    verificarLimpio(e);
  });
});

test.describe('editar un gasto ya cargado', () => {
  test('cambia monto, concepto y reemplaza la foto del ticket', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(gasto()) });
    await abrirRegistro(page, SIT_28);
    await page.locator('.gasto-existente button', { hasText: 'Editar' }).click();
    await page.fill('.gasto-ed-concepto', 'Almuerzo de la niña');
    await page.fill('.gasto-ed-monto', '400');
    await page.locator('.gasto-ed-foto').setInputFiles(TICKET);
    await page.locator('.gasto-existente button', { hasText: 'Guardar gasto' }).click();
    await expect(toasts(page).filter({ hasText: 'Gasto guardado' })).toBeVisible();
    const [cambio] = escrituras(e, 'gastos_extra', 'PATCH');
    expect(cambio.cuerpo).toMatchObject({ concepto: 'Almuerzo de la niña', monto: 400 });
    expect(cambio.cuerpo.comprobante).toMatch(new RegExp(`^${SIT_28}/.+\\.jpg$`));
    verificarLimpio(e);
  });

  test('ya reintegrado: el monto no se puede cambiar', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(gasto({ reintegrado: true })) });
    await abrirRegistro(page, SIT_28);
    await page.locator('.gasto-existente button', { hasText: 'Editar' }).click();
    await expect(page.locator('.gasto-ed-monto')).toBeDisabled();
    verificarLimpio(e);
  });
});

test.describe('gasto que absorbe Parents Break', () => {
  test('se guarda marcado, no se cobra a la familia, se reintegra y baja el resultado', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(gasto({ absorbe_pb: true, concepto: 'Uber por demora' })) });
    await irAModulo(page, 'finanzas');
    await expect(page.locator('#fin-porpagar-wrap .agendarow', { hasText: 'Reintegro de gasto' })).toContainText('Uber por demora');
    await expect(page.locator('#fin-porcobrar-wrap')).not.toContainText('Uber por demora');
    await page.evaluate(async () => { finMes = '2026-09'; await cargarFinanzas(); });
    await expect(page.locator('.fin-resultado')).toContainText('gastos extra que absorbe Parents Break $427');
    verificarLimpio(e);
  });

  test('la opción nueva guarda absorbe_pb', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon() });
    await abrirRegistro(page, SIT_28);
    await page.locator('#sit-gasto-agregar').click();
    const fila = page.locator('#sit-gastos-nuevos .gasto-nuevo').last();
    await fila.locator('.gasto-concepto').fill('Uber por demora');
    await fila.locator('.gasto-monto').fill('300');
    await fila.locator('.gasto-pagado-por').selectOption('absorbe');
    await fila.locator('.gasto-foto').setInputFiles(TICKET);
    await page.locator('#editmodal button', { hasText: 'Guardar cambios' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const [alta] = escrituras(e, 'gastos_extra', 'POST');
    expect(alta.cuerpo).toMatchObject({ concepto: 'Uber por demora', pagado_por: 'ninera', absorbe_pb: true });
    verificarLimpio(e);
  });
});

test.describe('fijos: no se crean incompletos ni repetidos', () => {
  async function abrirFicha(page, famId) {
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), famId);
  }
  test('traslado sin precio: no se guarda', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirFicha(page, ID.fDos);
    await page.fill(`#asig-nombre-${ID.fDos}`, 'Bruno Inventado');
    await page.evaluate(id => { setHoraSelect('asig-horaini-'+id, '08:00'); document.getElementById('asig-tipo-'+id).value = 'traslado'; }, ID.fDos);
    await page.locator(`#asig-dias-${ID.fDos} .daybtn`, { hasText: /^J$/ }).click();
    await page.locator('#editmodal button', { hasText: 'Asignar niñera' }).click();
    await expect(toasts(page).last()).toContainText('lo que se cobra y lo que se paga');
    expect(escrituras(e, 'asignaciones', 'POST')).toEqual([]);
    verificarLimpio(e);
  });

  test('sin hora de inicio: no se guarda', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirFicha(page, ID.fDos);
    await page.fill(`#asig-nombre-${ID.fDos}`, 'Bruno Inventado');
    await page.locator(`#asig-dias-${ID.fDos} .daybtn`, { hasText: /^J$/ }).click();
    await page.locator('#editmodal button', { hasText: 'Asignar niñera' }).click();
    await expect(toasts(page).last()).toContainText('Falta la hora de inicio');
    expect(escrituras(e, 'asignaciones', 'POST')).toEqual([]);
    verificarLimpio(e);
  });

  test('ya hay uno vigente igual: pregunta antes de crear otro', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirFicha(page, ID.fUno);
    await page.fill(`#asig-nombre-${ID.fUno}`, 'Ana Ficticia');
    await page.evaluate(id => { setHoraSelect('asig-horaini-'+id, '16:00'); setHoraSelect('asig-horafin-'+id, '19:00'); }, ID.fUno);
    await page.locator(`#asig-dias-${ID.fUno} .daybtn`, { hasText: /^L$/ }).click();
    await page.locator('#editmodal button', { hasText: 'Asignar niñera' }).click();
    const aviso = page.locator('.confirmoverlay:not(#editmodal)');
    await expect(aviso).toContainText('Ya hay un fijo vigente de Ana Ficticia');
    await aviso.locator('button', { hasText: 'Cancelar' }).click();
    expect(escrituras(e, 'asignaciones', 'POST')).toEqual([]);
    verificarLimpio(e);
  });
});

test.describe('precio de un día de traslado fijo y aviso de Hoy', () => {
  const aTras = 'b2000000-0000-4000-8000-000000000009';
  test('el precargado nunca toma un previsto ni una fecha futura', async ({ page }) => {
    const d = datosBase();
    d.asignaciones.push({ id: aTras, familia_id: ID.fDos, ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', cobro_hora: null, pago_hora: null, created_at: '2026-09-01T00:00:00Z', dias: ['M'], hora_inicio: '08:00:00', hora_fin: null, vigente_desde: '2026-09-01', vigente_hasta: null, tipo: 'traslado', cobro_traslado: null, pago_traslado: null });
    d.sittings_traslados.push(sitting('a3000000-0000-4000-8000-000000000001', '2026-10-13', { tipo: 'traslado', asignacion_id: aTras, familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', hora_inicio: '08:00:00', hora_fin: null, cobro_familia: 1436, pago_ninera: 1193 }));
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'agenda');
    await page.evaluate(async () => { agendaAncla = '2026-09-28'; await cargarAgendaSolicitudes(); });
    await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-09-29`), aTras);
    await expect(page.locator('#agenda-fija-precio-helper')).toContainText(/\(19\/0?9\)/);
    await expect(page.locator('#agenda-fija-cobro')).toHaveValue('450');
    verificarLimpio(e);
  });

  test('un fijo sin hora de inicio: avisa que le falta el horario, no que la carga no anduvo', async ({ page }) => {
    const d = datosBase();
    d.app_config = [{ id: 'fijos_automaticos', valor: { activo: true, dias: 14 }, actualizado_at: '2026-10-04T06:00:00Z' }];
    d.asignaciones_pausas = [];
    d.asignaciones = d.asignaciones.map(a => ({ ...a, hora_inicio: null, hora_fin: null }));
    const e = await abrirApp(page, { datos: d });
    await expect(page.locator('.fijo-sin-horario')).toContainText('le falta el horario');
    await expect(page.locator('.corrida-aviso')).toHaveCount(0);
    verificarLimpio(e);
  });
});
