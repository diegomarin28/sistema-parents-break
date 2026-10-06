// Mejoras de Hoy (06/10/2026): aviso si la carga automática de los fijos de las 03:00 no anduvo
// (7), "Datos que faltan" (6) y fotos más livianas al subirlas (9). Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, sitting, ID } = require('./support/datos');

// Hoy en los tests: domingo 04/10/2026. El fijo de Ana es lunes y miércoles de 16 a 19.
const previsto = (id, fecha, extra = {}) => sitting(id, fecha, {
  asignacion_id: ID.aFijo, estado: 'previsto', generado_automatico: true, revisado_at: null,
  registrado_por: 'Automático', notas: 'Sitting fijo — cargado automáticamente', ...extra,
});
function datosConFijos(filas) {
  const d = datosBase();
  d.app_config = [{ id: 'fijos_automaticos', valor: { activo: true, dias: 14 }, actualizado_at: '2026-10-04T06:00:00Z' }];
  d.sittings_traslados = d.sittings_traslados.map(s => ({ ...s, estado: 'confirmado', generado_automatico: false, revisado_at: null }));
  d.sittings_traslados.push(...filas);
  d.asignaciones_pausas = [];
  return d;
}
const semanaCompleta = () => [previsto('a2000000-0000-4000-8000-000000000005', '2026-10-05'), previsto('a2000000-0000-4000-8000-000000000007', '2026-10-07')];
const rpcs = e => e.escrituras.filter(w => w.tabla === 'rpc/generar_previstos_fijos');

test.describe('aviso si la carga de las 03:00 no anduvo', () => {
  test('con los días de la semana cargados no avisa nada', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFijos(semanaCompleta()) });
    await esperarQuieta(page);
    await expect(page.locator('.corrida-aviso')).toHaveCount(0);
    verificarLimpio(e);
  });

  test('sin los días de la semana avisa y "Cargarlos ahora" corre la carga', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFijos([]) });
    const aviso = page.locator('.corrida-aviso');
    await expect(aviso).toContainText('no anduvo');
    await expect(aviso).toContainText('2 días de fijos de esta semana sin cargar');
    await aviso.locator('button', { hasText: 'Cargarlos ahora' }).click();
    await expect.poll(() => rpcs(e).length).toBe(1);
    verificarLimpio(e);
  });

  test('un previsto de hoy o de antes sin confirmar también avisa', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFijos([...semanaCompleta(), previsto('a2000000-0000-4000-8000-000000000030', '2026-09-30')]) });
    await expect(page.locator('.corrida-aviso')).toContainText('sin confirmar');
    verificarLimpio(e);
  });

  test('antes de las 04:00 no avisa (la carga corre a las 03:00)', async ({ page }) => {
    const e = await abrirApp(page, { datos: datosConFijos([]), ahora: '2026-10-04T03:30:00-03:00' });
    await esperarQuieta(page);
    await expect(page.locator('.corrida-aviso')).toHaveCount(0);
    verificarLimpio(e);
  });

  test('con los fijos automáticos apagados no avisa', async ({ page }) => {
    const e = await abrirApp(page);
    await esperarQuieta(page);
    await expect(page.locator('.corrida-aviso')).toHaveCount(0);
    verificarLimpio(e);
  });
});

test.describe('datos que faltan', () => {
  test('niñera con fijo sin teléfono ni cuenta, y familia con sittings sin tarifa', async ({ page }) => {
    const d = datosBase();
    d.ninieras = d.ninieras.map(n => n.id === ID.nAna ? { ...n, telefono: '', cuenta_bancaria: [] } : n);
    d.familias = d.familias.map(f => f.id === ID.fUno ? { ...f, cobro_hora: null } : f);
    const e = await abrirApp(page, { datos: d });
    const card = page.locator('.datos-faltan-card');
    await expect(card).toContainText('Ana Ficticia');
    await expect(card).toContainText('falta el teléfono y la cuenta para pagarle');
    await expect(card).toContainText('Familia Prueba Uno');
    await expect(card).toContainText('falta cuánto se le cobra por hora');
    await card.locator('.agendarow', { hasText: 'Familia Prueba Uno' }).locator('button', { hasText: 'Completar' }).click();
    await expect(page.locator('#editmodal')).toContainText('Familia Prueba Uno');
    verificarLimpio(e);
  });

  test('con todo cargado no aparece', async ({ page }) => {
    const d = datosBase();
    d.ninieras = d.ninieras.map(n => ({ ...n, telefono: n.telefono || '099000000', cuenta_bancaria: ['0001234567'] }));
    d.familias = d.familias.map(f => ({ ...f, cobro_hora: f.cobro_hora || 400, pago_hora: f.pago_hora || 260 }));
    const e = await abrirApp(page, { datos: d });
    await esperarQuieta(page);
    await expect(page.locator('.datos-faltan-card')).toHaveCount(0);
    verificarLimpio(e);
  });
});

test.describe('fotos livianas', () => {
  test('una foto grande se achica a 800 px en JPEG; una chica o que no se puede leer queda igual', async ({ page }) => {
    const e = await abrirApp(page);
    const r = await page.evaluate(async () => {
      const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
        for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${i % 360},70%,${30 + (i % 40)}%)`; x.fillRect((i * 37) % w, (i * 53) % h, 40, 40); } return c; };
      const aArchivo = (c, tipo, nombre) => new Promise(ok => c.toBlob(b => ok(new File([b], nombre, { type: tipo })), tipo));
      const grande = await aArchivo(lienzo(2400, 1800), 'image/png', 'foto grande.png');
      const achicada = await achicarFoto(grande);
      const img = await new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = URL.createObjectURL(achicada); });
      const chica = await aArchivo(lienzo(200, 150), 'image/jpeg', 'chica.jpg');
      const rota = new File([new Uint8Array([1, 2, 3])], 'rota.jpg', { type: 'image/jpeg' });
      const heic = new File([new Uint8Array([1, 2, 3])], 'foto.heic', { type: 'image/heic' });
      return { tipo: achicada.type, nombre: achicada.name, ancho: img.naturalWidth, alto: img.naturalHeight, antes: grande.size, despues: achicada.size,
        chicaIgual: (await achicarFoto(chica)) === chica, rotaIgual: (await achicarFoto(rota)) === rota, heicIgual: (await achicarFoto(heic)) === heic };
    });
    expect(r.tipo).toBe('image/jpeg');
    expect(r.nombre).toBe('foto grande.jpg');
    expect(Math.max(r.ancho, r.alto)).toBe(800);
    expect(r.despues).toBeLessThan(r.antes);
    expect(r.chicaIgual && r.rotaIgual && r.heicIgual).toBe(true);
    verificarLimpio(e);
  });
});
