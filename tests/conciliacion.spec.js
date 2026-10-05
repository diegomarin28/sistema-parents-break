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

// Lectores por formato (05/10/2026): leer el extracto está separado de conciliar, para sumar
// Mercado Pago agregando un lector. Los extractos de acá son INVENTADOS (nunca uno real).
test('extracto con encabezado de banco, saldos y débito/crédito: se leen solo los movimientos', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  const csv = [
    'Estado de cuenta;;;;',
    'Cuenta;CAJA DE AHORRO $ 0000000;;;',
    'Período;01/10/2026 al 05/10/2026;;;',
    ';;;;',
    'Fecha;Descripción;Débito;Crédito;Saldo',
    ';SALDO ANTERIOR;;;10.000,00',
    '03/10/2026;TRANSF RECIBIDA 0001234567;;2.280,00;12.280,00',
    '04/10/2026;COMPRA SUPERMERCADO;350,50;;11.929,50',
    ';SALDO FINAL;;;11.929,50',
  ].join('\n');
  await procesar(page, csv);
  await expect(page.locator('#fin-conciliar-resultado')).toContainText('1 crédito leído del extracto');
  await expect(fila(page, 'Familia Prueba Uno').locator('input')).toBeChecked();
  await expect(page.locator('#fin-conciliar-resultado')).not.toContainText('SALDO');
  verificarLimpio(e);
});

test('archivo que ningún lector reconoce: avisa qué formatos entiende y no marca nada', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  await page.setInputFiles('#fin-conciliar-file', { name: 'otro.csv', mimeType: 'text/csv', buffer: Buffer.from('Día;Importe\n03/10/2026;2280\n') });
  await page.locator('button[onclick*="procesarExtractoConciliacion"]').click();
  await expect(page.locator('#fin-conciliar-resultado')).toContainText('No reconocí el formato del archivo. Formatos que entiendo: Itaú.');
  expect(e.escrituras).toEqual([]);
  verificarLimpio(e);
});

test('un lector nuevo (Mercado Pago de prueba) concilia sin tocar el resto', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'finanzas');
  // Formato inventado con otra forma: monto con signo en una sola columna y la cuenta aparte.
  await page.evaluate(() => {
    LECTORES_EXTRACTO.unshift({
      id: 'prueba-mp', nombre: 'Mercado Pago (prueba)',
      reconoce: filas => (filas[0] || []).join('|') === 'FECHA_ORIGEN|CONTRAPARTE|CUENTA_ORIGEN|MONTO' ? {} : null,
      leer: filas => filas.slice(1).filter(f => f[0]).map(f => {
        const monto = parseMontoExtracto(f[3]);
        return { fecha: parseFechaExtracto(f[0]), concepto: f[1], cuenta: soloDigitos(f[2]), credito: monto > 0 ? monto : 0, debito: monto < 0 ? -monto : 0 };
      }),
    });
  });
  await procesar(page, 'FECHA_ORIGEN;CONTRAPARTE;CUENTA_ORIGEN;MONTO\n2026-10-03;Familia;0001234567;2280\n2026-10-04;Ana;0099887766;-750\n');
  await expect(fila(page, 'Familia Prueba Uno').locator('input')).toBeChecked();
  await expect(page.locator('[data-conc-seccion="pago"] .conc-fila', { hasText: 'Ana Ficticia' }).locator('input')).toBeChecked();
  verificarLimpio(e);
});
