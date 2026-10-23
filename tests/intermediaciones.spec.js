// Colocación de Enrique con una persona externa (19/10/2026): a veces la persona colocada es
// empleada de Enrique y no es niñera nuestra. Se guarda solo con el nombre (ninera_id vacío),
// sin darla de alta como niñera ni sumarla a "Niñeras Enrique". Si elige una niñera de la
// lista (o escribe su nombre exacto), se vincula como antes.
const { test, expect } = require('@playwright/test');
const { abrirApp, irAModulo, esperarQuieta, verificarLimpio } = require('./support/app');
const { datosBase, ID } = require('./support/datos');

const IGNORAR_RED = [/Failed to load resource|ERR_FAILED|\[Supabase\]|Failed to fetch|TypeError/];
const toasts = page => page.locator('.toaststack .toast');
const boton = page => page.locator('button', { hasText: 'Guardar colocación' });
const postsEnrique = e => e.escrituras.filter(w => w.tabla === 'intermediaciones_enrique' && w.metodo === 'POST');

// Desde el 23/10/2026 el formulario se abre con "+ Nueva" → "Colocación de Enrique", en un modal.
async function abrirForm(page, opciones) {
  const e = await abrirApp(page, opciones);
  await irAModulo(page, 'intermediaciones');
  await page.locator('#modcontent button', { hasText: '+ Nueva' }).click();
  await page.locator('#editmodal button', { hasText: 'Colocación de Enrique' }).click();
  await expect(page.locator('#editmodal #inter-enrique-ninera')).toBeVisible();
  return e;
}
// Tipea de verdad (no fill) para que corran los listeners de input del autocompletar.
async function escribirPersona(page, texto) {
  await page.fill('#inter-enrique-ninera', '');
  await page.locator('#inter-enrique-ninera').pressSequentially(texto);
}

test.describe('colocación de Enrique: persona externa', () => {
  test('con un nombre que no está en la lista se guarda sin ninera_id y no toca Niñeras', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, '  Marta Externa ');
    await expect(page.locator('#inter-enrique-externa')).toContainText('se guarda como persona externa');
    await expect(page.locator('#inter-enrique-externa')).not.toContainText('elegila ahí');
    await page.fill('#inter-enrique-monto', '1500');
    await boton(page).click();
    await expect(toasts(page).last()).toContainText('persona externa');
    await esperarQuieta(page);

    expect(e.db.intermediaciones_enrique).toHaveLength(1);
    const fila = e.db.intermediaciones_enrique[0];
    expect(fila.ninera_id).toBeNull();
    expect(fila.ninera_nombre).toBe('Marta Externa');
    expect(fila.monto).toBe(1500);
    // No se crea niñera, no se desactiva ninguna y no entra al pool (que exige ninera_id).
    expect(e.escrituras.filter(w => w.tabla === 'ninieras' || w.tabla === 'intermediaciones_enrique_pool')).toEqual([]);
    expect(e.db.ninieras.every(n => n.activa)).toBe(true);

    // Historial y detalle aguantan ninera_id vacío.
    const filaHist = page.locator('#inter-body [onclick^="abrirModalInterEnriqueDetalle"]', { hasText: 'Marta Externa' });
    await expect(filaHist).toContainText('persona externa');
    await filaHist.click();
    await expect(page.locator('#editmodal')).toContainText('no es niñera de Parents Break');
    verificarLimpio(e);
  });

  test('si se parece a una niñera de la lista, avisa que la elija ahí', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, 'Ana');
    await expect(page.locator('#inter-enrique-externa')).toContainText('elegila ahí');
    verificarLimpio(e);
  });

  test('elegida de la lista: se vincula, sale de Niñeras y entra al pool como antes', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, 'Ana F');
    await page.locator('#inter-enrique-ninera-dropdown .autocomplete-item', { hasText: 'Ana Ficticia' }).click();
    await expect(page.locator('#inter-enrique-externa')).toBeEmpty();
    await boton(page).click();
    await expect(toasts(page).last()).toContainText('ya no aparece en Niñeras');
    expect(e.db.intermediaciones_enrique[0]).toMatchObject({ ninera_id: ID.nAna, ninera_nombre: 'Ana Ficticia' });
    expect(e.db.ninieras.find(n => n.id === ID.nAna).activa).toBe(false);
    expect(e.db.intermediaciones_enrique_pool).toEqual([expect.objectContaining({ ninera_id: ID.nAna, estado: 'activa' })]);
    verificarLimpio(e);
  });

  test('con el nombre exacto de una niñera (sin tocar la lista) se vincula a ella', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, 'ana ficticia');
    await page.locator('#inter-enrique-ninera').blur();
    await expect(page.locator('#inter-enrique-externa')).toBeEmpty();
    await boton(page).click();
    await expect(toasts(page).last()).toContainText('ya no aparece en Niñeras');
    expect(e.db.intermediaciones_enrique[0]).toMatchObject({ ninera_id: ID.nAna, ninera_nombre: 'Ana Ficticia' });
    verificarLimpio(e);
  });

  test('sin nombre no guarda y lo dice', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, '   ');
    await boton(page).click();
    await expect(page.locator('#inter-enrique-warn')).toContainText('escribí el nombre de la persona');
    expect(postsEnrique(e)).toEqual([]);
    verificarLimpio(e);
  });

  test('si la base falla, muestra el error y no dice que se guardó', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, 'Marta Externa');
    e.fallar = ({ tabla }) => tabla === 'intermediaciones_enrique' ? { message: 'permiso denegado' } : undefined;
    await boton(page).click();
    await expect(page.locator('#inter-enrique-warn')).toContainText('permiso denegado');
    await expect(page.locator('.toaststack .toast.good')).toHaveCount(0);
    expect(e.db.intermediaciones_enrique).toEqual([]);
    await expect(boton(page)).toBeEnabled();
    verificarLimpio(e, { ignorar: IGNORAR_RED });
  });

  test('sin conexión, tampoco dice que se guardó', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, 'Marta Externa');
    e.fallar = ({ tabla }) => tabla === 'intermediaciones_enrique' ? 'red' : undefined;
    await boton(page).click();
    await expect(page.locator('#inter-enrique-warn .warnbox, #inter-enrique-warn .errbox, #inter-enrique-warn > *')).not.toHaveCount(0);
    await expect(page.locator('.toaststack .toast.good')).toHaveCount(0);
    expect(e.db.intermediaciones_enrique).toEqual([]);
    verificarLimpio(e, { ignorar: IGNORAR_RED });
  });

  test('doble toque: una sola colocación', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, 'Marta Externa');
    e.demoraEscrituras = 800;
    await boton(page).click();
    await expect(boton(page)).toBeDisabled();
    await page.evaluate(() => document.querySelector('button[aria-busy]')?.click());
    await expect(toasts(page).last()).toContainText('persona externa');
    await esperarQuieta(page);
    expect(postsEnrique(e)).toHaveLength(1);
    verificarLimpio(e);
  });

  test('nombre con HTML: se guarda tal cual y se muestra como texto', async ({ page }) => {
    const e = await abrirForm(page);
    const raro = `<img src=x onerror="window.__xss=1">O'Neil "Externa"`;
    await escribirPersona(page, raro);
    await boton(page).click();
    await expect(toasts(page).last()).toContainText('persona externa');
    await esperarQuieta(page);
    expect(e.db.intermediaciones_enrique[0].ninera_nombre).toBe(raro);
    await expect(page.locator('#inter-body')).toContainText(`O'Neil "Externa"`);
    await page.locator('#inter-body [onclick^="abrirModalInterEnriqueDetalle"]').first().click();
    await expect(page.locator('#editmodal h2')).toHaveText(raro);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    verificarLimpio(e);
  });

  test('historial y ficha de la niñera aguantan colocaciones sin ninera_id', async ({ page }) => {
    const datos = datosBase();
    const fila = { fecha: '2026-10-01', comentarios: null, registrado_por: 'Prueba', created_at: '2026-10-01T12:00:00Z', cobrado: false };
    datos.intermediaciones_enrique = [
      { ...fila, id: 'a7000000-0000-4000-8000-000000000001', ninera_id: null, ninera_nombre: 'Marta Externa', monto: 900 },
      { ...fila, id: 'a7000000-0000-4000-8000-000000000002', ninera_id: ID.nAna, ninera_nombre: 'Ana Ficticia', monto: 700 },
    ];
    const e = await abrirApp(page, { datos });
    await irAModulo(page, 'intermediaciones');
    await expect(page.locator('#inter-body')).toContainText('Marta Externa');
    await expect(page.locator('#inter-body')).toContainText('Ana Ficticia');
    await expect(page.locator('#inter-body [onclick^="abrirModalInterEnriqueDetalle"]', { hasText: 'Ana Ficticia' })).not.toContainText('persona externa');
    // En la ficha de Ana aparece solo su colocación, no la de la persona externa.
    const ficha = await page.evaluate(async id => {
      const div = document.createElement('div'); div.id = 'ficha-prueba'; document.body.appendChild(div);
      await renderIntermediacionesEnFicha('ficha-prueba', id);
      return div.textContent;
    }, ID.nAna);
    expect(ficha).toContain('$700');
    expect(ficha).not.toContain('$900');
    verificarLimpio(e);
  });
});

test.describe('colocación de Enrique en el celular (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('el formulario con el aviso de persona externa no se corre de costado', async ({ page }) => {
    const e = await abrirForm(page);
    await escribirPersona(page, 'Una persona externa con un nombre bastante largo');
    await expect(page.locator('#inter-enrique-externa')).toBeVisible();
    const ancho = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(ancho).toBeLessThanOrEqual(1);
    verificarLimpio(e);
  });
});
