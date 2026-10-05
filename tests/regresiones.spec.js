// Regresiones de bugs conocidos (auditoría del 04/10/2026 y errores E1/E2 reportados).
//
// Los marcados con test.fail() REPRODUCEN un bug que todavía está en el código: hoy fallan
// a propósito y el CI los cuenta como "esperado". Cuando el PR que arregla ese bug se
// mergee, el test va a empezar a pasar y Playwright lo marca como error ("expected to
// fail") -- ahí se borra el test.fail() y queda como protección permanente.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

async function verMes(page, mes) {
  await page.evaluate(async m => { finMes = m; await cargarFinanzas(); }, mes);
  await esperarQuieta(page);
}
async function verAgendaDesde(page, fechaISO) {
  await page.evaluate(async f => { agendaAncla = f; await cargarAgendaSolicitudes(); }, fechaISO);
  await esperarQuieta(page);
}

test.describe('E1: conciliación con extracto Itaú', () => {
  test('procesar el extracto no modifica ningún sitting ni cambia lo cobrado del mes', async ({ page }) => {
    // Diagnóstico E1: la subida del 01/10 solo escribió la marca en app_config.
    const e = await abrirApp(page);
    await irAModulo(page, 'finanzas');
    await verMes(page, '2026-09');
    const antes = await page.locator('#fin-summary').innerText();
    const csv = 'Fecha;Concepto;Crédito\n20/09/2026;TRANSF 0001234567 FAMILIA;2280\n21/09/2026;CAMBIOS VARIOS;100\n';
    await page.setInputFiles('#fin-conciliar-file', { name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.locator('button[onclick*="procesarExtractoConciliacion"]').click();
    await expect(page.locator('#fin-conciliar-resultado')).toContainText(/créditos? leídos? del extracto/);
    await expect(page.locator('#fin-conciliar-resultado')).toContainText('Familia Prueba Uno');
    expect(e.escrituras.map(w => w.tabla)).toEqual(['app_config']);
    await verMes(page, '2026-09');
    expect(await page.locator('#fin-summary').innerText()).toBe(antes);
    verificarLimpio(e);
  });

  test('el resumen del mes deja ver el total facturado, no solo lo marcado como cobrado', async ({ page }) => {
    // Causa real de E1: desde el 29/09 el "ingreso" del mes es solo lo marcado cobrado.
    // Setiembre en los datos ficticios: facturado 3.870 (1.140 x 3 + 450), cobrado 1.140.
    // Desde el PR 2 el resumen muestra Facturado / Cobrado / Por cobrar / Por pagar.
    const e = await abrirApp(page);
    await irAModulo(page, 'finanzas');
    await verMes(page, '2026-09');
    await expect(page.locator('#fin-summary')).toContainText('3.870', { timeout: 2000 });
    verificarLimpio(e);
  });
});

test.describe('E2: cambio de niñera en un fijo', () => {
  // Las tarjetas de la Agenda no muestran el nombre de la niñera, así que se mira lo que la
  // Agenda calcula para pintarlas (agendaSolicitudes): días del fijo sin registrar todavía.
  const fijosProyectados = page => page.evaluate(() => agendaSolicitudes
    .filter(s => s._fuente === 'asignacion')
    .map(s => `${s.fecha} ${s.ninieras[0].ninera_nombre}`));

  test('cambiar la niñera de un fijo no hace aparecer a la nueva en las semanas anteriores', async ({ page }) => {
    // Ana hacía el fijo (lunes y miércoles) y quedó registrado el 14 y el 16/09.
    // Se cambia la niñera a Carla desde la semana del 05/10.
    const e = await abrirApp(page);
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-09-14');
    expect(await fijosProyectados(page)).toEqual([]); // antes del cambio: todo registrado, nada pendiente
    await verAgendaDesde(page, '2026-10-05');
    await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-10-05`), ID.aFijo);
    await page.locator(`#agenda-fija-ninera-${ID.aFijo}`).fill('Carla Ejemplo');
    await page.locator('#editmodal .autocomplete-item', { hasText: 'Carla Ejemplo' }).click();
    await page.locator(`#agenda-fija-guardar-${ID.aFijo}`).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    expect(e.escrituras.some(w => w.tabla === 'asignaciones')).toBe(true);
    // Lo que tiene que quedar: la semana del 14/09 sigue cubierta por lo que hizo Ana.
    await verAgendaDesde(page, '2026-09-14');
    expect(await fijosProyectados(page)).toEqual([]);
    verificarLimpio(e);
  });

  test('un fijo no se proyecta en fechas anteriores a que empiece', async ({ page }) => {
    const datos = datosBase();
    // Fijo de Carla creado el 02/10, vigente desde el 29/09.
    datos.asignaciones = [{ ...datos.asignaciones[0], ninera_nombre: 'Carla Ejemplo', created_at: '2026-10-02T12:00:00Z', vigente_desde: '2026-09-29' }];
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-09-14');
    expect(await fijosProyectados(page)).toEqual([]);
    verificarLimpio(e);
  });
});

test.describe('fechas en Montevideo (UTC-3)', () => {
  test('a las 22:30 el formulario de sitting propone la fecha de hoy, no la de mañana', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-10-04T22:30:00-03:00' });
    await irAModulo(page, 'sittings');
    await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
    await expect(page.locator('#sit-fecha')).toHaveValue('2026-10-04', { timeout: 2000 });
    verificarLimpio(e);
  });

  test('a las 22:30 Hoy muestra el día de hoy', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-10-04T22:30:00-03:00' });
    // El título usa Intl con hora local: este ya está bien y tiene que seguir así.
    await expect(page.locator('#modcontent')).toContainText('4 de octubre');
    verificarLimpio(e);
  });
});

test.describe('nombres con apóstrofo y HTML', () => {
  test("la foto de una niñera con apóstrofo en el nombre se abre (D'Alessandro)", async ({ page }) => {
    const datos = datosBase();
    datos.ninieras[0] = { ...datos.ninieras[0], nombre: "Ana D'Alessandro", foto: 'https://ejemplo.test/foto.jpg' };
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'ninieras');
    await page.locator('[onclick^="abrirLightboxFoto"]').first().click();
    await expect(page.locator('#fotolightbox')).toBeVisible({ timeout: 2000 });
    verificarLimpio(e, { ignorar: [/ejemplo\.test|Failed to load resource/] });
  });

  test('un nombre con HTML que llega del formulario público no se ejecuta', async ({ page }) => {
    const datos = datosBase();
    datos.candidatas[0] = { ...datos.candidatas[0], nombre: '<img src=x onerror="window.__xss=1">Lucía' };
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'rrhh');
    await expect(page.locator('#intakegrid')).toContainText('Lucía');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    verificarLimpio(e);
  });

  test('un nombre con <script> se muestra como texto', async ({ page }) => {
    const datos = datosBase();
    datos.candidatas[0] = { ...datos.candidatas[0], nombre: '<script>window.__xss2=1</script>Lucía' };
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'rrhh');
    await expect(page.locator('#intakegrid')).toContainText('<script>', { timeout: 2000 });
    verificarLimpio(e);
  });
});

// 05/10/2026: un traslado del lunes 28/09 se quiso cargar con esa fecha y "no dejaba
// seleccionar el día": quedó guardado con la fecha del día en que se cargó (04/10). Al tocar
// "Traslado" el formulario volvía a dibujar los campos y la fecha volvía a hoy sin avisar.
test.describe('formulario de Sittings: cambiar el tipo no pisa la fecha', () => {
  async function abrirForm(page) {
    await irAModulo(page, 'sittings');
    await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
    await expect(page.locator('#sit-fecha')).toBeVisible();
  }
  test('elegir la fecha y después "Traslado": se guarda con la fecha elegida', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirForm(page);
    await page.fill('#sit-fecha', '2026-09-28');
    await page.locator('#sit-tipo-traslado').click();
    await expect(page.locator('#sit-fecha')).toHaveValue('2026-09-28');
    await page.evaluate(() => {
      document.getElementById('sit-familia').value = 'Familia Prueba Dos';
      sitFamiliaSel = sitFamilias.find(f => f.nombre === 'Familia Prueba Dos');
      document.getElementById('sit-ninera').value = 'Bruno Inventado';
      sitNineraSel = sitNinieras.find(n => n.nombre === 'Bruno Inventado');
      setHoraSelect('sit-hora', '13:00');
    });
    await page.fill('#sit-cobro', '488');
    await page.fill('#sit-pago', '282');
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const alta = e.escrituras.filter(w => w.tabla === 'sittings_traslados' && w.metodo === 'POST');
    expect(alta).toHaveLength(1);
    expect(alta[0].cuerpo).toMatchObject({ tipo: 'traslado', fecha: '2026-09-28', hora_inicio: '13:00' });
    verificarLimpio(e);
  });
  test('ida y vuelta entre Sitting y Traslado conserva fecha y hora de inicio', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirForm(page);
    await page.fill('#sit-fecha', '2026-09-21');
    await page.evaluate(() => setHoraSelect('sit-horaini', '09:30'));
    await page.locator('#sit-tipo-traslado').click();
    await expect(page.locator('#sit-fecha')).toHaveValue('2026-09-21');
    expect(await page.evaluate(() => leerHora('sit-hora'))).toBe('09:30');
    await page.locator('#sit-tipo-sitting').click();
    await expect(page.locator('#sit-fecha')).toHaveValue('2026-09-21');
    expect(await page.evaluate(() => leerHora('sit-horaini'))).toBe('09:30');
    verificarLimpio(e);
  });
});
