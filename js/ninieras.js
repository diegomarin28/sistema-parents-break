/* ---- Niñeras ---- */
let ninierasItems = [];
let sitHistResenas = {};
function renderNinieras(body){
  body.innerHTML = `
    <div id="nin-utilizacion-wrap"></div>
    <div class="card" style="padding:14px 18px;"><div class="grid3">
      <div class="field" style="margin:0;"><label>Buscar (nombre, universidad, idioma...)</label><input type="text" id="filt-nombre" placeholder="Escribí para filtrar..." oninput="filtrarNinieras()"></div>
      <div class="field" style="margin:0;"><label>Zona</label><select id="filt-zona" onchange="filtrarNinieras()"><option value="">Todas las zonas</option></select></div>
      <div class="field" style="margin:0;"><label>Tipo</label><select id="filt-tipo" onchange="filtrarNinieras()"><option value="">Todas</option><option>Niñera</option><option>Traslados</option><option>Ambas</option></select></div>
    </div></div>
    <div id="ninierasgrid"></div>
  `;
  cargarNinieras();
}
async function cargarNinieras(){
  const { data, error } = await sb.from('ninieras').select('*, candidatas(*)').eq('activa', true).order('nombre');
  if(error){ const g = document.getElementById('ninierasgrid'); if(g) g.innerHTML = errBox(error); return; }
  ninierasItems = data;
  await cargarUtilizacionNinieras();
  await cargarConteoIncidentesNinieras();
  // llenar desplegable de zonas: una niñera puede cubrir varias zonas separadas por "/" —
  // cada zona individual entra como su propia opción, agrupando variantes de mayúsculas/tildes
  const zonaSel = document.getElementById('filt-zona');
  if(zonaSel){
    const zonaMap = new Map();
    ninierasItems.forEach(n=>{
      zonasDe(n.zona).forEach(raw=>{
        const key = normaliza(raw);
        if(!zonaMap.has(key)) zonaMap.set(key, raw);
      });
    });
    const zonas = [...zonaMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]));
    zonaSel.innerHTML = `<option value="">Todas las zonas</option>` + zonas.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  }
  filtrarNinieras();
}
const NIN_UTIL_DIAS = 30;
let ninUtilChart = null;
let ninUtilAbierto = false; // arranca cerrado — con 77 niñeras sin actividad era un cartel inmenso
let ninUtilPorNinera = {};
let ninUtilUltimaActividad = {};
/* E2 · Utilización de niñeras: cuántos sittings/traslados hizo cada una en
   los últimos 30 días, y quiénes no tuvieron ninguno (con la fecha de su
   último sitting, alguna vez) — para decidir a quién darle más changas,
   a quién no sobrecargar, y a quién dar de baja si ya no trabaja más con
   el equipo. No bloquea el resto de la pantalla si falla — es secundario. */
async function cargarUtilizacionNinieras(){
  const { data, error } = await sb.from('sittings_traslados').select('ninera_nombre,fecha');
  if(error || !document.getElementById('nin-utilizacion-wrap')) return;
  const desde30 = new Date(Date.now() - NIN_UTIL_DIAS*24*3600*1000).toISOString().slice(0,10);
  const porNinera = {};
  const ultimaActividad = {};
  (data||[]).forEach(r=>{
    const k = normaliza(r.ninera_nombre||'');
    if(!k || !r.fecha) return;
    if(r.fecha >= desde30){
      if(!porNinera[k]) porNinera[k] = {nombre:r.ninera_nombre, cant:0};
      porNinera[k].cant += 1;
    }
    if(!ultimaActividad[k] || r.fecha > ultimaActividad[k]) ultimaActividad[k] = r.fecha;
  });
  ninUtilPorNinera = porNinera;
  ninUtilUltimaActividad = ultimaActividad;
  renderUtilizacionNinieras();
}
function toggleNinUtil(){ ninUtilAbierto = !ninUtilAbierto; renderUtilizacionNinieras(); }
function renderUtilizacionNinieras(){
  const wrap = document.getElementById('nin-utilizacion-wrap');
  if(!wrap) return;
  const porNinera = ninUtilPorNinera;
  const top = Object.values(porNinera).sort((a,b)=>b.cant-a.cant).slice(0, 8);
  const sinActividad = ninierasItems
    .filter(n => !porNinera[normaliza(n.nombre)])
    .sort((a,b)=>{
      const ua = ninUtilUltimaActividad[normaliza(a.nombre)] || ''; // nunca tuvo sitting = más atrasada de todas
      const ub = ninUtilUltimaActividad[normaliza(b.nombre)] || '';
      return ua.localeCompare(ub);
    });

  if(!top.length && !sinActividad.length){ wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div class="card" style="padding:14px 18px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;cursor:pointer;" onclick="toggleNinUtil()">
        <h2 style="margin:0;">Utilización — últimos ${NIN_UTIL_DIAS} días</h2>
        <div class="helper" style="margin:0;">${sinActividad.length} sin actividad · ${ninUtilAbierto?'tocá para cerrar ▲':'tocá para ver ▼'}</div>
      </div>
      ${ninUtilAbierto ? `
      ${top.length ? `<div style="height:220px;margin-top:12px;"><canvas id="ninUtilChart"></canvas></div>` : `<div class="empty">Sin sittings registrados en este período.</div>`}
      ${sinActividad.length ? `
        <div class="helper" style="margin:14px 0 6px;">Sin ningún sitting en ${NIN_UTIL_DIAS} días (${sinActividad.length}) — de la más atrasada a la más reciente:</div>
        <div style="display:flex;flex-direction:column;gap:2px;">
          ${sinActividad.map(n=>{
            const ultima = ninUtilUltimaActividad[normaliza(n.nombre)];
            const hace = ultima ? `Último sitting: ${new Date(ultima+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'})}` : 'Nunca tuvo un sitting registrado';
            return `
            <div class="agendarow" style="border-bottom:1px solid var(--line);padding:7px 0;align-items:center;flex-wrap:wrap;gap:6px;">
              <div style="flex:1;min-width:160px;">
                <div>${n.nombre}</div>
                <div class="helper" style="margin:0;">${hace}</div>
              </div>
              ${n.telefono
                ? `<button class="smallbtn" onclick="enviarWhatsappNinera('${n.id}')">Enviar por WhatsApp</button>`
                : `<span class="helper" style="margin:0;">Sin teléfono cargado</span>`}
              <button class="smallbtn" style="color:var(--bad);border-color:var(--bad);" onclick="eliminarNinera('${n.id}')">Eliminar niñera</button>
            </div>`;
          }).join('')}
        </div>` : ''}` : ''}
    </div>`;

  if(ninUtilAbierto && top.length){
    asegurarChart().then(()=>{
      const canvas = document.getElementById('ninUtilChart');
      if(!canvas || !window.Chart) return;
      if(ninUtilChart){ ninUtilChart.destroy(); ninUtilChart = null; }
      ninUtilChart = new Chart(canvas, {
        type:'bar',
        data:{ labels: top.map(x=>(x.nombre||'').split(' ')[0]), datasets:[{ label:'Sittings/traslados', data: top.map(x=>x.cant), backgroundColor:'#757CBB', borderRadius:6 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } } }
      });
    });
  }
}
/* Borrador — igual que el de familias, pendiente de revisión por Pau/Delfi. */
function mensajeUtilizacionPara(n){
  const primerNombre = (n.nombre||'').trim().split(' ')[0] || n.nombre;
  return `¡Hola ${primerNombre}! Somos de Parents Break 💛 Hace un tiempo que no te agendamos ningún sitting y queríamos saber cómo estás y si seguís con ganas de tomar changas. ¡Contanos!`;
}
function enviarWhatsappNinera(id){
  const n = ninierasItems.find(x=>x.id===id);
  if(!n) return;
  const tel = formatearTelefonoWhatsApp(n.telefono);
  if(!tel){ toast('Esta niñera no tiene teléfono cargado — agregalo en su ficha primero.', 'bad'); return; }
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensajeUtilizacionPara(n))}`, '_blank');
}
let ninIncidentesCount = {};
async function cargarConteoIncidentesNinieras(){
  const { data } = await sb.from('incidentes').select('ninera_id,ninera_nombre').not('ninera_nombre','is',null);
  ninIncidentesCount = {};
  (data||[]).forEach(i=>{
    const key = normaliza(i.ninera_nombre||'');
    if(!key) return;
    ninIncidentesCount[key] = (ninIncidentesCount[key]||0) + 1;
  });
}
function filtrarNinieras(){
  const grid = document.getElementById('ninierasgrid');
  if(!grid) return;
  const fn = normaliza(document.getElementById('filt-nombre')?.value||'');
  const fz = document.getElementById('filt-zona')?.value||'';
  const ft = document.getElementById('filt-tipo')?.value||'';
  const filtradas = ninierasItems.filter(n => {
    const cd = n.candidatas || {};
    const blob = normaliza([n.nombre, n.notas, cd.universidad, cd.idiomas, cd.experiencia].filter(Boolean).join(' '));
    const matchTexto = !fn || blob.includes(fn);
    const matchZona = !fz || zonasDe(n.zona).some(z=>normaliza(z)===fz);
    const matchTipo = !ft || (n.tipo||'Niñera')===ft;
    return matchTexto && matchZona && matchTipo;
  });
  const countMsg = `<div class="helper" style="margin:0 0 8px;">${filtradas.length} de ${ninierasItems.length} niñeras</div>`;
  if(!filtradas.length){ grid.innerHTML = countMsg + '<div class="empty">Ninguna niñera coincide con la búsqueda.</div>'; return; }
  grid.innerHTML = countMsg + '<div class="person-list">' + filtradas.map(n=>`
    <div class="person-row">
      <div class="av" ${n.foto?`style="cursor:zoom-in;" onclick="abrirLightboxFoto('${n.foto}', 'Foto de ${n.nombre}')"`:''}>${n.foto?`<img src="${n.foto}" alt="Foto de ${n.nombre}" onerror="this.parentElement.textContent='${(n.nombre||'?').charAt(0).toUpperCase()}'">`:(n.nombre||'?').charAt(0).toUpperCase()}</div>
      <div class="info">
        <div class="name">${n.nombre}</div>
        <div class="meta">${n.zona||'zona s/d'}${n.candidatas?.edad?' · '+n.candidatas.edad:''}${n.candidatas?.universidad?' · '+n.candidatas.universidad:''}</div>
      </div>
      <div class="badge-slot">
        <span class="badge brand" style="font-size:10px;padding:2px 8px;">${n.tipo||'Niñera'}</span>
        ${ninIncidentesCount[normaliza(n.nombre)] ? `<span class="badge bad" style="font-size:10px;padding:2px 8px;">${ninIncidentesCount[normaliza(n.nombre)]} incidente${ninIncidentesCount[normaliza(n.nombre)]===1?'':'s'}</span>` : ''}
      </div>
      <div class="rowbtns">
        <button class="smallbtn" onclick="verNinera('${n.id}')">Ver ficha</button>
        <button class="smallbtn" onclick="editarNinera('${n.id}')">Editar</button>
        <button class="smallbtn" onclick="generarMensajeCV('${n.id}')">CV</button>
        <button class="pcard-delete" style="position:static;box-shadow:none;" onclick="eliminarNinera('${n.id}')" title="Eliminar niñera" aria-label="Eliminar niñera">${ICONS.trash}</button>
      </div>
    </div>`).join('') + '</div>';
}
// Sección "Datos de carsitting" reutilizable: busca por nombre (sin importar tildes/mayúsculas)
// contra TODOS los registros de carsitting_datos, sin depender de si ya está en Niñeras o
// todavía en Candidatas — así aparece sola apenas ella manda el form, esté donde esté.
async function cargarCarsittingSeccion(nombre, boxId, tipo, mail){
  const box = document.getElementById(boxId);
  if(!box) return;
  const { data } = await sb.from('carsitting_datos').select('*').order('created_at', {ascending:false});
  const nombreNorm = normaliza(nombre);
  const c = (data||[]).find(r=>normaliza(r.ninera_nombre)===nombreNorm);
  if(c){
    const campos = [
      ['Auto', [c.modelo_auto, c.color_auto].filter(Boolean).join(' · ')],
      ['Padrón / Matrícula', [c.padron, c.matricula].filter(Boolean).join(' · ')],
      ['Año de fabricación', c.anio_fabricacion],
      ['Asientos / Cinturones', [c.cantidad_asientos, c.cantidad_cinturones].filter(Boolean).join(' / ')],
      ['Seguro', [c.compania_seguro, c.tipo_seguro].filter(Boolean).join(' · ')],
      ['Licencia de conducir', [c.numero_licencia, c.anio_licencia?'obtenida '+c.anio_licencia:''].filter(Boolean).join(' · ')],
      ['Libreta de propiedad', c.libreta_propiedad],
      ['Cédula', c.cedula],
    ].filter(([,v])=>v);
    const fotos = [['Foto licencia', c.foto_licencia_url], ['Foto libreta', c.foto_libreta_url], ['Foto asientos', c.foto_asientos_url]].filter(([,v])=>v);
    box.innerHTML = `
      <div style="margin-top:14px;">
        <h2 class="card-section-title" style="margin-top:0;">Datos de carsitting</h2>
        <div class="fichadl">${campos.map(([l,v])=>`<div><b>${l}</b>${v}</div>`).join('')}</div>
        ${fotos.length?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${fotos.map(([l,v])=>`<a href="${v}" target="_blank" class="smallbtn">${l}</a>`).join('')}</div>`:''}
      </div>`;
    return;
  }
  // todavía no completó el form -- si hace traslados, ofrecemos mandarle el mail ya armado
  if(tipo==='Traslados' || tipo==='Ambas'){
    const primerNombre = (nombre||'').split(' ')[0];
    const asunto = encodeURIComponent('¡Bienvenida al equipo de traslados de Parents Break!');
    const cuerpo = encodeURIComponent(`Hola ${primerNombre},\n\n¡Qué alegría contar con vos para hacer traslados con Parents Break! Ya vimos en tu entrevista que tenés licencia de conducir y ganas de sumarte a esta parte del equipo.\n\nPara terminar de darte de alta como carsitter, necesitamos que completes este formulario con los datos de tu auto y algunos datos más:\n\nhttps://forms.gle/J4QXgNJQ8kXMsA4C6\n\nCon esto ya vas a quedar lista para que te empecemos a asignar traslados.\n\nCualquier duda, escribinos.\n\nUn abrazo,\nParents Break`);
    const href = `mailto:${mail||''}?subject=${asunto}&body=${cuerpo}`;
    const asuntoPersonal = encodeURIComponent('Parents Break');
    const cuerpoPersonal = encodeURIComponent(`Hola ${primerNombre},\n\n\n\nUn abrazo,\nParents Break`);
    const hrefPersonal = `mailto:${mail||''}?subject=${asuntoPersonal}&body=${cuerpoPersonal}`;
    box.innerHTML = `
      <div style="margin-top:14px;background:var(--accent-soft);border-radius:12px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-size:13px;color:var(--ink);">Hace traslados pero todavía no completó el form de carsitting.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a class="btn" style="padding:7px 14px;font-size:12.5px;text-decoration:none;" href="${hrefPersonal}">Mail personalizado</a>
          <a class="btn primary" style="padding:7px 14px;font-size:12.5px;text-decoration:none;" href="${href}">Enviar mail de carsitting</a>
        </div>
      </div>`;
  }
}
async function verNinera(id){
  const n = ninierasItems.find(x=>x.id===id);
  const cd = n.candidatas || {};
  const rows = FICHA_CAMPOS.filter(f=>cd[f.key]).map(f=>`<div><b>${f.label}</b>${cd[f.key]}</div>`).join('');
  const fotoHtml = n.foto ? `<img src="${n.foto}" alt="Foto de ${n.nombre}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:12px;cursor:zoom-in;" onclick="abrirLightboxFoto('${n.foto}', 'Foto de ${n.nombre}')" onerror="this.style.display='none'">` : '';
  abrirModal(`
    ${fotoHtml}
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;padding-right:44px;">
      <h2 style="margin:0 0 10px;">${n.nombre} ${resenaBadge ? resenaBadge(n.nombre) : ''}</h2>
      <button class="smallbtn" onclick='abrirModalIncidente(${JSON.stringify({ninera_id:n.id, ninera_nombre:n.nombre}).replace(/'/g,"&#39;")})'>+ Registrar incidente</button>
    </div>
    <div class="fichadl">${rows||'<div>Sin más datos.</div>'}<div><b>Zona</b>${n.zona||'—'}</div><div><b>Teléfono</b>${n.telefono||'—'}</div><div><b>Tipo</b>${n.tipo||'Niñera'}</div>${n.cv_url?`<div><b>CV</b><a href="${n.cv_url}" target="_blank" rel="noopener">Ver CV</a></div>`:''}<div><b>Cuenta bancaria</b>${n.cuenta_bancaria||'—'}</div><div><b>Notas</b>${n.notas||'—'}</div></div>
    <div id="vn-carsitting"></div>
    <div id="vn-juguetes"></div>
    <div id="vn-incidentes" style="margin-top:18px;"></div>
    <div style="margin-top:18px;">
      <h2 class="card-section-title" style="margin-top:0;">Sittings y traslados de ${n.nombre.split(' ')[0]}</h2>
      <div class="grid2">
        <div class="field"><label>Familia</label><select id="vn-familia" onchange="renderNineraHistorial('${n.id}')"><option value="">Todas</option></select></div>
        <div class="field"><label>Período</label><select id="vn-periodo" onchange="renderNineraHistorial('${n.id}')">
          <option value="0">Todo</option><option value="7">Últimos 7 días</option><option value="15">Últimos 15 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option>
        </select></div>
      </div>
      <div id="vn-historial"><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>
    </div>`);
  cargarCarsittingSeccion(n.nombre, 'vn-carsitting', n.tipo, cd.mail);
  cargarJuguetesDeNinera(n.nombre);
  renderIncidentesEnFicha('vn-incidentes', 'ninera', n.id, n.nombre);
  // cargar los sittings de esta niñera y sus reseñas (si no están cargadas ya globalmente) en paralelo
  const necesitaResenas = !Object.keys(sitHistResenas).length;
  const [{data}, resenasRes] = await Promise.all([
    sb.from('sittings_traslados').select('*').eq('ninera_nombre', n.nombre).order('fecha', {ascending:false}),
    necesitaResenas ? sb.from('resenas_ninieras').select('ninera_nombre,puntuacion') : Promise.resolve({data:null}),
  ]);
  nineraHistItems = data || [];
  if(necesitaResenas){
    (resenasRes.data||[]).forEach(r=>{
      if(r.puntuacion==null) return;
      const k = normaliza(r.ninera_nombre||'');
      if(!k) return;
      if(!sitHistResenas[k]) sitHistResenas[k] = {suma:0, cant:0};
      sitHistResenas[k].suma += Number(r.puntuacion);
      sitHistResenas[k].cant += 1;
    });
  }
  const sel = document.getElementById('vn-familia');
  if(sel){
    const famMap = new Map();
    nineraHistItems.forEach(s=>{
      const raw = (s.familia_nombre||'').trim();
      if(!raw) return;
      const key = normaliza(raw);
      if(!famMap.has(key)) famMap.set(key, raw);
    });
    const fams = [...famMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]));
    sel.innerHTML = `<option value="">Todas</option>` + fams.map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  }
  renderNineraHistorial(n.id);
}
let nineraHistItems = [];
function renderNineraHistorial(id){
  const cont = document.getElementById('vn-historial');
  if(!cont) return;
  const famF = document.getElementById('vn-familia')?.value||'';
  const periodo = parseInt(document.getElementById('vn-periodo')?.value||'0');
  let items = nineraHistItems.slice();
  if(famF) items = items.filter(s=>normaliza(s.familia_nombre)===famF);
  if(periodo>0){
    const limite = new Date(); limite.setDate(limite.getDate()-periodo);
    const limiteISO = limite.toISOString().slice(0,10);
    items = items.filter(s=>s.fecha && s.fecha >= limiteISO);
  }
  if(!items.length){ cont.innerHTML = '<div class="empty">No hay sittings registrados con estos filtros.</div>'; return; }
  const totalPago = items.reduce((s,r)=>s+(Number(r.pago_ninera)||0),0);
  cont.innerHTML = `
    <div class="helper" style="margin:8px 0;">${items.length} registro(s) · total pagado a la niñera: $${totalPago.toLocaleString('es-UY')}</div>
    <div class="tablewrap"><table class="asigtable"><thead><tr><th>Fecha</th><th>Familia</th><th>Cobro</th><th>Pago</th></tr></thead>
    <tbody>${items.map(r=>{
      const fechaFmt = r.fecha ? new Date(r.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'}) : '—';
      return `<tr><td>${fechaFmt}</td><td>${r.familia_nombre}</td><td>$${r.cobro_familia||0}</td><td>$${r.pago_ninera||0}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}
function editarNinera(id){
  const n = ninierasItems.find(x=>x.id===id);
  const tipos = ['Niñera','Traslados','Ambas'];
  ninEditCandidataCache = n.candidatas || {};
  abrirModal(`
    <h2 style="margin:0 0 12px;">Editar a ${n.nombre}</h2>
    <div style="margin-bottom:14px;">
      <div id="ed-foto-preview" style="width:100%;height:160px;border-radius:12px;background:var(--bg);border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:12px;color:var(--ink-soft);">
        ${n.foto?`<img src="${n.foto}" style="width:100%;height:100%;object-fit:cover;">`:'sin foto'}
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap;">
        <input type="file" accept="image/*" id="ed-foto-input" style="font-size:12px;" onchange="subirFotoNinera(this)">
        <button class="smallbtn" type="button" onclick="quitarFotoNinera()">Quitar foto</button>
      </div>
      <div id="ed-foto-status" class="helper" style="margin:2px 0 0;"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Nombre</label><input type="text" id="ed-nombre" value="${n.nombre||''}"></div>
      <div class="field"><label>Teléfono</label><input type="tel" id="ed-telefono" value="${n.telefono||''}"></div>
      <div class="field"><label>Tipo</label><select id="ed-tipo">${tipos.map(t=>`<option ${n.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Cuenta bancaria</label><input type="text" id="ed-cuenta" value="${n.cuenta_bancaria||''}"></div>
    </div>
    ${checklistZonas('ed', n.zona)}
    <div class="field"><label>Notas</label><textarea id="ed-notas">${n.notas||''}</textarea></div>
    <div id="ed-extra-fields"></div>
    <button class="btn" type="button" style="width:100%;margin-top:10px;" onclick="abrirSelectorCategoriaNinera()">+ Agregar categorías</button>
    <div class="confirmbtns" style="margin-top:18px;">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="guardarEdicionNinera('${id}')">Guardar</button>
    </div>`);
  ninFotoUrlPendiente = n.foto || null;
  // precargar los campos de categorías que ya tenían datos cargados —
  // si no se hace esto, al reabrir "Editar" los campos con dato quedaban
  // invisibles (solo se veían en "Ver ficha") y no había forma de corregirlos
  FICHA_CAMPOS.forEach(f=>{
    if(!['nombre','apellido','telefono','zona'].includes(f.key) && ninEditCandidataCache[f.key]){
      agregarCampoExtraNinera(f.key);
    }
  });
}
function quitarFotoNinera(){
  ninFotoUrlPendiente = null;
  document.getElementById('ed-foto-preview').innerHTML = 'sin foto';
  const input = document.getElementById('ed-foto-input');
  if(input) input.value = '';
}
let ninEditCandidataCache = {};
function abrirSelectorCategoriaNinera(){
  const yaAgregadas = new Set([...document.querySelectorAll('#ed-extra-fields [data-campo]')].map(el=>el.dataset.campo));
  const disponibles = FICHA_CAMPOS.filter(f=>!['nombre','apellido','telefono','zona'].includes(f.key) && !yaAgregadas.has(f.key));
  const seleccionadas = new Set();
  const overlay = document.createElement('div');
  overlay.className = 'confirmoverlay';
  overlay.innerHTML = `
    <div class="confirmbox" style="max-width:480px;max-height:78vh;overflow-y:auto;text-align:left;">
      <h2 style="margin:0 0 4px;">Agregar categorías</h2>
      <div class="helper" style="margin:0 0 14px;">Elegí las que quieras agregar a la ficha.</div>
      <div id="cat-picker-list" style="display:flex;flex-direction:column;gap:6px;"></div>
      <div class="confirmbtns" style="margin-top:16px;">
        <button class="btn ghost" id="cat-picker-cancelar">Cancelar</button>
        <button class="btn primary" id="cat-picker-confirmar">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('show'));
  const lista = overlay.querySelector('#cat-picker-list');
  if(!disponibles.length){
    lista.innerHTML = '<div class="helper" style="margin:0;">Ya agregaste todas las categorías disponibles.</div>';
  }
  disponibles.forEach(f=>{
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--line);border-radius:8px;cursor:pointer;';
    row.innerHTML = `<span style="font-size:13px;">${f.label}${ninEditCandidataCache[f.key]?' <span class="helper" style="margin:0;">(con dato)</span>':''}</span><span data-marca style="font-size:12px;font-weight:600;color:var(--accent);">+</span>`;
    row.addEventListener('click', ()=>{
      if(seleccionadas.has(f.key)){
        seleccionadas.delete(f.key);
        row.style.background = '';
        row.querySelector('[data-marca]').textContent = '+';
      } else {
        seleccionadas.add(f.key);
        row.style.background = 'var(--accent-soft)';
        row.querySelector('[data-marca]').textContent = 'agregada';
      }
    });
    lista.appendChild(row);
  });
  function cerrar(){ overlay.classList.remove('show'); setTimeout(()=>overlay.remove(), 180); }
  overlay.addEventListener('click', e=>{ if(e.target===overlay) cerrar(); });
  overlay.querySelector('#cat-picker-cancelar').addEventListener('click', cerrar);
  overlay.querySelector('#cat-picker-confirmar').addEventListener('click', ()=>{
    seleccionadas.forEach(key=>agregarCampoExtraNinera(key));
    cerrar();
  });
}
function agregarCampoExtraNinera(key){
  const campo = FICHA_CAMPOS.find(f=>f.key===key);
  if(!campo) return;
  const cont = document.getElementById('ed-extra-fields');
  if(cont.querySelector(`[data-campo="${key}"]`)) return; // ya está agregado
  const row = document.createElement('div');
  row.className = 'field';
  row.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <label style="margin:0;">${campo.label}</label>
      <button type="button" title="Quitar esta categoría" aria-label="Quitar esta categoría" onclick="this.closest('.field').remove()" style="width:20px;height:20px;border-radius:50%;border:none;background:var(--bad);color:#fff;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">−</button>
    </div>
    <textarea data-campo="${key}" rows="2">${ninEditCandidataCache[key]||''}</textarea>`;
  cont.appendChild(row);
}
async function subirFotoNinera(input){
  const file = input.files[0];
  if(!file) return;
  const status = document.getElementById('ed-foto-status');
  status.textContent = 'Subiendo...';
  const path = `ninera-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g,'_')}`;
  const { error } = await sb.storage.from('ninieras-fotos').upload(path, file, { upsert:true });
  if(error){ status.textContent = 'Error al subir: '+error.message; return; }
  const { data:pub } = sb.storage.from('ninieras-fotos').getPublicUrl(path);
  ninFotoUrlPendiente = pub.publicUrl;
  document.getElementById('ed-foto-preview').innerHTML = `<img src="${ninFotoUrlPendiente}" style="width:100%;height:100%;object-fit:cover;">`;
  status.textContent = 'Foto lista.';
}
let ninFotoUrlPendiente = null;
async function guardarEdicionNinera(id){
  const cambios = {
    nombre: document.getElementById('ed-nombre').value,
    telefono: document.getElementById('ed-telefono').value,
    zona: leerZonasChecklist('ed'),
    tipo: document.getElementById('ed-tipo').value,
    foto: ninFotoUrlPendiente,
    cuenta_bancaria: document.getElementById('ed-cuenta').value,
    notas: document.getElementById('ed-notas').value,
  };
  const { error } = await sb.from('ninieras').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  const extraInputs = [...document.querySelectorAll('#ed-extra-fields [data-campo]')];
  const extra = {};
  extraInputs.forEach(el=>{ extra[el.dataset.campo] = el.value; });
  // campos que tenían dato al abrir la ficha (ver ninEditCandidataCache) y que se
  // borraron con el botón "−" durante esta edición: hay que mandarlos como null
  // explícitamente, si no Supabase nunca los toca y el dato viejo queda pegado en la base
  const clavesActuales = new Set(extraInputs.map(el=>el.dataset.campo));
  FICHA_CAMPOS.forEach(f=>{
    if(!['nombre','apellido','telefono','zona'].includes(f.key) && ninEditCandidataCache[f.key] && !clavesActuales.has(f.key)){
      extra[f.key] = null;
    }
  });
  if(Object.keys(extra).length){
    const n = ninierasItems.find(x=>x.id===id);
    let candidataId = n?.candidata_id;
    if(!candidataId){
      const partes = (cambios.nombre||'').trim().split(' ');
      const { data:nuevaCand, error:e2 } = await sb.from('candidatas')
        .insert({ nombre: partes[0]||cambios.nombre, apellido: partes.slice(1).join(' ')||null, estado:'contratada', tipo: cambios.tipo, ...extra })
        .select().single();
      if(e2){ toast('Se guardó lo básico, pero no las categorías extra: '+e2.message, 'bad'); }
      else { await sb.from('ninieras').update({candidata_id: nuevaCand.id}).eq('id', id); }
    } else {
      const { error:e3 } = await sb.from('candidatas').update(extra).eq('id', candidataId);
      if(e3){ toast('Se guardó lo básico, pero no las categorías extra: '+e3.message, 'bad'); }
    }
  }
  cerrarModal();
  toast('Cambios guardados.');
  const scrollN1 = guardarScrollMainarea();
  await cargarNinieras();
  restaurarScrollMainarea(scrollN1);
}
async function eliminarNinera(id){
  if(!(await confirmarAccion('¿Eliminar esta niñera del sistema? No se puede deshacer.'))) return;
  const { error } = await sb.from('ninieras').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message,'bad'); return; }
  toast('Niñera eliminada.');
  const scrollN2 = guardarScrollMainarea();
  await cargarNinieras();
  restaurarScrollMainarea(scrollN2);
}

/* ---- Generar CV: arma el pedido para pegarle a Claude en el chat ---- */
const CV_CANVA_DESIGN_ID = 'DAHUzD60KqA';
const CV_CANVA_DESIGN_NOMBRE = 'PLANTILLA BASE v2 - CV niñeras';
function generarMensajeCV(id){
  const n = ninierasItems.find(x=>x.id===id);
  if(!n) return;
  const cd = n.candidatas || {};
  // Importante: NUNCA incluir teléfono, mail ni zona acá — esos son datos internos
  // (quedan en la ficha/directorio), no van en el CV que ve la familia.
  const datos = [`Nombre: ${n.nombre}`];
  if(n.foto) datos.push(`Foto (URL): ${n.foto}`);
  FICHA_CAMPOS.forEach(f=>{ if(cd[f.key]) datos.push(`${f.label}: ${cd[f.key]}`); });
  if(n.notas) datos.push(`Notas: ${n.notas}`);
  const mensaje = `Generame el CV de ${n.nombre} en Canva.

Antes de generarlo, leé en los Files de este Project el archivo "instrucciones_generar_cv_ninieras.md" y la imagen de ejemplo de un CV ya terminado — ahí está el paso a paso exacto y el formato visual a respetar (fondo salvia, nombre en violeta bold, foto circular, bullets coral).

Usá como plantilla base el diseño "${CV_CANVA_DESIGN_NOMBRE}" (ID: ${CV_CANVA_DESIGN_ID}) de mi cuenta de Canva conectada — copiá su única página a un diseño nuevo con Canva:copy-design (no edites la plantilla base en sí), reemplazá los placeholders por los datos de abajo respetando el formato ya definido (fondo salvia, nombre en violeta bold, foto circular, bullets coral), y mandámelo acá como PDF.

Datos de la niñera:
${datos.map(d=>'- '+d).join('\n')}`;
  abrirModal(`
    <h2 style="margin:0 0 10px;">Mensaje para pedirle el CV a Claude</h2>
    <div class="helper">Copiá esto (o descargalo) y pegalo en un chat con Claude dentro de este Project — tiene todo lo que necesita para generar el CV de ${n.nombre} y mandártelo en PDF. Para que funcione, el Project tiene que tener cargados el archivo de instrucciones y una imagen de ejemplo de CV en su sección de Files.</div>
    <textarea id="cv-msg-${id}" readonly style="min-height:220px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;">${mensaje}</textarea>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="descargarMensajeCV('${id}')">Descargar .txt</button>
      <button class="btn primary" onclick="copiarMensajeCV('${id}')">Copiar mensaje</button>
    </div>`);
}
async function copiarMensajeCV(id){
  const ta = document.getElementById('cv-msg-'+id);
  try{
    await navigator.clipboard.writeText(ta.value);
    toast('Mensaje copiado — pegalo en el chat con Claude.');
  }catch(e){
    ta.select();
    toast('No se pudo copiar automático — seleccioná el texto y copiá a mano.', 'bad');
  }
}
function descargarMensajeCV(id){
  const n = ninierasItems.find(x=>x.id===id);
  const ta = document.getElementById('cv-msg-'+id);
  if(!ta) return;
  const blob = new Blob([ta.value], {type:'text/plain;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = `pedido_cv_${(n?.nombre||'ninera').replace(/\s+/g,'_')}.txt`; a.click(); URL.revokeObjectURL(url);
}

