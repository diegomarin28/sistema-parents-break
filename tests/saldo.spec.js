// Saldo a favor (07/10/2026): ajustes que se descuentan (o suman) en el próximo pago de una
// niñera o cobro de una familia, con una línea visible en Por pagar / Por cobrar, en la
// ficha y en el PDF. Hoy en los tests = domingo 04/10/2026.
// En los datos ficticios: Ana tiene por pagar $750 (lunes 28/09, fijo, semana terminada) y
// la Familia Prueba Uno tiene por cobrar $2.280 en setiembre (16/09 y 28/09).
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const AJ1 = 'a5000000-0000-4000-8000-000000000001';
const ajuste = (extra) => ({ id: AJ1, sujeto: 'ninera', familia_id: null, ninera_id: ID.nAna, nombre: 'Ana Ficticia', monto: -300,
  motivo: 'Se le pagó un sitting que hizo otra niñera', fecha: '2026-10-03', aplicado: 0, aplicaciones: [], creado_por: null,
  created_at: '2026-10-03T12:00:00Z', ...extra });
function datosCon(...ajustes) {
  const d = datosBase();
  d.ajustes_saldo = ajustes;
  return d;
}
const porPagar = page => page.locator('#fin-porpagar-wrap');
const porCobrar = page => page.locator('#fin-porcobrar-wrap');
const filaDe = (box, nombre) => box.locator('.agendarow', { hasText: nombre });

test.describe('Por pagar con saldo de la niñera', () => {
  test('se descuenta del próximo pago con una línea visible y queda anotado al pagar', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(ajuste()) });
    await irAModulo(page, 'finanzas');
    const fila = filaDe(porPagar(page), 'Ana Ficticia');
    await expect(fila).toContainText('Servicios: $750');
    await expect(fila).toContainText('Saldo: −$300 · Se le pagó un sitting que hizo otra niñera');
    await expect(fila).toContainText('$450');
    await fila.locator('button', { hasText: 'Marcar pagado' }).click();
    await expect(page.locator('#pago-detalle')).toContainText('Saldo a favor');
    await expect(page.locator('#pago-total')).toHaveText('$450');
    await page.locator('#pago-confirmar').click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como pagado.' })).toBeVisible();
    const aj = e.db.ajustes_saldo.find(a => a.id === AJ1);
    expect(aj.aplicado).toBe(300);
    expect(aj.aplicaciones).toHaveLength(1);
    expect(aj.aplicaciones[0]).toMatchObject({ monto: -300, en: 'pagado' });
    verificarLimpio(e);
  });

  test('un saldo más grande que el pago deja el pago en $0 y el resto para el próximo', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(ajuste({ monto: -1000 })) });
    await irAModulo(page, 'finanzas');
    const fila = filaDe(porPagar(page), 'Ana Ficticia');
    await expect(fila).toContainText('Saldo: −$750');
    await fila.locator('button', { hasText: 'Marcar pagado' }).click();
    await expect(page.locator('#pago-total')).toHaveText('$0');
    await page.locator('#pago-confirmar').click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como pagado.' })).toBeVisible();
    expect(e.db.ajustes_saldo[0].aplicado).toBe(750);
    // Lo que queda (−$250) se ve como saldo pendiente para el próximo pago.
    await expect(porPagar(page)).toContainText('Saldos que se aplican en el próximo pago');
    await expect(porPagar(page)).toContainText('Ana Ficticia: −$250');
    verificarLimpio(e);
  });

  test('una niñera sin nada por pagar: el saldo queda a la vista para el próximo pago', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(ajuste({ ninera_id: ID.nCarla, nombre: 'Carla Ejemplo', monto: -100 })) });
    await irAModulo(page, 'finanzas');
    await expect(porPagar(page)).toContainText('Carla Ejemplo: −$100');
    await expect(filaDe(porPagar(page), 'Ana Ficticia')).not.toContainText('Saldo:');
    verificarLimpio(e);
  });
});

test.describe('Por cobrar con saldo a favor de la familia', () => {
  test('se descuenta del próximo cobro y queda anotado al marcar cobrado', async ({ page }) => {
    const aj = ajuste({ sujeto: 'familia', ninera_id: null, familia_id: ID.fUno, nombre: 'Familia Prueba Uno', monto: -917, motivo: 'Pagó de más la semana del 28/09' });
    const e = await abrirApp(page, { datos: datosCon(aj) });
    await irAModulo(page, 'finanzas');
    const fila = filaDe(porCobrar(page), 'Familia Prueba Uno');
    await expect(fila).toContainText('Servicios: $2.280');
    await expect(fila).toContainText('Saldo: −$917 · Pagó de más la semana del 28/09');
    await expect(fila).toContainText('$1.363');
    await fila.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' })).toBeVisible();
    expect(e.db.ajustes_saldo[0].aplicado).toBe(917);
    expect(e.db.ajustes_saldo[0].aplicaciones[0]).toMatchObject({ monto: -917, en: 'cobrado' });
    verificarLimpio(e);
  });
});

test.describe('ficha: ver y cargar ajustes', () => {
  test('ficha de la familia: carga un saldo a favor a mano', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon() });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await expect(page.locator('#fam-saldo')).toContainText('Sin saldo pendiente.');
    await page.locator('#fam-saldo button', { hasText: '+ Cargar ajuste' }).click();
    await page.fill('#ajuste-monto', '917');
    await page.locator('#ajuste-guardar').click();
    await expect(page.locator('#ajuste-warn')).toContainText('Escribí el motivo');
    await page.fill('#ajuste-motivo', 'Pagó de más la semana del 28/09');
    await page.locator('#ajuste-guardar').click();
    await expect(page.locator('#fam-saldo-total')).toContainText('Pendiente: −$917 en el próximo cobro.');
    const alta = e.escrituras.filter(w => w.tabla === 'ajustes_saldo' && w.metodo === 'POST');
    expect(alta).toHaveLength(1);
    expect(alta[0].cuerpo).toMatchObject({ sujeto: 'familia', familia_id: ID.fUno, ninera_id: null, monto: -917, motivo: 'Pagó de más la semana del 28/09' });
    // La ficha sigue abierta debajo.
    await expect(page.locator('#editmodal')).toContainText('Familia Prueba Uno');
    verificarLimpio(e);
  });

  test('ficha de la niñera: lo pendiente y lo ya usado; solo se borra lo que no se usó', async ({ page }) => {
    const usado = ajuste({ id: 'a5000000-0000-4000-8000-000000000002', monto: -200, motivo: 'Adelanto', aplicado: 200, fecha: '2026-09-20' });
    const e = await abrirApp(page, { datos: datosCon(ajuste(), usado) });
    await irAModulo(page, 'ninieras');
    await page.evaluate(id => verNinera(id), ID.nAna);
    await expect(page.locator('#vn-saldo-total')).toContainText('Pendiente: −$300 en el próximo pago.');
    await expect(page.locator('#vn-saldo')).toContainText('Ya usados');
    await expect(page.locator('#vn-saldo .fin-ajuste-ficha', { hasText: 'Adelanto' }).locator('button')).toHaveCount(0);
    await page.locator('#vn-saldo .fin-ajuste-ficha', { hasText: 'Se le pagó' }).locator('button', { hasText: 'Borrar' }).click();
    await page.locator('#confirm-si').click();
    await expect(page.locator('#vn-saldo-total')).toContainText('Sin saldo pendiente.');
    expect(e.db.ajustes_saldo.map(a => a.motivo)).toEqual(['Adelanto']);
    verificarLimpio(e);
  });
});

test('PDF para las madres: con la familia elegida, muestra el saldo pendiente y su motivo', async ({ page }) => {
  const aj = ajuste({ sujeto: 'familia', ninera_id: null, familia_id: ID.fUno, nombre: 'Familia Prueba Uno', monto: -917, motivo: 'Pagó de más la semana del 28/09' });
  const e = await abrirApp(page, { datos: datosCon(aj) });
  await irAModulo(page, 'sittings');
  await page.evaluate(() => {
    const sel = document.getElementById('sithist-familia');
    sel.value = [...sel.options].find(o => o.textContent === 'Familia Prueba Uno').value;
  });
  await page.evaluate(() => abrirModalExportarHistorialPDF());
  await page.fill('#exphist-desde', '2026-09-01');
  await page.fill('#exphist-hasta', '2026-09-30');
  await page.locator('#editmodal button', { hasText: 'Ver vista previa' }).click();
  await expect(page.locator('#exphist-ajustes')).toContainText('Pagó de más la semana del 28/09');
  await expect(page.locator('#exphist-preview')).toContainText('Saldo pendiente: −$917');
  verificarLimpio(e);
});

test('con la base sin migrar (sin la tabla) Finanzas y las fichas andan como antes', async ({ page }) => {
  const e = await abrirApp(page, { baseSinMigrar: true });
  await irAModulo(page, 'finanzas');
  await expect(filaDe(porPagar(page), 'Ana Ficticia')).toContainText('$750');
  await expect(porPagar(page)).not.toContainText('Saldo');
  await irAModulo(page, 'familias');
  await page.evaluate(id => verFamilia(id), ID.fUno);
  await esperarQuieta(page);
  await expect(page.locator('#fam-saldo')).toBeEmpty();
  // El navegador anota el 404 de la tabla que todavía no existe; la app no muestra error.
  verificarLimpio(e, { ignorar: [/status of 404/] });
});

// Las dos marcando lo mismo a la vez (06/10/2026, testing de la noche): el saldo a favor se
// descontaba dos veces (lo que sobraba se perdía) y la segunda veía "Marcado como pagado".
test.describe('el mismo pago marcado desde dos celulares', () => {
  test('pagado: la segunda no vuelve a descontar el saldo y se entera', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon(ajuste({ monto: -1000 })) });
    await irAModulo(page, 'finanzas');
    await filaDe(porPagar(page), 'Ana Ficticia').locator('button', { hasText: 'Marcar pagado' }).click();
    await expect(page.locator('#pago-total')).toHaveText('$0');
    // Mientras tanto la otra ya lo marcó pagado y se usaron $750 del saldo.
    e.db.sittings_traslados.filter(s => s.fecha === '2026-09-28').forEach(s => { s.pagado = true; });
    Object.assign(e.db.ajustes_saldo[0], { aplicado: 750, aplicaciones: [{ fecha: '2026-10-04', monto: -750, en: 'pagado' }] });
    await page.locator('#pago-confirmar').click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Ya estaba marcado como pagado' })).toBeVisible();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como pagado.' })).toHaveCount(0);
    expect(e.db.ajustes_saldo[0].aplicado).toBe(750);
    expect(e.db.ajustes_saldo[0].aplicaciones).toHaveLength(1);
    await expect(porPagar(page)).toContainText('Ana Ficticia: −$250');
    verificarLimpio(e);
  });

  test('cobrado: lo mismo con el saldo de la familia', async ({ page }) => {
    const aj = ajuste({ sujeto: 'familia', ninera_id: null, familia_id: ID.fUno, nombre: 'Familia Prueba Uno', monto: -917, motivo: 'Pagó de más' });
    const e = await abrirApp(page, { datos: datosCon(aj) });
    await irAModulo(page, 'finanzas');
    e.db.sittings_traslados.filter(s => s.familia_id === ID.fUno).forEach(s => { s.cobrado = true; });
    Object.assign(e.db.ajustes_saldo[0], { aplicado: 917 });
    await filaDe(porCobrar(page), 'Familia Prueba Uno').locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Ya estaba marcado como cobrado' })).toBeVisible();
    expect(e.db.ajustes_saldo[0].aplicado).toBe(917);
    expect(e.escrituras.filter(w => w.tabla === 'ajustes_saldo')).toEqual([]);
    verificarLimpio(e);
  });
});
