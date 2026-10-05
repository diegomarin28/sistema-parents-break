// Testing exploratorio (05/10/2026). Cada test es un caso que se probó a mano con el simulador
// y quedó como regresión: flujos de punta a punta, celular, datos raros, estados vacíos,
// navegar rápido, dos usuarias a la vez (Realtime) y totales que se pueden reconstruir.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

test.describe('dos usuarias a la vez (Realtime)', () => {
  test('lo que carga la otra aparece solo, sin recargar', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.waitForTimeout(300);
    const nueva = { id: '20000000-0000-4000-8000-0000000000aa', nombre: 'Familia Desde Otro Celular', zona: 'Pocitos', telefono: null, ninos: null, notas: null, created_at: '2026-10-04T15:00:00Z', direccion: null, cuenta_bancaria: [], cobro_hora: null, pago_hora: null, frecuencia_cobro: 'mensual', contactada_riesgo_en: null };
    e.db.familias.push(nueva);
    expect(e.emitirRealtime('familias', 'INSERT', nueva)).toBeGreaterThan(0);
    await expect(page.locator('#familiaslist')).toContainText('Familia Desde Otro Celular', { timeout: 3000 });
    verificarLimpio(e);
  });

  test('una entrevista a medio llenar no se borra si entra una candidata nueva por el formulario', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'rrhh');
    await page.locator('[data-rrhhtab="entrevista"]').click();
    await esperarQuieta(page);
    await page.fill('#f-nombre', 'Candidata En Entrevista');
    await page.fill('#f-notas', 'Muy buena impresión, llegó puntual');
    await page.fill('#ent-nota-idiomas', 'Inglés fluido');
    const nueva = { ...e.db.candidatas[0], id: '50000000-0000-4000-8000-0000000000bb', nombre: 'Llegó Por El Form' };
    e.db.candidatas.push(nueva);
    e.emitirRealtime('candidatas', 'INSERT', nueva);
    await page.waitForTimeout(1500);
    await expect(page.locator('#f-nombre')).toHaveValue('Candidata En Entrevista');
    await expect(page.locator('#f-notas')).toHaveValue('Muy buena impresión, llegó puntual');
    await expect(page.locator('#ent-nota-idiomas')).toHaveValue('Inglés fluido');
    verificarLimpio(e);
  });

  test('si llega un cambio con un formulario abierto, al cerrarlo se ve actualizado', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.locator('button[onclick^="abrirModalNuevaFamilia"]').click();
    const nueva = { ...e.db.familias[1], id: '20000000-0000-4000-8000-0000000000cc', nombre: 'Familia Mientras Escribía' };
    e.db.familias.push(nueva);
    e.emitirRealtime('familias', 'INSERT', nueva);
    await page.waitForTimeout(900);
    await expect(page.locator('#editmodal')).toHaveCount(1); // no interrumpe el formulario
    await page.locator('#editmodal .modal-close').click();
    await expect(page.locator('#familiaslist')).toContainText('Familia Mientras Escribía', { timeout: 3000 });
    verificarLimpio(e);
  });

  test('en Finanzas, un cambio de la otra no borra el resultado de la conciliación', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'finanzas');
    await page.setInputFiles('#fin-conciliar-file', { name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from('Fecha;Concepto;Crédito\n03/10/2026;TRANSF 0001234567;2280\n') });
    await page.locator('button[onclick*="procesarExtractoConciliacion"]').click();
    await expect(page.locator('.conc-fila')).toHaveCount(1);
    const s = sitting('70000000-0000-4000-8000-0000000000dd', '2026-10-04', {});
    e.db.sittings_traslados.push(s);
    e.emitirRealtime('sittings_traslados', 'INSERT', s);
    await page.waitForTimeout(1500);
    await expect(page.locator('.conc-fila')).toHaveCount(1);
    // Y las cifras sí se actualizaron con el sitting nuevo.
    await expect(page.locator('#fin-facturado')).toHaveText('$1.140', { timeout: 3000 });
    verificarLimpio(e);
  });
});

test.describe('flujo de punta a punta', () => {
  test('alta de familia → fijo → registrar desde Agenda → cobrar → pagar → Finanzas cuadra', async ({ page }) => {
    const datos = datosBase();
    datos.sittings_traslados = []; datos.gastos_generales = []; datos.gastos_fijos = []; datos.asignaciones = []; datos.solicitudes = [];
    const e = await abrirApp(page, { datos, ahora: '2026-10-05T10:00:00-03:00' }); // lunes
    // 1) Familia nueva con tarifa 400 / 260 por hora.
    await irAModulo(page, 'familias');
    await page.locator('button[onclick^="abrirModalNuevaFamilia"]').click();
    await page.fill('#fam-nombre', 'Familia Punta A Punta');
    await page.fill('#fam-cobro', '400');
    await page.fill('#fam-pago', '260');
    await page.locator('#editmodal button', { hasText: 'Agregar familia' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    await esperarQuieta(page);
    const fam = e.db.familias.find(f => f.nombre === 'Familia Punta A Punta');
    // 2) Fijo los lunes 16 a 19 con Ana, desde hoy.
    await page.evaluate(id => verFamilia(id), fam.id);
    await page.fill(`#asig-nombre-${fam.id}`, 'Ana Ficticia');
    await page.evaluate(id => { setHoraSelect('asig-horaini-'+id, '16:00'); setHoraSelect('asig-horafin-'+id, '19:00'); }, fam.id);
    await page.locator(`#asig-dias-${fam.id} .daybtn`, { hasText: /^L$/ }).click();
    await page.locator('#editmodal button', { hasText: 'Asignar niñera' }).click();
    await expect.poll(() => e.db.asignaciones.length).toBe(1);
    expect(e.db.asignaciones[0]).toMatchObject({ familia_id: fam.id, ninera_nombre: 'Ana Ficticia', dias: ['L'], vigente_desde: '2026-10-05' });
    await page.evaluate(() => cerrarModal());
    // 3) Registrar el lunes desde la Agenda.
    await irAModulo(page, 'agenda');
    await page.evaluate(async () => { agendaAncla = '2026-10-05'; await cargarAgendaSolicitudes(); });
    await esperarQuieta(page);
    const idFijo = await page.evaluate(n => agendaSolicitudes.find(s => s._fuente === 'asignacion' && s.familia_nombre === n && s.fecha === '2026-10-05')?.id, 'Familia Punta A Punta');
    expect(idFijo).toBeTruthy();
    await page.evaluate(i => abrirModalSolicitud(i), idFijo);
    await page.locator('#editmodal button', { hasText: 'Registrar sitting de este día' }).click();
    await expect.poll(() => e.db.sittings_traslados.length).toBe(1);
    const reg = e.db.sittings_traslados[0];
    expect(reg).toMatchObject({ familia_id: fam.id, ninera_nombre: 'Ana Ficticia', fecha: '2026-10-05', asignacion_id: e.db.asignaciones[0].id, cobro_familia: 1200, pago_ninera: 780, cobrado: false, pagado: false });
    // 4) Finanzas: facturado 1.200, por cobrar 1.200, por pagar 780.
    await irAModulo(page, 'finanzas');
    await expect(page.locator('#fin-facturado')).toHaveText('$1.200');
    await expect(page.locator('#fin-porcobrar')).toHaveText('$1.200');
    await expect(page.locator('#fin-porpagar')).toHaveText('$780');
    await expect(page.locator('#fin-resultado')).toHaveText('$420');
    // 5) Cobrar (Por cobrar, mensual).
    await page.locator('#fin-porcobrar-wrap .agendarow', { hasText: 'Familia Punta A Punta' }).locator('button').click();
    await expect(page.locator('#fin-cobrado')).toHaveText('$1.200');
    await expect(page.locator('#fin-porcobrar')).toHaveText('$0');
    // 6) Pagar: el fijo se paga por semana, aparece cuando termina la semana.
    await expect(page.locator('#fin-porpagar-wrap')).not.toContainText('Ana Ficticia');
    await page.clock.setFixedTime(new Date('2026-10-12T10:00:00-03:00'));
    await page.evaluate(async () => { finMes = '2026-10'; refrescarFinanzasCompleto(); });
    await esperarQuieta(page);
    await page.locator('#fin-porpagar-wrap .agendarow', { hasText: 'Ana Ficticia' }).locator('button').click();
    await page.locator('[aria-label="Confirmar pago"] button', { hasText: 'Confirmar pago' }).click();
    await expect(page.locator('#fin-porpagar')).toHaveText('$0');
    // 7) Cuadra: resultado sobre lo facturado, sin cambiar por cobrar/pagar.
    await expect(page.locator('#fin-facturado')).toHaveText('$1.200');
    await expect(page.locator('#fin-resultado')).toHaveText('$420');
    expect(e.db.sittings_traslados[0]).toMatchObject({ cobrado: true, pagado: true });
    verificarLimpio(e);
  });
});

const MODULOS = [null, 'agenda', 'rrhh', 'ninieras', 'familias', 'sittings', 'intermediaciones', 'finanzas', 'marketing', 'legal', 'juguetes', 'notificaciones'];
async function textoRaro(page) {
  return page.evaluate(() => {
    const t = document.getElementById('app').innerText;
    return (t.match(/\b(undefined|NaN|null|\[object Object\])\b|\$-?Infinity/g) || []);
  });
}

test.describe('celular (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const m of MODULOS) {
    test(`${m || 'hoy'}: sin scroll horizontal ni textos rotos`, async ({ page }) => {
      const e = await abrirApp(page);
      if (m) await irAModulo(page, m);
      await page.waitForTimeout(300);
      const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vp: innerWidth }));
      expect(ancho.doc, 'la página no se corre de costado').toBeLessThanOrEqual(ancho.vp + 1);
      expect(await textoRaro(page)).toEqual([]);
      verificarLimpio(e);
    });
  }
  test('los formularios principales entran en la pantalla', async ({ page }) => {
    const e = await abrirApp(page);
    for (const [m, sel] of [['familias', 'abrirModalNuevaFamilia'], ['sittings', 'abrirModalSitForm'], ['agenda', 'abrirModalNuevaSolicitud'], ['finanzas', 'abrirModalNuevoGasto('], ['ninieras', 'abrirModalNuevaNinera'], ['rrhh', 'abrirModalNuevaCandidata']]) {
      await irAModulo(page, m);
      await page.locator(`button[onclick^="${sel}"]`).first().click();
      const caja = await page.locator('#editmodal .confirmbox').boundingBox();
      expect(caja.x, m).toBeGreaterThanOrEqual(0);
      expect(caja.x + caja.width, m).toBeLessThanOrEqual(391);
      const ancho = await page.evaluate(() => document.querySelector('#editmodal .confirmbox').scrollWidth - document.querySelector('#editmodal .confirmbox').clientWidth);
      expect(ancho, `${m}: nada se sale del formulario`).toBeLessThanOrEqual(1);
      await page.evaluate(() => cerrarModal());
    }
    verificarLimpio(e);
  });
});

test.describe('datos raros', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('nombres larguísimos sin espacios no rompen la lista ni la ficha', async ({ page }) => {
    const datos = datosBase();
    const largo = 'Familia' + 'Gonzálezdelaserna'.repeat(6);
    datos.familias[0].nombre = largo; datos.sittings_traslados.forEach(s => { if (s.familia_id === ID.fUno) s.familia_nombre = largo; });
    datos.ninieras[0].nombre = 'Ana' + 'Maríadelosángeles'.repeat(5);
    const e = await abrirApp(page, { datos });
    for (const m of ['familias', 'ninieras', 'sittings', 'finanzas', 'agenda']) {
      await irAModulo(page, m);
      const ancho = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(ancho, `${m} no se corre de costado`).toBeLessThanOrEqual(1);
    }
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fUno);
    const ancho = await page.evaluate(() => document.querySelector('#editmodal .confirmbox').scrollWidth - document.querySelector('#editmodal .confirmbox').clientWidth);
    expect(ancho, 'la ficha no se sale de la pantalla').toBeLessThanOrEqual(1);
    verificarLimpio(e);
  });

  test('montos en 0 y con decimales, y un sitting que cruza la medianoche del fin de mes', async ({ page }) => {
    const datos = datosBase();
    datos.sittings_traslados = [
      sitting('70000000-0000-4000-8000-0000000000e1', '2026-10-31', { hora_inicio: '22:00:00', hora_fin: '02:00:00', termina_dia_siguiente: true, cobro_familia: 1520.5, pago_ninera: 1000.25 }),
      sitting('70000000-0000-4000-8000-0000000000e2', '2026-10-30', { cobro_familia: 0, pago_ninera: 0, notas: 'No fue nadie' }),
      sitting('70000000-0000-4000-8000-0000000000e3', '2026-11-01', { cobro_familia: 1000, pago_ninera: 700 }),
    ];
    datos.gastos_generales = []; datos.gastos_fijos = [];
    const e = await abrirApp(page, { datos, ahora: '2026-11-02T12:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await page.evaluate(async () => { finMes = '2026-10'; await cargarFinanzas(); });
    await esperarQuieta(page);
    // El de las 22 del 31/10 es de octubre aunque termine el 1/11.
    await expect(page.locator('#fin-facturado')).toHaveText('$1.521');
    await expect(page.locator('#fin-resultado')).toHaveText('$520');
    expect(await textoRaro(page)).toEqual([]);
    await irAModulo(page, 'sittings');
    await page.evaluate(async () => { sitMes = '2026-10'; await cargarSitLista(); });
    await esperarQuieta(page);
    await expect(page.locator('#sit-list-wrap')).toContainText('31-oct');
    expect(await textoRaro(page)).toEqual([]);
    verificarLimpio(e);
  });
});

test.describe('estados vacíos', () => {
  for (const m of MODULOS) {
    test(`${m || 'hoy'} con la base vacía`, async ({ page }) => {
      const datos = Object.fromEntries(Object.keys(datosBase()).map(k => [k, []]));
      const e = await abrirApp(page, { datos });
      if (m) await irAModulo(page, m);
      await page.waitForTimeout(300);
      expect(await textoRaro(page)).toEqual([]);
      await expect(page.locator('#app .spinner')).toHaveCount(0);
      verificarLimpio(e);
    });
  }
});

test.describe('navegar rápido mientras carga', () => {
  test('saltar de módulo en módulo con la base lenta termina en el último, sin mezclar pantallas', async ({ page }) => {
    const e = await abrirApp(page);
    e.demoraLecturas = 400;
    await page.evaluate(() => { ['agenda', 'familias', 'ninieras', 'finanzas', 'sittings', 'rrhh', 'juguetes'].forEach(m => setModulo(m)); });
    await page.waitForTimeout(2500);
    await esperarQuieta(page);
    await expect(page.locator('#modcontent .modtitle').first()).toHaveText('Juguetes');
    // Nada de otro módulo quedó pintado adentro del de juguetes.
    const ajenos = await page.evaluate(() => ['#familiaslist', '#ninierasgrid', '#fin-summary', '#agenda-grid-wrap', '#sit-list-wrap', '#intakegrid'].filter(s => document.querySelector(s)));
    expect(ajenos).toEqual([]);
    e.demoraLecturas = 0;
    verificarLimpio(e);
  });

  test('cambiar de semana en la Agenda muy rápido muestra la última semana pedida', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-10-05T10:00:00-03:00' });
    await irAModulo(page, 'agenda');
    e.demoraLecturas = 300;
    await page.evaluate(() => { cambiarAgendaRango(1); cambiarAgendaRango(1); cambiarAgendaRango(-1); });
    await page.waitForTimeout(1500);
    await esperarQuieta(page);
    const r = await page.evaluate(() => ({ ancla: agendaAncla, fechas: [...new Set(agendaSolicitudes.map(s => s.fecha))].sort() }));
    expect(r.fechas.every(f => f >= r.ancla)).toBe(true);
    e.demoraLecturas = 0;
    verificarLimpio(e);
  });
});

test.describe('los totales se pueden reconstruir sumando las filas', () => {
  test('Finanzas, Sittings y Por cobrar suman lo mismo que las filas de la base', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-10-10T12:00:00-03:00' });
    const plata = t => Number(String(t).replace(/[^\d,-]/g, '').replace(',', '.'));
    const sep = e.db.sittings_traslados.filter(s => s.fecha.startsWith('2026-09'));
    const suma = (f, c) => sep.filter(f).reduce((t, s) => t + (Number(s[c]) || 0), 0);
    await irAModulo(page, 'finanzas');
    await page.evaluate(async () => { finMes = '2026-09'; await cargarFinanzas(); });
    await esperarQuieta(page);
    expect(plata(await page.locator('#fin-facturado').innerText())).toBe(suma(() => true, 'cobro_familia'));
    expect(plata(await page.locator('#fin-cobrado').innerText())).toBe(suma(s => s.cobrado, 'cobro_familia'));
    expect(plata(await page.locator('#fin-porpagar').innerText())).toBe(suma(s => !s.pagado, 'pago_ninera'));
    // Por cobrar: el total del encabezado es la suma de sus filas, y la suma de lo pendiente en la base.
    const pc = await page.evaluate(() => ({
      header: document.querySelector('#fin-porcobrar-wrap .helper').innerText,
      filas: [...document.querySelectorAll('#fin-porcobrar-wrap .agendarow span')].map(s => s.innerText),
    }));
    const sumaFilas = pc.filas.reduce((t, x) => t + plata(x), 0);
    expect(plata(pc.header.split('·')[1])).toBe(sumaFilas);
    expect(sumaFilas).toBe(e.db.sittings_traslados.filter(s => !s.cobrado).reduce((t, s) => t + s.cobro_familia, 0));
    // Sittings: las tarjetas de arriba suman la tabla del mes.
    await irAModulo(page, 'sittings');
    await page.evaluate(async () => { sitMes = '2026-09'; await cargarSitLista(); });
    await esperarQuieta(page);
    const tarjetas = await page.locator('#sit-summary .statnum').allInnerTexts();
    expect(plata(tarjetas[0])).toBe(suma(() => true, 'cobro_familia'));
    expect(plata(tarjetas[1])).toBe(suma(() => true, 'pago_ninera'));
    expect(plata(tarjetas[2])).toBe(suma(() => true, 'cobro_familia') - suma(() => true, 'pago_ninera'));
    verificarLimpio(e);
  });
});

test.describe('errores de red en guardados que no son botones', () => {
  test('si falla tildar "Publicado" (Marketing), la casilla vuelve a como estaba', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'marketing');
    e.fallar = () => 'red';
    const casilla = page.locator('input[onchange*="togglePublicadoMarketing"]').first();
    await casilla.check();
    await expect(page.locator('.toaststack .toast').last()).toContainText('No se pudo actualizar');
    await expect(page.locator('input[onchange*="togglePublicadoMarketing"]').first()).not.toBeChecked();
    verificarLimpio(e, { ignorar: [/Failed to load resource|ERR_FAILED|Failed to fetch/] });
  });

  test('si falla cambiar el estado de un contrato, el selector vuelve a como estaba', async ({ page }) => {
    const datos = datosBase();
    datos.contratos = [{ id: 'a3000000-0000-4000-8000-000000000001', tipo: 'ninera', parte_nombre: 'Ana Ficticia', fecha: '2026-10-01', estado: 'borrador', notas: null, created_at: '2026-10-01T12:00:00Z' }];
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'legal');
    e.fallar = () => ({ message: 'falla simulada' });
    await page.locator('select[onchange*="cambiarEstadoContrato"]').selectOption('firmado');
    await expect(page.locator('.toaststack .toast').last()).toContainText('No se pudo actualizar');
    await expect(page.locator('select[onchange*="cambiarEstadoContrato"]')).toHaveValue('borrador');
    verificarLimpio(e, { ignorar: [/Failed to load resource/] });
  });
});

test.describe('validaciones que faltaban', () => {
  test('un sitting con monto negativo no se guarda', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'sittings');
    await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
    await page.fill('#sit-familia', 'Famil');
    await page.locator('#sit-familia-dropdown .autocomplete-item', { hasText: 'Familia Prueba Dos' }).click();
    await page.waitForTimeout(200);
    await page.fill('#sit-ninera', 'Bruno');
    await page.locator('#sit-ninera-dropdown .autocomplete-item', { hasText: 'Bruno Inventado' }).click();
    await page.waitForTimeout(200);
    await page.evaluate(() => { setHoraSelect('sit-horaini', '10:00'); setHoraSelect('sit-horafin', '12:00'); });
    await page.fill('#sit-cobro', '-800');
    await page.fill('#sit-pago', '500');
    await page.locator('#editmodal button', { hasText: 'Guardar registro' }).click();
    await expect(page.locator('.toaststack .toast').last()).toContainText('no pueden ser negativos');
    expect(e.escrituras.filter(w => w.tabla === 'sittings_traslados')).toEqual([]);
    verificarLimpio(e);
  });

  test('un gasto negativo no se guarda', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'finanzas');
    await page.locator('button[onclick^="abrirModalNuevoGasto("]').click();
    await page.fill('#fin-gasto-concepto', 'Error de tipeo');
    await page.fill('#fin-gasto-monto', '-300');
    await page.locator('#editmodal button', { hasText: 'Agregar gasto' }).click();
    await expect(page.locator('.toaststack .toast').last()).toContainText('no puede ser negativo');
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });

  test('un fijo desde la ficha de la familia pide días y avisa si la niñera ya tiene ese horario', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'familias');
    await page.evaluate(id => verFamilia(id), ID.fDos);
    await page.fill(`#asig-nombre-${ID.fDos}`, 'Ana Ficticia');
    await page.evaluate(id => { setHoraSelect('asig-horaini-'+id, '17:00'); setHoraSelect('asig-horafin-'+id, '20:00'); }, ID.fDos);
    const asignar = page.locator('#editmodal button', { hasText: 'Asignar niñera' });
    await asignar.click();
    await expect(page.locator('.toaststack .toast').last()).toContainText('Elegí al menos un día');
    // Ana ya hace el fijo L/X 16 a 19 con Familia Uno: el lunes 17 a 20 se pisa.
    await page.locator(`#asig-dias-${ID.fDos} .daybtn`, { hasText: /^L$/ }).click();
    await asignar.click();
    const aviso = page.locator('.confirmoverlay:not(#editmodal)');
    await expect(aviso).toContainText('ya está comprometida');
    await aviso.locator('button', { hasText: 'Cancelar' }).click();
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });
});
