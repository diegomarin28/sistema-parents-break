// Filtro de Niñeras por Punta del Este y por meses (21/10/2026, reglas de Paulina y Delfina):
// - quien tiene Punta del Este como única zona y no cargó temporada cuenta como que está ahí
//   todo el año (con la marca "Sin temporada cargada");
// - con temporada, está solo en las quincenas que marcó;
// - quien dijo que no va: sin meses aparece con "Dijo que no va", con meses no aparece;
// - con un mes elegido, las que no cargaron temporada van aparte, "sin temporada cargada";
// - escribir "Punta del Este" en el buscador es lo mismo que marcar la zona.
// Datos inventados.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const TODO_EL_ANIO = [...Array(24).keys()];
function datos() {
  const d = datosBase();
  const base = d.ninieras[0];
  const nin = (i, nombre, zona, quincenasPunta) => ({
    ...base, id: `3f000000-0000-4000-8000-00000000000${i}`, nombre, zona, barrios: zona, candidata_id: null,
    temporada: quincenasPunta ? { [ID.zPunta]: quincenasPunta } : null,
    temporada_actualizada_en: quincenasPunta ? '2026-10-01T12:00:00Z' : null,
    temporada_token: `6f000000-0000-4000-8000-00000000000${i}`,
  });
  d.ninieras = [
    nin(1, 'Ana Vive en Punta', 'Punta del Este', null),
    nin(2, 'Bea Punta Todo el Año', 'Punta del Este', TODO_EL_ANIO),
    nin(3, 'Clara No Va', 'Pocitos/Punta del Este', []),
    nin(4, 'Dora Punta en Enero', 'Pocitos/Punta del Este', [0, 1]),
    nin(5, 'Eva Pocitos Sin Temporada', 'Pocitos', null),
    nin(6, 'Fio Pocitos y Punta Sin Temporada', 'Pocitos/Punta del Este', null),
  ];
  return d;
}
const grid = page => page.locator('#ninierasgrid');
const nombres = page => page.locator('#ninierasgrid .person-list').first().locator('.name').allInnerTexts();
const sinTemporada = page => page.locator('#nin-sin-temporada + .person-list .name').allInnerTexts();
const fila = (page, nombre) => page.locator('#ninierasgrid .person-row', { hasText: nombre });
async function abrir(page) {
  const e = await abrirApp(page, { datos: datos() });
  await irAModulo(page, 'ninieras');
  return e;
}
const marcarPunta = page => page.evaluate(() => toggleFiltroZonaNin(claveZona('Punta del Este'), true));
const marcarPocitos = page => page.evaluate(() => toggleFiltroZonaNin(claveZona('Pocitos'), true));
const mes = (page, m) => page.evaluate(m => toggleFiltroMes(m), m);

test('Punta del Este sin meses: todas las que tienen la zona; la que no va, con su marca', async ({ page }) => {
  const e = await abrir(page);
  await marcarPunta(page);
  expect((await nombres(page)).sort()).toEqual(['Ana Vive en Punta', 'Bea Punta Todo el Año', 'Clara No Va', 'Dora Punta en Enero', 'Fio Pocitos y Punta Sin Temporada']);
  await expect(fila(page, 'Clara No Va')).toContainText('Dijo que no va');
  await expect(fila(page, 'Ana Vive en Punta')).toContainText('Sin temporada cargada');
  await expect(fila(page, 'Bea Punta Todo el Año')).not.toContainText('Dijo que no va');
  verificarLimpio(e);
});

test('Punta del Este en enero: la que vive allá sin temporada cuenta; la que no va, no; la mixta sin temporada, aparte', async ({ page }) => {
  const e = await abrir(page);
  await marcarPunta(page);
  await mes(page, 0);
  expect((await nombres(page)).sort()).toEqual(['Ana Vive en Punta', 'Bea Punta Todo el Año', 'Dora Punta en Enero']);
  expect(await sinTemporada(page)).toEqual(['Fio Pocitos y Punta Sin Temporada']);
  await expect(grid(page)).not.toContainText('Clara No Va');
  await expect(grid(page)).toContainText('3 en Punta del Este todo enero, 1 sin temporada cargada.');
  await expect(fila(page, 'Ana Vive en Punta')).toContainText('Sin temporada cargada');
  verificarLimpio(e);
});

test('Punta del Este en junio: solo las que están todo el año (y la que vive allá)', async ({ page }) => {
  const e = await abrir(page);
  await marcarPunta(page);
  await mes(page, 5);
  expect((await nombres(page)).sort()).toEqual(['Ana Vive en Punta', 'Bea Punta Todo el Año']);
  await expect(grid(page)).not.toContainText('Dora Punta en Enero');
  await expect(grid(page)).not.toContainText('Clara No Va');
  verificarLimpio(e);
});

test('Pocitos en enero: las que no cargaron temporada van aparte; la que está en Punta en enero, no', async ({ page }) => {
  const e = await abrir(page);
  await marcarPocitos(page);
  await mes(page, 0);
  expect(await nombres(page)).toEqual(['Clara No Va']);
  expect((await sinTemporada(page)).sort()).toEqual(['Eva Pocitos Sin Temporada', 'Fio Pocitos y Punta Sin Temporada']);
  await expect(grid(page)).not.toContainText('Dora Punta en Enero');
  verificarLimpio(e);
});

test('escribir "Punta del Este" en el buscador es como marcar la zona, con la misma regla', async ({ page }) => {
  const e = await abrir(page);
  await page.fill('#filt-nombre', 'punta del este');
  expect((await nombres(page)).sort()).toEqual(['Ana Vive en Punta', 'Bea Punta Todo el Año', 'Clara No Va', 'Dora Punta en Enero', 'Fio Pocitos y Punta Sin Temporada']);
  await expect(fila(page, 'Clara No Va')).toContainText('Dijo que no va');
  await mes(page, 0);
  await expect(grid(page)).not.toContainText('Clara No Va');
  expect((await nombres(page)).sort()).toEqual(['Ana Vive en Punta', 'Bea Punta Todo el Año', 'Dora Punta en Enero']);
  verificarLimpio(e);
});

test('otro texto sigue buscando por texto (nombre, barrios, notas)', async ({ page }) => {
  const e = await abrir(page);
  await page.fill('#filt-nombre', 'dora');
  expect(await nombres(page)).toEqual(['Dora Punta en Enero']);
  verificarLimpio(e);
});

test('celular de 390 px: las listas entran en la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const e = await abrir(page);
  await marcarPunta(page);
  await mes(page, 0);
  await esperarQuieta(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  verificarLimpio(e);
});
