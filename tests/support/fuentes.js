// Lectura estática del código de la app (sin ejecutarlo), para los chequeos que no
// necesitan navegador: orden de scripts, globales duplicadas, handlers inline, emojis.
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const leer = rel => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// Orden de carga acordado (CLAUDE.md). Cambiarlo requiere consultarlo antes.
const ORDEN_SCRIPTS = [
  'js/core.js', 'js/auth.js', 'js/app-shell.js', 'js/finanzas.js', 'js/juguetes.js', 'js/agenda.js',
  'js/contratos.js', 'js/marketing.js', 'js/postulantes.js', 'js/ninieras.js', 'js/familias.js',
  'js/sittings.js', 'js/intermediaciones.js', 'js/bootstrap.js',
];

function scriptsDeIndex() {
  return [...leer('index.html').matchAll(/<script\s+src="(js\/[^"]+)"/g)].map(m => m[1]);
}

// Declaraciones de nivel superior. El código de la app las escribe siempre en la columna 0
// (function x / async function x / let|const|var x), así que alcanza con mirar esas líneas.
function declaracionesTopLevel() {
  const out = [];
  for (const archivo of ORDEN_SCRIPTS) {
    leer(archivo).split('\n').forEach((linea, i) => {
      let m = linea.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/);
      if (m) { out.push({ nombre: m[1], archivo, linea: i + 1 }); return; }
      m = linea.match(/^(?:let|const|var)\s+(.+)/);
      if (!m) return;
      // let a = 1, b = 2;  /  let a, b;  (sin desestructuración: la app no la usa arriba de todo)
      let resto = m[1], nivel = 0, actual = '';
      const partes = [];
      for (const c of resto) {
        if ('([{'.includes(c)) nivel++;
        if (')]}'.includes(c)) nivel--;
        if (c === ',' && nivel === 0) { partes.push(actual); actual = ''; continue; }
        if (c === ';' && nivel === 0) break;
        actual += c;
      }
      partes.push(actual);
      partes.forEach(p => { const n = p.trim().match(/^([A-Za-z_$][\w$]*)/); if (n) out.push({ nombre: n[1], archivo, linea: i + 1 }); });
    });
  }
  return out;
}

// Handlers inline (onclick="...", onchange='...') dentro del HTML que arma el JS.
function handlersInline() {
  const out = [];
  for (const archivo of ORDEN_SCRIPTS) {
    const src = leer(archivo);
    const re = /\bon([a-z]+)=(["'])/g;
    let m;
    while ((m = re.exec(src))) {
      const comilla = m[2];
      let i = re.lastIndex, texto = '';
      while (i < src.length) {
        if (src[i] === '$' && src[i + 1] === '{') { // interpolación: se saltea entera
          let nivel = 1; i += 2; let dentro = '';
          while (i < src.length && nivel > 0) { if (src[i] === '{') nivel++; else if (src[i] === '}') nivel--; if (nivel > 0) dentro += src[i]; i++; }
          texto += '${' + dentro + '}';
          continue;
        }
        if (src[i] === comilla) break;
        texto += src[i]; i++;
      }
      out.push({ archivo, linea: src.slice(0, m.index).split('\n').length, evento: m[1], texto });
    }
  }
  return out;
}

const NO_SON_FUNCIONES_DE_LA_APP = new Set(['if', 'for', 'while', 'switch', 'return', 'function', 'typeof', 'new', 'await', 'async', 'catch',
  'alert', 'confirm', 'setTimeout', 'clearTimeout', 'Number', 'String', 'parseInt', 'parseFloat', 'Boolean', 'Date', 'encodeURIComponent',
  'decodeURIComponent', 'isNaN', 'requestAnimationFrame', 'open']);

// Nombres de funciones globales que llaman los handlers (sin contar métodos tipo this.x()).
function funcionesLlamadasPorHandlers() {
  const nombres = new Map();
  for (const h of handlersInline()) {
    const codigo = h.texto
      .replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, 'X')
      .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
    for (const m of codigo.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const n = m[2];
      if (NO_SON_FUNCIONES_DE_LA_APP.has(n) || n === 'X') continue;
      if (!nombres.has(n)) nombres.set(n, `${h.archivo}:${h.linea}`);
    }
  }
  return nombres;
}

// Emojis (no símbolos como ✕ ✓ ★, que están permitidos).
const RE_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{FE0F}]/gu;
const PERMITIDOS = new Set(['✕', '✓', '★']); // ✕ ✓ ★
function emojisPorArchivo() {
  const archivos = [...ORDEN_SCRIPTS, 'index.html', 'sw.js', 'manifest.json', 'temporada.html'];
  const out = {};
  for (const a of archivos) {
    const lista = (leer(a).match(RE_EMOJI) || []).filter(c => !PERMITIDOS.has(c) && c !== '️');
    if (lista.length) out[a] = lista.join('');
  }
  return out;
}

module.exports = { RAIZ, leer, ORDEN_SCRIPTS, scriptsDeIndex, declaracionesTopLevel, handlersInline, funcionesLlamadasPorHandlers, emojisPorArchivo };
