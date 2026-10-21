// Que no se pierda lo escrito (21/10/2026). A Paulina y Delfina se les borró muchas veces la
// entrevista. Acá se provoca a propósito cada forma de perderla (recargar, cerrar y abrir la
// pestaña, quedarse sin internet, sesión cerrada, "Actualizar" con versión nueva, cambiar de
// pestaña o de sección, Realtime, "Vaciar formulario") y en todas lo escrito tiene que volver.
// También las fichas y el registro de sitting (modales). Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const C_OTRA = '40000000-0000-4000-8000-0000000000aa';
async function agendar(page, i = 0) {
  await irAModulo(page, 'rrhh');
  await page.evaluate(async n => { await agendarDesdeIntake(n); }, i);
  await esperarQuieta(page);
}
// Un poco de todo: texto, select, fecha, zona, ficha del formulario, puntaje con notas,
// psicotécnico, capacitación, señal de alerta, referencia y notas finales.
async function escribirEntrevista(page) {
  const clave = await page.evaluate(() => COMP_PRINCIPALES[0].key);
  const psico = await page.evaluate(() => PSICO_IMGS[0].id);
  await page.fill('#f-telefono', '099123456');
  await page.selectOption('#f-rol', 'Traslados');
  await page.fill('#f-fecha', '2026-10-04');
  await page.locator('#f-zonas-checklist input[value="Carrasco"]').check();
  await page.fill('#ent-nota-idiomas', 'Inglés intermedio');
  await page.locator(`[data-score="${clave}:4"]`).click();
  await page.fill(`[data-notes="${clave}"]`, 'Contó un caso con calma');
  await page.fill(`[data-psico="${psico}"]`, 'Ve una mariposa');
  await page.fill('#f-capacitacion', 'Curso de primeros auxilios');
  await page.locator('#redflags .flag-row:not(.critical) input').first().check();
  await page.getByRole('button', { name: '+ Agregar referencia' }).click();
  await page.locator('#reflist input[placeholder="Nombre"]').fill('Ref Inventada');
  await page.fill('#f-notas', 'Muy buena impresión');
  return { clave, psico };
}
async function verificarEntrevista(page, { clave, psico }) {
  await expect(page.locator('#f-nombre')).toHaveValue('Lucía Muestra');
  await expect(page.locator('#f-telefono')).toHaveValue('099123456');
  await expect(page.locator('#f-rol')).toHaveValue('Traslados');
  await expect(page.locator('#f-fecha')).toHaveValue('2026-10-04');
  await expect(page.locator('#f-zonas-checklist input[value="Carrasco"]')).toBeChecked();
  await expect(page.locator('#f-zonas-checklist input[value="Pocitos"]')).toBeChecked();
  await expect(page.locator('#ent-nota-idiomas')).toHaveValue('Inglés intermedio');
  await expect(page.locator(`[data-score="${clave}:4"]`)).toHaveClass(/selected/);
  await expect(page.locator(`[data-notes="${clave}"]`)).toHaveValue('Contó un caso con calma');
  await expect(page.locator(`[data-psico="${psico}"]`)).toHaveValue('Ve una mariposa');
  await expect(page.locator('#f-capacitacion')).toHaveValue('Curso de primeros auxilios');
  await expect(page.locator('#redflags .flag-row:not(.critical) input').first()).toBeChecked();
  await expect(page.locator('#reflist input[placeholder="Nombre"]')).toHaveValue('Ref Inventada');
  await expect(page.locator('#f-notas')).toHaveValue('Muy buena impresión');
}
const aviso = page => page.locator('#entrevista-borrador-aviso');
async function seguir(page) {
  await expect(aviso(page)).toContainText('Tenés un borrador de la entrevista de Lucía Muestra');
  await aviso(page).getByRole('button', { name: 'Seguir' }).click();
  await expect(aviso(page)).toHaveCount(0);
}
// La pausa del borrador (400 ms) ya pasó.
const esperarBorrador = page => page.waitForTimeout(600);
const borradoresGuardados = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pb_borrador:')));
const aceptarDialogos = page => page.on('dialog', d => d.accept());

test.describe('entrevista: lo escrito vuelve', () => {
  test('recargar a mitad: abre en la entrevista, pregunta y vuelve todo', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    aceptarDialogos(page);
    await page.reload();
    await esperarQuieta(page);
    await expect(page.locator('#f-nombre')).toBeVisible(); // abrió directo en Postulantes > Entrevista
    await expect(aviso(page)).toContainText('hace un momento');
    // Mientras no contesta, el formulario está vacío: no se pisó nada sin preguntar.
    await expect(page.locator('#f-notas')).toHaveValue('');
    await seguir(page);
    await verificarEntrevista(page, datos);
    verificarLimpio(e);
  });

  test('cerrar la pestaña y abrir la app de nuevo', async ({ page, context }) => {
    await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    await esperarBorrador(page);
    await page.close();
    const otra = await context.newPage();
    const e = await abrirApp(otra);
    await expect(otra.locator('#f-nombre')).toBeVisible();
    await seguir(otra);
    await verificarEntrevista(otra, datos);
    verificarLimpio(e);
  });

  test('cerrar la pestaña con cambios: el navegador avisa', async ({ page }) => {
    await abrirApp(page);
    await agendar(page);
    await page.fill('#f-notas', 'Algo sin guardar');
    const dialogo = new Promise(ok => page.once('dialog', d => { ok(d.type()); d.accept(); }));
    await page.close({ runBeforeUnload: true });
    expect(await dialogo).toBe('beforeunload');
  });

  test('sin cambios, cerrar no avisa', async ({ page }) => {
    await abrirApp(page);
    await agendar(page);
    let avisos = 0;
    page.on('dialog', d => { avisos++; d.accept(); });
    await page.close({ runBeforeUnload: true });
    expect(avisos).toBe(0);
  });

  test('sin internet: guardar falla y avisa, lo escrito sigue ahí y en el borrador; al volver la conexión, se guarda', async ({ page, context }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    await context.setOffline(true);
    e.fallar = () => 'red';
    await page.fill('#f-notas', 'Muy buena impresión'); // sigue escribiendo sin conexión
    await page.locator('#btnGuardarEnCurso').click();
    await expect(page.locator('#warnArea')).toContainText(/conexión|Failed to fetch/i);
    await verificarEntrevista(page, datos);
    await esperarBorrador(page);
    expect((await borradoresGuardados(page)).some(k => k.endsWith(':entrevista:' + ID.cIntake))).toBe(true);
    await context.setOffline(false);
    e.fallar = null;
    await page.locator('#btnGuardarEnCurso').click();
    await expect(page.locator('.toaststack')).toContainText('Entrevista guardada a medias');
    await verificarEntrevista(page, datos);
    verificarLimpio(e, { ignorar: [/Failed to load resource|ERR_INTERNET_DISCONNECTED|\[Supabase\]|net::/] });
  });

  test('sesión cerrada (vencida o desde otro dispositivo): pasa al login sin perder nada y al volver a entrar se sigue', async ({ page, context }) => {
    await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    await page.evaluate(() => sb.auth.signOut({ scope: 'local' }));
    await expect(page.locator('#login-mail')).toBeVisible();
    expect((await borradoresGuardados(page)).length).toBeGreaterThan(0);
    // Vuelve a entrar más tarde (la app de nuevo, con sesión).
    await page.close();
    const otra = await context.newPage();
    const e = await abrirApp(otra);
    await seguir(otra);
    await verificarEntrevista(otra, datos);
    verificarLimpio(e);
  });

  test('"Cerrar sesión" y salir con "no recordarme" cierran solo este dispositivo', async ({ page }) => {
    const e = await abrirApp(page);
    const pedido = page.waitForRequest(r => r.url().includes('/auth/v1/logout'));
    await page.evaluate(() => logout());
    expect((await pedido).url()).toContain('scope=local');
    verificarLimpio(e);
  });

  test('"Actualizar" (versión nueva o al volver de un rato) pregunta si hay cambios; si sigue, lo escrito vuelve', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    await page.evaluate(() => mostrarAvisoVolviste());
    await page.locator('#aviso-volviste button', { hasText: 'Actualizar' }).click();
    const confirmacion = page.locator('.confirmoverlay.show').last();
    await expect(confirmacion).toContainText('Tenés cambios sin guardar');
    await confirmacion.getByRole('button', { name: 'Cancelar' }).click();
    await verificarEntrevista(page, datos); // no recargó
    // Una versión nueva del service worker no recarga sola.
    await page.evaluate(() => navigator.serviceWorker?.dispatchEvent(new Event('controllerchange')));
    await page.waitForTimeout(300);
    await verificarEntrevista(page, datos);
    await page.locator('#aviso-volviste button', { hasText: 'Actualizar' }).click();
    await page.locator('.confirmoverlay.show').last().getByRole('button', { name: 'Actualizar igual' }).click();
    await page.waitForURL(/\?_=/);
    await esperarQuieta(page);
    await seguir(page);
    await verificarEntrevista(page, datos);
    verificarLimpio(e);
  });

  test('volver de segundo plano después de un rato: no se toca nada', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    await page.evaluate(() => { sessionStorage.setItem('pb_hidden_at', String(Date.now() - 11 * 60 * 1000)); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.locator('#aviso-volviste')).toBeVisible();
    await verificarEntrevista(page, datos);
    verificarLimpio(e);
  });

  test('cambiar de pestaña en Postulantes y volver', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    await page.locator('[data-rrhhtab="intake"]').click();
    await esperarQuieta(page);
    await page.locator('[data-rrhhtab="entrevista"]').click();
    await esperarQuieta(page);
    await seguir(page);
    await verificarEntrevista(page, datos);
    verificarLimpio(e);
  });

  test('ir a otra sección y volver (el borrador se guarda al toque, aunque fuera recién escrito)', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    await irAModulo(page, 'agenda'); // sin esperar la pausa del borrador
    await irAModulo(page, 'rrhh');
    await seguir(page);
    await verificarEntrevista(page, datos);
    verificarLimpio(e);
  });

  test('Realtime (una candidata nueva del formulario) no toca la entrevista', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    expect(e.emitirRealtime('candidatas', 'INSERT', { id: C_OTRA, nombre: 'Nueva' })).toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    await verificarEntrevista(page, datos);
    await expect(aviso(page)).toHaveCount(0);
    verificarLimpio(e);
  });

  test('editar las zonas desde la entrevista no borra lo escrito en la ficha', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    await page.fill('#ent-nota-idiomas', 'Inglés intermedio');
    await page.evaluate(() => renderFichaOrigen()); // lo que pasa al guardar los grupos de zonas
    await expect(page.locator('#ent-nota-idiomas')).toHaveValue('Inglés intermedio');
    verificarLimpio(e);
  });
});

test.describe('entrevista: el borrador', () => {
  test('si escribe sin contestar el aviso, el borrador ofrecido no se pisa', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    const datos = await escribirEntrevista(page);
    aceptarDialogos(page);
    await page.reload();
    await esperarQuieta(page);
    await page.fill('#f-notas', 'Otra cosa');
    await esperarBorrador(page);
    await seguir(page);
    await verificarEntrevista(page, datos);
    verificarLimpio(e);
  });

  test('"Descartar" pregunta y lo borra', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    await escribirEntrevista(page);
    aceptarDialogos(page);
    await page.reload();
    await esperarQuieta(page);
    await aviso(page).getByRole('button', { name: 'Descartar' }).click();
    await page.locator('.confirmoverlay.show').last().getByRole('button', { name: 'Descartar' }).click();
    await expect(aviso(page)).toHaveCount(0);
    expect(await borradoresGuardados(page)).toEqual([]);
    verificarLimpio(e);
  });

  test('"Guardar y seguir después" borra el borrador: al recargar no pregunta y abre en Hoy', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    await escribirEntrevista(page);
    await page.locator('#btnGuardarEnCurso').click();
    await expect(page.locator('.toaststack')).toContainText('Entrevista guardada a medias');
    expect(await borradoresGuardados(page)).toEqual([]);
    await page.reload();
    await esperarQuieta(page);
    await expect(page.locator('#f-nombre')).toHaveCount(0);
    verificarLimpio(e);
  });

  test('guardar la candidata completa borra el borrador', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    await escribirEntrevista(page);
    await page.evaluate(() => COMPETENCIAS.forEach(c => document.querySelector(`[data-score="${c.key}:4"]`)?.click()));
    await page.locator('[data-juegos="Si"]').click();
    await page.locator('#btnGuardar').click();
    await expect(page.locator('.toaststack')).toContainText('Candidata guardada');
    await esperarBorrador(page);
    expect(await borradoresGuardados(page)).toEqual([]);
    verificarLimpio(e);
  });

  test('otra candidata arranca limpia (sin los puntajes de la anterior) y cada una tiene su borrador', async ({ page }) => {
    const d = datosBase();
    d.candidatas.push({ ...d.candidatas[0], id: C_OTRA, nombre: 'Paula', apellido: 'Otra', telefono: '097000002' });
    const e = await abrirApp(page, { datos: d });
    await agendar(page, 0);
    const datos = await escribirEntrevista(page);
    const i = await page.evaluate(id => intakeItems.findIndex(c => c.id === id), C_OTRA);
    await page.evaluate(async n => { await agendarDesdeIntake(n); }, i);
    await esperarQuieta(page);
    await expect(page.locator('#f-nombre')).toHaveValue('Paula Otra');
    await expect(page.locator('[data-score].selected')).toHaveCount(0);
    await expect(aviso(page)).toHaveCount(0); // de Paula no hay borrador
    const j = await page.evaluate(id => intakeItems.findIndex(c => c.id === id), ID.cIntake);
    await page.evaluate(async n => { await agendarDesdeIntake(n); }, j);
    await esperarQuieta(page);
    await seguir(page);
    await verificarEntrevista(page, datos);
    verificarLimpio(e);
  });

  test('"Vaciar formulario" está lejos de Guardar y pregunta', async ({ page }) => {
    const e = await abrirApp(page);
    await agendar(page);
    await escribirEntrevista(page);
    await expect(page.locator('.actions').getByText('Vaciar formulario')).toHaveCount(0);
    await page.locator('#btnVaciarEntrevista').click();
    await page.locator('.confirmoverlay.show').last().getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#f-notas')).toHaveValue('Muy buena impresión');
    await page.locator('#btnVaciarEntrevista').click();
    await page.locator('.confirmoverlay.show').last().getByRole('button', { name: 'Vaciar' }).click();
    await expect(page.locator('#f-notas')).toHaveValue('');
    await expect(page.locator('#f-nombre')).toHaveValue('');
    expect(await borradoresGuardados(page)).toEqual([]);
    verificarLimpio(e);
  });

  test('celular de 390 px: el aviso entra en la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const e = await abrirApp(page);
    await agendar(page);
    await escribirEntrevista(page);
    aceptarDialogos(page);
    await page.reload();
    await esperarQuieta(page);
    await expect(aviso(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await aviso(page).screenshot({ path: 'test-results/borrador-entrevista-390.png' });
    verificarLimpio(e);
  });
});

test.describe('fichas y registro de sitting (modales)', () => {
  const modal = page => page.locator('#editmodal');
  const confirmar = page => page.locator('.confirmoverlay.show').last();

  test('con cambios, el fondo, la × y "Cancelar" preguntan antes de cerrar', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'ninieras');
    await page.evaluate(id => { ninTempOmitidas.add(id); editarNinera(id); }, ID.nAna);
    await page.fill('#ed-notas', 'Nota nueva sin guardar');
    await page.mouse.click(5, 5); // el fondo
    await expect(confirmar(page)).toContainText('Tenés cambios sin guardar');
    await confirmar(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('#ed-notas')).toHaveValue('Nota nueva sin guardar');
    await modal(page).locator('.confirmbtns').getByRole('button', { name: 'Cancelar' }).click();
    await expect(confirmar(page)).toContainText('Tenés cambios sin guardar');
    await confirmar(page).getByRole('button', { name: 'Cancelar' }).click();
    await modal(page).locator('.modal-close').click();
    await confirmar(page).getByRole('button', { name: 'Cerrar sin guardar' }).click();
    await expect(modal(page)).toHaveCount(0);
    expect(await borradoresGuardados(page)).toEqual([]);
    verificarLimpio(e);
  });

  test('sin cambios, cierra sin preguntar', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'ninieras');
    await page.evaluate(id => { ninTempOmitidas.add(id); editarNinera(id); }, ID.nAna);
    await modal(page).locator('.modal-close').click();
    await expect(modal(page)).toHaveCount(0);
    verificarLimpio(e);
  });

  test('ficha de niñera: recargar con cambios y volver a abrirla ofrece recuperarlos; guardar borra el borrador', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'ninieras');
    await page.evaluate(id => { ninTempOmitidas.add(id); editarNinera(id); }, ID.nAna);
    await page.fill('#ed-notas', 'Nota nueva sin guardar');
    await page.fill('#ed-telefono', '098111222');
    aceptarDialogos(page);
    await page.reload();
    await esperarQuieta(page);
    await irAModulo(page, 'ninieras');
    await page.evaluate(id => { ninTempOmitidas.add(id); editarNinera(id); }, ID.nAna);
    await expect(page.locator('#modal-borrador-aviso')).toContainText('Quedaron cambios sin guardar');
    await page.locator('#modal-borrador-aviso').getByRole('button', { name: 'Recuperar' }).click();
    await expect(page.locator('#ed-notas')).toHaveValue('Nota nueva sin guardar');
    await expect(page.locator('#ed-telefono')).toHaveValue('098111222');
    await modal(page).getByRole('button', { name: /^Guardar/ }).first().click();
    await expect(modal(page)).toHaveCount(0);
    expect(await borradoresGuardados(page)).toEqual([]);
    const w = e.escrituras.filter(x => x.tabla === 'ninieras' && x.metodo === 'PATCH').at(-1);
    expect(w.cuerpo).toMatchObject({ telefono: '098111222', notas: 'Nota nueva sin guardar' });
    verificarLimpio(e);
  });

  test('otra niñera no ofrece el borrador de Ana', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'ninieras');
    await page.evaluate(id => { ninTempOmitidas.add(id); editarNinera(id); }, ID.nAna);
    await page.fill('#ed-notas', 'Sin guardar');
    await esperarBorrador(page);
    await page.evaluate(() => cerrarModal()); // como si se hubiera cerrado por otro lado
    await page.evaluate(id => { ninTempOmitidas.add(id); editarNinera(id); }, ID.nBruno);
    await expect(page.locator('#modal-borrador-aviso')).toHaveCount(0);
    verificarLimpio(e);
  });

  test('familia nueva: recargar y volver a abrir ofrece recuperarla', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(() => abrirModalNuevaFamilia());
    await page.fill('#fam-nombre', 'Familia Prueba Nueva');
    await page.fill('#fam-telefono', '099555444');
    aceptarDialogos(page);
    await page.reload();
    await esperarQuieta(page);
    await irAModulo(page, 'familias');
    await page.evaluate(() => abrirModalNuevaFamilia());
    await page.locator('#modal-borrador-aviso').getByRole('button', { name: 'Recuperar' }).click();
    await expect(page.locator('#fam-nombre')).toHaveValue('Familia Prueba Nueva');
    await expect(page.locator('#fam-telefono')).toHaveValue('099555444');
    verificarLimpio(e);
  });

  test('registro de sitting nuevo: recargar y volver a abrir lo recupera, con la familia y la niñera elegidas', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'sittings');
    await page.evaluate(() => abrirModalSitForm());
    await esperarQuieta(page);
    await page.fill('#sit-familia', 'Familia Prueba Uno');
    await page.fill('#sit-ninera', 'Ana Ficticia');
    await page.fill('#sit-notas', 'Llegó tarde la madre');
    aceptarDialogos(page);
    await page.reload();
    await esperarQuieta(page);
    await irAModulo(page, 'sittings');
    await page.evaluate(() => abrirModalSitForm());
    await page.locator('#modal-borrador-aviso').getByRole('button', { name: 'Recuperar' }).click();
    await expect(page.locator('#sit-familia')).toHaveValue('Familia Prueba Uno');
    await expect(page.locator('#sit-ninera')).toHaveValue('Ana Ficticia');
    await expect(page.locator('#sit-notas')).toHaveValue('Llegó tarde la madre');
    expect(await page.evaluate(() => [sitFamiliaSel?.nombre, sitNineraSel?.nombre])).toEqual(['Familia Prueba Uno', 'Ana Ficticia']);
    verificarLimpio(e);
  });
});
