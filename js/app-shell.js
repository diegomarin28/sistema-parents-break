/* ================= APP SHELL ================= */
const ICONS = {
  salir: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  rrhh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>`,
  familias: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/></svg>`,
  sittings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 16v-3l2-4h12l2 4v3"/><path d="M4 16h16"/><circle cx="8" cy="17.5" r="1.4"/><circle cx="16" cy="17.5" r="1.4"/></svg>`,
  finanzas: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20V10M11 20V4M18 20v-7"/></svg>`,
  marketing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 10v4h3l7 4V6l-7 4H4z"/><path d="M18 9a4 4 0 010 6"/></svg>`,
  legal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>`,
  ninieras: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="7.5" r="3.2"/><path d="M6 20c0-3.4 2.7-5.7 6-5.7s6 2.3 6 5.7"/><path d="M9 20v-3M15 20v-3"/></svg>`,
  hoy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/></svg>`,
  agenda: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/><path d="M8 3v4M16 3v4"/></svg>`,
  moneyIn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/></svg>`,
  moneyOut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7l5 5 4-4 7 8"/><path d="M15 16h5v-5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></svg>`,
  juguetes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="10" width="7" height="7" rx="1.2"/><circle cx="16.5" cy="13.5" r="3.5"/><path d="M9 10V7a2 2 0 1 1 2 2H9z"/></svg>`,
};
const MODULOS = [
  {key:'agenda', label:'Agenda', desc:'Solicitudes de familias, asignación de niñeras y calendario del día.'},
  {key:'rrhh', label:'Postulantes', desc:'Candidatas y entrevistas — el pipeline completo, de punta a punta.'},
  {key:'ninieras', label:'Niñeras', desc:'Tu equipo activo, con filtro por nombre y zona.'},
  {key:'familias', label:'Familias', desc:'Familias, tarifas por niñera y márgenes.'},
  {key:'sittings', label:'Sittings & traslados', desc:'Registro diario de sittings y traslados.'},
  {key:'finanzas', label:'Finanzas', desc:'Ingresos, pagos a niñeras y gastos generales — con datos reales.'},
  {key:'marketing', label:'Marketing', desc:'Calendario de fechas especiales y contenido.'},
  {key:'legal', label:'Contratos', desc:'Contratos de niñeras y traslados.'},
  {key:'juguetes', label:'Juguetes', desc:'Inventario de juguetes y en qué casa está cada uno.'},
];
let moduloActivo = null;
let rrhhTab = 'intake';
let dashPendientesHoy = [];

function nombreUsuario(){
  const email = session?.user?.email || '';
  const mapa = { 'pauugericke@gmail.com':'Pau Gericke', 'delfifrommel@gmail.com':'Delfi Frommel' };
  if(mapa[email]) return mapa[email];
  const local = (email.split('@')[0] || '').replace(/[^a-zA-Z]/g,'');
  return local ? local.charAt(0).toUpperCase()+local.slice(1) : '?';
}
function renderApp(){
  document.getElementById('app').innerHTML = `
    <div class="mobile-topbar">
      <button class="mobile-menubtn" onclick="toggleSidebarMobile()" aria-label="Abrir menú">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
      </button>
      <img src="logo.png" alt="Parents Break — ir a Hoy" class="mobile-topbar-logo" role="button" tabindex="0" onclick="setModulo(null)" onkeydown="if(event.key==='Enter'||event.key===' '){setModulo(null);}">
      <div class="mobile-topbar-user">
        <span class="mobile-topbar-name">${nombreUsuario()}</span>
      </div>
    </div>
    <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="toggleSidebarMobile(false)"></div>
    <div class="appshell">
      <aside class="sidebar" id="sidebar"></aside>
      <main id="modcontent" class="mainarea"></main>
    </div>
    <div id="modfooter"></div>
  `;
  renderModulo();
}
function toggleSidebarMobile(force){
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  const abrir = typeof force === 'boolean' ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', abrir);
  bd.classList.toggle('show', abrir);
}
function setModulo(k){ moduloActivo=k; renderModulo(); toggleSidebarMobile(false); }
function renderSidebar(){
  const activeTop = (moduloActivo===null || moduloActivo==='hoy') ? 'hoy' : (MODULOS.some(m=>m.key===moduloActivo) ? moduloActivo : null);
  document.getElementById('sidebar').innerHTML = `
    <div class="sidebar-logo-wrap"><img src="logo.png" alt="Parents Break — ir a Hoy" class="sidebar-logo" role="button" tabindex="0" style="cursor:pointer;" onclick="setModulo(null)" onkeydown="if(event.key==='Enter'||event.key===' '){setModulo(null);}"></div>
    <nav class="sidebar-nav">
      <button class="navitem ${activeTop==='hoy'?'active':''}" onclick="setModulo(null)" title="Hoy">
        <div class="navitem-ic">${ICONS.hoy}</div><div class="navitem-label">Hoy</div>
      </button>
      ${MODULOS.map(m=>`
        <button class="navitem ${activeTop===m.key?'active':''}" onclick="setModulo('${m.key}')" title="${m.label}">
          <div class="navitem-ic">${ICONS[m.key]}</div><div class="navitem-label">${m.label}</div>
          ${m.key==='agenda' ? `<span id="agenda-navdot"></span>` : ''}
          ${m.key==='finanzas' ? `<span id="finanzas-navdot"></span>` : ''}
        </button>`).join('')}
    </nav>
    <div class="sidebar-foot">
      ${session.user.email}<br><button onclick="logout()">Cerrar sesión</button>
    </div>
  `;
  actualizarAgendaBadge();
  actualizarFinanzasBadge();
}
async function actualizarFinanzasBadge(){
  const dot = document.getElementById('finanzas-navdot');
  if(!dot) return;
  const [{data:cfg}, {data:pend}] = await Promise.all([
    sb.from('app_config').select('actualizado_at').eq('id','ultima_conciliacion_cobros').maybeSingle(),
    sb.from('sittings_traslados').select('id').eq('pagado', false).gt('pago_ninera', 0).limit(1),
  ]);
  const diasSinExtracto = cfg?.actualizado_at ? (Date.now() - new Date(cfg.actualizado_at).getTime()) / 86400000 : Infinity;
  const hayAviso = diasSinExtracto > 7 || (pend && pend.length > 0);
  dot.innerHTML = hayAviso ? '<span class="navdot"></span>' : '';
}

const DIAS_LABEL = {L:'Lun',M:'Mar',X:'Mié',J:'Jue',V:'Vie',S:'Sáb',D:'Dom'};
const DIAS_CORTO = {L:'Lu',M:'Ma',X:'Mi',J:'Ju',V:'Vi',S:'Sa',D:'Do'};
function diaHoy(){ return ['D','L','M','X','J','V','S'][new Date().getDay()]; }
function fechaHoyLarga(){
  const f = new Intl.DateTimeFormat('es-UY', {weekday:'long', day:'numeric', month:'long'}).format(new Date());
  return f.charAt(0).toUpperCase() + f.slice(1);
}

let dashChart = null;
async function renderDashboard(cont){
  cont.innerHTML = `
    <div class="homeintro"><div class="eyebrow">Parents Break</div><h1>Hoy · ${fechaHoyLarga()}</h1>
    </div>
    <div class="statrow" id="statrow">
      <div class="statcard" style="cursor:pointer;" onclick="setModulo('rrhh')"><div class="statnum">—</div><div class="statlabel">En proceso</div><div class="statnum-trend" id="trend-proceso"></div></div>
      <div class="statcard" style="cursor:pointer;" onclick="setModulo('ninieras')"><div class="statnum">—</div><div class="statlabel">Niñeras activas</div><div class="statnum-trend" id="trend-ninieras"></div></div>
      <div class="statcard" style="cursor:pointer;" onclick="setModulo('familias')"><div class="statnum">—</div><div class="statlabel">Familias</div><div class="statnum-trend" id="trend-familias"></div></div>
    </div>
    <div class="chartcard">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
        <h2 style="margin:0;">Ingresos y gastos por mes</h2>
        <div class="chartlegend"><span><span class="chartdot" style="background:var(--accent);"></span>Ingresos</span><span><span class="chartdot" style="background:var(--clay);"></span>Gastos</span></div>
      </div>
      <div style="position:relative;height:170px;" id="finmesChartWrap"><canvas id="finmesChart" role="img" aria-label="Ingresos y gastos por mes, calculados a partir de los sittings, traslados y gastos generales reales"></canvas></div>
    </div>
    <button class="pendbanner" onclick="setModulo('pend-hoy')">
      <div class="pendbanner-left">
        <div class="pendbanner-num" id="dash-pend-num">—</div>
        <div class="pendbanner-label">Sittings/traslados de hoy sin registrar</div>
      </div>
      <div class="pendbanner-link">Ver</div>
    </button>
    <div class="card">
      <h2>Agenda de hoy · ${DIAS_LABEL[diaHoy()]}</h2>
      <div id="agenda" class="agendabox"><div class="empty">Cargando…</div></div>
    </div>
  `;
  loadDashboardData();
}
async function loadDashboardData(){
  const chartReady = asegurarChart(); // se descarga en paralelo con las consultas, no bloquea nada
  // Una sola tanda en paralelo con TODAS las consultas independientes del dashboard.
  // Antes eran 4 tandas en serie (4 idas y vueltas a Supabase); ahora es 1.
  // allSettled: si una consulta falla, las demás secciones igual se renderizan.
  const [pipelineR, ninierasR, familiasR, sitsR, gastosR, asigR, hoyR, solR] = await Promise.allSettled([
    sb.from('candidatas').select('estado').in('estado', ['intake','entrevistada']),
    sb.from('ninieras').select('nombre,tipo,activa'),
    sb.from('familias').select('cobro_hora'),
    sb.from('sittings_traslados').select('fecha,cobro_familia,pago_ninera').gte('fecha', primerDiaMesesAtras(6)),
    sb.from('gastos_generales').select('fecha,monto').gte('fecha', primerDiaMesesAtras(6)),
    sb.from('asignaciones').select('*, familias(nombre)').order('hora_inicio', {ascending:true, nullsFirst:false}),
    sb.from('sittings_traslados').select('familia_nombre,ninera_nombre').eq('fecha', todayISO()),
    sb.from('solicitudes').select('*').eq('fecha', todayISO()).eq('estado','confirmada'),
  ]);
  const okData = r => (r.status==='fulfilled' && !r.value.error) ? (r.value.data||[]) : [];

  // ---- Stat cards ----
  try{
    const nums = document.querySelectorAll('#statrow .statnum');
    const pipeline = okData(pipelineR);
    const sinEntrevistar = pipeline.filter(r=>r.estado==='intake').length;
    const entrevistadas = pipeline.filter(r=>r.estado==='entrevistada').length;
    if(nums[0]) nums[0].textContent = pipeline.length;
    const tProceso = document.getElementById('trend-proceso');
    if(tProceso) tProceso.textContent = pipeline.length ? `${sinEntrevistar} sin entrevistar · ${entrevistadas} entrevistada${entrevistadas===1?'':'s'}` : 'Nadie en el pipeline ahora';

    const ninierasActivas = okData(ninierasR).filter(n=>n.activa===true);
    if(nums[1]) nums[1].textContent = ninierasActivas.length;
    const soloNinera = ninierasActivas.filter(n=>(n.tipo||'Niñera')==='Niñera').length;
    const traslados = ninierasActivas.filter(n=>n.tipo==='Traslados').length;
    const ambas = ninierasActivas.filter(n=>n.tipo==='Ambas').length;
    const tNin = document.getElementById('trend-ninieras');
    if(tNin) tNin.textContent = `${soloNinera} niñera · ${traslados} traslados · ${ambas} ambas`;

    const familias = okData(familiasR);
    if(nums[2]) nums[2].textContent = familias.length;
    const conTarifa = familias.filter(f=>f.cobro_hora!==null && f.cobro_hora!=='').length;
    const tFam = document.getElementById('trend-familias');
    if(tFam) tFam.textContent = `${conTarifa} con tarifa fija cargada`;
  }catch(e){}

  // ---- Gráfico ingresos/gastos por mes ----
  try{
    const sits = okData(sitsR);
    const gastos = okData(gastosR);
    const porMes = {};
    (sits||[]).forEach(r=>{
      if(!r.fecha) return;
      const mes = r.fecha.slice(0,7);
      if(!porMes[mes]) porMes[mes] = {ingresos:0, gastos:0};
      porMes[mes].ingresos += Number(r.cobro_familia)||0;
      porMes[mes].gastos += Number(r.pago_ninera)||0;
    });
    (gastos||[]).forEach(g=>{
      if(!g.fecha) return;
      const mes = g.fecha.slice(0,7);
      if(!porMes[mes]) porMes[mes] = {ingresos:0, gastos:0};
      porMes[mes].gastos += Number(g.monto)||0;
    });
    const meses = Object.keys(porMes).sort().slice(-6);
    const wrap = document.getElementById('finmesChartWrap');
    const canvas = document.getElementById('finmesChart');
    await chartReady;
    if(canvas && meses.length && window.Chart){
      const labels = meses.map(m=>{
        const [y,mm] = m.split('-').map(Number);
        const f = new Intl.DateTimeFormat('es-UY', {month:'short'}).format(new Date(y, mm-1, 1));
        return (f.charAt(0).toUpperCase()+f.slice(1)).replace('.','');
      });
      if(dashChart){ dashChart.destroy(); dashChart = null; }
      dashChart = new Chart(canvas, {
        type:'bar',
        data:{ labels, datasets:[
          {label:'Ingresos', data:meses.map(m=>Math.round(porMes[m].ingresos)), backgroundColor:'#757CBB', borderRadius:4, barThickness:22},
          {label:'Gastos', data:meses.map(m=>Math.round(porMes[m].gastos)), backgroundColor:'#DF8386', borderRadius:4, barThickness:22},
        ]},
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
          scales:{
            y:{ grid:{color:'#E3E1EE'}, ticks:{color:'#6C6A84', font:{size:10}, callback:v=>'$'+Math.round(v/1000)+'k'} },
            x:{ grid:{display:false}, ticks:{color:'#6C6A84', font:{size:11.5}} }
          } }
      });
    } else if(wrap){
      wrap.innerHTML = '<div class="empty">Todavía no hay suficientes sittings o gastos cargados para graficar por mes.</div>';
    }
  }catch(e){}

  // ---- Agenda de hoy ----
  const box = document.getElementById('agenda');
  let agendaItems = [];
  try{
    const asigError = asigR.status==='fulfilled' ? asigR.value.error : asigR.reason;
    if(asigError){ if(box) box.innerHTML = errBox(asigError); }
    else{
      const ninTipos = okData(ninierasR);
      const data = okData(asigR);
      const tipoPorNinera = {};
      (ninTipos||[]).forEach(n=>{ tipoPorNinera[normaliza(n.nombre)] = n.tipo || 'Niñera'; });
      const hoy = diaHoy();
      agendaItems = (data||[]).filter(a => Array.isArray(a.dias) && a.dias.includes(hoy));

      // Solicitudes puntuales (Agenda) confirmadas para hoy — se suman a los horarios fijos.
      const solicitudesHoy = okData(solR);
      if(solicitudesHoy.length){
        const { data: snHoy } = await sb.from('solicitud_ninieras').select('*').in('solicitud_id', solicitudesHoy.map(s=>s.id)).eq('estado','confirmada');
        const porSol = {};
        (snHoy||[]).forEach(r=>{ (porSol[r.solicitud_id] ||= []).push(r); });
        solicitudesHoy.forEach(s=>{
          (porSol[s.id]||[]).forEach(n=>{
            agendaItems.push({ ninera_nombre: n.ninera_nombre, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, familias: {nombre: s.familia_nombre}, _tipo: s.tipo });
          });
        });
      }
      agendaItems.sort((a,b)=> (a.hora_inicio||'').localeCompare(b.hora_inicio||''));

      // El usuario puede haber navegado a otro módulo mientras esperábamos estas
      // consultas — si el contenedor de la agenda ya no está en la pantalla,
      // no hay nada más para hacer acá (evita el error "null.innerHTML").
      if(!box) return;

      if(!agendaItems.length){
        box.innerHTML = '<div class="empty">No hay niñeras agendadas para hoy — cargá los horarios en Familias.</div>';
      } else {
        const ahora = new Date();
        const minAhora = ahora.getHours()*60 + ahora.getMinutes();
        const minDe = (hhmm) => { if(!hhmm) return null; const [h,m] = hhmm.split(':').map(Number); return h*60+m; };
        let nowInsertado = false;
        const filas = agendaItems.map(a=>{
          const esTraslado = a._tipo ? a._tipo==='traslado' : tipoPorNinera[normaliza(a.ninera_nombre)] === 'Traslados';
          const horario = a.hora_inicio ? `${a.hora_inicio.slice(0,5)}${a.hora_fin?'–'+a.hora_fin.slice(0,5):''}` : 'Sin horario';
          const finMin = minDe(a.hora_fin) ?? minDe(a.hora_inicio);
          const yaPaso = finMin !== null && finMin < minAhora;
          let nowMarker = '';
          const inicioMin = minDe(a.hora_inicio);
          if(!nowInsertado && inicioMin !== null && inicioMin >= minAhora){
            nowInsertado = true;
            const ahoraFmt = ahora.toLocaleTimeString('es-UY', {hour:'2-digit', minute:'2-digit'});
            nowMarker = `<div class="timeline-now"><div class="agendatime">${ahoraFmt}</div><div class="timeline-now-line"></div></div>`;
          }
          return `${nowMarker}
          <div class="agendarow ${yaPaso?'pasado':''}">
            <div class="agendatime">${horario}</div>
            <div class="agendaicon ${esTraslado?'traslado':'sitting'}">${esTraslado?ICONS.sittings:ICONS.ninieras}</div>
            <div class="agendabody">
              <div><b>${a.ninera_nombre}</b> con <b>${a.familias?.nombre || 'familia sin nombre'}</b></div>
              <div class="agendatype">${esTraslado?'Traslado':'Sitting'}</div>
            </div>
          </div>`;
        });
        box.innerHTML = `<div class="timeline">${filas.join('')}${nowInsertado ? '' : `<div class="timeline-now"><div class="agendatime">${ahora.toLocaleTimeString('es-UY', {hour:'2-digit', minute:'2-digit'})}</div><div class="timeline-now-line"></div></div>`}</div>`;
      }
    }
  }catch(e){ if(box) box.innerHTML = errBox(e); }

  // ---- Pendiente de hoy (sittings de la agenda sin registrar) ----
  try{
    const registrosHoy = okData(hoyR);
    dashPendientesHoy = agendaItems.filter(a=>{
      const famN = normaliza(a.familias?.nombre||'');
      const ninN = normaliza(a.ninera_nombre||'');
      return !(registrosHoy||[]).some(r => normaliza(r.familia_nombre)===famN && normaliza(r.ninera_nombre)===ninN);
    });
    const el = document.getElementById('dash-pend-num');
    if(el) el.textContent = dashPendientesHoy.length;
  }catch(e){}
}

function renderPendHoy(cont){
  cont.innerHTML = `
    <button class="backbtn" onclick="setModulo(null)">← Volver</button>
    <h1 class="modtitle">Sittings/traslados de hoy sin registrar</h1>
    <div class="helper">Comparando la agenda de hoy (armada en Familias) contra lo que ya cargaste en Sittings &amp; traslados.</div>
    <div class="card">
      ${dashPendientesHoy.length ? dashPendientesHoy.map(a=>`
        <div class="agendarow" style="border-bottom:1px solid var(--line);">
          <div><b>${a.ninera_nombre}</b> → ${a.familias?.nombre || 'familia sin nombre'}</div>
          <div style="color:var(--ink-soft);">${a.hora_inicio ? a.hora_inicio.slice(0,5) : ''}${a.hora_fin ? '–'+a.hora_fin.slice(0,5) : ''}</div>
        </div>`).join('') : '<div class="empty">Ya está todo registrado por hoy.</div>'}
    </div>
    <div class="actions"><button class="btn primary" onclick="setModulo('sittings')">Ir a cargar sittings</button></div>
  `;
}

