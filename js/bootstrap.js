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
  const estuvoRatoAfuera = hiddenAt && (Date.now() - hiddenAt > 2 * 60 * 1000); // más de 2 minutos en background
  if (estuvoRatoAfuera && !document.querySelector('.confirmoverlay.show')) {
    location.replace(location.pathname + '?_=' + Date.now());
  }
});

