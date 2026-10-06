// Entrevista a medias (09/10/2026): "Guardar y seguir después" guarda lo que haya, sin pedir
// todos los puntajes, con estado 'en_curso'. Se ve en "Candidatas guardadas" y en la
// candidata a entrevistar, se retoma tal cual y al completarla se usa la misma fila.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const ENT = 'e7000000-0000-4000-8000-000000000001';
async function agendar(page, i = 0) {
  await irAModulo(page, 'rrhh');
  await page.evaluate(async n => { await agendarDesdeIntake(n); }, i);
  await esperarQuieta(page);
}
const toasts = page => page.locator('.toaststack .toast');
const escrituras = (e, tabla, metodo) => e.escrituras.filter(w => w.tabla === tabla && w.metodo === metodo);
function entrevistaEnCurso(extra = {}) {
  return {
    id: ENT, candidata_id: ID.cIntake, fecha: '2026-10-03', entrevisto: 'Otra', rol: 'Traslados',
    puntajes: { [extra.clave || 'x']: { score: 4, notes: 'Responde con calma' } }, redflags: {}, referencias: [{ name: 'Ref Inventada', phone: '099000111', relacion: 'Ex empleadora', confirmado: true }],
    psico: {}, explicacion_juegos: 'Si', notas: 'Seguir el lunes', total: null, recomendacion: null,
    created_at: '2026-10-03T15:00:00Z', estado: 'en_curso', borrador: { capacitacion: 'Curso de primeros auxilios' }, actualizado_at: '2026-10-03T15:00:00Z',
  };
}

test('guardar a medias: sin todos los puntajes, estado en curso y la candidata sigue a entrevistar', async ({ page }) => {
  const e = await abrirApp(page);
  await agendar(page);
  const clave = await page.evaluate(() => COMPETENCIAS[0].key);
  await page.locator(`[data-score="${clave}:4"]`).click();
  await page.fill(`[data-notes="${clave}"]`, 'Responde con calma');
  await page.fill('#f-capacitacion', 'Curso de primeros auxilios');
  await page.fill('#ent-nota-idiomas', 'Inglés básico');
  await expect(page.locator('#btnGuardar')).toBeDisabled(); // completa todavía no
  await page.locator('#btnGuardarEnCurso').click();
  await expect(toasts(page).filter({ hasText: 'Entrevista guardada a medias' })).toBeVisible();
  const altas = escrituras(e, 'entrevistas', 'POST');
  expect(altas).toHaveLength(1);
  expect(altas[0].cuerpo).toMatchObject({ candidata_id: ID.cIntake, estado: 'en_curso', total: null, recomendacion: null, borrador: { capacitacion: 'Curso de primeros auxilios' } });
  expect(altas[0].cuerpo.puntajes[clave]).toEqual({ score: 4, notes: 'Responde con calma' });
  const cand = escrituras(e, 'candidatas', 'PATCH').at(-1).cuerpo;
  expect(cand).not.toHaveProperty('estado');
  expect(cand.notas_ficha).toMatchObject({ idiomas: 'Inglés básico' });
  // Guardar de nuevo actualiza la misma entrevista, no crea otra.
  await page.locator('#btnGuardarEnCurso').click();
  await expect(toasts(page).filter({ hasText: 'Entrevista guardada a medias' })).toHaveCount(2);
  expect(escrituras(e, 'entrevistas', 'POST')).toHaveLength(1);
  expect(escrituras(e, 'entrevistas', 'PATCH')).toHaveLength(1);
  verificarLimpio(e);
});

test('se ve en Candidatas guardadas, se retoma tal cual y al completarla se usa la misma fila', async ({ page }) => {
  const pagina = page;
  const e = await abrirApp(pagina);
  // La clave de la primera competencia sale de la app; la entrevista se agrega a la base simulada.
  const clave = await pagina.evaluate(() => COMPETENCIAS[0].key);
  e.db.entrevistas.push(entrevistaEnCurso({ clave }));
  await irAModulo(pagina, 'rrhh');
  await pagina.locator('[data-rrhhtab="guardadas"]').click();
  const item = pagina.locator('#candlist .entrevista-en-curso');
  await expect(item).toContainText('Lucía');
  await expect(item).toContainText('En curso');
  await item.click();
  await esperarQuieta(pagina);
  await expect(pagina.locator('#f-nombre')).toHaveValue('Lucía Muestra');
  await expect(pagina.locator('#f-rol')).toHaveValue('Traslados');
  await expect(pagina.locator('#f-notas')).toHaveValue('Seguir el lunes');
  await expect(pagina.locator('#f-capacitacion')).toHaveValue('Curso de primeros auxilios');
  await expect(pagina.locator(`[data-score="${clave}:4"]`)).toHaveClass(/selected/);
  await expect(pagina.locator(`[data-notes="${clave}"]`)).toHaveValue('Responde con calma');
  await expect(pagina.locator('#reflist')).toBeVisible();
  expect(await pagina.locator('#reflist input[placeholder="Nombre"]').inputValue()).toBe('Ref Inventada');
  await expect(pagina.locator('[data-juegos="Si"]')).toHaveClass(/selected/);
  // Se completa y se guarda: la misma fila pasa a completa; la candidata, a entrevistada.
  await pagina.evaluate(() => COMPETENCIAS.forEach(c => document.querySelector(`[data-score="${c.key}:5"]`).click()));
  await pagina.locator('#btnGuardar').click();
  await expect(toasts(pagina).filter({ hasText: 'Candidata guardada' })).toBeVisible();
  expect(escrituras(e, 'entrevistas', 'POST')).toHaveLength(0);
  const upd = escrituras(e, 'entrevistas', 'PATCH').at(-1);
  expect(upd.params.id).toBe(`eq.${ENT}`);
  expect(upd.cuerpo).toMatchObject({ estado: 'completa', recomendacion: 'Recomendada' });
  expect(escrituras(e, 'candidatas', 'PATCH').at(-1).cuerpo).toMatchObject({ estado: 'entrevistada' });
  verificarLimpio(e);
});

test('la candidata a entrevistar muestra "Entrevista en curso" y "Seguir entrevista"', async ({ page }) => {
  const datos = datosBase();
  datos.entrevistas = [entrevistaEnCurso()];
  const e = await abrirApp(page, { datos });
  await irAModulo(page, 'rrhh');
  const fila = page.locator('#intakegrid .person-row', { hasText: 'Lucía' });
  await expect(fila).toContainText('Entrevista en curso');
  await expect(fila.locator('button', { hasText: 'Agendar' })).toHaveCount(0);
  await fila.locator('button', { hasText: 'Seguir entrevista' }).click();
  await expect(page.locator('#f-notas')).toHaveValue('Seguir el lunes');
  verificarLimpio(e);
});

test('entrevista que arranca de cero: guardar a medias crea la candidata a entrevistar', async ({ page }) => {
  const e = await abrirApp(page);
  await irAModulo(page, 'rrhh');
  await page.locator('[data-rrhhtab="entrevista"]').click();
  await esperarQuieta(page);
  await page.locator('#btnGuardarEnCurso').click();
  await expect(page.locator('#warnArea')).toContainText('Falta el nombre.');
  await page.fill('#f-nombre', 'Ana Nueva Ficticia');
  await page.locator('#btnGuardarEnCurso').click();
  await expect(toasts(page).filter({ hasText: 'Entrevista guardada a medias' })).toBeVisible();
  expect(escrituras(e, 'candidatas', 'POST')[0].cuerpo).toMatchObject({ nombre: 'Ana Nueva Ficticia', estado: 'intake' });
  expect(escrituras(e, 'entrevistas', 'POST')[0].cuerpo).toMatchObject({ estado: 'en_curso' });
  verificarLimpio(e);
});

test('sin la migración avisa y no pierde lo escrito', async ({ page }) => {
  const e = await abrirApp(page);
  e.fallar = ({ tabla, metodo }) => (tabla === 'entrevistas' && metodo === 'POST')
    ? { status: 400, code: 'PGRST204', message: "Could not find the 'borrador' column of 'entrevistas' in the schema cache" } : null;
  await agendar(page);
  await page.fill('#f-notas', 'Lo que se escribió');
  await page.locator('#btnGuardarEnCurso').click();
  await expect(page.locator('#warnArea')).toContainText('falta un cambio en la base');
  await expect(page.locator('#f-notas')).toHaveValue('Lo que se escribió');
  verificarLimpio(e, { ignorar: [/status of 400/] });
});

// Dos personas con la misma entrevista abierta (06/10/2026): la que guardaba última pisaba a
// la otra, y una entrevista ya completa volvía a "en curso" sin total ni recomendación.
test.describe('la misma entrevista abierta en dos celulares', () => {
  async function abrirEnCurso(page) {
    const e = await abrirApp(page);
    const clave = await page.evaluate(() => COMPETENCIAS[0].key);
    e.db.entrevistas.push(entrevistaEnCurso({ clave }));
    await irAModulo(page, 'rrhh');
    await page.evaluate(id => seguirEntrevista(id), ENT);
    await esperarQuieta(page);
    await expect(page.locator('#f-notas')).toHaveValue('Seguir el lunes');
    return e;
  }
  const completarDesdeOtroLado = e => {
    Object.assign(e.db.entrevistas[0], { estado: 'completa', total: 4.5, recomendacion: 'Recomendada', notas: 'La completó la otra', actualizado_at: '2026-10-04T14:00:00+00:00' });
    e.db.candidatas[0].estado = 'entrevistada';
  };

  test('ya la completó la otra: "Guardar y seguir después" no la vuelve a "en curso"', async ({ page }) => {
    const e = await abrirEnCurso(page);
    completarDesdeOtroLado(e);
    await page.fill('#f-notas', 'Lo que escribí yo');
    await page.locator('#btnGuardarEnCurso').click();
    await expect(page.locator('#warnArea')).toContainText('ya la completó alguien más');
    expect(e.db.entrevistas[0]).toMatchObject({ estado: 'completa', total: 4.5, recomendacion: 'Recomendada', notas: 'La completó la otra' });
    expect(escrituras(e, 'entrevistas', 'PATCH')).toEqual([]);
    expect(escrituras(e, 'candidatas', 'PATCH')).toEqual([]);
    await expect(page.locator('#f-notas')).toHaveValue('Lo que escribí yo');
    verificarLimpio(e);
  });

  test('ya la completó la otra: completarla de nuevo tampoco la pisa', async ({ page }) => {
    const e = await abrirEnCurso(page);
    completarDesdeOtroLado(e);
    await page.evaluate(() => COMPETENCIAS.forEach(c => document.querySelector(`[data-score="${c.key}:3"]`).click()));
    await page.locator('#btnGuardar').click();
    await expect(page.locator('#warnArea')).toContainText('ya la completó alguien más');
    expect(e.db.entrevistas[0]).toMatchObject({ estado: 'completa', total: 4.5, notas: 'La completó la otra' });
    expect(escrituras(e, 'entrevistas', 'PATCH')).toEqual([]);
    expect(escrituras(e, 'candidatas', 'PATCH')).toEqual([]);
    verificarLimpio(e);
  });

  test('la otra guardó a medias después de que la abrí: pregunta antes de reemplazar', async ({ page }) => {
    const e = await abrirEnCurso(page);
    Object.assign(e.db.entrevistas[0], { notas: 'Lo de la otra', actualizado_at: '2026-10-04T14:05:00+00:00' });
    await page.fill('#f-notas', 'Lo mío');
    await page.locator('#btnGuardarEnCurso').click();
    await expect(page.locator('.confirmoverlay.show')).toContainText('Alguien guardó esta entrevista a las 11:05');
    await page.locator('.confirmoverlay.show button', { hasText: 'Cancelar' }).click();
    expect(escrituras(e, 'entrevistas', 'PATCH')).toEqual([]);
    expect(e.db.entrevistas[0].notas).toBe('Lo de la otra');
    await page.locator('#btnGuardarEnCurso').click();
    await page.locator('#confirm-si').click();
    await expect(toasts(page).filter({ hasText: 'Entrevista guardada a medias' })).toBeVisible();
    expect(e.db.entrevistas[0]).toMatchObject({ notas: 'Lo mío', estado: 'en_curso' });
    // Lo que guardé yo ya es lo último: la próxima vez no vuelve a preguntar.
    await page.locator('#btnGuardarEnCurso').click();
    await expect(toasts(page).filter({ hasText: 'Entrevista guardada a medias' })).toHaveCount(2);
    expect(escrituras(e, 'entrevistas', 'PATCH')).toHaveLength(2);
    verificarLimpio(e);
  });
});
