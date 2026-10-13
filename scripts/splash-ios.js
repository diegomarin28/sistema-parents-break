// Pantallas de inicio del iPhone (15/10/2026). Al abrir la app instalada, iOS muestra una
// imagen de arranque o, si no hay una para ese tamaño de pantalla, una pantalla blanca: no usa
// el background_color del manifest. Se genera una por tamaño de iPhone (en vertical), con el
// fondo de la app y el símbolo de 140 px de alto, igual que la pantalla de carga de index.html.
// Uso (si cambia el logo o sale un iPhone de otro tamaño): node scripts/splash-ios.js
// Escribe splash/*.png e imprime las <link> para pegar en el <head> de index.html.
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

// [ancho, alto] en puntos CSS y escala de pantalla.
const PANTALLAS = [
  [320, 568, 2],  // iPhone SE (1.ª)
  [375, 667, 2],  // iPhone SE (2.ª y 3.ª), 6, 7, 8
  [414, 736, 3],  // iPhone 6/7/8 Plus
  [375, 812, 3],  // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 2],  // iPhone XR, 11
  [414, 896, 3],  // iPhone XS Max, 11 Pro Max
  [390, 844, 3],  // iPhone 12, 13, 14, 16e
  [428, 926, 3],  // iPhone 12/13 Pro Max, 14 Plus
  [393, 852, 3],  // iPhone 14 Pro, 15, 15 Pro, 16
  [430, 932, 3],  // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3],  // iPhone 16 Pro, 17, 17 Pro
  [420, 912, 3],  // iPhone Air
  [440, 956, 3],  // iPhone 16 Pro Max, 17 Pro Max
];
const FONDO = '#F6F5FB'; // --bg de index.html y background_color del manifest

(async () => {
  const raiz = path.join(__dirname, '..');
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(raiz, 'logo-simbolo.png')).toString('base64');
  const navegador = await chromium.launch();
  const links = [];
  for (const [w, h, r] of PANTALLAS) {
    const pagina = await navegador.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
    await pagina.setContent(`<body style="margin:0;background:${FONDO};height:100vh;display:flex;align-items:center;justify-content:center;">
      <img src="${logo}" style="height:min(140px,22vh);width:auto;"></body>`);
    await pagina.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
    const archivo = `splash/iphone-${w * r}x${h * r}.png`;
    await pagina.screenshot({ path: path.join(raiz, archivo) });
    await pagina.close();
    links.push(`<link rel="apple-touch-startup-image" href="${archivo}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)">`);
  }
  await navegador.close();
  console.log(links.join('\n'));
})();
