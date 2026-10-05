// Capa 1: chequeos estáticos, sin navegador. Corren en segundos.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');
const { RAIZ, leer, ORDEN_SCRIPTS, scriptsDeIndex, declaracionesTopLevel, emojisPorArchivo } = require('./support/fuentes');

test.describe('estático', () => {
  for (const archivo of [...ORDEN_SCRIPTS, 'sw.js']) {
    test(`node --check ${archivo}`, () => {
      execFileSync(process.execPath, ['--check', path.join(RAIZ, archivo)], { stdio: 'pipe' });
    });
  }

  test('manifest.json es JSON válido', () => {
    const m = JSON.parse(leer('manifest.json'));
    expect(m.start_url).toBe('./');
  });

  test('los handlers inline reciben los datos con argJs(), nunca entre comillas a mano', () => {
    // 05/10/2026: onclick="f('${nombre}')" se rompía con D'Alessandro y dejaba inyectar código.
    // El dato va como onclick="f(${argJs(nombre)})" (ver core.js, "Escape de datos").
    const malos = [];
    for (const archivo of ORDEN_SCRIPTS) {
      leer(archivo).split('\n').forEach((l, i) => {
        for (const m of l.matchAll(/\bon[a-z]+=(["'])(.*?)\1/g)) {
          if (/\\?'\$\{|"\$\{/.test(m[2]) || (m[1] === "'" && m[2].includes('${'))) malos.push(`${archivo}:${i + 1}: ${m[0].slice(0, 90)}`);
        }
      });
    }
    expect(malos).toEqual([]);
  });

  test('index.html carga los scripts en el orden acordado (bootstrap.js último)', () => {
    expect(scriptsDeIndex()).toEqual(ORDEN_SCRIPTS);
    expect(leer('index.html')).not.toMatch(/type=["']module["']/);
  });

  test('ninguna función o variable global está definida dos veces', () => {
    const porNombre = new Map();
    for (const d of declaracionesTopLevel()) {
      if (!porNombre.has(d.nombre)) porNombre.set(d.nombre, []);
      porNombre.get(d.nombre).push(`${d.archivo}:${d.linea}`);
    }
    const duplicadas = [...porNombre].filter(([, lugares]) => lugares.length > 1).map(([n, l]) => `${n} -> ${l.join(', ')}`);
    expect(duplicadas).toEqual([]);
  });

  test('no se agregan emojis nuevos (los que ya existían quedan, ✕ ✓ ★ permitidos)', () => {
    // Lista congelada el 04/10/2026. Si un cambio saca uno de estos, actualizar acá.
    expect(emojisPorArchivo()).toEqual({
      'js/familias.js': '💛',
      'js/ninieras.js': '🎂💛☺',
      'js/postulantes.js': '⚠',
    });
  });

  test('ninguna fecha se saca con toISOString().slice(0,10) (es UTC: de noche da mañana)', () => {
    // 05/10/2026: todayISO() hacía eso y a partir de las 21:00 proponía la fecha de mañana.
    // Única excepción: el id de la notificación del extracto, que no se muestra (cambiarlo
    // haría reaparecer avisos ya leídos).
    const usos = [];
    for (const archivo of ORDEN_SCRIPTS) {
      leer(archivo).split('\n').forEach((l, i) => {
        if (/toISOString\(\)\.slice\(0, ?10\)/.test(l) && !l.includes("id: 'extracto:'")) usos.push(`${archivo}:${i + 1}`);
      });
    }
    expect(usos).toEqual([]);
  });

  test('temporada.html sigue redirigiendo al formulario de temporada (está en uso)', () => {
    const html = leer('temporada.html');
    expect(html).toContain("location.replace('https://parentsbreak.pages.dev/temporada' + location.search)");
  });
});
