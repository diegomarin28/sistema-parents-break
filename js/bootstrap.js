boot();
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(()=>{}); }

/* ---- Deslizar desde el borde izquierdo para abrir el menú (solo mobile) ---- */
let swipeStartX = null, swipeStartY = null;
document.addEventListener('touchstart', (e) => {
  if (window.innerWidth > 760) { swipeStartX = null; return; }
  const t = e.touches[0];
  if (t.clientX < 24 && !document.getElementById('sidebar')?.classList.contains('open')) {
    swipeStartX = t.clientX; swipeStartY = t.clientY;
  } else { swipeStartX = null; }
}, {passive:true});
document.addEventListener('touchend', (e) => {
  if (swipeStartX === null) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipeStartX;
  const dy = Math.abs(t.clientY - swipeStartY);
  if (dx > 60 && dy < 60) toggleSidebarMobile(true);
  swipeStartX = null;
}, {passive:true});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sessionStorage.setItem('pb_hidden_at', String(Date.now()));
    return;
  }
  const hiddenAt = Number(sessionStorage.getItem('pb_hidden_at') || 0);
  const estuvoRatoAfuera = hiddenAt && (Date.now() - hiddenAt > 10 * 60 * 1000); // más de 10 minutos en background
  // Antes esto hacía un refresh forzado de la página (location.replace) -- Delfina perdió una
  // entrevista completa dos veces por esto (volvía de Meet, o el teléfono se bloqueaba un
  // rato, y al volver se borraba todo sin avisar). Se cambió el 22/09/2026 por un aviso que
  // la persona elige tocar o no -- sigue avisando que puede haber datos viejos, pero ya no
  // destruye nada solo.
  if (estuvoRatoAfuera) mostrarAvisoVolviste();
});
function mostrarAvisoVolviste(){
  if(document.getElementById('aviso-volviste')) return; // ya está mostrado, no duplicar
  const el = document.createElement('div');
  el.id = 'aviso-volviste';
  el.innerHTML = `
    <span>Volviste después de un rato — si algo se ve viejo, actualizá.</span>
    <button type="button" onclick="location.replace(location.pathname + '?_=' + Date.now())">Actualizar</button>
    <button type="button" class="aviso-volviste-cerrar" onclick="document.getElementById('aviso-volviste')?.remove()" aria-label="Cerrar">✕</button>
  `;
  document.body.appendChild(el);
}

