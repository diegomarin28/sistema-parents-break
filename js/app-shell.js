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
  intermediaciones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M4 12h10M4 17h16"/><circle cx="18" cy="12" r="2.2"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 4 2 20h20L12 4Z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>`,
};
ICONS.notificaciones = ICONS.bell;
const MODULOS = [
  {key:'agenda', label:'Agenda', desc:'Solicitudes de familias, asignación de niñeras y calendario del día.'},
  {key:'rrhh', label:'Postulantes', desc:'Candidatas y entrevistas — el pipeline completo, de punta a punta.'},
  {key:'ninieras', label:'Niñeras', desc:'Tu equipo activo, con filtro por nombre y zona.'},
  {key:'familias', label:'Familias', desc:'Familias, tarifas por niñera y márgenes.'},
  {key:'sittings', label:'Sittings & traslados', desc:'Registro diario de sittings y traslados.'},
  {key:'intermediaciones', label:'Intermediaciones', desc:'Colocaciones vía Agencia Enrique y eventos empresariales.'},
  {key:'finanzas', label:'Finanzas', desc:'Ingresos, pagos a niñeras y gastos generales — con datos reales.'},
  {key:'marketing', label:'Marketing', desc:'Calendario de fechas especiales y contenido.'},
  {key:'legal', label:'Contratos', desc:'Contratos de niñeras y traslados.'},
  {key:'juguetes', label:'Juguetes', desc:'Inventario de juguetes y en qué casa está cada uno.'},
  {key:'notificaciones', label:'Notificaciones', desc:'Elegí qué avisos te llegan como push al celular, además de la campanita.'},
];
let moduloActivo = null;
let rrhhTab = 'intake';
let dashPendientesHoy = [];

function nombreUsuario(){
  // El nombre a mostrar vive en user_metadata.nombre_mostrar (Supabase Auth), no en el
  // código público — antes había un mapa mail->nombre hardcodeado acá, que exponía los
  // mails personales de Pau y Delfi en el repo público. Si algún día se agrega una cuenta
  // nueva sin este campo cargado, cae al nombre derivado del mail como antes.
  const meta = session?.user?.user_metadata || {};
  if(meta.nombre_mostrar) return meta.nombre_mostrar;
  const email = session?.user?.email || '';
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
      <button class="notif-btn" onclick="event.stopPropagation();toggleNotifPanel()" aria-label="Notificaciones" title="Notificaciones">
        ${ICONS.bell}<span class="notif-badge">0</span>
      </button>
    </div>
    <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="toggleSidebarMobile(false)"></div>
    <div class="appshell">
      <aside class="sidebar" id="sidebar"></aside>
      <main id="modcontent" class="mainarea"></main>
    </div>
    <div id="modfooter"></div>
    <div class="notif-panel" id="notif-panel"></div>
  `;
  // Si venimos de tocar una notificación push (sw.js abre "/?ir=agenda"), arrancamos
  // directo en ese módulo en vez de Hoy, y limpiamos el parámetro de la URL.
  const irParam = new URLSearchParams(window.location.search).get('ir');
  if(irParam){
    window.history.replaceState({}, '', window.location.pathname);
    moduloActivo = irParam;
  }
  renderModulo();
  cargarNotificaciones();
  suscribirNotifRealtime();
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
    <div class="sidebar-logo-wrap">
      <img src="logo.png" alt="Parents Break — ir a Hoy" class="sidebar-logo" role="button" tabindex="0" style="cursor:pointer;" onclick="setModulo(null)" onkeydown="if(event.key==='Enter'||event.key===' '){setModulo(null);}">
      <button class="notif-btn desktop" onclick="event.stopPropagation();toggleNotifPanel()" aria-label="Notificaciones" title="Notificaciones">
        ${ICONS.bell}<span class="notif-badge">0</span>
      </button>
    </div>
    <nav class="sidebar-nav">
      <button class="navitem ${activeTop==='hoy'?'active':''}" onclick="setModulo(null)" title="Hoy">
        <div class="navitem-ic">${ICONS.hoy}</div><div class="navitem-label">Hoy</div>
      </button>
      ${MODULOS.map(m=>`
        <button class="navitem ${activeTop===m.key?'active':''}" onclick="setModulo('${m.key}')" title="${m.label}">
          <div class="navitem-ic">${ICONS[m.key]}</div><div class="navitem-label">${m.label}</div>
          ${m.key==='agenda' ? `<span id="agenda-navdot"></span>` : ''}
          ${m.key==='finanzas' ? `<span id="finanzas-navdot"></span>` : ''}
          ${m.key==='notificaciones' ? `<span id="notif-navdot"></span>` : ''}
        </button>`).join('')}
    </nav>
    <div class="sidebar-foot">
      ${nombreUsuario()}<br>
      ${PASSKEY_SOPORTADO ? `<button onclick="gestionarPasskeys()">Face ID / Touch ID</button> · ` : ''}<button onclick="logout()">Cerrar sesión</button>
    </div>
  `;
  actualizarAgendaBadge();
  actualizarFinanzasBadge();
  renderNotifBell();
  actualizarNotifNavdot();
  ajustarSidebarNav();
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
function mananaISO(){ const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); }
function diasAtras(n){ const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
const PENDIENTE_DIAS_ATRAS = 14; // hasta cuántos días hacia atrás se avisa si algo previsto quedó sin registrar
function rangoFechas(desdeISO, hastaISO){
  const dias = [];
  let d = new Date(desdeISO+'T00:00:00');
  const hasta = new Date(hastaISO+'T00:00:00');
  while(d <= hasta){ dias.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); }
  return dias;
}
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
        <div class="pendbanner-label">Sittings/traslados sin registrar</div>
      </div>
      <div class="pendbanner-link">Ver</div>
    </button>
    <div class="card">
      <h2>Sin resolver · hoy y mañana</h2>
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
  const [pipelineR, ninierasR, familiasR, sitsR, gastosR, hoyR, solR, solSinResolverR] = await Promise.allSettled([
    sb.from('candidatas').select('estado').in('estado', ['intake','entrevistada']),
    sb.from('ninieras').select('nombre,tipo,activa'),
    sb.from('familias').select('cobro_hora'),
    sb.from('sittings_traslados').select('fecha,cobro_familia,pago_ninera').gte('fecha', primerDiaMesesAtras(6)),
    sb.from('gastos_generales').select('fecha,monto').gte('fecha', primerDiaMesesAtras(6)),
    sb.from('sittings_traslados').select('fecha,familia_nombre,ninera_nombre').gte('fecha', diasAtras(PENDIENTE_DIAS_ATRAS)).lte('fecha', todayISO()),
    sb.from('solicitudes').select('*').gte('fecha', diasAtras(PENDIENTE_DIAS_ATRAS)).lte('fecha', todayISO()).eq('estado','confirmada'),
    sb.from('solicitudes').select('*').gte('fecha', todayISO()).lte('fecha', mananaISO()).in('estado', ['sin_asignar','pendiente_confirmar']).order('fecha', {ascending:true}),
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

  // ---- Panel "Sin resolver · hoy y mañana" ----
  const box = document.getElementById('agenda');
  try{
    if(!box) return;
    const sinResolver = okData(solSinResolverR);
    if(!sinResolver.length){
      box.innerHTML = '<div class="empty">Todo lo de hoy y mañana ya tiene niñera confirmada.</div>';
    } else {
      const hoyStr = todayISO();
      const filas = sinResolver.map(s=>{
        const esHoy = s.fecha===hoyStr;
        const horario = s.hora_inicio ? `${s.hora_inicio.slice(0,5)}${s.hora_fin?'–'+s.hora_fin.slice(0,5):''}` : 'Sin horario';
        const estadoTxt = s.estado==='pendiente_confirmar' ? 'Invitación enviada, sin confirmar' : 'Sin niñera asignada';
        return `
        <div class="agendarow" style="cursor:pointer;" onclick="setModulo('agenda')">
          <div class="agendatime">${esHoy?'Hoy':'Mañana'} · ${horario}</div>
          <div class="agendaicon ${s.tipo==='traslado'?'traslado':'sitting'}">${s.tipo==='traslado'?ICONS.sittings:ICONS.ninieras}</div>
          <div class="agendabody">
            <div><b>${s.familia_nombre}</b></div>
            <div class="agendatype">${estadoTxt}</div>
          </div>
        </div>`;
      });
      box.innerHTML = `<div class="timeline">${filas.join('')}</div>`;
    }
  }catch(e){ if(box) box.innerHTML = errBox(e); }

  // ---- Pendiente (sittings/traslados previstos, hasta hoy, sin registrar) ----
  // Mira hacia atrás PENDIENTE_DIAS_ATRAS días, no solo hoy — si un puntual confirmado de
  // hace unos días quedó sin cargar en Sittings & traslados, se sigue avisando en vez de
  // perderse apenas pasa el día. IMPORTANTE (12/09): los fijos (horarios recurrentes, tabla
  // asignaciones) NUNCA entran acá — esos se registran por su propio camino semanal aparte;
  // meterlos en este panel día a día generaba ruido contra ese flujo, no un aviso real.
  try{
    const registros = okData(hoyR);
    const solicitudesConfirmadas = okData(solR);
    const registradosSet = new Set((registros||[]).map(r=>r.fecha+'|'+normaliza(r.ninera_nombre||'')+'|'+normaliza(r.familia_nombre||'')));

    const previstos = [];

    if(solicitudesConfirmadas.length){
      const { data: snRango } = await sb.from('solicitud_ninieras').select('*').in('solicitud_id', solicitudesConfirmadas.map(s=>s.id)).eq('estado','confirmada');
      const porSol = {};
      (snRango||[]).forEach(r=>{ (porSol[r.solicitud_id] ||= []).push(r); });
      solicitudesConfirmadas.forEach(s=>{
        (porSol[s.id]||[]).forEach(n=>{
          previstos.push({ fecha: s.fecha, ninera_nombre: n.ninera_nombre, familia_nombre: s.familia_nombre, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin });
        });
      });
    }

    dashPendientesHoy = previstos.filter(p=>{
      const key = p.fecha+'|'+normaliza(p.ninera_nombre||'')+'|'+normaliza(p.familia_nombre||'');
      return !registradosSet.has(key);
    }).sort((a,b)=> a.fecha.localeCompare(b.fecha));

    const el = document.getElementById('dash-pend-num');
    if(el) el.textContent = dashPendientesHoy.length;
  }catch(e){}
}

function renderPendHoy(cont){
  cont.innerHTML = `
    <button class="backbtn" onclick="setModulo(null)">← Volver</button>
    <h1 class="modtitle">Sittings/traslados sin registrar</h1>
    <div class="helper">Comparando lo previsto de los últimos ${PENDIENTE_DIAS_ATRAS} días (pedidos puntuales confirmados) contra lo que ya cargaste en Sittings &amp; traslados. Los horarios fijos no entran acá — esos se registran aparte.</div>
    <div class="card">
      ${dashPendientesHoy.length ? dashPendientesHoy.map(a=>{
        const fechaFmt = new Date(a.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'});
        const esHoy = a.fecha===todayISO();
        return `
        <div class="agendarow" style="border-bottom:1px solid var(--line);flex-wrap:wrap;gap:8px;">
          <div>
            <div><b>${esHoy?'Hoy':fechaFmt}</b> · ${a.ninera_nombre} → ${a.familia_nombre || 'familia sin nombre'}</div>
            <div style="color:var(--ink-soft);">${a.hora_inicio ? a.hora_inicio.slice(0,5) : ''}${a.hora_fin ? '–'+a.hora_fin.slice(0,5) : ''}</div>
          </div>
          <button class="smallbtn" onclick='cargarSittingDesdePendiente(${JSON.stringify(a).replace(/'/g,"&#39;")})'>Cargar sitting</button>
        </div>`;
      }).join('') : '<div class="empty">Está todo registrado.</div>'}
    </div>
    <div class="actions"><button class="btn primary" onclick="setModulo('sittings')">Ir a cargar un sitting suelto</button></div>
  `;
}
function cargarSittingDesdePendiente(item){
  sitPrefill = {
    familiaNombre: item.familia_nombre,
    nineraNombre: item.ninera_nombre,
    fecha: item.fecha,
    horaInicio: item.hora_inicio,
    horaFin: item.hora_fin,
    notas: 'Cargado desde "Sittings sin registrar"',
  };
  setModulo('sittings');
  setTimeout(()=>abrirModalSitForm(), 500);
}

/* ================= NOTIFICACIONES (campanita) =================
   V1: solo los "urgentes" — sittings de HOY sin asignar y sittings de HOY sin registrar
   (misma lógica que ya usan el panel "Sin resolver · hoy y mañana" y el banner de Hoy,
   pero acotada a hoy). "Leído" es individual por usuaria (tabla notificaciones_leidas).
   "Resuelto" no se marca a mano: si el sitting ya tiene niñera o ya se cargó, deja de
   aparecer en la consulta sola y por lo tanto desaparece de la campanita para las dos.
   El push real al celu (VAPID) queda para una próxima etapa — esto es solo la campanita. */
let notifItems = [];
let notifLeidas = new Set();
let notifPanelAbierto = false;
let notifChannel = null;
let notifRefrescarTimer = null;

function notifUsuario(){ return session?.user?.email || 'desconocida'; }

/* Catálogo único de tipos de notificación — lo usa tanto cargarNotificaciones() (bell) como
   renderNotifConfig() (la pantalla de ajustes) y, en paralelo, la Edge Function (con su
   propia copia en Deno, ver enviar-push-urgentes) para saber qué mandar por push y con qué
   default cuando el usuario nunca tocó el switch. */
const TIPOS_NOTIF = [
  {tipo:'sin_asignar', label:'Sitting sin asignar', sub:'Hoy, sin niñera confirmada', icono:'agenda', defaultPush:true},
  {tipo:'sin_registrar', label:'Sitting sin registrar', sub:'Ya pasó y falta cargarlo en el sistema', icono:'sittings', defaultPush:false},
  {tipo:'cv_desactualizado', label:'CV de niñera desactualizado', sub:'Cumplió años después de generarlo', icono:'ninieras', defaultPush:true},
  {tipo:'extracto', label:'Falta subir extracto Itaú', sub:'Hace más de 15 días que no se sube uno nuevo', icono:'finanzas', defaultPush:true},
];

async function cargarNotificaciones(){
  if(!session) return;
  const hoyStr = todayISO();
  const [{data:sinAsignar}, {data:sitsHoy}, {data:solConfHoy}] = await Promise.all([
    sb.from('solicitudes').select('id,familia_nombre,hora_inicio,tipo').eq('fecha', hoyStr).in('estado', ['sin_asignar','pendiente_confirmar']),
    sb.from('sittings_traslados').select('familia_nombre').eq('fecha', hoyStr),
    sb.from('solicitudes').select('id,familia_nombre,hora_inicio').eq('fecha', hoyStr).eq('estado','confirmada'),
  ]);
  const items = [];
  (sinAsignar||[]).forEach(s=>{
    items.push({
      id: 'sol:'+s.id,
      tipo: 'sin_asignar',
      titulo: 'Sitting sin asignar',
      mensaje: `${s.familia_nombre||'Familia sin nombre'}, hoy${s.hora_inicio?' '+s.hora_inicio.slice(0,5):''} — sin niñera confirmada`,
      destino: 'agenda',
    });
  });
  if(solConfHoy && solConfHoy.length){
    const registradas = new Set((sitsHoy||[]).map(r=>normaliza(r.familia_nombre||'')));
    const { data: snHoy } = await sb.from('solicitud_ninieras').select('id,ninera_nombre,solicitud_id').in('solicitud_id', solConfHoy.map(s=>s.id)).eq('estado','confirmada');
    const porSol = {};
    (snHoy||[]).forEach(r=>{ (porSol[r.solicitud_id] ||= []).push(r); });
    solConfHoy.forEach(s=>{
      if(registradas.has(normaliza(s.familia_nombre||''))) return;
      (porSol[s.id]||[]).forEach(n=>{
        items.push({
          id: 'sn:'+n.id,
          tipo: 'sin_registrar',
          titulo: 'Sitting sin registrar',
          mensaje: `${n.ninera_nombre} → ${s.familia_nombre||'familia sin nombre'}, hoy${s.hora_inicio?' '+s.hora_inicio.slice(0,5):''} — todavía no se cargó`,
          destino: 'pend-hoy',
        });
      });
    });
  }

  // CV desactualizado: misma condición que ya usa el badge de la lista de Niñeras
  // (cvEstaDesactualizado, en ninieras.js) — la reusamos tal cual, no se duplica la regla.
  try{
    const { data: ninierasActivas } = await sb.from('ninieras').select('id,nombre,cv_generado_en,candidatas(fecha_nacimiento)').eq('activa', true);
    (ninierasActivas||[]).forEach(n=>{
      if(typeof cvEstaDesactualizado === 'function' && cvEstaDesactualizado(n)){
        items.push({
          id: 'cv:'+n.id,
          tipo: 'cv_desactualizado',
          titulo: 'CV desactualizado',
          mensaje: `${n.nombre} cumplió años después de generarle el CV — convendría regenerarlo`,
          destino: 'ninieras',
          abrirId: n.id,
        });
      }
    });
  }catch(e){}

  // Extracto Itaú sin subir hace más de 15 días. El id incluye la fecha límite: mientras
  // no se suba un extracto nuevo, la fecha límite no cambia, así que esto avisa una sola
  // vez por período atrasado (no se repite cada 10 minutos) — recién vuelve a avisar si
  // pasan otros 15 días desde la próxima vez que se suba. Si nunca se subió ninguno (no hay
  // fila todavía), es el caso más urgente de todos, no el motivo para no avisar.
  try{
    const { data: cfg } = await sb.from('app_config').select('actualizado_at').eq('id','ultima_conciliacion_cobros').maybeSingle();
    if(!cfg?.actualizado_at){
      items.push({
        id: 'extracto:nunca',
        tipo: 'extracto',
        titulo: 'Falta subir el extracto de Itaú',
        mensaje: `Todavía no se subió ningún extracto para conciliar.`,
        destino: 'finanzas',
      });
    } else {
      const limite = new Date(cfg.actualizado_at);
      limite.setDate(limite.getDate()+15);
      if(limite.getTime() <= Date.now()){
        items.push({
          id: 'extracto:'+limite.toISOString().slice(0,10),
          tipo: 'extracto',
          titulo: 'Falta subir el extracto de Itaú',
          mensaje: `Hace más de 15 días que no se sube un extracto nuevo para conciliar.`,
          destino: 'finanzas',
        });
      }
    }
  }catch(e){}

  notifItems = items;
  await cargarNotifLeidas();
  renderNotifBell();
}

async function cargarNotifLeidas(){
  if(!notifItems.length){ notifLeidas = new Set(); return; }
  const { data } = await sb.from('notificaciones_leidas').select('notif_id').eq('usuario', notifUsuario()).in('notif_id', notifItems.map(i=>i.id));
  notifLeidas = new Set((data||[]).map(r=>r.notif_id));
}

function renderNotifBell(){
  const sinLeer = notifItems.filter(i=>!notifLeidas.has(i.id)).length;
  document.querySelectorAll('.notif-badge').forEach(b=>{
    b.textContent = sinLeer;
    b.style.display = sinLeer ? 'flex' : 'none';
  });
  const panel = document.getElementById('notif-panel');
  if(!panel) return;
  const cuerpo = notifItems.length ? notifItems.map(i=>`
    <div class="notif-item ${notifLeidas.has(i.id)?'':'unread'}" onclick="irANotificacion('${i.id}')">
      <div class="notif-item-ic">${ICONS.alert}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${i.titulo}</div>
        <div class="notif-item-msg">${i.mensaje}</div>
      </div>
    </div>`).join('') : '<div class="notif-empty">No hay avisos urgentes por ahora.</div>';
  panel.innerHTML = `<div class="notif-panel-head">Notificaciones</div>${cuerpo}`;
}

async function irANotificacion(id){
  const item = notifItems.find(i=>i.id===id);
  await marcarNotifLeida(id);
  toggleNotifPanel(false);
  if(!item) return;
  setModulo(item.destino);
  if(item.abrirId && item.destino==='ninieras' && typeof verNinera==='function'){
    setTimeout(()=>verNinera(item.abrirId), 500);
  }
}

async function marcarNotifLeida(id){
  if(notifLeidas.has(id)) return;
  notifLeidas.add(id);
  renderNotifBell();
  await sb.from('notificaciones_leidas').upsert({notif_id:id, usuario:notifUsuario(), leido_en:new Date().toISOString()});
}

function toggleNotifPanel(force){
  notifPanelAbierto = typeof force==='boolean' ? force : !notifPanelAbierto;
  document.getElementById('notif-panel')?.classList.toggle('show', notifPanelAbierto);
}
document.addEventListener('click', (e)=>{
  if(!notifPanelAbierto) return;
  const panel = document.getElementById('notif-panel');
  if(panel && !panel.contains(e.target) && !e.target.closest('.notif-btn')) toggleNotifPanel(false);
});

function suscribirNotifRealtime(){
  if(notifChannel){ sb.removeChannel(notifChannel); notifChannel = null; }
  notifChannel = sb.channel('rt-notif-'+Date.now());
  ['solicitudes','solicitud_ninieras','sittings_traslados'].forEach(t=>{
    notifChannel.on('postgres_changes', {event:'*', schema:'public', table:t}, ()=>{
      clearTimeout(notifRefrescarTimer);
      notifRefrescarTimer = setTimeout(cargarNotificaciones, 600);
    });
  });
  notifChannel.subscribe();
}

/* ---- Push real al celular (Web Push + VAPID) ----
   Solo para lo urgente: sittings de hoy sin asignar. La clave privada VAPID vive en la
   tabla app_secrets (sin ninguna policy — solo la Edge Function, con la service role key,
   puede leerla). El envío real lo hace la Edge Function "enviar-push-urgentes", disparada
   por un cron de Supabase cada 10 minutos — no depende de que este chat ni el navegador
   estén abiertos. Acá solo pedimos permiso, nos suscribimos, y guardamos la suscripción. */
const VAPID_PUBLIC_KEY = 'BPfb5Yy4XNWZVci1Cq7fnwxS-pVApiKii_QOTeRwUEzJMy1D9K1e8RMef4Lp8TBmXX1jhYTRHL9A5318e0ikHkc';
function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
function pushSoportado(){
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
async function pushYaActivado(){
  if(!pushSoportado()) return false;
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }catch(e){ return false; }
}
async function activarPushNotificaciones(){
  if(!pushSoportado()){
    toast('Este dispositivo no soporta notificaciones push. En iPhone: agregá la app a la pantalla de inicio primero (compartir → Agregar a inicio) y probá de nuevo desde ahí.');
    return;
  }
  try{
    const permiso = await Notification.requestPermission();
    if(permiso !== 'granted'){
      toast('No se activó — hace falta dar permiso de notificaciones cuando el navegador lo pide.');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const json = sub.toJSON();
    await sb.from('push_subscriptions').upsert({
      usuario: notifUsuario(),
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    }, {onConflict:'endpoint'});
    toast('Notificaciones push activadas en este dispositivo.');
  }catch(e){
    toast('No se pudo activar el push: '+(e.message||e));
  }
  // Una vez activado ya no tiene sentido mostrar la tarjeta "Este dispositivo" (era solo para
  // llegar a este punto) — se vuelve a pintar toda la pantalla para que desaparezca sola.
  if(notifCfgCont) renderNotifConfig(notifCfgCont);
  actualizarNotifNavdot();
}
async function actualizarNotifNavdot(){
  const dot = document.getElementById('notif-navdot');
  if(!dot) return;
  const activo = await pushYaActivado();
  dot.innerHTML = (pushSoportado() && !activo) ? '<span class="navdot"></span>' : '';
}

/* ---- Pantalla "Notificaciones" (sidebar) ----
   Acá vive todo lo de push en un solo lugar: activar el dispositivo, y elegir tipo por tipo
   cuáles mandan push al celular (la campanita siempre muestra todo, esto solo filtra el push).
   Preferencia por usuaria (notif_push_preferencias): si no hay fila guardada, se usa el
   default de TIPOS_NOTIF — mismo criterio que aplica la Edge Function del lado del servidor.
   El mismo puntito rojo que ya usan Agenda y Finanzas (navdot) se prende en este ítem del
   menú mientras ESTE dispositivo no tenga el push activado — así avisa solo, sin que haga
   falta entrar a mirar. Una vez activado, ni el punto ni la tarjeta de "Este dispositivo"
   se muestran más: si ya lo hiciste, confirmarlo cada vez no aporta nada. */
let notifCfgCont = null;
async function renderNotifConfig(cont){
  notifCfgCont = cont;
  cont.innerHTML = '<div class="empty">Cargando…</div>';
  const [{data:prefs}, activo] = await Promise.all([
    sb.from('notif_push_preferencias').select('tipo,activado').eq('usuario', notifUsuario()),
    pushYaActivado(),
  ]);
  const prefMap = {};
  (prefs||[]).forEach(p=>{ prefMap[p.tipo] = p.activado; });
  cont.innerHTML = `
    ${activo ? '' : `
    <div class="card">
      <h2>Este dispositivo</h2>
      ${!pushSoportado()
        ? `<p class="helper">Este dispositivo no soporta notificaciones push.</p>`
        : `<p class="helper" style="margin-bottom:12px;">Activalo una vez por dispositivo (celular, tablet) para recibir avisos aunque tengas la app cerrada. En iPhone hay que agregarlo antes a la pantalla de inicio (compartir → Agregar a inicio).</p>
           <button class="btn" onclick="activarPushNotificaciones()">Activar notificaciones push</button>`}
    </div>`}
    <div class="card">
      <h2>Qué te llega como push</h2>
      <p class="helper" style="margin-bottom:4px;">La campanita siempre muestra todo. Esto es solo para elegir cuáles además te avisan directo al celular.</p>
      <div class="notifcfg-list">
        ${TIPOS_NOTIF.map(t=>{
          const checked = prefMap[t.tipo] !== undefined ? prefMap[t.tipo] : t.defaultPush;
          return `
          <div class="notifcfg-row">
            <div class="notifcfg-row-ic">${ICONS[t.icono]||ICONS.bell}</div>
            <div class="notifcfg-row-body">
              <div class="notifcfg-row-title">${t.label}</div>
              <div class="notifcfg-row-sub">${t.sub}</div>
            </div>
            <label class="toggle">
              <input type="checkbox" ${checked?'checked':''} onchange="guardarPrefNotif('${t.tipo}', this.checked)">
              <span class="track"></span>
            </label>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
  actualizarNotifNavdot();
}
async function guardarPrefNotif(tipo, activado){
  await sb.from('notif_push_preferencias').upsert({usuario: notifUsuario(), tipo, activado}, {onConflict:'usuario,tipo'});
  toast('Guardado.');
}

/* ---- Sidebar: nunca scrollea, se achica solo si hace falta ----
   Si al agregar módulos nuevos el menú deja de entrar en la altura del dispositivo, se aplica
   la clase .snug (menos padding/gap/tamaño de letra) en vez de dejar que aparezca un scroll
   interno. Se revisa cada vez que se repinta el sidebar. */
function ajustarSidebarNav(){
  const nav = document.querySelector('.sidebar-nav');
  const sidebar = document.getElementById('sidebar');
  if(!nav || !sidebar) return;
  nav.classList.remove('snug');
  sidebar.classList.remove('snug-logo');
  requestAnimationFrame(()=>{
    if(sidebar.scrollHeight > sidebar.clientHeight + 1){
      nav.classList.add('snug');
    }
    requestAnimationFrame(()=>{
      if(sidebar.scrollHeight > sidebar.clientHeight + 1){
        sidebar.classList.add('snug-logo');
      }
    });
  });
}

