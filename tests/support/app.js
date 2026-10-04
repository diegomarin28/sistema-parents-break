// Arranca la app en el navegador de los tests con Supabase SIMULADO.
//
// - Todo pedido a *.supabase.co se responde acá con los datos ficticios de datos.js
//   (o los que pase cada test). Nada llega a la base real: un pedido que no se sabe
//   simular queda anotado en `noSimulados` y el test falla al final (ver verificarLimpio).
// - supabase-js se sirve desde tests/vendor (misma versión que index.html), así los tests
//   no dependen del CDN.
// - Chart.js y xlsx se reemplazan por versiones mínimas (stubs.js): los tests miran la
//   app, no los gráficos.
// - La sesión se inyecta en localStorage, igual que la deja supabase-js después de un login
//   real. auth.js la toma por el camino rápido (leerSesionGuardada) y no pide Face ID.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { datosBase } = require('./datos');
const { STUB_CHART, STUB_XLSX } = require('./stubs');

const REF_PROD = 'wvewzamdohrpfhpccvcz';
const SUPABASE_JS = path.join(__dirname, '..', 'vendor', 'supabase-js-2.117.2.umd.js');

const USUARIO = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'prueba@ejemplo.test', user_metadata: { nombre: 'Prueba' }, app_metadata: {},
};

function base64url(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function sesionFalsa() {
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const token = base64url({ alg: 'HS256', typ: 'JWT' }) + '.' +
    base64url({ sub: USUARIO.id, email: USUARIO.email, role: 'authenticated', aud: 'authenticated', exp }) + '.firma-falsa';
  return { access_token: token, refresh_token: 'refresh-falso', token_type: 'bearer', expires_in: 30 * 24 * 3600, expires_at: exp, user: USUARIO };
}

/* ---------- Mini PostgREST sobre arrays en memoria ---------- */
function valorFiltro(raw) {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}
function comparar(a, b) {
  if (a === null || a === undefined) return null;
  const na = Number(a), nb = Number(b);
  if (a !== '' && b !== '' && !isNaN(na) && !isNaN(nb) && typeof a !== 'boolean') return na - nb;
  return String(a).localeCompare(String(b));
}
function separarLista(txt) {
  // in.(a,b,"c, d")
  const out = []; let actual = ''; let comillas = false;
  for (const c of txt) {
    if (c === '"') { comillas = !comillas; continue; }
    if (c === ',' && !comillas) { out.push(actual); actual = ''; continue; }
    actual += c;
  }
  if (actual !== '') out.push(actual);
  return out;
}
function cumple(fila, columna, expr) {
  const v = fila[columna];
  const i = expr.indexOf('.');
  let op = expr.slice(0, i), arg = expr.slice(i + 1);
  let negado = false;
  if (op === 'not') { negado = true; const j = arg.indexOf('.'); op = arg.slice(0, j); arg = arg.slice(j + 1); }
  let ok;
  switch (op) {
    case 'eq': ok = String(v) === String(valorFiltro(arg)) || v === valorFiltro(arg); break;
    case 'neq': ok = String(v) !== String(valorFiltro(arg)); break;
    case 'gt': ok = comparar(v, arg) > 0; break;
    case 'gte': ok = comparar(v, arg) >= 0; break;
    case 'lt': ok = comparar(v, arg) < 0; break;
    case 'lte': ok = comparar(v, arg) <= 0; break;
    case 'is': ok = arg === 'null' ? (v === null || v === undefined) : v === valorFiltro(arg); break;
    case 'in': ok = separarLista(arg.replace(/^\(|\)$/g, '')).some(x => String(x) === String(v)); break;
    case 'like': case 'ilike': {
      const re = new RegExp('^' + arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', op === 'ilike' ? 'i' : '');
      ok = re.test(String(v ?? '')); break;
    }
    case 'cs': { const lista = JSON.parse(arg.replace(/^\{/, '[').replace(/\}$/, ']')); ok = Array.isArray(v) && lista.every(x => v.includes(x)); break; }
    default: ok = true; // operador que no simulamos: no filtra
  }
  return negado ? !ok : ok;
}
const PARAMS_NO_FILTRO = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function filtrar(filas, params) {
  let out = filas;
  for (const [k, v] of params) {
    if (PARAMS_NO_FILTRO.has(k)) continue;
    if (k === 'or') continue; // no se usa en la app hoy
    out = out.filter(f => cumple(f, k, v));
  }
  return out;
}
function ordenar(filas, order) {
  if (!order) return filas;
  const claves = order.split(',').map(p => { const [col, dir] = p.split('.'); return { col, desc: dir === 'desc' }; });
  return filas.slice().sort((a, b) => {
    for (const { col, desc } of claves) {
      const c = comparar(a[col], b[col]);
      if (c === null) continue;
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}
// Embebidos tipo "*, familias(nombre)" o "*, solicitud_ninieras(*)".
function embebidos(select) {
  const out = []; let nivel = 0; let actual = '';
  for (const c of select || '') {
    if (c === '(') nivel++;
    if (c === ')') nivel--;
    if (c === ',' && nivel === 0) { out.push(actual.trim()); actual = ''; continue; }
    actual += c;
  }
  if (actual.trim()) out.push(actual.trim());
  return out.map(p => p.match(/^(?:\w+:)?(\w+)(?:!\w+)?\((.*)\)$/)).filter(Boolean).map(m => m[1]);
}
function singular(tabla) { return tabla.replace(/es$/, '').replace(/s$/, ''); }
function resolverEmbebidos(filas, tabla, select, db) {
  const embs = embebidos(select);
  if (!embs.length) return filas;
  return filas.map(f => {
    const copia = { ...f };
    for (const emb of embs) {
      const hijos = db[emb] || [];
      const fk = Object.keys(f).find(k => k === singular(emb) + '_id' || k === emb.replace(/s$/, '') + '_id');
      if (fk) copia[emb] = hijos.find(h => h.id === f[fk]) || null;
      else {
        const clavePadre = Object.keys(hijos[0] || {}).find(k => k.endsWith('_id') && (k === singular(tabla) + '_id' || k === tabla.replace(/s$/, '') + '_id' || k === 'evento_id'));
        copia[emb] = clavePadre ? hijos.filter(h => h[clavePadre] === f.id) : [];
      }
    }
    return copia;
  });
}

let secuenciaId = 0;
function nuevoId() { secuenciaId++; return `00000000-0000-4000-9000-${String(secuenciaId).padStart(12, '0')}`; }

/**
 * Abre la app con Supabase simulado.
 * @param {import('@playwright/test').Page} page
 * @param {object} opciones
 *   datos: tablas ficticias (se mezclan sobre datos.js)
 *   sesion: false para ver la pantalla de login
 *   ahora: fecha/hora fija (string ISO con zona) para el reloj del navegador
 *   ruta: path a abrir (por defecto '/')
 */
async function abrirApp(page, opciones = {}) {
  const { datos = {}, sesion = true, ahora = '2026-10-04T12:00:00-03:00', ruta = '/' } = opciones;
  const db = structuredClone({ ...datosBase(), ...datos });
  const estado = { escrituras: [], errores: [], noSimulados: [], db };

  page.on('console', m => { if (m.type() === 'error') estado.errores.push('consola: ' + m.text()); });
  page.on('pageerror', e => estado.errores.push('excepción: ' + e.message));

  if (ahora) await page.clock.setFixedTime(new Date(ahora));

  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ path: SUPABASE_JS, contentType: 'application/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  // Ojo: Playwright prueba primero la ruta registrada ÚLTIMA. La genérica va antes.
  await page.route(/cdnjs\.cloudflare\.com/, r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js/, r => r.fulfill({ body: STUB_CHART, contentType: 'application/javascript' }));
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, r => r.fulfill({ body: STUB_XLSX, contentType: 'application/javascript' }));
  // Fotos y links externos de los datos ficticios: imagen vacía, nunca red real.
  await page.route(/ejemplo\.test|example\.com/, r => r.fulfill({ status: 404, body: '' }));

  await page.routeWebSocket(/supabase\.co/, () => { /* Realtime mudo: no conecta a ningún lado */ });

  await page.route(/supabase\.co/, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const metodo = req.method();
    if (!url.hostname.startsWith(REF_PROD + '.')) { estado.noSimulados.push(metodo + ' ' + req.url()); return route.abort(); }

    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: USUARIO });
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
      if (url.pathname === '/auth/v1/token') return route.fulfill({ json: sesionFalsa() });
      estado.noSimulados.push(metodo + ' ' + url.pathname);
      return route.fulfill({ status: 400, json: { message: 'no simulado en tests' } });
    }
    if (url.pathname.startsWith('/storage/v1/') || url.pathname.startsWith('/functions/v1/')) {
      estado.escrituras.push({ tabla: url.pathname, metodo, params: url.search, cuerpo: req.postData() });
      return route.fulfill({ json: { Key: 'ficticio', path: 'ficticio' } });
    }
    if (!url.pathname.startsWith('/rest/v1/')) {
      estado.noSimulados.push(metodo + ' ' + url.pathname);
      return route.fulfill({ status: 404, json: {} });
    }

    const tabla = url.pathname.replace('/rest/v1/', '');
    if (tabla.startsWith('rpc/')) {
      estado.escrituras.push({ tabla, metodo, cuerpo: req.postDataJSON?.() });
      return route.fulfill({ json: [] });
    }
    db[tabla] = db[tabla] || [];
    const params = [...url.searchParams.entries()];
    const unico = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const prefer = req.headers()['prefer'] || '';
    const responder = (filas, extra = {}) => {
      const conEmb = resolverEmbebidos(filas, tabla, url.searchParams.get('select'), db);
      if (unico) {
        if (conEmb.length !== 1) return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${conEmb.length} filas` } });
        return route.fulfill({ json: conEmb[0], ...extra });
      }
      return route.fulfill({ json: conEmb, ...extra });
    };

    if (metodo === 'GET' || metodo === 'HEAD') {
      let filas = ordenar(filtrar(db[tabla], params), url.searchParams.get('order'));
      const total = filas.length;
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = url.searchParams.get('limit');
      filas = filas.slice(offset, limit ? offset + Number(limit) : undefined);
      const headers = { 'content-range': `${offset}-${offset + Math.max(filas.length - 1, 0)}/${total}` };
      if (metodo === 'HEAD') return route.fulfill({ status: 200, headers, body: '' });
      return responder(filas, { headers });
    }

    const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
    estado.escrituras.push({ tabla, metodo, params: Object.fromEntries(params), cuerpo });
    let afectadas = [];
    if (metodo === 'POST') {
      const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
      const conflicto = url.searchParams.get('on_conflict');
      for (const fila of lista) {
        if (prefer.includes('merge-duplicates') && conflicto) {
          const claves = conflicto.split(',');
          const existente = db[tabla].find(f => claves.every(c => String(f[c]) === String(fila[c])));
          if (existente) { Object.assign(existente, fila); afectadas.push(existente); continue; }
        }
        const nueva = { id: nuevoId(), created_at: new Date().toISOString(), ...fila };
        db[tabla].push(nueva); afectadas.push(nueva);
      }
    } else if (metodo === 'PATCH') {
      afectadas = filtrar(db[tabla], params);
      afectadas.forEach(f => Object.assign(f, cuerpo));
    } else if (metodo === 'DELETE') {
      afectadas = filtrar(db[tabla], params);
      db[tabla] = db[tabla].filter(f => !afectadas.includes(f));
    }
    if (prefer.includes('return=representation')) return responder(afectadas, { status: metodo === 'POST' ? 201 : 200 });
    return route.fulfill({ status: metodo === 'POST' ? 201 : 204, body: '' });
  });

  if (sesion) {
    await page.addInitScript(([clave, valor]) => {
      if (!sessionStorage.getItem('__tests_sesion_puesta')) {
        localStorage.setItem(clave, valor);
        sessionStorage.setItem('__tests_sesion_puesta', '1');
      }
    }, [`sb-${REF_PROD}-auth-token`, JSON.stringify(sesionFalsa())]);
  }

  await page.goto(ruta);
  if (sesion) await expect(page.locator('#modcontent')).toBeVisible();
  else await expect(page.locator('#login-mail')).toBeVisible();
  await esperarQuieta(page);
  return estado;
}

// Espera a que no queden spinners de "Cargando…" en pantalla.
async function esperarQuieta(page) {
  await expect(page.locator('#app .spinner')).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(150);
}

async function irAModulo(page, clave) {
  await page.evaluate(k => setModulo(k), clave);
  await esperarQuieta(page);
}

// Al final de cada test: ni errores de consola/JS, ni pedidos a Supabase sin simular.
function verificarLimpio(estado, { ignorar = [] } = {}) {
  const errores = estado.errores.filter(e => !ignorar.some(re => re.test(e)));
  expect(estado.noSimulados, 'pedidos a Supabase sin simular').toEqual([]);
  expect(errores, 'errores en consola o excepciones').toEqual([]);
}

module.exports = { abrirApp, irAModulo, esperarQuieta, verificarLimpio, REF_PROD };
