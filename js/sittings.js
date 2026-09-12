/* ================= SITTINGS & TRASLADOS ================= */
let sitFamilias = [];
let sitNinieras = [];
let sitItems = [];
let sitTipo = 'sitting';
let sitPrefill = null; // {familiaNombre, nineraNombre, fecha, horaInicio, horaFin, notas} — precarga el form de sitting desde Agenda o desde "Pendiente" en Hoy
let sitEditId = null;
let sitFamiliaSel = null;
let sitNineraSel = null;
let sitOrigenAuto = true;
let sitOrigenCoord = null;
let sitDestinoCoord = null;
let sitMes = null;

function currentMonthStr(){ const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function shiftMes(mesStr, delta){ const [y,m] = mesStr.split('-').map(Number); const d = new Date(y, m-1+delta, 1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function primerDiaMesesAtras(n){
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth()-n);
  return d.toISOString().slice(0,10);
}
function monthLabel(mesStr){
  const [y,m] = mesStr.split('-').map(Number);
  const f = new Intl.DateTimeFormat('es-UY', {month:'long', year:'numeric'}).format(new Date(y, m-1, 1));
  return f.charAt(0).toUpperCase() + f.slice(1);
}
function findFamilia(nombre){ const n = normaliza(nombre); return sitFamilias.find(f=>normaliza(f.nombre)===n) || null; }
function findNinera(nombre){ const n = normaliza(nombre); return sitNinieras.find(x=>normaliza(x.nombre)===n) || null; }

async function renderSittings(body){
  sitMes = sitMes || currentMonthStr();
  sitEditId = null; sitFamiliaSel = null; sitNineraSel = null; sitOrigenAuto = true; sitTipo = 'sitting';
  body.innerHTML = `
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <button class="btn primary" style="font-size:16px;padding:14px 40px;" onclick="abrirModalSitForm()">+ Agregar sitting o traslado</button>
    </div>
    <div class="mesbar">
      <div class="mesnav">
        <button onclick="cambiarSitMesRel(-1)" aria-label="Mes anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="mesnav-label" id="sit-mes-label">${monthLabel(sitMes)}</div>
        <button onclick="cambiarSitMesRel(1)" aria-label="Mes siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <button class="smallbtn" onclick="exportarSitCSV()">Exportar CSV</button>
    </div>
    <div class="summary3" id="sit-summary"></div>
    <div class="card" id="sit-list-wrap"></div>
    <div class="card">
      <h2>Historial con filtros</h2>
      <div class="helper">Todos los sittings y traslados registrados, con búsqueda por familia y por período.</div>
      <div class="grid3">
        <div class="field"><label>Familia</label><select id="sithist-familia" onchange="onSitHistFiltroChange()"><option value="">Todas</option></select></div>
        <div class="field"><label>Período</label><select id="sithist-periodo" onchange="onSitHistPeriodoChange()">
          <option value="0">Todo</option><option value="7">Últimos 7 días</option><option value="15">Últimos 15 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="custom">Personalizado…</option>
        </select></div>
        <div class="field"><label>Tipo</label><select id="sithist-tipo" onchange="onSitHistFiltroChange()"><option value="">Todos</option><option value="sitting">Sitting</option><option value="traslado">Traslado</option></select></div>
      </div>
      <div class="grid2" id="sithist-custom-box" style="display:none;margin-top:-4px;margin-bottom:14px;">
        <div class="field"><label>Desde</label><input type="date" id="sithist-desde" onchange="renderSitHistorialCustom()"></div>
        <div class="field"><label>Hasta</label><input type="date" id="sithist-hasta" onchange="renderSitHistorialCustom()"></div>
      </div>
      <div id="sithist-lista"></div>
    </div>
    <div id="incidentes-wrap"></div>
  `;
  await cargarSitBase();
  cargarSitLista();
  cargarSitHistorial();
  cargarIncidentes();
}
let sitHistItems = [];
let sitHistOffset = 0;
let sitHistTotal = 0;
let sitHistLoadingMore = false;
let sitHistMostrar = 10; // cuántas filas se ven de una — separado de cuántas se traen del servidor
const SIT_HIST_PAGE = 200;
async function cargarSitHistorial(){
  const [{data:pagina, count}, {data:resenas}, {data:soloFamilias}] = await Promise.all([
    sb.from('sittings_traslados').select('*', {count:'exact'}).order('fecha', {ascending:false}).range(0, SIT_HIST_PAGE-1),
    sb.from('resenas_ninieras').select('ninera_nombre,puntuacion'),
    sb.from('sittings_traslados').select('familia_nombre'), // solo esta columna: liviano aunque la tabla crezca, así el filtro de familia siempre tiene todas las opciones
  ]);
  sitHistItems = pagina || [];
  sitHistOffset = sitHistItems.length;
  sitHistTotal = count!=null ? count : sitHistItems.length;
  sitHistResenas = {};
  (resenas||[]).forEach(r=>{
    if(r.puntuacion==null) return;
    const k = normaliza(r.ninera_nombre||'');
    if(!k) return;
    if(!sitHistResenas[k]) sitHistResenas[k] = {suma:0, cant:0};
    sitHistResenas[k].suma += Number(r.puntuacion);
    sitHistResenas[k].cant += 1;
  });
  llenarSelectFamiliasHistorial(soloFamilias||[]);
  renderSitHistorial();
}
function llenarSelectFamiliasHistorial(filas){
  // llenar desplegable de familias agrupando variantes de mayúsculas/tildes/espacios como la misma familia
  const sel = document.getElementById('sithist-familia');
  if(!sel) return;
  const valorPrevio = sel.value;
  const famMap = new Map();
  filas.forEach(s=>{
    const raw = (s.familia_nombre||'').trim();
    if(!raw) return;
    const key = normaliza(raw);
    if(!famMap.has(key)) famMap.set(key, raw);
  });
  const fams = [...famMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  sel.innerHTML = `<option value="">Todas</option>` + fams.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  if(valorPrevio) sel.value = valorPrevio;
}
async function cargarSitHistorialMas(){
  if(sitHistLoadingMore || sitHistItems.length>=sitHistTotal) return;
  sitHistLoadingMore = true;
  renderSitHistorial();
  const { data } = await sb.from('sittings_traslados').select('*').order('fecha', {ascending:false}).range(sitHistOffset, sitHistOffset+SIT_HIST_PAGE-1);
  sitHistItems = sitHistItems.concat(data||[]);
  sitHistOffset = sitHistItems.length;
  sitHistLoadingMore = false;
  renderSitHistorial();
}
function resenaBadge(nineraNombre){
  const res = sitHistResenas[normaliza(nineraNombre||'')];
  if(!res) return '<span style="color:var(--ink-soft);">—</span>';
  const prom = (res.suma/res.cant).toFixed(1);
  const color = Number(prom)>=4 ? 'var(--good)' : Number(prom)>=3 ? '#7A5A16' : 'var(--clay-text)';
  return `<span style="font-weight:600;color:${color};">★ ${prom} (${res.cant})</span>`;
}
function onSitHistPeriodoChange(){
  sitHistMostrar = 10;
  const val = document.getElementById('sithist-periodo')?.value;
  const box = document.getElementById('sithist-custom-box');
  if(box) box.style.display = (val==='custom') ? 'flex' : 'none';
  if(val==='custom') renderSitHistorialCustom();
  else renderSitHistorial();
}
function onSitHistFiltroChange(){
  sitHistMostrar = 10;
  const val = document.getElementById('sithist-periodo')?.value;
  if(val==='custom') renderSitHistorialCustom();
  else renderSitHistorial();
}
/* Rango de fechas libre (ej. setiembre a noviembre 2025): consulta directa a la base,
   no depende de los 200 registros más recientes que se cachean para el resto de los filtros
   — así funciona bien incluso muy atrás en el histórico. */
async function renderSitHistorialCustom(){
  const cont = document.getElementById('sithist-lista');
  if(!cont) return;
  const desde = document.getElementById('sithist-desde')?.value;
  const hasta = document.getElementById('sithist-hasta')?.value;
  if(!desde || !hasta){ cont.innerHTML = '<div class="empty">Elegí las dos fechas del rango.</div>'; return; }
  if(hasta < desde){ cont.innerHTML = '<div class="empty">La fecha "hasta" tiene que ser posterior a la de "desde".</div>'; return; }
  const famF = document.getElementById('sithist-familia')?.value||'';
  const tipoF = document.getElementById('sithist-tipo')?.value||'';
  cont.innerHTML = '<div class="empty"><span class="spinner dark"></span> Buscando…</div>';
  const data = await sbLeer(
    sb.from('sittings_traslados').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', {ascending:false}),
    'los registros de ese período', []
  );
  let items = data || [];
  if(famF) items = items.filter(s=>normaliza(s.familia_nombre)===famF);
  if(tipoF) items = items.filter(s=>s.tipo===tipoF);
  if(!items.length){ cont.innerHTML = '<div class="empty">No hay registros en ese rango de fechas.</div>'; return; }
  const totalCobro = items.reduce((s,r)=>s+(Number(r.cobro_familia)||0),0);
  const totalPago = items.reduce((s,r)=>s+(Number(r.pago_ninera)||0),0);
  cont.innerHTML = `
    <div class="helper" style="margin:8px 0;">${items.length} registro(s) · cobrado $${totalCobro.toLocaleString('es-UY')} · pagado $${totalPago.toLocaleString('es-UY')}</div>
    <div class="tablewrap"><table class="asigtable"><thead><tr><th>Fecha</th><th>Niñera</th><th>Familia</th><th>Cobro</th><th>Pago</th><th>Reseña niñera</th></tr></thead>
    <tbody>${items.map(r=>{
      const fechaFmt = r.fecha ? new Date(r.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) : '—';
      return `<tr><td>${fechaFmt}</td><td>${r.ninera_nombre}</td><td>${r.familia_nombre}</td><td>$${r.cobro_familia||0}</td><td>$${r.pago_ninera||0}</td><td>${resenaBadge(r.ninera_nombre)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function renderSitHistorial(){
  const cont = document.getElementById('sithist-lista');
  if(!cont) return;
  const famF = document.getElementById('sithist-familia')?.value||'';
  const periodo = parseInt(document.getElementById('sithist-periodo')?.value||'0');
  const tipoF = document.getElementById('sithist-tipo')?.value||'';
  let items = sitHistItems.slice();
  if(famF) items = items.filter(s=>normaliza(s.familia_nombre)===famF);
  if(tipoF) items = items.filter(s=>s.tipo===tipoF);
  if(periodo>0){
    const limite = new Date(); limite.setDate(limite.getDate()-periodo);
    const limiteISO = limite.toISOString().slice(0,10);
    items = items.filter(s=>s.fecha && s.fecha >= limiteISO);
  }
  const hayMasSinCargar = periodo===0 && sitHistItems.length < sitHistTotal;
  const cargadosLabel = hayMasSinCargar ? ` (${sitHistItems.length} de ${sitHistTotal} cargados)` : '';
  // En "Todo" (el período por defecto) no mostramos todo lo que ya está cargado de una —
  // se revela de a 10 con "Mostrar más". En un período específico (7/15/30/90 días o un
  // rango elegido a mano) ya es un recorte acotado a propósito, así que se muestra entero.
  const mostrarTope = periodo===0 ? Math.min(sitHistMostrar, items.length) : items.length;
  const itemsMostrados = items.slice(0, mostrarTope);
  const hayMasLocal = periodo===0 && mostrarTope < items.length;
  const botonMostrarMas = hayMasLocal ? `<button class="smallbtn" onclick="sitHistMostrar+=10;renderSitHistorial();" style="margin-top:10px;">Mostrar más</button>` : '';
  const botonMas = (!hayMasLocal && hayMasSinCargar) ? `<button class="smallbtn" id="sithist-mas-btn" onclick="cargarSitHistorialMas()" ${sitHistLoadingMore?'disabled':''} style="margin-top:10px;">${sitHistLoadingMore?'Cargando…':'Cargar registros más antiguos'}</button>` : '';
  if(!items.length){
    cont.innerHTML = `<div class="empty">No hay registros que coincidan con estos filtros${hayMasSinCargar?' entre los ya cargados — probá "Cargar registros más antiguos"':''}.</div>${botonMas}`;
    return;
  }
  const totalCobro = items.reduce((s,r)=>s+(Number(r.cobro_familia)||0),0);
  const totalPago = items.reduce((s,r)=>s+(Number(r.pago_ninera)||0),0);
  cont.innerHTML = `
    <div class="helper" style="margin:8px 0;">${itemsMostrados.length} de ${items.length} registro(s)${cargadosLabel} · cobrado $${totalCobro.toLocaleString('es-UY')} · pagado $${totalPago.toLocaleString('es-UY')}</div>
    <div class="tablewrap"><table class="asigtable"><thead><tr><th>Fecha</th><th>Niñera</th><th>Familia</th><th>Cobro</th><th>Pago</th><th>Reseña niñera</th></tr></thead>
    <tbody>${itemsMostrados.map(r=>{
      const fechaFmt = r.fecha ? new Date(r.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'}) : '—';
      return `<tr><td>${fechaFmt}</td><td>${r.ninera_nombre}</td><td>${r.familia_nombre}</td><td>$${r.cobro_familia||0}</td><td>$${r.pago_ninera||0}</td><td>${resenaBadge(r.ninera_nombre)}</td></tr>`;
    }).join('')}</tbody></table></div>
    ${botonMostrarMas}${botonMas}`;
}
async function cargarSitBase(){
  const [{data:fams}, {data:nins}] = await Promise.all([
    sb.from('familias').select('id,nombre,direccion,cobro_hora,pago_hora').order('nombre'),
    sb.from('ninieras').select('id,nombre').eq('activa', true).order('nombre'),
  ]);
  sitFamilias = fams || [];
  sitNinieras = nins || [];
  await cargarTarifaTrasladoConfig();
}

function registradoPorUsuario(){
  const email = session?.user?.email || '';
  if(email==='pauugericke@gmail.com') return 'Paulina G';
  if(email==='delfifrommel@gmail.com') return 'Delfina F';
  return 'Paulina G';
}
function sitFormHTML(){
  return `
    <h2>${sitEditId ? 'Editar registro' : 'Nuevo registro'}</h2>
    <div class="tiporow">
      <button type="button" class="tipobtn ${sitTipo==='sitting'?'selected':''}" id="sit-tipo-sitting" onclick="setSitTipo('sitting')">Sitting</button>
      <button type="button" class="tipobtn ${sitTipo==='traslado'?'selected':''}" id="sit-tipo-traslado" onclick="setSitTipo('traslado')">Traslado</button>
    </div>
    <div class="grid3">
      <div class="field"><label>Registró</label><select id="sit-registro">
        <option ${!sitEditId && registradoPorUsuario()==='Paulina G'?'selected':''}>Paulina G</option>
        <option ${!sitEditId && registradoPorUsuario()==='Delfina F'?'selected':''}>Delfina F</option>
      </select></div>
      <div class="field" style="position:relative;">
        <label>Familia</label>
        <input type="text" id="sit-familia" autocomplete="off">
        <div id="sit-familia-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
        <div class="createhint" id="sit-familia-create"></div>
      </div>
      <div class="field" style="position:relative;">
        <label>Niñera</label>
        <input type="text" id="sit-ninera" autocomplete="off">
        <div id="sit-ninera-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
        <div class="createhint" id="sit-ninera-create"></div>
      </div>
    </div>
    <div id="sit-camposTipo"></div>
    <div class="field" style="margin-top:4px;">
      <label style="display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer;">
        <input type="checkbox" id="sit-esfijo" onchange="toggleSitEsFijo()" style="width:auto;">
        ¿Es un trabajo fijo? (se repite todas las semanas)
      </label>
    </div>
    <div id="sit-fijo-box" style="display:none;margin-bottom:12px;">
      <div class="helper" style="margin:0 0 6px;">Además de guardar este registro de hoy, se crea la asignación fija para que Agenda la genere sola los próximos días.</div>
      <div class="dayrow" id="sit-fijo-dias">
        ${['L','M','X','J','V','S','D'].map(d=>`<button type="button" class="daybtn" data-dia="${d}" onclick="this.classList.toggle('selected')">${DIAS_CORTO[d]}</button>`).join('')}
      </div>
    </div>
    <div class="grid2">
      <div class="field"><label>Cobro a familia</label><input type="number" id="sit-cobro" value="0" oninput="calcSitMargen();marcarCampoEditadoManual('sit-cobro')"></div>
      <div class="field"><label>Pago a niñera</label><input type="number" id="sit-pago" value="0" oninput="calcSitMargen();marcarCampoEditadoManual('sit-pago')"></div>
    </div>
    <div id="sit-sin-tarifa-box"></div>
    <div class="field" style="margin-top:12px;"><label>Notas</label><textarea id="sit-notas"></textarea></div>
    <div class="actions">
      <button class="btn primary" onclick="guardarSitting()">${sitEditId ? 'Guardar cambios' : 'Guardar registro'}</button>
      <div style="margin-left:auto;align-self:center;font-size:13px;color:var(--ink-soft);">Margen: <b id="sit-margen" style="color:var(--good);font-family:'IBM Plex Mono',monospace;">$0</b></div>
    </div>
  `;
}
function sitCamposTipoHTML(){
  if(sitTipo==='sitting'){
    return `<div class="grid3">
      <div class="field"><label>Fecha</label><input type="date" id="sit-fecha" value="${todayISO()}"></div>
      <div class="field"><label>Hora inicio</label>${selectHora('sit-horaini')}</div>
      <div class="field" id="sit-horafin-wrap"><label>Hora fin</label>${selectHora('sit-horafin')}</div>
    </div>
    <label class="chk" style="margin:-4px 0 10px;"><input type="checkbox" id="sit-cruza-medianoche" onchange="actualizarCobroPagoPorHorario()"> Termina al día siguiente</label>`;
  }
  return `<div class="grid3">
      <div class="field"><label>Fecha</label><input type="date" id="sit-fecha" value="${todayISO()}"></div>
      <div class="field"><label>Hora</label>${selectHora('sit-hora')}</div>
      <div class="field"><label>Km recorridos</label><input type="number" step="0.1" id="sit-km" oninput="actualizarPrecioSugeridoTraslado()"></div>
    </div>
    <div class="grid2" style="margin-top:6px;">
      <div class="field" style="position:relative;">
        <label>Origen</label>
        <input type="text" id="sit-origen" autocomplete="off">
        <div id="sit-origen-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="field" style="position:relative;">
        <label>Destino</label>
        <input type="text" id="sit-destino" autocomplete="off">
        <div id="sit-destino-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
    </div>
    <div class="addrhint" id="sit-addr-hint" style="display:none;"></div>
    <div class="helper" id="sit-km-links" style="margin:6px 0 4px;">Elegí origen y destino de la lista para que el km se calcule solo. <a href="#" onclick="calcularRutaAutomatica();return false;">Recalcular</a> · <a href="#" onclick="verRutaMaps();return false;">ver en Google Maps</a></div>
    <div class="helper" id="sit-km-estado" style="margin:0 0 14px;min-height:15px;"></div>
    <div class="preciosugerido" id="sit-precio-sugerido-box" style="margin-bottom:16px;"></div>`;
}
function wireSitAutocompletes(){
  attachAutocomplete('sit-familia', 'sit-familia-dropdown', ()=>sitFamilias, ()=>onSitFamiliaInput());
  attachAutocomplete('sit-ninera', 'sit-ninera-dropdown', ()=>sitNinieras, ()=>onSitNineraInput());
  if(sitTipo==='traslado'){
    attachAddressAutocomplete('sit-origen', 'sit-origen-dropdown', (pos)=>{ sitOrigenAuto=false; sitOrigenCoord = pos; if(sitDestinoCoord) autoCalcularKmDesdeCoords(); });
    attachAddressAutocomplete('sit-destino', 'sit-destino-dropdown', (pos)=>{ sitDestinoCoord = pos; if(sitOrigenCoord) autoCalcularKmDesdeCoords(); });
  }
}
function abrirModalSitForm(id=null){
  sitEditId = id;
  const r = id ? sitItems.find(x=>x.id===id) : null;
  sitTipo = r ? r.tipo : 'sitting';
  sitFamiliaSel = r ? (sitFamilias.find(f=>f.id===r.familia_id) || findFamilia(r.familia_nombre)) : null;
  sitNineraSel = r ? (sitNinieras.find(n=>n.id===r.ninera_id) || findNinera(r.ninera_nombre)) : null;
  sitOrigenAuto = !r;
  sitOrigenCoord = null; sitDestinoCoord = null;
  abrirModal(sitFormHTML());
  setTimeout(()=>{
    const campos = document.getElementById('sit-camposTipo');
    if(campos) campos.innerHTML = sitCamposTipoHTML();
    wireSitAutocompletes();
    if(r){
      document.getElementById('sit-familia').value = r.familia_nombre || '';
      document.getElementById('sit-ninera').value = r.ninera_nombre || '';
      document.getElementById('sit-registro').value = r.registrado_por || 'Paulina G';
      document.getElementById('sit-fecha').value = r.fecha || '';
      document.getElementById('sit-cobro').value = r.cobro_familia || 0;
      document.getElementById('sit-pago').value = r.pago_ninera || 0;
      // Ya tienen un precio real guardado -- que no se los pise una sugerencia nueva si se
      // toca el horario o los km durante la edición (ver actualizarPrecioSugeridoTraslado).
      document.getElementById('sit-cobro').dataset.tocadoManual = '1';
      document.getElementById('sit-pago').dataset.tocadoManual = '1';
      document.getElementById('sit-notas').value = r.notas || '';
      if(r.tipo==='sitting'){
        setHoraSelect('sit-horaini', r.hora_inicio);
        setHoraSelect('sit-horafin', r.hora_fin);
        const chk = document.getElementById('sit-cruza-medianoche');
        if(chk) chk.checked = !!r.termina_dia_siguiente;
      } else {
        setHoraSelect('sit-hora', r.hora_inicio);
        document.getElementById('sit-km').value = r.km || '';
        document.getElementById('sit-origen').value = r.origen || '';
        document.getElementById('sit-destino').value = r.destino || '';
        actualizarPrecioSugeridoTraslado();
      }
    } else if(sitPrefill){
      document.getElementById('sit-familia').value = sitPrefill.familiaNombre || '';
      sitFamiliaSel = findFamilia(sitPrefill.familiaNombre||'');
      document.getElementById('sit-fecha').value = sitPrefill.fecha || todayISO();
      if(sitPrefill.nineraNombre){
        document.getElementById('sit-ninera').value = sitPrefill.nineraNombre;
        sitNineraSel = findNinera(sitPrefill.nineraNombre);
      }
      if(sitPrefill.horaInicio) setHoraSelect('sit-horaini', sitPrefill.horaInicio);
      if(sitPrefill.horaFin) setHoraSelect('sit-horafin', sitPrefill.horaFin);
      if(sitPrefill.notas) document.getElementById('sit-notas').value = sitPrefill.notas;
      onSitFamiliaInput(); // ya calcula cobro/pago solo si la familia tiene tarifa y el horario está cargado
      sitPrefill = null;
    }
    calcSitMargen();
  }, 20);
}
function setSitTipo(t){
  sitTipo = t;
  const bS = document.getElementById('sit-tipo-sitting'), bT = document.getElementById('sit-tipo-traslado');
  if(bS) bS.classList.toggle('selected', t==='sitting');
  if(bT) bT.classList.toggle('selected', t==='traslado');
  sitOrigenAuto = true;
  sitOrigenCoord = null; sitDestinoCoord = null;
  document.getElementById('sit-camposTipo').innerHTML = sitCamposTipoHTML();
  wireSitAutocompletes();
  if(t==='traslado') aplicarDireccionSugerida();
  actualizarPrecioSugeridoTraslado();
  calcSitMargen();
}

/* ---- crear familia/niñera al vuelo ---- */
function onSitFamiliaInput(){
  const val = document.getElementById('sit-familia').value.trim();
  sitFamiliaSel = findFamilia(val);
  const box = document.getElementById('sit-familia-create');
  box.innerHTML = (val && !sitFamiliaSel) ? `<button type="button" class="createbtn" onclick="crearFamiliaRapida()">+ Crear familia "${val}"</button>` : '';
  sitOrigenAuto = true;
  if(sitTipo==='traslado') aplicarDireccionSugerida();
  actualizarCobroPagoPorHorario();
}
function onSitNineraInput(){
  const val = document.getElementById('sit-ninera').value.trim();
  sitNineraSel = findNinera(val);
  const box = document.getElementById('sit-ninera-create');
  box.innerHTML = (val && !sitNineraSel) ? `<button type="button" class="createbtn" onclick="crearNineraRapida()">+ Crear niñera "${val}"</button>` : '';
}
async function crearFamiliaRapida(){
  const val = document.getElementById('sit-familia').value.trim();
  if(!val) return;
  const { data, error } = await sb.from('familias').insert({nombre:val}).select().single();
  if(error){ toast('No se pudo crear la familia: '+error.message, 'bad'); return; }
  sitFamilias.push(data);
  sitFamiliaSel = data;
  document.getElementById('sit-familia-create').innerHTML = '<div style="font-size:11.5px;color:var(--good);font-weight:600;">Familia creada.</div>';
  toast('Familia creada — le podés agregar zona, teléfono y dirección después desde Familias.');
}
async function crearNineraRapida(){
  const val = document.getElementById('sit-ninera').value.trim();
  if(!val) return;
  const { data, error } = await sb.from('ninieras').insert({nombre:val, activa:true}).select().single();
  if(error){ toast('No se pudo crear la niñera: '+error.message, 'bad'); return; }
  sitNinieras.push(data);
  sitNineraSel = data;
  document.getElementById('sit-ninera-create').innerHTML = '<div style="font-size:11.5px;color:var(--good);font-weight:600;">Niñera creada.</div>';
  toast('Niñera creada — le podés agregar zona y teléfono después desde Niñeras.');
}

/* ---- dirección sugerida para traslados ---- */
function aplicarDireccionSugerida(){
  const hint = document.getElementById('sit-addr-hint');
  const origenInput = document.getElementById('sit-origen');
  if(!hint || !origenInput) return;
  if(sitFamiliaSel && sitFamiliaSel.direccion && sitOrigenAuto){
    origenInput.value = sitFamiliaSel.direccion;
    hint.textContent = `Dirección sugerida desde la ficha de ${sitFamiliaSel.nombre} — la podés editar si el traslado arranca en otro lado.`;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
}
function verRutaMaps(){
  const o = (document.getElementById('sit-origen')||{}).value?.trim();
  const d = (document.getElementById('sit-destino')||{}).value?.trim();
  if(!o || !d){ toast('Cargá origen y destino primero.', 'bad'); return; }
  window.open('https://www.google.com/maps/dir/'+encodeURIComponent(o)+'/'+encodeURIComponent(d), '_blank');
}

/* ---- km automático (TomTom) y precio sugerido de traslado ---- */
// Clave restringida al dominio diegomarin28.github.io desde el panel de TomTom — segura para vivir en el código público.
const TOMTOM_KEY = 'upPsudbTEF2vqk2AgE7VftlFkI1c7PHt';
let tarifaTrasladoConfig = null;
async function cargarTarifaTrasladoConfig(){
  const { data } = await sb.from('tarifas_traslado_config').select('*').limit(1).maybeSingle();
  tarifaTrasladoConfig = data || null;
}
async function geocodeTomTom(direccion){
  if(!direccion) return null;
  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(direccion)}.json?key=${TOMTOM_KEY}&countrySet=UY&limit=1&geobias=point:-34.9011,-56.1645`;
  const res = await fetch(url);
  if(res.ok){
    const data = await res.json();
    const r = data.results && data.results[0];
    if(r) return { lat:r.position.lat, lon:r.position.lon };
  }
  // TomTom no la encontró — probamos OpenStreetMap antes de rendirnos.
  try{
    const urlOsm = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(direccion+', Uruguay')}&format=json&countrycodes=uy&limit=1`;
    const resOsm = await fetch(urlOsm);
    if(!resOsm.ok) return null;
    const dataOsm = await resOsm.json();
    const r0 = dataOsm[0];
    if(!r0) return null;
    return { lat:Number(r0.lat), lon:Number(r0.lon) };
  }catch(e){ return null; }
}
async function rutaKmTomTom(o, d){
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${o.lat},${o.lon}:${d.lat},${d.lon}/json?key=${TOMTOM_KEY}`;
  const res = await fetch(url);
  if(!res.ok) return null;
  const data = await res.json();
  const metros = data.routes && data.routes[0] && data.routes[0].summary && data.routes[0].summary.lengthInMeters;
  if(metros==null) return null;
  return Math.round((metros/1000)*10)/10;
}

/* ---- autocomplete propio reusable (familia, niñera) ---- */
/* ============================================================
   D3 · Bitácora de incidentes — accidentes, quejas de familias, u
   otros hechos puntuales. Se puede cargar desde un sitting puntual
   (con niñera/familia/fecha ya cargados), desde la ficha de una
   niñera, o suelto con el botón "+ Registrar incidente" de acá — las
   tres puertas abren el mismo formulario.
   ============================================================ */
let incidentesItems = [];
let incAbierto = false;
let incMostrar = 10;
let incNineraSel = null, incFamiliaSel = null;
function abrirModalIncidente(prefill){
  prefill = prefill || {};
  incNineraSel = prefill.ninera_id ? {id: prefill.ninera_id, nombre: prefill.ninera_nombre} : null;
  incFamiliaSel = prefill.familia_id ? {id: prefill.familia_id, nombre: prefill.familia_nombre} : null;
  const html = `
    <h2>Registrar incidente</h2>
    <div class="grid2">
      <div class="field"><label>Fecha</label><input type="date" id="inc-fecha" value="${prefill.fecha||todayISO()}"></div>
      <div class="field"><label>Tipo</label><select id="inc-tipo">
        <option value="accidente">Accidente</option>
        <option value="queja">Queja de familia</option>
        <option value="otro" selected>Otro</option>
      </select></div>
    </div>
    <div class="field"><label>Gravedad</label><select id="inc-gravedad">
      <option value="leve" selected>Leve</option>
      <option value="moderado">Moderado</option>
      <option value="grave">Grave</option>
    </select></div>
    <div class="grid2">
      <div class="field" style="position:relative;"><label>Niñera (opcional)</label>
        <input type="text" id="inc-ninera" autocomplete="off" value="${prefill.ninera_nombre||''}">
        <div id="inc-ninera-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="field" style="position:relative;"><label>Familia (opcional)</label>
        <input type="text" id="inc-familia" autocomplete="off" value="${prefill.familia_nombre||''}">
        <div id="inc-familia-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
    </div>
    <div class="field"><label>Descripción</label><textarea id="inc-descripcion" rows="4" placeholder="Qué pasó, cuándo se enteraron, cómo se resolvió…"></textarea></div>
    <div id="inc-warn"></div>
    <button class="btn primary" style="width:100%;" onclick="guardarIncidente('${prefill.sitting_id||''}')">Guardar incidente</button>
  `;
  abrirModal(html);
  setTimeout(()=>{
    attachAutocomplete('inc-ninera', 'inc-ninera-dropdown', ()=>sitNinieras, (o)=>{ incNineraSel = o; });
    attachAutocomplete('inc-familia', 'inc-familia-dropdown', ()=>sitFamilias, (o)=>{ incFamiliaSel = o; });
  }, 20);
}
async function guardarIncidente(sittingId){
  const fecha = document.getElementById('inc-fecha').value;
  const tipo = document.getElementById('inc-tipo').value;
  const gravedad = document.getElementById('inc-gravedad').value;
  const nineraTxt = document.getElementById('inc-ninera').value.trim();
  const familiaTxt = document.getElementById('inc-familia').value.trim();
  const descripcion = document.getElementById('inc-descripcion').value.trim();
  const warn = document.getElementById('inc-warn');
  if(!fecha || !descripcion){ warn.innerHTML = '<div class="warnbox">Completá al menos la fecha y la descripción.</div>'; return; }
  const { error } = await sb.from('incidentes').insert({
    fecha, tipo, gravedad,
    ninera_id: (incNineraSel && normaliza(incNineraSel.nombre)===normaliza(nineraTxt)) ? incNineraSel.id : null,
    ninera_nombre: nineraTxt || null,
    familia_id: (incFamiliaSel && normaliza(incFamiliaSel.nombre)===normaliza(familiaTxt)) ? incFamiliaSel.id : null,
    familia_nombre: familiaTxt || null,
    sitting_id: sittingId || null,
    descripcion,
    registrado_por: registradoPorUsuario(),
  });
  if(error){ warn.innerHTML = errBox(error); return; }
  cerrarModal();
  toast('Incidente registrado.');
  cargarIncidentes();
}
async function cargarIncidentes(){
  const { data, error } = await sb.from('incidentes').select('*').order('fecha', {ascending:false}).order('created_at', {ascending:false});
  if(error || !document.getElementById('incidentes-wrap')) return;
  incidentesItems = data || [];
  renderIncidentes();
}
function toggleIncidentes(){ incAbierto = !incAbierto; renderIncidentes(); }
function renderIncidentes(){
  const wrap = document.getElementById('incidentes-wrap');
  if(!wrap) return;
  wrap.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="cursor:pointer;flex:1;" onclick="toggleIncidentes()">
          <h2 style="margin:0;">Incidentes</h2>
          <div class="helper" style="margin:2px 0 0;">${incidentesItems.length} registrado${incidentesItems.length===1?'':'s'} · ${incAbierto?'tocá para cerrar':'tocá para ver'}</div>
        </div>
        <button class="smallbtn" onclick="abrirModalIncidente({})">+ Registrar incidente</button>
      </div>
      ${incAbierto ? renderIncidentesLista() : ''}
    </div>`;
}
function renderIncidentesLista(){
  if(!incidentesItems.length) return '<div class="empty" style="margin-top:12px;">No hay incidentes registrados.</div>';
  const mostrarTope = Math.min(incMostrar, incidentesItems.length);
  const items = incidentesItems.slice(0, mostrarTope);
  const hayMas = mostrarTope < incidentesItems.length;
  const gravedadClase = g => g==='grave' ? 'bad' : g==='moderado' ? 'warn' : 'good';
  return `
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:2px;">
      ${items.map(i=>{
        const fechaFmt = new Date(i.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'});
        const quienes = [i.ninera_nombre, i.familia_nombre].filter(Boolean).join(' · ');
        return `
        <div class="agendarow" style="border-bottom:1px solid var(--line);align-items:flex-start;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;">${fechaFmt}${quienes?' — '+quienes:''}</div>
            <div class="helper" style="margin:2px 0 4px;">${i.descripcion}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
            <span class="badge ${i.tipo==='accidente'?'bad':i.tipo==='queja'?'warn':'brand'}" style="font-size:10.5px;">${i.tipo==='accidente'?'Accidente':i.tipo==='queja'?'Queja':'Otro'}</span>
            <span class="badge ${gravedadClase(i.gravedad)}" style="font-size:10.5px;">${i.gravedad}</span>
            <button class="smallbtn danger" onclick="eliminarIncidente('${i.id}')">Eliminar</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${hayMas ? `<button class="smallbtn" style="margin-top:10px;" onclick="incMostrar+=10;renderIncidentes();">Mostrar más</button>` : ''}
  `;
}
async function eliminarIncidente(id){
  const ok = await confirmarAccion('¿Eliminar este incidente? No se puede deshacer.');
  if(!ok) return;
  const { error } = await sb.from('incidentes').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  toast('Incidente eliminado.');
  cargarIncidentes();
}
/* Mini-listado embebido en la ficha de una niñera o una familia — independiente
   del panel general de arriba. Busca por id Y por nombre normalizado, para que
   también aparezcan los incidentes cargados antes de que existiera el vínculo
   por id (o si se escribió el nombre a mano sin elegir de la lista). */
async function renderIncidentesEnFicha(containerId, tipo, id, nombre){
  const cont = document.getElementById(containerId);
  if(!cont) return;
  const { data } = await sb.from('incidentes').select('*').order('fecha', {ascending:false});
  const key = normaliza(nombre||'');
  const propios = (data||[]).filter(i=>{
    if(tipo==='ninera') return (id && i.ninera_id===id) || (key && normaliza(i.ninera_nombre||'')===key);
    return (id && i.familia_id===id) || (key && normaliza(i.familia_nombre||'')===key);
  });
  if(!document.getElementById(containerId)) return; // se pudo haber cerrado el modal mientras esperábamos
  if(!propios.length){
    cont.innerHTML = `<div class="helper" style="margin:6px 0;">Incidentes: ninguno registrado.</div>`;
    return;
  }
  cont.innerHTML = `
    <h2 class="card-section-title" style="margin-top:0;">Incidentes (${propios.length})</h2>
    ${propios.map(i=>{
      const fechaFmt = new Date(i.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'});
      const otro = tipo==='ninera' ? i.familia_nombre : i.ninera_nombre;
      return `
      <div class="agendarow" style="border-bottom:1px solid var(--line);align-items:flex-start;flex-wrap:wrap;">
        <div style="flex:1;min-width:180px;">
          <div style="font-weight:700;">${fechaFmt}${otro?' — '+otro:''}</div>
          <div class="helper" style="margin:2px 0 4px;">${i.descripcion}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <span class="badge ${i.tipo==='accidente'?'bad':i.tipo==='queja'?'warn':'brand'}" style="font-size:10px;">${i.tipo==='accidente'?'Accidente':i.tipo==='queja'?'Queja':'Otro'}</span>
          <span class="badge ${i.gravedad==='grave'?'bad':i.gravedad==='moderado'?'warn':'good'}" style="font-size:10px;">${i.gravedad}</span>
          <button class="smallbtn danger" onclick='eliminarIncidenteFicha("${i.id}","${containerId}","${tipo}","${id||''}",${JSON.stringify(nombre||'').replace(/'/g,"&#39;")})'>Eliminar</button>
        </div>
      </div>`;
    }).join('')}
  `;
}
async function eliminarIncidenteFicha(incId, containerId, tipo, id, nombre){
  const ok = await confirmarAccion('¿Eliminar este incidente? No se puede deshacer.');
  if(!ok) return;
  const { error } = await sb.from('incidentes').delete().eq('id', incId);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  toast('Incidente eliminado.');
  renderIncidentesEnFicha(containerId, tipo, id||null, nombre);
  cargarIncidentes(); // por si el panel general de Sittings también está montado detrás del modal
}
function attachAutocomplete(inputId, dropdownId, getOpciones, onPick){
  const input = document.getElementById(inputId);
  const dd = document.getElementById(dropdownId);
  if(!input || !dd) return;
  function render(){
    const q = normaliza(input.value.trim());
    const opciones = getOpciones() || [];
    const matches = opciones.filter(o=>!q || normaliza(o.nombre).includes(q)).slice(0,8);
    dd.innerHTML = '';
    if(!matches.length){
      dd.innerHTML = q ? '<div class="autocomplete-empty">Sin coincidencias — se puede cargar como nueva.</div>' : '';
      dd.style.display = q ? 'block' : 'none';
      return;
    }
    matches.forEach(o=>{
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = o.nombre;
      item.addEventListener('mousedown', ()=>{ input.value = o.nombre; dd.style.display = 'none'; onPick(o); });
      dd.appendChild(item);
    });
    dd.style.display = 'block';
  }
  input.addEventListener('input', ()=>{ render(); onPick(null); });
  input.addEventListener('focus', render);
  input.addEventListener('blur', ()=> setTimeout(()=>{ dd.style.display = 'none'; }, 150));
}

/* ---- autocomplete de direcciones reales con TomTom (no más "Cremona" = fábrica de pastas) ---- */
let addrDebounceTimer = null;
function attachAddressAutocomplete(inputId, dropdownId, onPick){
  const input = document.getElementById(inputId);
  const dd = document.getElementById(dropdownId);
  if(!input || !dd) return;
  async function geocodeNominatim(q){
    // Red de contención: solo se usa cuando TomTom no encuentra nada, nunca en cada tecla (respeta la política de uso de Nominatim).
    try{
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=uy&limit=5&addressdetails=1`;
      const res = await fetch(url);
      if(!res.ok) return [];
      const data = await res.json();
      return data.map(r=>({ lat:Number(r.lat), lon:Number(r.lon), label:r.display_name }));
    }catch(e){ return []; }
  }
  async function buscar(){
    const q = input.value.trim();
    if(q.length<3){ dd.style.display='none'; return; }
    dd.innerHTML = '<div class="autocomplete-empty">Buscando…</div>';
    dd.style.display = 'block';
    try{
      // idxSet limitado a calles/direcciones/geografías — sin comercios (POI), que era lo que traía resultados raros.
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json?key=${TOMTOM_KEY}&countrySet=UY&limit=6&idxSet=Str,PAD,Addr,Geo&geobias=point:-34.9011,-56.1645`;
      const res = await fetch(url);
      if(!res.ok){
        dd.innerHTML = res.status===403
          ? '<div class="autocomplete-empty">La clave de TomTom no tiene habilitada la "Search API" — hay que activarla en el panel de TomTom (Keys → esta clave → Products).</div>'
          : `<div class="autocomplete-empty">TomTom devolvió un error (${res.status}) — probá de nuevo en un rato.</div>`;
        return;
      }
      const data = await res.json();
      const results = data.results || [];
      if(!results.length){
        // TomTom no la tiene mapeada — probamos con OpenStreetMap antes de rendirnos.
        dd.innerHTML = '<div class="autocomplete-empty">Buscando en OpenStreetMap…</div>';
        const nomResults = await geocodeNominatim(q+', Uruguay');
        if(nomResults.length){
          dd.innerHTML = '';
          nomResults.forEach(r=>{
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = r.label;
            item.addEventListener('mousedown', ()=>{
              input.value = r.label;
              dd.style.display = 'none';
              onPick({ lat:r.lat, lon:r.lon });
            });
            dd.appendChild(item);
          });
          return;
        }
        dd.innerHTML = '<div class="autocomplete-empty">Sin resultados en TomTom ni OpenStreetMap — probá con más detalle o cargá el km a mano.</div>';
        return;
      }
      dd.innerHTML = '';
      results.forEach(r=>{
        const label = (r.address && r.address.freeformAddress) || q;
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = label;
        item.addEventListener('mousedown', ()=>{
          input.value = label;
          dd.style.display = 'none';
          onPick({ lat:r.position.lat, lon:r.position.lon });
        });
        dd.appendChild(item);
      });
    }catch(e){
      dd.innerHTML = '<div class="autocomplete-empty">Error buscando — probá de nuevo.</div>';
    }
  }
  input.addEventListener('input', ()=>{
    clearTimeout(addrDebounceTimer);
    addrDebounceTimer = setTimeout(buscar, 350);
  });
  input.addEventListener('blur', ()=> setTimeout(()=>{ dd.style.display='none'; }, 150));
}
async function autoCalcularKmDesdeCoords(){
  if(!sitOrigenCoord || !sitDestinoCoord) return;
  const estado = document.getElementById('sit-km-estado');
  if(estado) estado.textContent = 'Calculando ruta…';
  const km = await rutaKmTomTom(sitOrigenCoord, sitDestinoCoord);
  if(km==null){ if(estado) estado.textContent = 'No se pudo calcular la ruta — probá "Recalcular" o cargá el km a mano.'; return; }
  const kmInput = document.getElementById('sit-km');
  if(kmInput) kmInput.value = km;
  if(estado) estado.textContent = `${km} km calculados automáticamente.`;
  actualizarPrecioSugeridoTraslado();
}
async function calcularRutaAutomatica(){
  const origenTxt = (document.getElementById('sit-origen')||{}).value?.trim();
  const destinoTxt = (document.getElementById('sit-destino')||{}).value?.trim();
  const estado = document.getElementById('sit-km-estado');
  if(!origenTxt || !destinoTxt){ if(estado) estado.textContent = 'Cargá origen y destino primero.'; return; }
  if(estado) estado.textContent = 'Calculando ruta…';
  try{
    const [o, d] = await Promise.all([geocodeTomTom(origenTxt), geocodeTomTom(destinoTxt)]);
    if(!o || !d){ if(estado) estado.textContent = 'No se pudo ubicar alguna dirección — probá con más detalle (calle, número, barrio) o cargá el km a mano.'; return; }
    const km = await rutaKmTomTom(o, d);
    if(km==null){ if(estado) estado.textContent = 'No se pudo calcular la ruta — cargá el km a mano.'; return; }
    const kmInput = document.getElementById('sit-km');
    if(kmInput) kmInput.value = km;
    if(estado) estado.textContent = `${km} km calculados con el mapa.`;
    actualizarPrecioSugeridoTraslado();
  }catch(e){
    if(estado) estado.textContent = 'Error consultando el mapa — probá de nuevo o cargá el km a mano.';
  }
}
function multiplicadorHorarioTraslado(horaHHMM){
  const cfg = tarifaTrasladoConfig;
  if(!horaHHMM || !cfg) return 1;
  const min = agendaMinutos(horaHHMM);
  if(min==null) return 1;
  const enRango = (desde, hasta) => {
    if(!desde || !hasta) return false;
    const dmin = agendaMinutos(desde.slice(0,5)), hmin = agendaMinutos(hasta.slice(0,5));
    if(dmin==null || hmin==null || dmin===hmin) return false;
    if(dmin<hmin) return min>=dmin && min<hmin;
    return min>=dmin || min<hmin; // el rango cruza medianoche
  };
  if(enRango(cfg.rec1_desde, cfg.rec1_hasta)) return Number(cfg.rec1_mult)||1;
  if(enRango(cfg.rec2_desde, cfg.rec2_hasta)) return Number(cfg.rec2_mult)||1;
  return 1;
}
// Marca visualmente un campo como "esto es un precio sugerido, no definitivo" -- borde
// punteado + fondo tenue. Se saca solo apenas la persona lo toca a mano (ver
// marcarCampoEditadoManual), para que quede claro que dejó de ser el sugerido.
function marcarCampoSugerido(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.style.border = '2px dashed var(--accent)';
  el.style.background = 'var(--clay-soft)';
  el.title = 'Precio sugerido — se puede editar';
}
function marcarCampoEditadoManual(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.dataset.tocadoManual = '1';
  el.style.border = '';
  el.style.background = '';
  el.title = '';
}
// Redondea a un número "lindo" (terminado en 50 o en 00) -- para arriba (precio a la
// familia) o para abajo (precio a la niñera), nunca al revés.
function redondearArriba50(v){ return Math.ceil(v/50)*50; }
function redondearAbajo50(v){ return Math.floor(v/50)*50; }
function actualizarPrecioSugeridoTraslado(){
  const box = document.getElementById('sit-precio-sugerido-box');
  if(!box) return;
  if(!tarifaTrasladoConfig){ box.innerHTML = ''; return; }
  const km = Number(document.getElementById('sit-km')?.value||0);
  const hora = leerHora('sit-hora');
  if(!km){ box.innerHTML = `<div class="helper" style="margin:0;">Cargá los km para ver el precio sugerido. <a href="#" onclick="abrirModalTarifaTraslado();return false;">Ajustar tarifa</a></div>`; return; }
  const cfg = tarifaTrasladoConfig;
  const base = Number(cfg.tarifa_base)||0;
  const porKm = Number(cfg.precio_km)||0;
  const mult = multiplicadorHorarioTraslado(hora);
  const premium = Number(cfg.margen_premium)||1;
  const margenNinera = Number(cfg.margen_ninera)||0;
  const crudo = (base + km*porKm) * mult * premium;
  const cobro = redondearArriba50(crudo);
  const pago = redondearAbajo50(crudo * (1 - margenNinera));
  // Se precarga directo en los campos de arriba (Cobro a familia / Pago a niñera) -- son
  // los mismos campos que se guardan, no hace falta un botón aparte para "usarlos". Si la
  // persona ya los había tocado a mano, no se pisa: se respeta lo que puso.
  const cobroInput = document.getElementById('sit-cobro'), pagoInput = document.getElementById('sit-pago');
  if(cobroInput && !cobroInput.dataset.tocadoManual){ cobroInput.value = cobro; marcarCampoSugerido('sit-cobro'); }
  if(pagoInput && !pagoInput.dataset.tocadoManual){ pagoInput.value = pago; marcarCampoSugerido('sit-pago'); }
  calcSitMargen();
  const detalles = mult>1 ? ` · recargo horario ×${mult}` : '';
  box.innerHTML = `<div class="helper" style="margin:0;">Precio sugerido según los km${detalles} (margen ${Math.round(margenNinera*100)}% para Parents Break) — ya está cargado arriba, en los campos con el borde punteado. Lo podés editar antes de guardar. <a href="#" onclick="abrirModalTarifaTraslado();return false;">Ajustar tarifa</a></div>`;
}
function abrirModalTarifaTraslado(){
  const cfg = tarifaTrasladoConfig || {};
  const hh = (t)=> t ? t.slice(0,2) : '';
  const mm = (t)=> t ? t.slice(3,5) : '';
  const html = `
    <h2>Tarifa de traslados</h2>
    <div class="helper">Se usa para calcular el precio sugerido en traslados nuevos — no toca los ya guardados.</div>
    <div class="grid2">
      <div class="field"><label>Tarifa base ($)</label><input type="number" id="tar-base" value="${cfg.tarifa_base??''}"></div>
      <div class="field"><label>Precio por km ($)</label><input type="number" id="tar-km" value="${cfg.precio_km??''}"></div>
    </div>
    <div class="helper" style="margin-top:6px;">Recargo 1</div>
    <div class="grid3">
      <div class="field"><label>Desde</label>${selectHora('tar-rec1-desde', hh(cfg.rec1_desde), mm(cfg.rec1_desde))}</div>
      <div class="field"><label>Hasta</label>${selectHora('tar-rec1-hasta', hh(cfg.rec1_hasta), mm(cfg.rec1_hasta))}</div>
      <div class="field"><label>Multiplicador</label><input type="number" step="0.01" id="tar-rec1-mult" value="${cfg.rec1_mult??1}"></div>
    </div>
    <div class="helper" style="margin-top:6px;">Recargo 2</div>
    <div class="grid3">
      <div class="field"><label>Desde</label>${selectHora('tar-rec2-desde', hh(cfg.rec2_desde), mm(cfg.rec2_desde))}</div>
      <div class="field"><label>Hasta</label>${selectHora('tar-rec2-hasta', hh(cfg.rec2_hasta), mm(cfg.rec2_hasta))}</div>
      <div class="field"><label>Multiplicador</label><input type="number" step="0.01" id="tar-rec2-mult" value="${cfg.rec2_mult??1}"></div>
    </div>
    <div class="field" style="margin-top:6px;"><label>Margen premium (multiplicador fijo)</label><input type="number" step="0.01" id="tar-premium" value="${cfg.margen_premium??1}"></div>
    <div class="field" style="margin-top:6px;"><label>Margen para Parents Break (% que se descuenta al precio de la niñera)</label><input type="number" step="1" id="tar-margen-ninera" value="${Math.round((cfg.margen_ninera??0.15)*100)}"></div>
    <div id="tar-warn"></div>
    <button class="btn primary" style="width:100%;margin-top:8px;" onclick="guardarTarifaTraslado()">Guardar tarifa</button>
  `;
  abrirModal(html);
}
async function guardarTarifaTraslado(){
  const warn = document.getElementById('tar-warn');
  const payload = {
    tarifa_base: Number(document.getElementById('tar-base').value)||0,
    precio_km: Number(document.getElementById('tar-km').value)||0,
    rec1_desde: leerHora('tar-rec1-desde')||null,
    rec1_hasta: leerHora('tar-rec1-hasta')||null,
    rec1_mult: Number(document.getElementById('tar-rec1-mult').value)||1,
    rec2_desde: leerHora('tar-rec2-desde')||null,
    rec2_hasta: leerHora('tar-rec2-hasta')||null,
    rec2_mult: Number(document.getElementById('tar-rec2-mult').value)||1,
    margen_premium: Number(document.getElementById('tar-premium').value)||1,
    margen_ninera: (Number(document.getElementById('tar-margen-ninera').value)||0) / 100,
  };
  if(!tarifaTrasladoConfig){ warn.innerHTML = '<div class="warnbox">No se encontró la fila de configuración base.</div>'; return; }
  const { error } = await sb.from('tarifas_traslado_config').update(payload).eq('id', tarifaTrasladoConfig.id);
  if(error){ warn.innerHTML = errBox(error); return; }
  cerrarModal();
  await cargarTarifaTrasladoConfig();
  actualizarPrecioSugeridoTraslado();
  toast('Tarifa actualizada.');
}

function calcSitMargen(){
  const c = Number((document.getElementById('sit-cobro')||{}).value)||0;
  const p = Number((document.getElementById('sit-pago')||{}).value)||0;
  const el = document.getElementById('sit-margen');
  if(el) el.textContent = '$'+(c-p);
}
/* Recalcula cobro/pago según la duración real (hora fin - hora inicio) por la
   tarifa por hora de la familia — se dispara solo al elegir horario o al
   cambiar la familia. Reemplaza el viejo botón de "horas o cobro extra": ya
   no hace falta cargar un extra a mano, alcanza con poner el horario real
   (por ejemplo, si se quedó 9 minutos más de lo previsto) y esto ya cobra
   exacto por esos minutos. Si la familia no tiene tarifa cargada, no toca
   nada — queda en carga manual como siempre. */
function actualizarCobroPagoPorHorario(){
  const cobroInput = document.getElementById('sit-cobro');
  const pagoInput = document.getElementById('sit-pago');
  const sinTarifaBox = document.getElementById('sit-sin-tarifa-box');
  if(!cobroInput || !pagoInput) return;
  if(sitTipo!=='sitting' || !sitFamiliaSel){ if(sinTarifaBox) sinTarifaBox.innerHTML = ''; return; }
  const cobroH = Number(sitFamiliaSel.cobro_hora)||0;
  const pagoH = Number(sitFamiliaSel.pago_hora)||0;
  const horaIni = leerHora('sit-horaini');
  const horaFin = leerHora('sit-horafin');
  if(!cobroH && !pagoH){
    // Sin tarifa cargada: no hay nada para calcular, pero ofrecemos cargarla ahí mismo
    // en vez de dejarlo en silencio — así la próxima vez con esta familia ya calcula solo.
    if(sinTarifaBox && horaIni && horaFin){
      sinTarifaBox.innerHTML = `
        <div class="helper" style="margin:8px 0 6px;color:var(--clay-text);">${sitFamiliaSel.nombre} no tiene tarifa por hora cargada — cargala ahora y calculamos este sitting y los que vengan:</div>
        <div class="grid2">
          <div class="field"><label>Cobro por hora</label><input type="number" id="sit-tarifa-cobro-nueva" placeholder="ej. 400"></div>
          <div class="field"><label>Pago por hora</label><input type="number" id="sit-tarifa-pago-nueva" placeholder="ej. 280"></div>
        </div>
        <button type="button" class="smallbtn" onclick="guardarTarifaFamiliaDesdeSitting()">Guardar tarifa y calcular</button>`;
    } else if(sinTarifaBox){
      sinTarifaBox.innerHTML = '';
    }
    return;
  }
  if(sinTarifaBox) sinTarifaBox.innerHTML = '';
  if(!horaIni || !horaFin) return;
  const cruza = document.getElementById('sit-cruza-medianoche')?.checked || false;
  const mi = agendaMinutos(horaIni);
  let mf = agendaMinutos(horaFin);
  if(cruza) mf += 24*60;
  if(mf<=mi) return; // horario todavía inválido/incompleto, no calcula nada raro
  const horasFrac = (mf-mi)/60;
  cobroInput.value = Math.round(cobroH*horasFrac);
  pagoInput.value = Math.round(pagoH*horasFrac);
  calcSitMargen();
}
async function guardarTarifaFamiliaDesdeSitting(){
  if(!sitFamiliaSel) return;
  const cobroH = Number(document.getElementById('sit-tarifa-cobro-nueva')?.value)||0;
  const pagoH = Number(document.getElementById('sit-tarifa-pago-nueva')?.value)||0;
  if(!cobroH && !pagoH){ toast('Cargá al menos uno de los dos valores.', 'bad'); return; }
  const { error } = await sb.from('familias').update({cobro_hora:cobroH||null, pago_hora:pagoH||null}).eq('id', sitFamiliaSel.id);
  if(error){ toast('No se pudo guardar la tarifa: '+error.message, 'bad'); return; }
  sitFamiliaSel.cobro_hora = cobroH||null;
  sitFamiliaSel.pago_hora = pagoH||null;
  const enLista = sitFamilias.find(f=>f.id===sitFamiliaSel.id);
  if(enLista){ enLista.cobro_hora = cobroH||null; enLista.pago_hora = pagoH||null; }
  toast('Tarifa guardada — esta familia ya calcula sola de acá en más.');
  actualizarCobroPagoPorHorario();
}

/* ---- guardar / editar / eliminar ---- */
function toggleSitEsFijo(){
  const box = document.getElementById('sit-fijo-box');
  box.style.display = document.getElementById('sit-esfijo').checked ? 'block' : 'none';
}
async function guardarSitting(){
  const familiaNombre = document.getElementById('sit-familia').value.trim();
  const nineraNombre = document.getElementById('sit-ninera').value.trim();
  const fecha = document.getElementById('sit-fecha').value;
  if(!familiaNombre || !nineraNombre || !fecha){ toast('Faltan familia, niñera o fecha.', 'bad'); return; }
  if(!sitEditId){
    if(!sitFamiliaSel && !(await confirmarNombreNuevo(familiaNombre, sitFamilias, 'familia'))) return;
    if(!sitNineraSel && !(await confirmarNombreNuevo(nineraNombre, sitNinieras, 'niñera'))) return;
  }
  const registro = {
    tipo: sitTipo,
    registrado_por: document.getElementById('sit-registro').value,
    familia_id: sitFamiliaSel ? sitFamiliaSel.id : null,
    familia_nombre: familiaNombre,
    ninera_id: sitNineraSel ? sitNineraSel.id : null,
    ninera_nombre: nineraNombre,
    fecha,
    cobro_familia: Number(document.getElementById('sit-cobro').value)||0,
    pago_ninera: Number(document.getElementById('sit-pago').value)||0,
    notas: document.getElementById('sit-notas').value || null,
    hora_inicio: null, hora_fin: null, km: null, origen: null, destino: null,
    termina_dia_siguiente: false,
  };
  if(sitTipo==='sitting'){
    const horaIni = leerHora('sit-horaini');
    const horaFin = leerHora('sit-horafin');
    const cruza = document.getElementById('sit-cruza-medianoche')?.checked || false;
    if(horaIni && horaFin && !cruza && horaFin<=horaIni){
      toast('La hora de fin tiene que ser después de la de inicio. Si termina pasada la medianoche, marcá "Termina al día siguiente".', 'bad');
      return;
    }
    registro.hora_inicio = horaIni || null;
    registro.hora_fin = horaFin || null;
    registro.termina_dia_siguiente = cruza;
  } else {
    registro.hora_inicio = leerHora('sit-hora') || null;
    const km = document.getElementById('sit-km').value;
    registro.km = km ? Number(km) : null;
    registro.origen = document.getElementById('sit-origen').value || null;
    registro.destino = document.getElementById('sit-destino').value || null;
  }
  if(!sitEditId && registro.hora_inicio){
    const choque = await chequearDobleReservaDB(nineraNombre, fecha, registro.hora_inicio, registro.hora_fin);
    if(!(await avisarSiDobleReserva(choque, nineraNombre, 'Guardar igual'))) return;
  }
  let error;
  if(sitEditId){
    ({ error } = await sb.from('sittings_traslados').update(registro).eq('id', sitEditId));
  } else {
    ({ error } = await sb.from('sittings_traslados').insert(registro));
  }
  if(error){ toast('No se pudo guardar: '+error.message, 'bad'); return; }
  const esFijo = document.getElementById('sit-esfijo')?.checked;
  if(esFijo){
    const dias = [...document.querySelectorAll('#sit-fijo-dias .daybtn.selected')].map(b=>b.dataset.dia);
    if(!dias.length){
      toast('Registro guardado, pero elegí al menos un día para la asignación fija.', 'bad');
    } else {
      const choqueFijo = await chequearFijoNuevoContraTodo(nineraNombre, dias, registro.hora_inicio, registro.hora_fin);
      const seguirFijo = await avisarSiDobleReserva(choqueFijo, nineraNombre, 'Crear igual');
      if(!seguirFijo){
        toast('Registro guardado, la asignación fija no se creó.');
      } else {
      const { error: errAsig } = await sb.from('asignaciones').insert({
        familia_id: registro.familia_id, ninera_nombre: nineraNombre,
        dias, hora_inicio: registro.hora_inicio, hora_fin: registro.hora_fin,
      });
      if(errAsig) toast('El registro se guardó, pero la asignación fija falló: '+errAsig.message, 'bad');
      else toast('Registro guardado y asignación fija creada.');
      }
    }
  } else {
    toast(sitEditId ? 'Registro actualizado.' : 'Registro guardado.');
  }
  sitEditId = null; sitFamiliaSel = null; sitNineraSel = null; sitOrigenAuto = true; sitTipo = 'sitting';
  cerrarModal();
  cargarSitLista();
}
async function eliminarSitting(id){
  if(!(await confirmarAccion('¿Eliminar este registro? No se puede deshacer.'))) return;
  const { error } = await sb.from('sittings_traslados').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  toast('Registro eliminado.');
  cargarSitLista();
}

/* ---- lista del mes / resumen / export ---- */
function cambiarSitMesRel(delta){
  sitMes = shiftMes(sitMes, delta);
  const lbl = document.getElementById('sit-mes-label'); if(lbl) lbl.textContent = monthLabel(sitMes);
  cargarSitLista();
}
async function cargarSitLista(){
  const wrap = document.getElementById('sit-list-wrap');
  const summary = document.getElementById('sit-summary');
  if(!wrap) return;
  wrap.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const [y,m] = sitMes.split('-').map(Number);
  const desde = `${sitMes}-01`;
  const hasta = new Date(y, m, 1).toISOString().slice(0,10);
  const { data, error } = await sb.from('sittings_traslados').select('*').gte('fecha', desde).lt('fecha', hasta).order('fecha', {ascending:false});
  if(error){ wrap.innerHTML = errBox(error); return; }
  sitItems = data || [];
  const cobrado = sitItems.reduce((s,r)=>s+(Number(r.cobro_familia)||0), 0);
  const pagado = sitItems.reduce((s,r)=>s+(Number(r.pago_ninera)||0), 0);
  summary.innerHTML = `
    <div class="summarycard"><div class="statlabel">Cobrado en ${monthLabel(sitMes)}</div><div class="statnum" style="font-size:19px;margin-top:3px;">$${cobrado}</div></div>
    <div class="summarycard"><div class="statlabel">Pagado en ${monthLabel(sitMes)}</div><div class="statnum" style="font-size:19px;margin-top:3px;">$${pagado}</div></div>
    <div class="summarycard" style="border-left:3px solid var(--good);"><div class="statlabel">Margen</div><div class="statnum" style="font-size:19px;margin-top:3px;color:var(--good);">$${cobrado-pagado}</div></div>
  `;
  if(!sitItems.length){ wrap.innerHTML = `<div class="empty">No hay registros cargados en ${monthLabel(sitMes)} todavía.</div>`; return; }
  wrap.innerHTML = `
    <h2>Registros de ${monthLabel(sitMes)}</h2>
    <div class="tablewrap"><table class="asigtable"><thead><tr><th>Fecha</th><th>Tipo</th><th>Familia</th><th>Niñera</th><th>Cobro</th><th>Pago</th><th>Margen</th><th></th></tr></thead>
    <tbody>${sitItems.map(r=>{
      const margen = (Number(r.cobro_familia)||0) - (Number(r.pago_ninera)||0);
      const fechaFmt = r.fecha ? new Date(r.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'}) : '—';
      return `<tr><td>${fechaFmt}</td><td><span class="badge ${r.tipo==='sitting'?'brand':'warn'}" style="font-size:10px;padding:2px 8px;">${r.tipo==='sitting'?'Sitting':'Traslado'}</span></td><td>${r.familia_nombre}</td><td>${r.ninera_nombre}</td><td>$${r.cobro_familia||0}</td><td>$${r.pago_ninera||0}</td><td class="${margen>=0?'margenpos':'margenneg'}">$${margen}</td><td><div class="tablecell-btns"><button class="smallbtn" onclick="abrirModalSitForm('${r.id}')">Editar</button><button class="smallbtn" onclick='abrirModalIncidente(${JSON.stringify({sitting_id:r.id, ninera_id:r.ninera_id, ninera_nombre:r.ninera_nombre, familia_id:r.familia_id, familia_nombre:r.familia_nombre, fecha:r.fecha}).replace(/'/g,"&#39;")})'>Incidente</button><button class="smallbtn danger" onclick="eliminarSitting('${r.id}')">Eliminar</button></div></td></tr>`;
    }).join('')}</tbody></table></div>
  `;
}
function exportarSitCSV(){
  if(!sitItems.length){ toast('No hay registros para exportar en este mes.', 'bad'); return; }
  const headers = ['Fecha','Tipo','Registró','Familia','Niñera','Hora inicio','Hora fin','Km','Origen','Destino','Cobro familia','Pago niñera','Margen','Notas'];
  const rows = sitItems.map(r=>[r.fecha, r.tipo, r.registrado_por, r.familia_nombre, r.ninera_nombre, r.hora_inicio||'', r.hora_fin||'', r.km||'', r.origen||'', r.destino||'', r.cobro_familia||0, r.pago_ninera||0, (Number(r.cobro_familia)||0)-(Number(r.pago_ninera)||0), (r.notas||'').replace(/\n/g,' ')]);
  descargarCSV(headers, rows, `sittings_traslados_${sitMes}.csv`);
}

