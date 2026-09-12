const SUPABASE_URL = 'https://wvewzamdohrpfhpccvcz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NX4E4FfAkwFQSFo4Rgl0Jg_IcebuaaI';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage, experimental: { passkey: true } }
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
/* ============================================================
   Grupos de zona: zonas muy puntuales (San Nicolás/Olivos/Carrasco) que en
   la práctica están a un par de cuadras, pero como texto nunca "matcheaban"
   entre sí para sugerir niñera↔familia. Los grupos son solo para matching —
   la zona real de cada niñera/familia nunca se toca ni se le agrega nada.
   ============================================================ */
let zonaGruposCache = null;
async function cargarZonaGrupos(){
  const { data } = await sb.from('zona_grupos').select('*').order('orden');
  zonaGruposCache = data || [];
  return zonaGruposCache;
}
// Lista blanca de zonas ya revisadas -- lo que esté en los datos pero no acá es "nuevo, sin revisar".
let zonasConfirmadasCache = null;
async function cargarZonasConfirmadas(){
  const { data } = await sb.from('zonas_confirmadas').select('nombre');
  zonasConfirmadasCache = new Set((data||[]).map(z=>normaliza(z.nombre)));
  return zonasConfirmadasCache;
}
// Zonas que están en uso (niñeras o familias) pero todavía no pasaron por la lista blanca --
// ninguna llamada a red, usa lo que ya está cargado en memoria.
function zonasNuevasSinConfirmar(){
  if(!zonasConfirmadasCache) return [];
  return obtenerTodasLasZonas().filter(z=>!zonasConfirmadasCache.has(normaliza(z)));
}
// Reemplaza una zona por otra en TODAS las niñeras y familias que la tengan (dentro de su
// texto separado por "/", sin tocar el resto de las zonas de esa persona). Se usa cuando una
// zona nueva resulta ser la misma de siempre, solo escrita distinto.
async function unificarZona(zonaVieja, zonaNueva){
  const zvNorm = normaliza(zonaVieja);
  const reemplazar = (zonaStr) => zonasDe(zonaStr).map(z=>normaliza(z)===zvNorm ? zonaNueva : z).join('/');
  const afectadasNin = (ninierasItems||[]).filter(n=>zonasDe(n.zona).some(z=>normaliza(z)===zvNorm));
  const afectadasFam = (familiasItems||[]).filter(f=>zonasDe(f.zona).some(z=>normaliza(z)===zvNorm));
  for(const n of afectadasNin){ await sb.from('ninieras').update({zona: reemplazar(n.zona)}).eq('id', n.id); }
  for(const f of afectadasFam){ await sb.from('familias').update({zona: reemplazar(f.zona)}).eq('id', f.id); }
  return afectadasNin.length + afectadasFam.length;
}
async function confirmarZonaComoNueva(nombre){
  return sb.from('zonas_confirmadas').insert({nombre});
}
async function accionUnificarZonaNueva(zonaVieja, selectId){
  const zonaNueva = document.getElementById(selectId).value;
  if(!zonaNueva) return;
  const n = await unificarZona(zonaVieja, zonaNueva);
  await confirmarZonaComoNueva(zonaVieja).catch(()=>{}); // si falla (ya no debería reaparecer igual, quedó unificada), no bloquea
  toast(`Unificada con "${zonaNueva}" en ${n} ficha${n===1?'':'s'}.`);
  if(typeof cargarNinieras==='function' && document.getElementById('ninierasgrid')) await cargarNinieras();
  if(typeof cargarFamilias==='function' && document.getElementById('familiaslist')) await cargarFamilias();
  await cargarZonasConfirmadas();
  renderZonasNuevasPanel();
}
async function accionConfirmarZonaNueva(zonaNueva){
  const { error } = await confirmarZonaComoNueva(zonaNueva);
  if(error){ toast('No se pudo confirmar: '+error.message, 'bad'); return; }
  await cargarZonasConfirmadas();
  toast(`"${zonaNueva}" confirmada como zona nueva.`);
  renderZonasNuevasPanel();
}
// Mini panel reusable -- se engancha en el wrap que exista en la pantalla actual (Niñeras o
// Familias), o no hace nada si no hay ninguno. Solo se ve cuando hay algo para revisar.
function renderZonasNuevasPanel(){
  const wrap = document.getElementById('nin-zonasnuevas-wrap') || document.getElementById('fam-zonasnuevas-wrap');
  if(!wrap) return;
  const nuevas = zonasNuevasSinConfirmar();
  if(!nuevas.length){ wrap.innerHTML = ''; return; }
  const conocidas = [...(zonasConfirmadasCache||[])];
  const opciones = obtenerTodasLasZonas().filter(z=>zonasConfirmadasCache.has(normaliza(z)));
  wrap.innerHTML = `<div class="card" style="padding:12px 18px;border-left:3px solid var(--warn);margin-bottom:10px;">
    <div style="font-weight:600;margin-bottom:6px;">Zonas nuevas sin revisar (${nuevas.length})</div>
    ${nuevas.map(z=>`
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid var(--line);">
        <b style="min-width:120px;">${z}</b>
        <select id="zn-sel-${normaliza(z).replace(/\s+/g,'-')}" style="flex:1;min-width:140px;">
          <option value="">¿Es la misma que...?</option>
          ${opciones.map(o=>`<option value="${o}">${o}</option>`).join('')}
        </select>
        <button class="smallbtn" onclick="accionUnificarZonaNueva('${z.replace(/'/g,"\\'")}','zn-sel-${normaliza(z).replace(/\s+/g,'-')}')">Unificar</button>
        <button class="smallbtn" onclick="accionConfirmarZonaNueva('${z.replace(/'/g,"\\'")}')">Es zona nueva, confirmar</button>
      </div>`).join('')}
  </div>`;
}
// Grupo (objeto completo) al que pertenece una zona, o null si no está agrupada.
function grupoDeZona(zonaStr){
  if(!zonaGruposCache || !zonaStr) return null;
  const zn = normaliza(zonaStr);
  return zonaGruposCache.find(g => (g.zonas||[]).some(z=>normaliza(z)===zn)) || null;
}
// Para matching: ¿estas dos zonas cuentan como la misma zona (exacta, o mismo grupo)?
function mismoGrupoZona(zonaA, zonaB){
  if(!zonaA || !zonaB) return false;
  if(normaliza(zonaA)===normaliza(zonaB)) return true;
  const g = grupoDeZona(zonaA);
  return !!g && (g.zonas||[]).some(z=>normaliza(z)===normaliza(zonaB));
}
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
function abrirModalGruposZona(){
  const grupos = zonaGruposCache || [];
  const fila = (g) => `
    <div class="zonagrupo-row" data-id="${g?.id||''}" style="border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:8px;">
      <div class="field" style="margin-bottom:6px;"><label>Nombre del grupo</label><input type="text" class="zg-nombre" value="${(g?.nombre||'').replace(/"/g,'&quot;')}" placeholder="ej. Carrasco / San Nicolás / Olivos"></div>
      <div class="field" style="margin-bottom:6px;"><label>Zonas (separadas por coma)</label><input type="text" class="zg-zonas" value="${(g?.zonas||[]).join(', ').replace(/"/g,'&quot;')}" placeholder="Carrasco, San Nicolás, Olivos"></div>
      <button type="button" class="smallbtn danger" onclick="this.closest('.zonagrupo-row').remove()">Eliminar grupo</button>
    </div>`;
  const html = `
    <h2>Grupos de zona</h2>
    <div class="helper">Zonas del mismo grupo se tratan como equivalentes para sugerir niñera↔familia en Agenda — la zona real de cada una no cambia, solo el matching.</div>
    <div id="zonagrupos-list" style="margin-top:10px;">${grupos.map(fila).join('') || '<div class="empty">Todavía no hay grupos.</div>'}</div>
    <button type="button" class="smallbtn" onclick="document.getElementById('zonagrupos-list').insertAdjacentHTML('beforeend', \`${fila(null).replace(/`/g,'\\`')}\`)" style="margin-bottom:10px;">+ Agregar grupo</button>
    <div id="zonagrupos-warn"></div>
    <button class="btn primary" style="width:100%;" onclick="guardarGruposZona()">Guardar</button>
  `;
  abrirModal(html);
}
async function guardarGruposZona(){
  const warn = document.getElementById('zonagrupos-warn');
  const filas = [...document.querySelectorAll('.zonagrupo-row')];
  const idsVistos = [];
  for(const fila of filas){
    const nombre = fila.querySelector('.zg-nombre').value.trim();
    const zonas = fila.querySelector('.zg-zonas').value.split(',').map(z=>z.trim()).filter(Boolean);
    if(!nombre || !zonas.length) continue;
    const id = fila.dataset.id;
    if(id){
      const { error } = await sb.from('zona_grupos').update({nombre, zonas}).eq('id', id);
      if(error){ warn.innerHTML = errBox(error); return; }
      idsVistos.push(id);
    } else {
      const { data, error } = await sb.from('zona_grupos').insert({nombre, zonas, orden: (zonaGruposCache||[]).length}).select().single();
      if(error){ warn.innerHTML = errBox(error); return; }
      idsVistos.push(data.id);
    }
  }
  // grupos que estaban antes y ya no aparecen en la lista (se borraron con "Eliminar grupo")
  const idsPrevios = (zonaGruposCache||[]).map(g=>g.id);
  const aBorrar = idsPrevios.filter(id=>!idsVistos.includes(id));
  for(const id of aBorrar){ await sb.from('zona_grupos').delete().eq('id', id); }
  await cargarZonaGrupos();
  cerrarModal();
  toast('Grupos de zona guardados.');
}
function checklistZonas(idPrefix, zonaActual){
  const todas = obtenerTodasLasZonas();
  const actuales = new Set(zonasDe(zonaActual).map(normaliza));
  // Ordenadas por grupo (las agrupadas primero, en su bloque, con el nombre del grupo como
  // encabezado; las que no están en ningún grupo quedan sueltas al final).
  const chk = z => `<label class="chk" style="margin:0;"><input type="checkbox" value="${z}" ${actuales.has(normaliza(z))?'checked':''}> ${z}</label>`;
  let cuerpoChecklist;
  if(!todas.length){
    cuerpoChecklist = '<span class="helper" style="margin:0;">Todavía no hay zonas cargadas.</span>';
  } else if(!zonaGruposCache){
    cuerpoChecklist = todas.map(chk).join(''); // grupos todavía no cargados (ver bootstrap) — se ve sin agrupar, no rompe nada
  } else {
    const usadas = new Set();
    const bloques = [];
    zonaGruposCache.forEach(g=>{
      const zonasDelGrupoPresentes = todas.filter(z => (g.zonas||[]).some(gz=>normaliza(gz)===normaliza(z)));
      if(!zonasDelGrupoPresentes.length) return;
      zonasDelGrupoPresentes.forEach(z=>usadas.add(normaliza(z)));
      bloques.push(`<div style="flex-basis:100%;font-size:10.5px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-top:4px;">${g.nombre}</div>` + zonasDelGrupoPresentes.map(chk).join(''));
    });
    const sueltas = todas.filter(z=>!usadas.has(normaliza(z)));
    if(sueltas.length) bloques.push(`<div style="flex-basis:100%;font-size:10.5px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;margin-top:4px;">${bloques.length?'Sin grupo':''}</div>` + sueltas.map(chk).join(''));
    cuerpoChecklist = bloques.join('');
  }
  return `
    <div class="field"><label>Zonas</label>
      <div id="${idPrefix}-zonas-checklist" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;border:1px solid var(--line);border-radius:8px;max-height:180px;overflow-y:auto;">
        ${cuerpoChecklist}
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <input type="text" id="${idPrefix}-zona-nueva" placeholder="Agregar zona nueva…" style="flex:1;">
        <button type="button" class="smallbtn" onclick="agregarZonaAlChecklist('${idPrefix}')">+ Agregar</button>
      </div>
      <div class="helper" style="margin-top:4px;"><a href="#" onclick="abrirModalGruposZona();return false;">Editar grupos de zona</a> — zonas del mismo grupo se sugieren entre sí en Agenda, aunque el texto no sea idéntico.</div>
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

/* ============================================================
   Lista de cuentas bancarias (columna cuenta_bancaria: text[]).
   UI repetible para poder cargar más de una cuenta por niñera o familia
   (ej. cambió de banco, o cobra/paga por dos cuentas distintas) — antes
   solo se podía guardar una sola.
   Cada cuenta se sigue guardando como UN string ("Itaú 1234567 (Sucursal
   Pocitos)") para no tener que migrar la columna — pero ahora se carga con
   3 campos separados (banco / número / sucursal) en vez de un input libre,
   mismo criterio que quedó armado en el formulario de postulación.
   ============================================================ */
const BANCOS_CUENTA = ['Itaú','BROU','Santander','Scotiabank','BBVA','HSBC','Otro'];
// Separa el string guardado en sus 3 partes, para poder editarlo con los campos separados.
function parsearCuentaBancaria(valor){
  const v = String(valor||'').trim();
  if(!v) return {banco:'', numero:'', sucursal:''};
  const mSuc = v.match(/^(.*?)\s*\(Sucursal\s+(.+)\)\s*$/i);
  const sinSucursal = mSuc ? mSuc[1].trim() : v;
  const sucursal = mSuc ? mSuc[2].trim() : '';
  const bancoConocido = BANCOS_CUENTA.find(b => b!=='Otro' && sinSucursal.toLowerCase().startsWith(b.toLowerCase()+' '));
  if(bancoConocido) return {banco:bancoConocido, numero:sinSucursal.slice(bancoConocido.length).trim(), sucursal};
  // Banco no reconocido en la lista: la última palabra se toma como número, el resto como nombre del banco (va bajo "Otro").
  const partes = sinSucursal.split(/\s+/);
  const numero = partes.length>1 ? partes.pop() : '';
  const banco = partes.join(' ');
  return {banco, numero: numero || sinSucursal, sucursal};
}
function htmlCuentasBancarias(prefix, cuentas){
  const lista = Array.isArray(cuentas) ? cuentas.filter(Boolean) : (cuentas ? [cuentas] : []);
  const filas = lista.length ? lista : [''];
  return `<div class="field">
    <label>Cuenta(s) bancaria(s)</label>
    <div id="${prefix}-cuentas-list">${filas.map(c=>filaCuentaBancaria(c)).join('')}</div>
    <button class="smallbtn" type="button" onclick="agregarFilaCuentaBancaria('${prefix}')" style="margin-top:6px;">+ Agregar otra cuenta</button>
  </div>`;
}
function filaCuentaBancaria(valor=''){
  const {banco, numero, sucursal} = parsearCuentaBancaria(valor);
  const esConocido = BANCOS_CUENTA.includes(banco);
  const bancoSel = esConocido ? banco : (valor ? 'Otro' : '');
  const otroVisible = bancoSel==='Otro';
  const otroValor = (!esConocido && banco) ? banco : '';
  const q = s => String(s||'').replace(/"/g,'&quot;');
  return `<div class="cuentabancaria-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
    <select class="cuentabancaria-banco" onchange="toggleBancoOtro(this)" style="flex:1;min-width:100px;">
      <option value="">Banco…</option>
      ${BANCOS_CUENTA.map(b=>`<option value="${b}" ${bancoSel===b?'selected':''}>${b}</option>`).join('')}
    </select>
    <input type="text" class="cuentabancaria-otro" placeholder="Nombre del banco" value="${q(otroValor)}" style="flex:1;min-width:100px;${otroVisible?'':'display:none;'}">
    <input type="text" class="cuentabancaria-numero" placeholder="Número de cuenta" value="${q(numero)}" style="flex:1;min-width:100px;">
    <input type="text" class="cuentabancaria-sucursal" placeholder="Sucursal (si hace falta)" value="${q(sucursal)}" style="flex:1;min-width:100px;">
    <button class="smallbtn danger" type="button" onclick="this.closest('.cuentabancaria-row').remove()">−</button>
  </div>`;
}
function toggleBancoOtro(sel){
  const otro = sel.closest('.cuentabancaria-row').querySelector('.cuentabancaria-otro');
  otro.style.display = sel.value==='Otro' ? '' : 'none';
}
function agregarFilaCuentaBancaria(prefix){
  document.getElementById(prefix+'-cuentas-list').insertAdjacentHTML('beforeend', filaCuentaBancaria());
}
function leerCuentasBancarias(prefix){
  return [...document.querySelectorAll(`#${prefix}-cuentas-list .cuentabancaria-row`)].map(row=>{
    const sel = row.querySelector('.cuentabancaria-banco').value;
    const banco = sel==='Otro' ? row.querySelector('.cuentabancaria-otro').value.trim() : sel;
    const numero = row.querySelector('.cuentabancaria-numero').value.trim();
    const sucursal = row.querySelector('.cuentabancaria-sucursal').value.trim();
    if(!banco || !numero) return null;
    return `${banco} ${numero}${sucursal ? ' (Sucursal '+sucursal+')' : ''}`;
  }).filter(Boolean);
}
// Para mostrar en una ficha (view-only): une las cuentas con · , o '—' si no hay ninguna.
function textoCuentasBancarias(cuentas){
  const lista = Array.isArray(cuentas) ? cuentas.filter(Boolean) : (cuentas ? [cuentas] : []);
  return lista.length ? lista.join(' · ') : '—';
}

// Calcula la edad a partir de una fecha de nacimiento (YYYY-MM-DD), a una fecha de
// referencia dada (por default hoy). Reemplaza el viejo criterio de guardar "19 años" como
// texto fijo, que quedaba vieja apenas la persona cumplía años.
function calcularEdad(fechaNacISO, fechaRefISO){
  if(!fechaNacISO) return null;
  const nac = new Date(fechaNacISO+'T00:00:00');
  const ref = fechaRefISO ? new Date(fechaRefISO+'T00:00:00') : new Date();
  if(isNaN(nac)) return null;
  let edad = ref.getFullYear() - nac.getFullYear();
  const noLlegoAlCumple = (ref.getMonth() < nac.getMonth()) || (ref.getMonth()===nac.getMonth() && ref.getDate() < nac.getDate());
  if(noLlegoAlCumple) edad--;
  return edad;
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

/* Envoltorio para escrituras de Supabase (insert/update/delete/upsert): si falla, avisa con
   un mensaje consistente y devuelve false para poder cortar el flujo. Antes algunas escrituras
   sueltas no chequeaban error en absoluto (fallaban en silencio, la pantalla seguía como si
   hubiera funcionado) o usaban un alert() feo del navegador en vez del aviso normal de la app.
   Uso: if(!(await sbGuardar(sb.from('solicitudes').update({...}).eq('id', id), 'la solicitud'))) return; */
async function sbGuardar(consulta, queCosa='los cambios'){
  try {
    const { error } = await consulta;
    if(error){
      console.error('[Supabase] al guardar', queCosa, error);
      toast(`No se pudo guardar ${queCosa}: ${error.message}`, 'bad');
      return false;
    }
    return true;
  } catch(e){
    console.error('[Supabase] al guardar', queCosa, e);
    toast(`No se pudo guardar ${queCosa}. Revisá tu conexión.`, 'bad');
    return false;
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
  {key:'edad', label:'Edad (texto viejo, sin fecha exacta)', hints:['edad']},
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

