/* ================= FINANZAS ================= */
let finMes = null;
async function renderFinanzas(cont){
  finMes = finMes || currentMonthStr();
  cont.innerHTML = moduloHeader('Finanzas') + `
    <div class="helper">Ingresos y pagos a niñeras vienen automáticos desde Sittings &amp; traslados. Los demás gastos del negocio (alquiler, insumos, etc.) se cargan acá a mano. Los cobros se pueden conciliar automáticamente subiendo el extracto de Itaú, más abajo.</div>
    <div class="mesbar">
      <div class="mesnav">
        <button onclick="cambiarFinMesRel(-1)" aria-label="Mes anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="mesnav-label" id="fin-mes-label">${monthLabel(finMes)}</div>
        <button onclick="cambiarFinMesRel(1)" aria-label="Mes siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <button class="btn primary" onclick="abrirModalNuevoGasto()">+ Registrar gasto</button>
    </div>
    <div class="summary3" id="fin-summary"></div>
    <div class="card" id="fin-balance-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div><h2 style="margin:0;">Balance de varios meses</h2><div class="helper" style="margin:2px 0 0;">Ingresos y gastos mes a mes, para ver la tendencia y no solo la foto de un mes.</div></div>
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
        <div><h2 style="margin:0;">Conciliar cobros con extracto Itaú</h2><div class="helper" style="margin:2px 0 0;">Subí el estado de cuenta (.xls, .xlsx o .csv) y el sistema matchea los créditos contra la cuenta bancaria de cada familia, para no tener que marcar "cobrado" sitting por sitting.</div></div>
      </div>
      <div id="fin-extracto-aviso"></div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <input type="file" accept=".csv,.xls,.xlsx" id="fin-conciliar-file" style="font-size:13px;">
        <button class="btn primary" onclick="procesarExtractoConciliacion()">Procesar extracto</button>
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
  `;
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
          <td>${f.nombre}</td>
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
      <button class="btn primary" onclick="guardarGastoGeneral()">Agregar gasto</button>
    </div>`);
}
async function guardarGastoGeneral(){
  const fecha = document.getElementById('fin-gasto-fecha').value;
  const concepto = document.getElementById('fin-gasto-concepto').value.trim();
  const monto = Number(document.getElementById('fin-gasto-monto').value)||0;
  if(!fecha || !concepto || !monto){ toast('Faltan fecha, concepto o monto.', 'bad'); return; }
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
      <div class="field"><label>Fecha</label><input type="date" id="ed-gasto-fecha" value="${g.fecha||''}"></div>
      <div class="field"><label>Concepto</label><input type="text" id="ed-gasto-concepto" value="${g.concepto||''}"></div>
      <div class="field"><label>Monto</label><input type="number" id="ed-gasto-monto" value="${g.monto||0}"></div>
    </div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="guardarEdicionGasto('${id}')">Guardar</button>
    </div>`);
}
async function guardarEdicionGasto(id){
  const cambios = {
    fecha: document.getElementById('ed-gasto-fecha').value,
    concepto: document.getElementById('ed-gasto-concepto').value.trim(),
    monto: Number(document.getElementById('ed-gasto-monto').value)||0,
  };
  if(!cambios.fecha || !cambios.concepto){ toast('Faltan fecha o concepto.','bad'); return; }
  const { error } = await sb.from('gastos_generales').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Cambios guardados.');
  cargarFinanzas();
}
let finGastosItems = [];
let finFijosItems = [];
let finSitsDelMes = [];
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
      <button class="btn primary" onclick="guardarGastoFijo()">Agregar</button>
    </div>`);
}
async function guardarGastoFijo(){
  const concepto = document.getElementById('ff-concepto').value.trim();
  const monto = Number(document.getElementById('ff-monto').value)||0;
  const desde = document.getElementById('ff-desde').value || todayISO();
  if(!concepto || !monto){ toast('Faltan concepto o monto.','bad'); return; }
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
      <div class="field"><label>Concepto</label><input type="text" id="ef-concepto" value="${g.concepto||''}"></div>
      <div class="field"><label>Monto mensual</label><input type="number" id="ef-monto" value="${g.monto||0}"></div>
      <div class="field"><label>Desde</label><input type="date" id="ef-desde" value="${g.desde||''}"></div>
    </div>
    <div class="field"><label>Notas</label><textarea id="ef-notas">${g.notas||''}</textarea></div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" onclick="guardarEdicionGastoFijo('${id}')">Guardar</button>
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
  const { error } = await sb.from('gastos_fijos').update(cambios).eq('id', id);
  if(error){ toast('No se pudo guardar: '+error.message,'bad'); return; }
  cerrarModal();
  toast('Cambios guardados.');
  cargarFinanzas();
}
async function toggleGastoFijo(id, activo){
  const { error } = await sb.from('gastos_fijos').update({activo}).eq('id', id);
  if(error){ toast('No se pudo actualizar: '+error.message,'bad'); return; }
  cargarFinanzas();
}
async function eliminarGastoFijo(id){
  if(!(await confirmarAccion('¿Eliminar este gasto fijo? No se puede deshacer.'))) return;
  const { error } = await sb.from('gastos_fijos').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar: '+error.message,'bad'); return; }
  cargarFinanzas();
}
async function cargarFinanzas(){
  const chartReady = asegurarChart(); // en paralelo, no bloquea el resto de Finanzas
  const summary = document.getElementById('fin-summary');
  const movsBox = document.getElementById('fin-movs');
  movsBox.innerHTML = '<div class="empty"><span class="spinner dark"></span> Cargando…</div>';
  const [y,m] = finMes.split('-').map(Number);
  const desde = `${finMes}-01`;
  const hasta = new Date(y, m, 1).toISOString().slice(0,10);
  const [{data:sits, error:e1}, {data:gastos, error:e2}, {data:fijos, error:e3}, {data:famsZona}] = await Promise.all([
    sb.from('sittings_traslados').select('*').gte('fecha', desde).lt('fecha', hasta),
    sb.from('gastos_generales').select('*').gte('fecha', desde).lt('fecha', hasta),
    sb.from('gastos_fijos').select('*').order('concepto'),
    sb.from('familias').select('id,nombre,zona'),
  ]);
  // Si se navegó a otro módulo mientras esperábamos estos datos, no seguir —
  // evita escribir sobre una pantalla que ya no está (mismo caso que "Hoy").
  if(!document.getElementById('fin-movs')) return;
  if(e1 || e2 || e3){ movsBox.innerHTML = errBox(e1||e2||e3); return; }
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
              <input type="checkbox" ${g.activo?'checked':''} onchange="toggleGastoFijo('${g.id}', this.checked)">
              ${g.concepto} <span style="color:var(--ink-soft);font-size:12px;">· desde ${g.desde ? new Date(g.desde+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}) : '—'}${aplicaEsteMes?'':' · no aplica este mes'}</span>
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--clay-text);">$${Number(g.monto||0).toLocaleString('es-UY')}/mes</span>
            <button class="smallbtn" onclick="editarGastoFijo('${g.id}')">Editar</button>
            <button class="smallbtn danger" onclick="eliminarGastoFijo('${g.id}')">Eliminar</button>
          </div>
        </div>`;
      }).join('') + (totalFijos>0 ? `<div class="helper" style="margin-top:8px;">Total fijos aplicados a ${monthLabel(finMes)}: <b>$${totalFijos.toLocaleString('es-UY')}</b></div>` : '');
    }
  }
  const ingresos = (sits||[]).reduce((s,r)=>s+(Number(r.cobro_familia)||0), 0);
  const egresosNinieras = (sits||[]).reduce((s,r)=>s+(Number(r.pago_ninera)||0), 0);
  const egresosGenerales = (gastos||[]).reduce((s,g)=>s+(Number(g.monto)||0), 0) + totalFijos;
  const egresos = egresosNinieras + egresosGenerales;
  summary.innerHTML = `
    <div class="summarycard"><div class="statlabel">Ingresos de ${monthLabel(finMes)}</div><div class="statnum" style="font-size:19px;margin-top:3px;color:var(--good);">$${ingresos.toLocaleString('es-UY')}</div></div>
    <div class="summarycard"><div class="statlabel">Gastos de ${monthLabel(finMes)}</div><div class="statnum" style="font-size:19px;margin-top:3px;color:var(--clay-text);">$${egresos.toLocaleString('es-UY')}</div></div>
    <div class="summarycard" style="border-left:3px solid var(--accent);"><div class="statlabel">Balance</div><div class="statnum" style="font-size:19px;margin-top:3px;">$${(ingresos-egresos).toLocaleString('es-UY')}</div></div>
  `;
  const chartCard = document.getElementById('fin-breakdown-card');
  if(chartCard){
    await chartReady;
    if(egresos>0 && window.Chart){
      chartCard.style.display = '';
      if(finBreakdownChart){ finBreakdownChart.destroy(); finBreakdownChart = null; }
      finBreakdownChart = new Chart(document.getElementById('finBreakdownChart'), {
        type:'doughnut',
        data:{ labels:['Pagos a niñeras','Gastos generales'], datasets:[{ data:[Math.round(egresosNinieras), Math.round(egresosGenerales)], backgroundColor:['#757CBB','#DF8386'], borderWidth:0 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, cutout:'62%' }
      });
      document.getElementById('fin-breakdown-legend').innerHTML = `
        <span><span class="chartdot" style="background:#757CBB;"></span>Pagos a niñeras · $${Math.round(egresosNinieras).toLocaleString('es-UY')}</span>
        <span><span class="chartdot" style="background:#DF8386;"></span>Gastos generales · $${Math.round(egresosGenerales).toLocaleString('es-UY')}</span>`;
    } else {
      chartCard.style.display = 'none';
    }
  }
  const movs = [];
  (sits||[]).forEach(r=>{
    if(Number(r.cobro_familia)) movs.push({fecha:r.fecha, texto:`${r.familia_nombre} — ${r.tipo==='sitting'?'sitting':'traslado'} (${r.ninera_nombre})`, monto:Number(r.cobro_familia)});
    if(Number(r.pago_ninera)) movs.push({fecha:r.fecha, texto:`Pago a ${r.ninera_nombre}`, monto:-Number(r.pago_ninera)});
  });
  (gastos||[]).forEach(g=>{
    movs.push({fecha:g.fecha, texto:g.concepto, monto:-Number(g.monto), gastoId:g.id});
  });
  movs.sort((a,b)=> b.fecha.localeCompare(a.fecha));
  if(!movs.length){ movsBox.innerHTML = `<div class="empty">No hay movimientos cargados en ${monthLabel(finMes)} todavía.</div>`; return; }
  movsBox.innerHTML = `<h2>Movimientos de ${monthLabel(finMes)}</h2>` + movs.map(mv=>{
    const fechaFmt = new Date(mv.fecha+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'});
    return `<div class="agendarow" style="border-bottom:1px solid var(--line);">
      <div>${fechaFmt} · ${mv.texto}</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${mv.monto>0?'var(--good)':'var(--clay-text)'};">${mv.monto>0?'+':''}$${mv.monto.toLocaleString('es-UY')}</span>
        ${mv.gastoId ? `<button class="smallbtn" onclick="editarGastoGeneral('${mv.gastoId}')">Editar</button><button class="smallbtn danger" onclick="eliminarGastoGeneral('${mv.gastoId}')">Eliminar</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ---- Balance de varios meses ---- */
let finBalanceChart = null;
async function cargarBalanceMultiMes(nMeses){
  const chartReady = asegurarChart(); // en paralelo con las consultas de abajo
  const wrap = document.getElementById('fin-balance-totales');
  const sel = document.getElementById('fin-balance-rango');
  if(sel && Number(sel.value)!==nMeses) sel.value = String(nMeses);
  const hoy = currentMonthStr();
  const meses = [];
  for(let i=nMeses-1;i>=0;i--) meses.push(shiftMes(hoy, -i));
  const desde = `${meses[0]}-01`;
  const [y,m] = meses[meses.length-1].split('-').map(Number);
  const hasta = new Date(y, m, 1).toISOString().slice(0,10);
  const [{data:sits, error:e1}, {data:gastos, error:e2}, {data:fijos, error:e3}] = await Promise.all([
    sb.from('sittings_traslados').select('fecha,cobro_familia,pago_ninera').gte('fecha', desde).lt('fecha', hasta),
    sb.from('gastos_generales').select('fecha,monto').gte('fecha', desde).lt('fecha', hasta),
    sb.from('gastos_fijos').select('monto,desde,activo'),
  ]);
  if(e1 || e2 || e3){ if(wrap) wrap.innerHTML = errBox(e1||e2||e3); return; }
  const porMes = {};
  meses.forEach(mes=> porMes[mes] = {ingresos:0, gastos:0});
  (sits||[]).forEach(r=>{
    const mes = r.fecha.slice(0,7);
    if(!porMes[mes]) return;
    porMes[mes].ingresos += Number(r.cobro_familia)||0;
    porMes[mes].gastos += Number(r.pago_ninera)||0;
  });
  (gastos||[]).forEach(g=>{
    const mes = g.fecha.slice(0,7);
    if(!porMes[mes]) return;
    porMes[mes].gastos += Number(g.monto)||0;
  });
  meses.forEach(mes=>{
    const [ya,ma] = mes.split('-').map(Number);
    const finMesStr = new Date(ya, ma, 1).toISOString().slice(0,10);
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
        { label:'Ingresos', data:dataIngresos, backgroundColor:'#6FAE8C', borderRadius:4 },
        { label:'Gastos', data:dataGastos, backgroundColor:'#DF8386', borderRadius:4 },
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{ y:{ ticks:{ callback:v=>'$'+Number(v).toLocaleString('es-UY') } } } }
    });
  }
  const totalIngresos = dataIngresos.reduce((s,v)=>s+v,0);
  const totalGastos = dataGastos.reduce((s,v)=>s+v,0);
  if(wrap){
    wrap.innerHTML = `
      <div class="summarycard"><div class="statlabel">Ingresos (${nMeses} meses)</div><div class="statnum" style="font-size:19px;margin-top:3px;color:var(--good);">$${totalIngresos.toLocaleString('es-UY')}</div></div>
      <div class="summarycard"><div class="statlabel">Gastos (${nMeses} meses)</div><div class="statnum" style="font-size:19px;margin-top:3px;color:var(--clay-text);">$${totalGastos.toLocaleString('es-UY')}</div></div>
      <div class="summarycard" style="border-left:3px solid var(--accent);"><div class="statlabel">Balance del período</div><div class="statnum" style="font-size:19px;margin-top:3px;">$${(totalIngresos-totalGastos).toLocaleString('es-UY')}</div></div>
    `;
  }
}

/* ---- Por cobrar / Por pagar (agrupado por frecuencia de familia/niñera) ---- */
function lunesDeSemana(fechaISO){
  const d = new Date(fechaISO+'T00:00:00');
  const dow = d.getDay();
  const diff = (dow===0 ? -6 : 1-dow);
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}
function finDeSemanaDesde(lunesISO){
  const d = new Date(lunesISO+'T00:00:00');
  d.setDate(d.getDate()+6);
  return d.toISOString().slice(0,10);
}
function fmtFechaCortaFin(fechaISO){
  return new Date(fechaISO+'T00:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'short'});
}
function bucketKeyFecha(fechaISO, frecuencia){
  if(frecuencia==='mensual') return fechaISO.slice(0,7);
  if(frecuencia==='semanal') return lunesDeSemana(fechaISO);
  return fechaISO;
}
function bucketLabelFecha(bucketKey, frecuencia){
  if(frecuencia==='mensual') return monthLabel(bucketKey);
  if(frecuencia==='semanal') return `Semana del ${fmtFechaCortaFin(bucketKey)} al ${fmtFechaCortaFin(finDeSemanaDesde(bucketKey))}`;
  return fmtFechaCortaFin(bucketKey);
}
async function cargarPorCobrarPorPagar(){
  const [{data:pendCobrar}, {data:pendPagar}, {data:fams}, {data:nins}, {data:asigs}] = await Promise.all([
    sb.from('sittings_traslados').select('id,familia_id,familia_nombre,fecha,cobro_familia').eq('cobrado', false).gt('cobro_familia', 0),
    sb.from('sittings_traslados').select('id,familia_id,familia_nombre,ninera_id,ninera_nombre,fecha,pago_ninera').eq('pagado', false).gt('pago_ninera', 0),
    sb.from('familias').select('id,nombre,frecuencia_cobro'),
    sb.from('ninieras').select('id,nombre,cuenta_bancaria'),
    sb.from('asignaciones').select('familia_id,ninera_id,ninera_nombre,familias(nombre)'),
  ]);
  const famFrecPorId = {}; const famFrecPorNombre = {};
  (fams||[]).forEach(f=>{ famFrecPorId[f.id] = f.frecuencia_cobro || 'mensual'; famFrecPorNombre[normaliza(f.nombre)] = f.frecuencia_cobro || 'mensual'; });
  const ninInfoPorId = {}; const ninInfoPorNombre = {};
  (nins||[]).forEach(n=>{ ninInfoPorId[n.id] = n; ninInfoPorNombre[normaliza(n.nombre)] = n; });
  // Relaciones fijas (esa niñera trabaja fijo para esa familia): niñera+familia por id y por nombre, para no perder casos viejos sin id cargado.
  const fijoSet = new Set();
  (asigs||[]).forEach(a=>{
    if(a.ninera_id && a.familia_id) fijoSet.add(a.ninera_id+'|'+a.familia_id);
    fijoSet.add(normaliza(a.ninera_nombre||'')+'|'+normaliza(a.familias?.nombre||''));
  });
  function esTrabajoFijo(r){
    if(r.ninera_id && r.familia_id && fijoSet.has(r.ninera_id+'|'+r.familia_id)) return true;
    return fijoSet.has(normaliza(r.ninera_nombre||'')+'|'+normaliza(r.familia_nombre||''));
  }

  const gruposCobrar = {};
  (pendCobrar||[]).forEach(r=>{
    const frec = r.familia_id ? (famFrecPorId[r.familia_id]||'mensual') : (famFrecPorNombre[normaliza(r.familia_nombre)]||'mensual');
    const bucket = bucketKeyFecha(r.fecha, frec);
    const key = (r.familia_id||normaliza(r.familia_nombre))+'|'+bucket;
    if(!gruposCobrar[key]) gruposCobrar[key] = {nombre:r.familia_nombre, frec, bucket, total:0, ids:[]};
    gruposCobrar[key].total += Number(r.cobro_familia)||0;
    gruposCobrar[key].ids.push(r.id);
  });
  const listaCobrar = Object.values(gruposCobrar).sort((a,b)=> b.bucket.localeCompare(a.bucket) || a.nombre.localeCompare(b.nombre));

  const gruposPagar = {};
  (pendPagar||[]).forEach(r=>{
    // La frecuencia depende del trabajo, no de la niñera: si es una relación fija con esa familia, se junta semanal; si es puntual, se paga aparte por día.
    const frec = esTrabajoFijo(r) ? 'semanal' : 'diario';
    const bucket = bucketKeyFecha(r.fecha, frec);
    const info = r.ninera_id ? ninInfoPorId[r.ninera_id] : ninInfoPorNombre[normaliza(r.ninera_nombre)];
    const key = (r.ninera_id||normaliza(r.ninera_nombre))+'|'+bucket;
    if(!gruposPagar[key]) gruposPagar[key] = {nombre:r.ninera_nombre, frec, bucket, total:0, ids:[], cuenta:info?.cuenta_bancaria||''};
    gruposPagar[key].total += Number(r.pago_ninera)||0;
    gruposPagar[key].ids.push(r.id);
  });
  const listaPagar = Object.values(gruposPagar).sort((a,b)=> b.bucket.localeCompare(a.bucket) || a.nombre.localeCompare(b.nombre));

  renderPorCobrar(listaCobrar);
  renderPorPagar(listaPagar);
}
function renderPorCobrar(lista){
  const box = document.getElementById('fin-porcobrar-wrap');
  if(!box) return;
  if(!lista.length){ box.innerHTML = `<h2>Por cobrar</h2><div class="empty">No hay cobros pendientes.</div>`; return; }
  const total = lista.reduce((s,g)=>s+g.total,0);
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
      <h2 style="margin:0;">Por cobrar</h2>
      <div class="helper" style="margin:0;">${lista.length} pendiente${lista.length===1?'':'s'} · $${total.toLocaleString('es-UY')}</div>
    </div>
    ${lista.map(g=>`
      <div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>
          <div style="font-weight:600;">${g.nombre}</div>
          <div class="helper" style="margin:2px 0 0;">${bucketLabelFecha(g.bucket, g.frec)} · ${g.frec}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--good);">$${g.total.toLocaleString('es-UY')}</span>
          <button class="smallbtn" onclick='marcarGrupoResuelto(${JSON.stringify(g.ids)}, "cobrado")'>Marcar cobrado</button>
        </div>
      </div>`).join('')}
  `;
}
function renderPorPagar(lista){
  const box = document.getElementById('fin-porpagar-wrap');
  if(!box) return;
  if(!lista.length){ box.innerHTML = `<h2>Por pagar</h2><div class="empty">No hay pagos pendientes.</div>`; return; }
  const total = lista.reduce((s,g)=>s+g.total,0);
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
      <h2 style="margin:0;">Por pagar</h2>
      <div class="helper" style="margin:0;">${lista.length} pendiente${lista.length===1?'':'s'} · $${total.toLocaleString('es-UY')}</div>
    </div>
    ${lista.map(g=>`
      <div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>
          <div style="font-weight:600;">${g.nombre}</div>
          <div class="helper" style="margin:2px 0 0;">${bucketLabelFecha(g.bucket, g.frec)} · ${g.frec}</div>
          ${g.cuenta ? `<div class="helper" style="margin:2px 0 0;font-family:'IBM Plex Mono',monospace;">${g.cuenta}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--clay-text);">$${g.total.toLocaleString('es-UY')}</span>
          <button class="smallbtn" onclick='marcarGrupoResuelto(${JSON.stringify(g.ids)}, "pagado")'>Marcar pagado</button>
        </div>
      </div>`).join('')}
  `;
}
async function marcarGrupoResuelto(ids, campo){
  const { error } = await sb.from('sittings_traslados').update({[campo]:true}).in('id', ids);
  if(error){ toast('No se pudo actualizar: '+error.message, 'bad'); return; }
  toast(campo==='cobrado' ? 'Marcado como cobrado.' : 'Marcado como pagado.');
  cargarPorCobrarPorPagar();
  actualizarFinanzasBadge();
}

/* ---- Conciliación de cobros contra extracto Itaú ---- */
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
function detectarColumnasExtracto(filas){
  const norm = s => normaliza(String(s||''));
  for(let i=0;i<Math.min(filas.length,10);i++){
    const fila = filas[i].map(norm);
    const iFecha = fila.findIndex(c=>c.includes('fecha'));
    const iCredito = fila.findIndex(c=>c.includes('credito') || c.includes('haber'));
    const iConcepto = fila.findIndex(c=>c.includes('concepto') || c.includes('descripcion') || c.includes('referencia') || c.includes('detalle'));
    if(iFecha>-1 && iCredito>-1) return { header:i, iFecha, iCredito, iConcepto: iConcepto>-1?iConcepto:iFecha+1 };
  }
  return null;
}
async function procesarExtractoConciliacion(){
  const input = document.getElementById('fin-conciliar-file');
  const box = document.getElementById('fin-conciliar-resultado');
  const file = input.files[0];
  if(!file){ toast('Elegí un archivo primero.', 'bad'); return; }
  box.innerHTML = '<div class="empty"><span class="spinner dark"></span> Leyendo el extracto…</div>';
  let filas;
  try{ await asegurarXLSX(); filas = await leerFilasExtracto(file); }
  catch(e){ box.innerHTML = `<div class="empty">No se pudo leer el archivo: ${e.message}</div>`; return; }
  const cols = detectarColumnasExtracto(filas);
  if(!cols){ box.innerHTML = '<div class="empty">No encontré columnas de Fecha y Crédito en el archivo. Revisá que sea el extracto tal cual lo exporta Itaú.</div>'; return; }

  const creditos = [];
  for(let i=cols.header+1;i<filas.length;i++){
    const f = filas[i];
    if(!f || !f.length) continue;
    const monto = parseMontoExtracto(f[cols.iCredito]);
    if(!monto) continue;
    const fecha = parseFechaExtracto(f[cols.iFecha]);
    if(!fecha) continue;
    const concepto = String(f[cols.iConcepto]||'');
    creditos.push({ fecha, monto, concepto, cuenta: extraerCuentaDeTexto(concepto) });
  }
  if(!creditos.length){ box.innerHTML = '<div class="empty">No encontré movimientos de crédito en el archivo.</div>'; return; }

  const [{data:fams}, {data:pend}] = await Promise.all([
    sb.from('familias').select('id,nombre,frecuencia_cobro,cuenta_bancaria'),
    sb.from('sittings_traslados').select('id,familia_id,familia_nombre,fecha,cobro_familia').eq('cobrado', false).gt('cobro_familia', 0),
  ]);
  const famPorCuenta = {};
  (fams||[]).forEach(f=>{
    const d = soloDigitos(f.cuenta_bancaria);
    if(!d) return;
    famPorCuenta[d] = f;
    famPorCuenta[d.replace(/^0+/,'')] = f;
  });
  const famFrecPorId = {}; (fams||[]).forEach(f=>{ famFrecPorId[f.id] = f.frecuencia_cobro || 'mensual'; });

  // Agrupar créditos identificados por familia+bucket (según la frecuencia de cobro de esa familia)
  const grupCred = {};
  const sinIdentificar = [];
  creditos.forEach(c=>{
    const fam = c.cuenta ? (famPorCuenta[c.cuenta] || famPorCuenta[c.cuenta.replace(/^0+/,'')]) : null;
    if(!fam){ sinIdentificar.push(c); return; }
    const frec = famFrecPorId[fam.id] || 'mensual';
    const bucket = bucketKeyFecha(c.fecha, frec);
    const key = fam.id+'|'+bucket;
    if(!grupCred[key]) grupCred[key] = { familia:fam, frec, bucket, total:0 };
    grupCred[key].total += c.monto;
  });

  // Agrupar pendientes de cobro por familia+bucket, con la misma lógica de bucket que "Por cobrar"
  const grupPend = {};
  (pend||[]).forEach(r=>{
    if(!r.familia_id) return;
    const frec = famFrecPorId[r.familia_id] || 'mensual';
    const bucket = bucketKeyFecha(r.fecha, frec);
    const key = r.familia_id+'|'+bucket;
    if(!grupPend[key]) grupPend[key] = { total:0, ids:[] };
    grupPend[key].total += Number(r.cobro_familia)||0;
    grupPend[key].ids.push(r.id);
  });

  const matches = [];
  Object.keys(grupCred).forEach(key=>{
    const cred = grupCred[key];
    const pendG = grupPend[key];
    if(!pendG) return; // la familia cobró algo pero no tiene sittings pendientes de marcar acá — nada que hacer
    matches.push({ familia:cred.familia.nombre, bucket:cred.bucket, frec:cred.frec, totalExtracto:cred.total, totalPendiente:pendG.total, ids:pendG.ids, exacto: Math.abs(cred.total-pendG.total)<1 });
  });
  matches.sort((a,b)=> b.bucket.localeCompare(a.bucket) || a.familia.localeCompare(b.familia));

  const exactos = matches.filter(m=>m.exacto);
  const conDiferencia = matches.filter(m=>!m.exacto);

  await sbGuardar(sb.from('app_config').upsert({ id:'ultima_conciliacion_cobros', valor:{archivo:file.name}, actualizado_at:new Date().toISOString() }), 'la marca de conciliación');
  actualizarFinanzasBadge();
  cargarAvisoExtracto();

  const filaMatch = m => `
    <div class="agendarow" style="border-bottom:1px solid var(--line);">
      <div>
        <div style="font-weight:600;">${m.familia}</div>
        <div class="helper" style="margin:2px 0 0;">${bucketLabelFecha(m.bucket, m.frec)}${m.exacto?'':` · extracto $${m.totalExtracto.toLocaleString('es-UY')} vs pendiente $${m.totalPendiente.toLocaleString('es-UY')}`}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:var(--good);">$${m.totalPendiente.toLocaleString('es-UY')}</span>
        <button class="smallbtn" onclick='marcarGrupoResuelto(${JSON.stringify(m.ids)}, "cobrado")'>Marcar cobrado</button>
      </div>
    </div>`;

  box.innerHTML = `
    <div class="helper" style="margin-bottom:10px;">${creditos.length} créditos leídos del extracto · ${exactos.length} coinciden exacto con cobros pendientes · ${conDiferencia.length} con diferencia · ${sinIdentificar.length} sin cuenta identificable.</div>
    ${exactos.length ? `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:10px 0 4px;">Coinciden exacto</h3>
        <button class="btn primary" onclick='marcarGrupoResuelto(${JSON.stringify(exactos.flatMap(m=>m.ids))}, "cobrado")'>Marcar todo como cobrado (${exactos.length})</button>
      </div>
      ${exactos.map(filaMatch).join('')}` : ''}
    ${conDiferencia.length ? `<h3 style="margin:14px 0 4px;">Con diferencia — revisar antes de marcar</h3>${conDiferencia.map(filaMatch).join('')}` : ''}
    ${sinIdentificar.length ? `
      <h3 style="margin:14px 0 4px;">Sin cuenta identificable — revisar a mano</h3>
      <div class="helper" style="margin-bottom:6px;">Movimientos tipo "CAMBIOS"/"VARIOS" u otros sin número de cuenta reconocible en el concepto.</div>
      ${sinIdentificar.map(c=>`<div class="agendarow" style="border-bottom:1px solid var(--line);">
        <div>${fmtFechaCortaFin(c.fecha)} · ${c.concepto||'(sin concepto)'}</div>
        <span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">$${c.monto.toLocaleString('es-UY')}</span>
      </div>`).join('')}` : ''}
    ${(!exactos.length && !conDiferencia.length && !sinIdentificar.length) ? '<div class="empty">No hay nada para conciliar en este extracto.</div>' : ''}
  `;
}

async function cargarJuguetesDeNinera(nombre){
  const box = document.getElementById('vn-juguetes');
  if(!box) return;
  const { data } = await sb.from('juguetes').select('nombre').eq('ninera_nombre', nombre);
  if(!data || !data.length) return;
  box.innerHTML = `
    <div style="margin-top:14px;background:var(--accent-soft);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--ink);cursor:pointer;" onclick="setModulo('juguetes'); setTimeout(()=>{ const s=document.getElementById('jug-filt-ninera'); if(s){ s.value='${nombre}'; filtrarJuguetes(); } }, 300);">
      ${data.length} juguete${data.length===1?'':'s'} en su casa: ${data.map(j=>j.nombre).join(', ')}
    </div>`;
}
