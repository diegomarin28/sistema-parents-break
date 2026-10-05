// Fechas en hora de Montevideo (PR 3, 05/10/2026). todayISO() usaba UTC: de 21:00 a 24:00
// en Uruguay ya era "mañana". Estos tests fijan el reloj en los bordes (noche, fin de mes,
// fin de año, domingo) y también prueban un celular configurado en otra zona horaria.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');

const helpers = page => page.evaluate(() => ({
  hoy: todayISO(), mes: currentMonthStr(), manana: mananaISO(), ayer: diasAtras(1),
  mesPasado: primerDiaMesesAtras(1), dia: diaHoy(),
}));

test.describe('"hoy" en los bordes del día, del mes y del año', () => {
  test('22:30 del último día del mes: sigue siendo ese día y ese mes', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-10-31T22:30:00-03:00' });
    expect(await helpers(page)).toEqual({
      hoy: '2026-10-31', mes: '2026-10', manana: '2026-11-01', ayer: '2026-10-30', mesPasado: '2026-09-01', dia: 'S',
    });
    verificarLimpio(e);
  });

  test('23:59 del 31/12: el año todavía no cambió', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-12-31T23:59:00-03:00' });
    expect(await helpers(page)).toEqual({
      hoy: '2026-12-31', mes: '2026-12', manana: '2027-01-01', ayer: '2026-12-30', mesPasado: '2026-11-01', dia: 'J',
    });
    verificarLimpio(e);
  });

  test('00:05 del 01/11: ya es el mes nuevo', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-11-01T00:05:00-03:00' });
    expect(await helpers(page)).toEqual({
      hoy: '2026-11-01', mes: '2026-11', manana: '2026-11-02', ayer: '2026-10-31', mesPasado: '2026-10-01', dia: 'D',
    });
    verificarLimpio(e);
  });

  test('el 31/03 "un mes atrás" es el 01/02 (no se saltea febrero)', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2027-03-31T22:00:00-03:00' });
    expect(await page.evaluate(() => primerDiaMesesAtras(1))).toBe('2027-02-01');
    verificarLimpio(e);
  });

  test('a las 22:30 de un domingo, Finanzas, Sittings y Agenda abren en el día y el mes correctos', async ({ page }) => {
    const e = await abrirApp(page, { ahora: '2026-10-31T22:30:00-03:00' });
    await irAModulo(page, 'finanzas');
    expect(await page.evaluate(() => finMes)).toBe('2026-10');
    await irAModulo(page, 'sittings');
    expect(await page.evaluate(() => sitMes)).toBe('2026-10');
    await irAModulo(page, 'agenda');
    expect(await page.evaluate(() => agendaAncla)).toBe('2026-10-31');
    verificarLimpio(e);
  });
});

test.describe('semanas y rangos (Por cobrar / Por pagar y Agenda)', () => {
  test('lunes y fin de semana de cada fecha, cruzando meses', async ({ page }) => {
    const e = await abrirApp(page);
    const r = await page.evaluate(() => ({
      domingo: lunesDeSemana('2026-10-04'), lunes: lunesDeSemana('2026-09-28'), cruce: lunesDeSemana('2026-10-01'),
      finDomingo: finDeSemanaDesde('2026-09-28'), finSabado: finDeSemanaDesde('2026-09-28', false),
      anio: lunesDeSemana('2027-01-01'), rango: rangoFechas('2026-09-29', '2026-10-02'),
    }));
    expect(r).toEqual({
      domingo: '2026-09-28', lunes: '2026-09-28', cruce: '2026-09-28',
      finDomingo: '2026-10-04', finSabado: '2026-10-03',
      anio: '2026-12-28', rango: ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'],
    });
    verificarLimpio(e);
  });

  test('la Agenda proyecta el fijo L/X en los días correctos de una semana que cruza de mes', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'agenda');
    await page.evaluate(async () => { agendaAncla = '2026-11-30'; await cargarAgendaSolicitudes(); });
    await esperarQuieta(page);
    const fechas = await page.evaluate(() => agendaSolicitudes.filter(s => s._fuente === 'asignacion').map(s => s.fecha).sort());
    expect(fechas.filter(f => f <= '2026-12-06')).toEqual(['2026-11-30', '2026-12-02']);
    verificarLimpio(e);
  });
});

// Un celular con la zona horaria mal puesta (o de viaje) igual tiene que ver la fecha de
// Montevideo. Con UTC+9 la cuenta vieja (medianoche local → toISOString) restaba un día.
for (const zona of ['Asia/Tokyo', 'Europe/Madrid', 'America/Los_Angeles']) {
  test.describe(`celular configurado en ${zona}`, () => {
    test.use({ timezoneId: zona });

    test('hoy, mes, semana y Agenda siguen siendo los de Montevideo', async ({ page }) => {
      const e = await abrirApp(page, { ahora: '2026-10-04T22:30:00-03:00' });
      expect(await page.evaluate(() => [todayISO(), currentMonthStr(), diaHoy(), lunesDeSemana('2026-10-04'), mananaISO()]))
        .toEqual(['2026-10-04', '2026-10', 'D', '2026-09-28', '2026-10-05']);
      await irAModulo(page, 'agenda');
      await page.evaluate(async () => { agendaAncla = '2026-11-30'; await cargarAgendaSolicitudes(); });
      await esperarQuieta(page);
      const fechas = await page.evaluate(() => agendaSolicitudes.filter(s => s._fuente === 'asignacion').map(s => s.fecha).sort());
      expect(fechas.filter(f => f <= '2026-12-06')).toEqual(['2026-11-30', '2026-12-02']);
      verificarLimpio(e);
    });

    test('el formulario de sitting propone la fecha de Montevideo', async ({ page }) => {
      const e = await abrirApp(page, { ahora: '2026-10-04T22:30:00-03:00' });
      await irAModulo(page, 'sittings');
      await page.locator('button[onclick^="abrirModalSitForm"]').first().click();
      await expect(page.locator('#sit-fecha')).toHaveValue('2026-10-04');
      verificarLimpio(e);
    });
  });
}
