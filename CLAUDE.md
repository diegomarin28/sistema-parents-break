# Parents Break: sistema operativo

Sistema real de Parents Break (cuidado infantil y traslados, Montevideo). Lo usan todos los
días sus dueñas, Paulina y Delfina. Desarrollador: Diego. Cualquier bug llega a producción y
a las familias y niñeras.

## Stack
- HTML/CSS/JS vanilla, sin build ni framework. GitHub Pages publica desde `main`.
- `index.html` = head + CSS + `<div id="app">` (con la pantalla de carga inicial) + scripts.
  Todo el HTML de la app lo genera JS. supabase-js se carga de `vendor/`, justo antes de core.js.
- Supabase (proyecto "Parents-break", ref `wvewzamdohrpfhpccvcz`): Postgres + Auth (contraseña
  y passkeys) + RLS + Realtime + Storage + Edge Functions.
- Acceso (11/10/2026): el registro público está apagado y las políticas RLS solo dejan entrar a
  las cuentas de `usuarias_autorizadas` (activas), con `(select public.es_usuaria_autorizada())`.
  Una política nueva usa eso, nunca "authenticated" a secas. Sumar o sacar a alguien es un
  insert/update en esa tabla (por id, con OK de Diego).
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
- **Esto es producción.** En la base real nunca se escriben datos de prueba: los tests corren
  solo contra el simulador.
- **El repo es público** (GitHub Pages publica desde `main`). En el repo, los tests, los
  comentarios, los commits y las descripciones de PR no van nombres, ids, cuentas,
  teléfonos ni montos reales de familias, niñeras o candidatas. Los datos de los tests son
  inventados ("Familia Prueba Uno", "Ana Ficticia", cuentas 0001234567...). Los extractos
  bancarios reales se usan solo en una carpeta temporal y nunca se commitean, ni recortados.
  Una migración que necesita tocar filas puntuales las nombra solo por id.
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
- `tests/guardados.spec.js`: doble toque, base que falla o sin conexión, cerrar el modal a mitad
  del guardado, terminar un fijo desde una fecha.
- `tests/pagos.spec.js`: confirmación al marcar pagado y Por pagar sin sittings futuros.
- `tests/arranque.spec.js`: pantalla de carga, error si no carga supabase-js, "Entrando…".
- `tests/alta-ninera.spec.js`: alta de niñera con solo el nombre.
- `tests/entrevista.spec.js`: bloques del formulario en la entrevista y datos corregidos en la
  ficha de la niñera.
- `tests/entrevista-en-curso.spec.js`: guardar la entrevista a medias, retomarla desde
  Candidatas guardadas o desde la candidata, completarla en la misma fila, base sin migrar.
- `tests/conciliacion.spec.js`: conciliación con el extracto (tildadas, dudosas, confirmar) y
  lectores por formato. Los extractos de los tests son inventados: nunca uno real, ni recortado.
- `tests/exploratorio.spec.js`: punta a punta, celular 390px, datos raros, base vacía, navegar
  rápido, dos usuarias a la vez (Realtime simulado: `estado.emitirRealtime`), totales.
- `tests/fijos-automaticos.spec.js`: previstos solo en la Agenda, cambios de un día sobre el
  previsto, cambios del fijo que recalculan, pausas, revisión en Hoy, Finanzas sin previstos, y
  todo apagado sin la marca. La función de la base se prueba aparte en Postgres local:
  `supabase/pruebas/fijos_automaticos.sql` y, con el "hoy" fijado a mano (fin de mes y de
  año, pausas entre semanas, cambios desde una fecha), `fijos_automaticos_bordes.sql`
  (nunca en producción).
- `tests/saldo.spec.js`: saldo a favor (ajustes) en Por pagar / Por cobrar, al marcar pagado o
  cobrado, en la ficha, en el PDF y con la base sin la tabla.
- `tests/gastos-extra.spec.js`: gastos extra con ticket en el formulario, en Por cobrar / Por
  pagar (cobrar y reintegrar), saldo a favor si lo pagó la familia, PDF y base sin la tabla.
- `tests/regresiones.spec.js`: bugs conocidos. Los que tienen `test.fail()` todavía no están
  arreglados; cuando el arreglo se mergea, el test empieza a pasar y hay que sacarle la marca.
- Supabase está simulado en `tests/support/app.js` con datos ficticios (`tests/support/datos.js`).
  Ningún test llega a la base real: un pedido sin simular hace fallar el test.
- supabase-js 2.117.2 está en el repo (`vendor/`, desde el 05/10/2026): la app y los tests lo
  cargan de ahí, sin CDN. `tests/estatico.spec.js` controla la versión y el sha256.
- El CI corre todo en cada PR (`.github/workflows/tests.yml`).
- Más adelante: tests de integración contra un proyecto de Supabase gratis aparte (nunca
  producción).

## Edge Functions
- El código está en `supabase/functions/<nombre>/` desde el 06/10/2026. Todas con
  verify_jwt = false. Se publican con el OK de Diego y el repo tiene que quedar igual a lo
  publicado.
- Los webhooks de formularios piden `x-webhook-secret` (WEBHOOK_SECRET), enviar-push-urgentes
  pide `x-cron-secret` (app_secrets 'cron_push_secret', lo manda el cron) y whatsapp-webhook
  verifica la firma de Meta (WHATSAPP_APP_SECRET).
- Para revisarlas: `npx deno@2 check` desde una carpeta fuera del repo (el package.json de la
  raíz confunde a Deno).

## Convenciones
- UI y comentarios en español rioplatense (voseo). Los comentarios explican el porqué y
  fechan los incidentes reales; mantener ese estilo.
- Todo texto que venga de datos (nombres, notas, URLs) y vaya a innerHTML o a un handler
  inline se tiene que escapar. Las candidatas llegan desde un formulario público.
- Fechas: Montevideo es UTC-3. "Hoy" sale siempre de `todayISO()` (core.js, fijado a
  America/Montevideo aunque el celular tenga otra zona). Nunca `toISOString().slice(0,10)`
  para una fecha: es UTC y de 21:00 a 24:00 ya da mañana. Para sumar días a "AAAA-MM-DD",
  `sumarDiasISO()`; para el mes siguiente, `shiftMes()`.
- Guardados: usar `sbGuardar()` o chequear `error`; nunca mostrar éxito sin verificarlo (si
  un paso secundario falla, el aviso dice qué faltó). Todo botón que escribe en la base va
  con `conGuardado(this, ()=>guardarX())` (core.js): deshabilitado y con ruedita mientras
  guarda, sin doble insert por doble toque. Lo controla `tests/estatico.spec.js`.
- Fijos: nunca se borran. "Terminar desde [fecha]" completa `vigente_hasta` con el día
  anterior (`abrirModalTerminarFijo`, agenda.js).
- No repintar la app entera ante eventos de auth ni al volver de segundo plano: ya causó
  pérdida de entrevistas (ver comentarios en auth.js y bootstrap.js).
- Realtime tampoco repinta lo que se está escribiendo: RR.HH. en Entrevista y Finanzas usan
  recarga liviana (`RT_RECARGA_LIVIANA`, agenda.js); con un modal abierto el cambio se aplica al
  cerrarlo.
- Una función global nueva no puede repetir el nombre de otra en ningún archivo.
- Escape (05/10/2026): helpers únicos en core.js. `escaparHtml()` para texto y atributos,
  `argJs()` para pasar un dato a un handler inline (`f(${argJs(x)})`, nunca `'${x}'`) y
  `urlSegura()` para href/src. `tests/escape.spec.js` recorre todo con datos tramposos y
  `estatico.spec.js` controla los handlers.
- Fijos (asignaciones): tienen vigencia (`vigente_desde`/`vigente_hasta`, inclusive) y tipo.
  Nunca pisar la niñera de una asignación con historia: cerrarla y abrir otra desde una
  fecha. Lo que se registra desde un fijo lleva `asignacion_id`. Para saber si un fijo
  corre un día, usar `asignacionVigenteEn(a, fecha)` (core.js).
- Fijos que empezaron antes de la app (10/10/2026): la fecha real va en `inicio_real` (solo se
  muestra, "empezó el"); `vigente_desde` es desde cuándo se registra en la app. Nunca llevar
  `vigente_desde` hacia atrás a meses que están en los Docs.
- Finanzas: el resultado del mes se calcula sobre lo facturado; cobrado/pagado solo dicen si
  la plata ya entró o salió (error E1, 05/10/2026).
- Fijos automáticos (06/10/2026): la base carga sola los próximos 14 días de cada fijo como
  sittings `estado='previsto'` (`generar_previstos_fijos`, pg_cron 03:00) y el día que llegan
  pasan a `confirmado`. Rige solo con `app_config` 'fijos_automaticos' activo (lo prende
  `..._ACTIVAR.sql`); apagado, todo funciona como antes. Previstos solo en la Agenda: toda
  consulta de sittings que muestra "lo que pasó" va con `sinPrevistos()` (core.js). Un
  cambio de un solo día corrige la fila prevista (y la marca `generado_automatico=false`);
  un cambio del fijo (niñera, horario, vigencia, pausa, tarifa) llama a
  `sincronizarPrevistosFijos()`. Los cambios de horario también van "desde [fecha]".
  Si el cambio (niñera, horario, precio o tarifa) rige desde hoy, el sitting de hoy ya
  confirmado sigue al fijo, y pausarlo o terminarlo desde hoy lo cancela en $0
  (`alinearRegistroDeHoy`, agenda.js); solo si es automático y nadie lo tocó (sin editar,
  cobrar ni pagar): si no, se avisa.
- Entrevista a medias (09/10/2026): `entrevistas.estado` 'en_curso' / 'completa'. A medias la
  candidata sigue en 'intake'; al completarla se actualiza la misma fila (`entrevistaState.entrevistaId`).
- Candidatas: lo corregido en la entrevista vive en `notas_ficha` y pisa la respuesta del
  formulario; para mostrar datos de una candidata/niñera usar `datosFichaCandidata()` (core.js).
- Extractos (05/10/2026): leer y conciliar están separados. Cada banco o billetera es un lector
  en `LECTORES_EXTRACTO` (finanzas.js) que devuelve movimientos `{fecha, concepto, cuenta,
  credito, debito}`; hoy está Itaú. Para Mercado Pago se agrega un lector, sin tocar el matching.
- Saldo a favor (07/10/2026): `ajustes_saldo` (positivo suma, negativo descuenta) se aplica
  al grupo más viejo de esa persona en Por pagar / Por cobrar (`aplicarAjustesAGrupos`,
  finanzas.js) y al marcar pagado/cobrado queda anotado en `aplicado`. No toca facturado ni
  resultado del mes.
- Gastos extra (08/10/2026): `gastos_extra`, ticket obligatorio en el bucket PRIVADO
  `comprobantes` (se abre con `createSignedUrl`, nunca URL pública). Si lo pagó la niñera va
  aparte en Por cobrar / Por pagar (`cobrado` / `reintegrado`); si lo pagó la familia genera
  un ajuste de saldo a favor. Nunca suma al facturado ni al margen.
- Pagos a niñeras: "Por pagar" no muestra sittings con fecha futura (E7) y marcar pagado
  siempre pasa por `confirmarPagoSittings()` con el detalle y el total (E3).

## Pendientes conocidos
- Conciliación con el extracto + saldo a favor (B10, 06/10/2026), para cuando se retome la
  conciliación (está en pausa): hoy busca el total sin descontar el saldo a favor (un pago
  neto no aparece o queda como dudoso) y al marcar cobrado/pagado desde ahí no anota el saldo
  como usado (`registrarAplicacionAjustes`), así que se volvería a descontar. Mientras tanto,
  con saldo a favor se marca desde Por cobrar / Por pagar.
- Plan de PRs acordado el 04/10/2026: fix E1/E2, fechas (todayISO), escape de HTML,
  guardados con éxito falso, confirmación al marcar pagado, pantalla de carga, alta de
  niñera solo con nombre, bloques del formulario en la entrevista, diseño de fijos
  automáticos.
- Cambio de banco (06/10/2026): Parents Break pasa de Itaú a Mercado Pago esta semana y el
  extracto de Itaú ya no llega. Cuando haya un extracto de Mercado Pago, se arma su lector en
  `LECTORES_EXTRACTO` (finanzas.js). Los avisos de "Falta subir el extracto de Itaú" (campanita
  y enviar-push-urgentes) hay que adaptarlos entonces.
- `temporada-ninera` (S3): no pide el link con token y acepta nombre + celular nuevo. Se
  endurece en noviembre, cuando termine la temporada (el formulario está en uso todo octubre).
  Tiene además un error de tipos (TS18046) que ya traía la versión publicada.
