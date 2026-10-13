// Arranque (PR 7, 05/10/2026, E4): pantalla de carga con el logo mientras arranca, se busca la
// sesión o se entra; mensaje claro con "Reintentar" si no carga supabase-js o falla el arranque.
// supabase-js se sirve desde el repo (vendor/), ya no desde jsdelivr.
const { test, expect } = require('@playwright/test');
const { abrirApp, verificarLimpio, esperarQuieta } = require('./support/app');

const carga = page => page.locator('#pantalla-carga');

test('mientras carga se ve el símbolo latiendo, y después el login', async ({ page }) => {
  // Se demora la librería para poder ver la pantalla de carga antes de que arranque el JS.
  await page.route(/vendor\/supabase-js/, async r => { await new Promise(ok => setTimeout(ok, 1200)); await r.continue(); });
  const abriendo = abrirApp(page, { sesion: false });
  await expect(carga(page)).toBeVisible();
  await expect(carga(page).locator('img[src="logo-simbolo.png"]')).toBeVisible();
  await expect(carga(page).locator('.spinner')).toHaveCount(0); // sin ruedita: el símbolo late (15/10/2026)
  await expect(carga(page)).toContainText('Cargando');
  const e = await abriendo;
  await expect(page.locator('#login-mail')).toBeVisible();
  await expect(carga(page)).toHaveCount(0);
  verificarLimpio(e);
});

test('con sesión guardada la carga termina en Hoy', async ({ page }) => {
  await page.route(/vendor\/supabase-js/, async r => { await new Promise(ok => setTimeout(ok, 800)); await r.continue(); });
  const abriendo = abrirApp(page);
  await expect(carga(page)).toBeVisible();
  const e = await abriendo;
  await expect(page.locator('#modcontent')).toContainText('Hoy');
  await expect(carga(page)).toHaveCount(0);
  verificarLimpio(e);
});

test('si no carga supabase-js: mensaje claro con Reintentar, nunca pantalla en blanco', async ({ page }) => {
  const errores = [];
  page.on('pageerror', err => errores.push(err.message));
  await page.route(/vendor\/supabase-js/, r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com|supabase\.co/, r => r.abort());
  await page.goto('/');
  const error = page.locator('#pantalla-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('No se pudo conectar con el sistema');
  await expect(error).toContainText('supabase-js');
  await expect(error.locator('button', { hasText: 'Reintentar' })).toBeVisible();
  expect(errores, 'sin excepciones de JS (antes: "supabase is not defined")').toEqual([]);
  // Reintentar recarga la página; con la librería de vuelta, entra normalmente.
  await page.unroute(/vendor\/supabase-js/);
  await page.unroute(/fonts\.(googleapis|gstatic)\.com|supabase\.co/);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await error.locator('button', { hasText: 'Reintentar' }).click();
  await expect(page.locator('#login-mail')).toBeVisible();
});

test('si el arranque falla (sin conexión al renovar la sesión), avisa con Reintentar', async ({ page }) => {
  const e = await abrirApp(page, { sesion: false });
  // Fuerza un error dentro del arranque y lo vuelve a correr.
  await page.evaluate(async () => {
    sb.auth.getSession = async () => { throw new TypeError('Failed to fetch'); };
    document.getElementById('app').innerHTML = '';
    mostrarPantallaCarga();
    await boot();
  });
  await expect(page.locator('#pantalla-error')).toContainText('No se pudo abrir el sistema');
  await expect(page.locator('#pantalla-error button', { hasText: 'Reintentar' })).toBeVisible();
  verificarLimpio(e, { ignorar: [/\[boot\]/] });
});

test('al entrar con contraseña se ve "Entrando…" hasta la pantalla de Face ID', async ({ page }) => {
  const e = await abrirApp(page, { sesion: false });
  // Lista de passkeys de la cuenta (pide Face ID): demorada para poder ver la carga.
  await page.route(/\/auth\/v1\/passkeys/, async r => { await new Promise(ok => setTimeout(ok, 1000)); await r.fulfill({ json: [] }); });
  await page.fill('#login-mail', 'prueba@ejemplo.test');
  await page.fill('#login-pass', 'contraseña-falsa');
  await page.locator('#loginbtn').click();
  await expect(carga(page)).toBeVisible();
  await expect(carga(page)).toContainText('Entrando');
  await expect(page.locator('#bio-btn')).toBeVisible({ timeout: 5000 });
  await expect(carga(page)).toHaveCount(0);
  verificarLimpio(e);
});

test('si tarda mucho, avisa que está tardando y ofrece reintentar', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-04T12:00:00-03:00') });
  const e = await abrirApp(page, { sesion: false, ahora: null });
  await page.evaluate(() => mostrarPantallaCarga('Entrando…'));
  await expect(carga(page)).not.toContainText('tardando');
  await page.clock.fastForward(13000);
  await expect(carga(page)).toContainText('Está tardando más de lo normal');
  await expect(page.locator('#pantallacarga-reintentar')).toBeVisible();
  verificarLimpio(e);
});

// Pantallas de carga con el símbolo (15/10/2026).
test('entre el login y Hoy queda la pantalla de carga hasta que Hoy tiene sus datos', async ({ page }) => {
  const e = await abrirApp(page);
  e.demoraLecturas = 1500;
  await page.evaluate(() => { renderApp(); });
  const entrada = page.locator('#pantalla-entrada');
  await expect(entrada).toBeVisible();
  await expect(entrada.locator('img[src="logo-simbolo.png"]')).toBeVisible();
  await expect(entrada).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator('#statrow .statnum').first()).not.toHaveText('—');
  verificarLimpio(e);
});

test('al cambiar de sección: el símbolo chico solo si tarda más de 300 ms', async ({ page }) => {
  const e = await abrirApp(page);
  await page.evaluate(() => {
    window.__vioCarga = false;
    new MutationObserver(() => { if (document.getElementById('carga-modulo')) window.__vioCarga = true; })
      .observe(document.body, { childList: true });
  });
  await page.evaluate(() => setModulo('finanzas'));
  await esperarQuieta(page);
  expect(await page.evaluate(() => window.__vioCarga)).toBe(false); // rápido: no se ve nada
  e.demoraLecturas = 1500;
  const yendo = page.evaluate(() => setModulo(null));
  const ind = page.locator('#carga-modulo');
  await expect(ind).toBeVisible();
  await expect(ind.locator('img')).toHaveCSS('height', '40px');
  await expect(page.locator('#sidebar')).toBeVisible();
  await yendo;
  await expect(ind).toHaveCount(0);
  verificarLimpio(e);
});

test('sin animación con "reducir movimiento"', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const e = await abrirApp(page);
  await page.evaluate(() => mostrarPantallaCarga('Cargando…'));
  await expect(page.locator('#pantalla-carga img')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('#pantalla-carga img')).toHaveCSS('animation-name', 'latido');
  verificarLimpio(e);
});
