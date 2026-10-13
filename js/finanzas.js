/* ================= FINANZAS ================= */
let finMes = null;
async function renderFinanzas(cont){
  finMes = finMes || currentMonthStr();
  cont.innerHTML = moduloHeader('Finanzas') + `
    <div class="helper">Ingresos y pagos a niñeras vienen automáticos desde Sittings &amp; traslados. El resultado del mes se calcula sobre lo facturado (lo que se trabajó), aunque todavía no se haya cobrado; lo cobrado se muestra aparte como la plata que ya entró. Los demás gastos del negocio (alquiler, insumos, etc.) se cargan acá a mano. Los cobros se pueden conciliar subiendo el extracto de Itaú, más abajo.</div>
    <div class="mesbar">
      <div class="mesnav">
        <button onclick="cambiarFinMesRel(-1)" aria-label="Mes anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="mesnav-label" id="fin-mes-label">${monthLabel(finMes)}</div>
        <button onclick="cambiarFinMesRel(1)" aria-label="Mes siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <button class="btn primary" onclick="abrirModalNuevoGasto()">+ Registrar gasto</button>
    </div>
    <div class="fin-vistas" style="display:flex;gap:6px;margin:0 0 12px;">
      <button class="smallbtn" id="fin-vista-resumen" onclick="cambiarVistaFinanzas('resumen')">Resumen</button>
      <button class="smallbtn" id="fin-vista-revisar" onclick="cambiarVistaFinanzas('revisar')">Revisar meses <span id="fin-revisar-cuenta"></span></button>
    </div>
    <div class="summary4" id="fin-summary"></div>
    <div class="card" id="fin-revisar" style="display:none;"><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>
    <div id="fin-vista-resumen-wrap">
    <div class="card" id="fin-balance-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div><h2 style="margin:0;">Balance de varios meses</h2><div class="helper" style="margin:2px 0 0;">Lo facturado y los costos de cada mes (pagos a niñeras y gastos), para ver la tendencia y no solo la foto de un mes.</div></div>
        <select id="fin-balance-rango" onchange="cargarBalanceMultiMes(Number(this.value))" style="width:auto;">
          <option value="3">Últimos 3 meses</option>
          <option value="6" selected>Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
        </select>
      </div>
      <div style="height:220px;margin-top:14px;"><canvas id="finBalanceChart" role="img" aria-label="Ingresos y gastos por mes"></canvas></div>
      <div class="summary3" id="fin-balance-totales" style="margin-top:14px;"></div>
    </div>
    <div class="card" id="fin-conciliar-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div><h2 style="margin:0;">Conciliar con el extracto Itaú</h2><div class="helper" style="margin:2px 0 0;">Subí el estado de cuenta (.xls, .xlsx o .csv): el sistema busca los créditos de cada familia y las transferencias a cada niñera por su cuenta bancaria, y te propone qué marcar como cobrado o pagado. Nada se marca sin que lo confirmes.</div></div>
      </div>
      <div id="fin-extracto-aviso"></div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <input type="file" accept=".csv,.xls,.xlsx" id="fin-conciliar-file" style="font-size:13px;">
        <button class="btn primary" onclick="conGuardado(this, ()=>procesarExtractoConciliacion())">Procesar extracto</button>
      </div>
      <div id="fin-conciliar-resultado" style="margin-top:14px;"></div>
    </div>
    <div class="card" id="fin-porcobrar-wrap"><h2>Por cobrar</h2><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>
    <div class="card" id="fin-porpagar-wrap"><h2>Por pagar</h2><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>
    <div class="chartcard" id="fin-breakdown-card" style="display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="position:relative;width:96px;height:96px;flex-shrink:0;"><canvas id="finBreakdownChart" role="img" aria-label="Composición de gastos: pagos a niñeras vs gastos generales"></canvas></div>
          <div>
            <h2 style="margin:0 0 6px;">Composición de gastos</h2>
            <div class="chartlegend" id="fin-breakdown-legend" style="flex-direction:column;gap:5px;"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="card" id="fin-margen-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
        <div><h2 style="margin:0;">Margen por familia / zona / tipo</h2><div class="helper" style="margin:2px 0 0;">De ${monthLabel(finMes)} — para ver dónde rinde más el negocio y dónde el precio no está acompañando.</div></div>
        <div style="display:flex;gap:6px;">
          <button class="smallbtn" id="fin-margen-tab-familia" onclick="renderMargen('familia')">Por familia</button>
          <button class="smallbtn" id="fin-margen-tab-zona" onclick="renderMargen('zona')">Por zona</button>
          <button class="smallbtn" id="fin-margen-tab-tipo" onclick="renderMargen('tipo')">Por tipo</button>
        </div>
      </div>
      <div id="fin-margen-tabla"><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div><h2 style="margin:0;">Gastos fijos mensuales</h2><div class="helper" style="margin:2px 0 0;">Suscripciones y gastos que se repiten todos los meses (Claude, Canva, etc.) — se suman solos al total, sin tener que recargarlos cada mes.</div></div>
        <button class="smallbtn" onclick="abrirModalNuevoGastoFijo()">+ Agregar gasto fijo</button>
      </div>
      <div id="fin-fijos-list" style="margin-top:10px;"></div>
    </div>
    <div class="card" id="fin-movs"></div>
    </div>
  `;
  cambiarVistaFinanzas(finVista, false);
  cargarFinanzas();
  cargarBalanceMultiMes(6);
  cargarPorCobrarPorPagar();
  cargarAvisoExtracto();
}
async function cargarAvisoExtracto(){
  const box = document.getElementById('fin-extracto-aviso');
  if(!box) return;
  const { data:cfg } = await sb.from('app_config').select('actualizado_at').eq('id','ultima_conciliacion_cobros').maybeSingle();
  if(!cfg?.actualizado_at){
    box.innerHTML = `<div style="background:var(--clay-soft);color:var(--clay-text);font-size:13px;padding:10px 14px;border-radius:10px;margin-top:10px;border:1px solid var(--clay);">Todavía no se subió ningún extracto de Itaú acá — subilo cuando lo tengas para conciliar los cobros del mes.</div>`;
    return;
  }
  const dias = Math.floor((Date.now() - new Date(cfg.actualizado_at).getTime()) / 86400000);
  box.innerHTML = dias > 7
    ? `<div style="background:var(--clay-soft);color:var(--clay-text);font-size:13px;padding:10px 14px;border-radius:10px;margin-top:10px;border:1px solid var(--clay);">Hace ${dias} días que no se sube un extracto — subilo para mantener los cobros al día.</div>`
    : `<div class="helper" style="margin-top:6px;">Último extracto subido hace ${dias===0?'menos de un día':dias+' día'+(dias===1?'':'s')}.</div>`;
}
/* E3 · Margen por familia/zona/tipo — agrupa los sittings/traslados ya
   cargados del mes (finSitsDelMes, sin consulta nueva) y muestra cobro,
   pago y margen por grupo, para ver dónde rinde el negocio y dónde no. */
function renderMargen(criterio){
  finMargenTab = criterio;
  ['familia','zona','tipo'].forEach(c=>{
    const btn = document.getElementById('fin-margen-tab-'+c);
    if(btn){
      const activo = c===criterio;
      btn.style.background = activo ? '#666EAE' : '';
      btn.style.color = activo ? '#fff' : '';
      btn.style.borderColor = activo ? '#666EAE' : '';
    }
  });
  const tabla = document.getElementById('fin-margen-tabla');
  if(!tabla) return;
  const grupos = {};
  finSitsDelMes.forEach(r=>{
    let key;
    if(criterio==='tipo'){
      key = r.tipo==='traslado' ? 'Traslados' : 'Sittings';
    } else if(criterio==='zona'){
      key = (r.familia_id && finZonaPorFamiliaId[r.familia_id]) || finZonaPorFamiliaNombre[normaliza(r.familia_nombre||'')] || '(sin zona)';
    } else {
      key = r.familia_nombre || '(sin identificar)';
    }
    if(!grupos[key]) grupos[key] = {cobro:0, pago:0, cant:0};
    grupos[key].cobro += Number(r.cobro_familia)||0;
    grupos[key].pago += Number(r.pago_ninera)||0;
    grupos[key].cant += 1;
  });
  const filas = Object.entries(grupos).map(([nombre, g])=>({
    nombre, ...g, margen: g.cobro-g.pago, margenPct: g.cobro>0 ? Math.round((g.cobro-g.pago)/g.cobro*100) : 0,
  })).sort((a,b)=> b.margen-a.margen);

  if(!filas.length){ tabla.innerHTML = '<div class="empty">No hay sittings ni traslados cargados este mes todavía.</div>'; return; }

  tabla.innerHTML = `
    <div class="tablewrap"><table class="asigtable">
      <thead><tr><th>${criterio==='tipo'?'Tipo':criterio==='zona'?'Zona':'Familia'}</th><th>Cant.</th><th>Cobrado</th><th>Pagado</th><th>Margen</th><th>%</th></tr></thead>
      <tbody>${filas.map(f=>`
        <tr>
          <td>${escaparHtml(f.nombre)}</td>
          <td>${f.cant}</td>
          <td>$${f.cobro.toLocaleString('es-UY')}</td>
          <td>$${f.pago.toLocaleString('es-UY')}</td>
          <td style="color:${f.margen>=0?'var(--good)':'var(--bad)'};font-weight:600;">$${f.margen.toLocaleString('es-UY')}</td>
          <td>${f.margenPct}%</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}
function cambiarFinMesRel(delta){
  finMes = shiftMes(finMes, delta);
  const lbl = document.getElementById('fin-mes-label'); if(lbl) lbl.textContent = monthLabel(finMes);
  cargarFinanzas();
}
function abrirModalNuevoGasto(){
  abrirModal(`
    <h2 style="margin:0 0 6px;">Registrar gasto</h2>
    <div class="helper" style="margin-bottom:14px;">Alquiler, insumos u otro gasto puntual del negocio que no sea pago a una niñera.</div>
    <div class="grid3">
      <div class="field"><label>Fecha</label><input type="date" id="fin-gasto-fecha" value="${todayISO()}"></div>
      <div class="field"><label>Concepto</label><input type="text" id="fin-gasto-concepto" placeholder="Alquiler, insumos..."></div>
      <div class="field"><label>Monto</label><input type="number" id="fin-gasto-monto"></div>
    </div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarGastoGeneral())">Agregar gasto</button>
    </div>`);
}
async function guardarGastoGeneral(){
  const fecha = document.getElementById('fin-gasto-fecha').value;
  const concepto = document.getElementById('fin-gasto-concepto').value.trim();
  const monto = Number(document.getElementById('fin-gasto-monto').value)||0;
  if(!fecha || !concepto || !monto){ toast('Faltan fecha, concepto o monto.', 'bad'); return; }
  if(monto < 0){ toast('El monto no puede ser negativo.', 'bad'); return; }
  const { error } = await sb.from('gastos_generales').insert({fecha, concepto, monto});
  if(error){ toast('No se pudo guardar: '+error.message, 'bad'); return; }
  cerrarModal();
  toast('Gasto agregado.');
  cargarFinanzas();
}
async function eliminarGastoGeneral(id){
  if(!(await confirmarAccion('¿Eliminar este gasto? No se puede deshacer.'))) return;
  const { error } = await sb.from('gastos_generales').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message, 'bad'); return; }
  cargarFinanzas();
}
function editarGastoGeneral(id){
  const g = finGastosItems.find(x=>x.id===id);
  if(!g) return;
  abrirModal(`
    <h2 style="margin:0 0 18px;">Editar gasto</h2>
    <div class="grid3">
      <div class="field"><label>Fecha</label><input type="date" id="ed-gasto-fecha" value="${escaparHtml(g.fecha)}"></div>
      <div class="field"><label>Concepto</label><input type="text" id="ed-gasto-concepto" value="${escaparHtml(g.concepto)}"></div>
      <div class="field"><label>Monto</label><input type="number" id="ed-gasto-monto" value="${g.monto||0}"></div>
    </div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarEdicionGasto(${argJs(id)}))">Guardar</button>
    </div>
    <div id="fin-hist-box" style="margin-top:12px;"></div>`);
  verHistorialFinanzas('gastos_generales', id);
}
async function guardarEdicionGasto(id){
  const cambios = {
    fecha: document.getElementById('ed-gasto-fecha').value,
    concepto: document.getElementById('ed-gasto-concepto').value.trim(),
    monto: Number(document.getElementById('ed-gasto-monto').value)||0,
  };
  if(!cambios.fecha || !cambios.concepto){ toast('Faltan fecha o concepto.','bad'); return; }
  if(cambios.monto < 0){ toast('El monto no puede ser negativo.','bad'); return; }
  const { error } = await sb.from('gastos_generales').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Cambios guardados.');
  refrescarFinanzasCompleto();
}
let finGastosItems = [];
let finFijosItems = [];
let finSitsDelMes = [];
let finSitsTodosDelMes = []; // todos los registros del mes, sin filtrar -- para Movimientos y para editar
let finZonaPorFamiliaId = {};
let finZonaPorFamiliaNombre = {};
let finMargenTab = 'familia';
let finBreakdownChart = null;
function abrirModalNuevoGastoFijo(){
  abrirModal(`
    <h2 style="margin:0 0 6px;">Agregar gasto fijo</h2>
    <div class="helper" style="margin-bottom:14px;">Se va a sumar automáticamente todos los meses desde la fecha que pongas.</div>
    <div class="grid3">
      <div class="field"><label>Concepto</label><input type="text" id="ff-concepto" placeholder="Ej: Claude, Canva..."></div>
      <div class="field"><label>Monto mensual</label><input type="number" id="ff-monto"></div>
      <div class="field"><label>Desde</label><input type="date" id="ff-desde" value="${todayISO()}"></div>
    </div>
    <div class="field"><label>Notas</label><textarea id="ff-notas"></textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarGastoFijo())">Agregar</button>
    </div>`);
}
async function guardarGastoFijo(){
  const concepto = document.getElementById('ff-concepto').value.trim();
  const monto = Number(document.getElementById('ff-monto').value)||0;
  const desde = document.getElementById('ff-desde').value || todayISO();
  if(!concepto || !monto){ toast('Faltan concepto o monto.','bad'); return; }
  if(monto < 0){ toast('El monto no puede ser negativo.','bad'); return; }
  const { error } = await sb.from('gastos_fijos').insert({concepto, monto, desde, notas: document.getElementById('ff-notas').value || null});
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Gasto fijo agregado.');
  cargarFinanzas();
}
function editarGastoFijo(id){
  const g = finFijosItems.find(x=>x.id===id);
  if(!g) return;
  abrirModal(`
    <h2 style="margin:0 0 18px;">Editar gasto fijo</h2>
    <div class="grid3">
      <div class="field"><label>Concepto</label><input type="text" id="ef-concepto" value="${escaparHtml(g.concepto)}"></div>
      <div class="field"><label>Monto mensual</label><input type="number" id="ef-monto" value="${g.monto||0}"></div>
      <div class="field"><label>Desde</label><input type="date" id="ef-desde" value="${escaparHtml(g.desde)}"></div>
    </div>
    <div class="field"><label>Notas</label><textarea id="ef-notas">${escaparHtml(g.notas)}</textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarEdicionGastoFijo(${argJs(id)}))">Guardar</button>
    </div>`);
}
async function guardarEdicionGastoFijo(id){
  const cambios = {
    concepto: document.getElementById('ef-concepto').value.trim(),
    monto: Number(document.getElementById('ef-monto').value)||0,
    desde: document.getElementById('ef-desde').value,
    notas: document.getElementById('ef-notas').value || null,
  };
  if(!cambios.concepto || !cambios.desde){ toast('Faltan concepto o fecha.','bad'); return; }
  if(cambios.monto < 0){ toast('El monto no puede ser negativo.','bad'); return; }
  const { error } = await sb.from('gastos_fijos').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Cambios guardados.');
  cargarFinanzas();
}
async function toggleGastoFijo(id, activo){
  const { error } = await sb.from('gastos_fijos').update({activo}).eq('id', id);
  if(error){ toast('No se pudo actualizar: '+error.message,'bad'); cargarFinanzas(); return; } // la casilla vuelve a lo guardado
  cargarFinanzas();
}
async function eliminarGastoFijo(id){
  if(!(await confirmarAccion('¿Eliminar este gasto fijo? No se puede deshacer.'))) return;
  const { error } = await sb.from('gastos_fijos').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message,'bad'); return; }
  cargarFinanzas();
}
// Relaciones fijas (esa niñera trabaja fijo para esa familia): por id y por nombre, para no
// perder casos viejos sin id cargado. Se usa tanto acá como en Por cobrar/Por pagar.
// Desde el 05/10/2026 cuenta la vigencia: un sitting es "de un fijo" si en SU fecha había un
// fijo de esa niñera con esa familia (antes, al cambiar la niñera de un fijo, los sittings
// viejos de la niñera anterior dejaban de contar como fijos).
function construirEsTrabajoFijo(asigs){
  const porClave = new Map();
  const agregar = (k, a) => { if(!porClave.has(k)) porClave.set(k, []); porClave.get(k).push(a); };
  (asigs||[]).forEach(a=>{
    if(a.ninera_id && a.familia_id) agregar(a.ninera_id+'|'+a.familia_id, a);
    agregar(normaliza(a.ninera_nombre||'')+'|'+normaliza(a.familias?.nombre||''), a);
  });
  const vigenteEn = (k, fecha) => (porClave.get(k)||[]).some(a=>!fecha || asignacionVigenteEn(a, fecha));
  return function esTrabajoFijo(r){
    if(r.asignacion_id) return true;
    if(r.ninera_id && r.familia_id && vigenteEn(r.ninera_id+'|'+r.familia_id, r.fecha)) return true;
    return vigenteEn(normaliza(r.ninera_nombre||'')+'|'+normaliza(r.familia_nombre||''), r.fecha);
  };
}
// Cierre de semana para "Por pagar": por defecto los fijos cierran el sábado (así se les
// puede pagar antes del fin de semana), salvo que tengan algún horario fijo en sábado o
// domingo -- ahí se sigue esperando al domingo, para no dejar ese día de trabajo afuera del
// total. Se arma por niñera a partir de sus asignaciones (asig.dias, códigos D/L/M/X/J/V/S).
function construirTrabajaFinde(asigs){
  const diasPorNinera = {};
  const hoy = todayISO();
  (asigs||[]).forEach(a=>{
    if(asignacionTerminada(a, hoy)) return;
    const key = normaliza(a.ninera_nombre||'');
    if(!key) return;
    (a.dias||[]).forEach(d=>{ (diasPorNinera[key] ||= new Set()).add(d); });
  });
  return function trabajaFinde(nineraNombre){
    const set = diasPorNinera[normaliza(nineraNombre||'')];
    return !!set && (set.has('S') || set.has('D'));
  };
}
// Un sitting de un fijo (niñera con relación fija con esa familia) recién se cuenta en
// Finanzas -- ingresos, gastos, ganancia, margen, movimientos -- cuando la semana en la que
// cayó ya terminó (domingo pasado). Mientras la semana está en curso, ese número todavía
// puede seguir creciendo (faltan días de esa misma semana), así que mostrarlo antes daría un
// total a medio armar. Los sittings puntuales (no fijos) siguen contando al toque, como
// siempre.
function filtrarFijosSemanaIncompleta(sits, esTrabajoFijo){
  const hoy = todayISO();
  return (sits||[]).filter(r => !esTrabajoFijo(r) || finDeSemanaDesde(lunesDeSemana(r.fecha)) < hoy);
}
/* Números del resumen del mes (ver comentario en cargarFinanzas). */
function resumenFinancieroMes(sitsTodos, gastosNegocio, gastosAbsorbidos=0){
  const hoy = todayISO();
  const suma = (lista, campo, cond=()=>true) => (lista||[]).filter(cond).reduce((s,r)=>s+(Number(r[campo])||0), 0);
  const facturado = suma(sitsTodos, 'cobro_familia');
  const costoNinieras = suma(sitsTodos, 'pago_ninera');
  const gastos = Number(gastosNegocio)||0;
  return {
    facturado,
    costoNinieras,
    gastos,
    cobrado: suma(sitsTodos, 'cobro_familia', r=>r.cobrado),
    porCobrar: suma(sitsTodos, 'cobro_familia', r=>!r.cobrado),
    // Como la lista de Por pagar (E7): lo de días que todavía no pasaron no se debe todavía
    // (05/10/2026). Facturado y resultado sí lo cuentan, porque son del mes.
    porPagar: suma(sitsTodos, 'pago_ninera', r=>!r.pagado && r.fecha <= hoy),
    porPagarFuturo: suma(sitsTodos, 'pago_ninera', r=>!r.pagado && r.fecha > hoy),
    // Gastos extra que absorbe Parents Break (13/10/2026): no se le cobran a nadie y se le
    // reintegran a la niñera, así que bajan la ganancia del mes.
    absorbidos: Number(gastosAbsorbidos)||0,
    resultado: facturado - costoNinieras - gastos - (Number(gastosAbsorbidos)||0),
  };
}
async function cargarFinanzas(){
  const chartReady = asegurarChart(); // en paralelo, no bloquea el resto de Finanzas
  const summary = document.getElementById('fin-summary');
  const movsBox = document.getElementById('fin-movs');
  movsBox.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const desde = `${finMes}-01`;
  const hasta = shiftMes(finMes, 1)+'-01';
  let [{data:sitsRaw, error:e1}, {data:gastos, error:e2}, {data:fijos, error:e3}, {data:famsZona}, {data:asigs}] = await Promise.all([
    sb.from('sittings_traslados').select('*').gte('fecha', desde).lt('fecha', hasta),
    sb.from('gastos_generales').select('*').gte('fecha', desde).lt('fecha', hasta),
    sb.from('gastos_fijos').select('*').order('concepto'),
    sb.from('familias').select('id,nombre,zona'),
    sb.from('asignaciones').select('*, familias(nombre)'),
  ]);
  // Si se navegó a otro módulo mientras esperábamos estos datos, no seguir —
  // evita escribir sobre una pantalla que ya no está (mismo caso que "Hoy").
  if(!document.getElementById('fin-movs')) return;
  if(e1 || e2 || e3){ movsBox.innerHTML = errBox(e1||e2||e3); return; }
  cargarRevisarMes(sitsRaw, gastos, asigs);
  // Fijos automáticos (06/10/2026): lo previsto (días que todavía no llegaron) no entra en
  // ninguna cifra del mes; se muestra aparte, como referencia.
  const previstosMes = (sitsRaw||[]).filter(esPrevisto);
  sitsRaw = (sitsRaw||[]).filter(r=>!esPrevisto(r));
  const sits = filtrarFijosSemanaIncompleta(sitsRaw, construirEsTrabajoFijo(asigs));
  finSitsDelMes = sits || [];
  finZonaPorFamiliaId = {}; finZonaPorFamiliaNombre = {};
  (famsZona||[]).forEach(f=>{
    const zona = zonasDe(f.zona)[0] || '(sin zona)';
    finZonaPorFamiliaId[f.id] = zona;
    finZonaPorFamiliaNombre[normaliza(f.nombre)] = zona;
  });
  renderMargen(finMargenTab);
  finGastosItems = gastos || [];
  finFijosItems = fijos || [];
  const fijosDelMes = finFijosItems.filter(g => g.activo && g.desde && g.desde < hasta);
  const totalFijos = fijosDelMes.reduce((s,g)=>s+(Number(g.monto)||0), 0);
  const fijosList = document.getElementById('fin-fijos-list');
  if(fijosList){
    if(!finFijosItems.length){
      fijosList.innerHTML = '<div class="empty">Todavía no cargaste gastos fijos (suscripciones tipo Claude, Canva, etc.).</div>';
    } else {
      fijosList.innerHTML = finFijosItems.map(g=>{
        const aplicaEsteMes = g.activo && g.desde && g.desde < hasta;
        return `<div class="agendarow" style="border-bottom:1px solid var(--line);${g.activo?'':'opacity:.5;'}">
          <div>
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" ${g.activo?'checked':''} onchange="toggleGastoFijo(${argJs(g.id)}, this.checked)">
              ${escaparHtml(g.concepto)} <span style="color:var(--ink-soft);font-size:12px;">· desde ${g.desde ? new Date(g.desde+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) : '—'}${aplicaEsteMes?'':' · no aplica este mes'}</span>
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--clay-text);">$${Number(g.monto||0).toLocaleString('es-UY')}/mes</span>
            <button class="smallbtn" onclick="editarGastoFijo(${argJs(g.id)})">Editar</button>
            <button class="smallbtn danger" onclick="conGuardado(this, ()=>eliminarGastoFijo(${argJs(g.id)}))">Eliminar</button>
          </div>
        </div>`;
      }).join('') + (totalFijos>0 ? `<div class="helper" style="margin-top:8px;">Total fijos aplicados a ${monthLabel(finMes)}: <b>$${totalFijos.toLocaleString('es-UY')}</b></div>` : '');
    }
  }
  // Criterio (05/10/2026): el resultado del mes se calcula sobre lo FACTURADO (lo que se
  // trabajó en el mes), no sobre lo marcado como cobrado. Entre el 29/09 y el 05/10 fue al
  // revés y Finanzas mostró una pérdida que no existía: casi todo setiembre figuraba pagado a
  // las niñeras pero sin marcar como cobrado a las familias (error E1). Lo cobrado se muestra
  // aparte, como la plata que ya entró. Las cinco cifras salen de los mismos sittings (todo lo
  // registrado en el mes), así siempre se cumple facturado = cobrado + por cobrar. El margen por
  // familia/zona/tipo sigue esperando a que termine la semana de los fijos (renderMargen).
  finSitsTodosDelMes = sitsRaw || [];
  const absorbidos = await sumarGastosAbsorbidos(finSitsTodosDelMes.map(r=>r.id));
  if(!summary.isConnected) return; // se cambió de módulo mientras se leía
  const res = resumenFinancieroMes(finSitsTodosDelMes, (gastos||[]).reduce((s,g)=>s+(Number(g.monto)||0), 0) + totalFijos, absorbidos);
  const egresosNinieras = res.costoNinieras;
  const egresosGenerales = res.gastos;
  const egresos = egresosNinieras + egresosGenerales;
  const fmt = n => '$'+Math.round(n).toLocaleString('es-UY');
  summary.innerHTML = `
    <div class="summarycard"><div class="statlabel">Facturado de ${monthLabel(finMes)}</div><div class="statnum" id="fin-facturado" style="font-size:19px;margin-top:3px;">${fmt(res.facturado)}</div></div>
    <div class="summarycard"><div class="statlabel">Cobrado (plata que ya entró)</div><div class="statnum" id="fin-cobrado" style="font-size:19px;margin-top:3px;color:var(--good);">${fmt(res.cobrado)}</div></div>
    <div class="summarycard"><div class="statlabel">Por cobrar</div><div class="statnum" id="fin-porcobrar" style="font-size:19px;margin-top:3px;color:var(--warn);">${fmt(res.porCobrar)}</div></div>
    <div class="summarycard"><div class="statlabel">Por pagar a niñeras</div><div class="statnum" id="fin-porpagar" style="font-size:19px;margin-top:3px;color:var(--clay-text);">${fmt(res.porPagar)}</div>${res.porPagarFuturo ? `<div class="helper" id="fin-porpagar-futuro" style="margin:2px 0 0;">Sin contar ${fmt(res.porPagarFuturo)} de días que todavía no pasaron.</div>` : ''}</div>
    <div class="summarycard fin-resultado" style="grid-column:1/-1;border-left:3px solid ${res.resultado>=0?'var(--good)':'var(--bad)'};">
      <div class="statlabel">Resultado de ${monthLabel(finMes)}</div>
      <div class="statnum" id="fin-resultado" style="font-size:21px;margin-top:3px;color:${res.resultado>=0?'var(--good)':'var(--bad)'};">${fmt(res.resultado)}</div>
      <div class="helper" style="margin:4px 0 0;">Facturado ${fmt(res.facturado)} − pagos a niñeras ${fmt(res.costoNinieras)} − gastos del negocio ${fmt(res.gastos)}${res.absorbidos ? ` − gastos extra que absorbe Parents Break ${fmt(res.absorbidos)}` : ''}. Se calcula sobre lo facturado: un cobro sin marcar no lo cambia.</div>
    </div>
    ${previstosMes.length ? `<div class="summarycard fin-previsto" style="grid-column:1/-1;">
      <div class="statlabel">Previsto de acá a fin de mes (fijos que todavía no pasaron)</div>
      <div style="margin-top:3px;"><span id="fin-previsto-cobro" style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${fmt(previstosMes.reduce((t,r)=>t+(Number(r.cobro_familia)||0),0))}</span> a facturar · <span id="fin-previsto-pago" style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${fmt(previstosMes.reduce((t,r)=>t+(Number(r.pago_ninera)||0),0))}</span> a pagar a niñeras · ${previstosMes.length} día${previstosMes.length===1?'':'s'}</div>
      <div class="helper" style="margin:4px 0 0;">Es una referencia: no suma en las cifras de arriba. Cada día entra recién cuando llega.</div>
    </div>` : ''}
  `;

  const chartCard = document.getElementById('fin-breakdown-card');
  if(chartCard){
    await chartReady;
    // Mientras se descargaba Chart.js se pudo haber salido de Finanzas (auditoría 04/10/2026).
    const canvasBreakdown = document.getElementById('finBreakdownChart');
    const legendBreakdown = document.getElementById('fin-breakdown-legend');
    if(!canvasBreakdown || !legendBreakdown) return;
    if(egresos>0 && window.Chart){
      chartCard.style.display = '';
      if(finBreakdownChart){ finBreakdownChart.destroy(); finBreakdownChart = null; }
      finBreakdownChart = new Chart(canvasBreakdown, {
        type:'doughnut',
        data:{ labels:['Pagos a niñeras','Gastos generales'], datasets:[{ data:[Math.round(egresosNinieras), Math.round(egresosGenerales)], backgroundColor:['#757CBB','#DF8386'], borderWidth:0 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, cutout:'62%' }
      });
      legendBreakdown.innerHTML = `
        <span><span class="chartdot" style="background:#757CBB;"></span>Pagos a niñeras · $${Math.round(egresosNinieras).toLocaleString('es-UY')}</span>
        <span><span class="chartdot" style="background:#DF8386;"></span>Gastos generales · $${Math.round(egresosGenerales).toLocaleString('es-UY')}</span>`;
    } else {
      chartCard.style.display = 'none';
    }
  }
  const movs = [];
  finSitsTodosDelMes.forEach(r=>{
    if(Number(r.cobro_familia)) movs.push({fecha:r.fecha, texto:`${r.familia_nombre} — ${r.tipo==='sitting'?'sitting':'traslado'} (${r.ninera_nombre})`, monto:Number(r.cobro_familia), sitId:r.id, pendiente:!r.cobrado, pendTxt:'Sin cobrar'});
    if(Number(r.pago_ninera)) movs.push({fecha:r.fecha, texto:`Pago a ${r.ninera_nombre}`, monto:-Number(r.pago_ninera), sitId:r.id, pendiente:!r.pagado, pendTxt:'Sin pagar'});
  });
  (gastos||[]).forEach(g=>{
    movs.push({fecha:g.fecha, texto:g.concepto, monto:-Number(g.monto), gastoId:g.id});
  });
  movs.sort((a,b)=> b.fecha.localeCompare(a.fecha));
  if(!movs.length){ movsBox.innerHTML = `<div class="empty">No hay movimientos cargados en ${monthLabel(finMes)} todavía.</div>`; return; }
  movsBox.innerHTML = `<h2>Movimientos de ${monthLabel(finMes)}</h2><div class="helper">Los marcados como sin cobrar o sin pagar cuentan en el resultado del mes; la etiqueta solo avisa que esa plata todavía no entró o no salió.</div>` + movs.map(mv=>{
    const fechaFmt = new Date(mv.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'});
    const colorMonto = mv.pendiente ? 'var(--ink-soft)' : (mv.monto>0?'var(--good)':'var(--clay-text)');
    return `<div class="agendarow" style="border-bottom:1px solid var(--line);">
      <div>${fechaFmt} · ${escaparHtml(mv.texto)}${mv.pendiente ? ` <span class="badge warn" style="margin-left:6px;">${mv.pendTxt}</span>` : ''}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${colorMonto};">${mv.monto>0?'+':''}$${mv.monto.toLocaleString('es-UY')}</span>
        ${mv.gastoId ? `<button class="smallbtn" onclick="editarGastoGeneral(${argJs(mv.gastoId)})">Editar</button><button class="smallbtn danger" onclick="conGuardado(this, ()=>eliminarGastoGeneral(${argJs(mv.gastoId)}))">Eliminar</button>` : ''}
        ${mv.sitId ? `<button class="smallbtn" onclick="editarMovimientoSitting(${argJs(mv.sitId)})">Editar</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ---- Balance de varios meses ---- */
let finBalanceChart = null;
let finBalanceMeses = 6;
async function cargarBalanceMultiMes(nMeses){
  await esperarConfigFijos(); // fijos automáticos: saber si hay que sacar los previstos
  finBalanceMeses = nMeses;
  const chartReady = asegurarChart(); // en paralelo con las consultas de abajo
  const wrap = document.getElementById('fin-balance-totales');
  const sel = document.getElementById('fin-balance-rango');
  if(sel && Number(sel.value)!==nMeses) sel.value = String(nMeses);
  const hoy = currentMonthStr();
  const meses = [];
  for(let i=nMeses-1;i>=0;i--) meses.push(shiftMes(hoy, -i));
  const desde = `${meses[0]}-01`;
  const hasta = shiftMes(meses[meses.length-1], 1)+'-01';
  const [{data:sits, error:e1}, {data:gastos, error:e2}, {data:fijos, error:e3}] = await Promise.all([
    leerTodasLasFilas(()=>sinPrevistos(sb.from('sittings_traslados').select('fecha,cobro_familia,pago_ninera')).gte('fecha', desde).lt('fecha', hasta).order('id')),
    sb.from('gastos_generales').select('fecha,monto').gte('fecha', desde).lt('fecha', hasta),
    sb.from('gastos_fijos').select('monto,desde,activo'),
  ]);
  if(e1 || e2 || e3){ if(wrap) wrap.innerHTML = errBox(e1||e2||e3); return; }
  const porMes = {};
  meses.forEach(mes=> porMes[mes] = {ingresos:0, gastos:0});
  (sits||[]).forEach(r=>{
    const mes = r.fecha.slice(0,7);
    if(!porMes[mes]) return;
    // Mismo criterio que el resumen del mes: lo facturado y lo que corresponde pagar a
    // las niñeras por ese mes, esté o no marcado como cobrado / pagado.
    porMes[mes].ingresos += Number(r.cobro_familia)||0;
    porMes[mes].gastos += Number(r.pago_ninera)||0;
  });
  (gastos||[]).forEach(g=>{
    const mes = g.fecha.slice(0,7);
    if(!porMes[mes]) return;
    porMes[mes].gastos += Number(g.monto)||0;
  });
  meses.forEach(mes=>{
    const finMesStr = shiftMes(mes, 1)+'-01';
    const totalFijos = (fijos||[]).filter(g=>g.activo && g.desde && g.desde < finMesStr).reduce((s,g)=>s+(Number(g.monto)||0), 0);
    porMes[mes].gastos += totalFijos;
  });

  const labels = meses.map(mes=>{
    const [ya,ma] = mes.split('-').map(Number);
    const f = new Intl.DateTimeFormat('es-UY', {month:'short', year:'2-digit'}).format(new Date(ya, ma-1, 1));
    return f.replace('.', '');
  });
  const dataIngresos = meses.map(mes=>Math.round(porMes[mes].ingresos));
  const dataGastos = meses.map(mes=>Math.round(porMes[mes].gastos));

  const canvas = document.getElementById('finBalanceChart');
  await chartReady;
  if(canvas && window.Chart){
    if(finBalanceChart){ finBalanceChart.destroy(); finBalanceChart = null; }
    finBalanceChart = new Chart(canvas, {
      type:'bar',
      data:{ labels, datasets:[
        { label:'Facturado', data:dataIngresos, backgroundColor:'#6FAE8C', borderRadius:4 },
        { label:'Gastos', data:dataGastos, backgroundColor:'#DF8386', borderRadius:4 },
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{ y:{ ticks:{ callback:v=>'$'+Number(v).toLocaleString('es-UY') } } } }
    });
  }
  const totalIngresos = dataIngresos.reduce((s,v)=>s+v,0);
  const totalGastos = dataGastos.reduce((s,v)=>s+v,0);
  if(wrap){
    wrap.innerHTML = `
      <div class="summarycard"><div class="statlabel">Facturado (${nMeses} meses)</div><div class="statnum" style="font-size:19px;margin-top:3px;color:var(--good);">$${totalIngresos.toLocaleString('es-UY')}</div></div>
      <div class="summarycard"><div class="statlabel">Costos (${nMeses} meses)</div><div class="statnum" style="font-size:19px;margin-top:3px;color:var(--clay-text);">$${totalGastos.toLocaleString('es-UY')}</div></div>
      <div class="summarycard" style="border-left:3px solid var(--accent);"><div class="statlabel">Resultado del período</div><div class="statnum" style="font-size:19px;margin-top:3px;">$${(totalIngresos-totalGastos).toLocaleString('es-UY')}</div></div>
    `;
  }
}

/* ---- Por cobrar / Por pagar (agrupado por frecuencia de familia/niñera) ---- */
function lunesDeSemana(fechaISO){
  const dow = new Date(fechaISO+'T12:00:00').getDay();
  return sumarDiasISO(fechaISO, dow===0 ? -6 : 1-dow);
}
function finDeSemanaDesde(lunesISO, trabajaFinde=true){
  return sumarDiasISO(lunesISO, trabajaFinde ? 6 : 5); // +6 domingo (default, sin cambios) · +5 sábado
}
function fmtFechaCortaFin(fechaISO){
  return new Date(fechaISO+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'});
}
function bucketKeyFecha(fechaISO, frecuencia){
  if(frecuencia==='mensual') return fechaISO.slice(0,7);
  if(frecuencia==='semanal') return lunesDeSemana(fechaISO);
  return fechaISO;
}
function bucketLabelFecha(bucketKey, frecuencia, trabajaFinde=true){
  if(frecuencia==='mensual') return monthLabel(bucketKey);
  if(frecuencia==='semanal') return `Semana del ${fmtFechaCortaFin(bucketKey)} al ${fmtFechaCortaFin(finDeSemanaDesde(bucketKey, trabajaFinde))}`;
  return fmtFechaCortaFin(bucketKey);
}
/* ============================================================
   Saldo a favor (07/10/2026). Un ajuste (tabla ajustes_saldo) se suma (monto positivo) o
   se descuenta (negativo) en el próximo cobro de una familia o pago de una niñera: una
   niñera a la que se le pagó un sitting que hizo otra, una familia que pagó de más. Se ve
   como una línea en Por cobrar / Por pagar, en la ficha y en el PDF para las madres. Un
   saldo más grande que el próximo pago se va usando de a partes ("aplicado").
   Con la base sin migrar (sin la tabla) todo sigue como antes.
   ============================================================ */
let ajustesSaldoDisponible = true;
async function cargarAjustesSaldo(filtro){
  if(!ajustesSaldoDisponible) return [];
  let q = sb.from('ajustes_saldo').select('*').order('fecha', {ascending:true});
  if(filtro?.familia_id) q = q.eq('familia_id', filtro.familia_id);
  if(filtro?.ninera_id) q = q.eq('ninera_id', filtro.ninera_id);
  const { data, error } = await q;
  if(error){
    if(error.code==='PGRST205' || error.code==='42P01'){ ajustesSaldoDisponible = false; return []; }
    toast('No se pudieron leer los saldos a favor: '+error.message, 'bad');
    return [];
  }
  return data||[];
}
// Lo que falta usar de un ajuste, con su signo.
function pendienteAjuste(a){
  const resto = Math.abs(Number(a.monto)||0) - (Number(a.aplicado)||0);
  return resto > 0 ? Math.sign(Number(a.monto)) * resto : 0;
}
function textoMontoAjuste(n){
  const abs = Math.abs(Number(n)||0).toLocaleString('es-UY', {maximumFractionDigits:2});
  return (n<0 ? '−$' : '+$') + abs;
}
// Reparte los ajustes pendientes de cada persona sobre sus grupos, del más viejo al más
// nuevo: un descuento nunca deja un grupo en negativo (lo que sobra pasa al siguiente o
// queda para el próximo pago). Devuelve los ajustes que no entraron en ningún grupo.
function aplicarAjustesAGrupos(grupos, ajustes, sujeto){
  const clavePersona = sujeto==='familia'
    ? (x => x.familia_id || ('n:'+normaliza(x.nombre||x.familia_nombre||'')))
    : (x => x.ninera_id || ('n:'+normaliza(x.nombre||x.ninera_nombre||'')));
  const restos = new Map();
  ajustes.filter(a=>a.sujeto===sujeto).forEach(a=>{ const p = pendienteAjuste(a); if(p) restos.set(a.id, p); });
  grupos.forEach(g=>{ g.ajustes = []; g.totalNeto = g.total; });
  [...grupos].sort((a,b)=> a.bucket.localeCompare(b.bucket)).forEach(g=>{
    ajustes.filter(a=>a.sujeto===sujeto && restos.get(a.id)).forEach(a=>{
      const mismaPersona = clavePersona(a)===clavePersona(g) || (!!a[sujeto==='familia'?'familia_id':'ninera_id'] && a[sujeto==='familia'?'familia_id':'ninera_id']===g[sujeto==='familia'?'familia_id':'ninera_id']);
      if(!mismaPersona) return;
      const resto = restos.get(a.id);
      const usar = resto > 0 ? resto : -Math.min(-resto, g.totalNeto);
      if(!usar) return;
      g.ajustes.push({ id:a.id, monto:Math.round(usar*100)/100, motivo:a.motivo, fecha:a.fecha });
      g.totalNeto = Math.round((g.totalNeto + usar)*100)/100;
      const queda = Math.round((resto - usar)*100)/100;
      if(queda) restos.set(a.id, queda); else restos.delete(a.id);
    });
  });
  return ajustes.filter(a=>restos.get(a.id)).map(a=>({...a, restante: restos.get(a.id)}));
}
function lineasAjustesHtml(aj){
  return (aj||[]).map(a=>`<div class="helper fin-ajuste-linea" style="margin:2px 0 0;">Saldo: <b>${textoMontoAjuste(a.monto)}</b> · ${escaparHtml(a.motivo)}</div>`).join('');
}
// Después de marcar pagado/cobrado un grupo: deja anotado cuánto se usó de cada ajuste. Si
// falla, el pago ya quedó marcado: se avisa qué faltó.
async function registrarAplicacionAjustes(aplicados, ids, campo){
  if(!aplicados || !aplicados.length) return true;
  const { data: actuales, error } = await sb.from('ajustes_saldo').select('*').in('id', aplicados.map(a=>a.id));
  let fallo = error;
  if(!fallo){
    for(const ap of aplicados){
      const a = (actuales||[]).find(x=>x.id===ap.id);
      if(!a){ fallo = {message:'no se encontró el ajuste'}; break; }
      const nuevoAplicado = Math.min(Math.abs(Number(a.monto)), Math.round(((Number(a.aplicado)||0) + Math.abs(ap.monto))*100)/100);
      const aplicaciones = [...(a.aplicaciones||[]), {fecha: todayISO(), monto: ap.monto, en: campo, sittings: ids}];
      const { error: e2 } = await sb.from('ajustes_saldo').update({ aplicado: nuevoAplicado, aplicaciones }).eq('id', a.id);
      if(e2){ fallo = e2; break; }
    }
  }
  if(fallo){
    toast(`Se marcó ${campo}, pero no se pudo descontar el saldo a favor (${fallo.message}). Revisalo en la ficha antes del próximo ${campo==='pagado'?'pago':'cobro'}.`, 'bad');
    return false;
  }
  return true;
}

/* Saldo en la ficha de una familia o niñera: lo pendiente arriba, lo ya usado abajo, y
   "Cargar ajuste" para cargarlo a mano (monto, motivo y a favor de quién). */
async function pintarSaldoEnFicha(contId, sujeto, id, nombre){
  const cont = document.getElementById(contId);
  if(!cont) return;
  const ajustes = await cargarAjustesSaldo(sujeto==='familia' ? {familia_id:id} : {ninera_id:id});
  if(!ajustesSaldoDisponible){ cont.innerHTML = ''; return; }
  if(!document.getElementById(contId)) return; // se cerró la ficha mientras tanto
  const pendientes = ajustes.filter(a=>pendienteAjuste(a));
  const usados = ajustes.filter(a=>!pendienteAjuste(a));
  const totalPend = Math.round(pendientes.reduce((t,a)=>t+pendienteAjuste(a),0)*100)/100;
  const cuando = sujeto==='familia' ? 'cobro' : 'pago';
  const fmtF = iso => new Date(iso+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit',year:'2-digit'});
  const fila = a => `<div class="agendarow fin-ajuste-ficha" style="border-bottom:1px solid var(--line);">
      <div><div>${escaparHtml(a.motivo)}</div><div class="helper" style="margin:2px 0 0;">${fmtF(a.fecha)}${Number(a.aplicado) ? ` · usado ${textoMontoAjuste(Math.sign(a.monto)*Number(a.aplicado))}` : ''}</div></div>
      <div style="display:flex;align-items:center;gap:8px;"><b style="font-family:'IBM Plex Mono',monospace;">${textoMontoAjuste(a.monto)}</b>
      ${!Number(a.aplicado) ? `<button class="smallbtn danger" onclick="conGuardado(this, ()=>borrarAjusteSaldo(${argJs(a.id)}, ${argJs(contId)}, ${argJs(sujeto)}, ${argJs(id)}, ${argJs(nombre)}))">Borrar</button>` : ''}</div>
    </div>`;
  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;">
      <div class="card-section-title" style="margin:0;">Saldo</div>
      <button class="smallbtn" onclick="abrirModalAjusteSaldo(${argJs(contId)}, ${argJs(sujeto)}, ${argJs(id)}, ${argJs(nombre)})">+ Cargar ajuste</button>
    </div>
    ${pendientes.length
      ? `<div class="helper" id="${contId}-total" style="margin:4px 0;">Pendiente: <b>${textoMontoAjuste(totalPend)}</b> en el próximo ${cuando}.</div>${pendientes.map(fila).join('')}`
      : `<div class="helper" id="${contId}-total" style="margin:4px 0;">Sin saldo pendiente.</div>`}
    ${usados.length ? `<div class="helper" style="margin:10px 0 2px;">Ya usados</div>${usados.map(fila).join('')}` : ''}`;
}
// El formulario va en una capa encima de la ficha, para no perderla.
function abrirModalAjusteSaldo(contId, sujeto, id, nombre){
  const esFamilia = sujeto==='familia';
  const overlay = document.createElement('div');
  overlay.className = 'confirmoverlay';
  overlay.id = 'ajuste-overlay';
  overlay.innerHTML = `
    <div class="confirmbox wide" role="dialog" aria-label="Cargar ajuste de saldo">
      <h2 style="margin:0 0 4px;">Ajuste de saldo</h2>
      <div class="helper" style="margin:0 0 12px;">${escaparHtml(nombre)} · se aplica en su próximo ${esFamilia?'cobro':'pago'}.</div>
      <div class="grid2">
        <div class="field"><label>Monto</label><div class="moneyfield"><input type="number" id="ajuste-monto" min="0" step="0.01"></div></div>
        <div class="field"><label>A favor de</label><select id="ajuste-favor">
          ${esFamilia
            ? `<option value="-1">La familia (se descuenta del cobro)</option><option value="1">Parents Break (se suma al cobro)</option>`
            : `<option value="-1">Parents Break (se descuenta del pago)</option><option value="1">La niñera (se suma al pago)</option>`}
        </select></div>
      </div>
      <div class="field"><label>Motivo</label><input type="text" id="ajuste-motivo" placeholder="${esFamilia?'Pagó de más la semana del 28/09':'Se le pagó un sitting que hizo otra niñera'}"></div>
      <div id="ajuste-warn"></div>
      <div class="confirmbtns">
        <button class="btn ghost" id="ajuste-cancelar">Cancelar</button>
        <button class="btn primary" id="ajuste-guardar" onclick="conGuardado(this, ()=>guardarAjusteSaldo(${argJs(contId)}, ${argJs(sujeto)}, ${argJs(id)}, ${argJs(nombre)}))">Guardar ajuste</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('show'));
  overlay.querySelector('#ajuste-cancelar').addEventListener('click', cerrarModalAjusteSaldo);
}
function cerrarModalAjusteSaldo(){
  const o = document.getElementById('ajuste-overlay');
  if(!o) return;
  o.classList.remove('show');
  o.id = '';
  setTimeout(()=>o.remove(), 180);
}
async function guardarAjusteSaldo(contId, sujeto, id, nombre){
  const warn = document.getElementById('ajuste-warn');
  const monto = Number(document.getElementById('ajuste-monto').value);
  const signo = Number(document.getElementById('ajuste-favor').value);
  const motivo = document.getElementById('ajuste-motivo').value.trim();
  if(!(monto > 0)){ warn.innerHTML = '<div class="warnbox">Poné un monto mayor a cero.</div>'; return; }
  if(!motivo){ warn.innerHTML = '<div class="warnbox">Escribí el motivo: se ve en el pago y en el PDF.</div>'; return; }
  const fila = { sujeto, nombre, monto: signo*monto, motivo, creado_por: registradoPorUsuario() || null,
    familia_id: sujeto==='familia' ? id : null, ninera_id: sujeto==='ninera' ? id : null };
  const { error } = await sb.from('ajustes_saldo').insert(fila);
  if(error){ warn.innerHTML = errBox(error); return; }
  cerrarModalAjusteSaldo();
  toast('Ajuste guardado.');
  await pintarSaldoEnFicha(contId, sujeto, id, nombre);
}
async function borrarAjusteSaldo(ajusteId, contId, sujeto, id, nombre){
  if(!(await confirmarAccion('¿Borrar este ajuste? Todavía no se usó en ningún pago ni cobro.', 'Borrar'))) return;
  // Solo si sigue sin usar: si entre tanto se aplicó, no se borra.
  const { data, error } = await sb.from('ajustes_saldo').delete().eq('id', ajusteId).eq('aplicado', 0).select();
  if(error){ toast('No se pudo borrar: '+error.message, 'bad'); return; }
  if(!data || !data.length){ toast('No se borró: ese ajuste ya se usó en un pago o cobro.', 'bad'); }
  else toast('Ajuste borrado.');
  await pintarSaldoEnFicha(contId, sujeto, id, nombre);
}

// Pendientes de cobro y de pago agrupados como en Por cobrar / Por pagar (familia o niñera +
// período según su frecuencia). Lo usan esas dos listas y la conciliación con el extracto.
async function calcularPendientesAgrupados(){
  await esperarConfigFijos(); // fijos automáticos: saber si hay que sacar los previstos
  const [{data:pendCobrar}, {data:pendPagar}, {data:fams}, {data:nins}, {data:asigs}] = await Promise.all([
    sinPrevistos(sb.from('sittings_traslados').select('id,familia_id,familia_nombre,fecha,cobro_familia')).eq('cobrado', false).gt('cobro_familia', 0),
    // Por pagar solo muestra lo que ya pasó (05/10/2026, E7): un sitting cargado por
    // adelantado aparecía como para pagar y se le pagó a una niñera antes de que ocurriera.
    // Entra recién el día del sitting.
    sb.from('sittings_traslados').select('id,familia_id,familia_nombre,ninera_id,ninera_nombre,fecha,pago_ninera,asignacion_id').eq('pagado', false).gt('pago_ninera', 0).lte('fecha', todayISO()),
    sb.from('familias').select('id,nombre,frecuencia_cobro,cuenta_bancaria'),
    sb.from('ninieras').select('id,nombre,cuenta_bancaria'),
    sb.from('asignaciones').select('*, familias(nombre)'),
  ]);
  const famFrecPorId = {}; const famFrecPorNombre = {};
  (fams||[]).forEach(f=>{ famFrecPorId[f.id] = f.frecuencia_cobro || 'mensual'; famFrecPorNombre[normaliza(f.nombre)] = f.frecuencia_cobro || 'mensual'; });
  const ninInfoPorId = {}; const ninInfoPorNombre = {};
  (nins||[]).forEach(n=>{ ninInfoPorId[n.id] = n; ninInfoPorNombre[normaliza(n.nombre)] = n; });
  const esTrabajoFijo = construirEsTrabajoFijo(asigs);
  const trabajaFinde = construirTrabajaFinde(asigs);

  const gruposCobrar = {};
  (pendCobrar||[]).forEach(r=>{
    const frec = r.familia_id ? (famFrecPorId[r.familia_id]||'mensual') : (famFrecPorNombre[normaliza(r.familia_nombre)]||'mensual');
    const bucket = bucketKeyFecha(r.fecha, frec);
    const key = (r.familia_id||normaliza(r.familia_nombre))+'|'+bucket;
    if(!gruposCobrar[key]) gruposCobrar[key] = {nombre:r.familia_nombre, familia_id:r.familia_id||null, frec, bucket, total:0, ids:[]};
    gruposCobrar[key].total += Number(r.cobro_familia)||0;
    gruposCobrar[key].ids.push(r.id);
  });
  const gruposPagar = {};
  (pendPagar||[]).forEach(r=>{
    // La frecuencia depende del trabajo, no de la niñera: si es una relación fija con esa familia, se junta semanal; si es puntual, se paga aparte por día.
    const frec = esTrabajoFijo(r) ? 'semanal' : 'diario';
    const bucket = bucketKeyFecha(r.fecha, frec);
    const info = r.ninera_id ? ninInfoPorId[r.ninera_id] : ninInfoPorNombre[normaliza(r.ninera_nombre)];
    const key = (r.ninera_id||normaliza(r.ninera_nombre))+'|'+bucket;
    if(!gruposPagar[key]) gruposPagar[key] = {nombre:r.ninera_nombre, ninera_id:r.ninera_id||info?.id||null, frec, bucket, total:0, ids:[], finde:trabajaFinde(r.ninera_nombre), cuenta:(info?.cuenta_bancaria&&info.cuenta_bancaria.length)?info.cuenta_bancaria.join(' · '):''};
    gruposPagar[key].total += Number(r.pago_ninera)||0;
    gruposPagar[key].ids.push(r.id);
  });
  // Gastos extra que pagó la niñera (08/10/2026): se le cobran a la familia tal cual y se le
  // reintegran a la niñera, en el mismo grupo que el sitting (o en uno propio si ese sitting
  // ya estaba cobrado/pagado). No suman al facturado ni al margen.
  const { gastos, sits: sitsGastos } = await cargarGastosExtraPendientes();
  const hoyG = todayISO();
  gastos.forEach(gx=>{
    const r = sitsGastos.find(x=>x.id===gx.sitting_id);
    if(!r) return;
    const item = { id: gx.id, concepto: gx.concepto, monto: Number(gx.monto)||0 };
    // Lo que absorbe Parents Break no se le cobra a la familia (13/10/2026): solo se reintegra.
    if(!gx.cobrado && !gx.absorbe_pb){
      const frec = r.familia_id ? (famFrecPorId[r.familia_id]||'mensual') : (famFrecPorNombre[normaliza(r.familia_nombre)]||'mensual');
      const bucket = bucketKeyFecha(r.fecha, frec);
      const key = (r.familia_id||normaliza(r.familia_nombre))+'|'+bucket;
      if(!gruposCobrar[key]) gruposCobrar[key] = {nombre:r.familia_nombre, familia_id:r.familia_id||null, frec, bucket, total:0, ids:[]};
      (gruposCobrar[key].gastos ||= []).push(item);
      gruposCobrar[key].total += item.monto;
    }
    if(!gx.reintegrado && r.fecha <= hoyG){
      const frec = esTrabajoFijo(r) ? 'semanal' : 'diario';
      const bucket = bucketKeyFecha(r.fecha, frec);
      const info = r.ninera_id ? ninInfoPorId[r.ninera_id] : ninInfoPorNombre[normaliza(r.ninera_nombre)];
      const key = (r.ninera_id||normaliza(r.ninera_nombre))+'|'+bucket;
      if(!gruposPagar[key]) gruposPagar[key] = {nombre:r.ninera_nombre, ninera_id:r.ninera_id||info?.id||null, frec, bucket, total:0, ids:[], finde:trabajaFinde(r.ninera_nombre), cuenta:(info?.cuenta_bancaria&&info.cuenta_bancaria.length)?info.cuenta_bancaria.join(' · '):''};
      (gruposPagar[key].gastos ||= []).push(item);
      gruposPagar[key].total += item.monto;
    }
  });
  return { gruposCobrar:Object.values(gruposCobrar), gruposPagar:Object.values(gruposPagar), fams:fams||[], nins:nins||[] };
}
/* ---- Gastos extra (08/10/2026) ----
   Sin la tabla (base sin migrar) no hay gastos y todo sigue como antes. */
let gastosExtraDisponible = true;
// Suma de los gastos extra que absorbe Parents Break de esos registros. Sin la columna (base
// sin migrar) da 0.
async function sumarGastosAbsorbidos(ids){
  if(!gastosExtraDisponible || !ids.length) return 0;
  let total = 0;
  for(let i=0; i<ids.length; i+=100){
    const { data, error } = await sb.from('gastos_extra').select('monto').eq('absorbe_pb', true).in('sitting_id', ids.slice(i, i+100));
    if(error) return 0;
    total += (data||[]).reduce((t,g)=>t+(Number(g.monto)||0),0);
  }
  return total;
}
function esFaltaTabla(error){ return !!error && (error.code==='PGRST205' || error.code==='42P01'); }
async function cargarGastosExtraPendientes(){
  if(!gastosExtraDisponible) return { gastos:[], sits:[] };
  const { data, error } = await sb.from('gastos_extra').select('*').eq('pagado_por', 'ninera').or('cobrado.eq.false,reintegrado.eq.false');
  if(error){
    if(esFaltaTabla(error)) gastosExtraDisponible = false;
    else toast('No se pudieron leer los gastos extra: '+error.message, 'bad');
    return { gastos:[], sits:[] };
  }
  if(!data || !data.length) return { gastos:[], sits:[] };
  const { data: sits } = await sb.from('sittings_traslados').select('id,fecha,familia_id,familia_nombre,ninera_id,ninera_nombre,asignacion_id')
    .in('id', [...new Set(data.map(g=>g.sitting_id))]);
  return { gastos: data, sits: sits||[] };
}
function lineasGastosHtml(gastos, prefijo){
  return (gastos||[]).map(g=>`<div class="helper fin-gasto-linea" style="margin:2px 0 0;">${prefijo}: <b>$${Number(g.monto).toLocaleString('es-UY')}</b> · ${escaparHtml(g.concepto)}</div>`).join('');
}
// "Servicios $X + gastos $Y = $Z" cuando el total incluye gastos (13/10/2026), o
// "Servicios: $X" cuando solo hay saldo.
function lineaServiciosHtml(g){
  if(!g.ajustes?.length && !g.gastos?.length) return '';
  const gastos = (g.gastos||[]).reduce((t,x)=>t+x.monto,0);
  const conGastos = textoTotalConGastos('Servicios', g.total - gastos, gastos);
  return `<div class="helper fin-total-gastos" style="margin:2px 0 0;">${conGastos ? escaparHtml(conGastos) : `Servicios: $${(g.total - gastos).toLocaleString('es-UY')}`}</div>`;
}
async function cargarPorCobrarPorPagar(){
  const { gruposCobrar, gruposPagar } = await calcularPendientesAgrupados();
  const listaCobrar = gruposCobrar
    // Igual criterio que en Por pagar: un cobro semanal recién se muestra cuando esa
    // semana ya terminó, para no mostrar un total que todavía le faltan días por sumar.
    .filter(g => g.frec!=='semanal' || finDeSemanaDesde(g.bucket) < todayISO())
    .sort((a,b)=> b.bucket.localeCompare(a.bucket) || a.nombre.localeCompare(b.nombre));
  const listaPagar = gruposPagar
    // Un fijo se agrupa por semana completa -- si esa semana todavía no terminó, mostrar
    // el total ahora sería mostrar un pago a mitad de armar (le falta lo que falta cobrar
    // esos días). Se muestra recién cuando termina la semana: sábado pasado para la mayoría
    // de los fijos, domingo pasado para los que tienen algún horario fijo el fin de semana.
    .filter(g => g.frec!=='semanal' || finDeSemanaDesde(g.bucket, g.finde) < todayISO())
    .sort((a,b)=> b.bucket.localeCompare(a.bucket) || a.nombre.localeCompare(b.nombre));

  const ajustes = await cargarAjustesSaldo();
  const sueltosCobrar = aplicarAjustesAGrupos(listaCobrar, ajustes, 'familia');
  const sueltosPagar = aplicarAjustesAGrupos(listaPagar, ajustes, 'ninera');
  renderPorCobrar(listaCobrar, sueltosCobrar);
  renderPorPagar(listaPagar, sueltosPagar);
}
// Saldos de alguien que hoy no tiene nada pendiente: se aplican en su próximo cobro/pago.
function saldosSueltosHtml(sueltos, cuando){
  if(!sueltos || !sueltos.length) return '';
  return `<div class="fin-saldos-sueltos" style="margin-top:10px;">
    <div class="helper" style="margin:0 0 4px;">Saldos que se aplican en el próximo ${cuando}:</div>
    ${sueltos.map(a=>`<div class="helper" style="margin:2px 0 0;"><b>${escaparHtml(a.nombre)}</b>: ${textoMontoAjuste(a.restante)} · ${escaparHtml(a.motivo)}</div>`).join('')}
  </div>`;
}
function renderPorCobrar(lista, sueltos=[]){
  const box = document.getElementById('fin-porcobrar-wrap');
  if(!box) return;
  if(!lista.length){ box.innerHTML = `<h2>Por cobrar</h2><div class="empty">No hay cobros pendientes.</div>${saldosSueltosHtml(sueltos, 'cobro')}`; return; }
  const total = lista.reduce((s,g)=>s+(g.totalNeto ?? g.total),0);
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
      <h2 style="margin:0;">Por cobrar</h2>
      <div class="helper" style="margin:0;">${lista.length} pendiente${lista.length===1?'':'s'} · $${total.toLocaleString('es-UY')}</div>
    </div>
    ${lista.map(g=>`
      <div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>
          <div style="font-weight:600;">${escaparHtml(g.nombre)}</div>
          <div class="helper" style="margin:2px 0 0;">${bucketLabelFecha(g.bucket, g.frec)} · ${escaparHtml(g.frec)}</div>
          ${lineaServiciosHtml(g)}${lineasGastosHtml(g.gastos, 'Gasto extra')}${lineasAjustesHtml(g.ajustes)}
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--good);">$${(g.totalNeto ?? g.total).toLocaleString('es-UY')}</span>
          <button class="smallbtn" onclick="conGuardado(this, ()=>marcarGrupoResuelto(${argJs(g.ids)}, 'cobrado', ${argJs(g.ajustes||[])}, ${argJs((g.gastos||[]).map(x=>x.id))}))">Marcar cobrado</button>
        </div>
      </div>`).join('')}
    ${saldosSueltosHtml(sueltos, 'cobro')}
  `;
}
function renderPorPagar(lista, sueltos=[]){
  const box = document.getElementById('fin-porpagar-wrap');
  if(!box) return;
  if(!lista.length){ box.innerHTML = `<h2>Por pagar</h2><div class="empty">No hay pagos pendientes.</div>${saldosSueltosHtml(sueltos, 'pago')}`; return; }
  const total = lista.reduce((s,g)=>s+(g.totalNeto ?? g.total),0);
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
      <h2 style="margin:0;">Por pagar</h2>
      <div class="helper" style="margin:0;">${lista.length} pendiente${lista.length===1?'':'s'} · $${total.toLocaleString('es-UY')}</div>
    </div>
    ${lista.map(g=>`
      <div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>
          <div style="font-weight:600;">${escaparHtml(g.nombre)}</div>
          <div class="helper" style="margin:2px 0 0;">${bucketLabelFecha(g.bucket, g.frec, g.finde)} · ${escaparHtml(g.frec)}</div>
          ${g.cuenta ? `<div class="helper" style="margin:2px 0 0;font-family:'IBM Plex Mono',monospace;">${escaparHtml(g.cuenta)}</div>` : ''}
          ${lineaServiciosHtml(g)}${lineasGastosHtml(g.gastos, 'Reintegro de gasto')}${lineasAjustesHtml(g.ajustes)}
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--clay-text);">$${(g.totalNeto ?? g.total).toLocaleString('es-UY')}</span>
          <button class="smallbtn" onclick="conGuardado(this, ()=>marcarGrupoResuelto(${argJs(g.ids)}, 'pagado', ${argJs(g.ajustes||[])}, ${argJs(g.gastos||[])}))">Marcar pagado</button>
        </div>
      </div>`).join('')}
    ${saldosSueltosHtml(sueltos, 'pago')}
  `;
}
// gastos: ids (cobro) o {id, concepto, monto} (pago, para mostrarlos en la confirmación).
async function marcarGrupoResuelto(ids, campo, ajustes=[], gastos=[]){
  const gastosIds = (gastos||[]).map(g=>typeof g==='string' ? g : g.id);
  if(campo==='pagado' && !(await confirmarPagoSittings(ids, {}, ajustes, gastos.filter(g=>typeof g!=='string')))) return;
  // Las dos marcando lo mismo a la vez (06/10/2026, testing de la noche): se marca solo lo
  // que seguía sin marcar. Si la otra ya lo había marcado, no se descuenta el saldo a favor
  // por segunda vez (se perdía lo que sobraba) y se avisa en vez de decir "Marcado".
  let nuevos = 0;
  if(ids.length){
    const { data, error } = await sb.from('sittings_traslados').update({[campo]:true}).in('id', ids).eq(campo, false).select('id');
    if(error){ toast('No se pudo actualizar: '+error.message, 'bad'); return; }
    nuevos += (data||[]).length;
  }
  let okGastos = true;
  if(gastosIds.length){
    const col = campo==='cobrado' ? 'cobrado' : 'reintegrado';
    const { data: dg, error: eg } = await sb.from('gastos_extra').update({[col]:true}).in('id', gastosIds).eq(col, false).select('id');
    if(eg){ okGastos = false; toast(`Se marcó ${campo}, pero no se pudieron marcar los gastos extra (${eg.message}). Van a seguir apareciendo: avisale a Diego.`, 'bad'); }
    else nuevos += (dg||[]).length;
  }
  if(!nuevos && okGastos){
    toast(`Ya estaba marcado como ${campo}: lo marcó alguien más hace un momento. No se cambió nada.`, 'bad');
    refrescarFinanzasCompleto();
    return;
  }
  const okSaldo = await registrarAplicacionAjustes(ajustes, ids, campo);
  if(okSaldo && okGastos) toast(campo==='cobrado' ? 'Marcado como cobrado.' : 'Marcado como pagado.');
  refrescarFinanzasCompleto();
}
/* Confirmación antes de marcar pagado (05/10/2026, E3). Un "Marcar pagado" apurado no se
   puede ver después qué incluía: se muestra cada sitting (niñera, familia, fecha, horario y
   monto) y el total, con Cancelar / Confirmar. Sirve para un sitting solo o para un grupo de
   Por pagar. montosNuevos pisa el monto guardado cuando se está editando ese movimiento.
   Devuelve true solo si se confirma. */
async function confirmarPagoSittings(ids, montosNuevos={}, ajustes=[], gastos=[]){
  let data = [];
  if(ids.length){
    const res = await sb.from('sittings_traslados')
      .select('id,tipo,familia_nombre,ninera_nombre,fecha,hora_inicio,hora_fin,termina_dia_siguiente,pago_ninera')
      .in('id', ids);
    if(res.error){ toast('No se pudo leer el detalle del pago: '+res.error.message, 'bad'); return false; }
    data = res.data||[];
  }
  const filas = data.map(r=>({...r, monto: r.id in montosNuevos ? Number(montosNuevos[r.id])||0 : Number(r.pago_ninera)||0}))
    .sort((a,b)=> (a.fecha||'').localeCompare(b.fecha||'') || (a.hora_inicio||'').localeCompare(b.hora_inicio||''));
  if(!filas.length && !(gastos||[]).length){ toast('Esos registros ya no existen. Actualizá la pantalla.', 'bad'); return false; }
  const subtotal = filas.reduce((s,r)=>s+r.monto, 0) + (gastos||[]).reduce((s,g)=>s+(Number(g.monto)||0), 0);
  const total = Math.round((subtotal + (ajustes||[]).reduce((s,a)=>s+(Number(a.monto)||0), 0))*100)/100;
  const hoy = todayISO();
  const futuros = filas.filter(r=>r.fecha > hoy).length;
  const ninieras = [...new Set(filas.map(r=>r.ninera_nombre||'(sin niñera)'))];
  const fmtF = iso => iso ? new Date(iso+'T12:00:00').toLocaleDateString('es-UY',{weekday:'short',day:'2-digit',month:'2-digit'}) : '—';
  const horario = r => r.hora_inicio ? `${r.hora_inicio.slice(0,5)}${r.hora_fin?'–'+r.hora_fin.slice(0,5):''}${r.termina_dia_siguiente?' (+1 día)':''}` : 'sin horario';
  const plata = n => '$'+Number(n).toLocaleString('es-UY', {maximumFractionDigits:2}); // sin redondear: hay pagos con centavos
  return new Promise(resolve=>{
    const overlay = document.createElement('div');
    overlay.className = 'confirmoverlay';
    overlay.innerHTML = `
      <div class="confirmbox wide" role="dialog" aria-label="Confirmar pago">
        <h2 style="margin:0 0 4px;">Confirmar pago${ninieras.length===1 ? ' a '+escaparHtml(ninieras[0]) : ''}</h2>
        <div class="helper" style="margin:0 0 12px;">Revisá que esté todo antes de marcarlo como pagado.</div>
        ${futuros ? `<div class="warnbox" style="margin-bottom:10px;">Ojo: ${futuros===1?'uno de estos sittings todavía no ocurrió':futuros+' de estos sittings todavía no ocurrieron'}.</div>` : ''}
        <div id="pago-detalle">
          ${filas.map(r=>`<div class="pago-fila"${r.fecha>hoy?' style="color:var(--clay-text);"':''}>
            <div style="min-width:0;">
              <div style="font-weight:600;">${escaparHtml(r.familia_nombre||'—')}${r.tipo==='traslado'?' <span class="helper" style="margin:0;">(traslado)</span>':''}</div>
              <div class="helper" style="margin:2px 0 0;">${escaparHtml(r.ninera_nombre||'—')} · ${fmtF(r.fecha)} · ${horario(r)}</div>
            </div>
            <div class="pago-monto">${plata(r.monto)}</div>
          </div>`).join('')}
          ${(gastos||[]).map(g=>`<div class="pago-fila pago-gasto">
            <div style="min-width:0;"><div style="font-weight:600;">Reintegro de gasto extra</div><div class="helper" style="margin:2px 0 0;">${escaparHtml(g.concepto)}</div></div>
            <div class="pago-monto">${plata(g.monto)}</div>
          </div>`).join('')}
          ${(ajustes||[]).map(a=>`<div class="pago-fila pago-ajuste">
            <div style="min-width:0;"><div style="font-weight:600;">Saldo a favor</div><div class="helper" style="margin:2px 0 0;">${escaparHtml(a.motivo)}</div></div>
            <div class="pago-monto">${textoMontoAjuste(a.monto)}</div>
          </div>`).join('')}
          <div class="pago-fila pago-total-fila">
            <div style="font-weight:700;">Total (${filas.length} ${filas.length===1?'registro':'registros'}${(gastos||[]).length?' y gastos':''}${(ajustes||[]).length?' y saldo':''})</div>
            <div class="pago-monto" id="pago-total" style="font-weight:700;">${plata(total)}</div>
          </div>
        </div>
        <div class="confirmbtns">
          <button class="btn ghost" id="pago-cancelar">Cancelar</button>
          <button class="btn primary" id="pago-confirmar">Confirmar pago</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('show'));
    function cerrar(ok){
      overlay.classList.remove('show');
      setTimeout(()=>overlay.remove(), 180);
      resolve(ok);
    }
    overlay.addEventListener('click', e=>{ if(e.target===overlay) cerrar(false); });
    overlay.querySelector('#pago-cancelar').addEventListener('click', ()=>cerrar(false));
    overlay.querySelector('#pago-confirmar').addEventListener('click', ()=>cerrar(true));
  });
}
/* Todo lo que depende de cobrado/pagado se recarga junto -- si no, el balance queda
   desfasado de Por cobrar / Por pagar hasta salir y volver a entrar a Finanzas. */
function refrescarFinanzasCompleto(){
  if(!document.getElementById('fin-movs')) return;
  cargarFinanzas();
  cargarBalanceMultiMes(finBalanceMeses);
  cargarPorCobrarPorPagar();
  actualizarFinanzasBadge();
}

/* ---- Corregir un movimiento que viene de Sittings & traslados ----
   Montos y estado (cobrado / pagado) se corrigen acá mismo, sin salir de Finanzas.
   Destildar cobrado/pagado sirve para deshacer un "Marcar cobrado" hecho por error:
   el movimiento vuelve a Por cobrar / Por pagar y sale del balance. Para cambiar
   horario, familia o niñera se abre el formulario completo de Sittings. */
function editarMovimientoSitting(id){
  const r = finSitsTodosDelMes.find(x=>x.id===id);
  if(!r) return;
  const fechaTxt = new Date(r.fecha+'T00:00:00').toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'});
  abrirModal(`
    <h2 style="margin:0 0 4px;padding-right:32px;">${escaparHtml(r.familia_nombre||'(familia)')}</h2>
    <div class="helper" style="margin-bottom:16px;">${r.tipo==='traslado'?'Traslado':'Sitting'} del ${fechaTxt} con ${escaparHtml(r.ninera_nombre||'(niñera)')}</div>
    <div class="grid2">
      <div class="field"><label>Cobro a la familia</label><input type="number" id="fin-mov-cobro" value="${Number(r.cobro_familia)||0}"></div>
      <div class="field"><label>Pago a la niñera</label><input type="number" id="fin-mov-pago" value="${Number(r.pago_ninera)||0}"></div>
      <label class="chk"><input type="checkbox" id="fin-mov-cobrado" ${r.cobrado?'checked':''}> Ya se cobró</label>
      <label class="chk"><input type="checkbox" id="fin-mov-pagado" ${r.pagado?'checked':''}> Ya se le pagó</label>
    </div>
    <div class="helper" style="margin-top:10px;">Marcar cobrado o pagado no cambia el resultado del mes: solo indica si la plata ya entró o ya salió.</div>
    <div id="fin-mov-warn"></div>
    <button class="btn ghost" style="width:100%;margin-top:6px;" onclick="editarRegistroDesdeAgenda(${argJs(r.id)})">Cambiar horario, familia o niñera</button>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarMovimientoSitting(${argJs(r.id)}))">Guardar</button>
    </div>`);
}
async function guardarMovimientoSitting(id){
  const cobroTxt = document.getElementById('fin-mov-cobro').value;
  const pagoTxt = document.getElementById('fin-mov-pago').value;
  const warn = document.getElementById('fin-mov-warn');
  const cobro = Number(cobroTxt), pago = Number(pagoTxt);
  if(cobroTxt==='' || pagoTxt==='' || !isFinite(cobro) || !isFinite(pago) || cobro<0 || pago<0){
    if(warn) warn.innerHTML = '<div class="warnbox">Los montos tienen que ser números (0 o más).</div>';
    return;
  }
  const cambios = {
    cobro_familia: cobro,
    pago_ninera: pago,
    cobrado: document.getElementById('fin-mov-cobrado').checked,
    pagado: document.getElementById('fin-mov-pagado').checked,
  };
  const antes = finSitsTodosDelMes.find(x=>x.id===id);
  if(cambios.pagado && !antes?.pagado && !(await confirmarPagoSittings([id], {[id]: pago}))) return;
  const { error } = await sb.from('sittings_traslados').update(cambios).eq('id', id);
  if(error){ if(warn) warn.innerHTML = errBox(error); return; }
  cerrarModal();
  toast('Movimiento actualizado.');
  refrescarFinanzasCompleto();
}

/* ---- Conciliación de cobros y pagos contra el extracto ----
   Dos partes separadas (05/10/2026), porque Parents Break va a dejar Itaú y pasar a Mercado Pago:
   1) LEER: un lector por formato (LECTORES_EXTRACTO) convierte la planilla del banco en una lista
      de movimientos iguales para todos: { fecha:'AAAA-MM-DD', concepto, cuenta, credito, debito }.
   2) CONCILIAR: proponer coincidencias, casillas y confirmar (más abajo) solo usan esos
      movimientos y no saben de qué banco vienen.
   Sumar Mercado Pago = agregar un lector a LECTORES_EXTRACTO con su reconoce() y su leer(). */
function soloDigitos(s){ return String(s||'').replace(/\D/g,''); }
function extraerCuentaDeTexto(texto){
  const matches = String(texto||'').match(/\d{5,12}/g) || [];
  return matches.sort((a,b)=>b.length-a.length)[0] || '';
}
function parseMontoExtracto(v){
  if(v===null || v===undefined || v==='') return 0;
  if(typeof v === 'number') return v;
  let s = String(v).trim().replace(/[^\d,.\-]/g,'');
  // Formato uruguayo: punto de miles, coma decimal. Si hay ambos, la coma es la decimal.
  if(s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',', '.');
  else if(s.includes(',')) s = s.replace(',', '.');
  return Number(s) || 0;
}
function parseFechaExtracto(v){
  if(!v) return '';
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); // dd/mm/yyyy
  if(m){ let [,d,mo,y] = m; if(y.length===2) y = '20'+y; return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`; }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // ya viene ISO
  if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return '';
}
// Filas crudas de la primera hoja (xls, xlsx o csv), sin interpretar: eso es cosa de cada lector.
async function leerFilasExtracto(file){
  const buf = await file.arrayBuffer();
  let wb;
  if(/\.csv$/i.test(file.name)){
    wb = XLSX.read(new TextDecoder('utf-8').decode(buf), {type:'string'});
  } else {
    wb = XLSX.read(buf, {type:'array'});
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, {header:1, raw:false, defval:''});
}
const LECTORES_EXTRACTO = [
  {
    // Itaú: busca en las primeras filas el encabezado con Fecha y Crédito (y Débito y Concepto
    // si están); la cuenta de quien transfiere viene dentro del concepto.
    id: 'itau', nombre: 'Itaú',
    reconoce(filas){
      for(let i=0;i<Math.min(filas.length,10);i++){
        const fila = (filas[i]||[]).map(c=>normaliza(String(c||'')));
        const iFecha = fila.findIndex(c=>c.includes('fecha'));
        const iCredito = fila.findIndex(c=>c.includes('credito') || c.includes('haber'));
        const iDebito = fila.findIndex(c=>c.includes('debito') || c==='debe');
        const iConcepto = fila.findIndex(c=>c.includes('concepto') || c.includes('descripcion') || c.includes('referencia') || c.includes('detalle'));
        if(iFecha>-1 && iCredito>-1) return { header:i, iFecha, iCredito, iDebito, iConcepto: iConcepto>-1?iConcepto:iFecha+1 };
      }
      return null;
    },
    leer(filas, cols){
      const movs = [];
      for(let i=cols.header+1;i<filas.length;i++){
        const f = filas[i];
        if(!f || !f.length) continue;
        const fecha = parseFechaExtracto(f[cols.iFecha]);
        if(!fecha) continue; // saldos, totales y filas en blanco
        const concepto = String(f[cols.iConcepto]||'');
        movs.push({ fecha, concepto, cuenta: extraerCuentaDeTexto(concepto),
          credito: parseMontoExtracto(f[cols.iCredito]),
          debito: cols.iDebito>-1 ? Math.abs(parseMontoExtracto(f[cols.iDebito])) : 0 });
      }
      return movs;
    },
  },
];
// Prueba los lectores en orden y usa el primero que reconoce el archivo. null si ninguno.
function leerMovimientosExtracto(filas){
  for(const lector of LECTORES_EXTRACTO){
    const ctx = lector.reconoce(filas);
    if(ctx) return { lector, movimientos: lector.leer(filas, ctx) };
  }
  return null;
}
/* Conciliación con marcar cobrado / pagado (05/10/2026). El extracto ya no marca nada solo
   ni con un botón directo: cada coincidencia trae una casilla, las seguras vienen tildadas y
   las dudosas destildadas y con el motivo a la vista. Recién al confirmar (con el detalle y el
   total) se marca. Seguras: la cuenta del extracto es de una sola familia (o niñera) y el
   monto coincide con lo pendiente. Dudosas: monto distinto, el mismo monto en varios
   períodos o varias familias, cuenta cargada en más de una ficha, o sin cuenta en el
   concepto (CAMBIOS, VARIOS...) donde solo coincide el monto. Pagos a niñeras: igual, con
   los débitos del extracto y la cuenta de cada niñera, y se confirman con el mismo detalle
   de "Marcar pagado" (E3). */
let concPropuestas = { cobro:[], pago:[] };
function mapaPorCuenta(fichas){
  const mapa = {};
  (fichas||[]).forEach(f=>{
    const cuentas = Array.isArray(f.cuenta_bancaria) ? f.cuenta_bancaria : (f.cuenta_bancaria ? [f.cuenta_bancaria] : []);
    cuentas.forEach(cta=>{
      // La cuenta se guarda como texto libre ("Itaú 0012345 (Sucursal 3)"): se usa el número largo.
      const d = extraerCuentaDeTexto(cta) || soloDigitos(cta);
      if(!d) return;
      [d, d.replace(/^0+/,'')].forEach(k=>{ if(!k) return; (mapa[k] = mapa[k] || new Map()).set(f.id, f); });
    });
  });
  return cuenta => {
    if(!cuenta) return [];
    const out = new Map();
    [cuenta, cuenta.replace(/^0+/,'')].forEach(k=>{ (mapa[k]||new Map()).forEach((f,id)=>out.set(id,f)); });
    return [...out.values()];
  };
}
// Propuestas para un conjunto de movimientos del extracto ya agrupados (por ficha y período).
function proponerCoincidencias(movsAgrupados, gruposPend, claveFicha){
  const props = [];
  const sinCoincidencia = [];
  const casi = (a,b)=>Math.abs(a-b) < 1;
  const anteriores = (fecha, g)=> g.bucket.slice(0,10) <= fecha; // el período empezó antes del movimiento
  movsAgrupados.forEach(m=>{
    const detalleExtracto = m.movs.map(x=>`${fmtFechaCortaFin(x.fecha)} ${x.concepto||'(sin concepto)'}`).join(' · ');
    if(m.fichas.length===1){
      const fichaId = m.fichas[0].id;
      const delaFicha = gruposPend.filter(g=>g[claveFicha]===fichaId && anteriores(m.fecha, g));
      const exactos = delaFicha.filter(g=>casi(g.total, m.total));
      const suma = delaFicha.reduce((t,g)=>t+g.total, 0);
      if(exactos.length===1){
        props.push({ grupos:exactos, extracto:m.total, detalleExtracto, tildada:true, motivo:null });
      } else if(exactos.length>1){
        exactos.forEach(g=>props.push({ grupos:[g], extracto:m.total, detalleExtracto, tildada:false, motivo:`El mismo monto coincide con ${exactos.length} períodos: elegí cuál` }));
      } else if(delaFicha.length>1 && casi(suma, m.total)){
        props.push({ grupos:delaFicha, extracto:m.total, detalleExtracto, tildada:true, motivo:null, nota:'Pagó varios períodos juntos' });
      } else if(delaFicha.length){
        const ultimo = delaFicha.slice().sort((a,b)=>b.bucket.localeCompare(a.bucket))[0];
        props.push({ grupos:[ultimo], extracto:m.total, detalleExtracto, tildada:false, motivo:`Monto distinto: el extracto dice ${plataFin(m.total)} y lo pendiente es ${plataFin(ultimo.total)}` });
      } else {
        sinCoincidencia.push({ ...m, motivo:`${m.fichas[0].nombre} no tiene nada pendiente de antes de esa fecha` });
      }
      return;
    }
    // Sin ficha identificada (o la cuenta está en varias fichas): solo puede coincidir el monto.
    const candidatos = gruposPend.filter(g=>casi(g.total, m.total) && anteriores(m.fecha, g) && (!m.fichas.length || m.fichas.some(f=>f.id===g[claveFicha])));
    if(!candidatos.length){ sinCoincidencia.push({ ...m, motivo: m.cuenta ? 'La cuenta no está cargada en ninguna ficha' : 'Sin cuenta en el concepto y ningún pendiente con ese monto' }); return; }
    const motivo = m.fichas.length>1 ? `La cuenta está cargada en ${m.fichas.length} fichas: elegí cuál`
      : candidatos.length>1 ? `Sin cuenta en el extracto y el mismo monto coincide con ${candidatos.length} pendientes: elegí cuál`
      : 'Sin cuenta en el extracto (ej. CAMBIOS): coincide solo el monto';
    candidatos.forEach(g=>props.push({ grupos:[g], extracto:m.total, detalleExtracto, tildada:false, motivo }));
  });
  return { props, sinCoincidencia };
}
function plataFin(n){ return '$'+Number(n||0).toLocaleString('es-UY', {maximumFractionDigits:2}); }
async function procesarExtractoConciliacion(){
  const input = document.getElementById('fin-conciliar-file');
  const box = document.getElementById('fin-conciliar-resultado');
  const file = input.files[0];
  if(!file){ toast('Elegí un archivo primero.', 'bad'); return; }
  box.innerHTML = '<div class="empty"><span class="spinner dark"></span> Leyendo el extracto…</div>';
  let filas;
  try{ await asegurarXLSX(); filas = await leerFilasExtracto(file); }
  catch(e){ box.innerHTML = `<div class="empty">No se pudo leer el archivo: ${escaparHtml(e.message)}</div>`; return; }
  const leido = leerMovimientosExtracto(filas);
  if(!leido){ box.innerHTML = `<div class="empty">No reconocí el formato del archivo. Formatos que entiendo: ${escaparHtml(LECTORES_EXTRACTO.map(l=>l.nombre).join(', '))}. Subilo tal cual lo exporta el banco.</div>`; return; }
  const creditos = leido.movimientos.filter(m=>m.credito).map(m=>({ fecha:m.fecha, concepto:m.concepto, cuenta:m.cuenta, monto:m.credito }));
  const debitos = leido.movimientos.filter(m=>m.debito).map(m=>({ fecha:m.fecha, concepto:m.concepto, cuenta:m.cuenta, monto:m.debito }));
  if(!creditos.length && !debitos.length){ box.innerHTML = '<div class="empty">No encontré movimientos en el archivo.</div>'; return; }

  const { gruposCobrar, gruposPagar, fams, nins } = await calcularPendientesAgrupados();
  const famsDeCuenta = mapaPorCuenta(fams);
  const ninsDeCuenta = mapaPorCuenta(nins);
  const famFrec = {}; fams.forEach(f=>{ famFrec[f.id] = f.frecuencia_cobro || 'mensual'; });

  // Créditos: los de una misma familia en el mismo período se suman (pagó en dos transferencias).
  const agrupar = (movs, fichasDe, periodo) => {
    const g = {};
    let sueltos = 0; // sin ficha identificada: cada movimiento va solo
    movs.forEach(c=>{
      const fichas = fichasDe(c.cuenta);
      const clave = fichas.length===1 ? fichas[0].id+'|'+periodo(fichas[0], c.fecha) : 'suelto|'+(sueltos++);
      if(!g[clave]) g[clave] = { fichas, cuenta:c.cuenta, fecha:c.fecha, total:0, movs:[] };
      g[clave].total += c.monto; g[clave].movs.push(c);
      if(c.fecha > g[clave].fecha) g[clave].fecha = c.fecha;
    });
    return Object.values(g);
  };
  const credAgr = agrupar(creditos, famsDeCuenta, (f, fecha)=>bucketKeyFecha(fecha, famFrec[f.id]||'mensual'));
  // Débitos sin cuenta de una niñera son gastos cualquiera: no se proponen ni se listan.
  const debIdentificados = debitos.filter(d=>ninsDeCuenta(d.cuenta).length);
  const debAgr = agrupar(debIdentificados, ninsDeCuenta, (n, fecha)=>fecha);

  const cobros = proponerCoincidencias(credAgr, gruposCobrar.filter(g=>g.familia_id), 'familia_id');
  const pagos = proponerCoincidencias(debAgr, gruposPagar.filter(g=>g.ninera_id), 'ninera_id');
  const conCodigo = (lista, tipo) => lista.map((p,i)=>({ ...p, i, tipo,
    ids: [...new Set(p.grupos.flatMap(g=>g.ids))],
    gastos: p.grupos.flatMap(g=>g.gastos||[]),
    pendiente: p.grupos.reduce((t,g)=>t+g.total,0),
    nombre: p.grupos[0].nombre,
    periodo: p.grupos.map(g=>bucketLabelFecha(g.bucket, g.frec, g.finde)).join(' + '),
    hecha:false }));
  concPropuestas = { cobro: conCodigo(cobros.props, 'cobro'), pago: conCodigo(pagos.props, 'pago') };

  await sbGuardar(sb.from('app_config').upsert({ id:'ultima_conciliacion_cobros', valor:{archivo:file.name}, actualizado_at:new Date().toISOString() }), 'la marca de conciliación');
  actualizarFinanzasBadge();
  cargarAvisoExtracto();

  const seguras = l => l.filter(p=>!p.motivo).length;
  const nSeguras = seguras(concPropuestas.cobro)+seguras(concPropuestas.pago);
  const nDudosas = concPropuestas.cobro.length+concPropuestas.pago.length-nSeguras;
  const plural = (n, uno, varios) => `${n} ${n===1?uno:varios}`;
  const sinCoincidencia = [...cobros.sinCoincidencia.map(x=>({...x, tipo:'Crédito'})), ...pagos.sinCoincidencia.map(x=>({...x, tipo:'Débito'}))];
  box.innerHTML = `
    <div class="helper" style="margin-bottom:10px;">${plural(creditos.length, 'crédito leído', 'créditos leídos')} del extracto${debIdentificados.length ? ` y ${plural(debIdentificados.length, 'pago a niñeras', 'pagos a niñeras')}` : ''} · ${plural(nSeguras, 'coincidencia segura (tildada)', 'coincidencias seguras (tildadas)')} · ${plural(nDudosas, 'dudosa (sin tildar, revisala)', 'dudosas (sin tildar, revisalas)')} · ${sinCoincidencia.length} sin coincidencia. Nada se marca hasta que confirmes.</div>
    ${seccionConciliacion('cobro', 'Cobros de familias', 'Marcar cobrado lo tildado')}
    ${seccionConciliacion('pago', 'Pagos a niñeras', 'Marcar pagado lo tildado')}
    ${sinCoincidencia.length ? `
      <h3 style="margin:14px 0 4px;">Sin coincidencia — revisar a mano</h3>
      ${sinCoincidencia.map(c=>`<div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>${escaparHtml(c.tipo)} · ${c.movs.map(x=>`${fmtFechaCortaFin(x.fecha)} · ${escaparHtml(x.concepto||'(sin concepto)')}`).join('<br>')}<div class="helper" style="margin:2px 0 0;">${escaparHtml(c.motivo)}</div></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${plataFin(c.total)}</span>
      </div>`).join('')}` : ''}
    ${(!concPropuestas.cobro.length && !concPropuestas.pago.length && !sinCoincidencia.length) ? '<div class="empty">No hay nada para conciliar en este extracto.</div>' : ''}
  `;
  actualizarTotalesConciliacion();
}
function seccionConciliacion(tipo, titulo, textoBoton){
  const lista = concPropuestas[tipo];
  if(!lista.length) return '';
  return `<div class="conc-seccion" data-conc-seccion="${tipo}">
    <h3 style="margin:14px 0 4px;">${titulo}</h3>
    ${lista.map(p=>`
      <label class="conc-fila${p.motivo?' conc-dudosa':''}" data-conc-fila="${tipo}-${p.i}">
        <input type="checkbox" data-conc="${tipo}" data-i="${p.i}" ${p.tildada?'checked':''} onchange="actualizarTotalesConciliacion()">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;">${escaparHtml(p.nombre)}${p.nota?` <span class="helper" style="margin:0;">· ${escaparHtml(p.nota)}</span>`:''}</div>
          <div class="helper" style="margin:2px 0 0;">${escaparHtml(p.periodo)} · en el extracto: ${escaparHtml(p.detalleExtracto)}</div>
          ${p.motivo ? `<div class="conc-motivo">${escaparHtml(p.motivo)}</div>` : ''}
        </div>
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;white-space:nowrap;">${plataFin(p.pendiente)}</span>
      </label>`).join('')}
    <div style="display:flex;justify-content:flex-end;margin-top:8px;">
      <button class="btn primary" id="conc-btn-${tipo}" onclick="conGuardado(this, ()=>confirmarConciliacion(${argJs(tipo)}))">${textoBoton}</button>
    </div>
  </div>`;
}
function tildadasConciliacion(tipo){
  return [...document.querySelectorAll(`input[data-conc="${tipo}"]:checked:not(:disabled)`)].map(el=>concPropuestas[tipo][Number(el.dataset.i)]).filter(Boolean);
}
function actualizarTotalesConciliacion(){
  ['cobro','pago'].forEach(tipo=>{
    const btn = document.getElementById('conc-btn-'+tipo);
    if(!btn || btn.dataset.guardando) return;
    const sel = tildadasConciliacion(tipo);
    const ids = new Set(sel.flatMap(p=>p.ids));
    const total = sel.reduce((t,p)=>t+p.pendiente,0);
    btn.disabled = !ids.size;
    btn.textContent = `${tipo==='cobro'?'Marcar cobrado':'Marcar pagado'} lo tildado (${sel.length} · ${plataFin(total)})`;
  });
}
// Nunca se marca sin confirmar: cobros con este detalle; pagos con el de "Marcar pagado" (E3).
async function confirmarConciliacion(tipo){
  const sel = tildadasConciliacion(tipo);
  if(!sel.length){ toast('No hay nada tildado.', 'bad'); return; }
  const ids = [...new Set(sel.flatMap(p=>p.ids))];
  if(tipo==='cobro' && !(await confirmarCobrosConciliacion(sel))) return;
  const gastos = sel.flatMap(p=>p.gastos||[]);
  if(tipo==='pago' && !(await confirmarPagoSittings(ids, {}, [], gastos))) return;
  if(ids.length){
    const { error } = await sb.from('sittings_traslados').update({[tipo==='cobro'?'cobrado':'pagado']:true}).in('id', ids);
    if(error){ toast('No se pudo marcar: '+error.message, 'bad'); return; }
  }
  // Gastos extra del mismo grupo (08/10/2026): se marcan cobrados / reintegrados junto.
  if(gastos.length){
    const { error: eg } = await sb.from('gastos_extra').update({[tipo==='cobro'?'cobrado':'reintegrado']:true}).in('id', gastos.map(g=>g.id));
    if(eg) toast('Se marcaron los registros, pero no los gastos extra ('+eg.message+'). Avisale a Diego.', 'bad');
  }
  sel.forEach(p=>{
    p.hecha = true;
    const fila = document.querySelector(`[data-conc-fila="${tipo}-${p.i}"]`);
    const cb = fila?.querySelector('input');
    if(cb){ cb.checked = false; cb.disabled = true; }
    fila?.classList.add('conc-hecha');
  });
  // Otras propuestas que apuntaban a esos mismos sittings (opciones de una dudosa) ya no aplican.
  concPropuestas[tipo].forEach(p=>{
    if(!p.hecha && p.ids.some(id=>ids.includes(id))){
      const cb = document.querySelector(`[data-conc-fila="${tipo}-${p.i}"] input`);
      if(cb){ cb.checked = false; cb.disabled = true; }
    }
  });
  toast(tipo==='cobro' ? `Marcado como cobrado (${sel.length}).` : `Marcado como pagado (${sel.length}).`);
  refrescarFinanzasCompleto();
  setTimeout(actualizarTotalesConciliacion, 0);
}
function confirmarCobrosConciliacion(sel){
  const total = sel.reduce((t,p)=>t+p.pendiente,0);
  return new Promise(resolve=>{
    const overlay = document.createElement('div');
    overlay.className = 'confirmoverlay';
    overlay.innerHTML = `
      <div class="confirmbox wide" role="dialog" aria-label="Confirmar cobros">
        <h2 style="margin:0 0 4px;">Confirmar cobros</h2>
        <div class="helper" style="margin:0 0 12px;">Se van a marcar como cobrados todos los sittings de estos períodos.</div>
        <div id="cobro-detalle">
          ${sel.map(p=>`<div class="pago-fila">
            <div style="min-width:0;"><div style="font-weight:600;">${escaparHtml(p.nombre)}</div>
            <div class="helper" style="margin:2px 0 0;">${escaparHtml(p.periodo)} · ${p.ids.length} ${p.ids.length===1?'registro':'registros'}${p.motivo?' · dudosa, elegida a mano':''}</div></div>
            <div class="pago-monto">${plataFin(p.pendiente)}</div>
          </div>`).join('')}
          <div class="pago-fila pago-total-fila"><div style="font-weight:700;">Total</div><div class="pago-monto" id="cobro-total" style="font-weight:700;">${plataFin(total)}</div></div>
        </div>
        <div class="confirmbtns">
          <button class="btn ghost" id="cobro-cancelar">Cancelar</button>
          <button class="btn primary" id="cobro-confirmar">Confirmar cobro</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('show'));
    const cerrar = ok => { overlay.classList.remove('show'); setTimeout(()=>overlay.remove(), 180); resolve(ok); };
    overlay.addEventListener('click', e=>{ if(e.target===overlay) cerrar(false); });
    overlay.querySelector('#cobro-cancelar').addEventListener('click', ()=>cerrar(false));
    overlay.querySelector('#cobro-confirmar').addEventListener('click', ()=>cerrar(true));
  });
}

async function cargarJuguetesDeNinera(nombre){
  const box = document.getElementById('vn-juguetes');
  if(!box) return;
  const { data } = await sb.from('juguetes').select('nombre').eq('ninera_nombre', nombre);
  if(!data || !data.length) return;
  box.innerHTML = `
    <div style="margin-top:14px;background:var(--accent-soft);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--ink);cursor:pointer;" onclick="(async()=>{ await setModulo('juguetes'); const s=document.getElementById('jug-filt-ninera'); if(s){ s.value=${argJs(nombre)}; filtrarJuguetes(); } })();">
      ${data.length} juguete${data.length===1?'':'s'} en su casa: ${escaparHtml(data.map(j=>j.nombre).join(', '))}
    </div>`;
}

/* ================= REVISAR MESES (15/10/2026) =================
   Pedido de Pau y Delfi: revisar a mano los ingresos y gastos de cualquier mes pasado, incluido el
   histórico migrado de los Docs (fuente='historico'), y corregir lo que esté mal sin pasar por el
   SQL Editor. Se edita con los modales de siempre; los sittings quedan en sittings_historial y
   los gastos y saldos en finanzas_historial (los dos los escribe un trigger en la base).
   Arriba van las filas sospechosas con su motivo. "Revisado" usa sittings_traslados.revisado_at
   (la misma marca que pone Hoy al revisar un automático): la fila deja de figurar como sospechosa.
   El histórico se marca distinto: la migración guardó el cobro y el pago en líneas separadas,
   sin vínculo ni horario, así que ahí solo cuentan pago >= cobro (en filas con los dos) y la
   misma línea repetida (decisión de Diego, 15/10/2026). */
let finVista = 'resumen';
let finRevisarFiltro = 'todas';
let finRevisarDatos = null; // { sits, sospechas, gastosExtra, gastosGen, ajustes }
let finRevisarSecuencia = 0;
function cambiarVistaFinanzas(vista, recargar=true){
  finVista = vista==='revisar' ? 'revisar' : 'resumen';
  const resumen = document.getElementById('fin-vista-resumen-wrap');
  const revisar = document.getElementById('fin-revisar');
  if(!resumen || !revisar) return;
  resumen.style.display = finVista==='resumen' ? '' : 'none';
  revisar.style.display = finVista==='revisar' ? '' : 'none';
  ['resumen','revisar'].forEach(v=>{
    const b = document.getElementById('fin-vista-'+v);
    if(!b) return;
    const activo = v===finVista;
    b.style.background = activo ? '#666EAE' : '';
    b.style.color = activo ? '#fff' : '';
    b.style.borderColor = activo ? '#666EAE' : '';
  });
  if(recargar && finVista==='revisar') pintarRevisarMes();
}
function claveNombreFin(id, nombre){ return id || ('n:'+normaliza(String(nombre||'').trim())); }
function horasRegistroFin(r){
  if(r.tipo!=='sitting' || !r.hora_inicio || !r.hora_fin) return 0;
  const [hi, mi] = r.hora_inicio.split(':').map(Number);
  const [hf, mf] = r.hora_fin.split(':').map(Number);
  let fin = hf*60+mf;
  if(r.termina_dia_siguiente) fin += 24*60;
  const min = fin - (hi*60+mi);
  return min > 0 ? min/60 : 0;
}
/* Motivos por los que conviene revisar cada registro del mes: { id: ['motivo', ...] }.
   ctx: { asigPorId, famPorId, hoy }. Los revisados y los cancelados no se marcan. */
function sospechasDelMes(sits, ctx){
  const out = {};
  const agregar = (id, m)=>{ (out[id] = out[id] || []).push(m); };
  const fmt = n => '$'+Math.round(Number(n)||0).toLocaleString('es-UY');
  const vivos = sits.filter(r=>!r.cancelado);
  // Duplicados: en la app, mismo día, familia y niñera; en el histórico, la misma línea
  // (mismo lado y monto, misma fecha y nombres).
  const grupos = {};
  vivos.forEach(r=>{
    const k = r.fuente==='historico'
      ? ['h', r.fecha, normaliza(String(r.familia_nombre||'').trim()), normaliza(String(r.ninera_nombre||'').trim()), Number(r.cobro_familia)||0, Number(r.pago_ninera)||0].join('|')
      : ['a', r.fecha, claveNombreFin(r.familia_id, r.familia_nombre), claveNombreFin(r.ninera_id, r.ninera_nombre)].join('|');
    (grupos[k] = grupos[k] || []).push(r);
  });
  Object.values(grupos).forEach(g=>{
    if(g.length>1) g.forEach(r=>agregar(r.id, `Posible duplicado: hay ${g.length} registros iguales ese día`));
  });
  vivos.forEach(r=>{
    const cobro = Number(r.cobro_familia)||0, pago = Number(r.pago_ninera)||0;
    if(r.fuente==='historico'){
      if(cobro>0 && pago>0 && pago>=cobro) agregar(r.id, `Pago a la niñera (${fmt(pago)}) mayor o igual al cobro (${fmt(cobro)})`);
      return;
    }
    if(!cobro || !pago) agregar(r.id, !cobro && !pago ? 'Cobro y pago en $0 sin estar cancelado' : (!cobro ? 'Cobro en $0 sin estar cancelado' : 'Pago a la niñera en $0 sin estar cancelado'));
    if(cobro>0 && pago>=cobro) agregar(r.id, `Pago a la niñera (${fmt(pago)}) mayor o igual al cobro (${fmt(cobro)})`);
    else if(cobro>0 && pago>0 && (cobro-pago)/cobro < 0.10) agregar(r.id, `Margen ${Math.round((cobro-pago)/cobro*100)}% (menos del 10%)`);
    if(!r.familia_id && !r.ninera_id) agregar(r.id, 'Sin familia ni niñera vinculadas');
    else if(!r.familia_id) agregar(r.id, 'Sin familia vinculada');
    else if(!r.ninera_id) agregar(r.id, 'Sin niñera vinculada');
    if(r.tipo==='sitting' && !r.hora_inicio) agregar(r.id, 'Sitting sin horario');
    // Precio muy distinto (más de 30%) al de su fijo o a la tarifa de la familia.
    const asig = r.asignacion_id ? ctx.asigPorId[r.asignacion_id] : null;
    const fam = r.familia_id ? ctx.famPorId[r.familia_id] : null;
    let esperado = 0, deDonde = '';
    if(r.tipo==='traslado' && Number(asig?.cobro_traslado)>0){ esperado = Number(asig.cobro_traslado); deDonde = 'el fijo'; }
    else if(r.tipo==='sitting'){
      const horas = horasRegistroFin(r);
      const tarifa = Number(asig?.cobro_hora) || Number(fam?.cobro_hora) || 0;
      if(horas && tarifa){ esperado = Math.round(horas*tarifa); deDonde = Number(asig?.cobro_hora) ? 'el fijo' : 'la tarifa de la familia'; }
    }
    if(esperado && cobro>0 && Math.abs(cobro-esperado) > esperado*0.30) agregar(r.id, `Cobro ${fmt(cobro)}; con ${deDonde} daría ${fmt(esperado)}`);
    if(r.pagado && !r.cobrado && r.fecha < sumarDiasISO(ctx.hoy, -30)) agregar(r.id, 'Pagado a la niñera y sin cobrar hace más de 30 días');
  });
  sits.forEach(r=>{ if(r.revisado_at || r.cancelado) delete out[r.id]; });
  return out;
}
async function cargarRevisarMes(sitsRaw, gastosGen, asigs){
  const sec = ++finRevisarSecuencia;
  const mes = finMes;
  const desde = `${mes}-01`, hasta = shiftMes(mes, 1)+'-01';
  const sits = (sitsRaw||[]).filter(r=>!esPrevisto(r));
  const ids = sits.map(r=>r.id);
  const [{data:fams}, {data:ajustes, error:eAj}] = await Promise.all([
    sb.from('familias').select('id,nombre,cobro_hora'),
    sb.from('ajustes_saldo').select('*').gte('fecha', desde).lt('fecha', hasta),
  ]);
  let gastosExtra = [];
  for(let i=0; i<ids.length; i+=100){
    const { data, error } = await sb.from('gastos_extra').select('*').in('sitting_id', ids.slice(i, i+100));
    if(error) break; // base sin la tabla: la sección queda vacía
    gastosExtra = gastosExtra.concat(data||[]);
  }
  if(sec !== finRevisarSecuencia || !document.getElementById('fin-revisar')) return; // llegó otra carga o se cambió de módulo
  const asigPorId = {}; (asigs||[]).forEach(a=>{ asigPorId[a.id] = a; });
  const famPorId = {}; (fams||[]).forEach(f=>{ famPorId[f.id] = f; });
  const sospechas = sospechasDelMes(sits, { asigPorId, famPorId, hoy: todayISO() });
  finRevisarDatos = { mes, sits, sospechas, gastosExtra, gastosGen: gastosGen||[], ajustes: eAj ? [] : (ajustes||[]) };
  const n = Object.keys(sospechas).length;
  const cuenta = document.getElementById('fin-revisar-cuenta');
  if(cuenta) cuenta.innerHTML = n ? `<span class="badge warn" style="font-size:10.5px;padding:2px 7px;">${n}</span>` : '';
  pintarRevisarMes();
}
function filaRevisarSitHtml(r, motivos){
  const fmt = n => '$'+Math.round(Number(n)||0).toLocaleString('es-UY');
  const fechaFmt = new Date(r.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit'});
  const fuente = r.fuente==='historico' ? '<span class="badge" style="font-size:10px;padding:2px 7px;">Histórico</span>' : '<span class="badge brand" style="font-size:10px;padding:2px 7px;">App</span>';
  return `<div class="agendarow fin-rev-fila${motivos?' fin-rev-sospecha':''}" data-id="${escaparHtml(r.id)}" style="border-bottom:1px solid var(--line);align-items:flex-start;">
    <div>
      <div>${fechaFmt} · ${escaparHtml(r.familia_nombre||'(sin familia)')} · ${escaparHtml(r.ninera_nombre||'(sin niñera)')} · ${r.tipo==='traslado'?'traslado':'sitting'} ${fuente}${r.cancelado?' <span class="badge warn" style="font-size:10px;padding:2px 7px;">Cancelado</span>':''}${r.revisado_at?' <span class="badge good" style="font-size:10px;padding:2px 7px;">Revisado</span>':''}</div>
      ${motivos ? `<div class="fin-rev-motivo" style="font-size:12.5px;color:var(--bad);margin-top:2px;">${motivos.map(escaparHtml).join(' · ')}</div>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;">${fmt(r.cobro_familia)} / ${fmt(r.pago_ninera)}</span>
      <button class="smallbtn" onclick="editarMovimientoSitting(${argJs(r.id)})">Editar</button>
      ${motivos ? `<button class="smallbtn fin-rev-ok" onclick="conGuardado(this, ()=>guardarRevisadoFinanzas(${argJs(r.id)}))">Revisado</button>` : ''}
    </div>
  </div>`;
}
function cambiarFiltroRevisar(f){ finRevisarFiltro = f; pintarRevisarMes(); }
function pintarRevisarMes(){
  const box = document.getElementById('fin-revisar');
  const d = finRevisarDatos;
  if(!box || !d || d.mes !== finMes) return;
  const fmt = n => '$'+Math.round(Number(n)||0).toLocaleString('es-UY');
  const fechaCorta = f => f ? new Date(f+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit'}) : '—';
  const n = Object.keys(d.sospechas).length;
  const filtros = [['todas','Todas'],['revisar','Para revisar'],['sits','Sittings'],['extra','Gastos extra'],['generales','Gastos generales'],['saldos','Saldos']];
  const ver = k => finRevisarFiltro==='todas' || finRevisarFiltro===k;
  const ordenFecha = (a,b)=> (a.fecha||'').localeCompare(b.fecha||'');
  const sospechosas = d.sits.filter(r=>d.sospechas[r.id]).sort(ordenFecha);
  const resto = d.sits.filter(r=>!d.sospechas[r.id]).sort(ordenFecha);
  const fechaSit = {}; d.sits.forEach(r=>{ fechaSit[r.id] = r; });
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <h2 style="margin:0;">Revisar ${monthLabel(finMes)}</h2>
      <span id="fin-rev-total" class="badge ${n?'warn':'good'}">${n ? `${n} para revisar` : 'Nada para revisar'}</span>
    </div>
    <div class="helper">Cada cambio queda en el historial y las cifras de arriba se recalculan solas. "Revisado" saca la fila de la lista de sospechosas.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px;">${filtros.map(([k,t])=>`<button class="smallbtn fin-rev-filtro" data-filtro="${k}" onclick="cambiarFiltroRevisar(${argJs(k)})" style="${k===finRevisarFiltro?'background:#666EAE;color:#fff;border-color:#666EAE;':''}">${t}</button>`).join('')}</div>`;
  if(ver('revisar') || ver('sits')){
    html += `<div class="card-section-title">Para revisar</div><div id="fin-rev-sospechosas">${sospechosas.length ? sospechosas.map(r=>filaRevisarSitHtml(r, d.sospechas[r.id])).join('') : '<div class="empty">Nada para revisar en este mes.</div>'}</div>`;
  }
  if(ver('sits')){
    html += `<div class="card-section-title" style="margin-top:14px;">Resto del mes (cobro / pago)</div><div id="fin-rev-resto">${resto.length ? resto.map(r=>filaRevisarSitHtml(r, null)).join('') : '<div class="empty">No hay más sittings ni traslados en este mes.</div>'}</div>`;
  }
  if(ver('extra')){
    html += `<div class="card-section-title" style="margin-top:14px;">Gastos extra</div><div id="fin-rev-extra">${d.gastosExtra.length ? d.gastosExtra.map(g=>{
      const r = fechaSit[g.sitting_id] || {};
      const quien = g.absorbe_pb ? 'lo absorbe Parents Break' : (g.pagado_por==='familia' ? 'lo pagó la familia' : 'lo pagó la niñera');
      return `<div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>${fechaCorta(r.fecha)} · ${escaparHtml(g.concepto)} <span class="helper" style="margin:0;">(${escaparHtml(r.familia_nombre||'')} · ${quien})</span></div>
        <div style="display:flex;align-items:center;gap:8px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:13px;">${fmt(g.monto)}</span>
        <button class="smallbtn" onclick="editarGastoExtraFinanzas(${argJs(g.id)})">Editar</button></div>
      </div>`;
    }).join('') : '<div class="empty">No hay gastos extra en este mes.</div>'}</div>`;
  }
  if(ver('generales')){
    const gg = d.gastosGen.slice().sort(ordenFecha);
    html += `<div class="card-section-title" style="margin-top:14px;">Gastos generales</div><div id="fin-rev-generales">${gg.length ? gg.map(g=>`<div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>${fechaCorta(g.fecha)} · ${escaparHtml(g.concepto)}</div>
        <div style="display:flex;align-items:center;gap:8px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:13px;">${fmt(g.monto)}</span>
        <button class="smallbtn" onclick="editarGastoGeneral(${argJs(g.id)})">Editar</button></div>
      </div>`).join('') : '<div class="empty">No hay gastos generales en este mes.</div>'}</div>`;
  }
  if(ver('saldos')){
    const aj = d.ajustes.slice().sort(ordenFecha);
    html += `<div class="card-section-title" style="margin-top:14px;">Saldos a favor</div><div id="fin-rev-saldos">${aj.length ? aj.map(a=>`<div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>${fechaCorta(a.fecha)} · ${escaparHtml(a.nombre)} (${a.sujeto==='familia'?'familia':'niñera'}) · ${escaparHtml(a.motivo)}</div>
        <div style="display:flex;align-items:center;gap:8px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:13px;">${textoMontoAjuste(a.monto)}</span>
        <button class="smallbtn" onclick="editarAjusteFinanzas(${argJs(a.id)})">Editar</button></div>
      </div>`).join('') : '<div class="empty">No hay saldos a favor cargados en este mes.</div>'}</div>`;
  }
  box.innerHTML = html;
}
async function guardarRevisadoFinanzas(id){
  const ok = await sbGuardar(sb.from('sittings_traslados').update({ revisado_at: new Date().toISOString() }).eq('id', id), 'la marca de revisado');
  if(!ok) return;
  toast('Marcado como revisado.');
  refrescarFinanzasCompleto();
}
function editarGastoExtraFinanzas(id){
  const g = finRevisarDatos?.gastosExtra.find(x=>x.id===id);
  if(!g) return;
  const montoFijo = g.cobrado || g.reintegrado;
  abrirModal(`
    <h2 style="margin:0 0 18px;">Editar gasto extra</h2>
    <div class="grid2">
      <div class="field"><label>Concepto</label><input type="text" id="fin-gx-concepto" value="${escaparHtml(g.concepto)}"></div>
      <div class="field"><label>Monto</label><input type="number" id="fin-gx-monto" min="0" step="0.01" value="${escaparHtml(g.monto)}" ${montoFijo?'disabled':''}></div>
    </div>
    ${montoFijo ? '<div class="helper">Ya se cobró o se reintegró: el monto no se cambia.</div>' : ''}
    <div class="field"><label>Reemplazar la foto del ticket (opcional)</label><input type="file" id="fin-gx-foto" accept="image/*"></div>
    ${g.comprobante ? `<button type="button" class="smallbtn" onclick="verComprobanteGasto(${argJs(g.comprobante)})">Ver ticket</button>` : ''}
    <div id="fin-gx-warn"></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarGastoExtraFinanzas(${argJs(id)}))">Guardar</button>
    </div>
    <div id="fin-hist-box" style="margin-top:12px;"></div>`);
  verHistorialFinanzas('gastos_extra', id);
}
async function guardarGastoExtraFinanzas(id){
  const g = finRevisarDatos?.gastosExtra.find(x=>x.id===id);
  if(!g) return;
  const montoEl = document.getElementById('fin-gx-monto');
  const res = await aplicarEdicionGastoExtra(g, {
    concepto: document.getElementById('fin-gx-concepto').value.trim(),
    monto: montoEl.disabled ? null : Number(montoEl.value),
    archivo: document.getElementById('fin-gx-foto').files?.[0] || null,
  });
  if(res.error){ const w = document.getElementById('fin-gx-warn'); if(w) w.innerHTML = res.error; return; }
  cerrarModal();
  toast(res.avisos.length ? 'Gasto guardado, pero '+res.avisos.join(' y ')+'.' : 'Gasto guardado.', res.avisos.length ? 'bad' : undefined);
  refrescarFinanzasCompleto();
}
/* Saldo a favor: fecha, motivo y monto. Lo ya usado en un cobro o pago (aplicado) pone un piso
   al monto y no deja darlo vuelta; el de un gasto extra pagado por la familia se cambia desde el
   gasto, para que los dos no queden distintos. */
function editarAjusteFinanzas(id){
  const a = finRevisarDatos?.ajustes.find(x=>x.id===id);
  if(!a) return;
  const aplicado = Number(a.aplicado)||0;
  abrirModal(`
    <h2 style="margin:0 0 4px;">Editar saldo a favor</h2>
    <div class="helper" style="margin-bottom:14px;">${escaparHtml(a.nombre)} (${a.sujeto==='familia'?'familia':'niñera'}). Positivo suma a lo que se le cobra o paga; negativo descuenta.</div>
    <div class="grid3">
      <div class="field"><label>Fecha</label><input type="date" id="fin-aj-fecha" value="${escaparHtml(a.fecha)}"></div>
      <div class="field"><label>Motivo</label><input type="text" id="fin-aj-motivo" value="${escaparHtml(a.motivo)}"></div>
      <div class="field"><label>Monto</label><input type="number" id="fin-aj-monto" step="0.01" value="${escaparHtml(a.monto)}"></div>
    </div>
    ${aplicado ? `<div class="helper">Ya se usaron ${plataFin(aplicado)}: el monto no puede quedar por debajo de eso ni cambiar de signo.</div>` : ''}
    <div id="fin-aj-warn"></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="conGuardado(this, ()=>guardarAjusteFinanzas(${argJs(id)}))">Guardar</button>
    </div>
    <div id="fin-hist-box" style="margin-top:12px;"></div>`);
  verHistorialFinanzas('ajustes_saldo', id);
}
async function guardarAjusteFinanzas(id){
  const a = finRevisarDatos?.ajustes.find(x=>x.id===id);
  if(!a) return;
  const warn = document.getElementById('fin-aj-warn');
  const aviso = t => { if(warn) warn.innerHTML = `<div class="warnbox">${t}</div>`; };
  const fecha = document.getElementById('fin-aj-fecha').value;
  const motivo = document.getElementById('fin-aj-motivo').value.trim();
  const montoTxt = document.getElementById('fin-aj-monto').value;
  const monto = Number(montoTxt);
  if(!fecha || !motivo) return aviso('Faltan la fecha o el motivo.');
  if(montoTxt==='' || !isFinite(monto) || monto===0) return aviso('El monto tiene que ser un número distinto de cero.');
  const aplicado = Number(a.aplicado)||0;
  const cambiaMonto = monto !== Number(a.monto);
  if(cambiaMonto){
    if(aplicado && (Math.sign(monto)!==Math.sign(Number(a.monto)) || Math.abs(monto) < aplicado)) return aviso(`Ya se usaron ${plataFin(aplicado)} de este saldo: el monto no puede quedar por debajo ni cambiar de signo.`);
    const { data: gx, error: eG } = await sb.from('gastos_extra').select('id').eq('ajuste_id', id).limit(1);
    if(!eG && gx && gx.length) return aviso('Este saldo sale de un gasto extra que pagó la familia: cambiá el monto desde el gasto.');
  }
  const ok = await sbGuardar(sb.from('ajustes_saldo').update({ fecha, motivo, monto }).eq('id', id), 'el saldo a favor');
  if(!ok) return;
  cerrarModal();
  toast('Cambios guardados.');
  refrescarFinanzasCompleto();
}
/* Historial de gastos generales, gastos extra y saldos a favor (finanzas_historial, lo escribe
   un trigger). Si la migración todavía no corrió, se avisa y el resto funciona igual. */
const HIST_CAMPOS_FIN = { fecha:'Fecha', concepto:'Concepto', monto:'Monto', notas:'Notas', motivo:'Motivo', comprobante:'Ticket', cobrado:'Cobrado', reintegrado:'Reintegrado', aplicado:'Usado', pagado_por:'Lo pagó', absorbe_pb:'Lo absorbe Parents Break' };
async function verHistorialFinanzas(tabla, id){
  const box = document.getElementById('fin-hist-box');
  if(!box) return;
  const { data, error } = await sb.from('finanzas_historial').select('*').eq('tabla', tabla).eq('fila_id', id).order('cuando', {ascending:false});
  if(!document.getElementById('fin-hist-box')) return;
  if(error){
    box.innerHTML = `<div class="helper">${esFaltaTabla(error) ? 'El historial de cambios de gastos y saldos todavía no está activado en la base.' : 'No se pudo cargar el historial: '+escaparHtml(error.message)}</div>`;
    return;
  }
  if(!data || !data.length){ box.innerHTML = '<div class="helper">Sin cambios registrados desde que se activó el historial.</div>'; return; }
  box.innerHTML = '<div class="card-section-title">Historial de cambios</div>' + data.map(h=>{
    const cuando = new Date(h.cuando).toLocaleString('es-UY',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
    let detalle = '';
    if(h.accion==='alta') detalle = 'Lo cargó.';
    else if(h.accion==='baja') detalle = 'Lo borró.';
    else detalle = Object.entries(h.cambios||{}).filter(([k])=>HIST_CAMPOS_FIN[k])
      .map(([k,c])=>`${HIST_CAMPOS_FIN[k]}: ${valorHistorial(c.antes)} → ${valorHistorial(c.despues)}`).join('<br>') || 'Cambios internos.';
    return `<div class="agendarow fin-hist-fila" style="border-bottom:1px solid var(--line);align-items:flex-start;">
      <div><div style="font-weight:600;">${escaparHtml(h.usuario||'(sin usuario)')}</div><div class="helper" style="margin:2px 0 0;">${cuando}</div></div>
      <div style="font-size:13px;text-align:right;">${detalle}</div>
    </div>`;
  }).join('');
}
