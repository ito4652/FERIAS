/* Sesión compartida por toda la app: crea la conexión con Supabase y muestra la pantalla de ingreso.
   Mientras no haya sesión, el contenido de la app queda oculto (clase "locked" en <html>)
   y, además, la base de datos no entrega nada sin una cuenta @icb.cl válida. */
(function(){
'use strict';
var CFG=window.CAND_CONFIG||{};
var root=document.documentElement;
var st={user:null,ready:false,cbs:[],err:'',busy:false,email:''};
var sb=null;
if(window.supabase&&window.supabase.createClient&&CFG.supabaseUrl&&CFG.supabaseKey){
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'cand-auth'}});
}
window.SB=sb;

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var lockIc='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';

var gate=document.createElement('div');gate.id='gate';gate.className='gate';
document.body.insertBefore(gate,document.body.firstChild);

function paint(){
  if(st.user){gate.innerHTML='';root.classList.remove('locked');return;}
  root.classList.add('locked');
  var body;
  if(!sb)body='<h2>Falta la configuración</h2><p>No se pudo conectar con la base de datos. Revisa tu conexión y vuelve a abrir la app.</p>';
  else if(!st.ready)body='<p class="gate-wait">Comprobando sesión…</p>';
  else body='<h2>Inicia sesión</h2><p>Usa el correo @icb.cl y la contraseña que te dio el administrador.</p>'+
    '<form class="clogin" id="gate-form" novalidate>'+
      '<label for="g-email">Correo</label><input id="g-email" type="email" autocomplete="username" placeholder="nombre@icb.cl" value="'+esc(st.email)+'">'+
      '<label for="g-pass">Contraseña</label><input id="g-pass" type="password" autocomplete="current-password">'+
      (st.err?'<p class="cerr" role="alert">'+esc(st.err)+'</p>':'')+
      '<button class="btn primary" type="submit"'+(st.busy?' disabled':'')+'>'+(st.busy?'Entrando…':'Iniciar sesión')+'</button></form>';
  gate.innerHTML='<div class="gate-card"><div class="gate-brand"><div class="brand">'+lockIc+'</div><div><h1>Centro de control Selección</h1><p class="sub">Acceso solo para el equipo.</p></div></div>'+
    '<div class="empty gate-box">'+body+'</div></div>';
  var f=document.getElementById(st.email?'g-pass':'g-email');if(f&&st.ready)f.focus();
}
async function signIn(){
  var em=(document.getElementById('g-email')||{}).value||'',pw=(document.getElementById('g-pass')||{}).value||'';
  st.email=em.trim().toLowerCase();
  if(!st.email||!pw){st.err='Escribe tu correo y tu contraseña.';paint();return;}
  st.busy=true;st.err='';paint();
  var r;try{r=await sb.auth.signInWithPassword({email:st.email,password:pw});}catch(e){r={error:e};}
  st.busy=false;
  if(r.error){
    var m=String(r.error.message||'');
    st.err=/invalid login|credentials/i.test(m)?'Correo o contraseña incorrectos. Si olvidaste la contraseña, pide al administrador que la cambie.':
      /fetch|network|load failed/i.test(m)||!navigator.onLine?'No se pudo conectar. Revisa tu internet. Si nadie usó la app en más de una semana, el administrador debe reactivar el proyecto en supabase.com.':
      'No se pudo iniciar sesión ('+m+').';
    paint();
  }
}
/* Al cerrar sesión se borran las copias locales de datos de este navegador. */
function clearLocal(){
  try{['datos-cache','ferias-borrador-v1'].forEach(function(k){localStorage.removeItem(k);});}catch(e){}
}
async function signOut(){clearLocal();if(sb)await sb.auth.signOut();}

document.addEventListener('submit',function(e){
  if(e.target&&e.target.id==='gate-form'){e.preventDefault();e.stopPropagation();signIn();}
},true);
document.addEventListener('input',function(e){if(e.target.id==='g-email')st.email=e.target.value;});

window.Sesion={
  get user(){return st.user;},
  get email(){return st.user&&st.user.email||'';},
  on:function(cb){st.cbs.push(cb);if(st.ready)cb(st.user);},
  signOut:signOut
};

paint();
if(sb){
  sb.auth.onAuthStateChange(function(ev,session){
    /* Se sale del callback antes de llamar a Supabase, como recomienda su documentación. */
    setTimeout(function(){
      var u=session&&session.user||null,prev=st.user&&st.user.id,first=!st.ready;
      st.user=u;st.ready=true;
      if(!u)clearLocal();
      paint();
      if(first||(u&&u.id)!==prev)st.cbs.forEach(function(cb){cb(u);});
    },0);
  });
}
})();
