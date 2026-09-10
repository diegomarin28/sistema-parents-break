const SUPABASE_URL = 'https://wvewzamdohrpfhpccvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NX4E4FfAkwFQSFo4Rgl0Jg_IcebuaaI';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage }
});

/* ---- Carga de librerías pesadas SOLO cuando hacen falta (Chart.js y xlsx no bloquean el arranque de la app) ---- */
function cargarScript(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector(`script[src="${src}"]`)){ resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar '+src));
    document.head.appendChild(s);
  });
}
let _chartPromise = null;
function asegurarChart(){
  if(window.Chart) return Promise.resolve();
  if(!_chartPromise) _chartPromise = cargarScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js');
  return _chartPromise;
}
let _xlsxPromise = null;
function asegurarXLSX(){
  if(window.XLSX) return Promise.resolve();
  if(!_xlsxPromise) _xlsxPromise = cargarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  return _xlsxPromise;
}

function normaliza(s){ return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function zonasDe(zonaStr){ return (zonaStr||'').split('/').map(z=>z.trim()).filter(Boolean); }
/* Checklist de zonas compartido — reemplaza el texto libre de antes (donde
   escribir "Pocitos, Malvín" terminaba pisando otras zonas por error). Junta
   todas las zonas que ya existen entre niñeras y familias, con checkboxes
   para elegir varias, más un campo para agregar una zona nueva si no está. */
function obtenerTodasLasZonas(){
  const mapa = new Map();
  [...(ninierasItems||[]), ...(familiasItems||[])].forEach(x=>{
    zonasDe(x.zona).forEach(raw=>{
      const key = normaliza(raw);
      if(key && !mapa.has(key)) mapa.set(key, raw);
    });
  });
  return [...mapa.values()].sort((a,b)=>a.localeCompare(b));
}
function checklistZonas(idPrefix, zonaActual){
  const todas = obtenerTodasLasZonas();
  const actuales = new Set(zonasDe(zonaActual).map(normaliza));
  return `
    <div class="field"><label>Zonas</label>
      <div id="${idPrefix}-zonas-checklist" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;border:1px solid var(--line);border-radius:8px;max-height:140px;overflow-y:auto;">
        ${todas.length ? todas.map(z=>`<label class="chk" style="margin:0;"><input type="checkbox" value="${z}" ${actuales.has(normaliza(z))?'checked':''}> ${z}</label>`).join('') : '<span class="helper" style="margin:0;">Todavía no hay zonas cargadas.</span>'}
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <input type="text" id="${idPrefix}-zona-nueva" placeholder="Agregar zona nueva…" style="flex:1;">
        <button type="button" class="smallbtn" onclick="agregarZonaAlChecklist('${idPrefix}')">+ Agregar</button>
      </div>
    </div>`;
}
function agregarZonaAlChecklist(idPrefix){
  const input = document.getElementById(idPrefix+'-zona-nueva');
  const val = (input?.value||'').trim();
  if(!val) return;
  const cont = document.getElementById(idPrefix+'-zonas-checklist');
  if(!cont) return;
  const existente = [...cont.querySelectorAll('input[type=checkbox]')].find(chk=>normaliza(chk.value)===normaliza(val));
  if(existente){ existente.checked = true; }
  else {
    const vacio = cont.querySelector('.helper');
    if(vacio) vacio.remove();
    const label = document.createElement('label');
    label.className = 'chk';
    label.style.margin = '0';
    label.innerHTML = `<input type="checkbox" value="${val}" checked> ${val}`;
    cont.appendChild(label);
  }
  input.value = '';
}
function leerZonasChecklist(idPrefix){
  const cont = document.getElementById(idPrefix+'-zonas-checklist');
  if(!cont) return '';
  return [...cont.querySelectorAll('input[type=checkbox]:checked')].map(chk=>chk.value).join('/');
}
function scrollToDetalle(id){
  const el = document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

/* Al editar/eliminar algo de una lista larga (niñeras, familias), recargar la
   lista reemplaza todo su HTML y el navegador vuelve el scroll arriba del
   todo — muy molesto si estás revisando la lista una por una. Estas dos
   funciones guardan la posición antes de recargar y la restauran después. */
function guardarScrollMainarea(){
  return document.querySelector('.mainarea')?.scrollTop ?? 0;
}
function restaurarScrollMainarea(valor){
  requestAnimationFrame(()=>{
    const el = document.querySelector('.mainarea');
    if(el) el.scrollTop = valor;
  });
}

function toast(msg, type='good'){
  let stack = document.querySelector('.toaststack');
  if(!stack){ stack = document.createElement('div'); stack.className='toaststack'; document.body.appendChild(stack); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(()=>{ el.classList.add('leaving'); setTimeout(()=>el.remove(), 220); }, 3200);
}

/* ============================================================
   F1 · Red de seguridad de errores y conexión
   Muestra un aviso claro cuando algo falla, en vez de dejar
   la pantalla a medias. No hay que tocar cada consulta:
   los fallos de red y los errores sueltos caen acá solos.
   ============================================================ */
let _sinConexion = false;
function avisarSinConexion(){
  if(_sinConexion) return;
  _sinConexion = true;
  toast('Te quedaste sin conexión. Lo que cargues no se guarda hasta que vuelva internet.', 'bad');
}
window.addEventListener('offline', avisarSinConexion);
window.addEventListener('online', ()=>{
  if(_sinConexion){ toast('Conexión restablecida.', 'good'); _sinConexion = false; }
});
window.addEventListener('unhandledrejection', (ev)=>{
  const msg = (ev.reason && (ev.reason.message || ev.reason)) || '';
  console.error('[error no manejado]', ev.reason);
  if(!navigator.onLine || /fetch|network|failed to fetch|conexi|timeout/i.test(String(msg))){
    toast('Problema de conexión. Revisá internet y reintentá.', 'bad');
  } else {
    toast('Ocurrió un error inesperado. Si sigue pasando, recargá la página.', 'bad');
  }
});

/* Envoltorio para lecturas de Supabase: si la consulta falla, avisa
   y devuelve un valor seguro en vez de romper la vista.
   Uso: const datos = await sbLeer(sb.from('ninieras').select('*'), 'las niñeras', []); */
async function sbLeer(consulta, queCosa='los datos', fallback=null){
  try {
    const { data, error } = await consulta;
    if(error){
      console.error('[Supabase] al cargar', queCosa, error);
      toast(`No se pudieron cargar ${queCosa}. Reintentá en un momento.`, 'bad');
      return fallback;
    }
    return data;
  } catch(e){
    console.error('[Supabase] al cargar', queCosa, e);
    toast(`No se pudieron cargar ${queCosa}. Revisá tu conexión.`, 'bad');
    return fallback;
  }
}

/* ============================================================
   B2 · Anti-duplicados: detecta nombres parecidos antes de crear
   una familia/niñera nueva (typos, variantes: "Paola Herpe" vs
   "Paola Gerpe", "Andrea Camps" vs "Andy Camps").
   ============================================================ */
function distanciaEdicion(a, b){
  const m = a.length, n = b.length;
  if(!m) return n; if(!n) return m;
  let prev = Array.from({length:n+1}, (_,j)=>j);
  for(let i=1;i<=m;i++){
    const cur = [i];
    for(let j=1;j<=n;j++){
      cur[j] = a[i-1]===b[j-1] ? prev[j-1] : 1+Math.min(prev[j-1], prev[j], cur[j-1]);
    }
    prev = cur;
  }
  return prev[n];
}
function nombreParecido(texto, lista){
  const q = normaliza((texto||'').trim());
  if(!q || q.length<3) return null;
  let mejor = null, mejorDist = Infinity;
  (lista||[]).forEach(o=>{
    const cand = normaliza(o.nombre||'');
    if(!cand || cand===q) return; // exacto no cuenta como "parecido", ya es la misma persona
    const dist = distanciaEdicion(q, cand);
    const umbral = cand.length<=6 ? 1 : cand.length<=10 ? 2 : 3;
    if(dist<=umbral && dist<mejorDist){ mejor = o; mejorDist = dist; }
  });
  return mejor;
}
/* Devuelve true si está OK seguir (no había parecido, o el usuario confirmó que es alguien distinto). */
async function confirmarNombreNuevo(texto, lista, tipoLabel){
  const parecido = nombreParecido(texto, lista);
  if(!parecido) return true;
  return confirmarAccion(`¿Quisiste decir "${parecido.nombre}"? Ya existe ${tipoLabel==='familia'?'una familia':'una niñera'} con un nombre muy parecido. Si es alguien distinto, confirmá para crear "${texto.trim()}" igual.`, 'Es alguien distinto, crear igual');
}

/* ============================================================
   B4 · Detección de doble reserva: avisa si una niñera queda
   comprometida en dos horarios que se pisan el mismo día.
   No bloquea — el criterio final es de quien está cargando.
   ============================================================ */
function rangosSolapan(i1, f1, i2, f2){
  if(!i1 || !i2) return false; // sin horario cargado de un lado, no se puede comparar — no molesta
  const s1 = agendaMinutos(i1), e1 = f1 ? agendaMinutos(f1) : s1+60;
  const s2 = agendaMinutos(i2), e2 = f2 ? agendaMinutos(f2) : s2+60;
  return s1 < e2 && s2 < e1;
}
/* Chequea contra lo ya cargado del día en Agenda (solicitudes confirmadas, fijos, registrados) — sin ir a la base. */
function chequearDobleReservaAgenda(nineraNombre, horaInicio, horaFin, excluirId){
  if(!horaInicio) return null;
  const key = normaliza(nineraNombre);
  for(const s of agendaSolicitudes){
    if(s.id===excluirId || s.estado==='cancelada') continue;
    const comprometida = s.ninieras.some(n=>normaliza(n.ninera_nombre)===key && n.estado==='confirmada');
    if(!comprometida) continue;
    if(rangosSolapan(horaInicio, horaFin, s.hora_inicio, s.hora_fin)) return s;
  }
  return null;
}
/* Misma idea pero consultando la base — para usar fuera de Agenda (ej. cargando un sitting a mano). */
async function chequearDobleReservaDB(nineraNombre, fecha, horaInicio, horaFin){
  if(!horaInicio) return null;
  const [{data:regs}, {data:asigs}, {data:sols}] = await Promise.all([
    sb.from('sittings_traslados').select('familia_nombre,hora_inicio,hora_fin,ninera_nombre').eq('fecha', fecha),
    sb.from('asignaciones').select('hora_inicio,hora_fin,dias,ninera_nombre, familias(nombre)'),
    sb.from('solicitudes').select('familia_nombre,hora_inicio,hora_fin,estado,solicitud_ninieras(ninera_nombre,estado)').eq('fecha', fecha),
  ]);
  const key = normaliza(nineraNombre);
  const diaSemana = diaDeFecha(fecha);
  for(const r of (regs||[])){
    if(normaliza(r.ninera_nombre)!==key) continue;
    if(rangosSolapan(horaInicio, horaFin, r.hora_inicio, r.hora_fin)) return {familia_nombre:r.familia_nombre, hora_inicio:r.hora_inicio, hora_fin:r.hora_fin};
  }
  for(const a of (asigs||[])){
    if(normaliza(a.ninera_nombre)!==key || !Array.isArray(a.dias) || !a.dias.includes(diaSemana)) continue;
    if(rangosSolapan(horaInicio, horaFin, a.hora_inicio, a.hora_fin)) return {familia_nombre:a.familias?.nombre||'(familia)', hora_inicio:a.hora_inicio, hora_fin:a.hora_fin};
  }
  for(const s of (sols||[])){
    if(s.estado==='cancelada') continue;
    const comprometida = (s.solicitud_ninieras||[]).some(n=>normaliza(n.ninera_nombre)===key && n.estado==='confirmada');
    if(!comprometida) continue;
    if(rangosSolapan(horaInicio, horaFin, s.hora_inicio, s.hora_fin)) return {familia_nombre:s.familia_nombre, hora_inicio:s.hora_inicio, hora_fin:s.hora_fin};
  }
  return null;
}
/* Al crear una asignación fija nueva: chequea contra otros fijos de esa niñera (cualquier fecha, no vencen),
   y contra sittings ya registrados o solicitudes puntuales confirmadas DE HOY EN ADELANTE cuyo día de
   semana caiga en los días elegidos para el fijo. */
async function chequearFijoNuevoContraTodo(nineraNombre, dias, horaInicio, horaFin){
  if(!horaInicio) return null;
  const hoy = todayISO();
  const key = normaliza(nineraNombre);
  const [{data:fijos}, {data:regs}, {data:sols}] = await Promise.all([
    sb.from('asignaciones').select('dias,hora_inicio,hora_fin,ninera_nombre, familias(nombre)'),
    sb.from('sittings_traslados').select('familia_nombre,fecha,hora_inicio,hora_fin,ninera_nombre').gte('fecha', hoy),
    sb.from('solicitudes').select('familia_nombre,fecha,hora_inicio,hora_fin,estado,solicitud_ninieras(ninera_nombre,estado)').gte('fecha', hoy),
  ]);
  for(const ex of (fijos||[])){
    if(normaliza(ex.ninera_nombre)!==key || !Array.isArray(ex.dias) || !dias.some(d=>ex.dias.includes(d))) continue;
    if(rangosSolapan(horaInicio, horaFin, ex.hora_inicio, ex.hora_fin)) return {familia_nombre:ex.familias?.nombre||'(familia)', hora_inicio:ex.hora_inicio, hora_fin:ex.hora_fin};
  }
  for(const r of (regs||[])){
    if(normaliza(r.ninera_nombre)!==key || !dias.includes(diaDeFecha(r.fecha))) continue;
    if(rangosSolapan(horaInicio, horaFin, r.hora_inicio, r.hora_fin)) return {familia_nombre:r.familia_nombre, hora_inicio:r.hora_inicio, hora_fin:r.hora_fin, fecha:r.fecha};
  }
  for(const s of (sols||[])){
    if(s.estado==='cancelada' || !dias.includes(diaDeFecha(s.fecha))) continue;
    const comprometida = (s.solicitud_ninieras||[]).some(n=>normaliza(n.ninera_nombre)===key && n.estado==='confirmada');
    if(!comprometida) continue;
    if(rangosSolapan(horaInicio, horaFin, s.hora_inicio, s.hora_fin)) return {familia_nombre:s.familia_nombre, hora_inicio:s.hora_inicio, hora_fin:s.hora_fin, fecha:s.fecha};
  }
  return null;
}
function horaTxt(h){ return h ? h.slice(0,5) : '?'; }
async function avisarSiDobleReserva(choque, nineraNombre, textoBoton){
  if(!choque) return true;
  const fechaTxt = choque.fecha ? ` el ${new Date(choque.fecha+'T00:00:00').toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})}` : '';
  return confirmarAccion(`${nineraNombre} ya está comprometida con ${choque.familia_nombre}${fechaTxt} de ${horaTxt(choque.hora_inicio)} a ${horaTxt(choque.hora_fin)}, que se pisa con este horario. ¿Seguir igual?`, textoBoton);
}

function confirmarAccion(mensaje, textoBoton='Eliminar'){
  return new Promise((resolve)=>{
    const overlay = document.createElement('div');
    overlay.className = 'confirmoverlay';
    overlay.innerHTML = `
      <div class="confirmbox">
        <div class="confirmmsg">${mensaje}</div>
        <div class="confirmbtns">
          <button class="btn ghost" id="confirm-no">Cancelar</button>
          <button class="btn danger" id="confirm-si">${textoBoton}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('show'));
    function cerrar(resultado){
      overlay.classList.remove('show');
      setTimeout(()=>overlay.remove(), 180);
      resolve(resultado);
    }
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) cerrar(false); });
    overlay.querySelector('#confirm-no').addEventListener('click', ()=>cerrar(false));
    overlay.querySelector('#confirm-si').addEventListener('click', ()=>cerrar(true));
  });
}

function abrirLightboxFoto(url, alt=''){
  if(!url) return;
  cerrarLightboxFoto(); // por si había uno colgado de antes
  const ov = document.createElement('div');
  ov.id = 'fotolightbox';
  ov.className = 'confirmoverlay';
  ov.style.zIndex = '400';
  ov.style.cursor = 'zoom-out';
  ov.innerHTML = `<img id="fotolightbox-img" src="${url}" alt="${alt}" style="max-width:92vw;max-height:92vh;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
    <button class="modal-close" onclick="cerrarLightboxFoto()" aria-label="Cerrar" style="position:fixed;top:18px;right:22px;">×</button>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (e)=>{ if(e.target===ov) cerrarLightboxFoto(); });
  requestAnimationFrame(()=>ov.classList.add('show'));
}
function cerrarLightboxFoto(){
  const ov = document.getElementById('fotolightbox');
  if(!ov) return;
  ov.style.pointerEvents = 'none'; // deja de bloquear clics apenas se empieza a cerrar
  ov.classList.remove('show');
  setTimeout(()=>{ ov.remove(); }, 200); // recién ahí lo saca del todo, cuando terminó la animación
}
let modalToken = 0;
function abrirModal(html){
  modalToken++;
  let overlay = document.getElementById('editmodal');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.className = 'confirmoverlay';
    overlay.id = 'editmodal';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) cerrarModal(); });
  }
  overlay.innerHTML = `<div class="confirmbox wide"><button class="modal-close" onclick="cerrarModal()" aria-label="Cerrar">×</button>${html}</div>`;
  requestAnimationFrame(()=>overlay.classList.add('show'));
}
let modalNodoOrigen = null;
function abrirModalConNodo(node, headerHtml=''){
  modalToken++;
  let overlay = document.getElementById('editmodal');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.className = 'confirmoverlay';
    overlay.id = 'editmodal';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) cerrarModal(); });
  }
  modalNodoOrigen = { node, parent: node.parentNode, next: node.nextSibling };
  const box = document.createElement('div');
  box.className = 'confirmbox wide';
  box.innerHTML = `<button class="modal-close" onclick="cerrarModal()" aria-label="Cerrar">×</button>`;
  if(headerHtml) box.innerHTML += headerHtml;
  box.appendChild(node);
  overlay.innerHTML = '';
  overlay.appendChild(box);
  requestAnimationFrame(()=>overlay.classList.add('show'));
}
function cerrarModal(){
  const overlay = document.getElementById('editmodal');
  if(!overlay) return;
  const myToken = modalToken;
  overlay.classList.remove('show');
  setTimeout(()=>{
    if(modalToken !== myToken) return; // se abrió un modal nuevo mientras este se cerraba — no lo pisemos
    if(modalNodoOrigen){
      const {node, parent, next} = modalNodoOrigen;
      if(parent){ parent.insertBefore(node, next); }
      modalNodoOrigen = null;
    }
    overlay.remove();
  }, 180);
}

/* columnas de candidatas que vienen del form / ficha (nombres = columnas reales de la tabla) */
const FICHA_CAMPOS = [
  {key:'nombre', label:'Nombre', hints:['nombre']},
  {key:'apellido', label:'Apellido', hints:['apellido']},
  {key:'edad', label:'Edad / fecha de nacimiento', hints:['edad']},
  {key:'disponibilidad', label:'Disponibilidad', hints:['disponibilidad para hacer']},
  {key:'zona_sitting', label:'Zona en la que puede hacer sitting', hints:['que puede hacer sitting']},
  {key:'disponible_tipo', label:'Disponible para', hints:['disponible para realizar']},
  {key:'fechas_punta', label:'Fechas en Punta del Este', hints:['punta del este']},
  {key:'primeros_auxilios', label:'Curso primeros auxilios', hints:['primeros auxilio']},
  {key:'trabaja_actualmente', label:'Trabaja actualmente', hints:['trabajas actualmente']},
  {key:'cambia_panales', label:'Cambia pañales', hints:['panales']},
  {key:'dispone_traslados', label:'Dispuesta a traslados', hints:['traslado']},
  {key:'patologias', label:'Patologías / condiciones declaradas', hints:['patolog']},
  {key:'capacitacion_extra', label:'Capacitación extra', hints:['capacitacion']},
  {key:'comentarios', label:'Comentarios', hints:['comentario']},
  {key:'licencia', label:'Licencia de conducir', hints:['licencia']},
  {key:'mail', label:'Mail', hints:['mail','correo']},
  {key:'telefono', label:'Teléfono', hints:['telefono','celular']},
  {key:'universidad', label:'Universidad / qué estudia', hints:['universidad']},
  {key:'bachillerato', label:'Bachillerato / colegio', hints:['bachillerato']},
  {key:'cocina', label:'Cocina (escala 1-5)', hints:['cocina']},
  {key:'idiomas', label:'Idiomas', hints:['idioma']},
  {key:'experiencia', label:'Experiencia con niños', hints:['experiencia']},
  {key:'zona', label:'Zona en la que vive', hints:['vive']},
];

const COMPETENCIAS = [
  {key:'responsabilidad', titulo:'Responsabilidad y puntualidad', preguntas:['Contame de una vez que tuviste que cambiar un plan personal porque te llamaron para cubrir un turno de urgencia. ¿Qué hiciste?','¿Cómo avisás si sabés que vas a llegar tarde o no vas a poder ir a un turno?']},
  {key:'seguridad', titulo:'Seguridad y manejo de imprevistos', preguntas:['Si un nene se cae y se lastima mientras estás sola con él, ¿qué es lo primero que hacés?','¿Qué harías si no podés comunicarte con los padres en una emergencia?']},
  {key:'limites', titulo:'Límites y disciplina positiva', preguntas:['Contame cómo manejás una rabieta fuerte de un nene de 3-4 años.','¿Qué opinás de poner límites firmes sin gritar ni castigar?']},
  {key:'experiencia', titulo:'Experiencia práctica y logística', preguntas:['Contame tu experiencia con nenes de la edad que buscamos. ¿Manejaste rutinas de sueño o comida?','Si el rol incluye traslados: ¿tenés carné vigente y experiencia manejando con niños en el auto?']},
  {key:'actitud', titulo:'Actitud y calidez', preguntas:['¿Qué te gusta de cuidar niños? Contame una anécdota linda.','¿Cómo te llevás con coordinar horarios por WhatsApp día a día?']},
  {key:'presentacion', titulo:'Presentación', preguntas:[], helper:'Impresión general: puntualidad, prolijidad, primera impresión.'},
  {key:'comunicacion', titulo:'Comunicación', preguntas:[], helper:'Claridad para expresarse, fluidez, cómo responde en la charla.'},
];
// Presentación y Comunicación se muestran aparte, justo antes de "Señales de alerta"
// (después de Explicación de juegos y Psicotécnico) — no junto al resto de competencias.
const COMP_FINALES_KEYS = ['presentacion','comunicacion'];
const COMP_PRINCIPALES = COMPETENCIAS.filter(c=>!COMP_FINALES_KEYS.includes(c.key));
const COMP_FINALES = COMPETENCIAS.filter(c=>COMP_FINALES_KEYS.includes(c.key));
const REDFLAGS = [
  {key:'tarde', texto:'Llegó tarde a la entrevista sin avisar', critico:false},
  {key:'malhabla', texto:'Habla mal de familias o trabajos anteriores sin matices', critico:false},
  {key:'sinref', texto:'No puede dar ni un contacto de referencia', critico:true},
  {key:'evade', texto:'Evade preguntas directas sobre por qué dejó el último trabajo', critico:false},
  {key:'inseguraseg', texto:'Se muestra insegura o evasiva ante preguntas básicas de seguridad', critico:true},
  {key:'despectiva', texto:'Actitud despectiva hacia límites o reglas puestas por la familia', critico:false},
];
const PSICO_IMGS = [
  {id:'p1', svg:`<svg viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><path d="M100 20 C60 40 40 80 60 110 C30 120 20 160 60 175 C90 190 110 170 100 150 C140 165 175 130 150 100 C180 85 170 45 135 45 C130 20 110 15 100 20Z" fill="#2C4A38" opacity="0.85"/></svg>`},
  {id:'p2', svg:`<svg viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><ellipse cx="100" cy="70" rx="55" ry="35" fill="#C97D42" opacity="0.85"/><ellipse cx="100" cy="140" rx="70" ry="40" fill="#35604A" opacity="0.7"/><circle cx="60" cy="60" r="14" fill="#B9862E"/><circle cx="140" cy="60" r="14" fill="#B9862E"/></svg>`},
  {id:'p3', svg:`<svg viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><path d="M100 15 L130 80 L190 90 L145 130 L160 190 L100 155 L40 190 L55 130 L10 90 L70 80 Z" fill="#52655A" opacity="0.8"/></svg>`},
];

