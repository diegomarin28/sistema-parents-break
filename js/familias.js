/* ================= FAMILIAS ================= */
let familiasItems = [];
let famBusqueda = '';
let famZonaFiltro = '';
let famDetalleAbierta = null;
function renderFamilias(body){
  body.innerHTML = `
    <div id="fam-riesgo-wrap"></div>
    <div class="card" style="padding:14px 18px;"><div class="grid3">
      <div class="field" style="margin:0;"><label>Buscar familia</label><input type="text" id="fam-buscar" placeholder="Nombre..." value="${famBusqueda}" oninput="famBusqueda=this.value;renderFamiliasList();"></div>
      <div class="field" style="margin:0;"><label>Zona</label><select id="fam-zonafiltro" onchange="famZonaFiltro=this.value;renderFamiliasList();"></select></div>
      <div class="field" style="margin:0;"><button class="btn primary" style="width:100%;margin-top:22px;" onclick="abrirModalNuevaFamilia()">+ Agregar familia</button></div>
    </div></div>
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
      <div class="field"><label>Zona</label><input type="text" id="fam-zona"></div>
      <div class="field"><label>Teléfono</label><input type="tel" id="fam-telefono"></div>
    </div>
    <div class="grid3">
      <div class="field"><label>Cobro a familia ($/h)</label><input type="number" id="fam-cobro"></div>
      <div class="field"><label>Pago a niñera ($/h)</label><input type="number" id="fam-pago"></div>
      <div class="field"><label>Niños (edades)</label><input type="text" id="fam-ninos" placeholder="Ej: 3 y 6 años"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Dirección</label><input type="text" id="fam-direccion" placeholder="Para sugerir origen en traslados"></div>
      <div class="field"><label>Cuenta bancaria</label><input type="text" id="fam-cuenta"></div>
    </div>
    <div class="field"><label>Notas</label><textarea id="fam-notas"></textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="addFamilia()">Agregar familia</button>
    </div>`);
}
async function addFamilia(){
  const nombre = document.getElementById('fam-nombre').value.trim();
  if(!nombre){ toast('Falta el nombre de la familia.','bad'); return; }
  if(!(await confirmarNombreNuevo(nombre, familiasItems, 'familia'))) return;
  const fam = { nombre, zona:document.getElementById('fam-zona').value, telefono:document.getElementById('fam-telefono').value,
    cobro_hora:document.getElementById('fam-cobro').value||null, pago_hora:document.getElementById('fam-pago').value||null,
    ninos:document.getElementById('fam-ninos').value, direccion:document.getElementById('fam-direccion').value,
    cuenta_bancaria:document.getElementById('fam-cuenta').value, notas:document.getElementById('fam-notas').value };
  const { error } = await sb.from('familias').insert(fam);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
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
  const cont = document.getElementById('familiaslist');
  if(!cont) return; // se puede llamar desde otra pantalla (ej. al quitar una asignación fija desde Agenda) — sin esto, rompía ahí.
  cont.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const necesitaNinieras = !ninierasItems.length;
  const [{data:familias, error}, {data:asignaciones}, {data:sittings}, {data:resenas}, ninierasRes] = await Promise.all([
    sb.from('familias').select('*').order('nombre'),
    sb.from('asignaciones').select('*'),
    sb.from('sittings_traslados').select('familia_nombre,ninera_nombre,fecha'),
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
  familiasItems = familias.map(f => ({...f, asignaciones: (asignaciones||[]).filter(a=>a.familia_id===f.id)}));
  // llenar el filtro de zonas agrupando variantes de mayúsculas/tildes/espacios como la misma zona
  const zonaSel = document.getElementById('fam-zonafiltro');
  if(zonaSel){
    const zonaMap = new Map();
    familiasItems.forEach(f=>{
      zonasDe(f.zona).forEach(raw=>{
        const key = normaliza(raw);
        if(!zonaMap.has(key)) zonaMap.set(key, raw);
      });
    });
    const zonas = [...zonaMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]));
    zonaSel.innerHTML = `<option value="">Todas las zonas</option>` + zonas.map(([key,label])=>`<option value="${key}" ${famZonaFiltro===key?'selected':''}>${label}</option>`).join('');
  }
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
  return `¡Hola ${primerNombre}! Somos de Parents Break 💛 Hace un tiempo que no coordinamos ningún sitting con ustedes y queríamos saber cómo están. Si necesitan una niñera o un traslado, contanos y lo vemos. Como agradecimiento por seguir confiando en nosotras, tenemos un 5% de descuento para el próximo servicio. ¡Esperamos su mensaje!`;
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
            <div style="font-weight:600;">${f.nombre}</div>
            <div class="helper" style="margin:2px 0 8px;">Hace ${semanas} semana${semanas===1?'':'s'} sin sittings</div>
            <textarea readonly style="width:100%;min-height:70px;font-size:12.5px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;" id="fam-riesgo-msj-${f.id}">${mensajeRiesgoPara(f)}</textarea>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:150px;">
            ${f.telefono
              ? `<button class="btn primary" style="padding:6px 10px;font-size:12.5px;" onclick="enviarWhatsappRiesgo('${f.id}')">Enviar por WhatsApp</button>`
              : `<div class="helper" style="margin:0;color:var(--clay-text);">Sin teléfono cargado</div>`}
            <button class="smallbtn" onclick="copiarMensajeRiesgo('${f.id}')">Copiar mensaje</button>
            <button class="smallbtn" onclick="marcarContactadaRiesgo('${f.id}')">Ya la contacté</button>
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
function renderFamiliasList(){
  const cont = document.getElementById('familiaslist');
  if(!cont) return;
  if(!familiasItems.length){ cont.innerHTML='<div class="empty">Todavía no hay familias cargadas.</div>'; return; }
  const q = normaliza(famBusqueda);
  const filtradas = familiasItems.filter(f=>{
    const matchNombre = !q || normaliza(f.nombre).includes(q);
    const matchZona = !famZonaFiltro || zonasDe(f.zona).some(z=>normaliza(z)===famZonaFiltro);
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
      <div class="av">${(f.nombre||'?').charAt(0).toUpperCase()}</div>
      <div class="info">
        <div class="name">${f.nombre}</div>
        <div class="meta">${f.zona||'zona s/d'}${f.ninos?' · niños: '+f.ninos:''}</div>
      </div>
      <div class="badge-slot">${badge}</div>
      <div class="rowbtns">
        <button class="smallbtn" onclick="verFamilia('${f.id}')">Ver ficha</button>
        <button class="smallbtn" onclick="editarFamilia('${f.id}')">Editar</button>
        <button class="pcard-delete" style="position:static;box-shadow:none;" onclick="eliminarFamilia('${f.id}')" title="Eliminar familia" aria-label="Eliminar familia">${ICONS.trash}</button>
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
  const asigRows = (f.asignaciones||[]).map(a=>{
    const dias = (a.dias||[]).join(' ');
    const horario = a.hora_inicio ? `${a.hora_inicio.slice(0,5)}${a.hora_fin?'–'+a.hora_fin.slice(0,5):''}` : '—';
    return `<tr><td>${a.ninera_nombre}</td><td>${dias||'—'} · ${horario}</td><td><button class="smallbtn danger" onclick="quitarAsignacion('${a.id}')">Quitar</button></td></tr>`;
  }).join('');
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
          <div>${nn} <span style="color:var(--ink-soft);font-size:12px;">· ${cant} ${cant===1?'sitting/traslado':'sittings/traslados'}</span></div>
          <div style="font-weight:600;color:${colorProm};">${promedio!==null ? '★ '+promedio+'/5 ('+res.cant+')' : 'Sin reseñas'}</div>
        </div>`;
      }).join('')}
    </div>` : '';
  abrirModal(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;padding-right:30px;">
      <h2 style="margin:0;">${f.nombre}</h2>
      <button class="btn primary" style="padding:7px 14px;font-size:12.5px;" onclick="editarFamilia('${f.id}')">Editar</button>
    </div>
    <div class="helper">${f.zona||'zona s/d'} ${f.ninos?'· niños: '+f.ninos:''} ${f.telefono?'· '+f.telefono:''}</div>
    ${precioHtml}
    ${f.direccion?`<div class="helper">Dirección: ${f.direccion}</div>`:''}
    ${f.cuenta_bancaria?`<div class="helper">Cuenta: ${f.cuenta_bancaria}</div>`:''}
    ${f.notas?`<div class="helper">${f.notas}</div>`:''}
    ${historialHtml}
    <div class="card-section-title">Niñeras asignadas</div>
    <div class="tablewrap"><table class="asigtable"><thead><tr><th>Niñera asignada</th><th>Días y horario</th><th></th></tr></thead>
      <tbody>${asigRows || '<tr><td colspan="3" style="color:var(--ink-soft);">Sin niñeras asignadas todavía.</td></tr>'}</tbody></table></div>
    <datalist id="ninieras-dl">${(ninierasItems||[]).map(n=>`<option value="${n.nombre}">`).join('')}</datalist>
    <div class="grid3" style="margin-top:14px;">
      <div class="field"><label>Niñera</label><input type="text" list="ninieras-dl" id="asig-nombre-${f.id}"></div>
      <div class="field"><label>Hora inicio</label>${selectHora('asig-horaini-'+f.id)}</div>
      <div class="field"><label>Hora fin</label>${selectHora('asig-horafin-'+f.id)}</div>
    </div>
    <div class="field"><label>Días</label>
      <div class="dayrow" id="asig-dias-${f.id}">
        ${['L','M','X','J','V','S','D'].map(d=>`<button type="button" class="daybtn" onclick="this.classList.toggle('selected')">${d}</button>`).join('')}
      </div>
    </div>
    <button class="smallbtn" onclick="addAsignacion('${f.id}')">+ Asignar niñera</button>`);
}
function editarFamilia(id){
  const f = familiasItems.find(x=>x.id===id);
  if(!f) return;
  abrirModal(`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      <div style="width:46px;height:46px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-family:'Baloo 2',sans-serif;font-weight:600;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${(f.nombre||'?').charAt(0).toUpperCase()}</div>
      <h2 style="margin:0;">Editar a ${f.nombre}</h2>
    </div>
    <div class="grid2">
      <div class="field"><label>Nombre</label><input type="text" id="ed-fam-nombre" value="${f.nombre||''}"></div>
      <div class="field"><label>Zona</label><input type="text" id="ed-fam-zona" value="${f.zona||''}"></div>
      <div class="field"><label>Teléfono</label><input type="tel" id="ed-fam-telefono" value="${f.telefono||''}"></div>
      <div class="field"><label>Niños (edades)</label><input type="text" id="ed-fam-ninos" value="${f.ninos||''}"></div>
      <div class="field"><label>Cobro a familia ($/h)</label><input type="number" id="ed-fam-cobro" value="${f.cobro_hora??''}"></div>
      <div class="field"><label>Pago a niñera ($/h)</label><input type="number" id="ed-fam-pago" value="${f.pago_hora??''}"></div>
      <div class="field"><label>Dirección</label><input type="text" id="ed-fam-direccion" value="${f.direccion||''}"></div>
      <div class="field"><label>Cuenta bancaria</label><input type="text" id="ed-fam-cuenta" value="${f.cuenta_bancaria||''}"></div>
      <div class="field"><label>Frecuencia de cobro</label><select id="ed-fam-frecuencia">
        <option value="diario" ${f.frecuencia_cobro==='diario'?'selected':''}>Diario (puntual)</option>
        <option value="semanal" ${f.frecuencia_cobro==='semanal'?'selected':''}>Semanal</option>
        <option value="mensual" ${(f.frecuencia_cobro||'mensual')==='mensual'?'selected':''}>Mensual</option>
      </select></div>
    </div>
    <div class="field"><label>Notas</label><textarea id="ed-fam-notas">${f.notas||''}</textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="guardarEdicionFamilia('${id}')">Guardar</button>
    </div>`);
}
async function guardarEdicionFamilia(id){
  const cambios = {
    nombre: document.getElementById('ed-fam-nombre').value,
    zona: document.getElementById('ed-fam-zona').value,
    telefono: document.getElementById('ed-fam-telefono').value,
    cobro_hora: document.getElementById('ed-fam-cobro').value||null,
    pago_hora: document.getElementById('ed-fam-pago').value||null,
    ninos: document.getElementById('ed-fam-ninos').value,
    direccion: document.getElementById('ed-fam-direccion').value,
    cuenta_bancaria: document.getElementById('ed-fam-cuenta').value,
    frecuencia_cobro: document.getElementById('ed-fam-frecuencia').value,
    notas: document.getElementById('ed-fam-notas').value,
  };
  const { error } = await sb.from('familias').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Cambios guardados.');
  const scrollF1 = guardarScrollMainarea();
  await cargarFamilias();
  restaurarScrollMainarea(scrollF1);
}
async function addAsignacion(famId){
  const nombre = document.getElementById('asig-nombre-'+famId).value.trim();
  if(!nombre){ toast('Falta el nombre de la niñera.','bad'); return; }
  const dias = Array.from(document.querySelectorAll(`#asig-dias-${famId} .daybtn.selected`)).map(b=>b.textContent);
  const asig = { familia_id:famId, ninera_nombre:nombre, dias,
    hora_inicio:leerHora('asig-horaini-'+famId)||null, hora_fin:leerHora('asig-horafin-'+famId)||null };
  const { error } = await sb.from('asignaciones').insert(asig);
  if(error){ toast('No se pudo agregar: '+error.message,'bad'); return; }
  toast('Niñera asignada.');
  cargarFamilias();
}
async function quitarAsignacion(id){
  const { error } = await sb.from('asignaciones').delete().eq('id', id);
  if(error){ toast('No se pudo quitar: '+error.message,'bad'); return; }
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

