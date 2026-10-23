// Variantes de precio por familia (23/10/2026). Los casos especiales dejan de ser notas sueltas:
// - ajuste libre al registrar (sumar o restar a la familia y/o a la niñera, con motivo);
// - "Guardar como botón": el ajuste queda como variante de esa familia y aparece como botón;
// - en la ficha de la familia se ven, editan y borran; pueden ser solo de un fijo y programarse
//   para aplicarse solas desde una fecha y en ciertos días (la carga nocturna; la regla en la
//   base la prueba supabase/pruebas/variantes_precio.sql);
// - varias a la vez; lo aplicado queda guardado (precio_variantes) y se ve en el registro, en
//   Por cobrar / Por pagar y en el PDF.
// Hoy en los tests = domingo 04/10/2026. Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const V_CASA = 'c1000000-0000-4000-8000-000000000001';
const V_PEAJE = 'c1000000-0000-4000-8000-000000000002';
const V_NOHIZO = 'c1000000-0000-4000-8000-000000000003';
const V_SITTING = 'c1000000-0000-4000-8000-000000000004';
const A_TRAS = '40000000-0000-4000-8000-0000000000c1';
const variante = extra => ({ familia_id: ID.fDos, aplica_a: 'traslado', asignacion_id: null, cobro_modo: null, cobro_valor: null,
  pago_modo: null, pago_valor: null, motivo: 'extra', auto_desde: null, auto_hasta: null, auto_dias: null, activa: true,
  creado_por: 'Prueba', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z', ...extra });
const VARIANTES = [
  variante({ id: V_CASA, nombre: 'La llevó a la casa', cobro_modo: 'sumar', cobro_valor: 450, pago_modo: 'sumar', pago_valor: 250 }),
  variante({ id: V_PEAJE, nombre: 'Peaje', pago_modo: 'sumar', pago_valor: 50, created_at: '2026-10-01T12:01:00Z' }),
  variante({ id: V_NOHIZO, nombre: 'No se hizo', pago_modo: 'total', pago_valor: 180, motivo: 'sin_servicio', created_at: '2026-10-01T12:02:00Z' }),
  variante({ id: V_SITTING, nombre: 'Noche', aplica_a: 'sitting', cobro_modo: 'porcentaje', cobro_valor: 10, created_at: '2026-10-01T12:03:00Z' }),
];
function datos({ variantes = VARIANTES } = {}) {
  const d = datosBase();
  d.variantes_precio = structuredClone(variantes);
  d.ajustes_saldo = [];
  d.gastos_extra = [];
  d.asignaciones.push({ id: A_TRAS, familia_id: ID.fDos, ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', cobro_hora: null, pago_hora: null,
    created_at: '2026-09-01T00:00:00Z', dias: ['L', 'X', 'V'], hora_inicio: '17:00:00', hora_fin: null, vigente_desde: '2026-09-01', vigente_hasta: null,
    tipo: 'traslado', cobro_traslado: 1400, pago_traslado: 650 });
  return d;
}
const toasts = page => page.locator('.toaststack .toast');
const chipVar = (page, nombre) => page.locator('#sit-variantes .variante-chip', { hasText: nombre });
const resumen = page => page.locator('#sit-variantes .variantes-resumen');
const postsSitting = e => e.escrituras.filter(w => w.tabla === 'sittings_traslados' && (w.metodo === 'POST' || w.metodo === 'PATCH'));

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
// Un traslado de la Familia Prueba Dos con Bruno, a $1.400 / $650.
async function nuevoTraslado(page) {
  await irAModulo(page, 'sittings');
  await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
  await page.locator('#sit-tipo-traslado').click();
  await elegirAutocomplete(page, '#sit-familia', 'Familia Prueba Dos');
  await elegirAutocomplete(page, '#sit-ninera', 'Bruno Inventado');
  await page.fill('#sit-fecha', '2026-10-02');
  await page.evaluate(() => setHoraSelect('sit-hora', '17:00'));
  await page.fill('#sit-cobro', '1400');
  await page.fill('#sit-pago', '650');
  await expect(page.locator('#sit-variantes')).toContainText('Variantes y ajustes');
}
async function guardar(page) {
  await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
  await expect(toasts(page).filter({ hasText: 'Registro guardado.' })).toBeVisible();
}
const guardado = e => e.db.sittings_traslados.find(s => s.fecha === '2026-10-02' && s.tipo === 'traslado');

test.describe('al registrar', () => {
  test('ajuste libre: +$450 a la familia y +$250 a la niñera, con motivo; se guarda cuál se aplicó', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ variantes: [] }) });
    await nuevoTraslado(page);
    await page.locator('#sit-variantes .variante-libre-abrir').click();
    await page.fill('#sit-libre-cobro', '450');
    await page.fill('#sit-libre-pago', '250');
    await page.fill('#sit-libre-texto', 'La llevó a la casa');
    await page.selectOption('#sit-libre-motivo', 'extra');
    await expect(resumen(page)).toContainText('Con los ajustes: cobro $1.850 · pago $900');
    await expect(page.locator('#sit-margen')).toHaveText('$950');
    await guardar(page);
    const s = guardado(e);
    expect(s).toMatchObject({ cobro_familia: 1850, pago_ninera: 900, precio_motivo: 'extra' });
    expect(s.precio_variantes).toEqual({ base: { cobro: 1400, pago: 650 }, aplicadas: [
      { id: null, libre: true, nombre: 'La llevó a la casa', motivo: 'extra', cobro: { modo: 'sumar', valor: 450 }, pago: { modo: 'sumar', valor: 250 } },
    ] });
    // No va a las notas: queda guardado aparte.
    expect(s.notas).toBeNull();
    verificarLimpio(e);
  });

  test('ajuste libre sin motivo no se guarda y lo dice', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ variantes: [] }) });
    await nuevoTraslado(page);
    await page.locator('#sit-variantes .variante-libre-abrir').click();
    await page.fill('#sit-libre-cobro', '-200');
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(toasts(page).filter({ hasText: 'Elegí el motivo del ajuste' })).toBeVisible();
    expect(postsSitting(e)).toHaveLength(0);
    verificarLimpio(e);
  });

  test('"Guardar como botón": queda como variante de la familia, se aplica y la próxima vez es un botón', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ variantes: [] }) });
    await nuevoTraslado(page);
    await page.locator('#sit-variantes .variante-libre-abrir').click();
    await page.fill('#sit-libre-cobro', '450');
    await page.fill('#sit-libre-pago', '250');
    await page.fill('#sit-libre-texto', 'La llevó a la casa');
    await page.selectOption('#sit-libre-motivo', 'extra');
    await page.locator('#sit-variantes button', { hasText: 'Guardar como botón' }).click();
    const altas = () => e.escrituras.filter(w => w.tabla === 'variantes_precio' && w.metodo === 'POST');
    await expect.poll(() => altas().length).toBe(1);
    expect(altas()[0].cuerpo).toMatchObject({ familia_id: ID.fDos, nombre: 'La llevó a la casa', aplica_a: 'traslado', motivo: 'extra',
      cobro_modo: 'sumar', cobro_valor: 450, pago_modo: 'sumar', pago_valor: 250, asignacion_id: null, auto_desde: null, activa: true });
    // Pasa a ser un botón, ya marcado; el ajuste libre se vacía.
    await expect(chipVar(page, 'La llevó a la casa')).toHaveAttribute('aria-pressed', 'true');
    await expect(resumen(page)).toContainText('cobro $1.850 · pago $900');
    await guardar(page);
    const nueva = e.db.variantes_precio[0];
    expect(guardado(e).precio_variantes.aplicadas).toEqual([expect.objectContaining({ id: nueva.id, nombre: 'La llevó a la casa' })]);
    expect(guardado(e).precio_variantes.aplicadas[0].libre).toBeFalsy();
    // Otro traslado de la misma familia: el botón está, sin marcar.
    await nuevoTraslado(page);
    await expect(chipVar(page, 'La llevó a la casa')).toHaveAttribute('aria-pressed', 'false');
    verificarLimpio(e);
  });

  test('varias a la vez: total fijo y sumas, con el redondeo; solo las de traslado en un traslado', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await nuevoTraslado(page);
    await expect(chipVar(page, 'Noche')).toHaveCount(0); // es de sittings
    await chipVar(page, 'La llevó a la casa').click();
    await chipVar(page, 'Peaje').click();
    await expect(resumen(page)).toContainText('cobro $1.850 · pago $950');
    await chipVar(page, 'No se hizo').click(); // pago: total 180, después las sumas (+250 +50)
    await expect(resumen(page)).toContainText('cobro $1.850 · pago $480');
    await chipVar(page, 'Peaje').click(); // destildar
    await expect(resumen(page)).toContainText('pago $430');
    await guardar(page);
    const s = guardado(e);
    expect(s).toMatchObject({ cobro_familia: 1850, pago_ninera: 430, precio_motivo: 'otro' }); // motivos distintos
    expect(s.precio_variantes.aplicadas.map(a => a.nombre)).toEqual(['La llevó a la casa', 'No se hizo']);
    verificarLimpio(e);
  });

  test('editar un registro con variantes: la base en los campos, los botones marcados y el total al guardar', async ({ page }) => {
    const d = datos();
    d.sittings_traslados.push(sitting('70000000-0000-4000-8000-0000000000c9', '2026-10-02', { tipo: 'traslado', familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos',
      ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', hora_inicio: '17:00:00', hora_fin: null, cobro_familia: 1850, pago_ninera: 900, precio_motivo: 'extra',
      precio_variantes: { base: { cobro: 1400, pago: 650 }, aplicadas: [{ id: V_CASA, nombre: 'La llevó a la casa', motivo: 'extra', cobro: { modo: 'sumar', valor: 450 }, pago: { modo: 'sumar', valor: 250 } }] } }));
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => abrirModalSitForm(id), '70000000-0000-4000-8000-0000000000c9');
    await expect(page.locator('#sit-cobro')).toHaveValue('1400');
    await expect(page.locator('#sit-pago')).toHaveValue('650');
    await expect(chipVar(page, 'La llevó a la casa')).toHaveAttribute('aria-pressed', 'true');
    await expect(resumen(page)).toContainText('cobro $1.850 · pago $900');
    await chipVar(page, 'Peaje').click();
    await page.locator('#editmodal button', { hasText: 'Guardar cambios' }).click();
    await expect(toasts(page).filter({ hasText: 'Registro actualizado.' })).toBeVisible();
    const s = e.db.sittings_traslados.find(x => x.id === '70000000-0000-4000-8000-0000000000c9');
    expect(s).toMatchObject({ cobro_familia: 1850, pago_ninera: 950 });
    expect(s.precio_variantes.aplicadas.map(a => a.nombre)).toEqual(['La llevó a la casa', 'Peaje']);
    verificarLimpio(e);
  });

  test('si una variante se borró, el registro la conserva tal como se aplicó', async ({ page }) => {
    const d = datos({ variantes: [] });
    d.sittings_traslados.push(sitting('70000000-0000-4000-8000-0000000000ca', '2026-10-02', { tipo: 'traslado', familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos',
      ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', hora_inicio: '17:00:00', hora_fin: null, cobro_familia: 1850, pago_ninera: 900,
      precio_variantes: { base: { cobro: 1400, pago: 650 }, aplicadas: [{ id: V_CASA, nombre: 'La llevó a la casa', motivo: 'extra', cobro: { modo: 'sumar', valor: 450 }, pago: { modo: 'sumar', valor: 250 } }] } }));
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => abrirModalSitForm(id), '70000000-0000-4000-8000-0000000000ca');
    await expect(chipVar(page, 'La llevó a la casa')).toHaveAttribute('aria-pressed', 'true');
    await expect(resumen(page)).toContainText('cobro $1.850 · pago $900');
    verificarLimpio(e);
  });
});

test.describe('en la ficha de la familia', () => {
  test('se ven, se editan y se borran', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fDos);
    const box = page.locator('#fam-variantes');
    await expect(box.locator('.variante-ficha')).toHaveCount(4);
    await expect(box.locator('.variante-ficha', { hasText: 'La llevó a la casa' })).toContainText('Familia +$450 · Niñera +$250');
    await expect(box.locator('.variante-ficha', { hasText: 'No se hizo' })).toContainText('Niñera: total $180');
    await expect(box.locator('.variante-ficha', { hasText: 'Noche' })).toContainText('Familia +10%');
    await box.locator('.variante-ficha', { hasText: 'Peaje' }).locator('button', { hasText: 'Editar' }).click();
    await page.fill('#var-pago-valor', '80');
    await page.locator('#variante-guardar').click();
    await expect(box.locator('.variante-ficha', { hasText: 'Peaje' })).toContainText('Niñera +$80');
    expect(e.db.variantes_precio.find(v => v.id === V_PEAJE).pago_valor).toBe(80);
    await box.locator('.variante-ficha', { hasText: 'Peaje' }).locator('button', { hasText: 'Borrar' }).click();
    await page.locator('#confirm-si').click();
    await expect(box.locator('.variante-ficha')).toHaveCount(3);
    expect(e.db.variantes_precio.map(v => v.id)).not.toContain(V_PEAJE);
    verificarLimpio(e);
  });

  test('nueva variante programada para un fijo desde una fecha y en ciertos días: se guarda y recalcula los previstos', async ({ page }) => {
    const d = datos({ variantes: [] });
    d.app_config = [{ id: 'fijos_automaticos', valor: { activo: true, dias: 14 }, actualizado_at: '2026-10-04T06:00:00Z' }];
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fDos);
    await page.locator('#fam-variantes button', { hasText: '+ Nueva variante' }).click();
    await page.fill('#var-nombre', 'La vuelta la hace el padre');
    await page.selectOption('#var-aplica', 'traslado');
    await page.selectOption('#var-cobro-modo', 'sumar');
    await page.fill('#var-cobro-valor', '-400');
    await page.selectOption('#var-pago-modo', 'sumar');
    await page.fill('#var-pago-valor', '-200');
    await page.selectOption('#var-motivo', 'descuento');
    await page.selectOption('#var-fijo', A_TRAS);
    await page.check('#var-programar');
    await page.fill('#var-desde', '2026-11-01');
    // Los días salen del fijo (L, X, V); se elige solo el viernes.
    await expect(page.locator('#var-dias .daybtn')).toHaveCount(3);
    await page.locator('#var-dias .daybtn', { hasText: 'Vi' }).click();
    await page.locator('#variante-guardar').click();
    await expect(page.locator('#fam-variantes .variante-ficha', { hasText: 'La vuelta la hace el padre' })).toContainText('desde el 01/11');
    const alta = e.escrituras.find(w => w.tabla === 'variantes_precio' && w.metodo === 'POST');
    expect(alta.cuerpo).toMatchObject({ familia_id: ID.fDos, aplica_a: 'traslado', asignacion_id: A_TRAS, auto_desde: '2026-11-01', auto_dias: ['V'],
      cobro_modo: 'sumar', cobro_valor: -400, pago_modo: 'sumar', pago_valor: -200, motivo: 'descuento' });
    // La carga de previstos corre enseguida (no espera a las 03:00).
    await expect.poll(() => e.escrituras.filter(w => w.tabla === 'rpc/generar_previstos_fijos').length).toBeGreaterThan(0);
    verificarLimpio(e);
  });

  test('sin nombre o sin ningún efecto no se guarda y lo dice', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ variantes: [] }) });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fDos);
    await page.locator('#fam-variantes button', { hasText: '+ Nueva variante' }).click();
    await page.locator('#variante-guardar').click();
    await expect(page.locator('#variante-warn')).toContainText('Ponele un nombre');
    await page.fill('#var-nombre', 'Algo');
    await page.locator('#variante-guardar').click();
    await expect(page.locator('#variante-warn')).toContainText('qué le cambia al cobro o al pago');
    expect(e.escrituras.filter(w => w.tabla === 'variantes_precio')).toHaveLength(0);
    verificarLimpio(e);
  });

  test('si la base falla al guardar, lo dice y no aparece', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ variantes: [] }) });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fDos);
    await page.locator('#fam-variantes button', { hasText: '+ Nueva variante' }).click();
    await page.fill('#var-nombre', 'Peaje');
    await page.selectOption('#var-pago-modo', 'sumar');
    await page.fill('#var-pago-valor', '50');
    e.fallar = ({ tabla }) => tabla === 'variantes_precio' ? { message: 'permiso denegado' } : undefined;
    await page.locator('#variante-guardar').click();
    await expect(page.locator('#variante-warn')).toContainText('permiso denegado');
    await expect(page.locator('#fam-variantes .variante-ficha')).toHaveCount(0);
    verificarLimpio(e, { ignorar: [/Failed to load resource|\[Supabase\]/] });
  });
});

test('cuando el fijo cambia de niñera desde una fecha, sus variantes pasan al fijo nuevo', async ({ page }) => {
  const d = datos({ variantes: [variante({ id: V_CASA, familia_id: ID.fUno, nombre: 'Martes con el padre', aplica_a: 'sitting', asignacion_id: ID.aFijo,
    cobro_modo: 'sumar', cobro_valor: -200, auto_desde: '2026-11-01', auto_dias: ['X'] })] });
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'agenda');
  await page.evaluate(async () => { agendaAncla = '2026-10-05'; await cargarAgendaSolicitudes(); });
  await esperarQuieta(page);
  await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-10-05`), ID.aFijo);
  await page.locator(`#agenda-fija-ninera-${ID.aFijo}`).fill('Carla Ejemplo');
  await page.locator('#editmodal .autocomplete-item', { hasText: 'Carla Ejemplo' }).click();
  await page.fill(`#agenda-fija-desde-${ID.aFijo}`, '2026-10-12');
  await page.locator(`#agenda-fija-guardar-${ID.aFijo}`).click();
  await expect(page.locator('#editmodal')).toHaveCount(0);
  const nuevo = e.db.asignaciones.find(a => a.ninera_nombre === 'Carla Ejemplo' && a.vigente_desde === '2026-10-12');
  expect(nuevo).toBeTruthy();
  await expect.poll(() => e.db.variantes_precio[0].asignacion_id).toBe(nuevo.id);
  verificarLimpio(e);
});

test('Cierre de los fijos en Hoy: variantes y ajuste sobre el día', async ({ page }) => {
  const d = datos();
  d.app_config = [{ id: 'fijos_automaticos', valor: { activo: true, dias: 14 }, actualizado_at: '2026-10-04T06:00:00Z' }];
  const ID_AUTO = '70000000-0000-4000-8000-0000000000cb';
  d.sittings_traslados.push(sitting(ID_AUTO, '2026-10-02', { tipo: 'traslado', familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nBruno,
    ninera_nombre: 'Bruno Inventado', asignacion_id: A_TRAS, hora_inicio: '17:00:00', hora_fin: null, cobro_familia: 1400, pago_ninera: 650,
    estado: 'confirmado', generado_automatico: true, revisado_at: null }));
  const e = await abrirApp(page, { datos: d });
  const fila = page.locator(`[data-autoconf="${ID_AUTO}"]`);
  await expect(fila).toBeVisible();
  await fila.locator('button', { hasText: 'Variantes' }).click();
  await page.locator('#cierre-variantes .variante-chip', { hasText: 'La llevó a la casa' }).click();
  await expect(page.locator('#cierre-variantes .variantes-resumen')).toContainText('cobro $1.850 · pago $900');
  await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
  await expect(toasts(page).filter({ hasText: 'Listo' })).toBeVisible();
  const s = e.db.sittings_traslados.find(x => x.id === ID_AUTO);
  expect(s).toMatchObject({ cobro_familia: 1850, pago_ninera: 900, precio_motivo: 'extra', generado_automatico: false });
  expect(s.precio_variantes.base).toEqual({ cobro: 1400, pago: 650 });
  const w = e.escrituras.find(x => x.tabla === 'sittings_traslados' && x.metodo === 'PATCH');
  expect(w.params).toMatchObject({ cobrado: 'eq.false', pagado: 'eq.false' });
  verificarLimpio(e);
});

test('se ven en Por cobrar / Por pagar y en el PDF de la familia', async ({ page }) => {
  const d = datos();
  d.sittings_traslados.push(sitting('70000000-0000-4000-8000-0000000000cc', '2026-09-23', { tipo: 'traslado', familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos',
    ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', hora_inicio: '17:00:00', hora_fin: null, cobro_familia: 1850, pago_ninera: 900, precio_motivo: 'extra',
    precio_variantes: { base: { cobro: 1400, pago: 650 }, aplicadas: [{ id: V_CASA, nombre: 'La llevó a la casa', motivo: 'extra', cobro: { modo: 'sumar', valor: 450 }, pago: { modo: 'sumar', valor: 250 } }] } }));
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'finanzas');
  const t = page.locator('#fin-porcobrar-wrap .fin-pend', { hasText: 'Familia Prueba Dos' });
  await t.locator('.fin-pend-cabeza').click();
  // (la familia cobra semanal: la semana del 23/09 ya cerró)
  await expect(t.locator('.fin-det-dia', { hasText: '23/09' })).toContainText('La llevó a la casa');
  const p = page.locator('#fin-porpagar-wrap .fin-pend', { hasText: 'Bruno Inventado' });
  await p.locator('.fin-pend-cabeza').click();
  await expect(p.locator('.fin-det-dia', { hasText: '23/09' })).toContainText('La llevó a la casa');
  // PDF de la familia.
  await irAModulo(page, 'sittings');
  await page.evaluate(() => {
    const sel = document.getElementById('sithist-familia');
    sel.value = [...sel.options].find(o => o.textContent === 'Familia Prueba Dos').value;
  });
  await page.evaluate(() => abrirModalExportarHistorialPDF());
  await page.fill('#exphist-desde', '2026-09-01');
  await page.fill('#exphist-hasta', '2026-09-30');
  await page.locator('#editmodal button', { hasText: 'Ver vista previa' }).click();
  await expect(page.locator('#exphist-preview')).toContainText('La llevó a la casa');
  verificarLimpio(e);
});

test('con la base sin migrar: el registro y la ficha andan como antes, sin variantes', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos(), baseSinMigrar: true });
  await irAModulo(page, 'sittings');
  await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
  await page.locator('#sit-tipo-traslado').click();
  await elegirAutocomplete(page, '#sit-familia', 'Familia Prueba Dos');
  await elegirAutocomplete(page, '#sit-ninera', 'Bruno Inventado');
  await page.fill('#sit-fecha', '2026-10-02');
  await page.evaluate(() => setHoraSelect('sit-hora', '17:00'));
  await page.fill('#sit-cobro', '1400');
  await page.fill('#sit-pago', '650');
  await esperarQuieta(page);
  await expect(page.locator('#sit-variantes')).toBeEmpty();
  await guardar(page);
  expect(guardado(e)).toMatchObject({ cobro_familia: 1400, pago_ninera: 650 });
  expect(guardado(e).precio_variantes).toBeUndefined();
  await irAModulo(page, 'familias');
  await page.evaluate(id => verFamilia(id), ID.fDos);
  await expect(page.locator('#fam-variantes')).toBeEmpty();
  verificarLimpio(e, { ignorar: [/Failed to load resource/] });
});

test('nombres con comillas y HTML en una variante no se ejecutan', async ({ page }) => {
  const raro = `<img src=x onerror="window.__xss=1">O'Neil "casa"`;
  const e = await abrirApp(page, { datos: datos({ variantes: [variante({ id: V_CASA, nombre: raro, cobro_modo: 'sumar', cobro_valor: 100 })] }) });
  await nuevoTraslado(page);
  await chipVar(page, `O'Neil`).click();
  await expect(resumen(page)).toContainText('cobro $1.500');
  await irAModulo(page, 'familias');
  await page.evaluate(id => verFamilia(id), ID.fDos);
  await expect(page.locator('#fam-variantes')).toContainText(raro);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  verificarLimpio(e);
});

for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
  test(`a ${ancho} px: botones de 44 px y sin scroll de costado (capturas)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    const e = await abrirApp(page, { datos: datos() });
    await nuevoTraslado(page);
    await chipVar(page, 'La llevó a la casa').click();
    await page.locator('#sit-variantes .variante-libre-abrir').click();
    for (const b of await page.locator('#sit-variantes .variante-chip').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
    await page.locator('#sit-variantes').scrollIntoViewIfNeeded();
    await page.locator('#sit-variantes').screenshot({ path: `test-results/variantes-${ancho}-registro.png` });
    await page.evaluate(() => cerrarModal());
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fDos);
    await expect(page.locator('#fam-variantes .variante-ficha')).toHaveCount(4);
    await page.locator('#fam-variantes').scrollIntoViewIfNeeded();
    await page.locator('#fam-variantes').screenshot({ path: `test-results/variantes-${ancho}-ficha.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
    verificarLimpio(e);
  });
}
