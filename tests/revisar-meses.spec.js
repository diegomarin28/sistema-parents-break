// Revisar meses en Finanzas (15/10/2026): ver y corregir cualquier mes pasado, incluido el
// histórico migrado, con las filas sospechosas arriba y su motivo. Hoy en los tests = 04/10/2026.
// En los histórico solo cuentan pago >= cobro (con los dos montos) y la misma línea repetida.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const S = n => `7a000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function revisarMes(page, mes) {
  await page.evaluate(async m => { finMes = m; await cargarFinanzas(); }, mes);
  await page.locator('#fin-vista-revisar').click();
  await esperarQuieta(page);
}
const fila = (page, id) => page.locator(`#fin-revisar .fin-rev-fila[data-id="${id}"]`);

function datosAgosto() {
  const d = datosBase();
  d.sittings_traslados.push(
    sitting(S(1), '2026-08-03'), // bien: 3 hs a $380 = $1.140, pago $750
    sitting(S(2), '2026-08-04', { cobro_familia: 0 }),
    sitting(S(3), '2026-08-05', { pago_ninera: 1100 }), // margen 4%
    sitting(S(4), '2026-08-06', { pago_ninera: 1200 }), // pago >= cobro
    sitting(S(5), '2026-08-07'), sitting(S(6), '2026-08-07'), // duplicados
    sitting(S(7), '2026-08-10', { familia_id: null }),
    sitting(S(8), '2026-08-11', { hora_inicio: null, hora_fin: null }),
    sitting(S(9), '2026-08-12', { cobro_familia: 2000 }), // la tarifa da $1.140
    sitting(S(10), '2026-08-13', { pagado: true, cobrado: false }), // más de 30 días
    sitting(S(11), '2026-08-14', { cobro_familia: 0, pago_ninera: 0, cancelado: true }), // "no fue": no se marca
    sitting(S(12), '2026-08-17', { cobro_familia: 0, revisado_at: '2026-10-01T12:00:00Z' }), // ya revisado
  );
  return d;
}

test('marca arriba las filas sospechosas del mes, con su motivo y el contador', async ({ page }) => {
  const e = await abrirApp(page, { datos: datosAgosto() });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2026-08');
  await expect(page.locator('#fin-rev-total')).toHaveText('9 para revisar');
  await expect(page.locator('#fin-revisar-cuenta')).toHaveText('9');
  const sosp = page.locator('#fin-rev-sospechosas');
  await expect(sosp.locator('.fin-rev-fila')).toHaveCount(9);
  await expect(fila(page, S(2))).toContainText('Cobro en $0 sin estar cancelado');
  await expect(fila(page, S(3))).toContainText('Margen 4% (menos del 10%)');
  await expect(fila(page, S(4))).toContainText('Pago a la niñera ($1.200) mayor o igual al cobro ($1.140)');
  await expect(fila(page, S(5))).toContainText('Posible duplicado: hay 2 registros iguales ese día');
  await expect(fila(page, S(6))).toContainText('Posible duplicado');
  await expect(fila(page, S(7))).toContainText('Sin familia vinculada');
  await expect(fila(page, S(8))).toContainText('Sitting sin horario');
  await expect(fila(page, S(9))).toContainText('Cobro $2.000; con la tarifa de la familia daría $1.140');
  await expect(fila(page, S(10))).toContainText('Pagado a la niñera y sin cobrar hace más de 30 días');
  // Bien, cancelado y ya revisado: abajo, sin motivo.
  for (const id of [S(1), S(11), S(12)]) {
    await expect(page.locator('#fin-rev-resto').locator(`.fin-rev-fila[data-id="${id}"]`)).toBeVisible();
    await expect(fila(page, id).locator('.fin-rev-motivo')).toHaveCount(0);
  }
  await expect(fila(page, S(1))).toContainText('App');
  verificarLimpio(e);
});

test('histórico: solo pago >= cobro con los dos montos y la misma línea repetida', async ({ page }) => {
  const d = datosBase();
  const h = (n, fecha, extra) => sitting(S(n), fecha, { fuente: 'historico', familia_id: null, ninera_id: null, hora_inicio: null, hora_fin: null, ...extra });
  d.sittings_traslados.push(
    h(20, '2025-03-03', { cobro_familia: 1000, pago_ninera: 0 }), // solo cobro: así vino
    h(21, '2025-03-03', { cobro_familia: 0, pago_ninera: 600 }), // solo pago, mismo día: otra línea
    h(22, '2025-03-04', { cobro_familia: 500, pago_ninera: 500 }), // pago >= cobro
    h(23, '2025-03-05', { cobro_familia: 0, pago_ninera: 700 }), h(24, '2025-03-05', { cobro_familia: 0, pago_ninera: 700 }), // misma línea
    h(25, '2025-03-06', { cobro_familia: 0, pago_ninera: 700 }), h(26, '2025-03-06', { cobro_familia: 0, pago_ninera: 650 }), // montos distintos
    h(27, '2025-03-07', { cobro_familia: 3000, pago_ninera: 200 }), // precio raro: en el histórico no se mira
  );
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2025-03');
  await expect(page.locator('#fin-rev-total')).toHaveText('3 para revisar');
  await expect(fila(page, S(22))).toContainText('Pago a la niñera ($500) mayor o igual al cobro ($500)');
  await expect(fila(page, S(23))).toContainText('Posible duplicado');
  await expect(fila(page, S(24))).toContainText('Posible duplicado');
  for (const id of [S(20), S(21), S(25), S(26), S(27)]) await expect(fila(page, id).locator('.fin-rev-motivo')).toHaveCount(0);
  await expect(fila(page, S(20))).toContainText('Histórico');
  verificarLimpio(e);
});

test('"Revisado" guarda la marca, saca la fila de las sospechosas y baja el contador', async ({ page }) => {
  const e = await abrirApp(page, { datos: datosAgosto() });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2026-08');
  await fila(page, S(2)).locator('.fin-rev-ok').click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Marcado como revisado.' })).toBeVisible();
  await expect(page.locator('#fin-rev-total')).toHaveText('8 para revisar');
  await expect(page.locator('#fin-rev-resto').locator(`.fin-rev-fila[data-id="${S(2)}"]`)).toContainText('Revisado');
  const w = e.escrituras.find(x => x.tabla === 'sittings_traslados' && x.metodo === 'PATCH');
  expect(w.params.id).toBe(`eq.${S(2)}`);
  expect(Object.keys(w.cuerpo)).toEqual(['revisado_at']);
  verificarLimpio(e);
});

test('editar un sitting desde Revisar meses recalcula los totales del mes', async ({ page }) => {
  const e = await abrirApp(page, { datos: datosAgosto() });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2026-08');
  const antes = Number((await page.locator('#fin-facturado').innerText()).replace(/[$.]/g, ''));
  await fila(page, S(2)).locator('button', { hasText: 'Editar' }).click();
  await page.locator('#fin-mov-cobro').fill('1140');
  await page.locator('#editmodal .confirmbtns button', { hasText: 'Guardar' }).click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Movimiento actualizado.' })).toBeVisible();
  await expect(page.locator('#fin-facturado')).toHaveText('$' + (antes + 1140).toLocaleString('es-UY'));
  await expect(page.locator('#fin-rev-total')).toHaveText('8 para revisar');
  await expect(page.locator('#fin-revisar')).toBeVisible(); // sigue en la misma vista
  verificarLimpio(e);
});

test('gasto general: se edita desde el mes y muestra quién lo cambió', async ({ page }) => {
  const d = datosBase();
  const G = '90000000-0000-4000-8000-000000000001';
  d.finanzas_historial = [{ id: 1, tabla: 'gastos_generales', fila_id: G, accion: 'cambio', usuario: 'prueba@ejemplo.test', cuando: '2026-10-02T15:00:00Z', cambios: { monto: { antes: 400, despues: 500 } }, fila: null }];
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2026-09');
  await page.locator('#fin-rev-generales button', { hasText: 'Editar' }).click();
  await expect(page.locator('#fin-hist-box .fin-hist-fila')).toContainText('Monto: 400 → 500');
  await expect(page.locator('#fin-hist-box')).toContainText('prueba@ejemplo.test');
  await page.locator('#ed-gasto-monto').fill('650');
  await page.locator('#editmodal .confirmbtns button', { hasText: 'Guardar' }).click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Cambios guardados.' })).toBeVisible();
  expect(e.db.gastos_generales[0].monto).toBe(650);
  await expect(page.locator('#fin-rev-generales')).toContainText('$650');
  verificarLimpio(e);
});

test('saldo a favor: no baja de lo ya usado y se guarda con fecha, motivo y monto', async ({ page }) => {
  const d = datosBase();
  const A = 'a5000000-0000-4000-8000-000000000009';
  d.ajustes_saldo = [{ id: A, sujeto: 'familia', familia_id: ID.fUno, ninera_id: null, nombre: 'Familia Prueba Uno', monto: -300, motivo: 'Motivo de prueba', fecha: '2026-09-10', aplicado: 100, aplicaciones: [], creado_por: null, created_at: '2026-09-10T12:00:00Z' }];
  d.gastos_extra = [];
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2026-09');
  await page.locator('#fin-revisar .fin-rev-filtro[data-filtro="saldos"]').click();
  await page.locator('#fin-rev-saldos button', { hasText: 'Editar' }).click();
  await page.locator('#fin-aj-monto').fill('-50');
  await page.locator('#editmodal .confirmbtns button', { hasText: 'Guardar' }).click();
  await expect(page.locator('#fin-aj-warn')).toContainText('Ya se usaron $100');
  expect(e.escrituras.filter(x => x.tabla === 'ajustes_saldo')).toHaveLength(0);
  await page.locator('#fin-aj-monto').fill('-250');
  await page.locator('#fin-aj-motivo').fill('Motivo corregido');
  await page.locator('#editmodal .confirmbtns button', { hasText: 'Guardar' }).click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Cambios guardados.' })).toBeVisible();
  expect(e.db.ajustes_saldo[0]).toMatchObject({ monto: -250, motivo: 'Motivo corregido', fecha: '2026-09-10' });
  verificarLimpio(e);
});

test('gasto extra: se corrige el monto desde Finanzas', async ({ page }) => {
  const d = datosBase();
  const GX = 'ab000000-0000-4000-8000-000000000001';
  d.gastos_extra = [{ id: GX, sitting_id: '70000000-0000-4000-8000-000000000003', concepto: 'Almuerzo de prueba', monto: 300, pagado_por: 'ninera', comprobante: 'x/ticket.jpg', cobrado: false, reintegrado: false, ajuste_id: null, creado_por: null, created_at: '2026-09-28T12:00:00Z', absorbe_pb: false }];
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2026-09');
  await expect(page.locator('#fin-rev-extra')).toContainText('Almuerzo de prueba');
  await page.locator('#fin-rev-extra button', { hasText: 'Editar' }).click();
  await page.locator('#fin-gx-monto').fill('350');
  await page.locator('#editmodal .confirmbtns button', { hasText: 'Guardar' }).click();
  await expect(page.locator('.toaststack .toast', { hasText: 'Gasto guardado.' })).toBeVisible();
  expect(e.db.gastos_extra[0].monto).toBe(350);
  verificarLimpio(e);
});

test('base sin la migración del historial: se revisa y se edita igual, con aviso', async ({ page }) => {
  const e = await abrirApp(page, { baseSinMigrar: true });
  await irAModulo(page, 'finanzas');
  await revisarMes(page, '2026-09');
  await expect(page.locator('#fin-rev-total')).toHaveText('Nada para revisar');
  await page.locator('#fin-rev-generales button', { hasText: 'Editar' }).click();
  await expect(page.locator('#fin-hist-box')).toContainText('todavía no está activado');
  verificarLimpio(e, { ignorar: [/Failed to load resource/] });
});
