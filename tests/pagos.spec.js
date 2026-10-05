// Pagos a niñeras (PR 6, 05/10/2026):
// - E3: antes de marcar pagado se confirma viendo cada sitting (niñera, familia, fecha,
//   horario, monto) y el total, con Cancelar / Confirmar. Grupo de Por pagar o uno solo.
// - Por pagar no muestra sittings con fecha futura hasta que llega su día (E7: se le pagó a
//   una niñera un sitting cargado por adelantado).
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

const FUTURO = '70000000-0000-4000-8000-0000000000f1';
function datosConFuturo() {
  const d = datosBase();
  // Puntual de Bruno con Familia Dos, cargado hoy (04/10) para el sábado 10/10.
  d.sittings_traslados.push(sitting(FUTURO, '2026-10-10', {
    familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', ninera_id: ID.nBruno, ninera_nombre: 'Bruno Inventado',
    hora_inicio: '20:00:00', hora_fin: '23:00:00', cobro_familia: 1200, pago_ninera: 780, created_at: '2026-10-04T15:00:00Z',
  }));
  return d;
}
const porPagar = page => page.locator('#fin-porpagar-wrap');
const modalPago = page => page.locator('.confirmoverlay [aria-label="Confirmar pago"]');

test.describe('Por pagar sin sittings futuros', () => {
  test('un sitting del sábado que viene no aparece hoy', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFuturo(), ahora: '2026-10-04T12:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(porPagar(page)).toContainText('Por pagar');
    await expect(porPagar(page)).not.toContainText('$780');
    expect(await page.evaluate(() => [...document.querySelectorAll('#fin-porpagar-wrap button')].map(b => b.getAttribute('onclick')).join(' '))).not.toContain(FUTURO);
    verificarLimpio(e);
  });

  test('el mismo sitting aparece el día que ocurre', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFuturo(), ahora: '2026-10-10T09:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    await expect(porPagar(page)).toContainText('Bruno Inventado');
    await expect(porPagar(page)).toContainText('$780');
    verificarLimpio(e);
  });
});

test.describe('E3: confirmar antes de marcar pagado', () => {
  test('grupo de Por pagar: muestra cada sitting y el total; Cancelar no toca nada', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFuturo(), ahora: '2026-10-10T09:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    const fila = porPagar(page).locator('.agendarow', { hasText: 'Bruno Inventado' }).filter({ hasText: '$780' });
    await fila.locator('button', { hasText: 'Marcar pagado' }).click();
    const modal = modalPago(page);
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toHaveText('Confirmar pago a Bruno Inventado');
    const filas = await modal.locator('#pago-detalle .pago-fila:not(.pago-total-fila)').allInnerTexts();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatch(/Familia Prueba Dos\s+Bruno Inventado · sáb\.?,? 10\/10 · 20:00–23:00\s+\$780/);
    await expect(modal.locator('#pago-total')).toHaveText('$780');
    await modal.locator('button', { hasText: 'Cancelar' }).click();
    await expect(modal).toHaveCount(0);
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });

  test('grupo de Por pagar: Confirmar marca exactamente esos sittings', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFuturo(), ahora: '2026-10-10T09:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    const fila = porPagar(page).locator('.agendarow', { hasText: 'Bruno Inventado' }).filter({ hasText: '$780' });
    await fila.locator('button', { hasText: 'Marcar pagado' }).click();
    await modalPago(page).locator('button', { hasText: 'Confirmar pago' }).click();
    await expect(page.locator('.toaststack .toast').last()).toContainText('Marcado como pagado');
    const w = e.escrituras.filter(x => x.tabla === 'sittings_traslados');
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ metodo: 'PATCH', cuerpo: { pagado: true }, params: { id: `in.(${FUTURO})` } });
    verificarLimpio(e);
  });

  test('grupo con varios sittings: lista todos y suma bien', async ({ page }) => {
    const d = datosBase();
    // Tres puntuales de Carla el mismo día (se pagan por día), en dos familias.
    d.sittings_traslados.push(
      sitting('70000000-0000-4000-8000-0000000000a1', '2026-10-02', { ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', hora_inicio: '09:00:00', hora_fin: '11:00:00', pago_ninera: 500 }),
      sitting('70000000-0000-4000-8000-0000000000a2', '2026-10-02', { ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', familia_id: ID.fDos, familia_nombre: 'Familia Prueba Dos', hora_inicio: '12:00:00', hora_fin: '14:30:00', pago_ninera: 650.5 }),
      sitting('70000000-0000-4000-8000-0000000000a3', '2026-10-02', { ninera_id: ID.nCarla, ninera_nombre: 'Carla Ejemplo', hora_inicio: '22:00:00', hora_fin: '01:00:00', termina_dia_siguiente: true, pago_ninera: 820 }),
    );
    const e = await abrirApp(page, { datos: d });
    await irAModulo(page, 'finanzas');
    await porPagar(page).locator('.agendarow', { hasText: 'Carla Ejemplo' }).locator('button').click();
    const modal = modalPago(page);
    const filas = await modal.locator('#pago-detalle .pago-fila:not(.pago-total-fila)').allInnerTexts();
    expect(filas).toHaveLength(3);
    expect(filas[2]).toContain('22:00–01:00 (+1 día)');
    // 500 + 650,5 + 820 = 1970,5: el modal muestra los centavos, igual que Por pagar.
    await expect(modal.locator('#pago-total')).toHaveText('$1.970,5');
    await expect(porPagar(page)).toContainText('$1.970,5');
    await modal.locator('button', { hasText: 'Confirmar pago' }).click();
    await expect(page.locator('.toaststack .toast').last()).toContainText('Marcado como pagado');
    const w = e.escrituras.find(x => x.tabla === 'sittings_traslados');
    expect(w.params.id.replace(/^in\.\(|\)$/g, '').split(',').sort()).toEqual(['70000000-0000-4000-8000-0000000000a1', '70000000-0000-4000-8000-0000000000a2', '70000000-0000-4000-8000-0000000000a3']);
    verificarLimpio(e);
  });

  test('un movimiento solo: tildar "Ya se le pagó" pide confirmación con el monto nuevo', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'finanzas');
    await page.evaluate(async () => { finMes = '2026-09'; await cargarFinanzas(); });
    await esperarQuieta(page);
    const id = '70000000-0000-4000-8000-000000000003'; // 28/09, sin pagar
    await page.evaluate(i => editarMovimientoSitting(i), id);
    await page.fill('#fin-mov-pago', '800');
    await page.check('#fin-mov-pagado');
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    const modal = modalPago(page);
    await expect(modal.locator('#pago-total')).toHaveText('$800');
    await expect(modal).toContainText('Ana Ficticia');
    await expect(modal).toContainText('16:00–19:00');
    await modal.locator('button', { hasText: 'Cancelar' }).click();
    // Cancelar deja el formulario abierto y no guarda nada.
    await expect(page.locator('#editmodal')).toHaveCount(1);
    expect(e.escrituras).toEqual([]);
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    await modalPago(page).locator('button', { hasText: 'Confirmar pago' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    expect(e.escrituras.find(x => x.tabla === 'sittings_traslados').cuerpo).toMatchObject({ pagado: true, pago_ninera: 800 });
    verificarLimpio(e);
  });

  test('si ya estaba pagado o se marca cobrado, no se pide confirmación de pago', async ({ page }) => {
    const e = await abrirApp(page);
    await irAModulo(page, 'finanzas');
    await page.evaluate(async () => { finMes = '2026-09'; await cargarFinanzas(); });
    await esperarQuieta(page);
    await page.evaluate(i => editarMovimientoSitting(i), '70000000-0000-4000-8000-000000000002'); // ya pagado
    await page.check('#fin-mov-cobrado');
    await page.locator('#editmodal button', { hasText: 'Guardar' }).click();
    await expect(page.locator('#editmodal')).toHaveCount(0);
    await expect(modalPago(page)).toHaveCount(0);
    expect(e.escrituras).toHaveLength(1);
    verificarLimpio(e);
  });

  test('si por algún camino se va a pagar algo futuro, el modal lo avisa', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFuturo(), ahora: '2026-10-04T12:00:00-03:00' });
    await irAModulo(page, 'finanzas');
    const ok = page.evaluate(id => marcarGrupoResuelto([id], 'pagado'), FUTURO);
    await expect(modalPago(page)).toContainText('todavía no ocurrió');
    await modalPago(page).locator('button', { hasText: 'Cancelar' }).click();
    await ok;
    expect(e.escrituras).toEqual([]);
    verificarLimpio(e);
  });
});
