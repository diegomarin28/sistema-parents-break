/* ================= AUTH ================= */
let session = null;
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
}
async function logout(){ await sb.auth.signOut(); }

