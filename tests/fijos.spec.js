// Fijos con vigencia (PR 2, 05/10/2026): la Agenda los dibuja solo entre vigente_desde y
// vigente_hasta, cambiar la niñera es "desde una fecha" y lo registrado desde un fijo queda
// vinculado a su asignación con el tipo correcto.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const ASIG_TRASLADO = '40000000-0000-4000-8000-000000000002';

async function verAgendaDesde(page, fechaISO) {
  await page.evaluate(async f => { agendaAncla = f; await cargarAgendaSolicitudes(); }, fechaISO);
  await esperarQuieta(page);
}
// Lo que la Agenda calcula para dibujar (las tarjetas no muestran el nombre de la niñera).
const fijosProyectados = page => page.evaluate(() => agendaSolicitudes
  .filter(s => s._fuente === 'asignacion')
  .map(s => `${s.fecha} ${s.ninieras[0].ninera_nombre}`));

async function cambiarNinera(page, asigId, fechaCard, nueva, desde) {
  await page.evaluate(([id, f]) => abrirModalSolicitud(`asig:${id}@${f}`), [asigId, fechaCard]);
  await page.locator(`#agenda-fija-ninera-${asigId}`).fill(nueva);
  await page.locator('#editmodal .autocomplete-item', { hasText: nueva }).click();
  if (desde) await page.fill(`#agenda-fija-desde-${asigId}`, desde);
  await page.locator(`#agenda-fija-guardar-${asigId}`).click();
}

test.describe('vigencia de los fijos en la Agenda', () => {
  test('un fijo se dibuja solo entre su fecha de inicio y de fin', async ({ page }) => {
    const datos = datosBase();
    datos.asignaciones.push({ id: '40000000-0000-4000-8000-000000000009', familia_id: ID.fDos, ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo',
      dias: ['M', 'J'], hora_inicio: '10:00:00', hora_fin: '12:00:00', vigente_desde: '2026-09-17', vigente_hasta: '2026-09-24', tipo: 'sitting', created_at: '2026-09-17T00:00:00Z' });
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'agenda');
    const carla = async () => (await fijosProyectados(page)).filter(x => x.includes('Carla'));
    await verAgendaDesde(page, '2026-09-14');
    expect(await carla()).toEqual(['2026-09-17 Carla Ejemplo']); // el martes 15 es antes de que empiece
    await verAgendaDesde(page, '2026-09-21');
    expect(await carla()).toEqual(['2026-09-22 Carla Ejemplo', '2026-09-24 Carla Ejemplo']);
    await verAgendaDesde(page, '2026-09-28');
    expect(await carla()).toEqual([]); // ya terminó
    verificarLimpio(e);
  });

  test('un fijo viejo sin fecha de inicio se sigue dibujando (base antes de la migración)', async ({ page }) => {
    const datos = datosBase();
    const { vigente_desde, vigente_hasta, tipo, ...sinColumnas } = datos.asignaciones[0];
    datos.asignaciones = [sinColumnas];
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-09-21');
    expect(await fijosProyectados(page)).toEqual(['2026-09-21 Ana Ficticia', '2026-09-23 Ana Ficticia']);
    verificarLimpio(e);
  });
});

test.describe('cambiar la niñera de un fijo desde una fecha', () => {
  test('cierra la asignación vieja el día anterior y abre una nueva desde esa fecha', async ({ page }) => {
    const e = await abrirApp(page); // hoy = 04/10/2026
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-10-05');
    await cambiarNinera(page, ID.aFijo, '2026-10-05', 'Carla Ejemplo', '2026-10-01');
    await expect(page.locator('#editmodal')).toHaveCount(0);

    const alta = e.escrituras.find(w => w.tabla === 'asignaciones' && w.metodo === 'POST');
    expect(alta.cuerpo).toMatchObject({ familia_id: ID.fUno, ninera_nombre: 'Carla Ejemplo', ninera_id: ID.nCarla, dias: ['L', 'X'],
      hora_inicio: '16:00:00', hora_fin: '19:00:00', tipo: 'sitting', vigente_desde: '2026-10-01', vigente_hasta: null });
    const cierre = e.escrituras.find(w => w.tabla === 'asignaciones' && w.metodo === 'PATCH');
    expect(cierre.params).toEqual({ id: `eq.${ID.aFijo}` });
    expect(cierre.cuerpo).toEqual({ vigente_hasta: '2026-09-30' });
    // Nunca se pisa el nombre de la asignación vieja (eso era lo que reescribía el pasado).
    expect(e.escrituras.some(w => w.tabla === 'asignaciones' && w.metodo === 'PATCH' && w.cuerpo.ninera_nombre)).toBe(false);

    await verAgendaDesde(page, '2026-09-28');
    expect(await fijosProyectados(page)).toEqual(['2026-09-30 Ana Ficticia']); // el 28 ya está registrado
    await verAgendaDesde(page, '2026-10-05');
    expect(await fijosProyectados(page)).toEqual(['2026-10-05 Carla Ejemplo', '2026-10-07 Carla Ejemplo']);
    verificarLimpio(e);
  });

  test('por defecto el cambio es desde hoy', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-10-06T10:00:00-03:00' });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-10-05');
    await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-10-07`), ID.aFijo);
    await expect(page.locator(`#agenda-fija-desde-${ID.aFijo}`)).toHaveValue('2026-10-06');
    verificarLimpio(e);
  });

  test('si la fecha es el primer día del fijo, cambia la niñera ahí mismo (no hay pasado que cuidar)', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-10-05');
    await cambiarNinera(page, ID.aFijo, '2026-10-05', 'Carla Ejemplo', '2026-09-01');
    await expect(page.locator('#editmodal')).toHaveCount(0);
    expect(e.escrituras.filter(w => w.tabla === 'asignaciones').map(w => [w.metodo, w.cuerpo])).toEqual([
      ['PATCH', { ninera_nombre: 'Carla Ejemplo', ninera_id: ID.nCarla }],
    ]);
    verificarLimpio(e);
  });

  test('no deja elegir la misma niñera ni una fecha posterior al fin del fijo', async ({ page }) => {
    const datos = datosBase();
    datos.asignaciones[0].vigente_hasta = '2026-10-31';
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-10-05');
    await cambiarNinera(page, ID.aFijo, '2026-10-05', 'Ana Ficticia');
    await expect(page.locator('#agenda-fija-warn')).toContainText('Esa ya es la niñera');
    // El autocompletar esconde su lista 150 ms después de perder el foco (al tocar Guardar):
    // se espera a que pase para no escribir encima de ese temporizador.
    await page.waitForTimeout(200);
    await page.locator(`#agenda-fija-ninera-${ID.aFijo}`).fill('Carla Ejemplo');
    await page.locator('#editmodal .autocomplete-item', { hasText: 'Carla Ejemplo' }).click();
    await page.fill(`#agenda-fija-desde-${ID.aFijo}`, '2026-11-02');
    await page.locator(`#agenda-fija-guardar-${ID.aFijo}`).click();
    await expect(page.locator('#agenda-fija-warn')).toContainText('termina el 2026-10-31');
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });
});

test('la tarjeta de un fijo que ya terminó no ofrece cambiar la niñera ni borrarlo', async ({ page }) => {
  const datos = datosBase();
  datos.asignaciones[0].vigente_hasta = '2026-09-28';
  const e = await abrirApp(page, { datos });
  await irAModulo(page, 'agenda');
  await verAgendaDesde(page, '2026-09-21');
  await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-09-21`), ID.aFijo);
  const modal = page.locator('#editmodal');
  await expect(modal).toContainText('Este fijo terminó el 28/09/26');
  await expect(modal.locator(`#agenda-fija-guardar-${ID.aFijo}`)).toHaveCount(0);
  await expect(modal.locator('button', { hasText: 'Terminar este fijo' })).toHaveCount(0);
  await expect(modal.locator('button', { hasText: 'Editar vigencia y tipo' })).toHaveCount(1);
  await expect(modal.locator('button', { hasText: 'Registrar sitting de este día' })).toHaveCount(1);
  verificarLimpio(e);
});

test.describe('registrar un día de un fijo', () => {
  test('un fijo de traslados se registra como traslado, vinculado a su asignación, con el precio del último traslado', async ({ page }) => {
    const datos = datosBase();
    datos.asignaciones.push({ id: ASIG_TRASLADO, familia_id: ID.fDos, ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado',
      dias: ['M', 'J'], hora_inicio: '08:00:00', hora_fin: '08:30:00', vigente_desde: '2026-09-01', vigente_hasta: null, tipo: 'traslado', created_at: '2026-09-01T00:00:00Z' });
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-09-28');
    await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-09-29`), ASIG_TRASLADO);
    // Precargado con el último traslado de esa familia (19/09: $450 / $250).
    await expect(page.locator('#agenda-fija-cobro')).toHaveValue('450');
    await expect(page.locator('#agenda-fija-pago')).toHaveValue('250');
    await page.fill('#agenda-fija-cobro', '480');
    await page.locator('#editmodal button', { hasText: 'Registrar traslado de este día' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const alta = e.escrituras.find(w => w.tabla === 'sittings_traslados' && w.metodo === 'POST');
    expect(alta.cuerpo).toMatchObject({ tipo: 'traslado', asignacion_id: ASIG_TRASLADO, ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado',
      fecha: '2026-09-29', cobro_familia: 480, pago_ninera: 250 });
    // Ese día ya queda cubierto en la Agenda.
    expect(await fijosProyectados(page)).not.toContain('2026-09-29 Bruno Inventado');
    verificarLimpio(e);
  });

  test('un reemplazo vinculado al fijo cubre el día aunque haya ido otra niñera', async ({ page }) => {
    const datos = datosBase();
    datos.sittings_traslados.push({ ...datos.sittings_traslados[0], id: '70000000-0000-4000-8000-000000000010', fecha: '2026-09-30',
      ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', asignacion_id: ID.aFijo, cobrado: false, pagado: false, notas: 'Reemplazo de Ana Ficticia' });
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-09-28');
    expect(await fijosProyectados(page)).toEqual([]); // 28 registrado por Ana, 30 por la reemplazante
    verificarLimpio(e);
  });
});

test.describe('vigencia editable desde la app', () => {
  test('desde la ficha de la familia se corrige "desde", "hasta" y el tipo', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await expect(page.locator('#editmodal')).toContainText('desde el 01/09/26');
    await page.locator(`#editmodal button[onclick="abrirModalVigenciaAsignacion(\\"${ID.aFijo}\\")"]`).click();
    await expect(page.locator('#vig-desde')).toHaveValue('2026-09-01');
    await page.fill('#vig-desde', '2026-09-09');
    await page.fill('#vig-hasta', '2026-12-20');
    await page.selectOption('#vig-tipo', 'traslado');
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    // Al guardar se vuelve a la ficha de la familia, ya con la vigencia nueva.
    await expect(page.locator('#vig-desde')).toHaveCount(0);
    await expect(page.locator('#editmodal')).toContainText('del 09/09/26 al 20/12/26');
    const cambio = e.escrituras.find(w => w.tabla === 'asignaciones' && w.metodo === 'PATCH');
    expect(cambio.cuerpo).toEqual({ vigente_desde: '2026-09-09', vigente_hasta: '2026-12-20', tipo: 'traslado' });
    verificarLimpio(e);
  });

  test('no acepta "hasta" antes que "desde"', async ({ page }) => {
    const e = await abrirApp(page);
    await page.evaluate(id => abrirModalVigenciaAsignacion(id), ID.aFijo);
    await expect(page.locator('#vig-desde')).toHaveValue('2026-09-01');
    await page.fill('#vig-hasta', '2026-08-01');
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    await expect(page.locator('#vig-warn')).toContainText('no puede ser antes');
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });

  test('un fijo nuevo desde la Agenda se guarda con tipo, fecha de inicio y niñera', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'agenda');
    await page.locator('button[onclick^="abrirModalNuevaSolicitud"]').first().click();
    await page.fill('#agenda-familia', 'Familia Prueba Dos');
    await page.locator('#agenda-familia-dropdown .autocomplete-item', { hasText: 'Familia Prueba Dos' }).click();
    await page.locator('#agenda-modo-repetir-btn').click();
    await page.fill('#agenda-repetir-ninera', 'Carla Ejemplo');
    await page.locator('#editmodal .autocomplete-item', { hasText: 'Carla Ejemplo' }).click();
    await page.selectOption('#agenda-repetir-tipo', 'traslado');
    await expect(page.locator('#agenda-repetir-desde')).toHaveValue('2026-10-04');
    await page.locator('#agenda-repetir-dias .daybtn[data-dia="V"]').click();
    await page.locator('#editmodal button', { hasText: 'Guardar solicitud' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const alta = e.escrituras.find(w => w.tabla === 'asignaciones' && w.metodo === 'POST');
    expect(alta.cuerpo).toEqual([expect.objectContaining({ familia_id: ID.fDos, ninera_nombre: 'Carla Ejemplo', ninera_id: ID.nCarla,
      tipo: 'traslado', vigente_desde: '2026-10-04', dias: ['V'] })]);
    verificarLimpio(e);
  });
});

test.describe('historial de cambios de un sitting', () => {
  test('al editar un sitting se ve quién cambió qué y cuándo', async ({ page }) => {
    const datos = datosBase();
    datos.sittings_historial = [
      { id: 2, sitting_id: '70000000-0000-4000-8000-000000000002', accion: 'cambio', usuario: 'delfina@ejemplo.test', cuando: '2026-09-29T21:38:27Z',
        cambios: { pagado: { antes: false, despues: true }, notas: { antes: null, despues: '<b>ojo</b>' } }, fila: null },
      { id: 1, sitting_id: '70000000-0000-4000-8000-000000000002', accion: 'alta', usuario: 'paulina@ejemplo.test', cuando: '2026-09-16T22:00:00Z', cambios: null, fila: {} },
    ];
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => abrirModalSitForm(id), '70000000-0000-4000-8000-000000000002');
    await page.locator('#sit-historial-box button', { hasText: 'Historial de cambios' }).click();
    const box = page.locator('#sit-historial-box');
    await expect(box).toContainText('delfina@ejemplo.test');
    await expect(box).toContainText('Pagado: No → Sí');
    await expect(box).toContainText('Notas: — → <b>ojo</b>'); // texto escapado, no HTML
    await expect(box).toContainText('Creó el registro.');
    verificarLimpio(e);
  });

  test('un sitting nuevo no muestra el botón de historial', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'sittings');
    await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
    await expect(page.locator('#editmodal')).toBeVisible();
    await expect(page.locator('#sit-historial-box')).toHaveCount(0);
    verificarLimpio(e);
  });
});

test.describe('app nueva con la base todavía sin migrar', () => {
  // Por si el PR se publicara antes de correr la migración: nada se tiene que romper.
  const sinMigrar = () => {
    const datos = datosBase();
    datos.asignaciones = datos.asignaciones.map(({ vigente_desde, vigente_hasta, tipo, ...a }) => a);
    return datos;
  };

  test('crear un fijo reintenta sin vigencia y lo guarda igual', async ({ page }) => {
    const e = await abrirApp(page, { datos: sinMigrar(), baseSinMigrar: true });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fDos);
    await page.fill(`#asig-nombre-${ID.fDos}`, 'Carla Ejemplo');
    await page.locator(`#asig-dias-${ID.fDos} .daybtn`, { hasText: 'V' }).click();
    await page.locator('#editmodal button', { hasText: '+ Asignar niñera' }).click();
    await expect(page.locator('#editmodal')).toContainText('Carla Ejemplo');
    const altas = e.escrituras.filter(w => w.tabla === 'asignaciones' && w.metodo === 'POST');
    expect(altas.at(-1).cuerpo).toEqual(expect.objectContaining({ ninera_nombre: 'Carla Ejemplo', familia_id: ID.fDos }));
    expect(altas.at(-1).cuerpo).not.toHaveProperty('vigente_desde');
    expect(e.rechazadas).toBe(1);
    // 404: tablas nuevas (saldo a favor) que la base sin migrar todavía no tiene.
    verificarLimpio(e, { ignorar: [/status of 400/, /status of 404/] });
  });

  test('cambiar la niñera vuelve al cambio en el mismo lugar (como antes)', async ({ page }) => {
    const e = await abrirApp(page, { datos: sinMigrar(), baseSinMigrar: true });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-10-05');
    await cambiarNinera(page, ID.aFijo, '2026-10-05', 'Carla Ejemplo');
    await expect(page.locator('#editmodal')).toHaveCount(0);
    expect(e.escrituras.filter(w => w.tabla === 'asignaciones').map(w => w.metodo)).toEqual(['PATCH']);
    verificarLimpio(e);
  });

  test('el historial avisa que todavía no está activado', async ({ page }) => {
    const e = await abrirApp(page, { baseSinMigrar: true });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => abrirModalSitForm(id), '70000000-0000-4000-8000-000000000002');
    await page.locator('#sit-historial-box button').click();
    await expect(page.locator('#sit-historial-box')).toContainText('todavía no está activado');
    verificarLimpio(e, { ignorar: [/status of 404/] });
  });
});
