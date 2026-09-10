/* ================= AUTH ================= */
let session = null;
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
    renderRoot();
  });
  renderRoot();
}
function renderRoot(){
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
          <div class="helper">Entrá con tu cuenta de equipo.</div>
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
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error){
    btn.disabled = false;
    document.getElementById('loginbtn-label').textContent = 'Entrar';
    document.getElementById('loginwarn').innerHTML = `<div class="warnbox">${error.message==='Invalid login credentials' ? 'Mail o contraseña incorrectos.' : error.message}</div>`;
    return;
  }
  if(!recordar){ window.addEventListener('beforeunload', ()=>{ sb.auth.signOut(); }); }
  if(PASSKEY_SOPORTADO) ofrecerActivarPasskey();
}
async function entrarConPasskey(){
  const btn = document.getElementById('passkeybtn');
  if(btn){ btn.disabled = true; document.getElementById('passkeybtn-label').innerHTML = `<span class="spinner"></span> Verificando…`; }
  const { error } = await sb.auth.signInWithPasskey();
  if(error){
    if(btn){ btn.disabled = false; document.getElementById('passkeybtn-label').textContent = 'Entrar con Face ID / Touch ID'; }
    // el usuario canceló el prompt, o este dispositivo/cuenta todavía no tiene ninguna
    // passkey activada — no es un error real, solo mostramos un aviso suave y seguimos
    // mostrando el formulario de mail/contraseña de abajo como siempre.
    const warn = document.getElementById('loginwarn');
    if(warn) warn.innerHTML = `<div class="warnbox">No se pudo entrar con Face ID / Touch ID en este dispositivo — entrá con mail y contraseña, y después lo podés activar.</div>`;
  }
}
// Después de un login con contraseña exitoso, si esta cuenta todavía no tiene ninguna
// passkey activada en NINGÚN dispositivo, le ofrecemos activarla en este. No es obligatorio
// (nunca bloqueamos el acceso si Face ID falla o no está activado) — solo una sugerencia.
async function ofrecerActivarPasskey(){
  try{
    const { data: passkeys } = await sb.auth.passkey.list();
    if(passkeys && passkeys.length) return; // ya tiene alguna activada, en este u otro dispositivo
  }catch(e){ return; }
  abrirModal(`
    <h2 style="margin:0 0 10px;">¿Activar Face ID / Touch ID?</h2>
    <div class="helper" style="margin-bottom:16px;">La próxima vez podés entrar mirando el celular, sin escribir la contraseña. Se puede desactivar cuando quieras desde "Face ID / Touch ID" abajo del menú.</div>
    <div class="confirmbtns">
      <button class="btn ghost" onclick="cerrarModal()">Ahora no</button>
      <button class="btn primary" onclick="registrarPasskeyDispositivo()">Activar</button>
    </div>`);
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
async function logout(){ await sb.auth.signOut(); }

