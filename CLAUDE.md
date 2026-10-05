# Parents Break: sistema operativo

Sistema real de Parents Break (cuidado infantil y traslados, Montevideo). Lo usan todos los
días sus dueñas, Paulina y Delfina. Desarrollador: Diego. Cualquier bug llega a producción y
a las familias y niñeras.

## Stack
- HTML/CSS/JS vanilla, sin build ni framework. GitHub Pages publica desde `main`.
- `index.html` = head + CSS + `<div id="app">` + scripts. Todo el HTML de la app lo genera JS.
- Supabase (proyecto "Parents-break", ref `wvewzamdohrpfhpccvcz`): Postgres + Auth (contraseña
  y passkeys) + RLS solo para usuarios autenticados + Realtime + Storage + Edge Functions.
- PWA: `manifest.json` + `sw.js`. El service worker solo maneja push y notificationclick: NO
  hay modo offline (no tiene listener de fetch). Agregar offline es un pendiente aparte.
- Estructura de la base (sin datos): `supabase/schema.sql`. Si un PR cambia la estructura,
  actualizarlo en el mismo PR.

## Scripts y orden de carga (index.html)
14 archivos en `js/`: core → auth → app-shell → finanzas → juguetes → agenda → contratos →
marketing → postulantes → ninieras → familias → sittings → intermediaciones → bootstrap
(último).
- Son scripts clásicos, NO `type="module"`: hay ~335 handlers inline (onclick, onchange,
  oninput...) dentro del HTML que arma el JS, y llaman funciones globales por nombre.
- Utilidades que viven fuera de lugar y se usan desde otros archivos: `renderModulo()` y la
  capa Realtime están en `agenda.js`; `shiftMes()` y `monthLabel()` están en `sittings.js`.
  Solo se pueden llamar en tiempo de ejecución, nunca desde el nivel superior de un archivo
  que carga antes. Las fechas (`todayISO()`, `currentMonthStr()`, `sumarDiasISO()`) están en
  `core.js` desde el 05/10/2026.

## Reglas fijas
1. Nunca hacer commit directo a `main`. Cada tarea va en una rama nueva con su Pull Request.
   Diego aprueba el merge.
2. No afirmar que algo funciona sin probarlo: `node --check` de cada archivo tocado y, cuando
   aplique, prueba en navegador headless con evidencia (capturas o salida de tests).
3. No agregar emojis nuevos en el código (textos, títulos, mensajes, carteles). Los que ya
   existen, incluidos los de los mensajes de WhatsApp, se quedan por ahora. Los símbolos
   ✕, ✓ y ★ están permitidos. `tests/estatico.spec.js` controla la lista.
4. No convertir los scripts a módulos ni cambiar el orden de carga sin consultar.
5. Si una decisión es de producto o de diseño, preguntar antes de elegir.
6. Nunca usar las cuentas reales de Paulina o Delfina, tampoco en tests.
7. `temporada.html` está EN USO (formulario de disponibilidad de verano que se manda a las
   niñeras cada octubre): no tocarlo ni romperlo. La página real la sirve Cloudflare, que es
   configuración externa: no auditarla.

## Base de producción
- Para diagnosticar se pueden LEER datos de producción (solo lectura).
- Escribir en producción solo para corregir datos rotos por un bug, y nunca desde tests:
  1. Primero mostrarle a Diego las filas afectadas, cómo quedan antes y después, y el SQL
     exacto.
  2. Antes de modificar, guardar una copia de esas filas (tabla de respaldo o archivo).
  3. Ejecutar recién cuando Diego diga OK explícitamente.
- Los cambios de estructura (migraciones) también se proponen primero y se aplican con OK.
  Van en `supabase/migraciones/AAAAMMDD_descripcion.sql` (en una transacción, con respaldo
  previo y compatibles con la app que está publicada), junto a un `..._DESHACER.sql`, y se
  reflejan en `supabase/schema.sql`. Se prueban antes en un Postgres local.

## Tests
```bash
npm ci
npx playwright install chromium   # una vez
npm test                          # todo
npm run test:static               # solo los chequeos estáticos (segundos)
```
- `tests/estatico.spec.js`: `node --check`, orden de scripts, globales duplicadas, emojis,
  redirección de temporada.html.
- `tests/humo.spec.js`: Chromium headless; login, todos los módulos, modales, formularios
  principales (verifica lo que se manda a la base).
- `tests/fijos.spec.js`: vigencia de los fijos, cambio de niñera desde una fecha, registros
  vinculados a la asignación, historial de sittings, app nueva con base sin migrar.
- `tests/fechas.spec.js`: "hoy" a las 22:30, fin de mes y de año, semanas que cruzan de mes,
  celular con otra zona horaria.
- `tests/finanzas.spec.js`: resumen del mes (facturado, cobrado, por cobrar, por pagar,
  resultado).
- `tests/regresiones.spec.js`: bugs conocidos. Los que tienen `test.fail()` todavía no están
  arreglados; cuando el arreglo se mergea, el test empieza a pasar y hay que sacarle la marca.
- Supabase está simulado en `tests/support/app.js` con datos ficticios (`tests/support/datos.js`).
  Ningún test llega a la base real: un pedido sin simular hace fallar el test.
- supabase-js se sirve desde `tests/vendor/` (la misma versión que `index.html`). En el
  entorno cloud de Claude, cdn.jsdelivr.net está bloqueado.
- El CI corre todo en cada PR (`.github/workflows/tests.yml`).
- Más adelante: tests de integración contra un proyecto de Supabase gratis aparte (nunca
  producción).

## Convenciones
- UI y comentarios en español rioplatense (voseo). Los comentarios explican el porqué y
  fechan los incidentes reales; mantener ese estilo.
- Todo texto que venga de datos (nombres, notas, URLs) y vaya a innerHTML o a un handler
  inline se tiene que escapar. Las candidatas llegan desde un formulario público.
- Fechas: Montevideo es UTC-3. "Hoy" sale siempre de `todayISO()` (core.js, fijado a
  America/Montevideo aunque el celular tenga otra zona). Nunca `toISOString().slice(0,10)`
  para una fecha: es UTC y de 21:00 a 24:00 ya da mañana. Para sumar días a "AAAA-MM-DD",
  `sumarDiasISO()`; para el mes siguiente, `shiftMes()`.
- Guardados: usar `sbGuardar()` o chequear `error`; nunca mostrar éxito sin verificarlo.
- No repintar la app entera ante eventos de auth ni al volver de segundo plano: ya causó
  pérdida de entrevistas (ver comentarios en auth.js y bootstrap.js).
- Una función global nueva no puede repetir el nombre de otra en ningún archivo.
- Fijos (asignaciones): tienen vigencia (`vigente_desde`/`vigente_hasta`, inclusive) y tipo.
  Nunca pisar la niñera de una asignación con historia: cerrarla y abrir otra desde una
  fecha. Lo que se registra desde un fijo lleva `asignacion_id`. Para saber si un fijo
  corre un día, usar `asignacionVigenteEn(a, fecha)` (core.js).
- Finanzas: el resultado del mes se calcula sobre lo facturado; cobrado/pagado solo dicen si
  la plata ya entró o salió (error E1, 05/10/2026).

## Pendientes conocidos
- Plan de PRs acordado el 04/10/2026: fix E1/E2, fechas (todayISO), escape de HTML,
  guardados con éxito falso, confirmación al marcar pagado, pantalla de carga, alta de
  niñera solo con nombre, bloques del formulario en la entrevista, diseño de fijos
  automáticos.
- Las Edge Functions (candidatas-webhook, resenas-webhook, carsitting-webhook,
  carsitting-recordatorio, whatsapp-webhook, enviar-push-urgentes, temporada-ninera) no
  están versionadas en el repo.
