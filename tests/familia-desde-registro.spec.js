// Madre nueva desde el registro de un sitting (21/10/2026): la ficha de la familia se completa
// dentro del mismo formulario, sin perder lo ya cargado (fecha, horario, niñera, notas). Al
// crearla, el registro queda con esa familia y calcula el precio con su tarifa.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');
const { datosBase } = require('./support/datos');

async function hora(page, prefijo, hhmm) {
  const [hh, mm] = hhmm.split(':');
  await page.selectOption(`#${prefijo}-hh`, hh);
  await page.selectOption(`#${prefijo}-mm`, mm);
}
// Registro a medio cargar con una familia que todavía no existe.
async function registroConFamiliaNueva(page, nombre = 'Familia Nueva Tres') {
  await irAModulo(page, 'sittings');
  await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
  await page.fill('#sit-ninera', 'Carla Ejemplo');
  await page.evaluate(() => onSitNineraInput());
  await page.fill('#sit-fecha', '2026-10-03');
  await hora(page, 'sit-horaini', '16:00');
  await hora(page, 'sit-horafin', '19:00');
  await page.fill('#sit-notas', 'Primera vez, llevar juegos');
  await page.fill('#sit-familia', nombre);
  await page.evaluate(() => onSitFamiliaInput());
}
const familiaBtn = page => page.locator('#sit-familia-create button', { hasText: 'Familia nueva' });
const posts = (e, tabla) => e.escrituras.filter(w => w.tabla === tabla && w.metodo === 'POST');

test.describe('Familia nueva desde el registro de un sitting', () => {
  test('se completa la ficha ahí mismo, el registro calcula con su tarifa y se guarda con esa familia', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page);
    await expect(familiaBtn(page)).toHaveText('+ Familia nueva "Familia Nueva Tres"');
    await familiaBtn(page).click();
    await expect(page.locator('#sit-familia-nueva')).toContainText('Familia nueva');
    await expect(familiaBtn(page)).toHaveCount(0);
    await expect(page.locator('#sit-familia-nueva')).not.toContainText('Editar zonas'); // abriría otro modal
    await expect(page.locator('#sit-familia-dropdown')).toBeHidden();
    await page.fill('#sitfam-telefono', '099000123');
    await page.fill('#sitfam-direccion', 'Calle Inventada 456');
    await page.locator('#sitfam-zonas-checklist label', { hasText: 'Pocitos' }).click();
    await page.fill('#sitfam-cobro', '400');
    await page.fill('#sitfam-pago', '260');
    await page.check('#sitfam-terminos');
    await page.fill('#sitfam-terminos-fecha', '2026-10-01');
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sit-familia-create')).toContainText('Familia creada.');
    await expect(page.locator('#sit-familia-nueva')).toBeEmpty();
    const [fam] = posts(e, 'familias');
    expect(fam.cuerpo).toEqual({ nombre: 'Familia Nueva Tres', telefono: '099000123', direccion: 'Calle Inventada 456', zona: 'Pocitos', cobro_hora: 400, pago_hora: 260, terminos_aceptados_el: '2026-10-01' });
    // Lo cargado antes sigue ahí, y el precio sale de la tarifa nueva: 3 h × 400 / 260.
    await expect(page.locator('#sit-ninera')).toHaveValue('Carla Ejemplo');
    await expect(page.locator('#sit-fecha')).toHaveValue('2026-10-03');
    await expect(page.locator('#sit-notas')).toHaveValue('Primera vez, llevar juegos');
    await expect(page.locator('#sit-cobro')).toHaveValue('1200');
    await expect(page.locator('#sit-pago')).toHaveValue('780');
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const [sit] = posts(e, 'sittings_traslados');
    const idNueva = e.db.familias.find(f => f.nombre === 'Familia Nueva Tres').id;
    expect(sit.cuerpo).toMatchObject({ familia_id: idNueva, familia_nombre: 'Familia Nueva Tres', cobro_familia: 1200, pago_ninera: 780, notas: 'Primera vez, llevar juegos' });
    verificarLimpio(e);
  });

  test('con solo el nombre también se crea (lo demás, después desde Familias)', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page);
    await familiaBtn(page).click();
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sit-familia-create')).toContainText('Familia creada.');
    expect(posts(e, 'familias')[0].cuerpo).toEqual({ nombre: 'Familia Nueva Tres', telefono: '', direccion: '', zona: '', cobro_hora: null, pago_hora: null });
    // Sin tarifa, el registro ofrece cargarla como siempre.
    await expect(page.locator('#sit-sin-tarifa-box')).toContainText('no tiene tarifa por hora cargada');
    verificarLimpio(e);
  });

  test('si la base falla, avisa dentro de la ficha y no se pierde nada', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page);
    await familiaBtn(page).click();
    await page.fill('#sitfam-telefono', '099000123');
    e.fallar = ({ tabla }) => (tabla === 'familias' ? { message: 'falla simulada' } : undefined);
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sitfam-warn')).toContainText('falla simulada');
    await expect(page.locator('#sitfam-telefono')).toHaveValue('099000123');
    await expect(page.locator('#sit-notas')).toHaveValue('Primera vez, llevar juegos');
    await expect(page.locator('#sit-familia-create')).not.toContainText('Familia creada');
    // Se arregla la conexión y se vuelve a tocar: ahora sí.
    e.fallar = null;
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sit-familia-create')).toContainText('Familia creada.');
    expect(posts(e, 'familias')).toHaveLength(1);
    verificarLimpio(e, { ignorar: [/status of 500/] });
  });

  test('doble toque en "Crear familia": una sola familia', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page);
    await familiaBtn(page).click();
    e.demoraEscrituras = 400;
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).dblclick();
    await expect(page.locator('#sit-familia-create')).toContainText('Familia creada.');
    expect(posts(e, 'familias')).toHaveLength(1);
    verificarLimpio(e);
  });

  test('nombre parecido a una que existe: pregunta, y si cancela no crea nada', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page, 'Familia Prueba Unoo');
    await familiaBtn(page).click();
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('.confirmoverlay .confirmmsg')).toContainText('¿Quisiste decir "Familia Prueba Uno"?');
    await page.locator('#confirm-no').click();
    expect(posts(e, 'familias')).toHaveLength(0);
    await expect(page.locator('#sitfam-telefono')).toBeVisible();
    await expect(page.locator('#editmodal')).toBeVisible();
    verificarLimpio(e);
  });

  test('Cancelar cierra la ficha; elegir una familia que existe también', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page);
    await familiaBtn(page).click();
    await page.locator('#sit-familia-nueva button', { hasText: 'Cancelar' }).click();
    await expect(page.locator('#sit-familia-nueva')).toBeEmpty();
    await expect(familiaBtn(page)).toBeVisible();
    await expect(page.locator('#editmodal')).toBeVisible(); // Cancelar es de la ficha, no del registro
    await familiaBtn(page).click();
    await page.fill('#sit-familia', 'Familia Prueba Uno');
    await page.evaluate(() => onSitFamiliaInput());
    await expect(page.locator('#sit-familia-nueva')).toBeEmpty();
    await expect(familiaBtn(page)).toHaveCount(0);
    await expect(page.locator('#sit-cobro')).toHaveValue('1140');
    expect(posts(e, 'familias')).toHaveLength(0);
    verificarLimpio(e);
  });

  test('términos marcados sin fecha: avisa y no crea', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page);
    await familiaBtn(page).click();
    await page.check('#sitfam-terminos');
    await page.fill('#sitfam-terminos-fecha', '');
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sitfam-warn')).toContainText('fecha en que aceptó');
    expect(posts(e, 'familias')).toHaveLength(0);
    verificarLimpio(e);
  });

  test('base sin la columna de términos: no ofrece la casilla y crea igual', async ({ page }) => {
    const e = await abrirApp(page, { baseSinMigrar: true });
    await registroConFamiliaNueva(page);
    await familiaBtn(page).click();
    await expect(page.locator('#sitfam-terminos')).toHaveCount(0);
    await page.fill('#sitfam-cobro', '400');
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sit-familia-create')).toContainText('Familia creada.');
    expect(posts(e, 'familias')[0].cuerpo).not.toHaveProperty('terminos_aceptados_el');
    verificarLimpio(e, { ignorar: [/status of 400/, /status of 404/] }); // tablas y columnas que esa base no tiene
  });

  test('traslado: con la dirección nueva sugiere el origen', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'sittings');
    await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
    await page.locator('#sit-tipo-traslado').click();
    await page.fill('#sit-familia', 'Familia Nueva Tres');
    await page.evaluate(() => onSitFamiliaInput());
    await familiaBtn(page).click();
    await page.fill('#sitfam-direccion', 'Calle Inventada 456');
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sit-familia-create')).toContainText('Familia creada.');
    await expect(page.locator('#sit-origen')).toHaveValue('Calle Inventada 456');
    verificarLimpio(e);
  });

  test('nombre con HTML: se muestra como texto y se guarda tal cual', async ({ page }) => {
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page, '<img src=x onerror="window.__xss=1">"Tres"');
    await expect(familiaBtn(page)).toHaveText('+ Familia nueva "<img src=x onerror="window.__xss=1">"Tres""');
    await familiaBtn(page).click();
    await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).click();
    await expect(page.locator('#sit-familia-create')).toContainText('Familia creada.');
    expect(posts(e, 'familias')[0].cuerpo.nombre).toBe('<img src=x onerror="window.__xss=1">"Tres"');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    verificarLimpio(e);
  });

  test('celular de 390 px: la ficha entra en el formulario sin scroll de costado', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const e = await abrirApp(page);
    await registroConFamiliaNueva(page);
    await familiaBtn(page).click();
    const anchoModal = await page.locator('#editmodal .confirmbox').evaluate(el => [el.scrollWidth, el.clientWidth]);
    expect(anchoModal[0]).toBeLessThanOrEqual(anchoModal[1]);
    const crear = await page.locator('#sit-familia-nueva button', { hasText: 'Crear familia' }).boundingBox();
    expect(crear.x + crear.width).toBeLessThanOrEqual(390);
    verificarLimpio(e);
  });
});
