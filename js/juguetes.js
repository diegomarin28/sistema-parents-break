/* ================= JUGUETES ================= */
const TIPOS_JUGUETE_SUGERIDOS = ['Cartas','Memoria','Juego de mesa','Construcción','Muñecas','Juego simbólico','Pelota','Disfraces','Libros','Agua/pileta','Peluches','Otro'];
let juguetesItems = [];
let jugFotoUrlPendiente = null;
function renderJuguetes(body){
  body.innerHTML = `
    <div class="card" style="padding:14px 18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
        <div class="grid3" style="flex:1;">
          <div class="field" style="margin:0;"><label>Buscar (nombre, tipo, notas...)</label><input type="text" id="jug-filt-texto" placeholder="Escribí para filtrar..." oninput="filtrarJuguetes()"></div>
          <div class="field" style="margin:0;"><label>Niñera</label><select id="jug-filt-ninera" onchange="filtrarJuguetes()"><option value="">Todas</option></select></div>
          <div class="field" style="margin:0;"><label>Género</label><select id="jug-filt-genero" onchange="filtrarJuguetes()"><option value="">Todos</option><option value="unisex">Unisex</option><option value="ninas">Niñas</option><option value="ninos">Niños</option></select></div>
        </div>
        <button class="btn primary" onclick="abrirModalJuguete()">Agregar juguete</button>
      </div>
      <div class="field" style="margin:0;max-width:220px;"><label>Edad del chico/a</label><input type="number" id="jug-filt-edad" min="0" placeholder="ej. 4" oninput="filtrarJuguetes()"></div>
    </div>
    <div id="juguetesgrid"></div>
  `;
  cargarJuguetes();
}
async function cargarJuguetes(){
  const grid = document.getElementById('juguetesgrid');
  const [{data, error}, {data:nins}] = await Promise.all([
    sb.from('juguetes').select('*').order('nombre'),
    sb.from('ninieras').select('id,nombre').order('nombre'),
  ]);
  if(error){ grid.innerHTML = errBox(error); return; }
  juguetesItems = data||[];
  jugNinierasCache = nins||[];
  const selFiltro = document.getElementById('jug-filt-ninera');
  if(selFiltro){
    const nombres = [...new Set(juguetesItems.map(j=>j.ninera_nombre).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    selFiltro.innerHTML = `<option value="">Todas</option><option value="__sin__">Sin asignar</option>` + nombres.map(n=>`<option value="${n}">${n}</option>`).join('');
  }
  filtrarJuguetes();
}
function filtrarJuguetes(){
  const grid = document.getElementById('juguetesgrid');
  if(!grid) return;
  const ft = normaliza(document.getElementById('jug-filt-texto')?.value||'');
  const fn = document.getElementById('jug-filt-ninera')?.value||'';
  const fg = document.getElementById('jug-filt-genero')?.value||'';
  const fe = document.getElementById('jug-filt-edad')?.value;
  const edadNum = fe!=='' && fe!=null ? Number(fe) : null;
  const filtrados = juguetesItems.filter(j=>{
    const blob = normaliza([j.nombre, j.tipo, j.notas].filter(Boolean).join(' '));
    const matchTexto = !ft || blob.includes(ft);
    const matchNinera = !fn || (fn==='__sin__' ? !j.ninera_nombre : j.ninera_nombre===fn);
    const matchGenero = !fg || j.genero===fg;
    const matchEdad = edadNum==null || ((j.edad_desde==null || edadNum>=j.edad_desde) && (j.edad_hasta==null || edadNum<=j.edad_hasta));
    return matchTexto && matchNinera && matchGenero && matchEdad;
  });
  const countMsg = `<div class="helper" style="margin:8px 0;">${filtrados.length} de ${juguetesItems.length} juguetes</div>`;
  if(!filtrados.length){ grid.innerHTML = countMsg + '<div class="empty">Ningún juguete coincide con la búsqueda.</div>'; return; }
  const GENERO_LABEL = {unisex:'Unisex', ninas:'Niñas', ninos:'Niños'};
  grid.innerHTML = countMsg + '<div class="toy-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;">' + filtrados.map(j=>{
    const edadTxt = (j.edad_desde||j.edad_hasta) ? `${j.edad_desde??'0'}-${j.edad_hasta??'+'} años` : '';
    const meta = [j.tipo, edadTxt, GENERO_LABEL[j.genero]||'Unisex'].filter(Boolean).join(' · ');
    const estadoBadge = j.estado && j.estado!=='disponible' ? `<span class="badge" style="font-size:10px;background:var(--clay-soft);color:var(--clay-text);">${j.estado}</span>` : '';
    return `<div class="card" style="padding:0;overflow:hidden;">
      <div style="height:100px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;overflow:hidden;${j.foto_url?'cursor:zoom-in;':''}" ${j.foto_url?`onclick="abrirLightboxFoto('${j.foto_url}', 'Foto de ${j.nombre}')"`:''}>
        ${j.foto_url?`<img src="${j.foto_url}" alt="Foto de ${j.nombre}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`:`<span style="color:var(--accent);font-size:12px;">sin foto</span>`}
      </div>
      <div style="padding:10px 12px;">
        <div style="font-weight:600;font-size:13px;display:flex;justify-content:space-between;gap:6px;">${j.nombre} ${estadoBadge}</div>
        <div class="helper" style="margin:2px 0 0;">${meta||'—'}</div>
        <div style="font-size:12px;color:var(--accent);margin-top:6px;">${j.ninera_nombre?('Con '+j.ninera_nombre):'Sin asignar'}</div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="smallbtn" onclick="abrirModalJuguete('${j.id}')">Editar</button>
          <button class="pcard-delete" style="position:static;box-shadow:none;" onclick="eliminarJuguete('${j.id}')" title="Eliminar juguete" aria-label="Eliminar juguete">${ICONS.trash}</button>
        </div>
      </div>
    </div>`;
  }).join('') + '</div>';
}
let jugNinierasCache = [];
function abrirModalJuguete(id=null){
  const j = id ? juguetesItems.find(x=>x.id===id) : null;
  jugFotoUrlPendiente = j?.foto_url || null;
  const cuerpo = `
    <h2 style="margin:0 0 12px;">${j?'Editar juguete':'Agregar juguete'}</h2>
    <div style="margin-bottom:14px;">
      <div id="jug-foto-preview" style="width:100%;height:160px;border-radius:12px;background:var(--bg);border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:12px;color:var(--ink-soft);">
        ${jugFotoUrlPendiente?`<img src="${jugFotoUrlPendiente}" style="width:100%;height:100%;object-fit:cover;">`:'sin foto'}
      </div>
      <input type="file" accept="image/*" id="jug-foto-input" style="font-size:12px;margin-top:8px;width:100%;" onchange="subirFotoJuguete(this)">
      <div style="margin-top:6px;"><button class="smallbtn" type="button" onclick="quitarFotoJuguete()">Quitar foto</button></div>
      <div id="jug-foto-status" class="helper" style="margin:2px 0 0;"></div>
    </div>
    <div class="field"><label>Nombre</label><input type="text" id="jug-nombre" value="${j?.nombre||''}"></div>
    <div class="grid2">
      <div class="field" style="position:relative;"><label>Tipo</label>
        <input type="text" id="jug-tipo" autocomplete="off" value="${j?.tipo||''}" placeholder="cartas, memoria, construcción...">
        <div id="jug-tipo-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="field"><label>Género</label><select id="jug-genero">
        <option value="unisex" ${(!j||j.genero==='unisex')?'selected':''}>Unisex</option>
        <option value="ninas" ${j?.genero==='ninas'?'selected':''}>Niñas</option>
        <option value="ninos" ${j?.genero==='ninos'?'selected':''}>Niños</option>
      </select></div>
      <div class="field"><label>Edad desde</label><input type="number" id="jug-edad-desde" min="0" value="${j?.edad_desde??''}"></div>
      <div class="field"><label>Edad hasta</label><input type="number" id="jug-edad-hasta" min="0" value="${j?.edad_hasta??''}"></div>
      <div class="field" style="position:relative;"><label>Niñera que lo tiene</label>
        <input type="text" id="jug-ninera" autocomplete="off" value="${j?.ninera_nombre||''}" placeholder="Vacío = sin asignar / en depósito">
        <div id="jug-ninera-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="field"><label>Estado</label><select id="jug-estado">
        <option value="disponible" ${(!j||j.estado==='disponible')?'selected':''}>Disponible</option>
        <option value="perdido" ${j?.estado==='perdido'?'selected':''}>Perdido</option>
        <option value="roto" ${j?.estado==='roto'?'selected':''}>Roto</option>
      </select></div>
    </div>
    <div class="field"><label>Notas</label><textarea id="jug-notas" rows="2">${j?.notas||''}</textarea></div>
    <button class="btn primary" style="width:100%;margin-top:8px;" onclick="guardarJuguete(${j?`'${j.id}'`:'null'})">Guardar</button>
  `;
  abrirModal(cuerpo);
  setTimeout(()=>{
    attachAutocomplete('jug-ninera', 'jug-ninera-dropdown', ()=>jugNinierasCache, ()=>{});
    attachTipoJugueteAutocomplete();
  }, 20);
}
function attachTipoJugueteAutocomplete(){
  const input = document.getElementById('jug-tipo');
  const dd = document.getElementById('jug-tipo-dropdown');
  if(!input || !dd) return;
  function render(){
    const q = normaliza(input.value.trim());
    const matches = TIPOS_JUGUETE_SUGERIDOS.filter(t=>!q || normaliza(t).includes(q));
    dd.innerHTML = '';
    if(!matches.length){ dd.style.display = 'none'; return; }
    matches.forEach(t=>{
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = t;
      item.addEventListener('mousedown', ()=>{ input.value = t; dd.style.display = 'none'; });
      dd.appendChild(item);
    });
    dd.style.display = 'block';
  }
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('blur', ()=> setTimeout(()=>{ dd.style.display = 'none'; }, 150));
}
function quitarFotoJuguete(){
  jugFotoUrlPendiente = null;
  document.getElementById('jug-foto-preview').innerHTML = 'sin foto';
  const input = document.getElementById('jug-foto-input');
  if(input) input.value = '';
}
async function subirFotoJuguete(input){
  const file = input.files[0];
  if(!file) return;
  const status = document.getElementById('jug-foto-status');
  status.textContent = 'Subiendo...';
  const path = `juguete-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g,'_')}`;
  const { error } = await sb.storage.from('juguetes-fotos').upload(path, file, { upsert:true });
  if(error){ status.textContent = 'Error al subir: '+error.message; return; }
  const { data:pub } = sb.storage.from('juguetes-fotos').getPublicUrl(path);
  jugFotoUrlPendiente = pub.publicUrl;
  document.getElementById('jug-foto-preview').innerHTML = `<img src="${jugFotoUrlPendiente}" style="width:100%;height:100%;object-fit:cover;">`;
  status.textContent = 'Foto lista.';
}
async function guardarJuguete(id){
  const nombre = document.getElementById('jug-nombre').value.trim();
  if(!nombre){ toast('Falta el nombre del juguete.', 'bad'); return; }
  const ninera_nombre = document.getElementById('jug-ninera').value.trim() || null;
  const ninera = jugNinierasCache.find(n=>n.nombre===ninera_nombre);
  const payload = {
    nombre,
    tipo: document.getElementById('jug-tipo').value.trim() || null,
    genero: document.getElementById('jug-genero').value,
    edad_desde: document.getElementById('jug-edad-desde').value || null,
    edad_hasta: document.getElementById('jug-edad-hasta').value || null,
    ninera_id: ninera?.id || null,
    ninera_nombre,
    estado: document.getElementById('jug-estado').value,
    notas: document.getElementById('jug-notas').value.trim() || null,
    foto_url: jugFotoUrlPendiente,
  };
  const anterior = id ? juguetesItems.find(x=>x.id===id) : null;
  let jugueteId = id;
  if(id){
    const { error } = await sb.from('juguetes').update(payload).eq('id', id);
    if(error){ toast('No se pudo guardar: '+error.message, 'bad'); return; }
  } else {
    const { data, error } = await sb.from('juguetes').insert(payload).select().single();
    if(error){ toast('No se pudo guardar: '+error.message, 'bad'); return; }
    jugueteId = data.id;
  }
  if((anterior?.ninera_nombre||null) !== (ninera_nombre||null)){
    await sb.from('juguetes_movimientos').insert({
      juguete_id: jugueteId,
      ninera_anterior: anterior?.ninera_nombre || null,
      ninera_nueva: ninera_nombre || null,
    });
  }
  cerrarModal();
  toast('Juguete guardado.');
  cargarJuguetes();
}
async function eliminarJuguete(id){
  confirmarAccion('¿Eliminar este juguete del inventario?', 'Eliminar').then(async ok=>{
    if(!ok) return;
    const { error } = await sb.from('juguetes').delete().eq('id', id);
    if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
    toast('Juguete eliminado.');
    cargarJuguetes();
  });
}

function moduloHeader(titulo){
  return `<h1 class="modtitle">${titulo}</h1>`;
}
