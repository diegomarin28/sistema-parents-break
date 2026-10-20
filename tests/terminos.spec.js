// Términos y condiciones (20/10/2026). La admin marca en la ficha que la familia los aceptó y
// desde qué fecha; desde ese día el fin de cada sitting se le cobra redondeado a la media hora
// siguiente con 5 minutos de tolerancia, y a la niñera se le paga la hora real. La misma regla
// en la base (generar_previstos_fijos) se prueba en supabase/pruebas/terminos_redondeo.sql.
// Hoy en los tests = domingo 04/10/2026. Familia Prueba Uno: $380 / $250 por hora.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const escrituras = (e, tabla, metodo) => e.escrituras.filter(w => w.tabla === tabla && w.metodo === metodo);
const toasts = page => page.locator('.toaststack .toast');
function datosConTerminos(desde = '2026-10-01') {
  const d = datosBase();
  d.familias.find(f => f.id === ID.fUno).terminos_aceptados_el = desde;
  return d;
}
// Elige la hora como lo hace la persona: los dos selectores, que disparan el recálculo.
async function hora(page, prefijo, hhmm) {
  const [hh, mm] = hhmm.split(':');
  await page.selectOption(`#${prefijo}-hh`, hh);
  await page.selectOption(`#${prefijo}-mm`, mm);
}
async function nuevoSitting(page, { familia = 'Familia Prueba Uno', fecha = '2026-10-03', ini, fin, cruza = false }) {
  await irAModulo(page, 'sittings');
  await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
  await page.fill('#sit-familia', familia);
  await page.fill('#sit-ninera', 'Carla Ejemplo');
  await page.evaluate(() => { onSitFamiliaInput(); onSitNineraInput(); });
  await page.fill('#sit-fecha', fecha);
  if (cruza) await page.check('#sit-cruza-medianoche');
  await hora(page, 'sit-horaini', ini);
  await hora(page, 'sit-horafin', fin);
}

test.describe('la regla del redondeo (una sola, en core.js)', () => {
  test('bordes: 17:04, 17:05, 17:06, 17:35, 17:36, medianoche y familia sin la casilla', async ({ page }) => {
    const e = await abrirApp(page);
    const r = await page.evaluate(() => {
      const acepto = { terminos_aceptados_el: '2026-10-01' };
      const fin = (hf, extra = {}) => {
        const h = horasSitting(extra.ini || '14:00', hf, !!extra.cruza, 'familia' in extra ? extra.familia : acepto, extra.fecha || '2026-10-03');
        return { cobro: h.cobro, real: h.real, finCobro: h.finCobro, texto: textoFinCobrado(hf, h) };
      };
      return {
        f1700: fin('17:00'), f1704: fin('17:04'), f1705: fin('17:05'), f1706: fin('17:06'), f1730: fin('17:30'),
        f1735: fin('17:35'), f1736: fin('17:36'),
        f2336: fin('23:36', { ini: '20:00' }),
        cruza: fin('01:06', { ini: '22:00', cruza: true }),
        cruzaTolerancia: fin('00:05', { ini: '22:00', cruza: true }),
        sinCasilla: fin('17:36', { familia: { terminos_aceptados_el: null } }),
        sinFamilia: fin('17:36', { familia: null }),
        antesDeAceptar: fin('17:36', { fecha: '2026-09-30' }),
        elMismoDia: fin('17:36', { fecha: '2026-10-01' }),
        incompleto: horasSitting('14:00', '', false, acepto, '2026-10-03'),
        finAntes: horasSitting('14:00', '13:00', false, acepto, '2026-10-03'),
      };
    });
    expect(r.f1700).toEqual({ cobro: 3, real: 3, finCobro: null, texto: '' });
    expect(r.f1704).toMatchObject({ cobro: 3, finCobro: '17:00', texto: 'Hora real 17:04, se cobra hasta 17:00' });
    expect(r.f1705).toMatchObject({ cobro: 3, finCobro: '17:00' });
    expect(r.f1706).toMatchObject({ cobro: 3.5, finCobro: '17:30' });
    expect(r.f1730).toMatchObject({ cobro: 3.5, finCobro: null });
    expect(r.f1735).toMatchObject({ cobro: 3.5, finCobro: '17:30' });
    expect(r.f1736).toMatchObject({ cobro: 4, real: 3.6, finCobro: '18:00', texto: 'Hora real 17:36, se cobra hasta 18:00' });
    expect(r.f2336).toMatchObject({ cobro: 4, real: 3.6, finCobro: '00:00', texto: 'Hora real 23:36, se cobra hasta 00:00' });
    expect(r.cruza).toMatchObject({ cobro: 3.5, real: 3.1, finCobro: '01:30', texto: 'Hora real 01:06, se cobra hasta 01:30' });
    expect(r.cruzaTolerancia).toMatchObject({ cobro: 2, finCobro: '00:00' });
    for (const k of ['sinCasilla', 'sinFamilia', 'antesDeAceptar']) expect(r[k], k).toMatchObject({ cobro: 3.6, real: 3.6, finCobro: null, texto: '' });
    expect(r.elMismoDia).toMatchObject({ cobro: 4 });
    expect(r.incompleto).toBeNull();
    expect(r.finAntes).toBeNull();
    verificarLimpio(e);
  });
});

test.describe('ficha de la familia: casilla "Aceptó términos y condiciones"', () => {
  test('marcarla guarda la fecha (hoy por defecto) y la ficha la muestra', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    const box = page.locator('#fam-terminos');
    await expect(page.locator('#fam-terminos-chk')).not.toBeChecked();
    await expect(page.locator('#fam-terminos-guardar')).toBeHidden();
    await page.check('#fam-terminos-chk');
    await expect(page.locator('#fam-terminos-fecha')).toHaveValue('2026-10-04');
    await page.locator('#fam-terminos-guardar').click();
    await expect(toasts(page).filter({ hasText: 'aceptó los términos' })).toBeVisible();
    const [cambio] = escrituras(e, 'familias', 'PATCH');
    expect(cambio.cuerpo).toEqual({ terminos_aceptados_el: '2026-10-04' });
    expect(cambio.params).toMatchObject({ id: `eq.${ID.fUno}` });
    await expect(box).toContainText('Desde el 04/10/2026');
    await expect(page.locator('#fam-terminos-chk')).toBeChecked();
    await expect(page.locator('#fam-terminos-guardar')).toBeHidden();
    verificarLimpio(e);
  });

  test('cambiar la fecha o sacar la marca también se guarda', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos('2026-10-01') });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await expect(page.locator('#fam-terminos')).toContainText('Desde el 01/10/2026');
    await page.fill('#fam-terminos-fecha', '2026-09-15');
    await page.locator('#fam-terminos-guardar').click();
    await expect(page.locator('#fam-terminos')).toContainText('Desde el 15/09/2026');
    await page.uncheck('#fam-terminos-chk');
    await expect(page.locator('#fam-terminos-fecha-wrap')).toBeHidden();
    await page.locator('#fam-terminos-guardar').click();
    await expect(toasts(page).filter({ hasText: 'se sacó la marca' })).toBeVisible();
    expect(escrituras(e, 'familias', 'PATCH').map(w => w.cuerpo.terminos_aceptados_el)).toEqual(['2026-09-15', null]);
    await expect(page.locator('#fam-terminos-chk')).not.toBeChecked();
    verificarLimpio(e);
  });

  test('marcada sin fecha no se guarda', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await page.check('#fam-terminos-chk');
    await page.fill('#fam-terminos-fecha', '');
    await page.locator('#fam-terminos-guardar').click();
    await expect(toasts(page).filter({ hasText: 'Poné la fecha' })).toBeVisible();
    expect(escrituras(e, 'familias', 'PATCH')).toEqual([]);
    verificarLimpio(e);
  });

  test('si la base falla avisa y no la da por marcada', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    e.fallar = ({ tabla, metodo }) => (tabla === 'familias' && metodo === 'PATCH' ? { message: 'falla simulada' } : undefined);
    await page.check('#fam-terminos-chk');
    await page.locator('#fam-terminos-guardar').click();
    await expect(toasts(page).filter({ hasText: 'No se pudo guardar: falla simulada' })).toBeVisible();
    await expect(toasts(page).filter({ hasText: 'aceptó los términos' })).toHaveCount(0);
    expect(await page.evaluate(id => familiasItems.find(f => f.id === id).terminos_aceptados_el, ID.fUno)).toBeNull();
    await expect(page.locator('#fam-terminos-guardar')).toBeVisible(); // se puede reintentar
    verificarLimpio(e, { ignorar: [/status of 500/] });
  });

  test('doble toque en Guardar: una sola escritura', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await page.check('#fam-terminos-chk');
    e.demoraEscrituras = 400;
    await page.locator('#fam-terminos-guardar').dblclick();
    await expect(toasts(page).filter({ hasText: 'aceptó los términos' })).toBeVisible();
    expect(escrituras(e, 'familias', 'PATCH')).toHaveLength(1);
    verificarLimpio(e);
  });
});

test.describe('registro en Sittings: "Hora real 17:36, se cobra hasta 18:00"', () => {
  test('familia que aceptó: cobro hasta las 18:00, pago a la niñera con la hora real', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos() });
    await nuevoSitting(page, { ini: '14:00', fin: '17:36' });
    await expect(page.locator('#sit-fin-cobro')).toHaveText('Hora real 17:36, se cobra hasta 18:00');
    await expect(page.locator('#sit-cobro')).toHaveValue('1520'); // 4 h a $380
    await expect(page.locator('#sit-pago')).toHaveValue('900'); // 3,6 h a $250
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const [alta] = escrituras(e, 'sittings_traslados', 'POST');
    expect(alta.cuerpo).toMatchObject({ hora_inicio: '14:00', hora_fin: '17:36', cobro_familia: 1520, pago_ninera: 900 });
    verificarLimpio(e);
  });

  test('17:05 y 17:35 entran en la tolerancia; 17:06 ya es la media hora siguiente', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos() });
    await nuevoSitting(page, { ini: '14:00', fin: '17:05' });
    await expect(page.locator('#sit-fin-cobro')).toHaveText('Hora real 17:05, se cobra hasta 17:00');
    await expect(page.locator('#sit-cobro')).toHaveValue('1140');
    await expect(page.locator('#sit-pago')).toHaveValue('771'); // 3 h 05 a $250
    await hora(page, 'sit-horafin', '17:06');
    await expect(page.locator('#sit-fin-cobro')).toHaveText('Hora real 17:06, se cobra hasta 17:30');
    await expect(page.locator('#sit-cobro')).toHaveValue('1330');
    await hora(page, 'sit-horafin', '17:35');
    await expect(page.locator('#sit-fin-cobro')).toHaveText('Hora real 17:35, se cobra hasta 17:30');
    await expect(page.locator('#sit-cobro')).toHaveValue('1330');
    await hora(page, 'sit-horafin', '17:30');
    await expect(page.locator('#sit-fin-cobro')).toHaveText('');
    verificarLimpio(e);
  });

  test('termina pasada la medianoche: se cobra hasta la 01:30', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos() });
    await nuevoSitting(page, { ini: '22:00', fin: '01:06', cruza: true });
    await expect(page.locator('#sit-fin-cobro')).toHaveText('Hora real 01:06, se cobra hasta 01:30');
    await expect(page.locator('#sit-cobro')).toHaveValue('1330'); // 3,5 h
    await expect(page.locator('#sit-pago')).toHaveValue('775'); // 3,1 h
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    expect(escrituras(e, 'sittings_traslados', 'POST')[0].cuerpo).toMatchObject({ hora_fin: '01:06', termina_dia_siguiente: true, cobro_familia: 1330, pago_ninera: 775 });
    verificarLimpio(e);
  });

  test('termina 23:36: se cobra hasta las 00:00 sin marcar "termina al día siguiente"', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos() });
    await nuevoSitting(page, { ini: '20:00', fin: '23:36' });
    await expect(page.locator('#sit-fin-cobro')).toHaveText('Hora real 23:36, se cobra hasta 00:00');
    await expect(page.locator('#sit-cobro')).toHaveValue('1520');
    verificarLimpio(e);
  });

  test('familia sin la casilla: todo con la hora real, sin aviso', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos() });
    await nuevoSitting(page, { familia: 'Familia Prueba Dos', ini: '14:00', fin: '17:36' });
    await expect(page.locator('#sit-fin-cobro')).toHaveText('');
    await expect(page.locator('#sit-cobro')).toHaveValue('1440'); // 3,6 h a $400
    await expect(page.locator('#sit-pago')).toHaveValue('936');
    verificarLimpio(e);
  });

  test('sitting de antes del día que aceptó: hora real', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos('2026-10-01') });
    await nuevoSitting(page, { fecha: '2026-09-30', ini: '14:00', fin: '17:36' });
    await expect(page.locator('#sit-fin-cobro')).toHaveText('');
    await expect(page.locator('#sit-cobro')).toHaveValue('1368');
    verificarLimpio(e);
  });

  test('cambiar la fecha después de las horas recalcula según el día que aceptó', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos('2026-10-01') });
    await nuevoSitting(page, { fecha: '2026-10-03', ini: '14:00', fin: '17:36' });
    await expect(page.locator('#sit-cobro')).toHaveValue('1520');
    await page.fill('#sit-fecha', '2026-09-30');
    await page.locator('#sit-fecha').dispatchEvent('change');
    await expect(page.locator('#sit-cobro')).toHaveValue('1368');
    await expect(page.locator('#sit-fin-cobro')).toHaveText('');
    verificarLimpio(e);
  });

  test('abrir un registro guardado muestra el aviso sin recalcular el cobro', async ({ page }) => {
    const d = datosConTerminos('2026-09-01');
    const SIT = '70000000-0000-4000-8000-000000000003';
    Object.assign(d.sittings_traslados.find(s => s.id === SIT), { hora_fin: '19:36:00', cobro_familia: 1500 });
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'sittings');
    await page.evaluate(id => abrirModalSitForm(id), SIT);
    await expect(page.locator('#sit-fin-cobro')).toHaveText('Hora real 19:36, se cobra hasta 20:00');
    await expect(page.locator('#sit-cobro')).toHaveValue('1500');
    verificarLimpio(e);
  });
});

test.describe('historial y PDF de la familia', () => {
  test('el horario aclara hasta qué hora se cobra', async ({ page }) => {
    const d = datosConTerminos('2026-09-01');
    d.app_config = [...(d.app_config || []), { id: 'cuenta_cobro', valor: { texto: 'Banco Prueba 0001234567' }, actualizado_at: '2026-10-01T00:00:00Z' }];
    Object.assign(d.sittings_traslados.find(s => s.id === '70000000-0000-4000-8000-000000000003'), { hora_fin: '19:36:00', cobro_familia: 1520 });
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'sittings');
    await page.evaluate(() => {
      const sel = document.getElementById('sithist-familia');
      sel.value = [...sel.options].find(o => o.textContent === 'Familia Prueba Uno').value;
    });
    await page.evaluate(() => abrirModalExportarHistorialPDF());
    await page.fill('#exphist-desde', '2026-09-28');
    await page.fill('#exphist-hasta', '2026-09-28');
    await page.locator('#editmodal button', { hasText: 'Ver vista previa' }).click();
    const fila = page.locator('#exphist-preview tbody tr').first();
    await expect(fila).toContainText('16:00–19:36 (se cobra hasta 20:00)');
    await expect(fila).toContainText('3.6 hs'); // horas reales
    await expect(page.locator('#exphist-total-pagar')).toHaveText('Total a pagar: $1.520');
    verificarLimpio(e);
  });

  test('familia sin la casilla: el horario de siempre', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'sittings');
    const txt = await page.evaluate(() => horarioEfectuadoTexto({ tipo: 'sitting', familia_id: sitFamilias[0].id, fecha: '2026-09-28', hora_inicio: '16:00:00', hora_fin: '19:36:00' }));
    expect(txt).toBe('16:00–19:36');
    verificarLimpio(e);
  });
});

test.describe('Agenda', () => {
  async function verAgendaDesde(page, fechaISO) {
    await page.evaluate(async f => { agendaAncla = f; await cargarAgendaSolicitudes(); }, fechaISO);
    await esperarQuieta(page);
  }

  test('registrar un día de un fijo: aviso y cobro redondeado, pago con la hora real', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos('2026-09-01') });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-09-21');
    await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-09-21`), ID.aFijo);
    await expect(page.locator('#agenda-fija-fin-cobro')).toHaveText(''); // 16 a 19 en punto
    await hora(page, 'agenda-fija-hf', '19:06');
    await expect(page.locator('#agenda-fija-fin-cobro')).toHaveText('Hora real 19:06, se cobra hasta 19:30');
    await page.locator('#editmodal button', { hasText: 'Registrar sitting de este día' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    const [alta] = escrituras(e, 'sittings_traslados', 'POST');
    expect(alta.cuerpo).toMatchObject({ asignacion_id: ID.aFijo, hora_fin: '19:06', cobro_familia: 1330, pago_ninera: 775 });
    verificarLimpio(e);
  });

  test('reemplazo de un día de un fijo: misma regla', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos('2026-09-01') });
    await irAModulo(page, 'agenda');
    await verAgendaDesde(page, '2026-09-21');
    await page.evaluate(id => abrirModalSolicitud(`asig:${id}@2026-09-21`), ID.aFijo);
    await page.locator('#editmodal button', { hasText: 'Este día no fue' }).click();
    await page.locator('#editmodal button', { hasText: 'Vino otra niñera' }).click();
    await page.fill('#agenda-fija-reemplazo-ninera', 'Carla Ejemplo');
    await hora(page, 'agenda-fija-rhf', '19:36');
    await expect(page.locator('#agenda-fija-rfin-cobro')).toHaveText('Hora real 19:36, se cobra hasta 20:00');
    await page.locator('#editmodal button', { hasText: 'Registrar reemplazo' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    expect(escrituras(e, 'sittings_traslados', 'POST')[0].cuerpo).toMatchObject({ ninera_nombre: 'Carla Ejemplo', cobro_familia: 1520, pago_ninera: 900 });
    verificarLimpio(e);
  });

  test('solicitud puntual: el total estimado y el cobro guardado usan la regla', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos('2026-09-01') });
    await irAModulo(page, 'agenda');
    await page.locator('button[onclick^="abrirModalNuevaSolicitud"]').first().click();
    await page.fill('#agenda-familia', 'Familia Prueba Uno');
    await page.evaluate(() => onAgendaFamiliaInput());
    await page.fill('#agenda-nueva-fecha', '2026-10-08');
    await hora(page, 'agenda-hora-inicio', '14:00');
    await hora(page, 'agenda-hora-fin', '17:36');
    await expect(page.locator('#agenda-total-preview')).toHaveText('Total estimado: $1.520 (4 h) · Hora real 17:36, se cobra hasta 18:00');
    await page.locator('#editmodal button', { hasText: /Guardar|Crear|Agregar/ }).last().click();
    await expect.poll(() => escrituras(e, 'solicitudes', 'POST').length).toBe(1);
    expect(escrituras(e, 'solicitudes', 'POST')[0].cuerpo).toMatchObject({ hora_fin: '17:36', cobro_familia: 1520 });
    verificarLimpio(e);
  });
});

test.describe('fijos automáticos: el sitting de hoy sigue a la marca', () => {
  test('marcar los términos recalcula el de hoy (si nadie lo tocó) y pide recalcular los previstos', async ({ page }) => {
    const HOY = 'a1000000-0000-4000-8000-000000000005';
    const d = datosBase();
    d.app_config = [{ id: 'fijos_automaticos', valor: { activo: true, dias: 14 }, actualizado_at: '2026-10-04T06:00:00Z' }];
    d.asignaciones_pausas = [];
    d.asignaciones[0].hora_fin = '19:36:00';
    d.sittings_traslados = d.sittings_traslados.map(s => ({ ...s, estado: 'confirmado', generado_automatico: false, revisado_at: null }));
    d.sittings_traslados.push(sitting(HOY, '2026-10-05', { asignacion_id: ID.aFijo, estado: 'confirmado', generado_automatico: true, revisado_at: null,
      registrado_por: 'Automático', hora_fin: '19:36:00', cobro_familia: 1368, pago_ninera: 900 }));
    const e = await abrirApp(page, { datos: d, ahora: '2026-10-05T10:00:00-03:00' });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await page.check('#fam-terminos-chk');
    await page.locator('#fam-terminos-guardar').click();
    await expect.poll(() => e.db.sittings_traslados.find(s => s.id === HOY).cobro_familia).toBe(1520);
    expect(e.db.sittings_traslados.find(s => s.id === HOY)).toMatchObject({ pago_ninera: 900, hora_fin: '19:36' });
    expect(escrituras(e, 'rpc/generar_previstos_fijos', 'POST')).toHaveLength(1);
    verificarLimpio(e);
  });
});

test.describe('base sin la migración', () => {
  test('la app anda igual: sin la casilla y todo con la hora real', async ({ page }) => {
    const e = await abrirApp(page, { baseSinMigrar: true });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await expect(page.locator('#editmodal')).toContainText('Familia Prueba Uno');
    await expect(page.locator('#fam-terminos')).toHaveCount(0);
    await page.evaluate(() => cerrarModal());
    await nuevoSitting(page, { ini: '14:00', fin: '17:36' });
    await expect(page.locator('#sit-cobro')).toHaveValue('1368');
    await expect(page.locator('#sit-fin-cobro')).toHaveText('');
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    expect(escrituras(e, 'sittings_traslados', 'POST')[0].cuerpo).toMatchObject({ cobro_familia: 1368, pago_ninera: 900 });
    // La consulta con la columna falla una vez (400) y se reintenta sin ella; las tablas nuevas, 404.
    verificarLimpio(e, { ignorar: [/status of 400/, /status of 404/] });
  });
});

test.describe('celular (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('la casilla de la ficha entra en la pantalla', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConTerminos() });
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    await expect(page.locator('#fam-terminos-fecha')).toBeVisible();
    const caja = await page.locator('#editmodal .confirmbox').boundingBox();
    expect(caja.x + caja.width).toBeLessThanOrEqual(391);
    const ancho = await page.evaluate(() => document.querySelector('#editmodal .confirmbox').scrollWidth - document.querySelector('#editmodal .confirmbox').clientWidth);
    expect(ancho, 'nada se sale de la ficha').toBeLessThanOrEqual(1);
    verificarLimpio(e);
  });
});
