/* ================= MARKETING ================= */
let marketingItems = [];
function renderMarketing(cont){
  cont.innerHTML = moduloHeader('Marketing') + `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:var(--gutter);">
      <div class="helper" style="margin:0;">Calendario de fechas especiales para ir armando contenido de Instagram con anticipación.</div>
      <button class="btn primary" onclick="abrirModalNuevaFechaMarketing()">+ Agregar fecha especial</button>
    </div>
    <div id="mk-list"></div>
  `;
  cargarMarketing();
}
function abrirModalNuevaFechaMarketing(){
  abrirModal(`
    <h2 style="margin:0 0 18px;">Agregar fecha especial</h2>
    <div class="grid3">
      <div class="field"><label>Fecha</label><input type="date" id="mk-fecha"></div>
      <div class="field"><label>Título</label><input type="text" id="mk-titulo" placeholder="Ej: Día del Niño"></div>
      <div class="field"><label>¿Ya publicado?</label><select id="mk-publicado"><option value="false">No</option><option value="true">Sí</option></select></div>
    </div>
    <div class="field"><label>Idea de contenido</label><textarea id="mk-sugerencia" placeholder="Qué publicar y cuándo conviene hacerlo"></textarea></div>
    <div class="field"><label>Notas</label><textarea id="mk-notas"></textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="addFechaMarketing()">Agregar fecha</button>
    </div>`);
}
async function addFechaMarketing(){
  const fecha = document.getElementById('mk-fecha').value;
  const titulo = document.getElementById('mk-titulo').value.trim();
  if(!fecha || !titulo){ toast('Faltan fecha o título.', 'bad'); return; }
  const item = { fecha, titulo, sugerencia: document.getElementById('mk-sugerencia').value || null,
    publicado: document.getElementById('mk-publicado').value === 'true', notas: document.getElementById('mk-notas').value || null };
  const { error } = await sb.from('fechas_marketing').insert(item);
  if(error){ toast('No se pudo guardar: '+error.message, 'bad'); return; }
  cerrarModal();
  toast('Fecha agregada.');
  cargarMarketing();
}
async function cargarMarketing(){
  const cont = document.getElementById('mk-list');
  cont.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const { data, error } = await sb.from('fechas_marketing').select('*').order('fecha');
  if(error){ cont.innerHTML = errBox(error); return; }
  marketingItems = data || [];
  if(!marketingItems.length){ cont.innerHTML = '<div class="empty">Todavía no hay fechas cargadas.</div>'; return; }
  const hoy = todayISO();
  const proximas = marketingItems.filter(f=>f.fecha >= hoy);
  const pasadas = marketingItems.filter(f=>f.fecha < hoy).reverse();
  const filaHTML = (f)=>{
    const fechaFmt = new Date(f.fecha+'T00:00:00').toLocaleDateString('es-UY', {day:'2-digit', month:'long', year:'numeric'});
    return `<div class="card" style="${f.publicado?'opacity:.6;':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <div class="eyebrow" style="margin-bottom:2px;">${fechaFmt}</div>
          <h2 style="margin:0;">${f.titulo}</h2>
        </div>
        <label class="chk" style="font-size:12.5px;">
          <input type="checkbox" onchange="togglePublicadoMarketing('${f.id}', this.checked)" ${f.publicado?'checked':''}> Publicado
        </label>
      </div>
      ${f.sugerencia?`<div class="helper" style="margin-top:8px;">${f.sugerencia}</div>`:''}
      ${f.notas?`<div class="helper">${f.notas}</div>`:''}
      <div class="actions" style="margin-top:10px;"><button class="smallbtn" onclick="editarFechaMarketing('${f.id}')">Editar</button><button class="smallbtn danger" onclick="eliminarFechaMarketing('${f.id}')">Eliminar</button></div>
    </div>`;
  };
  let html = '';
  if(proximas.length){ html += `<div class="card-section-title">Próximas</div>` + proximas.map(filaHTML).join(''); }
  if(pasadas.length){ html += `<div class="card-section-title">Pasadas</div>` + pasadas.map(filaHTML).join(''); }
  cont.innerHTML = html;
}
function editarFechaMarketing(id){
  const f = marketingItems.find(x=>x.id===id);
  if(!f) return;
  abrirModal(`
    <h2 style="margin:0 0 18px;">Editar fecha especial</h2>
    <div class="grid3">
      <div class="field"><label>Fecha</label><input type="date" id="ed-mk-fecha" value="${f.fecha||''}"></div>
      <div class="field"><label>Título</label><input type="text" id="ed-mk-titulo" value="${f.titulo||''}"></div>
      <div class="field"><label>¿Ya publicado?</label><select id="ed-mk-publicado"><option value="false" ${!f.publicado?'selected':''}>No</option><option value="true" ${f.publicado?'selected':''}>Sí</option></select></div>
    </div>
    <div class="field"><label>Idea de contenido</label><textarea id="ed-mk-sugerencia">${f.sugerencia||''}</textarea></div>
    <div class="field"><label>Notas</label><textarea id="ed-mk-notas">${f.notas||''}</textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="guardarEdicionFechaMarketing('${id}')">Guardar</button>
    </div>`);
}
async function guardarEdicionFechaMarketing(id){
  const cambios = {
    fecha: document.getElementById('ed-mk-fecha').value,
    titulo: document.getElementById('ed-mk-titulo').value.trim(),
    publicado: document.getElementById('ed-mk-publicado').value === 'true',
    sugerencia: document.getElementById('ed-mk-sugerencia').value || null,
    notas: document.getElementById('ed-mk-notas').value || null,
  };
  if(!cambios.fecha || !cambios.titulo){ toast('Faltan fecha o título.','bad'); return; }
  const { error } = await sb.from('fechas_marketing').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Cambios guardados.');
  cargarMarketing();
}
async function togglePublicadoMarketing(id, val){
  const { error } = await sb.from('fechas_marketing').update({publicado: val}).eq('id', id);
  if(error){ toast('No se pudo actualizar: '+error.message, 'bad'); return; }
  cargarMarketing();
}
async function eliminarFechaMarketing(id){
  if(!(await confirmarAccion('¿Eliminar esta fecha? No se puede deshacer.'))) return;
  const { error } = await sb.from('fechas_marketing').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  toast('Fecha eliminada.');
  cargarMarketing();
}

