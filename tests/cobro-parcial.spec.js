// Cobro parcial en Por cobrar / Por pagar (23/10/2026, pedido de Paulina y Delfina). La línea
// de cada familia sigue con el total junto; al tocarla se abre el detalle (un renglón por
// registro, gasto extra y saldo a favor, cada uno con su casilla) y "Marcar cobrado" marca solo
// lo tildado. "¿Cuánto pagó?" tilda solo la combinación exacta, empezando por lo más viejo.
// Después de marcar, un aviso con "Deshacer" (8 s) vuelve todo atrás, saldo a favor incluido.
// Hoy en los tests = domingo 04/10/2026. Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

// Familia Prueba Uno (cobro mensual), setiembre: A $760, B $1.140, C $760, todo sin cobrar.
const A = '71000000-0000-4000-8000-000000000001';
const B = '71000000-0000-4000-8000-000000000002';
const C = '71000000-0000-4000-8000-000000000003';
const GASTO = 'b7000000-0000-4000-8000-000000000001';
const AJ = 'a7000000-0000-4000-8000-000000000001';

function datos({ gastos = [], ajustes = [], sits } = {}) {
  const d = datosBase();
  d.sittings_traslados = sits || [
    sitting(A, '2026-09-07', { hora_inicio: '16:00:00', hora_fin: '18:00:00', cobro_familia: 760, pago_ninera: 500, pagado: true }),
    sitting(B, '2026-09-14', { hora_inicio: '15:00:00', hora_fin: '18:00:00', cobro_familia: 1140, pago_ninera: 750, pagado: true, ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo' }),
    sitting(C, '2026-09-21', { hora_inicio: '16:00:00', hora_fin: '18:00:00', cobro_familia: 760, pago_ninera: 500, pagado: true }),
  ];
  d.gastos_extra = gastos;
  d.ajustes_saldo = ajustes;
  return d;
}
const gasto = extra => ({ id: GASTO, sitting_id: B, concepto: 'Taxi de vuelta', monto: 300, pagado_por: 'ninera',
  comprobante: `${B}/ticket.jpg`, cobrado: false, reintegrado: true, ajuste_id: null, creado_por: null, absorbe_pb: false,
  created_at: '2026-09-14T22:00:00Z', ...extra });
const ajuste = extra => ({ id: AJ, sujeto: 'familia', familia_id: ID.fUno, ninera_id: null, nombre: 'Familia Prueba Uno', monto: -500,
  motivo: 'Pagó de más en agosto', fecha: '2026-09-01', aplicado: 0, aplicaciones: [], creado_por: null,
  created_at: '2026-09-01T12:00:00Z', ...extra });

const porCobrar = page => page.locator('#fin-porcobrar-wrap');
const pendiente = (box, nombre) => box.locator('.fin-pend', { hasText: nombre });
const casilla = (p, texto) => p.locator('.fin-det-fila', { hasText: texto }).locator('input[type=checkbox]');
const cobrados = e => e.db.sittings_traslados.filter(s => s.cobrado).map(s => s.id).sort();

async function abrirDetalle(page, nombre = 'Familia Prueba Uno') {
  const p = pendiente(porCobrar(page), nombre);
  await p.locator('.fin-pend-cabeza').click();
  await expect(p.locator('.fin-det-fila').first()).toBeVisible();
  return p;
}

test.describe('Por cobrar: marcar solo una parte', () => {
  test('la línea sigue con el total; el detalle muestra cada registro con fecha, horario, niñera y monto', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    const p = pendiente(porCobrar(page), 'Familia Prueba Uno');
    await expect(p.locator('.agendarow').first()).toContainText('$2.660');
    await expect(p.locator('.fin-det-fila')).toHaveCount(0);
    await expect(p.locator('.fin-pend-cabeza')).toHaveAttribute('aria-expanded', 'false');
    await abrirDetalle(page);
    await expect(p.locator('.fin-pend-cabeza')).toHaveAttribute('aria-expanded', 'true');
    const filas = p.locator('.fin-det-fila');
    await expect(filas).toHaveCount(3);
    await expect(filas.nth(0)).toContainText('07/09');
    await expect(filas.nth(0)).toContainText('16:00–18:00');
    await expect(filas.nth(0)).toContainText('Ana Ficticia');
    await expect(filas.nth(0)).toContainText('$760');
    await expect(filas.nth(1)).toContainText('Carla Ejemplo');
    await expect(filas.nth(1)).toContainText('$1.140');
    // Todo tildado al abrir: el total de lo tildado es el de la línea.
    await expect(p.locator('.fin-det-total')).toContainText('$2.660');
    await p.screenshot({ path: 'test-results/cobro-parcial-escritorio.png' });
    verificarLimpio(e);
  });

  test('marca 1 de 3: lo demás sigue en Por cobrar con el total nuevo, y "Deshacer" lo vuelve atrás', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await casilla(p, '07/09').uncheck();
    await casilla(p, '21/09').uncheck();
    await expect(p.locator('.fin-det-total')).toContainText('$1.140');
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    const aviso = page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' });
    await expect(aviso).toBeVisible();
    expect(cobrados(e)).toEqual([B]);
    await expect(pendiente(porCobrar(page), 'Familia Prueba Uno').locator('.agendarow').first()).toContainText('$1.520');

    await aviso.locator('button', { hasText: 'Deshacer' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Se deshizo' })).toBeVisible();
    expect(cobrados(e)).toEqual([]);
    await expect(pendiente(porCobrar(page), 'Familia Prueba Uno').locator('.agendarow').first()).toContainText('$2.660');
    verificarLimpio(e);
  });

  test('sin abrir el detalle, "Marcar cobrado" marca todo, como antes', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    await pendiente(porCobrar(page), 'Familia Prueba Uno').locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' })).toBeVisible();
    expect(cobrados(e)).toEqual([A, B, C]);
    verificarLimpio(e);
  });

  test('sin nada tildado no marca nada y lo dice', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    for (const f of ['07/09', '14/09', '21/09']) await casilla(p, f).uncheck();
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Tildá al menos un' })).toBeVisible();
    expect(e.escrituras.filter(w => w.tabla === 'sittings_traslados')).toHaveLength(0);
    verificarLimpio(e);
  });
});

test.describe('Por cobrar: "¿Cuánto pagó?"', () => {
  test('tilda la combinación exacta empezando por lo más viejo', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    // $760 puede ser el 07/09 o el 21/09: va el más viejo.
    await p.locator('.fin-det-pagado').fill('760');
    await expect(casilla(p, '07/09')).toBeChecked();
    await expect(casilla(p, '14/09')).not.toBeChecked();
    await expect(casilla(p, '21/09')).not.toBeChecked();
    // $1.900 = 07/09 + 14/09 (y no 14/09 + 21/09).
    await p.locator('.fin-det-pagado').fill('1900');
    await expect(casilla(p, '07/09')).toBeChecked();
    await expect(casilla(p, '14/09')).toBeChecked();
    await expect(casilla(p, '21/09')).not.toBeChecked();
    await expect(p.locator('.fin-det-total')).toContainText('$1.900');
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' })).toBeVisible();
    expect(cobrados(e)).toEqual([A, B]);
    verificarLimpio(e);
  });

  test('un monto sin combinación exacta lo dice, no deja nada tildado y no marca nada', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await p.locator('.fin-det-pagado').fill('1000');
    await expect(p.locator('.fin-det-aviso')).toContainText('No hay sittings que sumen $1.000: tildalos a mano');
    for (const f of ['07/09', '14/09', '21/09']) await expect(casilla(p, f)).not.toBeChecked();
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Tildá al menos un' })).toBeVisible();
    expect(e.escrituras.filter(w => w.tabla === 'sittings_traslados')).toHaveLength(0);
    verificarLimpio(e);
  });
});

test.describe('Por cobrar parcial con gastos extra y saldo a favor', () => {
  test('el gasto va con su sitting: se tilda con él, suma al monto y se marca cobrado junto', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ gastos: [gasto()] }) });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await expect(p.locator('.fin-det-fila', { hasText: 'Taxi de vuelta' })).toContainText('$300');
    // $1.440 = 14/09 ($1.140) + su gasto ($300).
    await p.locator('.fin-det-pagado').fill('1440');
    await expect(casilla(p, '14/09')).toBeChecked();
    await expect(casilla(p, 'Taxi de vuelta')).toBeChecked();
    await expect(casilla(p, '07/09')).not.toBeChecked();
    // Destildar el sitting destilda su gasto.
    await casilla(p, '14/09').uncheck();
    await expect(casilla(p, 'Taxi de vuelta')).not.toBeChecked();
    await casilla(p, '14/09').check();
    await expect(casilla(p, 'Taxi de vuelta')).toBeChecked();
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    const aviso = page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' });
    await expect(aviso).toBeVisible();
    expect(cobrados(e)).toEqual([B]);
    expect(e.db.gastos_extra[0].cobrado).toBe(true);
    await aviso.locator('button', { hasText: 'Deshacer' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Se deshizo' })).toBeVisible();
    expect(e.db.gastos_extra[0].cobrado).toBe(false);
    expect(cobrados(e)).toEqual([]);
    verificarLimpio(e);
  });

  test('el saldo a favor se descuenta de lo que se marca primero; lo que sobra queda para el resto', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ ajustes: [ajuste({ monto: -1000 })] }) });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await expect(p.locator('.fin-det-fila', { hasText: 'Pagó de más en agosto' })).toContainText('−$1.000');
    await casilla(p, '14/09').uncheck();
    await casilla(p, '21/09').uncheck();
    // 07/09 ($760) con el saldo (−$1.000): se usan $760 y queda en $0.
    await expect(p.locator('.fin-det-total')).toContainText('$0');
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    const aviso = page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' });
    await expect(aviso).toBeVisible();
    expect(cobrados(e)).toEqual([A]);
    expect(e.db.ajustes_saldo[0].aplicado).toBe(760);
    expect(e.db.ajustes_saldo[0].aplicaciones[0]).toMatchObject({ monto: -760, en: 'cobrado', sittings: [A] });
    // Lo que sobra (−$240) se descuenta de lo que quedó: $1.900 − $240 = $1.660.
    const fila = pendiente(porCobrar(page), 'Familia Prueba Uno').locator('.agendarow').first();
    await expect(fila).toContainText('Saldo: −$240');
    await expect(fila).toContainText('$1.660');
    // Deshacer devuelve el saldo usado.
    await aviso.locator('button', { hasText: 'Deshacer' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Se deshizo' })).toBeVisible();
    expect(e.db.ajustes_saldo[0].aplicado).toBe(0);
    expect(e.db.ajustes_saldo[0].aplicaciones).toEqual([]);
    expect(cobrados(e)).toEqual([]);
    verificarLimpio(e);
  });

  test('"¿Cuánto pagó?" cuenta el saldo a favor: pagó $260 = 07/09 ($760) − $500', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ ajustes: [ajuste()] }) });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await p.locator('.fin-det-pagado').fill('260');
    await expect(casilla(p, '07/09')).toBeChecked();
    await expect(casilla(p, '14/09')).not.toBeChecked();
    await expect(casilla(p, '21/09')).not.toBeChecked();
    await expect(casilla(p, 'Pagó de más en agosto')).toBeChecked();
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' })).toBeVisible();
    expect(cobrados(e)).toEqual([A]);
    expect(e.db.ajustes_saldo[0].aplicado).toBe(500);
    verificarLimpio(e);
  });

  test('destildar el saldo a favor lo deja entero para lo que queda', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos({ ajustes: [ajuste()] }) });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await casilla(p, '14/09').uncheck();
    await casilla(p, '21/09').uncheck();
    await casilla(p, 'Pagó de más en agosto').uncheck();
    await expect(p.locator('.fin-det-total')).toContainText('$760');
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' })).toBeVisible();
    expect(e.db.ajustes_saldo[0].aplicado).toBe(0);
    await expect(pendiente(porCobrar(page), 'Familia Prueba Uno').locator('.agendarow').first()).toContainText('Saldo: −$500');
    verificarLimpio(e);
  });
});

test('si la otra admin cambia algo (Realtime), el detalle abierto sigue abierto y con lo destildado', async ({ page }) => {
  const e = await abrirApp(page, { datos: datos() });
  await irAModulo(page, 'finanzas');
  const p = await abrirDetalle(page);
  await casilla(p, '07/09').uncheck();
  // La otra cambia el monto del 21/09 desde su celular.
  e.db.sittings_traslados.find(s => s.id === C).cobro_familia = 800;
  expect(e.emitirRealtime('sittings_traslados', 'UPDATE', { id: C })).toBeGreaterThan(0);
  await expect(pendiente(porCobrar(page), 'Familia Prueba Uno').locator('.agendarow').first()).toContainText('$2.700');
  const q = pendiente(porCobrar(page), 'Familia Prueba Uno');
  await expect(q.locator('.fin-pend-cabeza')).toHaveAttribute('aria-expanded', 'true');
  await expect(q.locator('.fin-det-fila', { hasText: '21/09' })).toContainText('$800');
  await expect(casilla(q, '07/09')).not.toBeChecked();
  await expect(casilla(q, '14/09')).toBeChecked();
  await expect(casilla(q, '21/09')).toBeChecked();
  await expect(q.locator('.fin-det-total')).toContainText('$1.940');
  verificarLimpio(e);
});

test.describe('fallas', () => {
  test('si no se puede leer el detalle, lo dice con "Reintentar" y no marca nada', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    // Solo la lectura del detalle (por id) falla.
    let fallar = true;
    await page.route(/\/rest\/v1\/sittings_traslados\?.*id=in\./, r => fallar && r.request().method() === 'GET'
      ? r.fulfill({ status: 500, json: { code: 'XX000', message: 'se cayó' } }) : r.fallback());
    const p = pendiente(porCobrar(page), 'Familia Prueba Uno');
    await p.locator('.fin-pend-cabeza').click();
    await expect(p.locator('.fin-det')).toContainText('No se pudo cargar el detalle (se cayó)');
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast', { hasText: 'Todavía no cargó el detalle' })).toBeVisible();
    expect(cobrados(e)).toEqual([]);
    fallar = false;
    await p.locator('.fin-det button', { hasText: 'Reintentar' }).click();
    await expect(p.locator('.fin-det-fila')).toHaveCount(3);
    verificarLimpio(e, { ignorar: [/se cayó|500/] });
  });

  test('si la base falla al marcar lo tildado, avisa y no se marca nada', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await casilla(p, '07/09').uncheck();
    e.fallar = ({ tabla, metodo }) => (tabla === 'sittings_traslados' && metodo === 'PATCH') ? { status: 500, message: 'se cayó' } : undefined;
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    await expect(page.locator('.toaststack .toast.bad', { hasText: 'No se pudo actualizar' })).toBeVisible();
    expect(cobrados(e)).toEqual([]);
    verificarLimpio(e, { ignorar: [/se cayó|500/] });
  });

  test('si "Deshacer" falla, avisa y lo cobrado queda como estaba', async ({ page }) => {
    const e = await abrirApp(page, { datos: datos() });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await casilla(p, '07/09').uncheck();
    await casilla(p, '21/09').uncheck();
    await p.locator('button', { hasText: 'Marcar cobrado' }).click();
    const aviso = page.locator('.toaststack .toast', { hasText: 'Marcado como cobrado.' });
    await expect(aviso).toBeVisible();
    e.fallar = ({ tabla, metodo }) => (tabla === 'sittings_traslados' && metodo === 'PATCH') ? 'red' : undefined;
    await aviso.locator('button', { hasText: 'Deshacer' }).click();
    await expect(page.locator('.toaststack .toast.bad', { hasText: 'No se pudo deshacer' })).toBeVisible();
    expect(cobrados(e)).toEqual([B]);
    verificarLimpio(e, { ignorar: [/Failed to fetch|ERR_FAILED|net::/] });
  });

  test('nombres con comillas y HTML en el detalle no se ejecutan', async ({ page }) => {
    const raro = `Ana "<img src=x onerror=window.__pwned=1>" O'Neil`;
    const d = datos();
    d.sittings_traslados[0].ninera_nombre = raro;
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'finanzas');
    const p = await abrirDetalle(page);
    await expect(p.locator('.fin-det-fila').first()).toContainText(raro);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    verificarLimpio(e);
  });
});

test('Por pagar: paga solo algunos registros de la semana de una fija', async ({ page }) => {
  const P1 = '72000000-0000-4000-8000-000000000001', P2 = '72000000-0000-4000-8000-000000000002';
  const sits = [
    sitting(P1, '2026-09-28', { asignacion_id: ID.aFijo, cobrado: true }),
    sitting(P2, '2026-09-30', { asignacion_id: ID.aFijo, cobrado: true, pago_ninera: 600 }),
  ];
  const e = await abrirApp(page, { datos: datos({ sits }) });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await irAModulo(page, 'finanzas');
  const p = pendiente(page.locator('#fin-porpagar-wrap'), 'Ana Ficticia');
  await expect(p.locator('.agendarow').first()).toContainText('$1.350');
  await p.locator('.fin-pend-cabeza').click();
  await expect(p.locator('.fin-det-fila')).toHaveCount(2);
  await expect(p.locator('.fin-det-pagado')).toHaveCount(0); // "¿Cuánto pagó?" es solo de Por cobrar
  await expect(p.locator('.fin-det-fila').first()).toContainText('Familia Prueba Uno');
  await casilla(p, '30/09').uncheck();
  await p.locator('button', { hasText: 'Copiar monto' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('750');
  await p.locator('button', { hasText: 'Marcar pagado' }).click();
  await expect(page.locator('#pago-total')).toHaveText('$750');
  await expect(page.locator('#pago-detalle .pago-fila')).toHaveCount(2); // el registro y el total
  await page.locator('#pago-confirmar').click();
  const aviso = page.locator('.toaststack .toast', { hasText: 'Marcado como pagado.' });
  await expect(aviso).toBeVisible();
  expect(e.db.sittings_traslados.filter(s => s.pagado).map(s => s.id)).toEqual([P1]);
  await expect(pendiente(page.locator('#fin-porpagar-wrap'), 'Ana Ficticia').locator('.agendarow').first()).toContainText('$600');
  await aviso.locator('button', { hasText: 'Deshacer' }).click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Se deshizo' })).toBeVisible();
  expect(e.db.sittings_traslados.filter(s => s.pagado)).toHaveLength(0);
  verificarLimpio(e);
});

test('en el celular (390 px): renglones de 44 px, casillas grandes y sin scroll de costado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const e = await abrirApp(page, { datos: datos({ gastos: [gasto()], ajustes: [ajuste()] }) });
  await irAModulo(page, 'finanzas');
  const p = await abrirDetalle(page);
  const filas = p.locator('.fin-det-fila');
  await expect(filas).toHaveCount(5); // 3 registros, 1 gasto, 1 saldo
  for (let i = 0; i < 5; i++) {
    const caja = await filas.nth(i).boundingBox();
    expect(caja.height).toBeGreaterThanOrEqual(44);
    const chk = await filas.nth(i).locator('input[type=checkbox]').boundingBox();
    expect(chk.width).toBeGreaterThanOrEqual(22);
  }
  const cabeza = await p.locator('.fin-pend-cabeza').boundingBox();
  expect(cabeza.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await p.screenshot({ path: 'test-results/cobro-parcial-390.png' });
  verificarLimpio(e);
});
