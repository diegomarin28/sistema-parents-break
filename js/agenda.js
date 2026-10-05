/* ================= AGENDA (solicitudes) ================= */
let agendaAncla = null; // primer día visible — arranca siempre en hoy
let agendaFamilias = [];
let agendaNinierasBase = [];
let agendaSolicitudes = [];
let agendaResizeListenerAttached = false;
let agendaReemplazoNineraSel = null;

function agendaDiasVisibles(){ return 7; } // la página siempre es de una semana — lo que cambia con el ancho es CÓMO se dibuja (ver agendaEsMobile)
function agendaEsMobile(){ return window.innerWidth <= 760; }
function attachAgendaResizeListener(){
  if(agendaResizeListenerAttached) return;
  agendaResizeListenerAttached = true;
  let resizeTimer = null;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=>{
      if(moduloActivo!=='agenda') return;
      const lbl = document.getElementById('agenda-fecha-label');
      if(lbl) lbl.textContent = agendaRangoLabel();
      renderAgendaGrid();
    }, 200);
  });
}
const AGENDA_START_MIN = 480, AGENDA_END_MIN = 1200, AGENDA_ROWH = 35;
const AGENDA_GRIDH = Math.round(((AGENDA_END_MIN-AGENDA_START_MIN)/60)*AGENDA_ROWH);

function agendaMinutos(hhmm){
  if(!hhmm) return null;
  const [h,m] = hhmm.split(':').map(Number);
  return h*60+(m||0);
}
function agendaTop(hhmm){
  const min = agendaMinutos(hhmm);
  if(min==null) return 0;
  return Math.max(0, Math.min(AGENDA_GRIDH, ((min-AGENDA_START_MIN)/60)*AGENDA_ROWH));
}
function agendaAlto(inicio, fin, cruza){
  const mi = agendaMinutos(inicio);
  if(mi==null) return 40;
  if(cruza){
    return Math.max(28, AGENDA_GRIDH - agendaTop(inicio));
  }
  const mf = agendaMinutos(fin);
  const dur = (mf!=null && mf>mi) ? (mf-mi) : 60;
  return Math.max(28, (dur/60)*AGENDA_ROWH);
}
function agendaFechaLarga(f){
  const d = new Date(f+'T00:00:00');
  const s = new Intl.DateTimeFormat('es-UY',{weekday:'long', day:'numeric', month:'long'}).format(d);
  return s.charAt(0).toUpperCase()+s.slice(1);
}
const AGENDA_MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function agendaRangoLabel(){
  const n = agendaDiasVisibles();
  const d1 = new Date(agendaAncla+'T00:00:00');
  if(n===1) return agendaFechaLarga(agendaAncla);
  const d2 = new Date(d1); d2.setDate(d2.getDate()+n-1);
  const mismoMes = d1.getMonth()===d2.getMonth();
  return mismoMes
    ? `${d1.getDate()}–${d2.getDate()} ${AGENDA_MESES_CORTO[d1.getMonth()]}`
    : `${d1.getDate()} ${AGENDA_MESES_CORTO[d1.getMonth()]} – ${d2.getDate()} ${AGENDA_MESES_CORTO[d2.getMonth()]}`;
}
function cambiarAgendaRango(delta){
  const n = agendaDiasVisibles();
  const d = new Date(agendaAncla+'T00:00:00');
  d.setDate(d.getDate() + delta*n);
  agendaAncla = d.toISOString().slice(0,10);
  const lbl = document.getElementById('agenda-fecha-label');
  if(lbl) lbl.textContent = agendaRangoLabel();
  cargarAgendaSolicitudes();
}
function waLink(telefono, mensaje){
  let tel = (telefono||'').replace(/[^0-9]/g,'');
  if(!tel) return '#';
  if(!tel.startsWith('598')) tel = '598'+tel.replace(/^0+/,'');
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
}
function mensajeWA(s, nineraNombre){
  const horario = s.hora_fin ? `${s.hora_inicio.slice(0,5)} a ${s.hora_fin.slice(0,5)}` : s.hora_inicio.slice(0,5);
  const tipoTxt = s.tipo==='traslado' ? 'un traslado' : 'un sitting';
  const fechaTxt = new Date(s.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit'});
  return `Hola ${(nineraNombre||'').split(' ')[0]}! Te escribo de Parents’ Break — ¿podés cubrir ${tipoTxt} con la familia ${s.familia_nombre} el ${fechaTxt} de ${horario}${s.zona?` (zona ${s.zona})`:''}? Avisame si te queda bien.`;
}
function agendaTelefonoNinera(nombre){
  const n = agendaNinierasBase.find(x=>normaliza(x.nombre)===normaliza(nombre));
  return n ? n.telefono : '';
}
async function actualizarAgendaBadge(){
  const dot = document.getElementById('agenda-navdot');
  if(!dot) return;
  const { data, error } = await sb.from('solicitudes').select('id').in('estado', ['sin_asignar','pendiente_confirmar']).gte('fecha', todayISO());
  if(error) return;
  dot.innerHTML = (data && data.length) ? '<span class="navdot"></span>' : '';
}

async function renderAgenda(cont){
  agendaAncla = agendaAncla || todayISO();
  attachAgendaResizeListener();
  cont.innerHTML = moduloHeader('Agenda') + `
    <div class="mesbar">
      <div class="mesnav">
        <button onclick="cambiarAgendaRango(-1)" aria-label="Días anteriores"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="mesnav-label" id="agenda-fecha-label">${agendaRangoLabel()}</div>
        <button onclick="cambiarAgendaRango(1)" aria-label="Días siguientes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <button class="smallbtn" onclick="abrirModalNuevaSolicitud()">+ Nueva solicitud</button>
    </div>
    <div class="agenda-legend">
      <span><span class="agenda-dot dot-sinasignar"></span>Sin asignar</span>
      <span><span class="agenda-dot dot-pendiente"></span>Pendiente de confirmar</span>
      <span><span class="agenda-dot dot-confirmada"></span>Confirmada</span>
    </div>
    <div id="agenda-grid-wrap"><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>
  `;
  // cargarAgendaBase va primero (no en paralelo): cargarAgendaSolicitudes ahora
  // necesita agendaFamilias ya cargada para resolver la zona de cada registro.
  await cargarAgendaBase();
  await cargarAgendaSolicitudes();
}

async function cargarAgendaBase(){
  const [{data:fams}, {data:nins}] = await Promise.all([
    sb.from('familias').select('id,nombre,zona,telefono,cobro_hora,pago_hora').order('nombre'),
    sb.from('ninieras').select('id,nombre,zona,tipo,telefono').eq('activa', true).order('nombre'),
  ]);
  agendaFamilias = fams || [];
  agendaNinierasBase = nins || [];
}

function diaDeFecha(fechaISO){
  const d = new Date(fechaISO+'T00:00:00');
  return ['D','L','M','X','J','V','S'][d.getDay()];
}
async function cargarAgendaSolicitudes(){
  const wrap = document.getElementById('agenda-grid-wrap');
  if(wrap) wrap.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const n = agendaDiasVisibles();
  const d1 = new Date(agendaAncla+'T00:00:00');
  const d2 = new Date(d1); d2.setDate(d2.getDate()+n-1);
  const desde = agendaAncla, hasta = d2.toISOString().slice(0,10);

  const [{data:sols, error}, {data:asigs}, {data:registros}] = await Promise.all([
    sb.from('solicitudes').select('*, solicitud_ninieras(*)').gte('fecha', desde).lte('fecha', hasta).order('hora_inicio', {ascending:true}),
    sb.from('asignaciones').select('*, familias(nombre)'),
    sb.from('sittings_traslados').select('*').gte('fecha', desde).lte('fecha', hasta),
  ]);
  if(error){ if(wrap) wrap.innerHTML = errBox(error); return; }
  // Ya registrado en Sittings, por día+niñera+familia (antes era solo niñera+familia, sin día).
  const registradosSet = new Set((registros||[]).map(r=>r.fecha+'|'+normaliza(r.ninera_nombre||'')+'|'+normaliza(r.familia_nombre||'')));
  // Lo registrado desde un fijo queda vinculado a su asignación (05/10/2026): ese día el
  // fijo ya está cubierto aunque haya ido otra niñera (reemplazo) o no haya ido nadie.
  const registradosPorAsig = new Set((registros||[]).filter(r=>r.asignacion_id).map(r=>r.asignacion_id+'|'+r.fecha));

  // Solicitudes puntuales: al confirmar una niñera (guardarAsignacionDirecta) se crea de una
  // el registro real en Sittings & traslados -- si no se filtra acá, la solicitud confirmada
  // queda como tarjeta aparte, duplicada con el registro real del mismo día.
  const puntuales = (sols||[]).map(s=>({...s, ninieras: s.solicitud_ninieras||[], _fuente:'solicitud'}))
    .filter(s=>{
      const nineraConfirmada = (s.solicitud_ninieras||[]).find(x=>x.estado==='confirmada');
      if(!nineraConfirmada) return true; // sin niñera confirmada todavía, no puede tener registro real
      const yaRegistrado = registradosSet.has(s.fecha+'|'+normaliza(nineraConfirmada.ninera_nombre||'')+'|'+normaliza(s.familia_nombre||''));
      return !yaRegistrado;
    });

  // Horarios fijos: una instancia por cada día visible cuyo día de semana matchee.
  // Si ese día+niñera+familia ya tiene un registro real cargado en Sittings & traslados
  // (registradosSet), NO se agrega la tarjeta del fijo -- si no, queda duplicado: la
  // tarjeta "pendiente" del fijo Y la tarjeta del registro real, para el mismo día.
  const fijas = [];
  for(let i=0;i<n;i++){
    const d = new Date(d1); d.setDate(d.getDate()+i);
    const fechaISO = d.toISOString().slice(0,10);
    const diaSemana = diaDeFecha(fechaISO);
    // Solo dentro de su vigencia: antes un fijo se dibujaba en TODAS las semanas, pasadas
    // incluidas, con la niñera de hoy -- al cambiarla, el pasado aparecía como de la nueva (E2).
    (asigs||[]).filter(a=>Array.isArray(a.dias) && a.dias.includes(diaSemana) && asignacionVigenteEn(a, fechaISO)).forEach(a=>{
      const yaRegistrado = registradosPorAsig.has(a.id+'|'+fechaISO)
        || registradosSet.has(fechaISO+'|'+normaliza(a.ninera_nombre||'')+'|'+normaliza(a.familias?.nombre||''));
      if(yaRegistrado) return; // el registro real (en `registrados`, más abajo) ya cubre este día
      fijas.push({
        id: 'asig:'+a.id+'@'+fechaISO,
        fecha: fechaISO,
        _fuente: 'asignacion',
        _raw: a,
        _asigId: a.id,
        _yaRegistrado: false,
        familia_nombre: a.familias?.nombre || '(familia)',
        tipo: tipoAsignacion(a),
        hora_inicio: a.hora_inicio,
        hora_fin: a.hora_fin,
        termina_dia_siguiente: false,
        zona: null,
        cobro_familia: null,
        estado: 'confirmada',
        ninieras: [{ id:'asigninera:'+a.id+'@'+fechaISO, ninera_nombre:a.ninera_nombre, estado:'confirmada' }],
      });
    });
  }

  // Registros ya cargados en Sittings & traslados dentro del rango visible.
  const registrados = (registros||[]).map(r=>({
    id: 'reg:'+r.id,
    fecha: r.fecha,
    _fuente: 'registro',
    _regId: r.id,
    familia_nombre: r.familia_nombre || '(familia)',
    tipo: r.tipo,
    hora_inicio: r.hora_inicio,
    hora_fin: r.hora_fin,
    termina_dia_siguiente: r.termina_dia_siguiente || false,
    zona: agendaFamilias.find(f=>f.id===r.familia_id)?.zona || null,
    cobro_familia: r.cobro_familia,
    pago_ninera: r.pago_ninera,
    cancelado: r.cancelado || false,
    estado: 'confirmada',
    ninieras: [{ id:'regninera:'+r.id, ninera_nombre:r.ninera_nombre, estado:'confirmada' }],
  }));

  agendaSolicitudes = [...puntuales, ...fijas, ...registrados];
  renderAgendaGrid();
}

function renderAgendaGrid(){
  const wrap = document.getElementById('agenda-grid-wrap');
  if(!wrap) return;
  const n = agendaDiasVisibles();
  const hoy = todayISO();
  const dias = [];
  for(let i=0;i<n;i++){
    const d = new Date(agendaAncla+'T00:00:00');
    d.setDate(d.getDate()+i);
    dias.push(d.toISOString().slice(0,10));
  }
  const porDia = dias.map(fecha=>{
    const esHoy = fecha===hoy;
    const items = agendaSolicitudes
      .filter(s=>s.fecha===fecha && s.estado!=='cancelada')
      .sort((a,b)=>(a.hora_inicio||'').localeCompare(b.hora_inicio||''));
    const d = new Date(fecha+'T00:00:00');
    const diaLabel = new Intl.DateTimeFormat('es-UY',{weekday:'short'}).format(d).replace('.','');
    return { fecha, esHoy, items, numero: d.getDate(), diaLabel };
  });

  if(agendaEsMobile()){
    // Celular: lista vertical, un día abajo del otro — entran los 7 sin apretar
    // columnas ni scrollear al costado, solo hace falta scrollear para abajo.
    // Cada día tiene su propio fondo en el encabezado (no solo una línea fina)
    // para que se distinga bien uno de otro, y cada sitting es una sola línea
    // compacta — así un día con varios sittings no empuja tanto al resto.
    wrap.innerHTML = porDia.map(({fecha, esHoy, items, numero, diaLabel})=>`
      <div style="margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;margin-bottom:6px;background:${esHoy?'var(--accent-soft)':'var(--paper)'};">
          <div style="font-size:11px;font-weight:700;color:${esHoy?'var(--accent)':'var(--ink-soft)'};text-transform:uppercase;letter-spacing:0.03em;">${diaLabel}</div>
          <div style="font-size:16px;font-weight:700;color:${esHoy?'var(--accent)':'var(--ink)'};">${numero}</div>
          ${esHoy ? `<div style="font-size:10px;font-weight:700;color:var(--accent);background:var(--bg);padding:2px 7px;border-radius:100px;margin-left:2px;">HOY</div>` : ''}
        </div>
        ${items.length ? items.map(s=>renderAgendaFilaMobile(s)).join('') : '<div class="helper" style="padding:4px 10px;">Sin pedidos</div>'}
      </div>`).join('');
  } else {
    // Compu: columnas lado a lado, cada una crece según su propio contenido.
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(${n}, minmax(0,1fr));gap:8px;align-items:start;">
        ${porDia.map(({fecha, esHoy, items, numero, diaLabel})=>`
        <div style="border:1px solid ${esHoy?'var(--accent)':'var(--line)'};border-radius:12px;padding:8px;background:${esHoy?'var(--accent-soft)':'var(--paper)'};">
          <div style="text-align:center;margin-bottom:8px;">
            <div style="font-size:11px;color:${esHoy?'var(--accent)':'var(--ink-soft)'};font-weight:${esHoy?700:400};text-transform:uppercase;">${diaLabel}</div>
            <div style="font-size:16px;font-weight:700;color:${esHoy?'var(--accent)':'var(--ink)'};">${numero}</div>
          </div>
          ${items.length ? items.map(s=>renderAgendaTarjetaDia(s)).join('') : '<div class="helper" style="text-align:center;padding-top:16px;">Sin pedidos</div>'}
        </div>`).join('')}
      </div>
    `;
  }
}
function renderAgendaFilaMobile(s){
  const sinAsignar = !s.ninieras.length || s.ninieras.every(x=>x.estado!=='confirmada');
  const horaTxt = s.hora_inicio ? s.hora_inicio.slice(0,5) : '--:--';
  const ninTxt = s.ninieras.length ? s.ninieras.map(x=>(x.ninera_nombre||'').split(' ')[0]).join(' + ') : null;
  const esRegistro = s._fuente==='registro' && !s.cancelado;
  return `<div style="padding:7px 10px;border-bottom:1px solid var(--line);font-size:13px;cursor:pointer;" onclick="abrirModalSolicitud(${argJs(s.id)})">
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="color:var(--ink-soft);font-variant-numeric:tabular-nums;width:38px;flex-shrink:0;">${horaTxt}</div>
      <div style="flex:1;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escaparHtml(s.familia_nombre)}</div>
      ${s.cancelado
        ? `<span class="badge warn" style="font-size:10px;padding:2px 7px;flex-shrink:0;">Cancelado</span>`
        : esRegistro
          ? (s.zona ? `<span class="badge accent" style="font-size:10px;padding:2px 7px;flex-shrink:0;">${escaparHtml(s.zona)}</span>` : '')
          : `<div style="font-size:11px;font-weight:700;color:${sinAsignar?'var(--warn)':'var(--good)'};flex-shrink:0;">${sinAsignar ? 'Sin asignar' : escaparHtml(ninTxt)}</div>`}
    </div>
    ${esRegistro ? `<div style="display:flex;gap:14px;margin-top:4px;padding-left:46px;font-size:11px;color:var(--ink-soft);">
      <span>Cobro <b style="color:var(--ink);font-family:'IBM Plex Mono',monospace;">$${Number(s.cobro_familia||0).toLocaleString('es-UY')}</b></span>
      <span>Pago <b style="color:var(--ink);font-family:'IBM Plex Mono',monospace;">$${Number(s.pago_ninera||0).toLocaleString('es-UY')}</b></span>
    </div>` : ''}
  </div>`;
}
function renderAgendaTarjetaDia(s){
  const sinAsignar = !s.ninieras.length || s.ninieras.every(x=>x.estado!=='confirmada');
  const horaTxt = s.hora_inicio ? s.hora_inicio.slice(0,5) : 'Sin hora';
  const ninTxt = s.ninieras.length ? s.ninieras.map(x=>(x.ninera_nombre||'').split(' ')[0]).join(' + ') : null;
  const esRegistro = s._fuente==='registro' && !s.cancelado;
  return `<div style="background:var(--bg);border-radius:8px;padding:7px 8px;margin-bottom:6px;cursor:pointer;font-size:12px;" onclick="abrirModalSolicitud(${argJs(s.id)})">
    <div style="font-weight:700;color:var(--ink);margin-bottom:2px;">${escaparHtml(s.familia_nombre)}</div>
    <div class="helper" style="margin:0 0 4px;">${horaTxt}</div>
    ${s.cancelado
      ? `<span class="badge warn" style="font-size:10.5px;padding:3px 8px;">Cancelado</span>`
      : esRegistro
        ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-soft);margin-bottom:1px;"><span>Cobro</span><span style="font-family:'IBM Plex Mono',monospace;color:var(--ink);font-weight:600;">$${Number(s.cobro_familia||0).toLocaleString('es-UY')}</span></div>
           <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-soft);margin-bottom:${s.zona?'6px':'0'};"><span>Pago</span><span style="font-family:'IBM Plex Mono',monospace;color:var(--ink);font-weight:600;">$${Number(s.pago_ninera||0).toLocaleString('es-UY')}</span></div>
           ${s.zona ? `<span class="badge accent" style="font-size:10.5px;padding:3px 8px;">${escaparHtml(s.zona)}</span>` : ''}`
        : `<span class="badge ${sinAsignar?'warn':'good'}" style="font-size:10.5px;padding:3px 8px;">${sinAsignar ? 'Sin asignar' : escaparHtml(ninTxt)}</span>`}
  </div>`;
}

function onHoraSelectChange(){
  actualizarAgendaTotal();
  actualizarAgendaPrecioTraslado();
  actualizarPrecioSugeridoTraslado();
  actualizarCobroPagoPorHorario();
}
function selectHora(idPrefix, valHH='', valMM=''){
  const horas = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
  const mins = Array.from({length:60},(_,i)=>String(i).padStart(2,'0'));
  return `<div class="timepick">
    <select id="${idPrefix}-hh" onchange="onHoraSelectChange()"><option value="">--</option>${horas.map(h=>`<option value="${h}" ${h===valHH?'selected':''}>${h}</option>`).join('')}</select>
    <span>:</span>
    <select id="${idPrefix}-mm" onchange="onHoraSelectChange()"><option value="">--</option>${mins.map(m=>`<option value="${m}" ${m===valMM?'selected':''}>${m}</option>`).join('')}</select>
  </div>`;
}
function leerHora(idPrefix){
  const hh = document.getElementById(idPrefix+'-hh')?.value;
  if(!hh) return ''; // sin hora elegida, no hay horario — esto sí queda vacío
  const mm = document.getElementById(idPrefix+'-mm')?.value;
  return `${hh}:${mm || '00'}`; // minutos en blanco = :00, para no obligar a tocar los dos selectores siempre
}
function setHoraSelect(idPrefix, hhmm){
  if(!hhmm) return;
  const [hh,mm] = hhmm.slice(0,5).split(':');
  const selHH = document.getElementById(idPrefix+'-hh');
  const selMM = document.getElementById(idPrefix+'-mm');
  if(selHH) selHH.value = hh;
  if(selMM) selMM.value = mm; // ahora el selector tiene los 60 minutos — coincide exacto, sin redondear
}
function mostrarAgendaFamiliaDropdown(){
  const input = document.getElementById('agenda-familia');
  const dd = document.getElementById('agenda-familia-dropdown');
  if(!input || !dd) return;
  const q = normaliza(input.value.trim());
  const matches = agendaFamilias.filter(f=>!q || normaliza(f.nombre).includes(q)).slice(0,8);
  if(!matches.length){
    dd.innerHTML = q ? `<div class="autocomplete-empty">Ninguna familia coincide — se va a cargar como nueva.</div>` : '';
    dd.style.display = q ? 'block' : 'none';
    return;
  }
  dd.innerHTML = matches.map(f=>`<div class="autocomplete-item" onmousedown="elegirAgendaFamilia(${argJs(f.id)})">${escaparHtml(f.nombre)}</div>`).join('');
  dd.style.display = 'block';
}
function ocultarAgendaFamiliaDropdown(){
  setTimeout(()=>{ const dd = document.getElementById('agenda-familia-dropdown'); if(dd) dd.style.display='none'; }, 150);
}
function elegirAgendaFamilia(id){
  const f = agendaFamilias.find(x=>x.id===id);
  if(!f) return;
  document.getElementById('agenda-familia').value = f.nombre;
  const dd = document.getElementById('agenda-familia-dropdown');
  if(dd) dd.style.display = 'none';
  onAgendaFamiliaInput();
}
function onAgendaFamiliaInput(){
  mostrarAgendaFamiliaDropdown();
  const val = document.getElementById('agenda-familia').value;
  const f = agendaFamilias.find(x=>normaliza(x.nombre)===normaliza(val));
  const cobroInput = document.getElementById('agenda-cobro');
  if(f){
    // Si todavía no marcaron ninguna zona, se precargan las de la familia elegida.
    if(f.zona && !leerZonasChecklist('agenda')) setZonasChecklist('agenda', f.zona, 'Zona');
    if(cobroInput && !cobroInput.value && f.cobro_hora) cobroInput.value = f.cobro_hora;
  }
  actualizarAgendaTotal();
}
function onAgendaCruzaChange(){
  const cruza = document.getElementById('agenda-cruza-medianoche').checked;
  const wrapFin = document.getElementById('agenda-hora-fin-wrap');
  if(wrapFin) wrapFin.querySelector('.helper')?.remove();
  if(cruza && wrapFin){
    wrapFin.insertAdjacentHTML('beforeend', `<div class="helper" style="margin-top:4px;">Termina al día siguiente, a esta hora.</div>`);
  }
  actualizarAgendaTotal();
}
function onAgendaTipoChange(){
  const tipo = document.getElementById('agenda-tipo').value;
  document.getElementById('agenda-campo-sitting').style.display = tipo==='sitting' ? '' : 'none';
  document.getElementById('agenda-campo-traslado').style.display = tipo==='traslado' ? '' : 'none';
  document.getElementById('agenda-campo-traslado-cobro').style.display = tipo==='traslado' ? '' : 'none';
  document.getElementById('agenda-total-preview').textContent = '';
  if(tipo==='traslado' && !tarifaTrasladoConfig) cargarTarifaTrasladoConfig().then(actualizarAgendaPrecioTraslado);
  if(tipo==='traslado') actualizarAgendaPrecioTraslado();
}
// Mismo cálculo que en Sittings & traslados (tarifa base + km × precio/km, con recargo
// horario) -- antes esta pantalla nunca miraba los km, usaba siempre la tarifa por hora
// de un sitting común, aunque el tipo elegido fuera Traslado.
function actualizarAgendaPrecioTraslado(){
  const box = document.getElementById('agenda-traslado-precio-box');
  if(!box) return;
  if(!tarifaTrasladoConfig){ box.style.display='none'; return; }
  const km = Number(document.getElementById('agenda-km')?.value||0);
  box.style.display = '';
  if(!km){ box.innerHTML = `<div class="helper" style="margin:0;">Cargá los km para ver el precio sugerido.</div>`; return; }
  const cfg = tarifaTrasladoConfig;
  const hora = leerHora('agenda-hora-inicio');
  const mult = multiplicadorHorarioTraslado(hora);
  const base = Number(cfg.tarifa_base)||0;
  const porKm = Number(cfg.precio_km)||0;
  const premium = Number(cfg.margen_premium)||1;
  const margenNinera = Number(cfg.margen_ninera)||0;
  const crudo = (base + km*porKm) * mult * premium;
  const cobro = redondearArriba50(crudo);
  const pago = redondearAbajo50(crudo * (1 - margenNinera));
  const cobroInput = document.getElementById('agenda-cobro-traslado');
  if(cobroInput && !cobroInput.dataset.tocadoManual){ cobroInput.value = cobro; marcarCampoSugerido('agenda-cobro-traslado'); }
  box.innerHTML = `
    <div class="helper" style="margin:0;">Precio sugerido: <b>$${cobro.toLocaleString('es-UY')}</b> a cobrar (ya cargado arriba, con el borde punteado — lo podés editar) · a la niñera le correspondería ~$${pago.toLocaleString('es-UY')} cuando se le asigne.</div>`;
}
function actualizarAgendaTotal(){
  const el = document.getElementById('agenda-total-preview');
  if(!el) return;
  if(document.getElementById('agenda-tipo')?.value==='traslado'){ el.textContent=''; return; }
  const tarifa = Number(document.getElementById('agenda-cobro')?.value||0);
  const hi = leerHora('agenda-hora-inicio');
  const hf = leerHora('agenda-hora-fin');
  const cruza = document.getElementById('agenda-cruza-medianoche')?.checked;
  if(!tarifa || !hi || !hf){ el.textContent=''; return; }
  const mi = agendaMinutos(hi), mf = agendaMinutos(hf);
  const durMin = cruza ? ((24*60-mi)+mf) : (mf-mi);
  if(durMin<=0){ el.textContent = !cruza && mf<=mi ? 'La hora de fin tiene que ser después de la de inicio (o marcá "Termina al día siguiente").' : ''; return; }
  const horas = durMin/60;
  const total = tarifa*horas;
  el.textContent = `Total estimado: $${Math.round(total).toLocaleString('es-UY')} (${horas.toFixed(1).replace('.0','')} h)`;
}
let agendaModoNueva = 'puntual';
function onAgendaModoChange(modo){
  agendaModoNueva = modo;
  document.getElementById('agenda-modo-puntual-btn').classList.toggle('selected', modo==='puntual');
  document.getElementById('agenda-modo-repetir-btn').classList.toggle('selected', modo==='repetir');
  document.getElementById('agenda-bloque-puntual').style.display = modo==='puntual' ? 'block' : 'none';
  document.getElementById('agenda-bloque-repetir').style.display = modo==='repetir' ? 'block' : 'none';
}
function toggleAgendaDia(btn){
  btn.classList.toggle('selected');
  renderAgendaHorarioPorDia();
}
function onAgendaRepetirVariaChange(){
  const varia = document.getElementById('agenda-repetir-varia').checked;
  document.getElementById('agenda-repetir-horario-unico').style.display = varia ? 'none' : 'grid';
  document.getElementById('agenda-repetir-horario-por-dia').style.display = varia ? 'block' : 'none';
  if(varia) renderAgendaHorarioPorDia();
}
function renderAgendaHorarioPorDia(){
  const cont = document.getElementById('agenda-repetir-horario-por-dia');
  if(!cont || cont.style.display==='none') return;
  const dias = [...document.querySelectorAll('#agenda-repetir-dias .daybtn.selected')].map(b=>b.dataset.dia);
  if(!dias.length){ cont.innerHTML = '<div class="helper">Elegí los días primero.</div>'; return; }
  cont.innerHTML = dias.map(d=>`
    <div class="grid3" style="align-items:end;margin-bottom:8px;">
      <div class="field" style="margin-bottom:0;"><label>${DIAS_CORTO[d]}</label></div>
      <div class="field" style="margin-bottom:0;">${selectHora('agenda-rep-hi-'+d)}</div>
      <div class="field" style="margin-bottom:0;">${selectHora('agenda-rep-hf-'+d)}</div>
    </div>`).join('');
}
function abrirModalNuevaSolicitud(){
  agendaModoNueva = 'puntual';
  const html = `
    <h2>Nueva solicitud</h2>
    <div class="field" style="position:relative;">
      <label>Familia</label>
      <input type="text" id="agenda-familia" autocomplete="off" oninput="onAgendaFamiliaInput()" onfocus="mostrarAgendaFamiliaDropdown()" onblur="ocultarAgendaFamiliaDropdown()" placeholder="Escribí el nombre — si es nueva, se carga igual">
      <div id="agenda-familia-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
    </div>
    <div class="tiporow" style="margin-bottom:14px;">
      <button type="button" class="tipobtn selected" id="agenda-modo-puntual-btn" onclick="onAgendaModoChange('puntual')">Puntual</button>
      <button type="button" class="tipobtn" id="agenda-modo-repetir-btn" onclick="onAgendaModoChange('repetir')">Fijo (se repite)</button>
    </div>
    <div id="agenda-bloque-puntual">
      <div class="grid2">
        <div class="field"><label>Tipo</label><select id="agenda-tipo" onchange="onAgendaTipoChange()"><option value="sitting">Sitting</option><option value="traslado">Traslado</option></select></div>
        <div class="field"><label>Fecha</label><input type="date" id="agenda-nueva-fecha" value="${agendaAncla}"></div>
      </div>
      ${checklistZonas('agenda', '', 'Zona')}
      <div class="grid3">
        <div class="field"><label>Hora inicio</label>${selectHora('agenda-hora-inicio')}</div>
        <div class="field" id="agenda-hora-fin-wrap"><label>Hora fin</label>${selectHora('agenda-hora-fin')}</div>
        <div class="field" id="agenda-campo-sitting"><label>Tarifa por hora</label><div class="moneyfield"><input type="number" id="agenda-cobro" oninput="actualizarAgendaTotal()"></div></div>
        <div class="field" id="agenda-campo-traslado" style="display:none;">
          <label>Km recorridos</label><input type="number" step="0.1" id="agenda-km" oninput="actualizarAgendaPrecioTraslado()">
        </div>
      </div>
      <div id="agenda-traslado-precio-box" style="display:none;margin:-4px 0 10px;"></div>
      <div class="field" id="agenda-campo-traslado-cobro" style="display:none;"><label>Cobro total del traslado</label><div class="moneyfield"><input type="number" id="agenda-cobro-traslado" oninput="marcarCampoEditadoManual('agenda-cobro-traslado')"></div></div>
      <label class="chk" style="margin:-4px 0 10px;"><input type="checkbox" id="agenda-cruza-medianoche" onchange="onAgendaCruzaChange()"> Termina al día siguiente</label>
      <div class="helper" id="agenda-total-preview" style="min-height:16px;"></div>
    </div>
    <div id="agenda-bloque-repetir" style="display:none;">
      <div class="field" style="position:relative;"><label>Niñera</label>
        <input type="text" id="agenda-repetir-ninera" autocomplete="off" placeholder="Escribí el nombre de la niñera">
        <div id="agenda-repetir-ninera-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Tipo</label><select id="agenda-repetir-tipo"><option value="sitting">Sitting</option><option value="traslado">Traslado</option></select></div>
        <div class="field"><label>Desde</label><input type="date" id="agenda-repetir-desde" value="${todayISO()}"></div>
      </div>
      <div class="field"><label>Días</label>
        <div class="dayrow" id="agenda-repetir-dias">
          ${['L','M','X','J','V','S','D'].map(d=>`<button type="button" class="daybtn" data-dia="${d}" onclick="toggleAgendaDia(this)">${DIAS_CORTO[d]}</button>`).join('')}
        </div>
      </div>
      <label class="chk"><input type="checkbox" id="agenda-repetir-varia" onchange="onAgendaRepetirVariaChange()"> El horario cambia según el día</label>
      <div id="agenda-repetir-horario-unico" class="grid2" style="margin-top:6px;">
        <div class="field"><label>Hora inicio</label>${selectHora('agenda-rep-hi')}</div>
        <div class="field"><label>Hora fin</label>${selectHora('agenda-rep-hf')}</div>
      </div>
      <div id="agenda-repetir-horario-por-dia" style="display:none;margin-top:6px;"></div>
    </div>
    <div id="agenda-nueva-warn"></div>
    <button class="btn primary" style="width:100%;margin-top:6px;" onclick="guardarSolicitud(event)">Guardar solicitud</button>
  `;
  abrirModal(html);
  setTimeout(()=>attachAutocomplete('agenda-repetir-ninera', 'agenda-repetir-ninera-dropdown', ()=>agendaNinierasBase, ()=>{}), 20);
}
async function guardarSolicitud(ev){
  const btn = ev?.target;
  if(btn){ if(btn.disabled) return; btn.disabled = true; }
  try {
    if(agendaModoNueva==='repetir') return await guardarAsignacionFijaNueva();
    return await guardarSolicitudPuntual();
  } finally {
    if(btn) btn.disabled = false;
  }
}
async function guardarSolicitudPuntual(){
  const familiaTxt = document.getElementById('agenda-familia').value.trim();
  const tipo = document.getElementById('agenda-tipo').value;
  const zona = leerZonasChecklist('agenda');
  const fecha = document.getElementById('agenda-nueva-fecha').value;
  const horaInicio = leerHora('agenda-hora-inicio');
  const horaFin = leerHora('agenda-hora-fin');
  const cruza = document.getElementById('agenda-cruza-medianoche').checked;
  const tarifa = document.getElementById('agenda-cobro').value;
  const warn = document.getElementById('agenda-nueva-warn');
  if(!familiaTxt || !fecha || !horaInicio){ warn.innerHTML = '<div class="warnbox">Completá al menos familia, fecha y hora de inicio.</div>'; return; }
  if(!agendaFamilias.some(f=>normaliza(f.nombre)===normaliza(familiaTxt)) && !(await confirmarNombreNuevo(familiaTxt, agendaFamilias, 'familia'))) return;
  if(!cruza && horaFin && horaFin <= horaInicio){
    warn.innerHTML = '<div class="warnbox">La hora de fin tiene que ser después de la de inicio. Si termina pasada la medianoche, marcá "Termina al día siguiente".</div>';
    return;
  }
  let cobroFinal = null;
  if(tipo==='traslado'){
    // Traslado: el total ya viene armado (por km, o tipeado a mano) — no se multiplica por
    // horas, eso es solo para sitting.
    const cobroTraslado = document.getElementById('agenda-cobro-traslado')?.value;
    cobroFinal = cobroTraslado ? Number(cobroTraslado) : null;
  } else if(tarifa && horaFin){
    const mi = agendaMinutos(horaInicio), mf = agendaMinutos(horaFin);
    const durMin = cruza ? ((24*60-mi)+mf) : (mf-mi);
    cobroFinal = durMin>0 ? Math.round(Number(tarifa)*(durMin/60)) : Number(tarifa);
  } else if(tarifa){
    cobroFinal = Number(tarifa);
  }
  const fam = agendaFamilias.find(f=>normaliza(f.nombre)===normaliza(familiaTxt));
  const { error } = await sb.from('solicitudes').insert({
    familia_id: fam ? fam.id : null,
    familia_nombre: familiaTxt,
    tipo, zona: zona || (fam ? fam.zona : null),
    fecha, hora_inicio: horaInicio, hora_fin: horaFin || null,
    termina_dia_siguiente: cruza,
    cobro_familia: cobroFinal,
    estado: 'sin_asignar',
  });
  if(error){ warn.innerHTML = errBox(error); return; }
  cerrarModal();
  agendaAncla = fecha;
  const lbl = document.getElementById('agenda-fecha-label');
  if(lbl) lbl.textContent = agendaRangoLabel();
  await cargarAgendaSolicitudes();
  actualizarAgendaBadge();
  toast('Solicitud guardada.');
}
async function guardarAsignacionFijaNueva(){
  const familiaTxt = document.getElementById('agenda-familia').value.trim();
  const nineraNombre = document.getElementById('agenda-repetir-ninera').value.trim();
  const warn = document.getElementById('agenda-nueva-warn');
  if(!familiaTxt || !nineraNombre){ warn.innerHTML = '<div class="warnbox">Elegí la familia y la niñera.</div>'; return; }
  if(!agendaFamilias.some(f=>normaliza(f.nombre)===normaliza(familiaTxt)) && !(await confirmarNombreNuevo(familiaTxt, agendaFamilias, 'familia'))) return;
  if(!agendaNinierasBase.some(n=>normaliza(n.nombre)===normaliza(nineraNombre)) && !(await confirmarNombreNuevo(nineraNombre, agendaNinierasBase, 'niñera'))) return;
  const dias = [...document.querySelectorAll('#agenda-repetir-dias .daybtn.selected')].map(b=>b.dataset.dia);
  if(!dias.length){ warn.innerHTML = '<div class="warnbox">Elegí al menos un día.</div>'; return; }
  const varia = document.getElementById('agenda-repetir-varia').checked;
  const fam = agendaFamilias.find(f=>normaliza(f.nombre)===normaliza(familiaTxt));
  const ninera = agendaNinierasBase.find(n=>normaliza(n.nombre)===normaliza(nineraNombre));
  const tipo = document.getElementById('agenda-repetir-tipo')?.value || 'sitting';
  const desde = document.getElementById('agenda-repetir-desde')?.value || todayISO();
  const base = { familia_id: fam?fam.id:null, ninera_nombre:nineraNombre, ninera_id: ninera?.id || null, tipo, vigente_desde: desde };
  let filas = [];
  if(varia){
    for(const d of dias){
      filas.push({ ...base, dias:[d], hora_inicio: leerHora('agenda-rep-hi-'+d)||null, hora_fin: leerHora('agenda-rep-hf-'+d)||null });
    }
  } else {
    filas.push({ ...base, dias, hora_inicio: leerHora('agenda-rep-hi')||null, hora_fin: leerHora('agenda-rep-hf')||null });
  }
  let choque = null;
  for(const fila of filas){
    choque = await chequearFijoNuevoContraTodo(nineraNombre, fila.dias, fila.hora_inicio, fila.hora_fin);
    if(choque) break;
  }
  if(!(await avisarSiDobleReserva(choque, nineraNombre, 'Crear igual'))) return;
  const { error } = await escribirAsignacion(p=>sb.from('asignaciones').insert(p), filas);
  if(error){ warn.innerHTML = errBox(error); return; }
  cerrarModal();
  await cargarAgendaSolicitudes();
  actualizarAgendaBadge();
  toast('Asignación fija guardada — va a aparecer en Agenda los días que elegiste.');
}

async function abrirModalAsignar(solicitudId){
  const s = agendaSolicitudes.find(x=>x.id===solicitudId);
  if(!s) return;
  abrirModal('<div class="empty"><span class="spinner dark"></span> Buscando niñeras recomendadas…</div>');
  if(!zonaGruposCache) await cargarZonaGrupos();
  const [{data:histFam}, {data:histTotal}, {data:sitTotal}] = await Promise.all([
    sb.from('solicitud_ninieras').select('ninera_nombre, solicitudes!inner(familia_nombre)').eq('estado','confirmada').eq('solicitudes.familia_nombre', s.familia_nombre),
    sb.from('solicitud_ninieras').select('ninera_nombre').eq('estado','confirmada'),
    sb.from('sittings_traslados').select('ninera_nombre'),
  ]);
  const conteoFamilia = {};
  (histFam||[]).forEach(r=>{ const k=normaliza(r.ninera_nombre); conteoFamilia[k]=(conteoFamilia[k]||0)+1; });
  const conteoTotal = {};
  (histTotal||[]).forEach(r=>{ const k=normaliza(r.ninera_nombre); conteoTotal[k]=(conteoTotal[k]||0)+1; });
  (sitTotal||[]).forEach(r=>{ const k=normaliza(r.ninera_nombre); conteoTotal[k]=(conteoTotal[k]||0)+1; });

  const tipoOk = n => s.tipo==='traslado' ? (n.tipo==='Traslados'||n.tipo==='Ambas') : (n.tipo!=='Traslados');
  const zonaNorm = normaliza(s.zona||'');
  const yaInvitadas = new Set(s.ninieras.map(x=>normaliza(x.ninera_nombre)));
  const candidatas = agendaNinierasBase.filter(n=>tipoOk(n) && !yaInvitadas.has(normaliza(n.nombre)));

  const tier1 = [], tier2 = [], tier3 = [];
  candidatas.forEach(n=>{
    const key = normaliza(n.nombre);
    if(conteoFamilia[key]>0){ tier1.push({...n, veces:conteoFamilia[key]}); return; }
    // Cubre alguna de las zonas del pedido (todo es por zona: Olivos o San Nicolás ya son
    // "Carrasco", no hace falta que el texto coincida).
    if(s.zona && mismoGrupoZona(n.zona, s.zona)){
      tier2.push({...n, cercana: false});
      return;
    }
    tier3.push({...n, total:conteoTotal[key]||0});
  });
  tier1.sort((a,b)=>b.veces-a.veces);
  tier3.sort((a,b)=>(b.total-a.total) || a.nombre.localeCompare(b.nombre));

  // Ya no se invita por WhatsApp a varias y se espera respuesta -- se elige la niñera
  // directo, se ve/ajusta cuánto le corresponde, y se guarda con todo asignado de una:
  // familia, niñera, pago, Y el registro real en Sittings & traslados (antes esto último
  // quedaba pendiente de un paso aparte). Mismo criterio para sitting y traslado.
  let pagoSugerido = 0;
  if(s.tipo==='traslado'){
    if(!tarifaTrasladoConfig) await cargarTarifaTrasladoConfig();
    const margenNinera = Number(tarifaTrasladoConfig?.margen_ninera)||0;
    pagoSugerido = s.cobro_familia ? redondearAbajo50(Number(s.cobro_familia) * (1 - margenNinera)) : 0;
  } else {
    const familia = agendaFamilias.find(f=>normaliza(f.nombre)===normaliza(s.familia_nombre));
    const pagoHora = familia ? Number(familia.pago_hora)||0 : 0;
    if(pagoHora && s.hora_inicio && s.hora_fin){
      const mi = agendaMinutos(s.hora_inicio);
      let mf = agendaMinutos(s.hora_fin);
      if(s.termina_dia_siguiente) mf += 24*60;
      const horasFrac = Math.max(0, mf-mi)/60;
      pagoSugerido = Math.round(horasFrac*pagoHora);
    }
  }
  const filaSel = (n, sub) => `
    <label class="agenda-ninera-pick">
      <input type="radio" name="agenda-asignar-ninera" value="${escaparHtml(n.id)}" data-nombre="${escaparHtml(n.nombre)}" onchange="onAgendaNineraSel(${pagoSugerido})">
      <div><b>${escaparHtml(n.nombre)}</b><div class="helper" style="margin:0;">${escaparHtml(sub)}</div></div>
    </label>`;
  const html = `
    <h2>Asignar niñera${s.tipo==='traslado'?' al traslado':''}</h2>
    <div class="helper">${escaparHtml(s.familia_nombre)} · ${s.tipo==='traslado'?'Traslado':'Sitting'} · ${s.hora_inicio.slice(0,5)}${s.hora_fin?'–'+s.hora_fin.slice(0,5):''}${s.zona?escaparHtml(' · '+s.zona):''}${s.cobro_familia?` · Cobro a familia $${Number(s.cobro_familia).toLocaleString('es-UY')}`:''}</div>
    ${tier1.length ? `<div class="agenda-tier-label">Ya trabajaron con esta familia</div>${tier1.map(n=>filaSel(n, `${n.veces} vez${n.veces===1?'':'es'}`)).join('')}` : ''}
    ${tier2.length ? `<div class="agenda-tier-label">Cubren ${escaparHtml(s.zona||'esta zona')}</div>${tier2.map(n=>filaSel(n, n.cercana ? 'Cubre zona cercana (mismo grupo)' : 'Cubre la zona')).join('')}` : ''}
    ${!tier1.length && !tier2.length ? '<div class="helper">Nadie con historial o zona coincidente todavía — mostrando el resto del equipo.</div>' : ''}
    <button type="button" class="smallbtn" style="margin:6px 0;" onclick="document.getElementById('agenda-tier3').style.display='block';this.style.display='none';">+ Niñeras</button>
    <div id="agenda-tier3" style="display:${(!tier1.length && !tier2.length) ? 'block' : 'none'};">
      <div class="agenda-tier-label">Resto del equipo</div>
      ${tier3.map(n=>filaSel(n, `${n.total} sitting${n.total===1?'':'s'} en total`)).join('')}
    </div>
    <div id="agenda-asignar-pago-wrap" style="display:none;margin-top:10px;">
      <div class="field"><label>Pago a la niñera</label><div class="moneyfield"><input type="number" id="agenda-asignar-pago" oninput="marcarCampoEditadoManual('agenda-asignar-pago')"></div></div>
      <div id="agenda-asignar-warn"></div>
      <button class="btn primary" style="width:100%;margin-top:6px;" onclick="guardarAsignacionDirecta(${argJs(s.id)})">Guardar asignación</button>
    </div>
  `;
  abrirModal(html);
}
function onAgendaNineraSel(pagoSugerido){
  const wrap = document.getElementById('agenda-asignar-pago-wrap');
  const pagoInput = document.getElementById('agenda-asignar-pago');
  if(!wrap || !pagoInput) return;
  wrap.style.display = '';
  if(!pagoInput.dataset.tocadoManual){ pagoInput.value = pagoSugerido; marcarCampoSugerido('agenda-asignar-pago'); }
}
async function guardarAsignacionDirecta(solicitudId){
  const sel = document.querySelector('input[name="agenda-asignar-ninera"]:checked');
  const warn = document.getElementById('agenda-asignar-warn');
  if(!sel){ warn.innerHTML = '<div class="warnbox">Elegí una niñera.</div>'; return; }
  const s = agendaSolicitudes.find(x=>x.id===solicitudId);
  const choque = chequearDobleReservaAgenda(sel.dataset.nombre, s?.fecha, s?.hora_inicio, s?.hora_fin, solicitudId);
  if(!(await avisarSiDobleReserva(choque, sel.dataset.nombre, 'Asignar igual'))) return;
  const familia = agendaFamilias.find(f=>normaliza(f.nombre)===normaliza(s.familia_nombre));
  if(familia && s?.hora_inicio){
    const choqueFamilia = await chequearFamiliaYaCubierta(familia.id, s.fecha, s.hora_inicio, s.hora_fin, sel.dataset.nombre, null);
    if(!(await avisarSiFamiliaYaCubierta(choqueFamilia, s.familia_nombre, 'Sí, van dos'))) return;
  }
  const pago = Number(document.getElementById('agenda-asignar-pago').value)||0;
  const { error: e1 } = await sb.from('solicitud_ninieras').insert({
    solicitud_id: solicitudId, ninera_id: sel.value, ninera_nombre: sel.dataset.nombre,
    estado: 'confirmada', pago_ninera: pago,
  });
  if(e1){ warn.innerHTML = errBox(e1); return; }
  await sbGuardar(sb.from('solicitudes').update({estado:'confirmada'}).eq('id', solicitudId), 'la solicitud');
  // Se carga directo el registro real en Sittings & traslados -- ya no hace falta un paso
  // aparte de "Cargar sitting" después de asignar.
  const { error: e2 } = await sb.from('sittings_traslados').insert({
    tipo: s.tipo, registrado_por: registradoPorUsuario(),
    familia_id: familia?.id || s.familia_id || null, familia_nombre: s.familia_nombre,
    ninera_id: sel.value, ninera_nombre: sel.dataset.nombre,
    fecha: s.fecha, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin,
    termina_dia_siguiente: !!s.termina_dia_siguiente,
    cobro_familia: Number(s.cobro_familia)||0, pago_ninera: pago,
    cobrado: false, pagado: false, notas: 'Asignado desde Agenda',
  });
  cerrarModal();
  await cargarAgendaSolicitudes();
  actualizarAgendaBadge();
  toast(e2 ? 'Quedó asignado, pero no se pudo cargar en Sittings & traslados: '+e2.message : 'Asignado — ya quedó cargado en Sittings & traslados.', e2?'bad':'good');
}
function abrirModalSolicitud(id){
  const s = agendaSolicitudes.find(x=>x.id===id);
  if(!s) return;
  if(s._fuente==='asignacion'){ abrirModalAsignacionFija(s); return; }
  if(s._fuente==='registro'){ abrirModalRegistroDesdeAgenda(s); return; }
  const horario = s.termina_dia_siguiente
    ? `${s.hora_inicio.slice(0,5)} → día siguiente${s.hora_fin?' '+s.hora_fin.slice(0,5):''}`
    : (s.hora_fin ? `${s.hora_inicio.slice(0,5)}–${s.hora_fin.slice(0,5)}` : s.hora_inicio.slice(0,5));
  const fechaTxt = new Date(s.fecha+'T00:00:00').toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'});
  let ninierasHtml = '';
  if(s.ninieras.length){
    ninierasHtml = s.ninieras.map(n=>`
      <div class="agenda-ninerarow">
        <div>
          <b>${escaparHtml(n.ninera_nombre)}</b>
          <span class="badge ${n.estado==='confirmada'?'good':n.estado==='rechazada'?'bad':'warn'}">${n.estado==='confirmada'?'Confirmada':n.estado==='rechazada'?'Rechazada':'Pendiente'}</span>
          ${n.pago_ninera ? `<div class="helper" style="margin:2px 0 0;">Pago $${Number(n.pago_ninera).toLocaleString('es-UY')}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          ${n.estado!=='confirmada' ? `<button class="smallbtn" onclick="confirmarNinera(${argJs(n.id)})">Confirmar</button>` : ''}
          <a class="smallbtn" href="${urlSegura(waLink(agendaTelefonoNinera(n.ninera_nombre), mensajeWA(s, n.ninera_nombre)))}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>`).join('');
  }
  const cuerpo = `
    <h2>${escaparHtml(s.familia_nombre)}</h2>
    <div class="helper">${s.tipo==='traslado'?'Traslado':'Sitting'} · ${fechaTxt} · ${horario}${s.zona?escaparHtml(' · '+s.zona):''}</div>
    ${s.cobro_familia ? `<div class="helper">Cobro a la familia: $${Number(s.cobro_familia).toLocaleString('es-UY')}</div>`:''}
    <div style="margin:14px 0;">${ninierasHtml || '<div class="empty">Todavía no hay niñeras asignadas.</div>'}</div>
    ${s.estado==='sin_asignar' ? `<button class="btn primary" style="width:100%;margin-bottom:8px;" onclick="cerrarModal();abrirModalAsignar(${argJs(s.id)})">Asignar niñera</button>` : ''}
    ${s.estado==='pendiente_confirmar' ? `<button class="btn" style="width:100%;margin-bottom:8px;" onclick="cerrarModal();abrirModalAsignar(${argJs(s.id)})">+ Agregar otra niñera</button>` : ''}
    ${s.estado!=='cancelada' ? `<button class="btn danger" style="width:100%;" onclick="cancelarSolicitud(${argJs(s.id)})">Cancelar solicitud</button>` : `<div class="warnbox">Esta solicitud fue cancelada.</div>`}
  `;
  abrirModal(cuerpo);
}
function abrirModalAsignacionFija(s){
  const asigId = s._asigId;
  const a = s._raw;
  const horario = a.hora_inicio ? `${a.hora_inicio.slice(0,5)}${a.hora_fin?'–'+a.hora_fin.slice(0,5):''}` : 'Sin horario cargado';
  const diasTxt = (a.dias||[]).map(d=>DIAS_CORTO[d]||d).join(' ');
  const esTraslado = tipoAsignacion(a)==='traslado';
  // Cambio de niñera "desde una fecha" (05/10/2026, E2): por defecto desde hoy, nunca antes
  // de que empiece este fijo.
  const hoy = todayISO();
  const desdeSugerido = a.vigente_desde && a.vigente_desde > hoy ? a.vigente_desde : hoy;
  // Un fijo que ya terminó (por ejemplo, la asignación vieja después de un cambio de niñera)
  // se ve en las semanas pasadas solo para registrar esos días: no se le cambia la niñera,
  // el horario ni se borra (perdería su historia).
  const terminado = asignacionTerminada(a, hoy);
  const cuerpo = `
    <h2>${escaparHtml(s.familia_nombre)}</h2>
    <div class="helper">${esTraslado?'Traslado':'Sitting'} fijo · ${diasTxt || 'sin días'} · ${horario}</div>
    <div class="helper" style="margin-top:2px;">Lo hace <b>${escaparHtml(a.ninera_nombre||'(sin niñera)')}</b> · vigente ${textoVigencia(a)}</div>
    ${terminado ? `<div class="helper" style="margin:14px 0 8px;">Este fijo terminó el ${new Date(a.vigente_hasta+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit',year:'2-digit'})}. Para cambiar quién lo hace de acá en adelante, abrí una tarjeta de una semana actual.</div>
    <button class="btn" style="width:100%;margin-bottom:8px;" onclick="abrirModalVigenciaAsignacion(${argJs(asigId)})">Editar vigencia y tipo</button>` : `
    <div class="grid2" style="margin-top:14px;">
      <div class="field" style="position:relative;"><label>Cambiar a la niñera</label>
        <input type="text" id="agenda-fija-ninera-${asigId}" autocomplete="off" placeholder="Elegí la niñera nueva">
        <div id="agenda-fija-ninera-${asigId}-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
      </div>
      <div class="field"><label>Desde</label><input type="date" id="agenda-fija-desde-${asigId}" value="${desdeSugerido}"></div>
    </div>
    <div class="helper" style="margin:-4px 0 8px;">Lo anterior a esa fecha no cambia: sigue siendo de quien lo hizo.</div>
    <div id="agenda-fija-warn"></div>
    <button class="btn primary" id="agenda-fija-guardar-${asigId}" style="width:100%;margin-bottom:8px;" onclick="cambiarNineraAsignacionFija(${argJs(asigId)})">Cambiar niñera desde esa fecha</button>
    <button class="btn" style="width:100%;margin-bottom:8px;" onclick="abrirModalVigenciaAsignacion(${argJs(asigId)})">Editar vigencia y tipo</button>

    <div style="height:1px;background:var(--line);margin:14px 0;"></div>
    <button type="button" class="btn" id="agenda-fija-edit-toggle" style="width:100%;" onclick="document.getElementById('agenda-fija-edit-box').style.display='block';this.style.display='none';">Editar horarios futuros</button>
    <div id="agenda-fija-edit-box" style="display:none;">
      <div class="helper" style="margin:10px 0 8px;">Aplica desde ahora para todos los próximos días, no toca lo que ya está registrado:</div>
      <div class="grid2" style="margin-bottom:8px;">
        <div class="field"><label>Hora inicio</label>${selectHora('agenda-fija-edit-hi')}</div>
        <div class="field"><label>Hora fin</label>${selectHora('agenda-fija-edit-hf')}</div>
      </div>
      <div class="dayrow" id="agenda-fija-edit-dias" style="margin-bottom:8px;">
        ${['L','M','X','J','V','S','D'].map(d=>`<button type="button" class="daybtn ${(a.dias||[]).includes(d)?'selected':''}" data-dia="${d}" onclick="this.classList.toggle('selected')">${DIAS_CORTO[d]}</button>`).join('')}
      </div>
      <div id="agenda-fija-edit-warn"></div>
      <button class="btn primary" style="width:100%;margin-bottom:8px;" onclick="guardarHorarioAsignacionFija(${argJs(asigId)})">Guardar horario/días para todos los próximos</button>
    </div>`}

    <div style="height:1px;background:var(--line);margin:14px 0;"></div>
    <div class="helper" style="margin-bottom:8px;">Corregir solo el día de hoy (${s.fecha}), sin tocar el fijo:</div>
    ${s._yaRegistrado
      ? `<div class="helper" style="margin-bottom:8px;">Ya hay un registro cargado para ${escaparHtml(a.ninera_nombre)} este día en Sittings.</div>`
      : `<div class="grid2" style="margin-bottom:8px;">
           <div class="field"><label>Hora inicio</label>${selectHora('agenda-fija-hi')}</div>
           <div class="field"><label>Hora fin</label>${selectHora('agenda-fija-hf')}</div>
         </div>
         <label class="chk" style="margin:-4px 0 10px;"><input type="checkbox" id="agenda-fija-cruza"> Termina al día siguiente</label>
         ${esTraslado ? `<div class="grid2" style="margin-bottom:8px;">
           <div class="field"><label>Cobro del traslado</label><div class="moneyfield"><input type="number" id="agenda-fija-cobro"></div></div>
           <div class="field"><label>Pago a la niñera</label><div class="moneyfield"><input type="number" id="agenda-fija-pago"></div></div>
         </div>
         <div class="helper" id="agenda-fija-precio-helper" style="margin:-4px 0 8px;"></div>` : ''}
         <div id="agenda-fija-horario-warn"></div>
         <button class="btn primary" style="width:100%;margin-bottom:8px;" onclick="registrarSittingFijoDeHoy(${argJs(s.id)})">Registrar ${esTraslado?'traslado':'sitting'} de este día</button>
         <button class="btn" style="width:100%;margin-bottom:8px;" onclick="mostrarExcepcionAsignacionFija(${argJs(s.id)})">Este día no fue</button>`}
    ${terminado ? '' : `<button class="btn danger" style="width:100%;" onclick="quitarAsignacionFijaDesdeAgenda(${argJs(asigId)})">Quitar esta asignación fija</button>`}
  `;
  abrirModal(cuerpo);
  setHoraSelect('agenda-fija-edit-hi', a.hora_inicio||'');
  setHoraSelect('agenda-fija-edit-hf', a.hora_fin||'');
  if(!s._yaRegistrado){
    setHoraSelect('agenda-fija-hi', a.hora_inicio||'');
    setHoraSelect('agenda-fija-hf', a.hora_fin||'');
  }
  setTimeout(()=>attachAutocomplete('agenda-fija-ninera-'+asigId, 'agenda-fija-ninera-'+asigId+'-dropdown', ()=>agendaNinierasBase, ()=>{}), 20);
  if(esTraslado && !s._yaRegistrado) precargarPrecioTrasladoFijo(a);
}
/* Un traslado fijo no se cobra por hora: se precarga con lo del último traslado de ese
   fijo (o de esa familia), y queda editable. */
async function precargarPrecioTrasladoFijo(a){
  let { data } = await sb.from('sittings_traslados').select('fecha,cobro_familia,pago_ninera').eq('asignacion_id', a.id).eq('cancelado', false).order('fecha', {ascending:false}).limit(1);
  if(!data || !data.length){
    ({ data } = await sb.from('sittings_traslados').select('fecha,cobro_familia,pago_ninera').eq('familia_id', a.familia_id).eq('tipo', 'traslado').eq('cancelado', false).order('fecha', {ascending:false}).limit(1));
  }
  const ultimo = (data||[])[0];
  const cobro = document.getElementById('agenda-fija-cobro');
  const pago = document.getElementById('agenda-fija-pago');
  const helper = document.getElementById('agenda-fija-precio-helper');
  if(!ultimo || !cobro || !pago) return;
  if(!cobro.value) cobro.value = Number(ultimo.cobro_familia)||0;
  if(!pago.value) pago.value = Number(ultimo.pago_ninera)||0;
  if(helper) helper.textContent = `Precargado con el último traslado (${new Date(ultimo.fecha+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit'})}). Revisalo antes de registrar.`;
}
/* Edita la asignación fija en sí (hora_inicio/hora_fin/dias en `asignaciones`) --
   a diferencia de "Registrar sitting de hoy", esto no crea un registro real,
   solo corrige la plantilla recurrente para que los próximos días salgan bien
   desde el vamos, sin tener que repetir la corrección día a día. */
async function guardarHorarioAsignacionFija(asigId){
  const warn = document.getElementById('agenda-fija-edit-warn');
  const horaIni = leerHora('agenda-fija-edit-hi');
  const horaFin = leerHora('agenda-fija-edit-hf');
  const dias = [...document.querySelectorAll('#agenda-fija-edit-dias .daybtn.selected')].map(b=>b.dataset.dia);
  if(!horaIni || !horaFin){ if(warn) warn.innerHTML = '<div class="warnbox">Completá las dos horas.</div>'; return; }
  if(horaFin<=horaIni){ if(warn) warn.innerHTML = '<div class="warnbox">La hora de fin tiene que ser después de la de inicio.</div>'; return; }
  if(!dias.length){ if(warn) warn.innerHTML = '<div class="warnbox">Elegí al menos un día.</div>'; return; }
  const item = agendaSolicitudes.find(s=>s._asigId===asigId);
  const nineraNombre = item?._raw?.ninera_nombre;
  if(nineraNombre){
    const choque = await chequearFijoNuevoContraTodo(nineraNombre, dias, horaIni, horaFin, asigId);
    if(!(await avisarSiDobleReserva(choque, nineraNombre, 'Guardar igual'))) return;
  }
  const { error } = await sb.from('asignaciones').update({hora_inicio: horaIni, hora_fin: horaFin, dias}).eq('id', asigId);
  if(error){ if(warn) warn.innerHTML = errBox(error); return; }
  cerrarModal();
  await cargarAgendaSolicitudes();
  toast('Horario fijo actualizado — aplica desde ahora para los próximos días.');
}
/* Un solo flujo para registrar el sitting de hoy: el horario sale precargado
   con el habitual de la asignación, pero siempre queda editable ahí mismo —
   si no cambió nada, se registra tal cual; si la niñera se quedó de más o se
   fue antes, se ajusta el horario antes de tocar Registrar. Calcula cobro/pago
   exacto por la duración real, con la tarifa de la familia (misma cuenta que
   en Sittings & traslados). */
async function registrarSittingFijoDeHoy(id){
  const s = agendaSolicitudes.find(x=>x.id===id);
  if(!s) return;
  const a = s._raw;
  const horaIni = leerHora('agenda-fija-hi');
  const horaFin = leerHora('agenda-fija-hf');
  const cruza = document.getElementById('agenda-fija-cruza')?.checked || false;
  const warn = document.getElementById('agenda-fija-horario-warn');
  if(!horaIni || !horaFin){ if(warn) warn.innerHTML = '<div class="warnbox">Completá las dos horas.</div>'; return; }
  const mi = agendaMinutos(horaIni);
  let mf = agendaMinutos(horaFin);
  if(cruza) mf += 24*60;
  if(mf<=mi){ if(warn) warn.innerHTML = '<div class="warnbox">La hora de fin tiene que ser después de la de inicio (o marcá "Termina al día siguiente").</div>'; return; }
  const familia = agendaFamilias.find(f=>f.id===a.familia_id);
  const horasFrac = (mf-mi)/60;
  const cobroHora = familia ? Number(familia.cobro_hora)||0 : 0;
  const pagoHora = familia ? Number(familia.pago_hora)||0 : 0;
  const tipo = tipoAsignacion(a);
  let cobro = Math.round(horasFrac*cobroHora), pago = Math.round(horasFrac*pagoHora);
  if(tipo==='traslado'){
    const cobroTxt = document.getElementById('agenda-fija-cobro')?.value ?? '';
    const pagoTxt = document.getElementById('agenda-fija-pago')?.value ?? '';
    if(cobroTxt==='' || pagoTxt===''){ if(warn) warn.innerHTML = '<div class="warnbox">Completá el cobro del traslado y el pago a la niñera.</div>'; return; }
    cobro = Number(cobroTxt)||0; pago = Number(pagoTxt)||0;
  }
  const choque = chequearDobleReservaAgenda(a.ninera_nombre, s.fecha, horaIni, horaFin, s.id);
  if(!(await avisarSiDobleReserva(choque, a.ninera_nombre, 'Registrar igual'))) return;
  if(familia){
    const choqueFamilia = await chequearFamiliaYaCubierta(familia.id, s.fecha, horaIni, horaFin, a.ninera_nombre, null);
    if(!(await avisarSiFamiliaYaCubierta(choqueFamilia, s.familia_nombre, 'Sí, van dos'))) return;
  }
  // Niñera y tipo salen de la asignación vigente ESE día (la Agenda solo muestra la que
  // corresponde a cada fecha), y el registro queda vinculado a ella.
  const { error } = await sb.from('sittings_traslados').insert({
    tipo,
    registrado_por: registradoPorUsuario(),
    asignacion_id: a.id,
    familia_id: a.familia_id || null,
    familia_nombre: s.familia_nombre,
    ninera_id: a.ninera_id || null,
    ninera_nombre: a.ninera_nombre,
    fecha: s.fecha,
    hora_inicio: horaIni,
    hora_fin: horaFin,
    termina_dia_siguiente: cruza,
    cobro_familia: cobro,
    pago_ninera: pago,
    cobrado: false, pagado: false,
    notas: `${tipo==='traslado'?'Traslado':'Sitting'} fijo — registrado desde Agenda`,
  });
  if(error){ if(warn) warn.innerHTML = errBox(error); return; }
  cerrarModal();
  await cargarAgendaSolicitudes();
  actualizarAgendaBadge();
  toast(tipoAsignacion(a)==='traslado' ? 'Traslado registrado.' : 'Sitting registrado.');
}
function mostrarExcepcionAsignacionFija(id){
  const s = agendaSolicitudes.find(x=>x.id===id);
  if(!s) return;
  const a = s._raw;
  const fechaTxt = new Date(s.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'numeric',month:'long'});
  const cuerpo = `
    <h2 style="margin:0 0 6px;">¿${escaparHtml(a.ninera_nombre)} no fue el ${fechaTxt} a lo de ${escaparHtml(s.familia_nombre)}?</h2>
    <div class="helper" style="margin-bottom:16px;">No se le cobra nada a la familia ni se le paga nada a ${escaparHtml(a.ninera_nombre)} por este día.</div>
    <button class="btn" style="width:100%;margin-bottom:8px;text-align:left;" onclick="registrarExcepcionFija(${argJs(id)})">No fue nadie ese día</button>
    <button class="btn primary" style="width:100%;text-align:left;" onclick="mostrarReemplazoFijoHoy(${argJs(id)})">Vino otra niñera</button>
    <div id="agenda-fija-reemplazo-box"></div>
  `;
  abrirModal(cuerpo);
}
async function registrarExcepcionFija(id){
  const s = agendaSolicitudes.find(x=>x.id===id);
  if(!s) return;
  const a = s._raw;
  const { error } = await sb.from('sittings_traslados').insert({
    tipo: tipoAsignacion(a),
    asignacion_id: a.id,
    familia_id: a.familia_id || null,
    familia_nombre: s.familia_nombre,
    ninera_id: a.ninera_id || null,
    ninera_nombre: a.ninera_nombre,
    fecha: s.fecha,
    hora_inicio: a.hora_inicio || null,
    hora_fin: a.hora_fin || null,
    cobro_familia: 0,
    pago_ninera: 0,
    cancelado: true,
    cobrado: true,
    pagado: true,
    notas: `${a.ninera_nombre} no fue — sin reemplazo`,
  });
  if(error){ toast('No se pudo registrar: '+error.message, 'bad'); return; }
  cerrarModal();
  await cargarAgendaSolicitudes();
  actualizarAgendaBadge();
  toast('Registrado: no fue nadie ese día.');
}
/* Reemplazo puntual: otra niñera cubrió el horario fijo ese día. Se registra
   directo su sitting con el cálculo automático de cobro/pago — sin saltar a
   Sittings & traslados a completarlo a mano. */
function mostrarReemplazoFijoHoy(id){
  const s = agendaSolicitudes.find(x=>x.id===id);
  if(!s) return;
  const a = s._raw;
  agendaReemplazoNineraSel = null;
  const box = document.getElementById('agenda-fija-reemplazo-box');
  if(!box) return;
  box.innerHTML = `
    <div style="height:1px;background:var(--line);margin:14px 0;"></div>
    <div class="field" style="position:relative;margin-bottom:8px;"><label>¿Quién vino en su lugar?</label>
      <input type="text" id="agenda-fija-reemplazo-ninera" autocomplete="off" oninput="agendaReemplazoNineraSel=null;">
      <div id="agenda-fija-reemplazo-ninera-dropdown" class="autocomplete-dropdown" style="display:none;"></div>
    </div>
    <div class="grid2" style="margin-bottom:8px;">
      <div class="field"><label>Hora inicio</label>${selectHora('agenda-fija-rhi')}</div>
      <div class="field"><label>Hora fin</label>${selectHora('agenda-fija-rhf')}</div>
    </div>
    <label class="chk" style="margin:-4px 0 10px;"><input type="checkbox" id="agenda-fija-rcruza"> Termina al día siguiente</label>
    ${tipoAsignacion(a)==='traslado' ? `<div class="grid2" style="margin-bottom:8px;">
      <div class="field"><label>Cobro del traslado</label><div class="moneyfield"><input type="number" id="agenda-fija-rcobro"></div></div>
      <div class="field"><label>Pago a la niñera</label><div class="moneyfield"><input type="number" id="agenda-fija-rpago"></div></div>
    </div>` : ''}
    <div id="agenda-fija-reemplazo-warn"></div>
    <button class="btn primary" style="width:100%;" onclick="confirmarReemplazoFijoHoy(${argJs(id)})">Registrar reemplazo</button>`;
  setHoraSelect('agenda-fija-rhi', a.hora_inicio||'');
  setHoraSelect('agenda-fija-rhf', a.hora_fin||'');
  setTimeout(()=>attachAutocomplete('agenda-fija-reemplazo-ninera', 'agenda-fija-reemplazo-ninera-dropdown', ()=>agendaNinierasBase, (o)=>{ agendaReemplazoNineraSel = o; }), 20);
}
async function confirmarReemplazoFijoHoy(id){
  const s = agendaSolicitudes.find(x=>x.id===id);
  if(!s) return;
  const a = s._raw;
  const warn = document.getElementById('agenda-fija-reemplazo-warn');
  const nineraTxt = document.getElementById('agenda-fija-reemplazo-ninera')?.value.trim();
  if(!nineraTxt){ if(warn) warn.innerHTML = '<div class="warnbox">Elegí quién vino en su lugar.</div>'; return; }
  const horaIni = leerHora('agenda-fija-rhi');
  const horaFin = leerHora('agenda-fija-rhf');
  const cruza = document.getElementById('agenda-fija-rcruza')?.checked || false;
  if(!horaIni || !horaFin){ if(warn) warn.innerHTML = '<div class="warnbox">Completá las dos horas.</div>'; return; }
  const mi = agendaMinutos(horaIni);
  let mf = agendaMinutos(horaFin);
  if(cruza) mf += 24*60;
  if(mf<=mi){ if(warn) warn.innerHTML = '<div class="warnbox">La hora de fin tiene que ser después de la de inicio (o marcá "Termina al día siguiente").</div>'; return; }
  const familia = agendaFamilias.find(f=>f.id===a.familia_id);
  const horasFrac = (mf-mi)/60;
  const cobroHora = familia ? Number(familia.cobro_hora)||0 : 0;
  const pagoHora = familia ? Number(familia.pago_hora)||0 : 0;
  const nineraSel = agendaReemplazoNineraSel && normaliza(agendaReemplazoNineraSel.nombre)===normaliza(nineraTxt) ? agendaReemplazoNineraSel : null;
  let cobro = Math.round(horasFrac*cobroHora), pago = Math.round(horasFrac*pagoHora);
  if(tipoAsignacion(a)==='traslado'){
    const cobroTxt = document.getElementById('agenda-fija-rcobro')?.value ?? '';
    const pagoTxt = document.getElementById('agenda-fija-rpago')?.value ?? '';
    if(cobroTxt==='' || pagoTxt===''){ if(warn) warn.innerHTML = '<div class="warnbox">Completá el cobro del traslado y el pago a la niñera.</div>'; return; }
    cobro = Number(cobroTxt)||0; pago = Number(pagoTxt)||0;
  }
  const choque = chequearDobleReservaAgenda(nineraTxt, s.fecha, horaIni, horaFin, s.id);
  if(!(await avisarSiDobleReserva(choque, nineraTxt, 'Registrar igual'))) return;
  if(familia){
    const choqueFamilia = await chequearFamiliaYaCubierta(familia.id, s.fecha, horaIni, horaFin, nineraTxt, null);
    if(!(await avisarSiFamiliaYaCubierta(choqueFamilia, s.familia_nombre, 'Sí, van dos'))) return;
  }
  const { error } = await sb.from('sittings_traslados').insert({
    tipo: tipoAsignacion(a),
    registrado_por: registradoPorUsuario(),
    asignacion_id: a.id,
    familia_id: a.familia_id || null,
    familia_nombre: s.familia_nombre,
    ninera_id: nineraSel?.id || null,
    ninera_nombre: nineraTxt,
    fecha: s.fecha,
    hora_inicio: horaIni,
    hora_fin: horaFin,
    termina_dia_siguiente: cruza,
    cobro_familia: cobro,
    pago_ninera: pago,
    cobrado: false, pagado: false,
    notas: `Reemplazo de ${a.ninera_nombre}`,
  });
  if(error){ if(warn) warn.innerHTML = errBox(error); return; }
  cerrarModal();
  await cargarAgendaSolicitudes();
  actualizarAgendaBadge();
  toast('Reemplazo registrado.');
}
/* Cambiar la niñera de un fijo DESDE una fecha (05/10/2026, E2). Antes se pisaba el nombre
   en la misma asignación y el fijo, que no tenía fechas, pasaba a dibujarse como de la niñera
   nueva también en las semanas anteriores. Ahora la asignación vieja se cierra el día antes
   y se abre una nueva (mismos días, horario y tipo) desde esa fecha. Si la fecha es el
   primer día del fijo (o antes), no hay pasado que cuidar y se cambia la niñera ahí mismo. */
async function cambiarNineraAsignacionFija(asigId){
  const nueva = document.getElementById('agenda-fija-ninera-'+asigId).value.trim();
  const desde = document.getElementById('agenda-fija-desde-'+asigId)?.value || todayISO();
  const warn = document.getElementById('agenda-fija-warn');
  const item = agendaSolicitudes.find(s=>s._asigId===asigId);
  const a = item?._raw;
  if(!a) return;
  if(!nueva){ warn.innerHTML = '<div class="warnbox">Elegí la niñera nueva.</div>'; return; }
  if(normaliza(nueva)===normaliza(a.ninera_nombre||'')){ warn.innerHTML = '<div class="warnbox">Esa ya es la niñera de este fijo.</div>'; return; }
  if(a.vigente_hasta && desde > a.vigente_hasta){ warn.innerHTML = `<div class="warnbox">Este fijo termina el ${a.vigente_hasta}: elegí una fecha anterior.</div>`; return; }
  if(!agendaNinierasBase.some(n=>normaliza(n.nombre)===normaliza(nueva)) && !(await confirmarNombreNuevo(nueva, agendaNinierasBase, 'niñera'))) return;
  if(a.hora_inicio && Array.isArray(a.dias)){
    const choque = await chequearFijoNuevoContraTodo(nueva, a.dias, a.hora_inicio, a.hora_fin, asigId);
    if(!(await avisarSiDobleReserva(choque, nueva, 'Asignar igual'))) return;
  }
  const ninera = agendaNinierasBase.find(n=>normaliza(n.nombre)===normaliza(nueva));
  // Si la asignación ni siquiera trae la columna, la base todavía no tiene la migración:
  // se cambia en el mismo lugar, como antes.
  const baseSinVigencia = asignacionesSinVigencia || !('vigente_desde' in a);
  const enElMismoLugar = baseSinVigencia || !a.vigente_desde || desde <= a.vigente_desde;
  if(enElMismoLugar && !a.vigente_desde && !baseSinVigencia){
    // Fijo viejo sin fecha de inicio: no se sabe desde cuándo corre, así que no se puede
    // cuidar el pasado partiéndolo. Se pide primero cargarle la vigencia.
    warn.innerHTML = '<div class="warnbox">Este fijo no tiene fecha de inicio cargada. Tocá "Editar vigencia y tipo", cargá desde cuándo corre y después cambiá la niñera.</div>';
    return;
  }
  if(enElMismoLugar){
    const { error } = await sb.from('asignaciones').update({ninera_nombre: nueva, ninera_id: ninera?.id || null}).eq('id', asigId);
    if(error){ warn.innerHTML = errBox(error); return; }
  } else {
    const nuevaAsig = {
      familia_id: a.familia_id, ninera_nombre: nueva, ninera_id: ninera?.id || null,
      dias: a.dias, hora_inicio: a.hora_inicio, hora_fin: a.hora_fin,
      cobro_hora: a.cobro_hora ?? null, pago_hora: a.pago_hora ?? null,
      tipo: tipoAsignacion(a), vigente_desde: desde, vigente_hasta: a.vigente_hasta || null,
    };
    const { data: creada, error: e1 } = await escribirAsignacion(p=>sb.from('asignaciones').insert(p).select().single(), nuevaAsig);
    if(e1){ warn.innerHTML = errBox(e1); return; }
    const { error: e2 } = await escribirAsignacion(p=>sb.from('asignaciones').update(p).eq('id', asigId), {vigente_hasta: sumarDiasISO(desde, -1)});
    if(e2){
      // Sin cerrar la vieja quedarían dos fijos superpuestos: se deshace la nueva.
      await sb.from('asignaciones').delete().eq('id', creada.id);
      warn.innerHTML = errBox(e2);
      return;
    }
  }
  cerrarModal();
  await cargarAgendaSolicitudes();
  const fechaTxt = new Date(desde+'T12:00:00').toLocaleDateString('es-UY',{day:'numeric',month:'long'});
  toast(`Desde el ${fechaTxt} el fijo lo hace ${nueva}. Lo anterior sigue como estaba.`);
}
/* Vigencia (desde / hasta) y tipo de una asignación, editables desde la app para
   corregirlos sin SQL. Se abre desde el fijo en la Agenda y desde la ficha de la familia. */
async function abrirModalVigenciaAsignacion(asigId){
  const { data: a, error } = await sb.from('asignaciones').select('*, familias(nombre)').eq('id', asigId).single();
  if(error || !a){ toast('No se pudo abrir la asignación: '+(error?.message||'no existe'), 'bad'); return; }
  const diasTxt = (a.dias||[]).map(d=>DIAS_CORTO[d]||d).join(' ');
  abrirModal(`
    <h2 style="margin:0 0 4px;">Vigencia y tipo del fijo</h2>
    <div class="helper" style="margin-bottom:14px;">${escaparHtml(a.familias?.nombre||'(familia)')} · ${escaparHtml(a.ninera_nombre)} · ${diasTxt||'sin días'}</div>
    <div class="grid3">
      <div class="field"><label>Vigente desde</label><input type="date" id="vig-desde" value="${escaparHtml(a.vigente_desde)}"></div>
      <div class="field"><label>Vigente hasta</label><input type="date" id="vig-hasta" value="${escaparHtml(a.vigente_hasta)}"></div>
      <div class="field"><label>Tipo</label><select id="vig-tipo"><option value="sitting">Sitting</option><option value="traslado">Traslado</option></select></div>
    </div>
    <div class="helper">"Hasta" vacío = sigue vigente. La Agenda solo muestra el fijo entre esas fechas; lo que ya está registrado no se toca.</div>
    <div id="vig-warn"></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="guardarVigenciaAsignacion(${argJs(a.id)})">Guardar</button>
    </div>`);
  document.getElementById('vig-tipo').value = tipoAsignacion(a);
}
async function guardarVigenciaAsignacion(asigId){
  const desde = document.getElementById('vig-desde').value || null;
  const hasta = document.getElementById('vig-hasta').value || null;
  const tipo = document.getElementById('vig-tipo').value;
  const warn = document.getElementById('vig-warn');
  if(!desde){ warn.innerHTML = '<div class="warnbox">Cargá desde cuándo corre el fijo.</div>'; return; }
  if(hasta && hasta < desde){ warn.innerHTML = '<div class="warnbox">"Hasta" no puede ser antes que "desde".</div>'; return; }
  if(asignacionesSinVigencia){ warn.innerHTML = '<div class="warnbox">La base todavía no tiene vigencia de los fijos (falta la migración). Avisale a Diego.</div>'; return; }
  const { error } = await escribirAsignacion(p=>sb.from('asignaciones').update(p).eq('id', asigId), {vigente_desde: desde, vigente_hasta: hasta, tipo});
  if(error){ warn.innerHTML = errBox(error); return; }
  if(asignacionesSinVigencia){ warn.innerHTML = '<div class="warnbox">La base todavía no tiene vigencia de los fijos (falta la migración). Avisale a Diego.</div>'; return; }
  cerrarModal();
  toast('Vigencia del fijo guardada.');
  if(document.getElementById('agenda-grid-wrap')) await cargarAgendaSolicitudes();
  if(document.getElementById('familiaslist') && typeof cargarFamilias==='function') await cargarFamilias();
}
async function quitarAsignacionFijaDesdeAgenda(asigId){
  const ok = await confirmarAccion('¿Quitar esta asignación fija? Ya no va a aparecer en la Agenda ni en Hoy.', 'Quitar');
  if(!ok) return;
  await quitarAsignacion(asigId);
  cerrarModal();
  cargarAgendaSolicitudes();
}
function abrirModalRegistroDesdeAgenda(s){
  const horario = s.termina_dia_siguiente
    ? `${(s.hora_inicio||'--:--').slice(0,5)} → +1 día${s.hora_fin?' '+s.hora_fin.slice(0,5):''}`
    : (s.hora_inicio ? (s.hora_fin ? `${s.hora_inicio.slice(0,5)}–${s.hora_fin.slice(0,5)}` : s.hora_inicio.slice(0,5)) : 'Sin horario');
  const cuerpo = `
    <h2>${escaparHtml(s.familia_nombre)}</h2>
    <div class="helper">${s.tipo==='traslado'?'Traslado':'Sitting'} · ${horario} · ya registrado en Sittings &amp; traslados</div>
    <div style="margin:14px 0;">
      <div class="agenda-ninerarow"><div><b>${escaparHtml(s.ninieras[0].ninera_nombre)}</b></div></div>
      ${s.cobro_familia ? `<div class="helper">Cobro a la familia: $${Number(s.cobro_familia).toLocaleString('es-UY')}</div>` : ''}
    </div>
    <button class="btn primary" style="width:100%;margin-bottom:8px;" onclick="editarRegistroDesdeAgenda(${argJs(s._regId)})">Editar este registro</button>
    <button class="btn danger" style="width:100%;" onclick="eliminarRegistroDesdeAgenda(${argJs(s._regId)})">Eliminar este registro</button>
  `;
  abrirModal(cuerpo);
}
async function eliminarRegistroDesdeAgenda(regId){
  const ok = await confirmarAccion('¿Eliminar este registro? No se puede deshacer.');
  if(!ok) return;
  const { error } = await sb.from('sittings_traslados').delete().eq('id', regId);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  cerrarModal();
  toast('Registro eliminado.');
  await cargarAgendaSolicitudes();
  actualizarAgendaBadge();
}
async function editarRegistroDesdeAgenda(regId){
  cerrarModal();
  await setModulo('sittings'); // espera a que sitItems ya esté cargado antes de buscar el registro
  abrirModalSitForm(regId);
}
async function confirmarNinera(solNineraId){
  let sPrevio = null, nPrevio = null;
  for(const sx of agendaSolicitudes){ const nx = sx.ninieras.find(x=>x.id===solNineraId); if(nx){ sPrevio=sx; nPrevio=nx; break; } }
  if(sPrevio && nPrevio){
    const choque = chequearDobleReservaAgenda(nPrevio.ninera_nombre, sPrevio.fecha, sPrevio.hora_inicio, sPrevio.hora_fin, sPrevio.id);
    if(!(await avisarSiDobleReserva(choque, nPrevio.ninera_nombre, 'Confirmar igual'))) return;
  }
  if(!(await sbGuardar(sb.from('solicitud_ninieras').update({estado:'confirmada'}).eq('id', solNineraId), 'la confirmación'))) return;
  let solId = null;
  for(const s of agendaSolicitudes){ if(s.ninieras.some(n=>n.id===solNineraId)){ solId = s.id; break; } }
  await cargarAgendaSolicitudes();
  if(solId){
    const s2 = agendaSolicitudes.find(x=>x.id===solId);
    if(s2 && s2.ninieras.length && s2.ninieras.every(n=>n.estado==='confirmada')){
      await sbGuardar(sb.from('solicitudes').update({estado:'confirmada'}).eq('id', solId), 'la solicitud');
      await cargarAgendaSolicitudes();
    }
    abrirModalSolicitud(solId);
  }
  actualizarAgendaBadge();
}
async function cancelarSolicitud(id){
  const ok = await confirmarAccion('¿Cancelar esta solicitud? Las niñeras invitadas quedarán sin efecto.', 'Cancelar solicitud');
  if(!ok) return;
  if(!(await sbGuardar(sb.from('solicitudes').update({estado:'cancelada'}).eq('id', id), 'la cancelación'))) return;
  cerrarModal();
  cargarAgendaSolicitudes();
  actualizarAgendaBadge();
}

/* ---- Actualización en vivo (Supabase Realtime) ----
   Cada módulo se suscribe a cambios en sus tablas relevantes. Cuando alguien
   (en otra sesión/celular) inserta, edita o borra algo en esas tablas, se
   vuelve a cargar la vista actual sola, sin que haga falta recargar la página. */
const RT_TABLAS_POR_MODULO = {
  hoy: ['sittings_traslados','gastos_generales','solicitudes','asignaciones','candidatas','ninieras','familias','solicitud_ninieras'],
  agenda: ['solicitudes','solicitud_ninieras','asignaciones','sittings_traslados','familias','ninieras'],
  rrhh: ['candidatas','entrevistas','carsitting_datos','ninieras'],
  ninieras: ['ninieras','candidatas','resenas_ninieras','sittings_traslados','juguetes'],
  familias: ['familias','asignaciones','sittings_traslados','resenas_ninieras','ninieras'],
  sittings: ['sittings_traslados','familias','ninieras','resenas_ninieras','tarifas_traslado_config'],
  finanzas: ['sittings_traslados','gastos_generales','gastos_fijos','familias','ninieras','asignaciones','app_config','intermediaciones_enrique','intermediaciones_eventos','intermediaciones_eventos_ninieras'],
  marketing: ['fechas_marketing'],
  legal: ['contratos','ninieras','familias'],
  juguetes: ['juguetes','juguetes_movimientos','ninieras'],
  intermediaciones: ['intermediaciones_enrique','intermediaciones_eventos','intermediaciones_eventos_ninieras','intermediaciones_enrique_pool','ninieras'],
};
let rtChannel = null;
let rtRefrescarTimer = null;
// Recarga liviana por módulo: solo trae los datos de nuevo y repinta la lista, sin destruir
// y reconstruir el módulo entero (buscador, filtros, etc.) como hace renderModulo(). Antes,
// CUALQUIER cambio en 'ninieras' o 'familias' — incluido tu propio guardado, que ya se
// mostraba bien al toque — disparaba 600ms después una reconstrucción completa del módulo
// vía Realtime, y esa reconstrucción de más era la causa real de que el scroll se siguiera
// yendo arriba pese a los dos intentos anteriores (que sí guardaban/restauraban el scroll,
// pero sobre un DOM que se estaba tirando abajo y volviendo a armar de cero). De paso, esto
// evita perder lo que estabas escribiendo en el buscador cuando llega un cambio de otro lado.
const RT_RECARGA_LIVIANA = {
  ninieras: 'cargarNinieras',
  familias: 'cargarFamilias',
};
function suscribirRealtimeModuloActivo(){
  if(rtChannel){ sb.removeChannel(rtChannel); rtChannel = null; }
  const clave = moduloActivo && !moduloActivo.startsWith('pend-') ? moduloActivo : 'hoy';
  const tablas = RT_TABLAS_POR_MODULO[clave] || [];
  if(!tablas.length) return;
  rtChannel = sb.channel('rt-'+clave+'-'+Date.now());
  tablas.forEach(t=>{
    rtChannel.on('postgres_changes', {event:'*', schema:'public', table:t}, ()=>{
      clearTimeout(rtRefrescarTimer);
      rtRefrescarTimer = setTimeout(async ()=>{
        if(document.querySelector('.confirmoverlay.show')) return; // no interrumpir un modal abierto
        const recargaLiviana = RT_RECARGA_LIVIANA[clave] && window[RT_RECARGA_LIVIANA[clave]];
        const scrollRT = guardarScrollMainarea();
        if(recargaLiviana){ await recargaLiviana(); }
        else { renderModulo(); }
        restaurarScrollMainarea(scrollRT);
      }, 600);
    });
  });
  rtChannel.subscribe();
}
function renderModulo(){
  renderSidebar();
  document.getElementById('modfooter').innerHTML = '';
  suscribirRealtimeModuloActivo();
  const cont = document.getElementById('modcontent');
  // Devuelve la promesa del render específico (cuando la tiene) para que quien llame a
  // renderModulo()/setModulo() pueda hacer `await` y saber que los datos ya cargaron de
  // verdad, en vez de adivinar un setTimeout con un tiempo fijo (ver editarRegistroDesdeAgenda,
  // cargarSittingDesdePendiente, agendarDesdeIntake, irANotificacion).
  if(!moduloActivo){ return renderDashboard(cont); }
  if(moduloActivo.startsWith('pend-')){ return renderPendHoy(cont); }
  const m = MODULOS.find(x=>x.key===moduloActivo);
  if(moduloActivo==='agenda'){ return renderAgenda(cont); }
  if(moduloActivo==='rrhh'){ cont.innerHTML = moduloHeader(m.label) + rrhhShell(); return afterRrhhRender(); }
  if(moduloActivo==='ninieras'){ cont.innerHTML = moduloHeader(m.label) + '<div id="ninieras-body"></div>'; return renderNinieras(document.getElementById('ninieras-body')); }
  if(moduloActivo==='familias'){ cont.innerHTML = moduloHeader(m.label) + '<div id="fam-body"></div>'; return renderFamilias(document.getElementById('fam-body')); }
  if(moduloActivo==='finanzas'){ return renderFinanzas(cont); }
  if(moduloActivo==='sittings'){ cont.innerHTML = moduloHeader(m.label) + '<div id="sit-body"></div>'; return renderSittings(document.getElementById('sit-body')); }
  if(moduloActivo==='marketing'){ return renderMarketing(cont); }
  if(moduloActivo==='legal'){ return renderLegal(cont); }
  if(moduloActivo==='juguetes'){ cont.innerHTML = moduloHeader(m.label) + '<div id="jug-body"></div>'; return renderJuguetes(document.getElementById('jug-body')); }
  if(moduloActivo==='intermediaciones'){ return renderIntermediaciones(cont); }
  if(moduloActivo==='notificaciones'){ cont.innerHTML = moduloHeader(m.label) + '<div id="notifcfg-body"></div>'; return renderNotifConfig(document.getElementById('notifcfg-body')); }
}

