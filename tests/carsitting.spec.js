// Car sitting en Niñeras (21/10/2026): el mensaje para mandar por WhatsApp (copiar, editar y
// guardar), quién completó el formulario, quién falta, las respuestas sin identificar (unirlas a
// mano), que se actualice solo y los fallos (base que falla, sin conexión, doble toque, base
// sin migrar, datos tramposos, 390 px). Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const LINK = 'https://forms.gle/J4QXgNJQ8kXMsA4C6';
const respuesta = (id, extra = {}) => ({
  id, ninera_id: null, nombre_completo: 'Sin Nombre', ninera_nombre: extra.nombre_completo || 'Sin Nombre',
  telefono: null, mail: null, cedula: null, modelo_auto: null, created_at: '2026-10-03T15:00:00Z', ...extra,
});
const R_BRUNO = respuesta('c5000000-0000-4000-8000-000000000001', {
  ninera_id: ID.nBruno, nombre_completo: 'Bruno A. Inventado', telefono: '098000002', modelo_auto: 'Auto Inventado 1.0', created_at: '2026-10-02T13:00:00Z',
});
const R_MARIA = respuesta('c5000000-0000-4000-8000-000000000002', {
  nombre_completo: 'María Desconocida', telefono: '091 111 111', mail: 'maria@ejemplo.test', created_at: '2026-10-03T15:00:00Z',
});
function datosCon(respuestas, cambiar) {
  const d = datosBase();
  d.carsitting_datos = respuestas;
  if (cambiar) cambiar(d);
  return d;
}
async function abrirPanel(page) {
  await irAModulo(page, 'ninieras');
  const panel = page.locator('#nin-carsitting-wrap');
  const cabecera = panel.locator('.cs-cabecera');
  await expect(cabecera).toBeVisible();
  // Queda abierto al volver a Niñeras (como Temporadas): solo se toca si está cerrado.
  if (await cabecera.getAttribute('aria-expanded') !== 'true') await cabecera.click();
  await expect(panel.locator('.cs-texto')).toBeVisible();
  return panel;
}
const nombres = loc => loc.locator('.cs-nombre').allInnerTexts();
async function espiarPortapapeles(page, { falla = false } = {}) {
  await page.evaluate(f => {
    window.__copiado = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async t => { if (f) throw new Error('sin permiso'); window.__copiado.push(t); },
    } });
  }, falla);
}
async function espiarVentanas(page) {
  await page.evaluate(() => { window.__abiertas = []; window.open = u => { window.__abiertas.push(u); return null; }; });
}

test.describe('listas', () => {
  test('resumen, Completaron con la fecha, Faltan (primero las de traslados) y Sin identificar', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO, R_MARIA]) });
    await irAModulo(page, 'ninieras');
    const panel = page.locator('#nin-carsitting-wrap');
    await expect(panel.locator('.cs-resumen')).toContainText('1 de 3 completaron · 1 sin identificar');
    await expect(panel.locator('.cs-card')).toHaveClass(/cs-pendiente/);
    await panel.locator('.cs-cabecera').click();
    await expect(panel.locator('.cs-texto')).toContainText(LINK);
    expect(await nombres(panel.locator('#cs-completaron'))).toEqual(['Bruno Inventado']);
    await expect(panel.locator('#cs-completaron')).toContainText('Completó el 2 de octubre');
    expect(await nombres(panel.locator('#cs-faltan'))).toEqual(['Carla Ejemplo', 'Ana Ficticia']);
    await expect(panel.locator('#cs-faltan .cs-fila').first()).toContainText('Hace traslados');
    await expect(panel.locator('#cs-faltan .cs-fila').last()).toContainText('Niñera');
    await expect(panel.locator('#cs-sin-identificar')).toContainText('María Desconocida');
    await expect(panel.locator('#cs-sin-identificar')).toContainText('Respondió el 3 de octubre · 091 111 111 · maria@ejemplo.test');
    // La lista de niñeras sigue ahí abajo.
    await expect(page.locator('#ninierasgrid')).toContainText('Ana Ficticia');
    verificarLimpio(e);
  });

  test('"Hacen traslados" cuenta solo las de Traslados y Ambas', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO]) });
    const panel = await abrirPanel(page);
    await panel.getByRole('button', { name: 'Hacen traslados (2)' }).click();
    await expect(panel.locator('.cs-resumen')).toContainText('1 de 2 completaron');
    expect(await nombres(panel.locator('#cs-faltan'))).toEqual(['Carla Ejemplo']);
    await panel.getByRole('button', { name: 'Todas (3)' }).click();
    await expect(panel.locator('.cs-resumen')).toContainText('1 de 3 completaron');
    verificarLimpio(e);
  });

  test('sin ninguna respuesta: nadie completó, faltan todas', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await expect(panel.locator('.cs-resumen')).toContainText('0 de 3 completaron');
    await expect(panel.locator('#cs-completaron')).toContainText('Todavía no lo completó ninguna.');
    await expect(panel.locator('#cs-sin-identificar')).toHaveCount(0);
    verificarLimpio(e);
  });

  test('si completaron todas, Faltan lo dice y la tarjeta no queda marcada', async ({ page }) => {
    const todas = [ID.nAna, ID.nBruno, ID.nCarla].map((n, i) => respuesta(`c5000000-0000-4000-8000-00000000001${i}`, { ninera_id: n, nombre_completo: 'X' + i }));
    const e = await abrirApp(page, { datos: datosCon(todas) });
    const panel = await abrirPanel(page);
    await expect(panel.locator('.cs-resumen')).toContainText('3 de 3 completaron');
    await expect(panel.locator('#cs-faltan')).toContainText('Ya lo completaron todas.');
    await expect(panel.locator('.cs-card')).not.toHaveClass(/cs-pendiente/);
    verificarLimpio(e);
  });

  test('la ficha muestra los datos del auto aunque haya escrito otro nombre en el formulario', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO]) });
    await irAModulo(page, 'ninieras');
    await page.evaluate(id => verNinera(id), ID.nBruno);
    await expect(page.locator('#vn-carsitting')).toContainText('Datos de carsitting');
    await expect(page.locator('#vn-carsitting')).toContainText('Auto Inventado 1.0');
    verificarLimpio(e);
  });

  test('Postulantes: una niñera unida por celular ya no figura como pendiente de carsitting', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO]) });
    await irAModulo(page, 'rrhh');
    const card = page.locator('#rrhh-carsitting-pend');
    await card.getByText('Pendientes de carsitting').click();
    await expect(card).toContainText('Carla Ejemplo');
    await expect(card).not.toContainText('Bruno Inventado');
    verificarLimpio(e);
  });
});

test.describe('mensaje', () => {
  test('"Copiar mensaje" copia el texto entero, con el link y los saltos de línea', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await espiarPortapapeles(page);
    await panel.getByRole('button', { name: 'Copiar mensaje' }).click();
    await expect(page.locator('.toast').last()).toContainText('Mensaje copiado');
    const [copiado] = await page.evaluate(() => window.__copiado);
    expect(copiado).toContain(LINK);
    expect(copiado).toContain('\n\n');
    verificarLimpio(e);
  });

  test('sin permiso para el portapapeles: lo muestra entero para copiarlo a mano', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await espiarPortapapeles(page, { falla: true });
    await panel.getByRole('button', { name: 'Copiar mensaje' }).click();
    const cuadro = page.locator('textarea#copiar-a-mano');
    await expect(cuadro).toBeVisible();
    expect(await cuadro.inputValue()).toContain(LINK);
    expect(await cuadro.inputValue()).toContain('\n');
    verificarLimpio(e);
  });

  test('Editar y Guardar: queda guardado en la base y se ve en el panel', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await panel.getByRole('button', { name: 'Editar' }).click();
    const texto = `Hola chicas! Completen esto para los traslados:\n${LINK}`;
    await page.fill('#cs-mensaje-edit', texto);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.toast').last()).toContainText('Mensaje guardado');
    await expect(page.locator('#cs-mensaje-edit')).toHaveCount(0);
    await expect(panel.locator('.cs-texto')).toHaveText(texto);
    const w = e.escrituras.filter(x => x.tabla === 'app_config');
    expect(w).toHaveLength(1);
    expect(w[0].cuerpo).toMatchObject({ id: 'carsitting_mensaje', valor: { texto } });
    // Al volver a entrar se lee el guardado.
    await irAModulo(page, 'agenda');
    const panel2 = await abrirPanel(page);
    await expect(panel2.locator('.cs-texto')).toHaveText(texto);
    verificarLimpio(e);
  });

  test('"Volver al texto original" y guardar dos veces no duplica la fila', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([], d => { d.app_config = [{ id: 'carsitting_mensaje', valor: { texto: `Viejo ${LINK}` }, actualizado_at: '2026-10-01T00:00:00Z' }]; }) });
    const panel = await abrirPanel(page);
    await expect(panel.locator('.cs-texto')).toHaveText(`Viejo ${LINK}`);
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.getByRole('button', { name: 'Volver al texto original' }).click();
    expect(await page.inputValue('#cs-mensaje-edit')).toContain('Para hacer traslados con Parents’ Break');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.toast').last()).toContainText('Mensaje guardado');
    await expect(panel.locator('.cs-texto')).toContainText('Para hacer traslados');
    expect(e.db.app_config.filter(f => f.id === 'carsitting_mensaje')).toHaveLength(1);
    verificarLimpio(e);
  });

  test('vacío o sin el link no se guarda y lo dice', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.fill('#cs-mensaje-edit', '   ');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.toast').last()).toContainText('no puede quedar vacío');
    await page.fill('#cs-mensaje-edit', 'Hola, completen el formulario');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.toast').last()).toContainText('Falta el link');
    await expect(page.locator('#cs-mensaje-edit')).toBeVisible();
    expect(e.escrituras.filter(x => x.tabla === 'app_config')).toHaveLength(0);
    verificarLimpio(e);
  });

  test('si la base falla, avisa, no cierra y el panel sigue con el texto de antes', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    e.fallar = ({ tabla }) => (tabla === 'app_config' ? { status: 500, message: 'falla simulada' } : undefined);
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.fill('#cs-mensaje-edit', `Nuevo ${LINK}`);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.toast').last()).toContainText('No se pudo guardar el mensaje');
    await expect(page.locator('#cs-mensaje-edit')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(panel.locator('.cs-texto')).toContainText('Para hacer traslados');
    // Sin conexión, lo mismo.
    e.fallar = ({ tabla }) => (tabla === 'app_config' ? 'red' : undefined);
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.fill('#cs-mensaje-edit', `Nuevo ${LINK}`);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.toast').last()).toContainText('No se pudo guardar el mensaje');
    verificarLimpio(e, { ignorar: [/status of 500|Failed to load resource|\[Supabase\]/] });
  });

  test('doble toque en Guardar: una sola escritura', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.fill('#cs-mensaje-edit', `Doble ${LINK}`);
    e.demoraEscrituras = 400;
    await page.getByRole('button', { name: 'Guardar', exact: true }).dblclick();
    await expect(page.locator('.toast').last()).toContainText('Mensaje guardado');
    expect(e.escrituras.filter(x => x.tabla === 'app_config')).toHaveLength(1);
    verificarLimpio(e);
  });
});

test.describe('WhatsApp a una que falta', () => {
  test('abre WhatsApp con su celular y el mensaje', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await espiarVentanas(page);
    await panel.locator('#cs-faltan .cs-fila', { hasText: 'Carla Ejemplo' }).getByRole('button', { name: 'WhatsApp' }).click();
    const [url] = await page.evaluate(() => window.__abiertas);
    expect(url.startsWith('https://wa.me/59898000003?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toContain(LINK);
    verificarLimpio(e);
  });

  test('sin celular cargado: copia el mensaje y lo dice', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([], d => { d.ninieras[0].telefono = null; }) });
    const panel = await abrirPanel(page);
    await espiarVentanas(page);
    await espiarPortapapeles(page);
    const fila = panel.locator('#cs-faltan .cs-fila', { hasText: 'Ana Ficticia' });
    await expect(fila).toContainText('sin celular');
    await fila.getByRole('button', { name: 'WhatsApp' }).click();
    await expect(page.locator('.toast').last()).toContainText('Ana no tiene celular cargado');
    expect(await page.evaluate(() => window.__abiertas)).toEqual([]);
    expect((await page.evaluate(() => window.__copiado))[0]).toContain(LINK);
    verificarLimpio(e);
  });
});

test.describe('unir a mano una respuesta sin identificar', () => {
  test('elegir la niñera y Unir: queda unida y pasa a Completaron', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO, R_MARIA]) });
    const panel = await abrirPanel(page);
    await panel.locator(`#cs-unir-${R_MARIA.id}`).selectOption(ID.nAna);
    await panel.getByRole('button', { name: 'Unir' }).click();
    await expect(page.locator('.toast').last()).toContainText('quedó unida a Ana Ficticia');
    const w = e.escrituras.filter(x => x.tabla === 'carsitting_datos');
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ metodo: 'PATCH', params: { id: `eq.${R_MARIA.id}` }, cuerpo: { ninera_id: ID.nAna } });
    await expect(panel.locator('#cs-sin-identificar')).toHaveCount(0);
    await expect(panel.locator('.cs-resumen')).toContainText('2 de 3 completaron');
    expect(await nombres(panel.locator('#cs-completaron'))).toEqual(['Ana Ficticia', 'Bruno Inventado']);
    verificarLimpio(e);
  });

  test('sin elegir a nadie no escribe y lo dice', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_MARIA]) });
    const panel = await abrirPanel(page);
    await panel.getByRole('button', { name: 'Unir' }).click();
    await expect(page.locator('.toast').last()).toContainText('Elegí de quién es');
    expect(e.escrituras.filter(x => x.tabla === 'carsitting_datos')).toHaveLength(0);
    verificarLimpio(e);
  });

  test('si la base falla o no hay conexión, avisa y la respuesta sigue sin identificar', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_MARIA]) });
    const panel = await abrirPanel(page);
    e.fallar = ({ tabla }) => (tabla === 'carsitting_datos' ? { status: 500, message: 'falla simulada' } : undefined);
    await panel.locator(`#cs-unir-${R_MARIA.id}`).selectOption(ID.nCarla);
    await panel.getByRole('button', { name: 'Unir' }).click();
    await expect(page.locator('.toast').last()).toContainText('No se pudo unir la respuesta: falla simulada');
    await expect(panel.locator('#cs-sin-identificar')).toContainText('María Desconocida');
    e.fallar = ({ tabla }) => (tabla === 'carsitting_datos' ? 'red' : undefined);
    await panel.getByRole('button', { name: 'Unir' }).click();
    await expect(page.locator('.toast').last()).toContainText('Revisá tu conexión');
    await expect(panel.locator('.cs-resumen')).toContainText('0 de 3 completaron · 1 sin identificar');
    verificarLimpio(e, { ignorar: [/status of 500|Failed to load resource/] });
  });

  test('si la respuesta ya no existe, no muestra éxito', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_MARIA]) });
    const panel = await abrirPanel(page);
    e.db.carsitting_datos = []; // la borraron desde otro lado
    await panel.locator(`#cs-unir-${R_MARIA.id}`).selectOption(ID.nCarla);
    await panel.getByRole('button', { name: 'Unir' }).click();
    await expect(page.locator('.toast').last()).toContainText('No se encontró esa respuesta');
    verificarLimpio(e);
  });

  test('doble toque en Unir: una sola escritura', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_MARIA]) });
    const panel = await abrirPanel(page);
    await panel.locator(`#cs-unir-${R_MARIA.id}`).selectOption(ID.nCarla);
    e.demoraEscrituras = 400;
    await panel.getByRole('button', { name: 'Unir' }).dblclick();
    await expect(page.locator('.toast').last()).toContainText('quedó unida a Carla Ejemplo');
    expect(e.escrituras.filter(x => x.tabla === 'carsitting_datos')).toHaveLength(1);
    verificarLimpio(e);
  });
});

test.describe('se actualiza solo', () => {
  test('una respuesta nueva pasa a Completaron sin recargar la lista de niñeras', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO]) });
    const panel = await abrirPanel(page);
    let pedidosNinieras = 0;
    page.on('request', r => { if (r.method() === 'GET' && /\/rest\/v1\/ninieras\b/.test(r.url())) pedidosNinieras++; });
    const nueva = respuesta('c5000000-0000-4000-8000-000000000003', { ninera_id: ID.nCarla, nombre_completo: 'Carla Ejemplo', created_at: '2026-10-04T14:00:00Z' });
    e.db.carsitting_datos.push(nueva);
    expect(e.emitirRealtime('carsitting_datos', 'INSERT', nueva)).toBeGreaterThan(0);
    await expect(panel.locator('.cs-resumen')).toContainText('2 de 3 completaron');
    expect(await nombres(panel.locator('#cs-completaron'))).toEqual(['Carla Ejemplo', 'Bruno Inventado']);
    expect(pedidosNinieras).toBe(0);
    verificarLimpio(e);
  });

  test('con el mensaje a medio editar no se pisa: el cambio se aplica al cerrar', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([]) });
    const panel = await abrirPanel(page);
    await panel.getByRole('button', { name: 'Editar' }).click();
    await page.fill('#cs-mensaje-edit', `A medias ${LINK}`);
    const nueva = respuesta('c5000000-0000-4000-8000-000000000004', { ninera_id: ID.nAna, nombre_completo: 'Ana Ficticia' });
    e.db.carsitting_datos.push(nueva);
    e.emitirRealtime('carsitting_datos', 'INSERT', nueva);
    await page.waitForTimeout(1200);
    expect(await page.inputValue('#cs-mensaje-edit')).toBe(`A medias ${LINK}`);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(panel.locator('.cs-resumen')).toContainText('1 de 3 completaron');
    verificarLimpio(e);
  });
});

test.describe('fallos y bordes', () => {
  test('base sin la migración (sin celular ni mail): el panel anda igual', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO, { ...R_MARIA, telefono: undefined, mail: undefined }]), baseSinMigrar: true });
    const panel = await abrirPanel(page);
    await expect(panel.locator('.cs-resumen')).toContainText('1 de 3 completaron · 1 sin identificar');
    await expect(panel.locator('#cs-sin-identificar')).toContainText('María Desconocida');
    verificarLimpio(e, { ignorar: [/status of 400/] });
  });

  test('si no se pueden leer las respuestas: lo dice, la lista de niñeras anda y Reintentar lo trae', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO]) });
    await page.route(/\/rest\/v1\/carsitting_datos/, r => r.fulfill({ status: 500, json: { code: 'XX000', message: 'falla simulada' } }));
    await irAModulo(page, 'ninieras');
    const panel = page.locator('#nin-carsitting-wrap');
    await expect(panel).toContainText('No se pudieron leer las respuestas');
    await expect(page.locator('#ninierasgrid')).toContainText('Bruno Inventado');
    await page.unroute(/\/rest\/v1\/carsitting_datos/);
    await panel.getByRole('button', { name: 'Reintentar' }).click();
    await expect(panel.locator('.cs-resumen')).toContainText('1 de 3 completaron');
    verificarLimpio(e, { ignorar: [/status of 500/] });
  });

  test('datos tramposos del formulario: se muestran como texto y no se ejecuta nada', async ({ page }) => {
    const trampa = respuesta('c5000000-0000-4000-8000-000000000005', {
      nombre_completo: `<img src=x onerror="window.__xss=1">'); window.__xss=2; ('`,
      telefono: '"><script>window.__xss=3</script>', mail: "o'reilly@ejemplo.test",
    });
    const e = await abrirApp(page, { datos: datosCon([trampa], d => { d.ninieras[1].nombre = `Bruno "<b>X</b>"`; }) });
    const panel = await abrirPanel(page);
    await expect(panel.locator('#cs-sin-identificar')).toContainText('<img src=x');
    await expect(panel.locator('#cs-sin-identificar')).toContainText('<script>');
    await expect(panel.locator(`#cs-unir-${trampa.id} option`, { hasText: 'Bruno "<b>X</b>"' })).toHaveCount(1);
    await panel.locator(`#cs-unir-${trampa.id}`).selectOption(ID.nBruno);
    await panel.getByRole('button', { name: 'Unir' }).click();
    await expect(page.locator('.toast').last()).toContainText('quedó unida');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    verificarLimpio(e, { ignorar: [/ejemplo\.test|Failed to load resource/] });
  });

  test('celular de 390 px: nada se sale de la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const larga = respuesta('c5000000-0000-4000-8000-000000000006', { nombre_completo: 'María de los Ángeles Desconocida Larguísima del Valle', mail: 'un.mail.muy.largo.para.ver.si.entra@ejemplo.test', telefono: '091 111 111' });
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO, larga]) });
    const panel = await abrirPanel(page);
    await esperarQuieta(page);
    const ancho = await page.evaluate(() => {
      const caja = document.querySelector('#nin-carsitting-wrap .cs-card');
      return { pagina: document.documentElement.scrollWidth, caja: caja.scrollWidth, cajaVisible: caja.clientWidth };
    });
    expect(ancho.pagina).toBeLessThanOrEqual(390);
    expect(ancho.caja).toBeLessThanOrEqual(ancho.cajaVisible);
    await page.waitForTimeout(500); // que termine la animación de entrada del módulo
    await panel.screenshot({ path: 'test-results/carsitting-390.png' });
    verificarLimpio(e);
  });

  test('compu (1280 px): captura del panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const e = await abrirApp(page, { datos: datosCon([R_BRUNO, R_MARIA]) });
    const panel = await abrirPanel(page);
    await page.waitForTimeout(500);
    await panel.screenshot({ path: 'test-results/carsitting-1280.png' });
    verificarLimpio(e);
  });
});
