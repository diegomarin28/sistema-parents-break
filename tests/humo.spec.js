// Capa 2: smoke tests en Chromium headless con Supabase simulado (tests/support/app.js).
// Cada test termina con verificarLimpio(): sin errores de consola y sin pedidos a Supabase
// que no estén simulados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { funcionesLlamadasPorHandlers } = require('./support/fuentes');

const MODULOS = ['agenda', 'rrhh', 'ninieras', 'familias', 'sittings', 'intermediaciones', 'finanzas', 'marketing', 'legal', 'juguetes', 'notificaciones'];

async function modalAbierto(page) {
  await expect(page.locator('#editmodal.show')).toBeVisible();
}
async function cerrarConCancelar(page) {
  await page.locator('#editmodal .confirmbtns .btn.ghost', { hasText: 'Cancelar' }).click();
  await expect(page.locator('#editmodal')).toHaveCount(0);
}

test.describe('arranque', () => {
  test('la pantalla de login carga sin errores y sin consultar la base', async ({ page }) => {
    const e = await abrirApp(page, { sesion: false });
    await expect(page.locator('#loginbtn')).toBeVisible();
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });

  test('con sesión abre Hoy sin errores', async ({ page }) => {
    const e = await abrirApp(page);
    await expect(page.locator('#modcontent')).toContainText('Hoy');
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });

  test('el sidebar lista todos los módulos esperados', async ({ page }) => {
    const e = await abrirApp(page);
    const claves = await page.evaluate(() => MODULOS.map(m => m.key));
    expect(claves).toEqual(MODULOS);
    verificarLimpio(e);
  });
});

test.describe('navegación por módulo', () => {
  for (const modulo of MODULOS) {
    test(`${modulo} carga sin errores`, async ({ page }) => {
      const e = await abrirApp(page);
      await irAModulo(page, modulo);
      await expect(page.locator('#modcontent .modtitle, #modcontent h1').first()).toBeVisible();
      expect(e.escrituras, 'abrir un módulo no debería escribir en la base').toEqual([]);
      verificarLimpio(e);
    });
  }

  test('volver a Hoy desde un módulo', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(() => setModulo(null));
    await esperarQuieta(page);
    await expect(page.locator('#modcontent')).toContainText('Hoy');
    verificarLimpio(e);
  });
});

test('todas las funciones que llaman los onclick/onchange existen', async ({ page }) => {
  const e = await abrirApp(page);
  const nombres = [...funcionesLlamadasPorHandlers()];
  const faltan = await page.evaluate(lista => lista.filter(([n]) => {
    // eslint-disable-next-line no-eval
    try { return typeof (0, eval)(n) !== 'function'; } catch { return true; }
  }).map(([n, donde]) => `${n} (${donde})`), nombres);
  expect(faltan).toEqual([]);
  verificarLimpio(e);
});

test.describe('modales: abrir y cerrar', () => {
  const casos = [
    { modulo: 'familias', boton: 'button[onclick^="abrirModalNuevaFamilia"]', titulo: 'Nueva familia' },
    { modulo: 'rrhh', boton: 'button[onclick^="abrirModalNuevaCandidata"]', titulo: 'Cargar candidata' },
    { modulo: 'finanzas', boton: 'button[onclick^="abrirModalNuevoGasto("]', titulo: 'Registrar gasto' },
    { modulo: 'marketing', boton: 'button[onclick^="abrirModalNuevaFechaMarketing"]', titulo: 'Agregar fecha especial' },
    { modulo: 'sittings', boton: 'button[onclick^="abrirModalSitForm"]', titulo: '' },
    { modulo: 'agenda', boton: 'button[onclick^="abrirModalNuevaSolicitud"]', titulo: '' },
    { modulo: 'juguetes', boton: 'button[onclick^="abrirModalJuguete"]', titulo: '' },
  ];
  for (const c of casos) {
    test(`${c.modulo}: ${c.boton}`, async ({ page }) => {
      const e = await abrirApp(page);
      await irAModulo(page, c.modulo);
      await page.locator(c.boton).first().click();
      await modalAbierto(page);
      if (c.titulo) await expect(page.locator('#editmodal h2').first()).toContainText(c.titulo);
      // Cerrar con la X también tiene que funcionar; acá se prueba la X y en los
      // formularios de abajo, el botón Cancelar.
      await page.locator('#editmodal .modal-close').click();
      await expect(page.locator('#editmodal')).toHaveCount(0);
      expect(e.escrituras).toEqual([]);
      verificarLimpio(e);
    });
  }
});

test.describe('formularios principales: lo que se manda a la base', () => {
  test('nueva familia', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.locator('button[onclick^="abrirModalNuevaFamilia"]').click();
    await modalAbierto(page);
    await page.fill('#fam-nombre', 'Familia Test Nueva');
    await page.fill('#fam-telefono', '091111111');
    await page.fill('#fam-cobro', '390');
    await page.fill('#fam-pago', '255');
    await page.fill('#fam-notas', 'nota de prueba');
    await page.locator('#editmodal button', { hasText: 'Agregar familia' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const alta = e.escrituras.find(w => w.tabla === 'familias' && w.metodo === 'POST');
    expect(alta.cuerpo).toMatchObject({ nombre: 'Familia Test Nueva', telefono: '091111111', cobro_hora: '390', pago_hora: '255', notas: 'nota de prueba' });
    await expect(page.locator('#familiaslist')).toContainText('Familia Test Nueva');
    verificarLimpio(e);
  });

  test('nueva candidata (carga manual)', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'rrhh');
    await page.locator('button[onclick^="abrirModalNuevaCandidata"]').click();
    await modalAbierto(page);
    await page.fill('#in-nombre', 'Candidata Test');
    await page.fill('#in-tel', '092222222');
    await page.selectOption('#in-tipo', 'Traslados');
    await page.locator('#editmodal button', { hasText: 'Agregar candidata' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const alta = e.escrituras.find(w => w.tabla === 'candidatas' && w.metodo === 'POST');
    expect(alta.cuerpo).toMatchObject({ nombre: 'Candidata Test', telefono: '092222222', tipo: 'Traslados', estado: 'intake' });
    verificarLimpio(e);
  });

  test('nuevo gasto', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'finanzas');
    await page.locator('button[onclick^="abrirModalNuevoGasto("]').click();
    await modalAbierto(page);
    await page.fill('#fin-gasto-fecha', '2026-10-03');
    await page.fill('#fin-gasto-concepto', 'Insumos de prueba');
    await page.fill('#fin-gasto-monto', '750');
    await page.locator('#editmodal button', { hasText: 'Agregar gasto' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const alta = e.escrituras.find(w => w.tabla === 'gastos_generales' && w.metodo === 'POST');
    expect(alta.cuerpo).toEqual({ fecha: '2026-10-03', concepto: 'Insumos de prueba', monto: 750 });
    verificarLimpio(e);
  });

  test('nueva fecha de marketing', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'marketing');
    await page.locator('button[onclick^="abrirModalNuevaFechaMarketing"]').click();
    await modalAbierto(page);
    await page.fill('#mk-fecha', '2026-11-15');
    await page.fill('#mk-titulo', 'Fecha test');
    await page.locator('#editmodal button', { hasText: 'Agregar fecha' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const alta = e.escrituras.find(w => w.tabla === 'fechas_marketing' && w.metodo === 'POST');
    expect(alta.cuerpo).toMatchObject({ fecha: '2026-11-15', titulo: 'Fecha test', publicado: false });
    verificarLimpio(e);
  });

  test('formulario incompleto no guarda nada (familia sin nombre)', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.locator('button[onclick^="abrirModalNuevaFamilia"]').click();
    await modalAbierto(page);
    await page.locator('#editmodal button', { hasText: 'Agregar familia' }).click();
    await expect(page.locator('.toast, #toast').first()).toContainText('Falta el nombre');
    expect(e.escrituras).toEqual([]);
    await cerrarConCancelar(page);
    verificarLimpio(e);
  });
});

test('temporada.html redirige los links personales al formulario de temporada', async ({ page }) => {
  // Página EN USO (formulario de verano de las niñeras). No se sale a internet: la
  // dirección de destino se intercepta acá.
  let destino = null;
  await page.route('https://parentsbreak.pages.dev/**', r => { destino = r.request().url(); return r.fulfill({ body: '<html><body>ok</body></html>', contentType: 'text/html' }); });
  await page.goto('/temporada.html?t=token-de-prueba');
  await expect.poll(() => destino).toBe('https://parentsbreak.pages.dev/temporada?t=token-de-prueba');
});
