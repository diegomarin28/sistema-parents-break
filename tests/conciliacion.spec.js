// Conciliación con el extracto (05/10/2026): cada coincidencia con casilla; las seguras
// tildadas, las dudosas destildadas y con el motivo; nada se marca sin confirmar.
// Datos ficticios: Familia Prueba Uno (cuenta 0001234567, mensual) debe $2.280 de setiembre;
// Familia Prueba Dos (sin cuenta, semanal) debe $450; Ana (cuenta 0099887766) tiene $750 por
// pagar de la semana del 28/09.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const ID_SEP = ['70000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003'];
async function procesar(page, csv) {
  await page.setInputFiles('#fin-conciliar-file', { name: 'extracto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.locator('button[onclick*="procesarExtractoConciliacion"]').click();
  await expect(page.locator('#fin-conciliar-resultado')).toContainText(/créditos? leídos? del extracto/);
}
const fila = (page, texto) => page.locator('.conc-fila', { hasText: texto });
const boton = (page, tipo) => page.locator(`#conc-btn-${tipo}`);
const escriturasSittings = e => e.escrituras.filter(w => w.tabla === 'sittings_traslados');

test('coincidencia segura: viene tildada, pero no se marca nada hasta confirmar', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await procesar(page, 'Fecha;Concepto;Crédito\n03/10/2026;TRANSF 0001234567 FAMILIA;2.280,00\n');
  const f = fila(page, 'Familia Prueba Uno');
  await expect(f.locator('input')).toBeChecked();
  await expect(f).not.toHaveClass(/conc-dudosa/);
  await expect(f).toContainText('Setiembre de 2026');
  await expect(boton(page, 'cobro')).toHaveText('Marcar cobrado lo tildado (1 · $2.280)');
  expect(escriturasSittings(e)).toEqual([]); // procesar solo deja la marca en app_config

  await boton(page, 'cobro').click();
  const modal = page.locator('[aria-label="Confirmar cobros"]');
  await expect(modal).toContainText('Familia Prueba Uno');
  await expect(modal.locator('#cobro-total')).toHaveText('$2.280');
  await modal.locator('button', { hasText: 'Cancelar' }).click();
  expect(escriturasSittings(e)).toEqual([]);

  await boton(page, 'cobro').click();
  await page.locator('[aria-label="Confirmar cobros"] button', { hasText: 'Confirmar cobro' }).click();
  await expect(page.locator('.toaststack .toast').last()).toContainText('Marcado como cobrado (1)');
  const w = escriturasSittings(e);
  expect(w).toHaveLength(1);
  expect(w[0].cuerpo).toEqual({ cobrado: true });
  expect(w[0].params.id.replace(/^in\.\(|\)$/g, '').split(',').sort()).toEqual(ID_SEP);
  await expect(f).toHaveClass(/conc-hecha/);
  await expect(f.locator('input')).toBeDisabled();
  verificarLimpio(e);
});

test('sin cuenta (CAMBIOS) y mismo monto: dudosa, destildada y con el motivo', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await procesar(page, 'Fecha;Concepto;Crédito\n22/09/2026;CAMBIOS VARIOS;450\n');
  const f = fila(page, 'Familia Prueba Dos');
  await expect(f.locator('input')).not.toBeChecked();
  await expect(f).toHaveClass(/conc-dudosa/);
  await expect(f.locator('.conc-motivo')).toContainText('Sin cuenta en el extracto');
  await expect(boton(page, 'cobro')).toBeDisabled();
  // Si la elige a mano, se puede confirmar igual.
  await f.locator('input').check();
  await expect(boton(page, 'cobro')).toBeEnabled();
  await boton(page, 'cobro').click();
  await expect(page.locator('[aria-label="Confirmar cobros"]')).toContainText('dudosa, elegida a mano');
  await page.locator('[aria-label="Confirmar cobros"] button', { hasText: 'Confirmar cobro' }).click();
  await expect(page.locator('.toaststack .toast').last()).toContainText('Marcado como cobrado');
  expect(escriturasSittings(e)[0].params.id).toBe('in.(70000000-0000-4000-8000-000000000004)');
  verificarLimpio(e);
});

test('el mismo monto con varias familias: una opción por familia, todas destildadas', async ({ page }) => {
  const d = datosBase();
  // Familia Uno también tiene un puntual semanal-like de $450: dos pendientes de $450.
  d.familias[0].frecuencia_cobro = 'semanal';
  d.sittings_traslados = [
    sitting('70000000-0000-4000-8000-0000000000b1', '2026-09-16', { cobro_familia: 450 }),
    d.sittings_traslados[3],
  ];
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'finanzas');
  await procesar(page, 'Fecha;Concepto;Crédito\n25/09/2026;CAMBIOS;450\n');
  const filas = page.locator('.conc-fila');
  await expect(filas).toHaveCount(2);
  for (const nombre of ['Familia Prueba Uno', 'Familia Prueba Dos']) {
    await expect(fila(page, nombre).locator('input')).not.toBeChecked();
    await expect(fila(page, nombre).locator('.conc-motivo')).toContainText('el mismo monto coincide con 2 pendientes');
  }
  expect(escriturasSittings(e)).toEqual([]);
  verificarLimpio(e);
});

test('cuenta conocida con monto distinto: dudosa, no se marca sola', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await procesar(page, 'Fecha;Concepto;Crédito\n03/10/2026;TRANSF 0001234567;2000\n');
  const f = fila(page, 'Familia Prueba Uno');
  await expect(f.locator('input')).not.toBeChecked();
  await expect(f.locator('.conc-motivo')).toContainText('Monto distinto: el extracto dice $2.000 y lo pendiente es $2.280');
  verificarLimpio(e);
});

test('movimientos que no coinciden con nada quedan listados para revisar a mano', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await procesar(page, 'Fecha;Concepto;Crédito\n03/10/2026;TRANSF 0005555555;1234\n04/10/2026;CAMBIOS;99\n');
  const res = page.locator('#fin-conciliar-resultado');
  await expect(res).toContainText('Sin coincidencia');
  await expect(res).toContainText('La cuenta no está cargada en ninguna ficha');
  await expect(res).toContainText('Sin cuenta en el concepto y ningún pendiente con ese monto');
  await expect(page.locator('.conc-fila')).toHaveCount(0);
  verificarLimpio(e);
});

test('pagos a niñeras: el débito a la cuenta de Ana viene tildado y se confirma con el detalle de E3', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await procesar(page, 'Fecha;Concepto;Débito;Crédito\n04/10/2026;TRANSF A 0099887766;750;\n05/10/2026;UTE;1500;\n');
  const f = page.locator('[data-conc-seccion="pago"] .conc-fila', { hasText: 'Ana Ficticia' });
  await expect(f.locator('input')).toBeChecked();
  await expect(page.locator('#fin-conciliar-resultado')).not.toContainText('UTE'); // gastos que no son niñeras no se listan
  await boton(page, 'pago').click();
  const modal = page.locator('[aria-label="Confirmar pago"]');
  await expect(modal).toContainText('Ana Ficticia');
  await expect(modal.locator('#pago-total')).toHaveText('$750');
  expect(escriturasSittings(e)).toEqual([]);
  await modal.locator('button', { hasText: 'Confirmar pago' }).click();
  await expect(page.locator('.toaststack .toast').last()).toContainText('Marcado como pagado (1)');
  expect(escriturasSittings(e)).toEqual([expect.objectContaining({ metodo: 'PATCH', cuerpo: { pagado: true }, params: { id: 'in.(70000000-0000-4000-8000-000000000003)' } })]);
  verificarLimpio(e);
});

test('una familia que paga dos meses juntos: se propone todo junto y tildado', async ({ page }) => {
  const d = datosBase();
  d.sittings_traslados.push(sitting('70000000-0000-4000-8000-0000000000c1', '2026-10-01', {}));
  const e = await abrirApp(page, { datos: d });
  await irAModulo(page, 'finanzas');
  await procesar(page, 'Fecha;Concepto;Crédito\n03/10/2026;TRANSF 0001234567;3420\n');
  const f = fila(page, 'Familia Prueba Uno');
  await expect(f.locator('input')).toBeChecked();
  await expect(f).toContainText('Pagó varios períodos juntos');
  await expect(f).toContainText('$3.420');
  verificarLimpio(e);
});
