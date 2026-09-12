/* ================= RR.HH. ================= */
function rrhhShell(){
  const tabs = [['intake','Candidatas a entrevistar'],['entrevista','Entrevista'],['guardadas','Candidatas guardadas']];
  return `<div class="card" id="rrhh-carsitting-pend"></div><div class="subnav">${tabs.map(([k,l])=>`<button class="subtab ${rrhhTab===k?'active':''}" data-rrhhtab="${k}">${l}</button>`).join('')}</div><div id="rrhh-body"></div>`;
}
function afterRrhhRender(){
  document.querySelectorAll('[data-rrhhtab]').forEach(b=>b.addEventListener('click', ()=>{ rrhhTab=b.dataset.rrhhtab; renderModulo(); }));
  cargarCarsittingPendientes();
  const body = document.getElementById('rrhh-body');
  if(rrhhTab==='intake') renderIntake(body);
  if(rrhhTab==='entrevista') renderEntrevista(body);
  if(rrhhTab==='guardadas') renderGuardadas(body);
}
let carsittingPendData = [];
let carsittingPendAbierto = false;
async function cargarCarsittingPendientes(){
  const box = document.getElementById('rrhh-carsitting-pend');
  if(!box) return;
  const [{data:nins}, {data:cands}, {data:cd}] = await Promise.all([
    sb.from('ninieras').select('id,nombre,tipo,carsitting_mail_enviado_at').in('tipo', ['Traslados','Ambas']),
    sb.from('candidatas').select('id,nombre,apellido,tipo,mail,carsitting_mail_enviado_at').in('tipo', ['Traslados','Ambas']),
    sb.from('carsitting_datos').select('ninera_nombre'),
  ]);
  const yaTiene = new Set((cd||[]).map(r=>normaliza(r.ninera_nombre||'')));
  carsittingPendData = [
    ...(nins||[]).filter(n=>!yaTiene.has(normaliza(n.nombre))).map(n=>({origen:'ninera', id:n.id, nombre:n.nombre, mail:null, enviado:n.carsitting_mail_enviado_at})),
    ...(cands||[]).filter(c=>!yaTiene.has(normaliza(`${c.nombre} ${c.apellido||''}`.trim()))).map(c=>({origen:'candidata', id:c.id, nombre:`${c.nombre} ${c.apellido||''}`.trim(), mail:c.mail, enviado:c.carsitting_mail_enviado_at})),
  ];
  renderCarsittingPendientes();
}
function toggleCarsittingPend(){
  carsittingPendAbierto = !carsittingPendAbierto;
  renderCarsittingPendientes();
}
function renderCarsittingPendientes(){
  const box = document.getElementById('rrhh-carsitting-pend');
  if(!box) return;
  const n = carsittingPendData.length;
  const cabecera = `
    <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="toggleCarsittingPend()">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:13px;font-weight:600;color:var(--ink-soft);">Pendientes de carsitting</span>
        ${n?`<span style="background:var(--clay);color:#fff;border-radius:999px;min-width:20px;height:20px;padding:0 6px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${n}</span>`:''}
      </div>
      <span class="helper" style="margin:0;">${n?(carsittingPendAbierto?'ocultar ▲':'ver lista ▼'):'todo al día'}</span>
    </div>`;
  if(!n || !carsittingPendAbierto){
    box.innerHTML = cabecera;
    return;
  }
  box.innerHTML = cabecera + `
    <div style="margin-top:10px;">
      ${carsittingPendData.map(p=>{
        const asunto = encodeURIComponent('¡Bienvenida al equipo de traslados de Parents Break!');
        const primerNombre = (p.nombre||'').split(' ')[0];
        const cuerpo = encodeURIComponent(`Hola ${primerNombre},\n\n¡Qué alegría contar con vos para hacer traslados con Parents Break! Ya vimos en tu entrevista que tenés licencia de conducir y ganas de sumarte a esta parte del equipo.\n\nPara terminar de darte de alta como carsitter, necesitamos que completes este formulario con los datos de tu auto y algunos datos más:\n\nhttps://forms.gle/J4QXgNJQ8kXMsA4C6\n\nCon esto ya vas a quedar lista para que te empecemos a asignar traslados.\n\nCualquier duda, escribinos.\n\nUn abrazo,\nParents Break`);
        const mailId = `carp-mail-${p.origen}-${p.id}`;
        const enviadoTxt = p.enviado ? `Último mail enviado: ${new Date(p.enviado).toLocaleDateString('es-UY',{day:'2-digit',month:'short'})}` : 'Todavía no se le mandó nada';
        const asuntoPersonal = encodeURIComponent('Parents Break');
        const cuerpoPersonal = encodeURIComponent(`Hola ${primerNombre},\n\n\n\nUn abrazo,\nParents Break`);
        return `<div class="agendarow" style="border-bottom:1px solid var(--line);flex-wrap:wrap;">
          <div>
            <div style="font-weight:600;">${p.nombre} <span class="badge" style="font-size:10px;">${p.origen==='ninera'?'niñera':'candidata'}</span></div>
            <div class="helper" style="margin:2px 0 0;">${enviadoTxt}</div>
            ${p.mail?'':`<input type="email" id="${mailId}" placeholder="mail de contacto" style="margin-top:6px;max-width:220px;">`}
          </div>
          <div style="display:flex;gap:8px;">
            <a class="smallbtn" style="text-decoration:none;"
               href="mailto:${p.mail||''}?subject=${asuntoPersonal}&body=${cuerpoPersonal}" target="_blank" rel="noopener"
               ${p.mail?'':`onmousedown="this.href='mailto:'+(document.getElementById('${mailId}').value||'')+'?subject=${asuntoPersonal}&body=${cuerpoPersonal}'"`}>Mail personalizado</a>
            <a class="smallbtn" style="text-decoration:none;" onclick="marcarCarsittingMailEnviado('${p.origen}','${p.id}')"
               href="mailto:${p.mail||''}?subject=${asunto}&body=${cuerpo}" target="_blank" rel="noopener"
               ${p.mail?'':`onmousedown="this.href='mailto:'+(document.getElementById('${mailId}').value||'')+'?subject=${asunto}&body=${cuerpo}'"`}>Enviar mail</a>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
async function marcarCarsittingMailEnviado(origen, id){
  const tabla = origen==='ninera' ? 'ninieras' : 'candidatas';
  await sb.from(tabla).update({carsitting_mail_enviado_at: new Date().toISOString()}).eq('id', id);
}
function errBox(e){ return `<div class="warnbox">Error de conexión con la base: ${e.message||e}</div>`; }


/* ---- Candidatas a entrevistar (intake) ---- */
let intakeItems = [];
let intakeFiltro = 'Todas';
function renderIntake(body){
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:var(--gutter);">
      <div class="pillfilters" id="intake-pillfilters" style="margin:0;"></div>
      <button class="btn primary" onclick="abrirModalNuevaCandidata()">+ Cargar candidata</button>
    </div>
    <div id="intakegrid"></div>
  `;
  renderIntakePills();
  loadIntake();
}
function renderIntakePills(){
  const box = document.getElementById('intake-pillfilters');
  if(!box) return;
  box.innerHTML = ['Todas','Niñera','Traslados','Ambas'].map(t=>`<button class="pillbtn ${intakeFiltro===t?'selected':''}" onclick="setIntakeFiltro('${t}')">${t}</button>`).join('');
}
function setIntakeFiltro(t){
  intakeFiltro = t;
  renderIntakePills();
  loadIntake();
}
function abrirModalNuevaCandidata(){
  abrirModal(`
    <h2 style="margin:0 0 6px;">Cargar candidata manualmente</h2>
    <div class="helper" style="margin-bottom:14px;">Para candidatas nuevas que lleguen fuera del form de babysitters (el form ya entra solo).</div>
    <div class="grid3">
      <div class="field"><label>Nombre</label><input type="text" id="in-nombre"></div>
      <div class="field"><label>Teléfono</label><input type="tel" id="in-tel"></div>
      <div class="field"><label>Zona</label><input type="text" id="in-zona"></div>
    </div>
    <div class="grid3">
      <div class="field"><label>Edad</label><input type="text" id="in-edad"></div>
      <div class="field"><label>Cómo llegó</label><select id="in-origen"><option>Instagram / Form</option><option>Recomendada</option><option>Otro</option></select></div>
      <div class="field"><label>Experiencia (resumen)</label><input type="text" id="in-exp"></div>
    </div>
    <div class="field"><label>Tipo</label><select id="in-tipo"><option>Niñera</option><option>Traslados</option><option>Ambas</option></select></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="addIntake()">Agregar candidata</button>
    </div>`);
}
async function addIntake(){
  const nombre = document.getElementById('in-nombre').value.trim();
  if(!nombre){ toast('Falta el nombre.','bad'); return; }
  if(!(await confirmarNombreNuevo(nombre, [...intakeItems, ...candidatasItems], 'niñera'))) return;
  const item = { nombre, telefono:document.getElementById('in-tel').value, zona:document.getElementById('in-zona').value,
    edad:document.getElementById('in-edad').value, origen:document.getElementById('in-origen').value, experiencia:document.getElementById('in-exp').value,
    tipo:document.getElementById('in-tipo').value, estado:'intake' };
  const { error } = await sb.from('candidatas').insert(item);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Candidata agregada.');
  loadIntake();
}
async function loadIntake(){
  const grid = document.getElementById('intakegrid');
  if(!grid) return;
  grid.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  let q = sb.from('candidatas').select('*').eq('estado','intake').order('created_at',{ascending:false});
  if(intakeFiltro!=='Todas') q = q.eq('tipo', intakeFiltro);
  const { data, error } = await q;
  if(error){ grid.innerHTML = errBox(error); return; }
  intakeItems = data;
  if(!intakeItems.length){ grid.innerHTML = '<div class="empty">No hay candidatas esperando entrevista.</div>'; return; }
  grid.innerHTML = '<div class="person-list">' + intakeItems.map((c,i)=>`
    <div class="person-row">
      <div class="av" ${c.foto_url && c.autoriza_foto!==false?`style="cursor:zoom-in;" onclick="abrirLightboxFoto('${c.foto_url}', 'Foto de ${c.nombre}')"`:''}>${c.foto_url?`<img src="${c.foto_url}" alt="Foto de ${c.nombre}" onerror="this.parentElement.textContent='${(c.nombre||'?').charAt(0).toUpperCase()}'">`:(c.nombre||'?').charAt(0).toUpperCase()}</div>
      <div class="info">
        <div class="name">${c.nombre} ${c.apellido||''}</div>
        <div class="meta">${c.zona||'zona s/d'} · ${c.edad?c.edad+(String(c.edad).length<=2?' años':''):'edad s/d'}${c.origen?' · '+c.origen:''}</div>
      </div>
      <div class="badge-slot">
        <span class="badge brand" style="font-size:10px;padding:2px 8px;">${c.tipo||'Niñera'}</span>
        ${c.autoriza_foto===false?'<div class="badge bad" style="font-size:9px;padding:2px 6px;margin-top:4px;">No autoriza foto</div>':''}
      </div>
      <div class="rowbtns">
        <button class="smallbtn" onclick="verFichaIntake(${i})">Ver ficha</button>
        <button class="smallbtn" onclick="agendarDesdeIntake(${i})">Agendar</button>
        <button class="smallbtn danger" onclick="descartarIntake('${c.id}')">Descartar</button>
      </div>
    </div>`).join('') + '</div>';
}
function verFichaIntake(i){
  const c = intakeItems[i];
  const rows = FICHA_CAMPOS.filter(f=>c[f.key]).map(f=>`<div><b>${f.label}</b>${c[f.key]}</div>`).join('');
  const fotoHtml = c.foto_url ? `<img src="${c.foto_url}" alt="Foto de ${c.nombre}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:12px;${c.autoriza_foto!==false?'cursor:zoom-in;':''}" ${c.autoriza_foto!==false?`onclick="abrirLightboxFoto('${c.foto_url}', 'Foto de ${c.nombre}')"`:''} onerror="this.outerHTML='<div class=&quot;helper&quot; style=&quot;margin-bottom:12px;&quot;>No se pudo mostrar la foto — <a href=&quot;${c.foto_url}&quot; target=&quot;_blank&quot;>abrirla en Drive</a>.</div>'">` : '';
  const avisoHtml = c.autoriza_foto === false ? `<div style="background:var(--clay-soft);color:var(--clay-text);font-weight:600;font-size:13px;padding:10px 14px;border-radius:10px;margin-bottom:14px;border:1px solid var(--clay);">⚠️ No autorizó el uso de su foto ni sus datos para el proceso de selección — no usar su imagen ni compartir su información fuera de la evaluación.</div>` : '';
  abrirModal(`${avisoHtml}${fotoHtml}<h2 style="margin:0 0 10px;">${c.nombre} ${c.apellido||''}</h2><div class="fichadl">${rows||'<div>Sin más datos cargados.</div>'}</div>`);
}
async function descartarIntake(id){
  if(!(await confirmarAccion('¿Descartar esta candidata? No se puede deshacer.', 'Descartar'))) return;
  const { error } = await sb.from('candidatas').delete().eq('id', id);
  if(error){ toast('No se pudo descartar: '+error.message,'bad'); return; }
  loadIntake();
}
function agendarDesdeIntake(i){
  const c = intakeItems[i];
  rrhhTab = 'entrevista';
  renderModulo();
  setTimeout(()=>{
    document.getElementById('f-nombre').value = (c.nombre||'') + (c.apellido? ' '+c.apellido:'');
    document.getElementById('f-telefono').value = c.telefono||'';
    document.getElementById('f-zona').value = c.zona||'';
    document.getElementById('f-origen').value = c.origen||'';
    document.getElementById('f-exp-previa').value = c.experiencia||'';
    entrevistaState.tipo = c.tipo || 'Niñera';
    entrevistaState.fichaOrigen = c;
    entrevistaState.candidataId = c.id;
    renderFichaOrigen();
  }, 30);
}
function renderFichaOrigen(){
  const box = document.getElementById('fichaOrigenBox');
  if(!box) return;
  const c = entrevistaState.fichaOrigen;
  if(!c){ box.innerHTML=''; return; }
  const rows = FICHA_CAMPOS.filter(f=>c[f.key] && !['nombre','apellido','telefono','zona'].includes(f.key)).map(f=>`<div><b>${f.label}</b>${c[f.key]}</div>`).join('');
  box.innerHTML = `<div class="card"><h2>Ficha del formulario</h2><div class="helper">Cargada por ella misma antes de la entrevista — no editable acá.</div><div class="fichadl">${rows||'<div>Sin más datos.</div>'}</div></div>`;
}

/* ---- Entrevista ---- */
let entrevistaState = { competencias:{}, redflags:{}, refs:[], candidataId:null, fichaOrigen:null, tipo:'Niñera', explicacionJuegos:null };
async function renderEntrevista(body){
  if(!entrevistaPreguntasCache) await cargarEntrevistaPreguntas();
  body.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
        <h2 style="margin:0;">Datos de la entrevista</h2>
        <a href="#" onclick="abrirModalEditarPreguntas();return false;" style="font-size:12.5px;">Editar preguntas de la entrevista</a>
      </div>
      <div class="grid3">
        <div class="field"><label>Nombre de la candidata</label><input type="text" id="f-nombre"></div>
        <div class="field"><label>Fecha</label><input type="date" id="f-fecha"></div>
        <div class="field"><label>Entrevistó</label><select id="f-entrevisto"><option value="">Elegir…</option><option ${registradoPorUsuario()==='Paulina G'?'selected':''}>Paulina G</option><option ${registradoPorUsuario()==='Delfina F'?'selected':''}>Delfina F</option><option>Otra</option></select></div>
      </div>
      <div class="grid3">
        <div class="field"><label>Teléfono</label><input type="tel" id="f-telefono"></div>
        <div class="field"><label>Zona</label><input type="text" id="f-zona"></div>
        <div class="field"><label>Rol pensado</label><select id="f-rol"><option value="">Elegir…</option><option>Turno fijo semanal</option><option>Sittings espontáneos</option><option>Traslados</option><option>Sin definir</option></select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Cómo llegó</label><input type="text" id="f-origen"></div>
        <div class="field"><label>Experiencia previa (resumen)</label><input type="text" id="f-exp-previa"></div>
      </div>
    </div>
    <div id="fichaOrigenBox"></div>
    <div id="competencias"></div>
    <div class="card">
      <h2>Explicación de juegos y capacitación extra</h2>
      <div class="field">
        <label>¿Le explicaste cómo funcionan los juegos/actividades y mostró que entendió?</label>
        <div class="scorebar" style="max-width:220px;">
          <div class="scorebtn" data-juegos="Si">Sí</div>
          <div class="scorebtn" data-juegos="No">No</div>
        </div>
      </div>
      <div class="field"><label>Capacitación extra (cursos, certificaciones que mencionó)</label><textarea id="f-capacitacion"></textarea></div>
    </div>
    <div class="card">
      <h2>Psicotécnico — guía de observación</h2>
      <div class="helper">No es un test proyectivo clínico ni tiene validez diagnóstica: es una guía para observar cómo responde bajo una consigna ambigua, con criterios orientativos.</div>
      ${PSICO_IMGS.map((img)=>`
        <div style="margin-bottom:16px;">
          <div class="psico-img">${img.svg}</div>
          <label>¿Qué ve la candidata? (anotá su respuesta tal cual)</label>
          <textarea data-psico="${img.id}"></textarea>
          <details class="crit"><summary>Qué mirar en la respuesta</summary>
            <ul><li>¿Responde rápido y con seguridad, o duda mucho?</li><li>¿La respuesta es concreta o muy vaga/evasiva?</li><li>¿Menciona espontáneamente algo relacionado a cuidado, personas o interacción?</li><li>¿Se pone nerviosa o incómoda con la ambigüedad de la consigna?</li></ul>
          </details>
        </div>`).join('')}
    </div>
    <div id="competencias-finales"></div>
    <div class="card"><h2>Señales de alerta observadas</h2><div class="helper">Marcá solo lo que efectivamente observaste.</div><div id="redflags"></div></div>
    <div class="card"><h2>Referencias</h2><div id="reflist"></div><button class="smallbtn" onclick="addRef()">+ Agregar referencia</button></div>
    <div class="card"><h2>Notas finales</h2><textarea id="f-notas" placeholder="Impresión general…"></textarea></div>
    <div class="card resultcard" id="resultado" style="display:none;"></div>
    <div class="actions">
      <button class="btn primary" id="btnGuardar" onclick="guardarCandidata()">Guardar candidata</button>
      <button class="btn ghost" onclick="window.print()">Imprimir</button>
      <button class="btn ghost" onclick="limpiarForm()">Vaciar formulario</button>
    </div>
    <div id="warnArea"></div>
  `;
  renderFichaOrigen();
  renderCompetencias();
  renderCompetenciasFinales();
  renderRedflags();
  renderRefs();
  document.querySelectorAll('[data-juegos]').forEach(el=>{
    el.addEventListener('click', ()=>{
      entrevistaState.explicacionJuegos = el.dataset.juegos;
      document.querySelectorAll('[data-juegos]').forEach(b=>b.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}
function renderCompetencias(){
  const cont = document.getElementById('competencias');
  cont.innerHTML = COMP_PRINCIPALES.map(c => { const preguntas = preguntasDe(c.key); return `
    <div class="card"><h2>${c.titulo}</h2>${preguntas.length? preguntas.map(p=>`<div class="q">${p}</div>`).join('') : `<div class="helper">${c.helper||''}</div>`}
      <textarea placeholder="Notas de la respuesta…" data-notes="${c.key}"></textarea>
      <div class="scorebar" data-scorebar="${c.key}">${[1,2,3,4,5].map(n=>`<div class="scorebtn" data-score="${c.key}:${n}">${n}</div>`).join('')}</div>
      <div class="scorelabels"><span>Preocupa</span><span>Muy sólida</span></div></div>
  `; }).join('');
  bindCompetenciaHandlers(cont);
}
function renderCompetenciasFinales(){
  const cont = document.getElementById('competencias-finales');
  if(!cont) return;
  cont.innerHTML = COMP_FINALES.map(c => { const preguntas = preguntasDe(c.key); return `
    <div class="card"><h2>${c.titulo}</h2>${preguntas.length? preguntas.map(p=>`<div class="q">${p}</div>`).join('') : `<div class="helper">${c.helper||''}</div>`}
      <textarea placeholder="Notas de la respuesta…" data-notes="${c.key}"></textarea>
      <div class="scorebar" data-scorebar="${c.key}">${[1,2,3,4,5].map(n=>`<div class="scorebtn" data-score="${c.key}:${n}">${n}</div>`).join('')}</div>
      <div class="scorelabels"><span>Preocupa</span><span>Muy sólida</span></div></div>
  `; }).join('');
  bindCompetenciaHandlers(cont);
}
function bindCompetenciaHandlers(cont){
  cont.querySelectorAll('[data-score]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const [key,n] = el.dataset.score.split(':');
      entrevistaState.competencias[key] = entrevistaState.competencias[key] || {};
      entrevistaState.competencias[key].score = parseInt(n);
      cont.querySelectorAll(`[data-scorebar="${key}"] .scorebtn`).forEach(b=>b.classList.remove('selected'));
      el.classList.add('selected'); calcular();
    });
  });
  cont.querySelectorAll('[data-notes]').forEach(el=>{
    el.addEventListener('input', ()=>{ const key=el.dataset.notes; entrevistaState.competencias[key]=entrevistaState.competencias[key]||{}; entrevistaState.competencias[key].notes=el.value; });
  });
}
function renderRedflags(){
  const cont = document.getElementById('redflags');
  cont.innerHTML = REDFLAGS.map(f=>`<label class="flag-row ${f.critico?'critical':''}"><input type="checkbox" data-flag="${f.key}"><span>${f.texto}</span></label>`).join('');
  cont.querySelectorAll('[data-flag]').forEach(el=>{ el.addEventListener('change', ()=>{ entrevistaState.redflags[el.dataset.flag]=el.checked; calcular(); }); });
}
function addRef(){ entrevistaState.refs.push({name:'',phone:'',relacion:'',confirmado:false}); renderRefs(); }
function quitarRef(i){ entrevistaState.refs.splice(i,1); renderRefs(); }
function renderRefs(){
  const cont = document.getElementById('reflist');
  cont.innerHTML = entrevistaState.refs.map((r,i)=>`
    <div class="refrow">
      <input type="text" placeholder="Nombre" value="${r.name}" oninput="entrevistaState.refs[${i}].name=this.value">
      <input type="tel" placeholder="Teléfono" value="${r.phone}" oninput="entrevistaState.refs[${i}].phone=this.value">
      <input type="text" placeholder="Relación" value="${r.relacion}" oninput="entrevistaState.refs[${i}].relacion=this.value">
      <label class="chk"><input type="checkbox" ${r.confirmado?'checked':''} onchange="entrevistaState.refs[${i}].confirmado=this.checked"> Confirmada</label>
      <button type="button" class="pcard-delete" style="position:static;box-shadow:none;" onclick="quitarRef(${i})" title="Quitar referencia" aria-label="Quitar referencia">${ICONS.trash}</button>
    </div>`).join('');
}
function calcular(){
  const scores = COMPETENCIAS.map(c => entrevistaState.competencias[c.key]?.score).filter(v=>v!==undefined);
  const completo = scores.length === COMPETENCIAS.length;
  const total = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
  const criticoMarcado = REDFLAGS.some(f=>f.critico && entrevistaState.redflags[f.key]);
  let badgeClass='warn', badgeTexto='Faltan puntajes', nota='Completá los bloques de arriba para tener una recomendación.';
  if(completo){
    if(criticoMarcado){ badgeClass='warn'; badgeTexto='Con reservas'; nota='Hay una señal de alerta crítica marcada — revisar antes de avanzar.'; }
    else if(total>=4.2){ badgeClass='good'; badgeTexto='Recomendada'; nota='Puntaje sólido y sin señales críticas.'; }
    else if(total>=3){ badgeClass='warn'; badgeTexto='Con reservas'; nota='Puntaje intermedio — conviene una segunda charla.'; }
    else { badgeClass='bad'; badgeTexto='No recomendada'; nota='Puntaje bajo en varias competencias.'; }
  }
  const gaugeColor = badgeClass==='good'?'var(--good)':badgeClass==='bad'?'var(--bad)':'var(--warn)';
  const pct = completo?(total/5*100):0;
  const box = document.getElementById('resultado');
  box.style.display='flex';
  box.innerHTML = `<div class="gauge" style="background:conic-gradient(${gaugeColor} ${pct}%, var(--line) 0);"><div class="inner"><div class="num">${completo?total.toFixed(1):'—'}</div><div class="max">/ 5</div></div></div>
    <div><span class="badge ${badgeClass}">${badgeTexto}</span><div class="resultnote">${nota}</div></div>`;
  document.getElementById('btnGuardar').disabled = !completo;
  return {total, completo, recomendacion:badgeTexto};
}
async function guardarCandidata(){
  const nombre = document.getElementById('f-nombre').value.trim();
  const warnArea = document.getElementById('warnArea');
  warnArea.innerHTML='';
  if(!nombre){ warnArea.innerHTML='<div class="warnbox">Falta el nombre.</div>'; return; }
  const {total, completo, recomendacion} = calcular();
  if(!completo){ warnArea.innerHTML='<div class="warnbox">Faltan puntajes en algún bloque.</div>'; return; }
  const psico = {};
  PSICO_IMGS.forEach(img=>{ const el = document.querySelector(`[data-psico="${img.id}"]`); psico[img.id]= el?el.value:''; });

  let candidataId = entrevistaState.candidataId;
  if(candidataId){
    const { error } = await sb.from('candidatas').update({ estado:'entrevistada', telefono:document.getElementById('f-telefono').value, zona:document.getElementById('f-zona').value }).eq('id', candidataId);
    if(error){ warnArea.innerHTML = errBox(error); return; }
  } else {
    if(!(await confirmarNombreNuevo(nombre, [...intakeItems, ...candidatasItems], 'niñera'))) return;
    const { data, error } = await sb.from('candidatas').insert({
      nombre, telefono:document.getElementById('f-telefono').value, zona:document.getElementById('f-zona').value,
      origen:document.getElementById('f-origen').value, experiencia:document.getElementById('f-exp-previa').value,
      tipo: entrevistaState.tipo || 'Niñera', estado:'entrevistada',
    }).select().single();
    if(error){ warnArea.innerHTML = errBox(error); return; }
    candidataId = data.id;
  }

  const { error: e2 } = await sb.from('entrevistas').insert({
    candidata_id: candidataId,
    fecha: document.getElementById('f-fecha').value || null,
    entrevisto: document.getElementById('f-entrevisto').value,
    rol: document.getElementById('f-rol').value,
    puntajes: entrevistaState.competencias,
    redflags: entrevistaState.redflags,
    referencias: entrevistaState.refs,
    psico,
    explicacion_juegos: entrevistaState.explicacionJuegos,
    notas: document.getElementById('f-notas').value,
    total: Number(total.toFixed(2)),
    recomendacion,
  });
  if(e2){ warnArea.innerHTML = errBox(e2); return; }
  toast('Candidata guardada — está en "Candidatas guardadas".');
  limpiarForm();
}
function limpiarForm(){
  entrevistaState = { competencias:{}, redflags:{}, refs:[], candidataId:null, fichaOrigen:null, tipo:'Niñera', explicacionJuegos:null };
  renderEntrevista(document.getElementById('rrhh-body'));
}

/* ---- Candidatas guardadas ---- */
let candidatasItems = [];
function renderGuardadas(body){
  body.innerHTML = `
    <div class="card">
      <h2>Candidatas guardadas</h2><div class="helper" style="margin:2px 0 0;">Ya entrevistadas, todavía no son niñeras.</div>
    </div>
    <div class="candlist" id="candlist"></div>
  `;
  cargarGuardadas();
}
async function cargarGuardadas(){
  const cont = document.getElementById('candlist');
  cont.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const { data, error } = await sb.from('entrevistas').select('*, candidatas(*)').order('created_at',{ascending:false});
  if(error){ cont.innerHTML = errBox(error); return; }
  candidatasItems = data;
  if(!candidatasItems.length){ cont.innerHTML='<div class="empty">Todavía no hay candidatas guardadas.</div>'; return; }
  cont.innerHTML = candidatasItems.map((c,i)=>{
    const cd = c.candidatas;
    return `<button type="button" class="item" onclick="verDetalle(${i})">
      <div><div class="name">${cd.nombre} ${cd.estado==='contratada'?'✓':''}</div><div class="meta">${c.fecha||'sin fecha'} · ${cd.zona||'zona s/d'} · ${c.rol||'rol s/d'}</div></div>
      <div class="sc"><div class="n">${Number(c.total).toFixed(1)} / 5</div><span class="badge ${c.recomendacion==='Recomendada'?'good':c.recomendacion==='No recomendada'?'bad':'warn'}">${cd.estado==='contratada'?'Contratada':c.recomendacion}</span></div>
    </button>`;
  }).join('');
}
function verDetalle(i){
  const c = candidatasItems[i];
  const cd = c.candidatas;
  const compRowHtml = comp => { const d=c.puntajes[comp.key]||{}; return `<div class="card"><h2>${comp.titulo} — <span style="color:var(--accent)">${d.score||'—'}/5</span></h2><div class="helper" style="margin-top:6px;">${d.notes||'(sin notas)'}</div></div>`; };
  const compHtml = COMP_PRINCIPALES.map(compRowHtml).join('');
  const compHtmlFinal = COMP_FINALES.map(compRowHtml).join('');
  const flags = REDFLAGS.filter(f=>c.redflags[f.key]);
  const refs = c.referencias||[];
  const refsHtml = refs.length ? refs.map(r=>`<div class="q">${r.name||'(sin nombre)'} · ${r.phone||'sin tel'} · ${r.relacion||'—'} ${r.confirmado?'· ✓ confirmada':''}</div>`).join('') : '<div class="helper">Sin referencias.</div>';
  const psicoHtml = c.psico ? PSICO_IMGS.map(img=>`<div class="q"><b>${img.id}:</b> ${c.psico[img.id]||'(sin respuesta anotada)'}</div>`).join('') : '';
  const fichaHtml = `<div class="card"><h2>Ficha del formulario</h2><div class="fichadl">${FICHA_CAMPOS.filter(f=>cd[f.key]).map(f=>`<div><b>${f.label}</b>${cd[f.key]}</div>`).join('')||'<div>Sin datos.</div>'}</div></div>`;
  abrirModal(`
    <div class="card resultcard">
      <div class="gauge" style="background:conic-gradient(${c.recomendacion==='Recomendada'?'var(--good)':c.recomendacion==='No recomendada'?'var(--bad)':'var(--warn)'} ${c.total/5*100}%, var(--line) 0);"><div class="inner"><div class="num">${Number(c.total).toFixed(1)}</div><div class="max">/ 5</div></div></div>
      <div><h2 style="font-size:20px;">${cd.nombre}</h2><div class="helper" style="margin:4px 0;">${c.fecha||''} · ${cd.zona||''} · ${c.rol||''} · tel ${cd.telefono||'—'}</div><span class="badge ${c.recomendacion==='Recomendada'?'good':c.recomendacion==='No recomendada'?'bad':'warn'}">${c.recomendacion}</span></div>
    </div>
    ${fichaHtml}
    <div id="cg-carsitting"></div>
    ${compHtml}
    <div class="card"><h2>Explicación de juegos y capacitación</h2><div class="q">¿Explicó bien los juegos? <b>${c.explicacion_juegos||'—'}</b></div><div class="helper">${cd.capacitacion_extra||'(sin capacitación extra registrada)'}</div></div>
    <div class="card"><h2>Psicotécnico (guía de observación)</h2>${psicoHtml}</div>
    ${compHtmlFinal}
    <div class="card"><h2>Señales de alerta</h2>${flags.length?flags.map(f=>`<div class="q">${f.texto}${f.critico?' · crítico':''}</div>`).join(''):'<div class="helper">Ninguna marcada.</div>'}</div>
    <div class="card"><h2>Referencias</h2>${refsHtml}</div>
    <div class="card"><h2>Notas finales</h2><div class="helper">${c.notas||'(sin notas)'}</div></div>
    ${cd.estado==='contratada' ? '<div class="okbox">Ya está contratada — figura en la sección Niñeras.</div>' : `
    <div class="card"><h2>Contratar</h2>
      <div class="grid3">
        <div class="field"><label>Zona (confirmar)</label><input type="text" id="hire-zona" value="${cd.zona||''}"></div>
        <div class="field"><label>Foto (URL, opcional)</label><input type="text" id="hire-foto" value="${cd.foto_url||''}" placeholder="link de Drive/Canva"></div>
      </div>
      <div class="helper">El precio por hora se define por familia en la sección "Familias".</div>
      <button class="btn primary" onclick="contratar('${cd.id}')">Pasar a Niñeras</button>
    </div>`}
    <div class="actions"><button class="btn danger" onclick="eliminarCandidata('${cd.id}')">Eliminar candidata</button></div>
  `);
  cargarCarsittingSeccion(cd.nombre, 'cg-carsitting', cd.tipo, cd.mail);
}
async function contratar(candidataId){
  const c = candidatasItems.find(x=>x.candidatas.id===candidataId);
  const cd = c.candidatas;
  const ninera = {
    candidata_id: candidataId, nombre:cd.nombre, telefono:cd.telefono, tipo:cd.tipo||'Niñera',
    zona: document.getElementById('hire-zona').value, foto: document.getElementById('hire-foto').value, notas: c.notas,
  };
  // Si la candidata puso cuenta bancaria en el formulario, se copia sola a la ficha de
  // niñera (ahí es donde vive de verdad, como una cuenta más dentro del array).
  if(cd.cuenta_bancaria) ninera.cuenta_bancaria = [cd.cuenta_bancaria];
  const { error: e1 } = await sb.from('ninieras').insert(ninera);
  if(e1){ toast('No se pudo contratar: '+e1.message,'bad'); return; }
  const { error: e2 } = await sb.from('candidatas').update({ estado:'contratada' }).eq('id', candidataId);
  if(e2){ toast('Niñera creada, pero no se pudo actualizar el estado: '+e2.message,'bad'); }
  toast('Pasó a Niñeras.');
  cerrarModal();
  cargarGuardadas();
}
async function eliminarCandidata(candidataId){
  if(!(await confirmarAccion('¿Eliminar esta candidata? No se puede deshacer.'))) return;
  const { error } = await sb.from('candidatas').delete().eq('id', candidataId);
  if(error){ toast('No se pudo eliminar: '+error.message,'bad'); return; }
  cerrarModal();
  cargarGuardadas();
}
function descargarCSV(headers, rows, filename){
  const csv = [headers, ...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF"+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}

