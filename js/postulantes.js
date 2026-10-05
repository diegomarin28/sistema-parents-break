/* ================= RR.HH. ================= */
function rrhhShell(){
  const tabs = [['intake','Candidatas a entrevistar'],['entrevista','Entrevista'],['guardadas','Candidatas guardadas']];
  return `<div class="card" id="rrhh-carsitting-pend"></div><div class="subnav">${tabs.map(([k,l])=>`<button class="subtab ${rrhhTab===k?'active':''}" data-rrhhtab="${k}">${l}</button>`).join('')}</div><div id="rrhh-body"></div>`;
}
// Cambio en vivo en RR.HH. (otra usuaria, o una candidata nueva del formulario público): en la
// pestaña Entrevista no se repinta nada, porque reconstruirla borra lo que se está escribiendo;
// el resto de las pestañas sí se actualiza. El aviso de carsitting de arriba se refresca siempre.
function refrescarRrhhSinPisarEntrevista(){
  if(rrhhTab==='entrevista'){ cargarCarsittingPendientes(); return; }
  return renderModulo();
}
function afterRrhhRender(){
  document.querySelectorAll('[data-rrhhtab]').forEach(b=>b.addEventListener('click', ()=>{ rrhhTab=b.dataset.rrhhtab; renderModulo(); }));
  cargarCarsittingPendientes();
  const body = document.getElementById('rrhh-body');
  // Devuelve la promesa del tab que quede activo, para que renderModulo() la propague y
  // agendarDesdeIntake pueda esperar a que el form de entrevista ya esté armado en el DOM
  // (con datos reales) antes de llenarlo, en vez de un setTimeout adivinado.
  if(rrhhTab==='intake') return renderIntake(body);
  if(rrhhTab==='entrevista') return renderEntrevista(body);
  if(rrhhTab==='guardadas') return renderGuardadas(body);
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
        const asunto = encodeURIComponent('¡Bienvenida al equipo de traslados de Parents’ Break!');
        const primerNombre = (p.nombre||'').split(' ')[0];
        const cuerpo = encodeURIComponent(`Hola ${primerNombre},\n\n¡Qué alegría contar con vos para hacer traslados con Parents’ Break! Ya vimos en tu entrevista que tenés licencia de conducir y ganas de sumarte a esta parte del equipo.\n\nPara terminar de darte de alta como carsitter, necesitamos que completes este formulario con los datos de tu auto y algunos datos más:\n\nhttps://forms.gle/J4QXgNJQ8kXMsA4C6\n\nCon esto ya vas a quedar lista para que te empecemos a asignar traslados.\n\nCualquier duda, escribinos.\n\nUn abrazo,\nParents’ Break`);
        const mailId = `carp-mail-${p.origen}-${p.id}`;
        const enviadoTxt = p.enviado ? `Último mail enviado: ${new Date(p.enviado).toLocaleDateString('es-UY',{day:'2-digit',month:'short'})}` : 'Todavía no se le mandó nada';
        const asuntoPersonal = encodeURIComponent('Parents’ Break');
        const cuerpoPersonal = encodeURIComponent(`Hola ${primerNombre},\n\n\n\nUn abrazo,\nParents’ Break`);
        return `<div class="agendarow" style="border-bottom:1px solid var(--line);flex-wrap:wrap;">
          <div>
            <div style="font-weight:600;">${escaparHtml(p.nombre)} <span class="badge" style="font-size:10px;">${p.origen==='ninera'?'niñera':'candidata'}</span></div>
            <div class="helper" style="margin:2px 0 0;">${enviadoTxt}</div>
            ${p.mail?'':`<input type="email" id="${mailId}" placeholder="mail de contacto" style="margin-top:6px;max-width:220px;">`}
          </div>
          <div style="display:flex;gap:8px;">
            <a class="smallbtn" style="text-decoration:none;"
               href="mailto:${escaparHtml(p.mail)}?subject=${asuntoPersonal}&body=${cuerpoPersonal}" target="_blank" rel="noopener"
               ${p.mail?'':`onmousedown="this.href='mailto:'+(document.getElementById(${argJs(mailId)}).value||'')+${argJs('?subject='+asuntoPersonal+'&body='+cuerpoPersonal)}"`}>Mail personalizado</a>
            <a class="smallbtn" style="text-decoration:none;" onclick="marcarCarsittingMailEnviado(${argJs(p.origen)},${argJs(p.id)})"
               href="mailto:${escaparHtml(p.mail)}?subject=${asunto}&body=${cuerpo}" target="_blank" rel="noopener"
               ${p.mail?'':`onmousedown="this.href='mailto:'+(document.getElementById(${argJs(mailId)}).value||'')+${argJs('?subject='+asunto+'&body='+cuerpo)}"`}>Enviar mail</a>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}
async function marcarCarsittingMailEnviado(origen, id){
  const tabla = origen==='ninera' ? 'ninieras' : 'candidatas';
  const { error } = await sb.from(tabla).update({carsitting_mail_enviado_at: new Date().toISOString()}).eq('id', id);
  if(error) toast('El mail se abrió, pero no se pudo anotar que se mandó: '+error.message, 'bad');
}
function errBox(e){ return `<div class="warnbox">Error de conexión con la base: ${escaparHtml(e?.message||e)}</div>`; }


/* ---- Candidatas a entrevistar (intake) ---- */
let intakeItems = [];
let intakeFiltro = 'Todas';
// Prefiere la fecha de nacimiento real (calcula la edad exacta) por sobre el campo de texto
// viejo -- antes esta lista solo miraba el texto viejo, así que una candidata con fecha
// cargada pero sin ese texto vencido aparecía como "edad s/d" aunque sí se supiera su edad.
function textoEdadCandidata(c){
  const calculada = calcularEdad(c.fecha_nacimiento);
  if(calculada!==null) return `${calculada} años`;
  return c.edad ? c.edad+(String(c.edad).length<=2?' años':'') : 'edad s/d';
}
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
  box.innerHTML = ['Todas','Niñera','Traslados','Ambas'].map(t=>`<button class="pillbtn ${intakeFiltro===t?'selected':''}" onclick="setIntakeFiltro(${argJs(t)})">${t}</button>`).join('');
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
    </div>
    ${checklistZonas('in', '', 'Zona')}
    <div class="grid3">
      <div class="field"><label>Edad</label><input type="text" id="in-edad"></div>
      <div class="field"><label>Cómo llegó</label><select id="in-origen"><option>Instagram / Form</option><option>Recomendada</option><option>Otro</option></select></div>
      <div class="field"><label>Experiencia (resumen)</label><input type="text" id="in-exp"></div>
    </div>
    <div class="field"><label>Tipo</label><select id="in-tipo"><option>Niñera</option><option>Traslados</option><option>Ambas</option></select></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>addIntake())">Agregar candidata</button>
    </div>`);
}
async function addIntake(){
  const nombre = document.getElementById('in-nombre').value.trim();
  if(!nombre){ toast('Falta el nombre.','bad'); return; }
  if(!(await confirmarNombreNuevo(nombre, [...intakeItems, ...candidatasItems], 'niñera'))) return;
  const item = { nombre, telefono:document.getElementById('in-tel').value, zona:leerZonasChecklist('in'),
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
      <div class="av" ${c.foto_url && c.autoriza_foto!==false?`style="cursor:zoom-in;" onclick="abrirLightboxFoto(${argJs(c.foto_url)}, ${argJs('Foto de '+c.nombre)})"`:''}>${c.foto_url?`<img loading="lazy" decoding="async" src="${urlSegura(c.foto_url)}" alt="Foto de ${escaparHtml(c.nombre)}" onerror="this.parentElement.textContent=${argJs((c.nombre||'?').charAt(0).toUpperCase())}">`:(c.nombre||'?').charAt(0).toUpperCase()}</div>
      <div class="info">
        <div class="name">${escaparHtml(c.nombre)} ${escaparHtml(c.apellido)}</div>
        <div class="meta">${escaparHtml(textoZonasConBarrios(c.zona, c.zona_barrios)||'zona s/d')} · ${escaparHtml(textoEdadCandidata(c))}${c.origen?escaparHtml(' · '+c.origen):''}</div>
      </div>
      <div class="badge-slot">
        <span class="badge brand" style="font-size:10px;padding:2px 8px;">${escaparHtml(c.tipo||'Niñera')}</span>
        ${c.autoriza_foto===false?'<div class="badge bad" style="font-size:9px;padding:2px 6px;margin-top:4px;">No autoriza foto</div>':''}
      </div>
      <div class="rowbtns">
        <button class="smallbtn" onclick="verFichaIntake(${i})">Ver ficha</button>
        <button class="smallbtn" onclick="agendarDesdeIntake(${i})">Agendar</button>
        <button class="smallbtn danger" onclick="conGuardado(this, ()=>descartarIntake(${argJs(c.id)}))">Descartar</button>
      </div>
    </div>`).join('') + '</div>';
}
function verFichaIntake(i){
  const c = intakeItems[i];
  const rows = FICHA_CAMPOS.filter(f=>c[f.key]).map(f=>`<div><b>${f.label}</b>${escaparHtml(c[f.key])}</div>`).join('');
  const fotoHtml = c.foto_url ? `<img src="${urlSegura(c.foto_url)}" alt="Foto de ${escaparHtml(c.nombre)}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;margin-bottom:12px;${c.autoriza_foto!==false?'cursor:zoom-in;':''}" ${c.autoriza_foto!==false?`onclick="abrirLightboxFoto(${argJs(c.foto_url)}, ${argJs('Foto de '+c.nombre)})"`:''} onerror="fotoNoSePudoMostrar(this, ${argJs(c.foto_url)})">` : '';
  const avisoHtml = c.autoriza_foto === false ? `<div style="background:var(--clay-soft);color:var(--clay-text);font-weight:600;font-size:13px;padding:10px 14px;border-radius:10px;margin-bottom:14px;border:1px solid var(--clay);">⚠️ No autorizó el uso de su foto ni sus datos para el proceso de selección — no usar su imagen ni compartir su información fuera de la evaluación.</div>` : '';
  abrirModal(`${avisoHtml}${fotoHtml}<h2 style="margin:0 0 10px;">${escaparHtml(c.nombre)} ${escaparHtml(c.apellido)}</h2><div class="fichadl">${rows||'<div>Sin más datos cargados.</div>'}</div>`);
}
async function descartarIntake(id){
  if(!(await confirmarAccion('¿Descartar esta candidata? No se puede deshacer.', 'Descartar'))) return;
  const { error } = await sb.from('candidatas').delete().eq('id', id);
  if(error){ toast('No se pudo descartar: '+error.message,'bad'); return; }
  loadIntake();
}
async function agendarDesdeIntake(i){
  const c = intakeItems[i];
  rrhhTab = 'entrevista';
  await renderModulo(); // espera a que el form de entrevista ya esté armado (preguntas + zonas cargadas)
  document.getElementById('f-nombre').value = (c.nombre||'') + (c.apellido? ' '+c.apellido:'');
  document.getElementById('f-telefono').value = c.telefono||'';
  setZonasChecklist('f', c.zona||'', 'Zona');
  document.getElementById('f-origen').value = c.origen||'';
  document.getElementById('f-exp-previa').value = c.experiencia||'';
  document.getElementById('f-fecha-nac').value = c.fecha_nacimiento||'';
  actualizarEdadCandidata();
  entrevistaState.tipo = c.tipo || 'Niñera';
  entrevistaState.fichaOrigen = c;
  entrevistaState.candidataId = c.id;
  renderFichaOrigen();
}
function actualizarEdadCandidata(){
  const inp = document.getElementById('f-fecha-nac');
  const out = document.getElementById('f-edad-calculada');
  if(!inp || !out) return;
  const edad = calcularEdad(inp.value);
  out.value = edad!==null ? `${edad} años` : '';
}
/* Bloques del formulario público en la entrevista (05/10/2026, E6). Son los mismos campos que
   manda el formulario (candidatas-webhook) y en el mismo orden; nombre, teléfono, zona y fecha
   de nacimiento van arriba, en "Datos de la entrevista". Se muestran SIEMPRE: precargados y
   editables si completó el formulario, vacíos y editables si no (cargada a mano, o entrevista
   que arranca de cero), para completarlos durante la charla. */
const CAMPOS_FORM_ENTREVISTA = ['disponibilidad','bachillerato','experiencia','universidad','cocina','idiomas','licencia','mail','cambia_panales','dispone_traslados','disponible_tipo','fechas_punta','trabaja_actualmente','capacitacion_extra','primeros_auxilios','comentarios','cuenta_bancaria'];
// De formularios viejos (ya no se preguntan): aparecen solo si la candidata tiene el dato.
const CAMPOS_FORM_VIEJOS = ['edad','patologias'];
function camposFichaEntrevista(c){
  const etiqueta = k => k==='cuenta_bancaria' ? 'Cuenta bancaria (banco, número y sucursal)' : (FICHA_CAMPOS.find(f=>f.key===k)?.label || k);
  const datos = datosFichaCandidata(c);
  return [...CAMPOS_FORM_ENTREVISTA, ...CAMPOS_FORM_VIEJOS.filter(k=>datos[k])].map(key=>({key, label:etiqueta(key)}));
}
function renderFichaOrigen(){
  const box = document.getElementById('fichaOrigenBox');
  if(!box) return;
  registrarRenderizadorZona('ent-zonasitting', renderFichaOrigen);
  const c = entrevistaState.fichaOrigen || {};
  const completoForm = /form/i.test(c.origen||'');
  const notas = c.notas_ficha || {};
  // "Zona en la que puede hacer sitting" es la única categórica de verdad acá (mismo listado
  // de zonas que ya usan Niñeras/Familias) — se edita con el mismo checklist reusable, así el
  // valor final queda expandido de una. El resto son de texto libre: un solo textarea por
  // ítem, que arranca con lo que ella escribió (o con lo último que se guardó en una
  // entrevista anterior) y se puede seguir escribiendo o editar directo ahí mismo — no hay
  // un texto fijo separado de la caja para agregar más.
  const campos = camposFichaEntrevista(c);
  const filasTexto = campos.map(f=>`
    <div class="fichadl-row">
      <label>${escaparHtml(f.label)}</label>
      <textarea id="ent-nota-${f.key}" placeholder="${completoForm ? 'Sin dato del form — se puede escribir acá' : 'Completalo durante la entrevista'}">${escaparHtml(notas[f.key]!==undefined ? notas[f.key] : c[f.key])}</textarea>
    </div>`).join('');
  box.innerHTML = `<div class="card card-collapsible">${cardHeaderConColapso('Ficha del formulario')}<div class="card-body">
    <div class="helper">${completoForm ? 'Se puede editar directo — arranca con lo que ella puso en el form.' : 'No completó el formulario: estos son los mismos campos, para completarlos en la entrevista.'}</div>
    <div class="fichadl">${checklistZonas('ent-zonasitting', c.zona_sitting, 'Zona en la que puede hacer sitting')}${htmlBarriosMarcados(c.zona_sitting, c.zona_sitting_barrios, 'En el formulario marcó')}${filasTexto}</div>
  </div></div>`;
}

/* ---- Entrevista ---- */
let entrevistaState = { competencias:{}, redflags:{}, refs:[], candidataId:null, fichaOrigen:null, tipo:'Niñera', explicacionJuegos:null };
async function renderEntrevista(body){
  if(!entrevistaPreguntasCache) await cargarEntrevistaPreguntas();
  if(!zonaGruposCache) await cargarZonaGrupos(); // para los selectores de zona de la entrevista
  body.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
        <h2 style="margin:0;">Datos de la entrevista</h2>
      </div>
      <div class="grid3">
        <div class="field"><label>Nombre de la candidata</label><input type="text" id="f-nombre"></div>
        <div class="field"><label>Fecha</label><input type="date" id="f-fecha"></div>
        <div class="field"><label>Entrevistó</label><select id="f-entrevisto"><option value="">Elegir…</option><option ${registradoPorUsuario()==='Paulina G'?'selected':''}>Paulina G</option><option ${registradoPorUsuario()==='Delfina F'?'selected':''}>Delfina F</option><option>Otra</option></select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Teléfono</label><input type="tel" id="f-telefono"></div>
        <div class="field"><label>Rol pensado</label><select id="f-rol"><option value="">Elegir…</option><option>Turno fijo semanal</option><option>Sittings espontáneos</option><option>Traslados</option><option>Sin definir</option></select></div>
      </div>
      ${checklistZonas('f', '', 'Zona')}
      <div class="grid2">
        <div class="field"><label>Fecha de nacimiento</label><input type="date" id="f-fecha-nac" oninput="actualizarEdadCandidata()"></div>
        <div class="field"><label>Edad</label><input type="text" id="f-edad-calculada" disabled placeholder="—"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Cómo llegó</label><input type="text" id="f-origen"></div>
        <div class="field"><label>Experiencia previa (resumen)</label><input type="text" id="f-exp-previa"></div>
      </div>
    </div>
    <div id="fichaOrigenBox"></div>
    <div class="editpreguntasbox"><a href="#" onclick="abrirModalEditarPreguntas();return false;">Editar preguntas de la entrevista</a></div>
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
      <button class="btn primary" id="btnGuardar" onclick="conGuardado(this, ()=>guardarCandidata())">Guardar candidata</button>
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
    <div class="card card-collapsible">${cardHeaderConColapso(c.titulo)}<div class="card-body">${preguntas.length? preguntas.map(p=>`<div class="q">${escaparHtml(p)}</div>`).join('') : `<div class="helper">${c.helper||''}</div>`}
      <textarea placeholder="Notas de la respuesta…" data-notes="${c.key}"></textarea>
      <div class="scorebar" data-scorebar="${c.key}">${[1,2,3,4,5].map(n=>`<div class="scorebtn" data-score="${c.key}:${n}">${n}</div>`).join('')}</div>
      <div class="scorelabels"><span>Preocupa</span><span>Muy sólida</span></div></div></div>
  `; }).join('');
  bindCompetenciaHandlers(cont);
}
function renderCompetenciasFinales(){
  const cont = document.getElementById('competencias-finales');
  if(!cont) return;
  cont.innerHTML = COMP_FINALES.map(c => { const preguntas = preguntasDe(c.key); return `
    <div class="card card-collapsible">${cardHeaderConColapso(c.titulo)}<div class="card-body">${preguntas.length? preguntas.map(p=>`<div class="q">${escaparHtml(p)}</div>`).join('') : `<div class="helper">${c.helper||''}</div>`}
      <textarea placeholder="Notas de la respuesta…" data-notes="${c.key}"></textarea>
      <div class="scorebar" data-scorebar="${c.key}">${[1,2,3,4,5].map(n=>`<div class="scorebtn" data-score="${c.key}:${n}">${n}</div>`).join('')}</div>
      <div class="scorelabels"><span>Preocupa</span><span>Muy sólida</span></div></div></div>
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
      <input type="text" placeholder="Nombre" value="${escaparHtml(r.name)}" oninput="entrevistaState.refs[${i}].name=this.value">
      <input type="tel" placeholder="Teléfono" value="${escaparHtml(r.phone)}" oninput="entrevistaState.refs[${i}].phone=this.value">
      <input type="text" placeholder="Relación" value="${escaparHtml(r.relacion)}" oninput="entrevistaState.refs[${i}].relacion=this.value">
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
  // Ficha del formulario: la zona de sitting (checklist) y lo que se escribió en cada campo.
  // Si la candidata ya existía (formulario o carga a mano), lo editado va a notas_ficha y su
  // respuesta original queda intacta. Si la entrevista arrancó de cero, no hay respuesta
  // original: los valores van directo a sus campos.
  const nuevaZonaSitting = leerZonasChecklist('ent-zonasitting');
  const valoresFicha = {};
  camposFichaEntrevista(entrevistaState.fichaOrigen||{}).forEach(f=>{
    const val = document.getElementById(`ent-nota-${f.key}`)?.value.trim();
    if(val) valoresFicha[f.key] = val;
  });
  const extraFicha = candidataId
    ? { zona_sitting: nuevaZonaSitting || null, notas_ficha: valoresFicha }
    : { ...valoresFicha, zona_sitting: nuevaZonaSitting || null };
  if(candidataId){
    const { error } = await sb.from('candidatas').update({ estado:'entrevistada', telefono:document.getElementById('f-telefono').value, zona:leerZonasChecklist('f'), fecha_nacimiento: document.getElementById('f-fecha-nac').value || null, ...extraFicha }).eq('id', candidataId);
    if(error){ warnArea.innerHTML = errBox(error); return; }
  } else {
    if(!(await confirmarNombreNuevo(nombre, [...intakeItems, ...candidatasItems], 'niñera'))) return;
    const { data, error } = await sb.from('candidatas').insert({
      nombre, telefono:document.getElementById('f-telefono').value, zona:leerZonasChecklist('f'),
      origen:document.getElementById('f-origen').value,
      fecha_nacimiento: document.getElementById('f-fecha-nac').value || null,
      tipo: entrevistaState.tipo || 'Niñera', estado:'entrevistada', ...extraFicha,
      // "Experiencia previa (resumen)" de arriba manda; si quedó vacía, la del bloque del form.
      experiencia: document.getElementById('f-exp-previa').value || valoresFicha.experiencia || null,
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
      <div><div class="name">${escaparHtml(cd.nombre)} ${cd.estado==='contratada'?'✓':''}</div><div class="meta">${escaparHtml(c.fecha||'sin fecha')} · ${escaparHtml(textoZonasConBarrios(cd.zona, cd.zona_barrios)||'zona s/d')} · ${escaparHtml(c.rol||'rol s/d')}</div></div>
      <div class="sc"><div class="n">${Number(c.total).toFixed(1)} / 5</div><span class="badge ${c.recomendacion==='Recomendada'?'good':c.recomendacion==='No recomendada'?'bad':'warn'}">${cd.estado==='contratada'?'Contratada':escaparHtml(c.recomendacion)}</span></div>
    </button>`;
  }).join('');
}
function verDetalle(i){
  const c = candidatasItems[i];
  const cd = c.candidatas;
  const compRowHtml = comp => { const d=c.puntajes[comp.key]||{}; return `<div class="card"><h2>${comp.titulo} — <span style="color:var(--accent)">${d.score||'—'}/5</span></h2><div class="helper" style="margin-top:6px;">${escaparHtml(d.notes||'(sin notas)')}</div></div>`; };
  const compHtml = COMP_PRINCIPALES.map(compRowHtml).join('');
  const compHtmlFinal = COMP_FINALES.map(compRowHtml).join('');
  const flags = REDFLAGS.filter(f=>c.redflags[f.key]);
  const refs = c.referencias||[];
  const refsHtml = refs.length ? refs.map(r=>`<div class="q">${escaparHtml(r.name||'(sin nombre)')} · ${escaparHtml(r.phone||'sin tel')} · ${escaparHtml(r.relacion||'—')} ${r.confirmado?'· ✓ confirmada':''}</div>`).join('') : '<div class="helper">Sin referencias.</div>';
  const psicoHtml = c.psico ? PSICO_IMGS.map(img=>`<div class="q"><b>${img.id}:</b> ${escaparHtml(c.psico[img.id]||'(sin respuesta anotada)')}</div>`).join('') : '';
  const notasCd = cd.notas_ficha || {};
  const fichaHtml = `<div class="card"><h2>Ficha del formulario</h2><div class="fichadl">${FICHA_CAMPOS.filter(f=>cd[f.key]||notasCd[f.key]).map(f=>`<div><b>${f.label}</b>${escaparHtml(notasCd[f.key]!==undefined ? notasCd[f.key] : (f.key==='zona_sitting' ? textoZonasConBarrios(cd.zona_sitting, cd.zona_sitting_barrios) : cd[f.key]))}</div>`).join('')}${datosFichaCandidata(cd).cuenta_bancaria ? `<div><b>Cuenta bancaria</b>${escaparHtml(datosFichaCandidata(cd).cuenta_bancaria)}</div>` : ''}${FICHA_CAMPOS.some(f=>cd[f.key]||notasCd[f.key]) || datosFichaCandidata(cd).cuenta_bancaria ? '' : '<div>Sin datos.</div>'}</div></div>`;
  abrirModal(`
    <div class="card resultcard">
      <div class="gauge" style="background:conic-gradient(${c.recomendacion==='Recomendada'?'var(--good)':c.recomendacion==='No recomendada'?'var(--bad)':'var(--warn)'} ${c.total/5*100}%, var(--line) 0);"><div class="inner"><div class="num">${Number(c.total).toFixed(1)}</div><div class="max">/ 5</div></div></div>
      <div><h2 style="font-size:20px;">${escaparHtml(cd.nombre)}</h2><div class="helper" style="margin:4px 0;">${escaparHtml(c.fecha)} · ${escaparHtml(textoZonasConBarrios(cd.zona, cd.zona_barrios))} · ${escaparHtml(c.rol)} · tel ${escaparHtml(cd.telefono||'—')}</div><span class="badge ${c.recomendacion==='Recomendada'?'good':c.recomendacion==='No recomendada'?'bad':'warn'}">${escaparHtml(c.recomendacion)}</span></div>
    </div>
    ${fichaHtml}
    <div id="cg-carsitting"></div>
    ${compHtml}
    <div class="card"><h2>Explicación de juegos y capacitación</h2><div class="q">¿Explicó bien los juegos? <b>${escaparHtml(c.explicacion_juegos||'—')}</b></div><div class="helper">${escaparHtml(cd.capacitacion_extra||'(sin capacitación extra registrada)')}</div></div>
    <div class="card"><h2>Psicotécnico (guía de observación)</h2>${psicoHtml}</div>
    ${compHtmlFinal}
    <div class="card"><h2>Señales de alerta</h2>${flags.length?flags.map(f=>`<div class="q">${f.texto}${f.critico?' · crítico':''}</div>`).join(''):'<div class="helper">Ninguna marcada.</div>'}</div>
    <div class="card"><h2>Referencias</h2>${refsHtml}</div>
    <div class="card"><h2>Notas finales</h2><div class="helper">${escaparHtml(c.notas||'(sin notas)')}</div></div>
    ${cd.estado==='contratada' ? '<div class="okbox">Ya está contratada — figura en la sección Niñeras.</div>' : `
    <div class="card"><h2>Contratar</h2>
      <div class="grid3">
        <div class="field"><label>Foto (URL, opcional)</label><input type="text" id="hire-foto" value="${escaparHtml(cd.foto_url)}" placeholder="link de Drive/Canva"></div>
      </div>
      ${checklistZonas('hire', [cd.zona, cd.zona_sitting].filter(Boolean).join('/'), 'Zonas donde trabaja (confirmar: viene marcado dónde vive y dónde dijo que puede)')}
      ${htmlBarriosMarcados([cd.zona, cd.zona_sitting].filter(Boolean).join('/'), unirBarrios(cd.zona_barrios, cd.zona_sitting_barrios), 'En el formulario marcó')}
      <div id="hire-temp-wrap"></div>
      <div class="helper">El precio por hora se define por familia en la sección "Familias".</div>
      <button class="btn primary" onclick="conGuardado(this, ()=>contratar(${argJs(cd.id)}))">Pasar a Niñeras</button>
    </div>`}
    <div class="actions"><button class="btn danger" onclick="conGuardado(this, ()=>eliminarCandidata(${argJs(cd.id)}))">Eliminar candidata</button></div>
  `);
  cargarCarsittingSeccion(cd.nombre, 'cg-carsitting', cd.tipo, cd.mail);
  if(cd.estado!=='contratada') pintarContratarTemporada(cd);
}
/* Temporada en Punta del Este al contratar: la respuesta del formulario ya viene traducida a
   quincenas (candidatas.temporada_quincenas, la arma candidatas-webhook). Se muestra precargada
   para revisarla acá mismo, y al pasar a Niñeras queda guardada como su temporada -- así la
   niñera nueva no arranca con el badge de "Sin temporada". Si marcó alguna quincena y su zona
   no incluye Punta del Este (vive en Pocitos pero veranea allá), se le agrega sola, porque si no
   nunca aparecería al buscar Punta del Este. */
function grupoPuntaDelEste(){
  const fuera = (zonaGruposCache||[]).filter(g=>g.fuera_de_montevideo);
  return fuera.find(g=>(g.zonas||[]).some(z=>normaliza(z)==='punta del este')) || fuera[0] || null;
}
async function pintarContratarTemporada(cd){
  if(!zonaGruposCache) await cargarZonaGrupos();
  const wrap = document.getElementById('hire-temp-wrap');
  const grupo = grupoPuntaDelEste();
  if(!wrap || !grupo) return;
  asegurarEstilosTemporada();
  const qs = Array.isArray(cd.temporada_quincenas) ? cd.temporada_quincenas : null;
  const texto = (cd.fechas_punta||'').trim();
  let ayuda;
  if(texto && qs!==null) ayuda = `En el formulario puso "${escaparHtml(texto)}". Ya está marcado abajo, revisalo.`;
  else if(texto) ayuda = `En el formulario puso "${escaparHtml(texto)}", que no alcanza para saber las fechas. Marcalas si las sabés, o dejalo vacío y pedíselas después por WhatsApp desde Niñeras.`;
  else ayuda = 'No respondió esta pregunta en el formulario. Marcalas si las sabés.';
  wrap.innerHTML = `
    <div class="field" style="margin-top:4px;">
      <label>Temporada en ${escaparHtml(grupo.nombre)}</label>
      <div class="helper" style="margin:0 0 4px;">${ayuda}</div>
      ${htmlEditorTemporada('hire-temp', [grupo], {[grupo.id]: qs||[]})}
      <span data-temp-guardar="hire-temp" data-venia="${qs!==null?'1':''}" style="display:none;"></span>
    </div>`;
}
async function contratar(candidataId){
  const c = candidatasItems.find(x=>x.candidatas.id===candidataId);
  const cd = c.candidatas;
  const ninera = {
    candidata_id: candidataId, nombre:cd.nombre, telefono:cd.telefono, tipo:cd.tipo||'Niñera',
    zona: leerZonasChecklist('hire'), foto: document.getElementById('hire-foto').value, notas: c.notas,
  };
  // Si la candidata puso cuenta bancaria en el formulario, se copia sola a la ficha de
  // niñera (ahí es donde vive de verdad, como una cuenta más dentro del array).
  const cuentaFicha = datosFichaCandidata(cd).cuenta_bancaria; // la del form, o la corregida en la entrevista
  if(cuentaFicha) ninera.cuenta_bancaria = [cuentaFicha];
  // Barrios exactos que marcó en el formulario (dónde vive + dónde puede): quedan en su ficha
  // para ver el detalle ("Punta del Este (José Ignacio)"); se busca y filtra igual por zona.
  const barriosForm = unirBarrios(cd.zona_barrios, cd.zona_sitting_barrios);
  if(barriosForm) ninera.barrios = barriosForm;
  // Temporada: se guarda si venía del formulario o si se tocó el calendario acá.
  const marcaTemp = document.querySelector('[data-temp-guardar="hire-temp"]');
  if(marcaTemp && (marcaTemp.dataset.venia==='1' || marcaTemp.dataset.tocado==='1')){
    const temporada = leerEditorTemporada('hire-temp', {});
    ninera.temporada = temporada;
    ninera.temporada_actualizada_en = new Date().toISOString();
    ninera.temporada_fuente = marcaTemp.dataset.tocado==='1' ? 'sistema' : 'formulario';
    if(cd.fechas_punta) ninera.temporada_comentario = `Del formulario de postulación: "${cd.fechas_punta.trim()}"`;
    const grupoId = Object.keys(temporada)[0];
    const marcoAlgo = grupoId && temporada[grupoId].length>0;
    if(marcoAlgo && !gruposFueraDeZonaStr(ninera.zona).some(g=>g.id===grupoId)){
      const grupo = (zonaGruposCache||[]).find(g=>g.id===grupoId);
      if(grupo) ninera.zona = textoZonas([ninera.zona, grupo.nombre].filter(z=>(z||'').trim()).join('/'));
    }
  }
  const { error: e1 } = await sb.from('ninieras').insert(ninera);
  if(e1){ toast('No se pudo contratar: '+e1.message,'bad'); return; }
  const { error: e2 } = await sb.from('candidatas').update({ estado:'contratada' }).eq('id', candidataId);
  if(e2) toast('Niñera creada, pero no se pudo actualizar el estado: '+e2.message,'bad');
  else toast('Pasó a Niñeras.');
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

