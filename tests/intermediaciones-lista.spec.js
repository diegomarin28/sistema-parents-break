// Intermediaciones en una sola pantalla (23/10/2026): antes las pestañas mezclaban listas
// (Historial, Niñeras Enrique) con formularios (+ Colocación Enrique, + Evento). Ahora: la lista de
// colocaciones y eventos con chips Todas / Colocaciones / Eventos, "+ Nueva" que pregunta qué y abre
// el formulario en un modal sobre la lista, y "Niñeras de Enrique" plegable debajo, con el resumen.
// Los datos no cambian. Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const t = '2026-09-20T12:00:00Z';
function datos() {
  const d = datosBase();
  d.intermediaciones_enrique = [
    { id: 'a9000000-0000-4000-8000-000000000001', ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', fecha: '2026-09-22', monto: 1000, comentarios: null, registrado_por: 'Prueba', created_at: t, cobrado: true },
    { id: 'a9000000-0000-4000-8000-000000000002', ninera_id: null, ninera_nombre: 'Marta Externa', fecha: '2026-10-02', monto: 1500, comentarios: null, registrado_por: 'Prueba', created_at: t, cobrado: false },
  ];
  d.intermediaciones_eventos = [
    { id: 'a9000000-0000-4000-8000-000000000003', empresa: 'Empresa Prueba SA', fecha: '2026-09-28', cobro_total: 5000, comentarios: null, registrado_por: 'Prueba', created_at: t, cobrado: false },
  ];
  d.intermediaciones_eventos_ninieras = [
    { id: 'a9000000-0000-4000-8000-000000000004', evento_id: 'a9000000-0000-4000-8000-000000000003', ninera_id: ID.nAna, ninera_nombre: 'Ana Ficticia', hora_inicio: '10:00:00', hora_fin: '14:00:00', pago: 1200, pagado: false },
  ];
  d.intermediaciones_enrique_pool = [
    { id: 'a9000000-0000-4000-8000-000000000005', ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado', estado: 'activa', updated_at: t },
    { id: 'a9000000-0000-4000-8000-000000000006', ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', estado: 'disponible', updated_at: t },
  ];
  return d;
}
const lista = page => page.locator('#inter-body');
const filas = page => lista(page).locator('.inter-fila');
const chip = (page, texto) => page.locator('#inter-filtros button', { hasText: texto });

test('una sola lista con tipo, nombre, fecha, monto y si está cobrada o pendiente, de la más nueva a la más vieja', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos() });
  await irAModulo(page, 'intermediaciones');
  await expect(page.locator('#modcontent .subtab')).toHaveCount(0); // sin pestañas
  await expect(filas(page)).toHaveCount(3);
  await expect(filas(page).nth(0)).toContainText('Colocación');
  await expect(filas(page).nth(0)).toContainText('Marta Externa');
  await expect(filas(page).nth(0)).toContainText('02 oct');
  await expect(filas(page).nth(0)).toContainText('$1.500');
  await expect(filas(page).nth(0)).toContainText('Pendiente');
  await expect(filas(page).nth(1)).toContainText('Evento');
  await expect(filas(page).nth(1)).toContainText('Empresa Prueba SA');
  await expect(filas(page).nth(1)).toContainText('$5.000');
  await expect(filas(page).nth(2)).toContainText('Bruno Inventado');
  await expect(filas(page).nth(2)).toContainText('Cobrada');
  verificarLimpio(e);
});

test('los chips filtran: Colocaciones, Eventos y Todas', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos() });
  await irAModulo(page, 'intermediaciones');
  await expect(chip(page, 'Todas')).toHaveAttribute('aria-pressed', 'true');
  await chip(page, 'Colocaciones').click();
  await expect(chip(page, 'Colocaciones')).toHaveAttribute('aria-pressed', 'true');
  await expect(filas(page)).toHaveCount(2);
  await expect(lista(page)).not.toContainText('Empresa Prueba SA');
  await chip(page, 'Eventos').click();
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText('Empresa Prueba SA');
  await chip(page, 'Todas').click();
  await expect(filas(page)).toHaveCount(3);
  verificarLimpio(e);
});

test('sin eventos, el chip "Eventos" lo dice', async ({ page }) => {
  const d = datos();
  d.intermediaciones_eventos = []; d.intermediaciones_eventos_ninieras = [];
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'intermediaciones');
  await chip(page, 'Eventos').click();
  await expect(lista(page)).toContainText('No hay eventos cargados.');
  verificarLimpio(e);
});

test('"+ Nueva" pregunta qué y abre el formulario del evento en un modal sobre la lista; al guardar aparece', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos() });
  await irAModulo(page, 'intermediaciones');
  await page.locator('#modcontent button', { hasText: '+ Nueva' }).click();
  await expect(page.locator('#editmodal button', { hasText: 'Colocación de Enrique' })).toBeVisible();
  await page.locator('#editmodal button', { hasText: 'Evento' }).click();
  await expect(page.locator('#editmodal #inter-evento-empresa')).toBeVisible();
  await expect(filas(page)).toHaveCount(3); // la lista sigue abajo
  await page.fill('#inter-evento-empresa', 'Otra Empresa Ficticia');
  await page.fill('#inter-evento-cobro', '3000');
  const nin = page.locator('[id^="inter-evtfila-"][id$="-ninera"]').first();
  await nin.pressSequentially('Ana F');
  await page.locator('.autocomplete-item', { hasText: 'Ana Ficticia' }).first().click();
  await page.locator('#editmodal button', { hasText: 'Guardar evento' }).click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Evento registrado.' })).toBeVisible();
  await expect(page.locator('#editmodal.show')).toHaveCount(0);
  await expect(lista(page)).toContainText('Otra Empresa Ficticia');
  expect(e.db.intermediaciones_eventos).toHaveLength(2);
  verificarLimpio(e);
});

test('si la base falla al guardar, el modal queda abierto con el error y no aparece nada nuevo', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos() });
  await irAModulo(page, 'intermediaciones');
  await page.evaluate(() => abrirFormInterEnrique());
  await page.locator('#inter-enrique-ninera').pressSequentially('Persona Nueva');
  e.fallar = ({ tabla }) => tabla === 'intermediaciones_enrique' ? { message: 'permiso denegado' } : undefined;
  await page.locator('#editmodal button', { hasText: 'Guardar colocación' }).click();
  await expect(page.locator('#inter-enrique-warn')).toContainText('permiso denegado');
  await expect(page.locator('#editmodal.show')).toHaveCount(1);
  await expect(filas(page)).toHaveCount(3);
  verificarLimpio(e, { ignorar: [/Failed to load resource|\[Supabase\]/] });
});

test('"Niñeras de Enrique" va plegada debajo de la lista, con el resumen, y se abre', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos() });
  await irAModulo(page, 'intermediaciones');
  const seccion = page.locator('#inter-pool');
  await expect(seccion).toContainText('Niñeras de Enrique');
  await expect(seccion.locator('summary')).toContainText('1 colocada · 1 disponible');
  await expect(seccion.locator('.inter-pool-fila').first()).toBeHidden();
  await seccion.locator('summary').click();
  await expect(seccion.locator('.inter-pool-fila')).toHaveCount(2);
  await seccion.locator('.inter-pool-fila', { hasText: 'Carla Ejemplo' }).click();
  await expect(page.locator('#editmodal')).toContainText('Disponible');
  verificarLimpio(e);
});

for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
  test(`a ${ancho} px: sin scroll de costado, filas y botones de 44 px (captura)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'intermediaciones');
    await page.locator('#inter-pool summary').click();
    for (const f of await filas(page).all()) expect((await f.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await page.locator('#modcontent button', { hasText: '+ Nueva' }).boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
    await page.locator('#modcontent').screenshot({ path: `test-results/intermediaciones-${ancho}.png` });
    await page.locator('#modcontent button', { hasText: '+ Nueva' }).click();
    await page.locator('#editmodal button', { hasText: 'Evento' }).click();
    await expect(page.locator('#editmodal.show #inter-evento-empresa')).toBeVisible();
    await page.waitForTimeout(400); // que termine la animación de apertura antes de la captura
    await page.screenshot({ path: `test-results/intermediaciones-${ancho}-evento.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ancho);
    verificarLimpio(e);
  });
}
