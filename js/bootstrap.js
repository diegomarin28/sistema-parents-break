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

/* Antes había acá un refresh forzado de la página si estuvo más de 2 minutos en segundo
   plano (visibilitychange), para evitar datos viejos en pantalla. Se sacó el 22/09/2026:
   Delfina perdió una entrevista completa (texto tipeado, notas) dos veces por esto — volvía
   de Meet o el teléfono se bloqueaba un rato, y al volver el refresh forzado borraba todo sin
   avisar. El riesgo de perder trabajo de verdad pesa más que el de ver un dato desactualizado
   un rato, así que no se reemplazó por nada — si hace falta, la mayoría de los módulos ya
   traen datos frescos solos al volver a entrar, o vía Realtime. */

