/* ================= FAMILIAS ================= */
let familiasItems = [];
let famBusqueda = '';
let famFiltroZonas = new Set(); // claveZona() de las zonas marcadas en el filtro
function toggleFiltroZonaFam(k, marcada){
  if(k===null) famFiltroZonas.clear();
  else if(marcada) famFiltroZonas.add(k); else famFiltroZonas.delete(k);
  const w = document.getElementById('fam-zonas-filtro');
  if(w) w.innerHTML = htmlFiltroZonas(famFiltroZonas, 'toggleFiltroZonaFam');
  renderFamiliasList();
}
let famDetalleAbierta = null;
function renderFamilias(body){
  body.innerHTML = `
    <div id="fam-riesgo-wrap"></div>
    <div id="fam-zonasnuevas-wrap"></div>
    <div class="card" style="padding:14px 18px;"><div class="grid2">
      <div class="field" style="margin:0;"><label>Buscar familia</label><input type="text" id="fam-buscar" autocomplete="off" placeholder="Nombre..." value="${escaparHtml(famBusqueda)}" oninput="famBusqueda=this.value;renderFamiliasList();"></div>
      <div class="field" style="margin:0;"><button class="btn primary" style="width:100%;margin-top:22px;" onclick="abrirModalNuevaFamilia()">+ Agregar familia</button></div>
    </div>
    <div class="field" style="margin:12px 0 0;"><label>Zonas</label><div id="fam-zonas-filtro">${htmlFiltroZonas(famFiltroZonas, 'toggleFiltroZonaFam')}</div></div>
    </div>
    <div id="familiaslist"></div>
  `;
  famDetalleAbierta = null;
  cargarFamilias();
}
function abrirModalNuevaFamilia(){
  abrirModal(`
    <h2 style="margin:0 0 6px;">Nueva familia</h2>
    <div class="helper" style="margin-bottom:14px;">El precio es por familia: cuánto le cobramos por hora y cuánto le pagamos a la niñera. El margen se calcula solo.</div>
    <div class="grid3">
      <div class="field"><label>Nombre de la familia</label><input type="text" id="fam-nombre"></div>
      <div class="field"><label>Teléfono</label><input type="tel" id="fam-telefono"></div>
    </div>
    ${checklistZonas('fam', '', 'Zona')}
    <div class="grid3">
      <div class="field"><label>Cobro a familia ($/h)</label><input type="number" id="fam-cobro"></div>
      <div class="field"><label>Pago a niñera ($/h)</label><input type="number" id="fam-pago"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Dirección</label><input type="text" id="fam-direccion" placeholder="Para sugerir origen en traslados"></div>
    </div>
    ${htmlHijosFamilia('fam', [])}
    ${htmlCuentasBancarias('fam', [])}
    <div class="field"><label>Notas</label><textarea id="fam-notas"></textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>addFamilia())">Agregar familia</button>
    </div>`);
}
async function addFamilia(){
  const nombre = document.getElementById('fam-nombre').value.trim();
  if(!nombre){ toast('Falta el nombre de la familia.','bad'); return; }
  if(!(await confirmarNombreNuevo(nombre, familiasItems, 'familia'))) return;
  const fam = { nombre, zona:leerZonasChecklist('fam'), telefono:document.getElementById('fam-telefono').value,
    cobro_hora:document.getElementById('fam-cobro').value||null, pago_hora:document.getElementById('fam-pago').value||null,
    direccion:document.getElementById('fam-direccion').value,
    cuenta_bancaria:leerCuentasBancarias('fam'), notas:document.getElementById('fam-notas').value };
  const { data, error } = await sb.from('familias').insert(fam).select().single();
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  const hijos = leerHijosFamilia('fam');
  if(hijos.length){
    const { error: e2 } = await sb.from('hijos_familia').insert(hijos.map((h,i)=>({...h, familia_id:data.id, orden:i})));
    if(e2){ cerrarModal(); toast('Familia guardada, pero no los hijos: '+e2.message, 'bad'); cargarFamilias(); return; }
  }
  cerrarModal();
  toast('Familia agregada.');
  cargarFamilias();
}
let famResenaPorNinera = {};
let famHistorialPorFamilia = {};
let famUltimaActividad = {};
const FAM_RIESGO_SEMANAS = 6;      // sin sittings hace más de esto = "en riesgo"
const FAM_RIESGO_SNOOZE_DIAS = 30; // al marcar "ya la contacté", no volver a avisar por este tiempo
let famRiesgoAbierto = false;      // arranca cerrado — antes mostraba todas de una, "cartel inmenso"
async function cargarFamilias(){
  await esperarConfigFijos(); // fijos automáticos: saber si hay que sacar los previstos
  // Las zonas se esperan: el filtro, el panel de "barrios sin zona" y el selector de Editar las usan.
  if(!zonaGruposCache) await cargarZonaGrupos();
  const cont = document.getElementById('familiaslist');
  if(!cont) return; // se puede llamar desde otra pantalla (ej. al quitar una asignación fija desde Agenda) — sin esto, rompía ahí.
  cont.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const necesitaNinieras = !ninierasItems.length;
  const [{data:familias, error}, {data:asignaciones}, {data:sittings}, {data:resenas}, ninierasRes] = await Promise.all([
    sb.from('familias').select('*, hijos_familia(*)').order('nombre'),
    sb.from('asignaciones').select('*'),
    sinPrevistos(sb.from('sittings_traslados').select('familia_nombre,ninera_nombre,fecha')),
    sb.from('resenas_ninieras').select('ninera_nombre,puntuacion'),
    necesitaNinieras ? sb.from('ninieras').select('nombre') : Promise.resolve({data:null}),
  ]);
  if(error){ cont.innerHTML = errBox(error); return; }
  if(necesitaNinieras && ninierasRes?.data) ninierasItems = ninierasRes.data;
  famResenaPorNinera = {};
  (resenas||[]).forEach(r=>{
    if(r.puntuacion==null) return;
    const k = normaliza(r.ninera_nombre||'');
    if(!k) return;
    if(!famResenaPorNinera[k]) famResenaPorNinera[k] = {suma:0, cant:0};
    famResenaPorNinera[k].suma += Number(r.puntuacion);
    famResenaPorNinera[k].cant += 1;
  });
  famHistorialPorFamilia = {};
  famUltimaActividad = {};
  (sittings||[]).forEach(s=>{
    const kf = normaliza(s.familia_nombre||'');
    const kn = s.ninera_nombre;
    if(kf && kn){
      if(!famHistorialPorFamilia[kf]) famHistorialPorFamilia[kf] = {};
      famHistorialPorFamilia[kf][kn] = (famHistorialPorFamilia[kf][kn]||0) + 1;
    }
    if(kf && s.fecha && (!famUltimaActividad[kf] || s.fecha > famUltimaActividad[kf])) famUltimaActividad[kf] = s.fecha;
  });
  familiasItems = familias.map(f => ({...f, hijos: (f.hijos_familia||[]).slice().sort((a,b)=>a.orden-b.orden), asignaciones: (asignaciones||[]).filter(a=>a.familia_id===f.id)}));
  renderZonasNuevasPanel();
  const wZonas = document.getElementById('fam-zonas-filtro');
  if(wZonas) wZonas.innerHTML = htmlFiltroZonas(famFiltroZonas, 'toggleFiltroZonaFam');
  await cargarConteoIncidentesFamilias();
  renderFamiliasList();
  renderFamiliasEnRiesgo();
  if(famDetalleAbierta){
    if(familiasItems.some(f=>f.id===famDetalleAbierta)) verFamilia(famDetalleAbierta);
    else { famDetalleAbierta = null; cerrarModal(); }
  }
}
function semanasDesde(fechaStr){
  const ms = Date.now() - new Date(fechaStr+'T00:00:00').getTime();
  return Math.floor(ms / (7*24*3600*1000));
}
/* Borrador de mensaje — todavía no es el texto final acordado con Pau/Delfi
   (pendiente #10), así que se puede editar antes de copiarlo. */
function mensajeRiesgoPara(f){
  const primerNombre = (f.nombre||'').trim().split(' ')[0] || f.nombre;
  return `¡Hola ${primerNombre}! Somos de Parents’ Break 💛 Hace un tiempo que no coordinamos ningún sitting con ustedes y queríamos saber cómo están. Si necesitan una niñera o un traslado, contanos y lo vemos. Como agradecimiento por seguir confiando en nosotras, tenemos un 5% de descuento para el próximo servicio. ¡Esperamos su mensaje!`;
}
function toggleFamRiesgo(){ famRiesgoAbierto = !famRiesgoAbierto; renderFamiliasEnRiesgo(); }
function renderFamiliasEnRiesgo(){
  const wrap = document.getElementById('fam-riesgo-wrap');
  if(!wrap) return;
  const enRiesgo = familiasItems.filter(f=>{
    const ultima = famUltimaActividad[normaliza(f.nombre)];
    if(!ultima) return false; // nunca tuvo un sitting registrado — no es que "se enfrió", nunca arrancó
    if(semanasDesde(ultima) < FAM_RIESGO_SEMANAS) return false;
    if(f.contactada_riesgo_en){
      const diasDesdeContacto = Math.floor((Date.now() - new Date(f.contactada_riesgo_en+'T00:00:00').getTime())/(24*3600*1000));
      if(diasDesdeContacto < FAM_RIESGO_SNOOZE_DIAS) return false;
    }
    return true;
  }).sort((a,b)=> famUltimaActividad[normaliza(a.nombre)].localeCompare(famUltimaActividad[normaliza(b.nombre)]));

  if(!enRiesgo.length){ wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div class="card" style="padding:14px 18px;border-left:3px solid var(--clay);margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;cursor:pointer;" onclick="toggleFamRiesgo()">
        <h2 style="margin:0;">Familias en riesgo</h2>
        <div class="helper" style="margin:0;">${enRiesgo.length} sin pedir hace ${FAM_RIESGO_SEMANAS}+ semanas · ${famRiesgoAbierto?'tocá para cerrar ▲':'tocá para ver ▼'}</div>
      </div>
      ${famRiesgoAbierto ? `
      <div class="helper" style="margin:12px 0 12px;">El texto es un borrador — revisalo y ajustalo a tu gusto antes de mandarlo.</div>
      ${enRiesgo.map(f=>{
        const semanas = semanasDesde(famUltimaActividad[normaliza(f.nombre)]);
        return `
        <div class="agendarow" style="border-bottom:1px solid var(--line);align-items:flex-start;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <div style="font-weight:600;">${escaparHtml(f.nombre)}</div>
            <div class="helper" style="margin:2px 0 8px;">Hace ${semanas} semana${semanas===1?'':'s'} sin sittings</div>
            <textarea readonly style="width:100%;min-height:70px;font-size:12.5px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;" id="fam-riesgo-msj-${f.id}">${escaparHtml(mensajeRiesgoPara(f))}</textarea>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:150px;">
            ${f.telefono
              ? `<button class="btn primary" style="padding:6px 10px;font-size:12.5px;" onclick="enviarWhatsappRiesgo(${argJs(f.id)})">Enviar por WhatsApp</button>`
              : `<div class="helper" style="margin:0;color:var(--clay-text);">Sin teléfono cargado</div>`}
            <button class="smallbtn" onclick="copiarMensajeRiesgo(${argJs(f.id)})">Copiar mensaje</button>
            <button class="smallbtn" onclick="conGuardado(this, ()=>marcarContactadaRiesgo(${argJs(f.id)}))">Ya la contacté</button>
          </div>
        </div>`;
      }).join('')}` : ''}
    </div>`;
}
/* Uruguay: números locales vienen como "099123456" o "99123456" — wa.me
   necesita el formato internacional completo, sin 0 inicial ni espacios. */
function formatearTelefonoWhatsApp(tel){
  let d = (tel||'').replace(/\D/g,'');
  if(!d) return null;
  if(d.startsWith('598')) return d;
  if(d.startsWith('0')) d = d.slice(1);
  return '598'+d;
}
function enviarWhatsappRiesgo(id){
  const f = familiasItems.find(x=>x.id===id);
  if(!f) return;
  const tel = formatearTelefonoWhatsApp(f.telefono);
  if(!tel){ toast('Esta familia no tiene teléfono cargado — agregalo en su ficha primero.', 'bad'); return; }
  const ta = document.getElementById('fam-riesgo-msj-'+id);
  const texto = ta ? ta.value : mensajeRiesgoPara(f);
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank');
}
async function copiarMensajeRiesgo(id){
  const ta = document.getElementById('fam-riesgo-msj-'+id);
  if(!ta) return;
  try{
    await navigator.clipboard.writeText(ta.value);
    toast('Mensaje copiado — pegalo en WhatsApp.');
  }catch(e){
    toast('No se pudo copiar automático — seleccioná el texto a mano.', 'bad');
  }
}
async function marcarContactadaRiesgo(id){
  const { error } = await sb.from('familias').update({contactada_riesgo_en: todayISO()}).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message, 'bad'); return; }
  const f = familiasItems.find(x=>x.id===id);
  if(f) f.contactada_riesgo_en = todayISO();
  toast('Anotado — no la vamos a mostrar como urgente por un tiempo.');
  renderFamiliasEnRiesgo();
}
let famIncidentesCount = {};
async function cargarConteoIncidentesFamilias(){
  const { data } = await sb.from('incidentes').select('familia_id,familia_nombre').not('familia_nombre','is',null);
  famIncidentesCount = {};
  (data||[]).forEach(i=>{
    const key = normaliza(i.familia_nombre||'');
    if(!key) return;
    famIncidentesCount[key] = (famIncidentesCount[key]||0) + 1;
  });
}
function renderFamiliasList(){
  const cont = document.getElementById('familiaslist');
  if(!cont) return;
  if(!familiasItems.length){ cont.innerHTML='<div class="empty">Todavía no hay familias cargadas.</div>'; return; }
  const q = normaliza(famBusqueda);
  const filtradas = familiasItems.filter(f=>{
    const matchNombre = !q || normaliza(f.nombre).includes(q);
    const matchZona = coincideFiltroZonas(f.zona, famFiltroZonas);
    return matchNombre && matchZona;
  });
  const countMsg = `<div class="helper" style="margin:0 0 8px;">${filtradas.length} de ${familiasItems.length} familias</div>`;
  if(!filtradas.length){ cont.innerHTML = countMsg + '<div class="empty">Ninguna familia coincide con la búsqueda.</div>'; return; }
  cont.innerHTML = countMsg + '<div class="person-list">' + filtradas.map(f=>{
    const margenFam = (Number(f.cobro_hora)||0) - (Number(f.pago_hora)||0);
    const tieneTarifa = f.cobro_hora || f.pago_hora;
    const badge = tieneTarifa
      ? `<span class="badge ${margenFam>=0?'good':'bad'}" style="font-size:10px;padding:2px 8px;">$${f.cobro_hora||0}/h</span>`
      : `<span class="badge warn" style="font-size:10px;padding:2px 8px;">Sin tarifa</span>`;
    return `
    <div class="person-row">
      <div class="av">${escaparHtml((f.nombre||'?').charAt(0).toUpperCase())}</div>
      <div class="info">
        <div class="name">${escaparHtml(f.nombre)}</div>
        <div class="meta">${escaparHtml(f.zona||'zona s/d')}${escaparHtml((() => { const r = resumenHijosFamilia(f.hijos); return r ? ' · niños: '+r : (f.ninos ? ' · niños: '+f.ninos : ''); })())}</div>
      </div>
      <div class="badge-slot">
        ${badge}
        ${famIncidentesCount[normaliza(f.nombre)] ? `<span class="badge bad" style="font-size:10px;padding:2px 8px;">${famIncidentesCount[normaliza(f.nombre)]} incidente${famIncidentesCount[normaliza(f.nombre)]===1?'':'s'}</span>` : ''}
      </div>
      <div class="rowbtns">
        <button class="smallbtn" onclick="verFamilia(${argJs(f.id)})">Ver ficha</button>
        <button class="smallbtn" onclick="editarFamilia(${argJs(f.id)})">Editar</button>
        <button class="pcard-delete" style="position:static;box-shadow:none;" onclick="conGuardado(this, ()=>eliminarFamilia(${argJs(f.id)}))" title="Eliminar familia" aria-label="Eliminar familia">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join('') + '</div>';
}
function verFamilia(id){
  const f = familiasItems.find(x=>x.id===id);
  if(!f) return;
  famDetalleAbierta = id;
  const margenFam = (Number(f.cobro_hora)||0) - (Number(f.pago_hora)||0);
  const precioHtml = (f.cobro_hora||f.pago_hora) ? `<div class="precio-fam"><span>Cobro: <b>$${f.cobro_hora||0}/h</b></span><span>Pago: <b>$${f.pago_hora||0}/h</b></span><span class="${margenFam>=0?'margenpos':'margenneg'}">Margen: <b>$${margenFam}/h</b></span></div>` : '<div class="helper" style="color:var(--clay-text);">Sin precio cargado — editá la familia para ponerlo.</div>';
  // Fijos vigentes arriba; los que ya terminaron (cambio de niñera, fin del fijo) quedan
  // abajo como historial, editables por si la fecha estaba mal cargada.
  const hoyFam = todayISO();
  const filaAsig = a=>{
    const dias = (a.dias||[]).join(' ');
    const horario = a.hora_inicio ? `${a.hora_inicio.slice(0,5)}${a.hora_fin?'–'+a.hora_fin.slice(0,5):''}` : '—';
    return `<tr><td>${escaparHtml(a.ninera_nombre)}</td><td>${tipoAsignacion(a)==='traslado'?'Traslado':'Sitting'} · ${dias||'—'} · ${horario}<div class="helper" style="margin:2px 0 0;">${textoVigencia(a)}</div></td><td><div class="tablecell-btns"><button class="smallbtn" onclick="abrirModalVigenciaAsignacion(${argJs(a.id)})">Vigencia</button>${asignacionTerminada(a, hoyFam) ? '' : `<button class="smallbtn danger" onclick="abrirModalTerminarFijo(${argJs(a.id)})">Terminar</button>`}</div></td></tr>`;
  };
  const ordenAsig = (x,y)=>(y.vigente_desde||'').localeCompare(x.vigente_desde||'');
  const asigRows = (f.asignaciones||[]).filter(a=>!asignacionTerminada(a, hoyFam)).sort(ordenAsig).map(filaAsig).join('');
  const asigTerminadas = (f.asignaciones||[]).filter(a=>asignacionTerminada(a, hoyFam)).sort(ordenAsig);
  const historialFam = famHistorialPorFamilia[normaliza(f.nombre)] || {};
  const historialNombres = Object.keys(historialFam);
  const historialHtml = historialNombres.length ? `
    <div style="margin-top:14px;">
      <div class="card-section-title">Niñeras que trabajaron con esta familia</div>
      ${historialNombres.map(nn=>{
        const cant = historialFam[nn];
        const res = famResenaPorNinera[normaliza(nn)];
        const promedio = res ? (res.suma/res.cant).toFixed(1) : null;
        const colorProm = promedio===null ? 'var(--ink-soft)' : (Number(promedio)>=4 ? 'var(--good)' : Number(promedio)>=3 ? '#7A5A16' : 'var(--clay-text)');
        return `<div class="agendarow" style="border-bottom:1px solid var(--line);">
          <div>${escaparHtml(nn)} <span style="color:var(--ink-soft);font-size:12px;">· ${cant} ${cant===1?'sitting/traslado':'sittings/traslados'}</span></div>
          <div style="font-weight:600;color:${colorProm};">${promedio!==null ? '★ '+promedio+'/5 ('+res.cant+')' : 'Sin reseñas'}</div>
        </div>`;
      }).join('')}
    </div>` : '';
  abrirModal(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;padding-right:44px;">
      <h2 style="margin:0;">${escaparHtml(f.nombre)}</h2>
      <div style="display:flex;gap:6px;">
        <button class="smallbtn" onclick="abrirModalIncidente(${argJs({familia_id:f.id, familia_nombre:f.nombre})})">+ Registrar incidente</button>
        <button class="btn primary" style="padding:7px 14px;font-size:12.5px;" onclick="editarFamilia(${argJs(f.id)})">Editar</button>
      </div>
    </div>
    <div class="helper">${escaparHtml(f.zona||'zona s/d')} ${escaparHtml(f.telefono?'· '+f.telefono:'')}</div>
    ${precioHtml}
    ${f.frecuencia_cobro?`<div class="helper">Frecuencia de cobro: ${escaparHtml(f.frecuencia_cobro)}</div>`:''}
    ${f.direccion?`<div class="helper">Dirección: ${escaparHtml(f.direccion)}</div>`:''}
    ${textoHijosFamilia(f.hijos) ? `<div class="helper">Niños:<br>${textoHijosFamilia(f.hijos)}</div>` : (f.ninos ? `<div class="helper">Niños: ${escaparHtml(f.ninos)}</div>` : '')}
    ${f.cuenta_bancaria && f.cuenta_bancaria.length ? `<div class="helper">Cuenta: ${escaparHtml(textoCuentasBancarias(f.cuenta_bancaria))}</div>` : ''}
    ${f.notas?`<div class="helper">${escaparHtml(f.notas)}</div>`:''}
    ${historialHtml}
    <div id="fam-incidentes" style="margin-top:14px;"></div>
    <div class="card-section-title">Niñeras asignadas</div>
    <div class="tablewrap"><table class="asigtable"><thead><tr><th>Niñera asignada</th><th>Días y horario</th><th></th></tr></thead>
      <tbody>${asigRows || '<tr><td colspan="3" style="color:var(--ink-soft);">Sin niñeras asignadas todavía.</td></tr>'}</tbody></table></div>
    ${asigTerminadas.length ? `<div class="helper" style="margin:10px 0 4px;">Fijos que ya terminaron</div>
    <div class="tablewrap"><table class="asigtable"><tbody>${asigTerminadas.map(filaAsig).join('')}</tbody></table></div>` : ''}
    <datalist id="ninieras-dl">${(ninierasItems||[]).map(n=>`<option value="${escaparHtml(n.nombre)}">`).join('')}</datalist>
    <div class="grid3" style="margin-top:14px;">
      <div class="field"><label>Niñera</label><input type="text" list="ninieras-dl" id="asig-nombre-${f.id}"></div>
      <div class="field"><label>Hora inicio</label>${selectHora('asig-horaini-'+f.id)}</div>
      <div class="field"><label>Hora fin</label>${selectHora('asig-horafin-'+f.id)}</div>
    </div>
    <div class="grid3">
      <div class="field"><label>Tipo</label><select id="asig-tipo-${f.id}"><option value="sitting">Sitting</option><option value="traslado">Traslado</option></select></div>
      <div class="field"><label>Desde</label><input type="date" id="asig-desde-${f.id}" value="${hoyFam}"></div>
    </div>
    <div class="field"><label>Días</label>
      <div class="dayrow" id="asig-dias-${f.id}">
        ${['L','M','X','J','V','S','D'].map(d=>`<button type="button" class="daybtn" onclick="this.classList.toggle('selected')">${d}</button>`).join('')}
      </div>
    </div>
    <button class="smallbtn" onclick="conGuardado(this, ()=>addAsignacion(${argJs(f.id)}))">+ Asignar niñera</button>`);
  renderIncidentesEnFicha('fam-incidentes', 'familia', f.id, f.nombre);
}
function editarFamilia(id){
  const f = familiasItems.find(x=>x.id===id);
  if(!f) return;
  registrarRenderizadorZona('ed-fam', ()=>editarFamilia(id));
  abrirModal(`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      <div style="width:46px;height:46px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-family:'Baloo 2',sans-serif;font-weight:600;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${escaparHtml((f.nombre||'?').charAt(0).toUpperCase())}</div>
      <h2 style="margin:0;">Editar a ${escaparHtml(f.nombre)}</h2>
    </div>
    <div class="grid2">
      <div class="field"><label>Nombre</label><input type="text" id="ed-fam-nombre" value="${escaparHtml(f.nombre)}"></div>
      <div class="field"><label>Teléfono</label><input type="tel" id="ed-fam-telefono" value="${escaparHtml(f.telefono)}"></div>
      <div class="field"><label>Cobro a familia ($/h)</label><input type="number" id="ed-fam-cobro" value="${f.cobro_hora??''}"></div>
      <div class="field"><label>Pago a niñera ($/h)</label><input type="number" id="ed-fam-pago" value="${f.pago_hora??''}"></div>
      <div class="field"><label>Dirección</label><input type="text" id="ed-fam-direccion" value="${escaparHtml(f.direccion)}"></div>
      <div class="field"><label>Frecuencia de cobro</label><select id="ed-fam-frecuencia">
        <option value="diario" ${f.frecuencia_cobro==='diario'?'selected':''}>Diario (puntual)</option>
        <option value="semanal" ${f.frecuencia_cobro==='semanal'?'selected':''}>Semanal</option>
        <option value="mensual" ${(f.frecuencia_cobro||'mensual')==='mensual'?'selected':''}>Mensual</option>
      </select></div>
    </div>
    ${htmlHijosFamilia('ed-fam', f.hijos)}
    ${htmlCuentasBancarias('ed-fam', f.cuenta_bancaria)}
    ${checklistZonas('ed-fam', f.zona)}
    <div class="field"><label>Notas</label><textarea id="ed-fam-notas">${escaparHtml(f.notas)}</textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarEdicionFamilia(${argJs(id)}))">Guardar</button>
    </div>`);
}
async function guardarEdicionFamilia(id){
  const cambios = {
    nombre: document.getElementById('ed-fam-nombre').value,
    zona: leerZonasChecklist('ed-fam'),
    telefono: document.getElementById('ed-fam-telefono').value,
    cobro_hora: document.getElementById('ed-fam-cobro').value||null,
    pago_hora: document.getElementById('ed-fam-pago').value||null,
    direccion: document.getElementById('ed-fam-direccion').value,
    cuenta_bancaria: leerCuentasBancarias('ed-fam'),
    frecuencia_cobro: document.getElementById('ed-fam-frecuencia').value,
    notas: document.getElementById('ed-fam-notas').value,
  };
  const { error } = await sb.from('familias').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  // Hijos: se reemplaza la lista entera, porque el formulario siempre manda la lista completa.
  // Primero se cargan los nuevos y recién después se borran los de antes: si algo falla a
  // mitad de camino nunca se pierden los hijos (antes se borraba primero sin mirar el error).
  const hijos = leerHijosFamilia('ed-fam');
  const { data: previos, error: e0 } = await sb.from('hijos_familia').select('id').eq('familia_id', id);
  let errHijos = e0;
  if(!errHijos && hijos.length){
    const { error: e2 } = await sb.from('hijos_familia').insert(hijos.map((h,i)=>({...h, familia_id:id, orden:i})));
    errHijos = e2;
  }
  if(!errHijos && (previos||[]).length){
    const { error: e3 } = await sb.from('hijos_familia').delete().in('id', previos.map(h=>h.id));
    errHijos = e3;
  }
  cerrarModal();
  // Fijos automáticos: con tarifa o nombre nuevos se recalculan los previstos que nadie tocó.
  await sincronizarPrevistosFijos();
  if(errHijos) toast('Se guardó lo demás, pero no los hijos: '+errHijos.message, 'bad');
  else toast('Cambios guardados.');
  const scrollF1 = guardarScrollMainarea();
  await cargarFamilias();
  restaurarScrollMainarea(scrollF1);
}
async function addAsignacion(famId){
  const nombre = document.getElementById('asig-nombre-'+famId).value.trim();
  if(!nombre){ toast('Falta el nombre de la niñera.','bad'); return; }
  const dias = Array.from(document.querySelectorAll(`#asig-dias-${famId} .daybtn.selected`)).map(b=>b.textContent);
  // Mismos controles que al crear un fijo desde Sittings o la Agenda (05/10/2026): antes se
  // podía guardar sin días (un fijo que nunca aparece), con la hora de fin antes que la de
  // inicio, y sin el aviso de que la niñera ya tiene otro fijo en ese horario.
  if(!dias.length){ toast('Elegí al menos un día.','bad'); return; }
  const hi = leerHora('asig-horaini-'+famId), hf = leerHora('asig-horafin-'+famId);
  if(hi && hf && hf <= hi){ toast('La hora de fin tiene que ser después de la de inicio.','bad'); return; }
  const choque = await chequearFijoNuevoContraTodo(nombre, dias, hi||null, hf||null);
  if(!(await avisarSiDobleReserva(choque, nombre, 'Asignar igual'))) return;
  const ninera = (ninierasItems||[]).find(n=>normaliza(n.nombre)===normaliza(nombre));
  const asig = { familia_id:famId, ninera_nombre:nombre, ninera_id: ninera?.id || null, dias,
    hora_inicio:leerHora('asig-horaini-'+famId)||null, hora_fin:leerHora('asig-horafin-'+famId)||null,
    tipo: document.getElementById('asig-tipo-'+famId)?.value || 'sitting',
    vigente_desde: document.getElementById('asig-desde-'+famId)?.value || todayISO() };
  const { error } = await escribirAsignacion(p=>sb.from('asignaciones').insert(p), asig);
  if(error){ toast('No se pudo agregar: '+error.message,'bad'); return; }
  await sincronizarPrevistosFijos();
  toast('Niñera asignada.');
  cargarFamilias();
}
async function eliminarFamilia(id){
  if(!(await confirmarAccion('¿Eliminar esta familia? No se puede deshacer.'))) return;
  const { error } = await sb.from('familias').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message,'bad'); return; }
  if(famDetalleAbierta===id){ famDetalleAbierta=null; cerrarModal(); }
  const scrollF2 = guardarScrollMainarea();
  await cargarFamilias();
  restaurarScrollMainarea(scrollF2);
}

