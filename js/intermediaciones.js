/* ================= INTERMEDIACIONES ================= */
let interTab = 'historial';
let interNinieras = [];
let interNinierasPool = []; // niñeras del pool Enrique con estado 'disponible' (se sugieren primero)
let interEmpresas = [];
let interEnriqueSel = null;
let interEventoFilas = [];
let interEventoFilaSeq = 0;

function setInterTab(t){ interTab = t; renderModulo(); }

async function renderIntermediaciones(cont){
  cont.innerHTML = moduloHeader('Intermediaciones') + `
    <div class="subnav">
      <button class="subtab ${interTab==='historial'?'active':''}" onclick="setInterTab('historial')">Historial</button>
      <button class="subtab ${interTab==='enrique'?'active':''}" onclick="setInterTab('enrique')">+ Colocación Enrique</button>
      <button class="subtab ${interTab==='evento'?'active':''}" onclick="setInterTab('evento')">+ Evento</button>
      <button class="subtab ${interTab==='pool'?'active':''}" onclick="setInterTab('pool')">Niñeras Enrique</button>
    </div>
    <div id="inter-body"><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>
  `;
  const [{data:nin}, {data:emp}, {data:pool}] = await Promise.all([
    sb.from('ninieras').select('id,nombre').eq('activa', true).order('nombre'),
    sb.from('intermediaciones_eventos').select('empresa'),
    sb.from('intermediaciones_enrique_pool').select('*').order('ninera_nombre'),
  ]);
  const disponibles = (pool||[]).filter(p=>p.estado==='disponible').map(p=>({id:p.ninera_id, nombre:p.ninera_nombre}));
  // Las disponibles (ya pasaron por Enrique y quedaron libres) van primero en el autocompletar
  // de la próxima colocación -- de ahí para abajo, el resto de niñeras activas normales.
  const idsDisponibles = new Set(disponibles.map(d=>d.id));
  interNinieras = [...disponibles, ...(nin||[]).filter(n=>!idsDisponibles.has(n.id))];
  interNinierasPool = pool || [];
  const empresasUnicas = [...new Set((emp||[]).map(e=>(e.empresa||'').trim()).filter(Boolean))].sort();
  interEmpresas = empresasUnicas.map(nombre=>({nombre}));
  if(interTab==='historial') renderInterHistorial();
  else if(interTab==='enrique') renderInterFormEnrique();
  else if(interTab==='evento') renderInterFormEvento();
  else renderInterPool();
}

/* ---- Niñeras Enrique: registro propio, separado de la lista general de Niñeras ---- */
function renderInterPool(){
  const body = document.getElementById('inter-body');
  if(!body) return;
  if(!interNinierasPool.length){ body.innerHTML = '<div class="empty">Todavía no hay niñeras colocadas vía Agencia Enrique.</div>'; return; }
  body.innerHTML = `<div class="card" style="padding:0;overflow:hidden;">${interNinierasPool.map(p=>`
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);cursor:pointer;" onclick="abrirModalInterPoolNinera('${p.id}')">
      <span class="badge ${p.estado==='activa'?'brand':'good'}">${p.estado==='activa'?'Activa':'Disponible'}</span>
      <div style="flex:1;min-width:0;font-weight:700;color:var(--ink);">${p.ninera_nombre}</div>
      <div class="helper" style="margin:0;">${p.estado==='activa'?'Colocada, trabajando':'Libre para una nueva colocación'}</div>
    </div>`).join('')}</div>`;
}
async function abrirModalInterPoolNinera(poolId){
  const p = interNinierasPool.find(x=>x.id===poolId);
  if(!p) return;
  const { data: colocaciones } = await sb.from('intermediaciones_enrique').select('*').eq('ninera_id', p.ninera_id).order('fecha', {ascending:false});
  const historialHtml = (colocaciones||[]).map(c=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;">
    <span>${new Date(c.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'})}</span>
    <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">$${Number(c.monto||0).toLocaleString('es-UY')}</span>
  </div>`).join('') || '<div class="helper">Sin colocaciones registradas.</div>';
  abrirModal(`
    <h2>${p.ninera_nombre}</h2>
    <div class="helper">Estado actual: ${p.estado==='activa'?'Activa (colocada, trabajando)':'Disponible (libre para una nueva colocación)'}</div>
    <div style="margin-top:14px;">${historialHtml}</div>
    <button class="btn primary" style="width:100%;margin-top:16px;" onclick="cambiarEstadoPoolEnrique('${p.id}', '${p.estado==='activa'?'disponible':'activa'}')">Marcar como ${p.estado==='activa'?'disponible':'activa'}</button>
  `);
}
async function cambiarEstadoPoolEnrique(poolId, nuevoEstado){
  const { error } = await sb.from('intermediaciones_enrique_pool').update({estado:nuevoEstado, updated_at:new Date().toISOString()}).eq('id', poolId);
  if(error){ toast('No se pudo actualizar: '+error.message, 'bad'); return; }
  toast(`Marcada como ${nuevoEstado}.`);
  cerrarModal();
  renderIntermediaciones(document.getElementById('modcontent'));
}

/* ---- historial combinado (colocaciones Enrique + eventos) ---- */
async function renderInterHistorial(){
  const body = document.getElementById('inter-body');
  if(!body) return;
  const [{data:enrique}, {data:eventos}] = await Promise.all([
    sb.from('intermediaciones_enrique').select('*').order('fecha', {ascending:false}),
    sb.from('intermediaciones_eventos').select('*, intermediaciones_eventos_ninieras(*)').order('fecha', {ascending:false}),
  ]);
  const items = [
    ...(enrique||[]).map(e=>({...e, _tipo:'enrique'})),
    ...(eventos||[]).map(e=>({...e, _tipo:'evento'})),
  ].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  if(!items.length){ body.innerHTML = '<div class="empty">Todavía no hay colocaciones ni eventos cargados.</div>'; return; }
  body.innerHTML = `<div class="card" style="padding:0;overflow:hidden;">${items.map(filaInterHistorial).join('')}</div>`;
}
function filaInterHistorial(it){
  const fechaFmt = it.fecha ? new Date(it.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  if(it._tipo==='enrique'){
    return `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);cursor:pointer;" onclick="abrirModalInterEnriqueDetalle('${it.id}')">
      <span class="badge brand">Enrique</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;color:var(--ink);">${it.ninera_nombre}</div>
        <div class="helper" style="margin:0;">${fechaFmt} · entrada única</div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--ink);">$${Number(it.monto||0).toLocaleString('es-UY')}</div>
    </div>`;
  }
  const ninieras = (it.intermediaciones_eventos_ninieras||[]).map(n=>n.ninera_nombre).join(', ');
  return `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);cursor:pointer;" onclick="abrirModalInterEventoDetalle('${it.id}')">
    <span class="badge accent">Evento</span>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:700;color:var(--ink);">${it.empresa}</div>
      <div class="helper" style="margin:0;">${fechaFmt} · ${ninieras || 'sin niñeras cargadas'}</div>
    </div>
    <div style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--ink);">$${Number(it.cobro_total||0).toLocaleString('es-UY')}</div>
  </div>`;
}

/* ---- form: colocación Agencia Enrique ---- */
function renderInterFormEnrique(){
  const body = document.getElementById('inter-body');
  if(!body) return;
  body.innerHTML = `
    <div class="card">
      <div class="field" style="position:relative;">
        <label>Niñera</label>
        <input type="text" id="inter-enrique-ninera" autocomplete="off" placeholder="Buscar niñera…">
        <div id="inter-enrique-ninera-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Fecha</label><input type="date" id="inter-enrique-fecha" value="${todayISO()}"></div>
        <div class="field"><label>Monto cobrado (entrada única)</label><input type="number" id="inter-enrique-monto" placeholder="0"></div>
      </div>
      <div class="field"><label>Comentarios</label><textarea id="inter-enrique-comentarios" rows="2" placeholder="Opcional"></textarea></div>
      <div id="inter-enrique-warn"></div>
      <button class="btn primary" style="width:100%;" onclick="guardarIntermediacionEnrique()">Guardar colocación</button>
    </div>
  `;
  interEnriqueSel = null;
  attachAutocomplete('inter-enrique-ninera', 'inter-enrique-ninera-dropdown', ()=>interNinieras, (o)=>{ interEnriqueSel = o; });
}
async function guardarIntermediacionEnrique(){
  const warn = document.getElementById('inter-enrique-warn');
  if(!interEnriqueSel){ warn.innerHTML = '<div class="warnbox">Elegí una niñera de la lista (tiene que ser una niñera ya cargada).</div>'; return; }
  const fecha = document.getElementById('inter-enrique-fecha').value;
  if(!fecha){ warn.innerHTML = '<div class="warnbox">Falta la fecha.</div>'; return; }
  const monto = Number(document.getElementById('inter-enrique-monto').value)||0;
  const { error } = await sb.from('intermediaciones_enrique').insert({
    ninera_id: interEnriqueSel.id,
    ninera_nombre: interEnriqueSel.nombre,
    fecha, monto,
    comentarios: document.getElementById('inter-enrique-comentarios').value.trim() || null,
    registrado_por: registradoPorUsuario(),
  });
  if(error){ warn.innerHTML = errBox(error); return; }
  // Colocada por Enrique: sale de la lista general de Niñeras (ya no se le asignan sittings)
  // y queda registrada en el pool propio de Intermediaciones como "activa".
  await sb.from('ninieras').update({activa:false}).eq('id', interEnriqueSel.id);
  await sb.from('intermediaciones_enrique_pool').upsert(
    {ninera_id: interEnriqueSel.id, ninera_nombre: interEnriqueSel.nombre, estado:'activa', updated_at:new Date().toISOString()},
    {onConflict:'ninera_id'}
  );
  toast('Colocación registrada — la niñera ya no aparece en Niñeras.');
  interTab = 'historial';
  renderModulo();
}
async function abrirModalInterEnriqueDetalle(id){
  const { data: it } = await sb.from('intermediaciones_enrique').select('*').eq('id', id).single();
  if(!it) return;
  const fechaFmt = new Date(it.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'long',year:'numeric'});
  abrirModal(`
    <h2>${it.ninera_nombre}</h2>
    <div class="helper">Colocación vía Agencia Enrique · ${fechaFmt}</div>
    <div class="fichadl" style="margin-top:14px;"><div><b>Monto cobrado</b>$${Number(it.monto||0).toLocaleString('es-UY')}</div>${it.comentarios?`<div><b>Comentarios</b>${it.comentarios}</div>`:''}</div>
    <button class="btn danger" style="width:100%;margin-top:16px;" onclick="eliminarIntermediacionEnrique('${it.id}')">Eliminar registro</button>
  `);
}
async function eliminarIntermediacionEnrique(id){
  const ok = await confirmarAccion('¿Eliminar esta colocación? No se puede deshacer.', 'Eliminar');
  if(!ok) return;
  const { error } = await sb.from('intermediaciones_enrique').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  cerrarModal();
  renderInterHistorial();
}

/* ---- form: evento (varias niñeras, horario y pago individual) ---- */
function filaInterEventoHtml(f){
  return `<div class="grid3" id="inter-evtfila-${f.key}" style="align-items:end;margin-bottom:8px;position:relative;">
    <div class="field" style="margin-bottom:0;position:relative;"><label>Niñera</label>
      <input type="text" id="inter-evtfila-${f.key}-ninera" autocomplete="off" placeholder="Buscar niñera…">
      <div id="inter-evtfila-${f.key}-ninera-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
    </div>
    <div class="field" style="margin-bottom:0;"><label>Horario</label>
      <div style="display:flex;gap:4px;align-items:center;">${selectHora('inter-evtfila-'+f.key+'-hi')}<span>–</span>${selectHora('inter-evtfila-'+f.key+'-hf')}</div>
    </div>
    <div class="field" style="margin-bottom:0;"><label>Pago a la niñera</label>
      <div style="display:flex;gap:4px;">
        <input type="number" id="inter-evtfila-${f.key}-pago" placeholder="0" style="flex:1;">
        <button class="smallbtn danger" type="button" onclick="quitarFilaInterEvento('${f.key}')">−</button>
      </div>
    </div>
  </div>`;
}
function agregarFilaInterEvento(){
  const f = {key: 'f'+(interEventoFilaSeq++), ninera:null};
  interEventoFilas.push(f);
  const cont = document.getElementById('inter-evento-filas');
  if(cont){
    cont.insertAdjacentHTML('beforeend', filaInterEventoHtml(f));
    attachAutocomplete('inter-evtfila-'+f.key+'-ninera', 'inter-evtfila-'+f.key+'-ninera-dropdown', ()=>interNinieras, (o)=>{ f.ninera = o; });
  }
  return f;
}
function quitarFilaInterEvento(key){
  interEventoFilas = interEventoFilas.filter(f=>f.key!==key);
  const el = document.getElementById('inter-evtfila-'+key);
  if(el) el.remove();
}
function renderInterFormEvento(){
  const body = document.getElementById('inter-body');
  if(!body) return;
  interEventoFilas = [];
  interEventoFilaSeq = 0;
  body.innerHTML = `
    <div class="card">
      <div class="field" style="position:relative;">
        <label>Empresa</label>
        <input type="text" id="inter-evento-empresa" autocomplete="off" placeholder="Buscar o escribir el nombre de la empresa…">
        <div id="inter-evento-empresa-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Fecha</label><input type="date" id="inter-evento-fecha" value="${todayISO()}"></div>
        <div class="field"><label>Cobro total a la empresa</label><input type="number" id="inter-evento-cobro" placeholder="0"></div>
      </div>
      <label style="font-weight:600;font-size:13.5px;color:var(--ink);display:block;margin:10px 0 6px;">Niñeras en el evento</label>
      <div id="inter-evento-filas"></div>
      <button class="smallbtn" type="button" onclick="agregarFilaInterEvento()" style="margin-bottom:10px;">+ Agregar otra niñera</button>
      <div class="field"><label>Comentarios</label><textarea id="inter-evento-comentarios" rows="2" placeholder="ej: juguetes que se llevaron, o cualquier otro dato del evento"></textarea></div>
      <div id="inter-evento-warn"></div>
      <button class="btn primary" style="width:100%;" onclick="guardarIntermediacionEvento()">Guardar evento</button>
    </div>
  `;
  attachAutocomplete('inter-evento-empresa', 'inter-evento-empresa-dropdown', ()=>interEmpresas, ()=>{});
  agregarFilaInterEvento();
}
async function guardarIntermediacionEvento(){
  const warn = document.getElementById('inter-evento-warn');
  const empresa = document.getElementById('inter-evento-empresa').value.trim();
  const fecha = document.getElementById('inter-evento-fecha').value;
  if(!empresa || !fecha){ warn.innerHTML = '<div class="warnbox">Faltan la empresa o la fecha.</div>'; return; }
  const filas = interEventoFilas.map(f=>({
    key: f.key,
    nombreTecleado: document.getElementById('inter-evtfila-'+f.key+'-ninera')?.value.trim() || '',
    ninera: f.ninera,
    hora_inicio: leerHora('inter-evtfila-'+f.key+'-hi') || null,
    hora_fin: leerHora('inter-evtfila-'+f.key+'-hf') || null,
    pago: Number(document.getElementById('inter-evtfila-'+f.key+'-pago')?.value)||0,
  })).filter(f=>f.nombreTecleado);
  if(!filas.length){ warn.innerHTML = '<div class="warnbox">Agregá al menos una niñera.</div>'; return; }
  const filaSinNinera = filas.find(f=>!f.ninera || normaliza(f.ninera.nombre)!==normaliza(f.nombreTecleado));
  if(filaSinNinera){ warn.innerHTML = '<div class="warnbox">Elegí cada niñera de la lista (tienen que ser niñeras ya cargadas).</div>'; return; }
  const cobro_total = Number(document.getElementById('inter-evento-cobro').value)||0;
  const comentarios = document.getElementById('inter-evento-comentarios').value.trim() || null;
  const { data: evento, error } = await sb.from('intermediaciones_eventos').insert({
    empresa, fecha, cobro_total, comentarios, registrado_por: registradoPorUsuario(),
  }).select().single();
  if(error){ warn.innerHTML = errBox(error); return; }
  const filasInsert = filas.map(f=>({
    evento_id: evento.id, ninera_id: f.ninera.id, ninera_nombre: f.ninera.nombre,
    hora_inicio: f.hora_inicio, hora_fin: f.hora_fin, pago: f.pago,
  }));
  const { error: error2 } = await sb.from('intermediaciones_eventos_ninieras').insert(filasInsert);
  if(error2){ warn.innerHTML = errBox(error2); return; }
  toast('Evento registrado.');
  interTab = 'historial';
  renderModulo();
}
async function abrirModalInterEventoDetalle(id){
  const { data: it } = await sb.from('intermediaciones_eventos').select('*, intermediaciones_eventos_ninieras(*)').eq('id', id).single();
  if(!it) return;
  const fechaFmt = new Date(it.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'long',year:'numeric'});
  const filasHtml = (it.intermediaciones_eventos_ninieras||[]).map(n=>`<tr><td>${n.ninera_nombre}</td><td>${n.hora_inicio?n.hora_inicio.slice(0,5):'—'}${n.hora_fin?'–'+n.hora_fin.slice(0,5):''}</td><td>$${Number(n.pago||0).toLocaleString('es-UY')}</td></tr>`).join('');
  abrirModal(`
    <h2>${it.empresa}</h2>
    <div class="helper">Evento · ${fechaFmt} · Cobro total $${Number(it.cobro_total||0).toLocaleString('es-UY')}</div>
    <div class="tablewrap" style="margin-top:14px;"><table class="asigtable"><thead><tr><th>Niñera</th><th>Horario</th><th>Pago</th></tr></thead><tbody>${filasHtml}</tbody></table></div>
    ${it.comentarios?`<div class="fichadl" style="margin-top:10px;"><div><b>Comentarios</b>${it.comentarios}</div></div>`:''}
    <button class="btn danger" style="width:100%;margin-top:16px;" onclick="eliminarIntermediacionEvento('${it.id}')">Eliminar evento</button>
  `);
}
async function eliminarIntermediacionEvento(id){
  const ok = await confirmarAccion('¿Eliminar este evento y sus niñeras cargadas? No se puede deshacer.', 'Eliminar');
  if(!ok) return;
  const { error } = await sb.from('intermediaciones_eventos').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  cerrarModal();
  renderInterHistorial();
}

/* ---- mini-historial para mostrar dentro de la ficha de una niñera (ninieras.js) ---- */
async function renderIntermediacionesEnFicha(contId, nineraId){
  const cont = document.getElementById(contId);
  if(!cont) return;
  const [{data:enrique}, {data:eventosNin}] = await Promise.all([
    sb.from('intermediaciones_enrique').select('*').eq('ninera_id', nineraId).order('fecha',{ascending:false}),
    sb.from('intermediaciones_eventos_ninieras').select('hora_inicio,hora_fin,pago,intermediaciones_eventos(id,empresa,fecha)').eq('ninera_id', nineraId),
  ]);
  const items = [
    ...(enrique||[]).map(e=>({tipo:'enrique', id:e.id, fecha:e.fecha, texto:`Colocación vía Agencia Enrique — $${Number(e.monto||0).toLocaleString('es-UY')}`})),
    ...(eventosNin||[]).filter(e=>e.intermediaciones_eventos).map(e=>({tipo:'evento', id:e.intermediaciones_eventos.id, fecha:e.intermediaciones_eventos.fecha, texto:`Evento con ${e.intermediaciones_eventos.empresa}`})),
  ].sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  if(!items.length){ cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <h2 class="card-section-title" style="margin-top:0;">Intermediaciones</h2>
    ${items.map(it=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;cursor:pointer;" onclick="${it.tipo==='enrique'?`abrirModalInterEnriqueDetalle('${it.id}')`:`abrirModalInterEventoDetalle('${it.id}')`}">
      <span class="badge ${it.tipo==='enrique'?'brand':'accent'}">${it.tipo==='enrique'?'Enrique':'Evento'}</span>
      <span style="flex:1;color:var(--ink);">${it.texto}</span>
      <span class="helper" style="margin:0;">${it.fecha ? new Date(it.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) : ''}</span>
    </div>`).join('')}
  `;
}
