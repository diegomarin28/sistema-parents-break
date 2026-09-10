/* ================= AUTH ================= */
let session = null;
let modoRecuperacion = false;
// Mientras esta bandera está en true, renderRoot() no pinta ni el login ni la app — se está
// mostrando la pantalla obligatoria de Face ID/Touch ID (registrar o confirmar), aunque ya
// haya una sesión válida de por medio (por contraseña o por refresh de token).
let faceidPendiente = false;
// Face ID / Touch ID vía Passkeys (WebAuthn): funciona en cualquier navegador/dispositivo
// moderno que lo soporte (iPhone con Face ID incluido). No manda ninguna foto/biometría a
// ningún servidor — la verificación queda 100% en el dispositivo, Supabase solo recibe la
// confirmación firmada de que pasó.
const PASSKEY_SOPORTADO = typeof window !== 'undefined' && !!window.PublicKeyCredential;
async function boot(){
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((event, s) => {
    session = s;
    if(event === 'SIGNED_IN') moduloActivo = null; // cada login nuevo arranca limpio en "Hoy"
    if(event === 'PASSWORD_RECOVERY') modoRecuperacion = true; // vino de un link de "olvidé mi contraseña"
    renderRoot();
  });
  renderRoot();
}
function renderRoot(){
  if(faceidPendiente) return; // ya se está mostrando la pantalla de Face ID, no la pisamos
  if(modoRecuperacion){ renderNuevaContrasena(); return; }
  if(!session){ renderLogin(); return; }
  renderApp();
}
function renderLogin(){
  document.getElementById('app').innerHTML = `
    <div class="loginstage">
      <div class="loginbrand">
        <div class="blob blob-a"></div>
        <div class="blob blob-b"></div>
        <img src="logo.png" alt="Parents Break" class="loginbrand-logo">
        <h1>El día a día de tu equipo, en un solo lugar.</h1>
        <p>Candidatas, entrevistas, niñeras activas y tarifas por familia — todo conectado, sin planillas sueltas.</p>
      </div>
      <div class="loginformside">
        <div class="loginwrap">
          <h2>Bienvenida de vuelta</h2>
          <div class="helper">Entrá con tu cuenta de equipo. Se pide Face ID/Touch ID siempre, aunque uses contraseña.</div>
          ${PASSKEY_SOPORTADO ? `
          <button class="btn" type="button" id="passkeybtn" style="width:100%;margin-bottom:14px;" onclick="entrarConPasskey()">
            <span id="passkeybtn-label">Entrar con Face ID / Touch ID</span>
          </button>
          <div style="display:flex;align-items:center;gap:10px;margin:2px 0 16px;">
            <div style="flex:1;height:1px;background:var(--line);"></div>
            <span class="helper" style="margin:0;">o con mail y contraseña</span>
            <div style="flex:1;height:1px;background:var(--line);"></div>
          </div>` : ''}
          <div class="field">
            <label>Mail</label>
            <div class="inputicon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
              <input type="email" id="login-mail">
            </div>
          </div>
          <div class="field">
            <label>Contraseña</label>
            <div class="inputicon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/></svg>
              <input type="password" id="login-pass">
            </div>
          </div>
          <div style="text-align:right;margin:-8px 0 16px;">
            <a href="#" onclick="event.preventDefault();abrirRecuperarPassword();" style="font-size:12.5px;color:var(--accent);">¿Olvidaste tu contraseña?</a>
          </div>
          <label class="chk" style="margin-bottom:16px;"><input type="checkbox" id="login-recordar" checked> Recordarme en este dispositivo</label>
          <button class="btn primary" id="loginbtn" style="width:100%;" onclick="login()"><span id="loginbtn-label">Entrar</span></button>
          <div id="loginwarn"></div>
        </div>
      </div>
    </div>`;
  document.getElementById('login-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') login(); });
}
async function login(){
  const email = document.getElementById('login-mail').value.trim();
  const password = document.getElementById('login-pass').value;
  const recordar = document.getElementById('login-recordar').checked;
  const btn = document.getElementById('loginbtn');
  btn.disabled = true;
  document.getElementById('loginbtn-label').innerHTML = `<span class="spinner"></span> Entrando…`;
  // Se levanta la bandera ANTES de terminar el login para que, apenas Supabase disponga el
  // evento SIGNED_IN, renderRoot() no llegue a mostrar la app ni una fracción de segundo
  // antes de pedir Face ID/Touch ID.
  if(PASSKEY_SOPORTADO) faceidPendiente = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error){
    faceidPendiente = false;
    btn.disabled = false;
    document.getElementById('loginbtn-label').textContent = 'Entrar';
    document.getElementById('loginwarn').innerHTML = `<div class="warnbox">${error.message==='Invalid login credentials' ? 'Mail o contraseña incorrectos.' : error.message}</div>`;
    return;
  }
  if(!recordar){ window.addEventListener('beforeunload', ()=>{ sb.auth.signOut(); }); }
  if(PASSKEY_SOPORTADO){ await exigirConfirmacionBiometrica(); }
}
async function entrarConPasskey(){
  const btn = document.getElementById('passkeybtn');
  if(btn){ btn.disabled = true; document.getElementById('passkeybtn-label').innerHTML = `<span class="spinner"></span> Verificando…`; }
  // Entrar directo con Face ID/Touch ID ya cumple por sí solo el requisito de biometría
  // obligatoria — no hace falta pasar por la pantalla de confirmación de abajo.
  const { error } = await sb.auth.signInWithPasskey();
  if(error){
    if(btn){ btn.disabled = false; document.getElementById('passkeybtn-label').textContent = 'Entrar con Face ID / Touch ID'; }
    const warn = document.getElementById('loginwarn');
    if(warn) warn.innerHTML = `<div class="warnbox">No se pudo entrar con Face ID / Touch ID en este dispositivo — entrá con mail y contraseña de abajo (te va a volver a pedir la confirmación igual).</div>`;
  }
}
// Se llama siempre después de un login con contraseña exitoso (si el navegador soporta
// passkeys). Contraseña sola ya NO alcanza para entrar — decisión explícita de Diego.
async function exigirConfirmacionBiometrica(){
  const { data: passkeys } = await sb.auth.passkey.list();
  if(!passkeys || !passkeys.length){
    // Esta cuenta no tiene ninguna Face ID/Touch ID activada todavía, en ningún
    // dispositivo — se activa ahora mismo, de forma obligatoria.
    renderPantallaBiometrica('registrar');
  } else {
    // Ya existe al menos una passkey para la cuenta (acá o en otro dispositivo) —
    // se exige confirmarla en ESTE dispositivo antes de entrar.
    renderPantallaBiometrica('confirmar');
  }
}
function renderPantallaBiometrica(modo){
  document.getElementById('app').innerHTML = `
    <div class="loginstage">
      <div class="loginbrand">
        <div class="blob blob-a"></div>
        <div class="blob blob-b"></div>
        <img src="logo.png" alt="Parents Break" class="loginbrand-logo">
        <h1>Un paso más.</h1>
        <p>${modo==='registrar' ? 'Confirmá tu identidad con Face ID o Touch ID para terminar de entrar. Solo hace falta la primera vez en cada dispositivo.' : 'Confirmá con Face ID o Touch ID para terminar de entrar en este dispositivo.'}</p>
      </div>
      <div class="loginformside">
        <div class="loginwrap" style="text-align:center;">
          <h2>${modo==='registrar' ? 'Activar Face ID / Touch ID' : 'Confirmá que sos vos'}</h2>
          <div class="helper" style="margin-bottom:20px;">${modo==='registrar' ? 'Tu cuenta todavía no tiene ninguna activada — es obligatorio para poder entrar.' : 'Tu cuenta ya tiene Face ID/Touch ID activado — confirmalo en este dispositivo.'}</div>
          <button class="btn primary" id="bio-btn" style="width:100%;margin-bottom:12px;" onclick="${modo==='registrar' ? 'confirmarRegistroBiometria()' : 'confirmarLoginBiometria()'}">
            <span id="bio-btn-label">${modo==='registrar' ? 'Activar ahora' : 'Confirmar con Face ID / Touch ID'}</span>
          </button>
          <button class="btn ghost" style="width:100%;" onclick="cancelarBiometria()">Cancelar y volver al login</button>
          <div id="bio-warn"></div>
        </div>
      </div>
    </div>`;
}
async function confirmarRegistroBiometria(){
  const btn = document.getElementById('bio-btn');
  btn.disabled = true;
  document.getElementById('bio-btn-label').innerHTML = `<span class="spinner"></span> Confirmando…`;
  const { error } = await sb.auth.registerPasskey();
  if(error){
    btn.disabled = false;
    document.getElementById('bio-btn-label').textContent = 'Activar ahora';
    document.getElementById('bio-warn').innerHTML = `<div class="warnbox">${error.message} — probá de nuevo.</div>`;
    return;
  }
  faceidPendiente = false;
  toast('Face ID / Touch ID activado.');
  renderRoot();
}
async function confirmarLoginBiometria(){
  const btn = document.getElementById('bio-btn');
  btn.disabled = true;
  document.getElementById('bio-btn-label').innerHTML = `<span class="spinner"></span> Confirmando…`;
  const { error } = await sb.auth.signInWithPasskey();
  if(error){
    btn.disabled = false;
    document.getElementById('bio-btn-label').textContent = 'Confirmar con Face ID / Touch ID';
    // IMPORTANTE, no tocar: acá NO se ofrece registrar una passkey nueva aunque este
    // dispositivo en particular no tenga ninguna guardada. Si se ofreciera, alcanzaría con
    // robar el mail y la contraseña para activar una cara/huella cualquiera y entrar del
    // todo — justo lo que esto tiene que evitar. Agregar un dispositivo nuevo solo se puede
    // hacer desde adentro de la app (menú → "Face ID / Touch ID"), con una sesión que ya
    // pasó por esta misma pantalla en otro dispositivo.
    const noHayEnEsteDispositivo = /not.?found|no.?credential/i.test(error.message||'');
    document.getElementById('bio-warn').innerHTML = noHayEnEsteDispositivo
      ? `<div class="warnbox">Este dispositivo no tiene Face ID/Touch ID activado para tu cuenta. Activalo desde un dispositivo donde ya lo tengas (menú → "Face ID / Touch ID" → "+ Activar en este dispositivo"). Si perdiste el acceso a todos tus dispositivos con Face ID, pedile a Diego que te ayude.</div>`
      : `<div class="warnbox">${error.message} — probá de nuevo.</div>`;
    return;
  }
  faceidPendiente = false;
  renderRoot();
}
function cancelarBiometria(){
  faceidPendiente = false;
  sb.auth.signOut();
}
async function registrarPasskeyDispositivo(){
  const { error } = await sb.auth.registerPasskey();
  cerrarModal();
  if(error){ toast('No se pudo activar: '+error.message, 'bad'); return; }
  toast('Face ID / Touch ID activado en este dispositivo.');
}
async function gestionarPasskeys(){
  abrirModal(`<h2 style="margin:0 0 10px;">Face ID / Touch ID</h2><div id="passkeys-list"><div class="empty"><span class="spinner dark"></span> Cargando…</div></div>`);
  const { data: passkeys, error } = await sb.auth.passkey.list();
  const cont = document.getElementById('passkeys-list');
  if(!cont) return; // se cerró el modal mientras cargaba
  if(error){ cont.innerHTML = errBox(error); return; }
  cont.innerHTML = `
    <div class="helper" style="margin-bottom:12px;">Dispositivos con Face ID/Touch ID activado para tu cuenta. Borrá los que ya no uses (por ejemplo, un celular viejo).</div>
    ${!passkeys || !passkeys.length ? '<div class="empty">Todavía no activaste ninguno.</div>' : passkeys.map(p=>`
      <div class="agendarow" style="border-bottom:1px solid var(--line);padding:8px 0;align-items:center;">
        <div style="flex:1;">
          <div>${p.friendly_name || 'Dispositivo'}</div>
          <div class="helper" style="margin:0;">Activado ${new Date(p.created_at).toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
        <button class="smallbtn" style="color:var(--bad);border-color:var(--bad);" onclick="eliminarPasskey('${p.id}')">Borrar</button>
      </div>`).join('')}
    <button class="btn" type="button" style="width:100%;margin-top:14px;" onclick="registrarPasskeyDispositivo()">+ Activar en este dispositivo</button>`;
}
async function eliminarPasskey(id){
  if(!(await confirmarAccion('¿Borrar este Face ID/Touch ID? Ese dispositivo va a tener que entrar con contraseña.'))) return;
  const { error } = await sb.auth.passkey.delete({ passkeyId: id });
  if(error){ toast('No se pudo borrar: '+error.message, 'bad'); return; }
  toast('Borrado.');
  gestionarPasskeys();
}
/* ---- Recuperar contraseña ---- */
function abrirRecuperarPassword(){
  const emailPrellenado = document.getElementById('login-mail')?.value.trim() || '';
  abrirModal(`
    <h2 style="margin:0 0 10px;">Recuperar contraseña</h2>
    <div class="helper" style="margin-bottom:14px;">Si ese mail está registrado en el sistema, le va a llegar un link para elegir una contraseña nueva.</div>
    <div class="field"><label>Mail</label><input type="email" id="rec-mail" value="${emailPrellenado}"></div>
    <div id="rec-warn"></div>
    <div class="confirmbtns" style="margin-top:16px;">
      <button class="btn ghost" onclick="cerrarModal()">Cancelar</button>
      <button class="btn primary" id="rec-btn" onclick="enviarRecuperacion()"><span id="rec-btn-label">Enviar link</span></button>
    </div>`);
}
async function enviarRecuperacion(){
  const email = document.getElementById('rec-mail').value.trim();
  if(!email){ document.getElementById('rec-warn').innerHTML = `<div class="warnbox">Escribí un mail.</div>`; return; }
  const btn = document.getElementById('rec-btn');
  btn.disabled = true;
  document.getElementById('rec-btn-label').innerHTML = `<span class="spinner"></span> Enviando…`;
  // Ojo: no avisamos acá si el mail existe o no en el sistema — Supabase responde igual en
  // los dos casos a propósito, así nadie puede usar este formulario para descubrir qué mails
  // están registrados en la cuenta.
  await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0].split('?')[0] });
  cerrarModal();
  toast('Si ese mail está registrado, le va a llegar un link para elegir una contraseña nueva. Revisá también la carpeta de spam.');
}
function renderNuevaContrasena(){
  document.getElementById('app').innerHTML = `
    <div class="loginstage">
      <div class="loginbrand">
        <div class="blob blob-a"></div>
        <div class="blob blob-b"></div>
        <img src="logo.png" alt="Parents Break" class="loginbrand-logo">
        <h1>El día a día de tu equipo, en un solo lugar.</h1>
        <p>Candidatas, entrevistas, niñeras activas y tarifas por familia — todo conectado, sin planillas sueltas.</p>
      </div>
      <div class="loginformside">
        <div class="loginwrap">
          <h2>Elegí una contraseña nueva</h2>
          <div class="helper">Se aplica a tu cuenta ahora mismo, no hace falta la contraseña vieja.</div>
          <div class="field">
            <label>Contraseña nueva</label>
            <div class="inputicon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/></svg>
              <input type="password" id="np-pass1">
            </div>
          </div>
          <div class="field">
            <label>Repetila</label>
            <div class="inputicon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V7a4 4 0 018 0v3.5"/></svg>
              <input type="password" id="np-pass2">
            </div>
          </div>
          <button class="btn primary" id="np-btn" style="width:100%;" onclick="guardarNuevaContrasena()"><span id="np-btn-label">Guardar contraseña</span></button>
          <div id="np-warn"></div>
        </div>
      </div>
    </div>`;
}
async function guardarNuevaContrasena(){
  const p1 = document.getElementById('np-pass1').value;
  const p2 = document.getElementById('np-pass2').value;
  const warn = document.getElementById('np-warn');
  if(p1.length < 8){ warn.innerHTML = `<div class="warnbox">La contraseña tiene que tener al menos 8 caracteres.</div>`; return; }
  if(p1 !== p2){ warn.innerHTML = `<div class="warnbox">Las dos contraseñas no coinciden.</div>`; return; }
  const btn = document.getElementById('np-btn');
  btn.disabled = true;
  document.getElementById('np-btn-label').innerHTML = `<span class="spinner"></span> Guardando…`;
  const { error } = await sb.auth.updateUser({ password: p1 });
  if(error){
    btn.disabled = false;
    document.getElementById('np-btn-label').textContent = 'Guardar contraseña';
    warn.innerHTML = `<div class="warnbox">${error.message}</div>`;
    return;
  }
  modoRecuperacion = false;
  toast('Contraseña actualizada.');
  renderRoot();
}
async function logout(){ await sb.auth.signOut(); }

