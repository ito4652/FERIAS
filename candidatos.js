/* Candidatos de ferias: fichas en una base de datos de Supabase y CV en un almacenamiento privado.
   Nada de esto pasa por GitHub: el repositorio es público, los datos de candidatos no.
   Requiere: supabase.min.js, candidatos-config.js y app.js (que expone window.CC). */
(function(){
'use strict';
var CC=window.CC;if(!CC)return;
var CFG=window.CAND_CONFIG||{};
var ic=CC.ic,esc=CC.esc,toast=CC.toast;
function $(id){return document.getElementById(id);}
function pad(n){return n<10?'0'+n:''+n;}
function lower(s){return String(s||'').toLowerCase();}
var ALERT_DAYS=+CFG.alertDays||30;
var configured=!!(CFG.supabaseUrl&&CFG.supabaseKey);
var BUCKET='cvs',TABLE='candidatos',MAX_MB=25;

var TIPOS=['Práctica','Trabajo'];
var ESTADOS=['Por contactar','Contactado','En proceso','Contratado','Descartado'];
var ESTADO_CLS={'Por contactar':'mat','Contactado':'ok','En proceso':'ok','Contratado':'ok','Descartado':'bad'};
var EVAL={'1':'★☆☆ Regular','2':'★★☆ Bueno','3':'★★★ Destacado'};
var monYear=new Intl.DateTimeFormat('es-CL',{month:'long',year:'numeric'});
var monShort=new Intl.DateTimeFormat('es-CL',{month:'short',year:'numeric'});

var I={
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'
};
function ci(name,size){size=size||18;return '<svg class="ic" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[name]+'</svg>';}

var S={status:configured?'starting':'unconfigured',user:null,items:[],error:'',loginErr:'',
  q:'',filtro:'todos',feria:'',edit:null,file:null,busy:false,delArmed:false,lastLoad:0};

/* ---------- Fechas de búsqueda (AAAA-MM) ---------- */
function ym(d){return d.getFullYear()+'-'+pad(d.getMonth()+1);}
function validYm(s){return /^\d{4}-(0[1-9]|1[0-2])$/.test(s||'');}
function ymDate(s){return new Date(+s.slice(0,4),+s.slice(5,7)-1,1);}
function monthTxt(s,short){return (short?monShort:monYear).format(ymDate(s)).replace(/\./g,'').replace(' de ',' ');}
/* now: ya empezó a buscar · soon: empieza dentro de ALERT_DAYS · later: más adelante · none: sin fecha */
function due(c){
  if(!validYm(c.buscaDesde))return 'none';
  var hoy=new Date(),cur=ym(hoy),lim=ym(new Date(hoy.getTime()+ALERT_DAYS*864e5));
  if(c.buscaDesde<=cur)return 'now';
  if(c.buscaDesde<=lim)return 'soon';
  return 'later';
}
function isAlert(c){var d=due(c);return c.estado==='Por contactar'&&(d==='now'||d==='soon');}
function alerts(){return S.items.filter(isAlert).sort(function(a,b){return a.buscaDesde<b.buscaDesde?-1:a.buscaDesde>b.buscaDesde?1:0;});}

/* ---------- Supabase ---------- */
var sb=null;
function errMsg(e){
  var code=e&&e.code,m=String((e&&e.message)||'');
  if(code==='PGRST205'||code==='42P01'||/does not exist|schema cache/i.test(m))return 'Falta preparar la base de datos: ejecuta el SQL del paso 2 de CANDIDATOS.md en Supabase.';
  if(code==='42501'||/row-level security|permission denied/i.test(m))return 'Tu cuenta no tiene permiso para ver o guardar candidatos. Solo funcionan cuentas @icb.cl creadas por el administrador.';
  if(/JWT|token/i.test(m))return 'La sesión expiró. Vuelve a iniciar sesión.';
  if(/payload too large|exceeded the maximum/i.test(m))return 'El archivo es demasiado grande. Usa un PDF de menos de '+MAX_MB+' MB.';
  if(!navigator.onLine)return 'Sin conexión. Los candidatos solo se ven con internet.';
  if(/fetch|network|Load failed/i.test(m))return 'No se pudo conectar con la base de datos. Si nadie usó la app en más de una semana, el proyecto de Supabase puede estar en pausa: entra a supabase.com y pulsa “Restore project”.';
  return 'No se pudo completar la operación ('+(m||'error desconocido')+').';
}
function chk(r){if(r&&r.error)throw r.error;return r?r.data:null;}
function init(){
  if(!configured){repaint();return;}
  if(!window.supabase||!window.supabase.createClient){S.status='error';S.error='No se pudo cargar la conexión con la base de datos. Revisa tu conexión y vuelve a abrir la app.';repaint();return;}
  sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'cand-auth'}});
  sb.auth.onAuthStateChange(function(ev,session){
    /* Se sale del callback antes de llamar a Supabase, como recomienda su documentación. */
    setTimeout(function(){
      var u=session&&session.user||null,was=S.user&&S.user.id;
      S.user=u;
      if(!u){S.items=[];S.status='idle';repaint();return;}
      if(ev==='INITIAL_SESSION'||ev==='SIGNED_IN'&&was!==u.id)loadAll();
    },0);
  });
}
function fromRow(r){
  return {id:r.id,nombre:r.nombre||'',feria:r.feria||'',feriaId:r.feria_id||'',universidad:r.universidad||'',carrera:r.carrera||'',
    tipo:r.tipo||'',buscaDesde:r.busca_desde||'',correo:r.correo||'',telefono:r.telefono||'',
    evaluacion:r.evaluacion==null?'':String(r.evaluacion),estado:r.estado||'Por contactar',notas:r.notas||'',
    cvPath:r.cv_path||'',cvNombre:r.cv_nombre||'',entrevistador:r.entrevistador||'',consentimiento:!!r.consentimiento,creado:r.creado||''};
}
function nul(v){return v===''||v==null?null:v;}
function toRow(c){
  return {nombre:c.nombre,feria:nul(c.feria),feria_id:nul(c.feriaId),universidad:nul(c.universidad),carrera:nul(c.carrera),tipo:nul(c.tipo),
    busca_desde:nul(c.buscaDesde),correo:nul(c.correo),telefono:nul(c.telefono),evaluacion:c.evaluacion===''?null:+c.evaluacion,
    estado:c.estado,notas:nul(c.notas),cv_path:nul(c.cvPath),cv_nombre:nul(c.cvNombre),entrevistador:nul(c.entrevistador),consentimiento:!!c.consentimiento};
}
async function loadAll(){
  S.lastLoad=Date.now();
  if(S.status!=='ok'){S.status='loading';repaint();}
  try{
    var rows=chk(await sb.from(TABLE).select('*').order('creado',{ascending:false}));
    S.items=(rows||[]).map(fromRow);S.status='ok';S.error='';
  }catch(e){S.status='error';S.error=errMsg(e);}
  repaint();
}
async function login(){
  var em=($('cl-email')||{}).value||'',pw=($('cl-pass')||{}).value||'';
  em=em.trim().toLowerCase();
  if(!em||!pw){S.loginErr='Escribe tu correo y tu contraseña.';render();return;}
  S.busy=true;S.loginErr='';render();
  try{
    var r=await sb.auth.signInWithPassword({email:em,password:pw});
    if(r.error)throw r.error;
    S.busy=false;
  }catch(e){
    S.busy=false;
    S.loginErr=/invalid login|credentials/i.test(e.message||'')?'Correo o contraseña incorrectos. Si olvidaste la contraseña, pide al administrador que la cambie.':errMsg(e);
    render();var p=$('cl-pass');if(p){p.value='';p.focus();}
  }
}
function logout(){if(sb)sb.auth.signOut();}
function myName(){
  var em=lower(S.user&&S.user.email);
  var p=CC.state.equipo.filter(function(x){return lower(x.correo)===em;})[0];
  return p?p.nombre:(S.user&&S.user.email||'');
}

/* ---------- CV ---------- */
function slug(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'sin-nombre';}
async function uploadCv(c,file){
  var ext=(/\.[a-z0-9]{1,5}$/i.exec(file.name)||[''])[0].toLowerCase();
  var path=slug(c.feria||'sin-feria')+'/'+Date.now().toString(36)+'-'+slug(c.nombre)+ext;
  chk(await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false}));
  return path;
}
async function removeCv(path){if(!path)return;try{await sb.storage.from(BUCKET).remove([path]);}catch(e){}}
async function openCv(path){
  /* La ventana se abre antes de pedir el enlace para que el navegador no la bloquee. */
  var w=window.open('','_blank');
  try{
    var d=chk(await sb.storage.from(BUCKET).createSignedUrl(path,600));
    if(w)w.location.href=d.signedUrl;else location.assign(d.signedUrl);
  }catch(e){if(w)w.close();toast(errMsg(e));}
}

/* ---------- Vista ---------- */
function stars(v){return v?'<span class="stars" title="'+esc(EVAL[v]||'')+'" aria-label="Evaluación '+v+' de 3">'+'★★★'.slice(0,+v)+'<span class="off">'+'★★★'.slice(+v)+'</span></span>':'';}
function buscaPill(c){
  var d=due(c);
  if(d==='none')return '<span class="pill mat none-mat">Sin fecha de búsqueda</span>';
  var txt=(d==='now'?(c.tipo?'Busca '+lower(c.tipo):'Buscando'):(c.tipo||'Búsqueda'))+' desde '+monthTxt(c.buscaDesde,true);
  return '<span class="pill '+(d==='later'?'mat':'warn')+'">'+esc(txt)+'</span>';
}
function row(c){
  var a=isAlert(c);
  var sub=[c.carrera,c.universidad].filter(Boolean).join(', ');
  var contact=(c.correo?'<a href="mailto:'+esc(c.correo)+'">'+ci('mail',14)+esc(c.correo)+'</a>':'')+
    (c.telefono?'<a href="tel:'+esc(c.telefono.replace(/[^\d+]/g,''))+'">'+ci('phone',14)+esc(c.telefono)+'</a>':'');
  var cv=c.cvPath?'<button class="iconbtn" data-act="c-cv" data-path="'+esc(c.cvPath)+'" title="Ver CV" aria-label="Ver CV de '+esc(c.nombre)+'">'+ci('file',17)+'</button>':'';
  return '<div class="row cand'+(a?' alert':'')+(c.estado==='Descartado'?' past':'')+'">'+
    '<div class="cn">'+CC.avatar(c.nombre||'?','lg')+'<div><div class="name">'+esc(c.nombre)+'</div>'+(sub?'<div class="csub">'+esc(sub)+'</div>':'')+'</div></div>'+
    '<div class="cf">'+(c.feria?'<span class="cline">'+ic('cal',14)+esc(c.feria)+'</span>':'')+(contact?'<span class="ccontact">'+contact+'</span>':'')+'</div>'+
    '<div class="cw">'+buscaPill(c)+'<span class="pill '+(ESTADO_CLS[c.estado]||'mat')+'">'+esc(c.estado)+'</span>'+stars(c.evaluacion)+
      (c.consentimiento?'':'<span class="pill bad" title="Falta registrar que el candidato autorizó guardar sus datos">Sin autorización</span>')+
      (a?'<button class="calbtn" data-act="c-contacted" data-id="'+esc(c.id)+'">'+ic('check',15)+'Marcar contactado</button>':'')+'</div>'+
    '<div class="act">'+cv+'<button class="iconbtn" data-act="c-edit" data-id="'+esc(c.id)+'" aria-label="Editar '+esc(c.nombre)+'" title="Editar">'+ic('pencil',17)+'</button></div>'+
    ((c.notas||c.entrevistador)?'<details class="notebox"><summary>Notas</summary><div class="notetext">'+esc(c.notas||'Sin notas.')+(c.entrevistador?'\n\nEntrevistó: '+esc(c.entrevistador):'')+'</div></details>':'')+
  '</div>';
}
function gate(icon,title,text,extra){
  return '<div class="empty"><div class="badge">'+icon+'</div><h2>'+title+'</h2><p>'+text+'</p>'+(extra||'')+'</div>';
}
function loginForm(){
  return gate(ci('lock',24),'Inicia sesión para ver los candidatos','Usa el correo y la contraseña que te dio el administrador. Solo el equipo puede ver los datos y CV de los postulantes.',
    '<form class="clogin" id="clogin" novalidate>'+
      '<label for="cl-email">Correo</label><input id="cl-email" type="email" autocomplete="username" placeholder="nombre@icb.cl" value="'+esc(S.lastEmail||'')+'">'+
      '<label for="cl-pass">Contraseña</label><input id="cl-pass" type="password" autocomplete="current-password">'+
      (S.loginErr?'<p class="cerr" role="alert">'+esc(S.loginErr)+'</p>':'')+
      '<button class="btn primary" type="submit"'+(S.busy?' disabled':'')+'>'+(S.busy?'Entrando…':'Iniciar sesión')+'</button></form>');
}
function render(){
  var el=$('panel-candidatos');if(!el)return;
  if(S.status==='unconfigured'){el.innerHTML=gate(ci('lock',24),'Falta conectar la base de datos','Completa candidatos-config.js con la dirección y la clave de tu proyecto de Supabase. Los pasos están en CANDIDATOS.md.');return;}
  if(S.status==='starting'||S.status==='loading'){el.innerHTML='<p class="none">Cargando candidatos…</p>';return;}
  if(S.status==='idle'){
    var em=$('cl-email');if(em)S.lastEmail=em.value;
    el.innerHTML=loginForm();return;
  }
  if(S.status==='error'){el.innerHTML=gate(ci('lock',24),'No se pudieron cargar los candidatos',esc(S.error),'<div class="adm-actions"><button class="btn primary" data-act="c-reload">'+ci('refresh',17)+'Reintentar</button><button class="btn" data-act="c-logout">Cerrar sesión</button></div>');return;}

  var al=alerts(),soon=al.filter(function(c){return due(c)==='soon';}).length;
  var stats='<div class="stats"><div class="stat"><div class="v">'+(al.length-soon)+'</div><div class="l">Ya están buscando</div></div>'+
    '<div class="stat"><div class="v">'+soon+'</div><div class="l">Empiezan en '+ALERT_DAYS+' días</div></div>'+
    '<div class="stat"><div class="v">'+S.items.length+'</div><div class="l">Candidatos registrados</div></div></div>';
  var ferias=[];S.items.forEach(function(c){if(c.feria&&ferias.indexOf(c.feria)<0)ferias.push(c.feria);});ferias.sort();
  if(S.feria&&ferias.indexOf(S.feria)<0)S.feria='';
  var chips=[['todos','Todos'],['alerta','Por contactar ahora'],['Práctica','Práctica'],['Trabajo','Trabajo']];
  var toolbar='<div class="toolbar">'+CC.searchBox('q-cand','Buscar por nombre, carrera o universidad',S.q,'Buscar candidatos')+
    (ferias.length?'<select id="c-feria-filter" class="cfilter" aria-label="Filtrar por feria"><option value="">Todas las ferias</option>'+ferias.map(function(f){return '<option'+(S.feria===f?' selected':'')+'>'+esc(f)+'</option>';}).join('')+'</select>':'')+
    '<button class="btn primary" data-act="c-new">'+ic('plus',17)+'Nuevo candidato</button></div>'+
    '<div class="fchips">'+chips.map(function(c){return '<button class="fchip" data-act="c-filter" data-v="'+c[0]+'" aria-pressed="'+(S.filtro===c[0])+'">'+c[1]+'</button>';}).join('')+'</div>';
  var q=lower(S.q);
  var list=S.items.filter(function(c){
    if(S.feria&&c.feria!==S.feria)return false;
    if(S.filtro==='alerta'&&!isAlert(c))return false;
    if((S.filtro==='Práctica'||S.filtro==='Trabajo')&&c.tipo!==S.filtro)return false;
    return !q||lower([c.nombre,c.carrera,c.universidad,c.feria,c.correo,c.notas].join(' ')).indexOf(q)>-1;
  });
  var byNew=function(a,b){return a.creado<b.creado?1:a.creado>b.creado?-1:0;};
  var body;
  if(!S.items.length){
    body=gate(ci('user',24),'Aún no hay candidatos','Registra a las personas que entrevistes en cada feria, con el mes en que empiezan a buscar. La app te avisará cuando sea momento de contactarlas.','<button class="btn primary" data-act="c-new">'+ic('plus',17)+'Registrar el primero</button>');
  }else if(!list.length){
    body='<p class="none">Ningún candidato coincide con la búsqueda.</p>';
  }else{
    var la=list.filter(isAlert).sort(function(a,b){return a.buscaDesde<b.buscaDesde?-1:1;});
    var pend=list.filter(function(c){return !isAlert(c)&&c.estado==='Por contactar';}).sort(function(a,b){
      var x=validYm(a.buscaDesde)?a.buscaDesde:'9999',y=validYm(b.buscaDesde)?b.buscaDesde:'9999';return x<y?-1:x>y?1:byNew(a,b);});
    var done=list.filter(function(c){return c.estado!=='Por contactar';}).sort(byNew);
    body='';
    if(la.length)body+='<div class="group-title">Por contactar ahora</div><div class="list">'+la.map(row).join('')+'</div>';
    if(pend.length)body+='<div class="group-title">Más adelante</div><div class="list">'+pend.map(row).join('')+'</div>';
    if(done.length)body+=(la.length||pend.length?'<details class="pastbox"><summary>Ya gestionados ('+done.length+')</summary><div class="list">'+done.map(row).join('')+'</div></details>':'<div class="list">'+done.map(row).join('')+'</div>');
  }
  var who='<div class="whoami">'+ci('lock',15)+'<span>Conectado como <b>'+esc(myName())+'</b></span>'+
    '<button class="linkbtn" data-act="c-reload">'+ci('refresh',14)+'Actualizar</button><button class="linkbtn" data-act="c-pass">Cambiar contraseña</button><button class="linkbtn" data-act="c-logout">Cerrar sesión</button></div>';
  CC.keepFocus('q-cand',stats+toolbar+'<div class="stack">'+body+'</div>'+who,el);
}
function inicioBlock(){
  if(!configured)return '';
  var head='<div class="blkhead"><h2>'+ci('bell',18)+'Candidatos por contactar</h2><button class="linkbtn" data-act="c-goto" data-v="todos">Ver todos</button></div>';
  var b;
  if(S.status==='idle')b='<p class="none">Inicia sesión para ver a quién toca contactar. <button class="linkbtn" data-act="c-goto" data-v="todos">Iniciar sesión</button></p>';
  else if(S.status==='starting'||S.status==='loading')b='<p class="none">Cargando…</p>';
  else if(S.status!=='ok')b='<p class="none">No disponible ahora. <button class="linkbtn" data-act="c-goto" data-v="todos">Ver detalle</button></p>';
  else{
    var al=alerts();
    if(!al.length)b='<p class="none">Nadie empieza a buscar en los próximos '+ALERT_DAYS+' días.</p>';
    else b='<div class="minilist">'+al.slice(0,4).map(function(c){
      return '<button class="mini" data-act="c-goto" data-v="alerta">'+CC.avatar(c.nombre,'lg')+
        '<div class="mtxt"><div class="mname">'+esc(c.nombre)+'</div><div class="msub">'+esc([c.tipo,c.carrera,c.feria].filter(Boolean).join(', '))+'</div></div>'+
        '<span class="pill warn">'+(due(c)==='now'?'Ya busca':'Desde '+esc(monthTxt(c.buscaDesde,true)))+'</span>'+ic('chev',16)+'</button>';
    }).join('')+'</div>'+(al.length>4?'<p class="none">+ '+(al.length-4)+' más por contactar</p>':'');
  }
  return '<section class="blk candblk">'+head+b+'</section>';
}
function badge(){return S.status==='ok'?(alerts().length||''):'';}
function repaint(){render();CC.renderTabs();CC.renderInicio();}

/* ---------- Formularios ---------- */
function fld(id,label,type,value,o){
  o=o||{};var input;
  if(type==='textarea')input='<textarea id="cf-'+id+'">'+esc(value)+'</textarea>';
  else if(type==='select')input='<select id="cf-'+id+'">'+(o.empty!=null?'<option value="">'+o.empty+'</option>':'')+o.options.map(function(k){return '<option value="'+esc(k[0])+'"'+(String(value)===String(k[0])?' selected':'')+'>'+esc(k[1])+'</option>';}).join('')+'</select>';
  else input='<input id="cf-'+id+'" type="'+type+'" value="'+esc(value)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.attrs?' '+o.attrs:'')+'>';
  return '<div class="fld'+(o.full?' full':'')+'"><label for="cf-'+id+'">'+label+'</label>'+input+(o.hint?'<span class="hint">'+o.hint+'</span>':'')+'</div>';
}
function cv(id){var e=$('cf-'+id);return e?e.value.trim():'';}
function defaultFeria(){
  var t=CC.todayStr();
  var past=CC.state.ferias.filter(function(f){return f.fecha&&f.fecha<=t&&f.estado!=='cancelada';}).sort(function(a,b){return a.fecha<b.fecha?1:-1;});
  return past[0]?past[0].id:'';
}
function feriaOptions(rec){
  var fs=CC.state.ferias.filter(function(f){return f.estado!=='cancelada';}).slice().sort(function(a,b){return (a.fecha||'')<(b.fecha||'')?1:-1;});
  var opts=fs.map(function(f){var d=CC.parseDate(f.fecha);return [f.id,f.nombre+(d?' ('+d.getDate()+'/'+(d.getMonth()+1)+')':'')];});
  if(rec.feria&&rec.feriaId&&!fs.some(function(f){return f.id===rec.feriaId;}))opts.unshift([rec.feriaId,rec.feria]);
  return opts;
}
function sheet(id,title,fields,actions){
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><form class="sheet" id="'+id+'" role="dialog" aria-modal="true" aria-labelledby="'+id+'-title" novalidate>'+
    '<h2 id="'+id+'-title">'+title+'</h2><div class="fields">'+fields+'</div><div class="ferr" id="cferr" role="alert"></div>'+
    '<div class="sheet-actions"><button class="btn primary" type="submit" id="c-save">Guardar</button><button class="btn" type="button" data-act="close">Cancelar</button>'+
    '<span class="sp"></span>'+(actions||'')+'</div></form></div>';
}
function openForm(id){
  var rec=id?(S.items.filter(function(c){return c.id===id;})[0]||{}):{};
  S.edit={id:id||null,rec:rec};S.file=null;S.delArmed=false;S.busy=false;
  var f=fld('nombre','Nombre completo','text',rec.nombre,{full:true})+
    fld('feria','Feria donde lo conocieron','select',id?(rec.feriaId||''):defaultFeria(),{full:true,options:feriaOptions(rec),empty:'Otra o sin feria'})+
    fld('universidad','Universidad','text',rec.universidad)+
    fld('carrera','Carrera','text',rec.carrera)+
    fld('tipo','Busca','select',rec.tipo||'Práctica',{options:TIPOS.map(function(t){return [t,t];})})+
    fld('buscaDesde','Empieza a buscar en','month',rec.buscaDesde,{ph:'AAAA-MM',attrs:'pattern="\\d{4}-\\d{2}"',hint:'Mes y año concretos, no “el próximo semestre”. Con esto se activa la alerta.'})+
    fld('correo','Correo','email',rec.correo,{attrs:'autocomplete="off"'})+
    fld('telefono','Teléfono','tel',rec.telefono,{ph:'+56 9 1234 5678'})+
    fld('evaluacion','Evaluación','select',rec.evaluacion||'',{empty:'Sin evaluar',options:[['1',EVAL['1']],['2',EVAL['2']],['3',EVAL['3']]]})+
    fld('estado','Estado','select',rec.estado||'Por contactar',{options:ESTADOS.map(function(t){return [t,t];})})+
    '<div class="fld full"><label for="cf-cv">CV</label>'+
      (rec.cvPath?'<div class="cvcur">'+ci('file',16)+'<button type="button" class="linkbtn" data-act="c-cv" data-path="'+esc(rec.cvPath)+'">'+esc(rec.cvNombre||'Ver CV actual')+'</button></div>':'')+
      '<input id="cf-cv" type="file" accept=".pdf,.doc,.docx,image/*">'+
      '<span class="hint" id="cf-cvhint">'+(rec.cvPath?'Si subes otro archivo, reemplaza al actual. ':'')+'PDF, Word o foto del CV, hasta '+MAX_MB+' MB.</span></div>'+
    fld('notas','Notas de la entrevista','textarea',rec.notas,{full:true})+
    '<div class="fld full"><label class="ckline"><input type="checkbox" id="cf-consent"'+(rec.consentimiento?' checked':'')+'><span>El candidato autorizó que guardemos sus datos y su CV para futuros procesos de selección.</span></label></div>';
  sheet('csheet',id?'Editar candidato':'Nuevo candidato',f,id?'<button class="btn danger" type="button" data-act="c-delete" id="c-del">Eliminar</button>':'');
  var n=$('cf-nombre');if(n)n.focus();
}
function openPass(){
  S.edit={pass:true};S.busy=false;
  sheet('cpass','Cambiar contraseña',
    fld('p1','Nueva contraseña','password','',{full:true,attrs:'autocomplete="new-password"',hint:'Al menos 8 caracteres.'})+
    fld('p2','Repite la nueva contraseña','password','',{full:true,attrs:'autocomplete="new-password"'}));
  $('cf-p1').focus();
}
function ferr(m){var e=$('cferr');if(e)e.textContent=m||'';}
function setBusy(on,label){S.busy=on;var b=$('c-save');if(b){b.disabled=on;b.textContent=on?(label||'Guardando…'):'Guardar';}}
async function save(){
  if(S.busy||!S.edit)return;
  var c=Object.assign({},S.edit.rec);
  c.nombre=cv('nombre');c.universidad=cv('universidad');c.carrera=cv('carrera');c.tipo=cv('tipo');
  c.buscaDesde=cv('buscaDesde');c.correo=cv('correo');c.telefono=cv('telefono');c.evaluacion=cv('evaluacion');
  c.estado=cv('estado')||'Por contactar';c.notas=cv('notas');c.consentimiento=!!($('cf-consent')&&$('cf-consent').checked);
  var fid=cv('feria'),fr=CC.state.ferias.filter(function(x){return x.id===fid;})[0];
  c.feriaId=fid;c.feria=fr?fr.nombre:(fid&&fid===S.edit.rec.feriaId?S.edit.rec.feria:'');
  if(!c.nombre){ferr('Escribe el nombre del candidato.');$('cf-nombre').focus();return;}
  if(c.buscaDesde&&!validYm(c.buscaDesde)){ferr('Escribe el mes como AAAA-MM, por ejemplo 2027-03.');$('cf-buscaDesde').focus();return;}
  if(c.correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.correo)){ferr('Revisa el correo: falta la @ o el dominio.');$('cf-correo').focus();return;}
  if(S.file&&S.file.size>MAX_MB*1024*1024){ferr('El CV pesa más de '+MAX_MB+' MB. Usa un PDF más liviano.');return;}
  if(!S.edit.id)c.entrevistador=myName();
  ferr('');
  var oldCv=S.edit.rec.cvPath,newCv='';
  try{
    if(S.file){
      setBusy(true,'Subiendo CV…');
      newCv=await uploadCv(c,S.file);c.cvPath=newCv;c.cvNombre=S.file.name;
    }
    setBusy(true,'Guardando…');
    var saved;
    if(S.edit.id){
      saved=fromRow(chk(await sb.from(TABLE).update(toRow(c)).eq('id',S.edit.id).select().single()));
      S.items=S.items.map(function(x){return x.id===saved.id?saved:x;});
    }else{
      saved=fromRow(chk(await sb.from(TABLE).insert(toRow(c)).select().single()));
      S.items.unshift(saved);
    }
    if(newCv&&oldCv)removeCv(oldCv);
    CC.closeSheet();S.edit=null;S.file=null;S.busy=false;
    toast('Candidato guardado');repaint();
  }catch(e){
    if(newCv)removeCv(newCv);
    setBusy(false);ferr(errMsg(e));
  }
}
async function savePass(){
  if(S.busy)return;
  var a=cv('p1'),b=cv('p2');
  if(a.length<8){ferr('La contraseña debe tener al menos 8 caracteres.');return;}
  if(a!==b){ferr('Las contraseñas no coinciden.');return;}
  setBusy(true,'Guardando…');
  try{
    var r=await sb.auth.updateUser({password:a});if(r.error)throw r.error;
    CC.closeSheet();S.edit=null;S.busy=false;toast('Contraseña cambiada');
  }catch(e){setBusy(false);ferr(/same|different/i.test(e.message||'')?'La nueva contraseña debe ser distinta de la actual.':/weak|short/i.test(e.message||'')?'Esa contraseña es muy débil. Usa una más larga.':errMsg(e));}
}
async function removeCand(){
  if(!S.edit||!S.edit.id||S.busy)return;
  var b=$('c-del');
  if(!S.delArmed){S.delArmed=true;if(b){b.textContent='¿Seguro? Se borra también el CV';b.classList.add('armed');}return;}
  var rec=S.edit.rec;S.busy=true;if(b){b.disabled=true;b.textContent='Eliminando…';}
  try{
    chk(await sb.from(TABLE).delete().eq('id',rec.id));
    await removeCv(rec.cvPath);
    S.items=S.items.filter(function(x){return x.id!==rec.id;});
    CC.closeSheet();S.edit=null;S.busy=false;toast('Candidato eliminado');repaint();
  }catch(e){S.busy=false;S.delArmed=false;if(b){b.disabled=false;b.textContent='Eliminar';b.classList.remove('armed');}ferr(errMsg(e));}
}
async function markContacted(id){
  var c=S.items.filter(function(x){return x.id===id;})[0];if(!c)return;
  try{
    chk(await sb.from(TABLE).update({estado:'Contactado'}).eq('id',id));
    c.estado='Contactado';toast(c.nombre+' marcado como contactado');repaint();
  }catch(e){toast(errMsg(e));}
}

/* ---------- Eventos ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;
  var act=b.getAttribute('data-act');if(act.indexOf('c-')!==0)return;
  if(act==='c-logout'){logout();return;}
  if(act==='c-reload'){loadAll();return;}
  if(act==='c-new'){openForm(null);return;}
  if(act==='c-edit'){openForm(b.getAttribute('data-id'));return;}
  if(act==='c-pass'){openPass();return;}
  if(act==='c-cv'){e.preventDefault();openCv(b.getAttribute('data-path'));return;}
  if(act==='c-delete'){removeCand();return;}
  if(act==='c-contacted'){markContacted(b.getAttribute('data-id'));return;}
  if(act==='c-filter'){S.filtro=b.getAttribute('data-v');render();return;}
  if(act==='c-goto'){S.filtro=b.getAttribute('data-v')||'todos';CC.setTab('candidatos');render();window.scrollTo(0,0);var em=$('cl-email');if(em)em.focus();return;}
});
/* Los formularios de candidatos se manejan aquí, no con el guardado de data.json de app.js. */
document.addEventListener('submit',function(e){
  var id=e.target&&e.target.id;
  if(id==='csheet'||id==='cpass'||id==='clogin'){
    e.preventDefault();e.stopPropagation();
    if(id==='csheet')save();else if(id==='cpass')savePass();else login();
  }
},true);
document.addEventListener('input',function(e){
  if(e.target.id==='q-cand'){S.q=e.target.value;render();}
  else if(e.target.id==='cl-email'){S.lastEmail=e.target.value;}
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='c-feria-filter'){S.feria=t.value;render();return;}
  if(t.id==='cf-cv'){
    S.file=t.files&&t.files[0]||null;
    var h=$('cf-cvhint');
    if(h&&S.file)h.textContent=S.file.size>MAX_MB*1024*1024?'Este archivo pesa más de '+MAX_MB+' MB.':'Se subirá: '+S.file.name+' ('+Math.max(1,Math.round(S.file.size/1024))+' KB).';
  }
});
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&S.status==='ok'&&Date.now()-S.lastLoad>60000)loadAll();
});

window.CandHooks={badge:badge,inicioBlock:inicioBlock,render:render};
repaint();
init();
})();
