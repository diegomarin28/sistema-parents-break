// Errores de plata encontrados en la auditoría del 21/10/2026 (docs/rediseno-panel.md).
// - "Termina al día siguiente" con la hora de fin DESPUÉS de la de inicio: sumaba 24 h sin
//   avisar (20:00 a 22:00 se cobraba como 26 horas).
// - Editar un movimiento en Finanzas pisaba cobrado / pagado con lo que mostraba el formulario
//   al abrirse: si la otra admin lo había marcado mientras tanto, se desmarcaba.
// - Asignar una niñera a un pedido no miraba si alguien más ya lo había asignado: quedaban dos
//   niñeras y dos registros.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const AVISO_CRUCE = /Termina al día siguiente/;
const escriturasEn = (e, tabla, metodo) => e.escrituras.filter(x => x.tabla === tabla && (!metodo || x.metodo === metodo));
// Elige la hora como lo hace la persona: los dos selectores, que disparan el recálculo.
async function hora(page, prefijo, hhmm) {
  const [hh, mm] = hhmm.split(':');
  await page.selectOption(`#${prefijo}-hh`, hh);
  await page.selectOption(`#${prefijo}-mm`, mm);
}

test.describe('"Termina al día siguiente" con la hora de fin después de la de inicio', () => {
  test('la regla: con la casilla, el fin tiene que ser antes que el inicio (o igual: 24 h)', async ({ page }) => {
    const e = await abrirApp(page);
    const r = await page.evaluate(() => ({
      malMarcado: horasSitting('20:00', '22:00', true, null, '2026-10-03'),
      bienMarcado: horasSitting('20:00', '01:00', true, null, '2026-10-03')?.real,
      veinticuatro: horasSitting('20:00', '20:00', true, null, '2026-10-03')?.real,
      sinCasilla: horasSitting('20:00', '22:00', false, null, '2026-10-03')?.real,
      sinCasillaAlReves: horasSitting('22:00', '20:00', false, null, '2026-10-03'),
      detecta: [cruceMedianocheMalMarcado('20:00', '22:00', true), cruceMedianocheMalMarcado('20:00', '01:00', true), cruceMedianocheMalMarcado('20:00', '22:00', false), cruceMedianocheMalMarcado('20:00', '', true)],
    }));
    expect(r).toEqual({ malMarcado: null, bienMarcado: 5, veinticuatro: 24, sinCasilla: 2, sinCasillaAlReves: null, detecta: [true, false, false, false] });
    verificarLimpio(e);
  });

  test('Sittings: avisa al elegir la hora, no calcula 26 horas y no deja guardar', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'sittings');
    await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
    await page.fill('#sit-familia', 'Familia Prueba Uno');
    await page.fill('#sit-ninera', 'Carla Ejemplo');
    await page.evaluate(() => { onSitFamiliaInput(); onSitNineraInput(); });
    await page.fill('#sit-fecha', '2026-10-03');
    await page.check('#sit-cruza-medianoche');
    await hora(page, 'sit-horaini', '20:00');
    await hora(page, 'sit-horafin', '22:00');
    await expect(page.locator('#sit-fin-cobro')).toContainText(AVISO_CRUCE);
    // Familia Uno cobra $380 por hora: con 26 horas daba $9.880.
    await expect(page.locator('#sit-cobro')).toHaveValue('0');
    await expect(page.locator('#sit-pago')).toHaveValue('0');
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(page.locator('.toaststack .toast').last()).toContainText(AVISO_CRUCE);
    expect(e.escrituras).toEqual([]);
    // Desmarcando la casilla calcula las 2 horas y guarda.
    await page.uncheck('#sit-cruza-medianoche');
    await expect(page.locator('#sit-cobro')).toHaveValue('760');
    await expect(page.locator('#sit-fin-cobro')).not.toContainText(AVISO_CRUCE);
    verificarLimpio(e);
  });

  test('Agenda: un pedido nuevo con la casilla mal marcada avisa y no se guarda', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'agenda');
    await page.evaluate(() => abrirModalNuevaSolicitud());
    await page.fill('#agenda-familia', 'Familia Prueba Uno');
    await page.evaluate(() => onAgendaFamiliaInput());
    await page.fill('#agenda-cobro', '400');
    await hora(page, 'agenda-hora-inicio', '20:00');
    await hora(page, 'agenda-hora-fin', '22:00');
    await page.check('#agenda-cruza-medianoche');
    await expect(page.locator('#agenda-total-preview')).toContainText(AVISO_CRUCE);
    await page.locator('#editmodal button', { hasText: 'Guardar solicitud' }).click();
    await expect(page.locator('#agenda-nueva-warn')).toContainText(AVISO_CRUCE);
    expect(escriturasEn(e, 'solicitudes')).toEqual([]);
    verificarLimpio(e);
  });

  test('día de un fijo y su reemplazo: con la casilla mal marcada no se registra', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'agenda');
    const id = `asig:${ID.aFijo}@2026-10-05`;
    await page.evaluate(i => abrirModalSolicitud(i), id);
    // El fijo es de 16 a 19: con la casilla serían 27 horas.
    await page.check('#agenda-fija-cruza');
    await expect(page.locator('#agenda-fija-fin-cobro')).toContainText(AVISO_CRUCE);
    await page.locator('#editmodal button', { hasText: 'Registrar sitting de este día' }).click();
    await expect(page.locator('#agenda-fija-horario-warn')).toContainText(AVISO_CRUCE);
    expect(escriturasEn(e, 'sittings_traslados')).toEqual([]);
    // Reemplazo: el mismo control.
    await page.evaluate(i => { mostrarExcepcionAsignacionFija(i); mostrarReemplazoFijoHoy(i); }, id);
    await page.fill('#agenda-fija-reemplazo-ninera', 'Carla Ejemplo');
    await page.check('#agenda-fija-rcruza');
    await page.locator('#editmodal button', { hasText: 'Registrar reemplazo' }).click();
    await expect(page.locator('#agenda-fija-reemplazo-warn')).toContainText(AVISO_CRUCE);
    expect(escriturasEn(e, 'sittings_traslados')).toEqual([]);
    verificarLimpio(e);
  });
});

test.describe('Finanzas → editar un movimiento no pisa cobrado / pagado de otra', () => {
  const ID_SEP28 = '70000000-0000-4000-8000-000000000003'; // 28/09, sin cobrar ni pagar
  async function abrirMovimiento(page, id) {
    await irAModulo(page, 'finanzas');
    await page.evaluate(async () => { finMes = '2026-09'; await cargarFinanzas(); });
    await esperarQuieta(page);
    await page.evaluate(i => editarMovimientoSitting(i), id);
  }

  test('cambiar solo el monto no manda cobrado ni pagado: lo que marcó la otra queda', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirMovimiento(page, ID_SEP28);
    // Mientras tanto, desde otro celular, lo marcan como cobrado.
    e.db.sittings_traslados.find(r => r.id === ID_SEP28).cobrado = true;
    await page.fill('#fin-mov-cobro', '1200');
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const [w] = escriturasEn(e, 'sittings_traslados', 'PATCH');
    expect(w.cuerpo).toEqual({ cobro_familia: 1200, pago_ninera: 750 });
    expect(e.db.sittings_traslados.find(r => r.id === ID_SEP28)).toMatchObject({ cobro_familia: 1200, cobrado: true, pagado: false });
    verificarLimpio(e);
  });

  test('tildar "Ya se cobró" cuando otra ya lo cambió: avisa y no guarda nada', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirMovimiento(page, ID_SEP28);
    e.db.sittings_traslados.find(r => r.id === ID_SEP28).cobrado = true;
    await page.fill('#fin-mov-cobro', '1200');
    await page.check('#fin-mov-cobrado');
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    await expect(page.locator('#fin-mov-warn')).toContainText('alguien más');
    await expect(page.locator('#editmodal')).toHaveCount(1);
    expect(e.db.sittings_traslados.find(r => r.id === ID_SEP28)).toMatchObject({ cobro_familia: 1140, cobrado: true });
    verificarLimpio(e);
  });

  test('tildar "Ya se cobró" sin conflicto: se guarda con la condición del estado de antes', async ({ page }) => {
    const e = await abrirApp(page);
    await abrirMovimiento(page, ID_SEP28);
    await page.check('#fin-mov-cobrado');
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const [w] = escriturasEn(e, 'sittings_traslados', 'PATCH');
    expect(w.cuerpo).toEqual({ cobro_familia: 1140, pago_ninera: 750, cobrado: true });
    expect(w.params).toMatchObject({ id: `eq.${ID_SEP28}`, cobrado: 'eq.false' });
    expect(e.db.sittings_traslados.find(r => r.id === ID_SEP28).cobrado).toBe(true);
    verificarLimpio(e);
  });
});

test.describe('Agenda → asignar niñera a un pedido que ya asignó otra', () => {
  const SOL = '80000000-0000-4000-8000-000000000001'; // Familia Dos, martes 06/10, 20 a 23, sin asignar
  async function elegirNinera(page) {
    await irAModulo(page, 'agenda');
    await page.evaluate(i => abrirModalAsignar(i), SOL);
    await page.locator('#editmodal input[name="agenda-asignar-ninera"]:visible').first().check();
    await expect(page.locator('#agenda-asignar-pago')).toBeVisible();
  }
  const guardar = page => page.locator('#editmodal button', { hasText: 'Guardar asignación' }).click();

  test('normal: toma el pedido con la condición de que siga sin asignar y carga todo', async ({ page }) => {
    const e = await abrirApp(page);
    await elegirNinera(page);
    await guardar(page);
    await expect(page.locator('.toaststack .toast').last()).toContainText('Asignado');
    const [toma] = escriturasEn(e, 'solicitudes', 'PATCH');
    expect(toma.params.estado).toBe('in.(sin_asignar,pendiente_confirmar)');
    expect(e.db.solicitudes.find(s => s.id === SOL).estado).toBe('confirmada');
    expect(escriturasEn(e, 'solicitud_ninieras', 'POST')).toHaveLength(1);
    expect(escriturasEn(e, 'sittings_traslados', 'POST')).toHaveLength(1);
    verificarLimpio(e);
  });

  test('si mientras elegía otra admin lo asignó, avisa y no carga una segunda niñera', async ({ page }) => {
    const e = await abrirApp(page);
    await elegirNinera(page);
    e.db.solicitudes.find(s => s.id === SOL).estado = 'confirmada';
    await guardar(page);
    await expect(page.locator('#agenda-asignar-warn')).toContainText('alguien más');
    expect(escriturasEn(e, 'solicitud_ninieras')).toEqual([]);
    expect(escriturasEn(e, 'sittings_traslados')).toEqual([]);
    verificarLimpio(e);
  });

  test('si falla guardar la niñera, el pedido vuelve a quedar sin asignar', async ({ page }) => {
    const e = await abrirApp(page);
    await elegirNinera(page);
    e.fallar = ({ tabla, metodo }) => (tabla === 'solicitud_ninieras' && metodo === 'POST' ? { status: 500, message: 'falla simulada' } : undefined);
    await guardar(page);
    await expect(page.locator('#agenda-asignar-warn')).toContainText('falla simulada');
    expect(e.db.solicitudes.find(s => s.id === SOL).estado).toBe('sin_asignar');
    expect(escriturasEn(e, 'sittings_traslados')).toEqual([]);
    verificarLimpio(e, { ignorar: [/500/] });
  });
});
