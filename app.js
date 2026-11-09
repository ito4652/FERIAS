(function(){
'use strict';
/* Modo "view": solo lectura (index.html). Modo "admin": edita en el navegador y publica en Supabase (admin.html). */
var ADMIN=document.documentElement.getAttribute('data-mode')==='admin';
var DRAFT_KEY='ferias-borrador-v1';
var state={sub:'calendario',jornadas:[],jpq:{},ferias:[],contactos:[],cumpleanos:[],avisos:[],plataformas:[],eventosdo:[],equipo:[],pq:'',dq:'',eq:'',status:'loading',published:'',updated:'',tab:'inicio',q:'',estado:'todos',cq:'',cuq:'',
  edit:null,armed:false,discardArmed:false,lastLoad:0};
var ESTADOS={confirmada:['Confirmada','ok'],porconfirmar:['Por confirmar','warn'],cancelada:['Cancelada','bad']};
var MATERIALES={pendon:'Pendón',stand:'Stand',nada:'Nada'};
state.openNotes={};
var wdFmt=new Intl.DateTimeFormat('es-CL',{weekday:'short'});
var monFmt=new Intl.DateTimeFormat('es-CL',{month:'short'});
var fullDay=new Intl.DateTimeFormat('es-CL',{weekday:'long',day:'numeric',month:'long'});
var shortFmt=new Intl.DateTimeFormat('es-CL',{weekday:'short',day:'numeric',month:'short'});
var fullFmt=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});

var P={
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  pencil:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin:'<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  book:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  down:'<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  calplus:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M12 13v4M10 15h4"/>',
  cake:'<path d="M4 21h16"/><path d="M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 17c2 1.5 3.5 1.5 5 0s3-1.5 4.5 0 3 1.5 4.500 0"/><path d="M12 12V9"/><path d="M12 6.5c.8-.8.8-1.6 0-2.5-.8.9-.8 1.7 0 2.5z"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  megaphone:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  chev:'<path d="m9 6 6 6-6 6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>'
};
function ic(name,size){size=size||18;return '<svg class="ic" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P[name]+'</svg>';}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pad(n){return n<10?'0'+n:''+n;}
function todayStr(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parseDate(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
function lower(s){return String(s||'').toLowerCase();}
function $(id){return document.getElementById(id);}
function hue(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h;}
function initials(s){var p=String(s).trim().split(/\s+/);var a=(p[0]||'?').charAt(0).toUpperCase();var b=p.length>1?p[p.length-1].charAt(0).toUpperCase():'';return a+b;}
function avatar(name,cls){return '<span class="av '+(cls||'')+'" style="--h:'+hue(String(name))+'" aria-hidden="true">'+esc(initials(name))+'</span>';}
function newId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function canon(v){if(Array.isArray(v))return v.map(canon);if(v&&typeof v==='object'){var o={};Object.keys(v).sort().forEach(function(k){o[k]=canon(v[k]);});return o;}return v;}
function byId(a,b){return a.id<b.id?-1:a.id>b.id?1:0;}
function sig(){
  var o={ferias:state.ferias.slice().sort(byId),contactos:state.contactos.slice().sort(byId)};
  /* Solo se incluye si hay cumpleaños, para no invalidar borradores anteriores a esta sección. */
  if(state.cumpleanos.length) o.cumpleanos=state.cumpleanos.slice().sort(byId);
  if(state.avisos.length) o.avisos=state.avisos.slice().sort(byId);
  if(state.plataformas.length) o.plataformas=state.plataformas.slice().sort(byId);
  if(state.eventosdo.length) o.eventosdo=state.eventosdo.slice().sort(byId);
  if(state.equipo.length) o.equipo=state.equipo.slice().sort(byId);
  if(state.jornadas.length) o.jornadas=state.jornadas.slice().sort(byId);
  return JSON.stringify(canon(o));
}
function isDirty(){return ADMIN&&state.status==='ok'&&sig()!==state.published;}
function norm(arr){return (Array.isArray(arr)?arr:[]).filter(function(r){return r&&typeof r==='object';}).map(function(r){if(!r.id)r.id=newId();return r;});}

try{var saved=localStorage.getItem('ferias-tab');if(saved==='inicio'||saved==='ferias'||saved==='cumpleanos'||saved==='plataformas'||saved==='do'||saved==='equipo'||saved==='jp')state.tab=saved;else if(saved==='candidatos'){state.tab='ferias';state.sub='candidatos';}else if(saved==='contactos'){state.tab='ferias';state.sub='directorio';}
  var ssub=localStorage.getItem('ferias-sub');if(ssub==='calendario'||ssub==='directorio'||ssub==='asistencia'||ssub==='candidatos')state.sub=ssub;}catch(e){}
$('brand').innerHTML=ic('cal',24);
if(!$('panel-inicio')){
  var pi=document.createElement('section');
  pi.id='panel-inicio';pi.className='panel';pi.setAttribute('role','tabpanel');pi.hidden=true;
  $('panel-ferias').before(pi);
}
['asistencia'].forEach(function(k){
  if($('panel-'+k))return;
  var pa=document.createElement('section');
  pa.id='panel-'+k;pa.className='panel';pa.setAttribute('role','tabpanel');pa.hidden=true;
  $('panel-contactos').after(pa);
});
['jp','candidatos','plataformas','do','equipo'].forEach(function(k){
  if($('panel-'+k))return;
  var pp=document.createElement('section');
  pp.id='panel-'+k;pp.className='panel';pp.setAttribute('role','tabpanel');pp.hidden=true;
  $('panel-contactos').after(pp);
});
if(!$('panel-cumpleanos')){
  var pc=document.createElement('section');
  pc.id='panel-cumpleanos';pc.className='panel';pc.setAttribute('role','tabpanel');pc.hidden=true;
  $('panel-ferias').after(pc);
}
if(!$('subtabs')){var st=document.createElement('div');st.id='subtabs';st.className='subtabs';st.setAttribute('role','tablist');$('tabs').after(st);}

/* ---------- Carga de datos ----------
   Los datos viven en Supabase (tabla app_datos, fila "principal"), no en GitHub: el repositorio es público.
   Se guarda una copia en este navegador para poder ver la app sin conexión; se borra al cerrar sesión. */
var CACHE_KEY='datos-cache';
function applyData(d){
  d=d||{};
  state.ferias=norm(d.ferias);state.contactos=norm(d.contactos);state.cumpleanos=norm(d.cumpleanos);state.avisos=norm(d.avisos);state.plataformas=norm(d.plataformas);state.eventosdo=norm(d.eventosdo);state.equipo=norm(d.equipo);state.jornadas=norm(d.jornadas);
}
var KEYS=['ferias','contactos','cumpleanos','avisos','plataformas','eventosdo','equipo','jornadas'];
function clone(o){return JSON.parse(JSON.stringify(o));}
function pick(d){var o={};KEYS.forEach(function(k){o[k]=clone((d&&d[k])||[]);});return o;}
function snap(){return pick(state);}
/* Junta los cambios de este navegador (respecto de "base") con lo que otra persona publicó ("remote"),
   elemento por elemento: lo que agregaste o editaste se aplica, lo que borraste se borra, y lo demás queda como lo dejó la otra persona. */
function mergeData(remote,base,local){
  var out={};
  KEYS.forEach(function(k){
    var R=clone((remote&&remote[k])||[]),B={},L={};
    ((base&&base[k])||[]).forEach(function(x){if(x&&x.id)B[x.id]=JSON.stringify(canon(x));});
    ((local&&local[k])||[]).forEach(function(x){if(x&&x.id)L[x.id]=x;});
    R=R.filter(function(x){return !(x&&B[x.id]&&!L[x.id]);});
    Object.keys(L).forEach(function(id){
      if(B[id]===JSON.stringify(canon(L[id])))return;
      var i=-1;for(var j=0;j<R.length;j++)if(R[j]&&R[j].id===id){i=j;break;}
      if(i>-1)R[i]=L[id];else R.push(L[id]);
    });
    out[k]=R;
  });
  return out;
}
function saveCache(contenido,ts){try{localStorage.setItem(CACHE_KEY,JSON.stringify({contenido:contenido,actualizado:ts}));}catch(e){}}
function dbMsg(e){
  var m=String((e&&e.message)||''),c=e&&e.code;
  if(c==='PGRST205'||c==='42P01'||/does not exist|schema cache/i.test(m))return 'Falta preparar la base de datos: ejecuta datos.sql en Supabase.';
  if(c==='42501'||/row-level security|permission denied/i.test(m))return 'Tu cuenta no tiene permiso para esta acción.';
  return 'No se pudo conectar con la base de datos.';
}
async function load(){
  state.lastLoad=Date.now();
  if(!window.SB||!window.Sesion||!Sesion.user){state.status='loading';renderAll();return;}
  try{
    var r=await SB.from('app_datos').select('contenido,actualizado').eq('id','principal').maybeSingle();
    if(r.error)throw r.error;
    if(!r.data){state.status='nodata';state.remoteTs='';renderAll();return;}
    applyData(r.data.contenido);state.baseData=snap();
    state.updated=state.remoteTs=r.data.actualizado;state.offline=false;
    saveCache(r.data.contenido,r.data.actualizado);
  }catch(e){
    var cached=null;try{cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');}catch(x){}
    if(!cached||!cached.contenido){state.status='error';state.errMsg=dbMsg(e);renderAll();return;}
    applyData(cached.contenido);state.baseData=snap();state.updated=cached.actualizado;state.remoteTs=cached.actualizado;state.offline=true;
  }
  state.published=sig();
  var dropped=false,merged=false;
  if(ADMIN){
    try{
      var raw=localStorage.getItem(DRAFT_KEY);
      if(raw){
        var dr=JSON.parse(raw);
        if(dr.base===state.published){
          /* El borrador parte de los datos publicados actuales: se conserva. */
          applyData(dr);
          if(sig()===state.published) localStorage.removeItem(DRAFT_KEY);
        }else if(dr.baseData){
          /* Alguien publicó después de hacer el borrador: se combinan ambos. */
          applyData(mergeData(state.baseData,dr.baseData,dr));merged=true;
          if(sig()===state.published) localStorage.removeItem(DRAFT_KEY);else persist();
        }else{
          localStorage.removeItem(DRAFT_KEY);dropped=true;
        }
      }
    }catch(e){}
  }
  state.status='ok';
  renderAll();
  if(dropped) toast('Se cargaron los datos publicados más recientes');
  if(merged) toast('Otra persona publicó cambios: se combinaron con los tuyos. Revisa y pulsa Publicar.');
}
function buildOut(){
  return {actualizado:new Date().toISOString(),ferias:state.ferias.slice().sort(cmpFeria),cumpleanos:state.cumpleanos.slice().sort(cmpFeria),avisos:state.avisos.slice().sort(byId),plataformas:state.plataformas.slice().sort(byName),equipo:state.equipo.slice().sort(byCargo),eventosdo:state.eventosdo.slice().sort(cmpFeria),contactos:state.contactos.slice().sort(byName),jornadas:state.jornadas.slice().sort(cmpFeria)};
}
async function publish(){
  if(!ADMIN||state.publishing||!isDirty())return;
  if(state.offline){toast('Sin conexión: no se puede publicar ahora.');return;}
  state.publishing=true;renderNotice();
  var combined=false;
  try{
    for(var intento=0;intento<3;intento++){
      var contenido=buildOut();
      var q=await SB.from('app_datos').update({contenido:contenido,actualizado_por:Sesion.email}).eq('id','principal').eq('actualizado',state.remoteTs).select('actualizado');
      if(q.error)throw q.error;
      if(q.data&&q.data.length){
        state.updated=state.remoteTs=q.data[0].actualizado;state.baseData=snap();state.published=sig();
        saveCache(contenido,state.remoteTs);
        try{localStorage.removeItem(DRAFT_KEY);}catch(e){}
        state.publishing=false;renderAll();
        toast(combined?'Publicado. Otra persona había publicado al mismo tiempo: se combinaron ambos cambios.':'Publicado. El equipo ya ve los cambios.');
        return;
      }
      /* Otra persona publicó mientras editabas: se trae su versión y se le aplican tus cambios. */
      var r=await SB.from('app_datos').select('contenido,actualizado').eq('id','principal').maybeSingle();
      if(r.error)throw r.error;
      if(!r.data)break;
      applyData(mergeData(r.data.contenido,state.baseData,snap()));
      state.baseData=pick(r.data.contenido);state.remoteTs=r.data.actualizado;combined=true;
    }
    state.publishing=false;renderAll();toast('No se pudo publicar porque otras personas están publicando a la vez. Intenta de nuevo en un momento.');
  }catch(e){
    state.publishing=false;renderNotice();
    toast(/permiso/.test(dbMsg(e))?'Tu cuenta no puede publicar cambios.':dbMsg(e));
  }
}
/* Cambio rápido (por ejemplo, marcar una compra): se aplica solo ese cambio sobre la última versión publicada,
   sin pasar por el modo edición ni publicar borradores. Si otra persona publicó entremedio, se reintenta. */
var quickChain=Promise.resolve();
function quickSave(mut){
  var run=quickChain.then(async function(){
    for(var intento=0;intento<4;intento++){
      var r=await SB.from('app_datos').select('contenido,actualizado').eq('id','principal').maybeSingle();
      if(r.error)throw r.error;if(!r.data)throw new Error('sin datos');
      var c=clone(r.data.contenido);mut(c);
      var q=await SB.from('app_datos').update({contenido:c,actualizado_por:Sesion.email}).eq('id','principal').eq('actualizado',r.data.actualizado).select('actualizado');
      if(q.error)throw q.error;
      if(q.data&&q.data.length)return {contenido:c,ts:q.data[0].actualizado};
    }
    throw new Error('ocupado');
  });
  quickChain=run.catch(function(){});
  return run;
}
function setBought(cid,iid,val){
  return function(d){
    var cu=(d.cumpleanos||[]).filter(function(x){return x.id===cid;})[0];if(!cu)return;
    var it=(cu.items||[]).filter(function(x){return x.id===iid;})[0];if(it)it.comprado=val;
  };
}
function toggleBought(cid,iid){
  if(state.status!=='ok')return;
  if(state.offline||!navigator.onLine){toast('Sin conexión: no se puede marcar ahora.');return;}
  var cu=state.cumpleanos.filter(function(x){return x.id===cid;})[0];
  var it=cu&&(cu.items||[]).filter(function(x){return x.id===iid;})[0];if(!it)return;
  var val=!it.comprado,wasDirty=ADMIN&&isDirty(),mut=setBought(cid,iid,val);
  mut(state);renderAll();
  quickSave(mut).then(function(res){
    state.remoteTs=state.updated=res.ts;saveCache(res.contenido,res.ts);
    if(ADMIN){
      /* En modo edición se respeta el borrador: el cambio se suma también a la base para que no cuente como pendiente. */
      if(state.baseData)mut(state.baseData);
      if(!wasDirty){state.published=sig();persist();}
    }else{applyData(res.contenido);state.published=sig();}
    renderAll();
  }).catch(function(e){
    setBought(cid,iid,!val)(state);renderAll();
    toast(String(e&&e.message)==='ocupado'?'Hay muchos cambios al mismo tiempo. Intenta de nuevo.':dbMsg(e)+' No se guardó la compra.');
  });
}
/* Traspaso inicial: copia el data.json que todavía está en el repositorio (o un respaldo) a Supabase. */
async function migrate(contenido){
  if(!ADMIN||state.publishing)return;
  state.publishing=true;renderAll();
  try{
    if(!contenido){
      var r=await fetch('data.json?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw {nofile:true};
      contenido=await r.json();
    }
    if(!contenido||!Array.isArray(contenido.ferias))throw {badfile:true};
    KEYS.forEach(function(k){contenido[k]=norm(contenido[k]);});
    var q=await SB.from('app_datos').insert({id:'principal',contenido:contenido,actualizado_por:Sesion.email});
    if(q.error)throw q.error;
    state.publishing=false;toast('Datos traspasados a la base de datos');load();
  }catch(e){
    state.publishing=false;state.migErr=e&&e.nofile?'No se encontró data.json en el repositorio. Elige un respaldo de data.json desde tu computador.':
      e&&e.badfile?'Ese archivo no parece un data.json de esta app.':
      /permiso/.test(dbMsg(e))?'Tu cuenta no es administradora: pide que te agreguen en la tabla app_admins.':dbMsg(e);
    renderAll();
  }
}
function persist(){
  if(!ADMIN)return;
  try{
    if(sig()===state.published) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY,JSON.stringify({base:state.published,baseData:state.baseData,ferias:state.ferias,contactos:state.contactos,cumpleanos:state.cumpleanos,avisos:state.avisos,plataformas:state.plataformas,eventosdo:state.eventosdo,equipo:state.equipo,jornadas:state.jornadas}));
  }catch(e){}
}

/* ---------- Render ---------- */
function renderTabs(){
  var ok=state.status==='ok';
  $('tabs').innerHTML=
    '<button class="tab" role="tab" data-act="tab" data-tab="inicio" aria-selected="'+(state.tab==='inicio')+'">Inicio</button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="ferias" aria-selected="'+(state.tab==='ferias')+'">Ferias<span class="n">'+(window.CandHooks?window.CandHooks.badge():'')+'</span></button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="do" aria-selected="'+(state.tab==='do')+'">DO</button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="jp" aria-selected="'+(state.tab==='jp')+'" title="Jóvenes Profesionales">JP</button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="plataformas" aria-selected="'+(state.tab==='plataformas')+'">Plataformas</button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="cumpleanos" aria-selected="'+(state.tab==='cumpleanos')+'">Cumpleaños</button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="equipo" aria-selected="'+(state.tab==='equipo')+'">Equipo</button>';
  var sel=$('tabs').querySelector('[aria-selected="true"]');if(sel&&sel.scrollIntoView){try{sel.scrollIntoView({inline:'center',block:'nearest'});}catch(e){}}
  var sb=$('subtabs');
  sb.hidden=state.tab!=='ferias';
  sb.innerHTML='<button class="fchip" role="tab" data-act="sub" data-v="calendario" aria-selected="'+(state.sub==='calendario')+'" aria-pressed="'+(state.sub==='calendario')+'">'+ic('cal',16)+'Calendario</button>'+
    (window.CandHooks?'<button class="fchip" role="tab" data-act="sub" data-v="candidatos" aria-selected="'+(state.sub==='candidatos')+'" aria-pressed="'+(state.sub==='candidatos')+'">'+ic('users',16)+'Candidatos'+(window.CandHooks.badge()?'<span class="n">'+window.CandHooks.badge()+'</span>':'')+'</button>':'')+
    '<button class="fchip" role="tab" data-act="sub" data-v="directorio" aria-selected="'+(state.sub==='directorio')+'" aria-pressed="'+(state.sub==='directorio')+'">'+ic('book',16)+'Directorio</button>'+
    '<button class="fchip" role="tab" data-act="sub" data-v="asistencia" aria-selected="'+(state.sub==='asistencia')+'" aria-pressed="'+(state.sub==='asistencia')+'">'+ic('check',16)+'Asistencia</button>';
  $('panel-ferias').hidden=!(state.tab==='ferias'&&state.sub==='calendario');
  $('panel-inicio').hidden=state.tab!=='inicio';
  $('panel-cumpleanos').hidden=state.tab!=='cumpleanos';
  $('panel-plataformas').hidden=state.tab!=='plataformas';
  $('panel-do').hidden=state.tab!=='do';
  $('panel-jp').hidden=state.tab!=='jp';
  $('panel-equipo').hidden=state.tab!=='equipo';
  $('panel-candidatos').hidden=!(state.tab==='ferias'&&state.sub==='candidatos');
  $('panel-contactos').hidden=!(state.tab==='ferias'&&state.sub==='directorio');
  $('panel-asistencia').hidden=!(state.tab==='ferias'&&state.sub==='asistencia');
}
function renderNotice(){
  var h='';
  if(state.offline&&state.status==='ok') h='<div class="notice">Sin conexión: estás viendo la última copia guardada en este dispositivo.</div>';
  else if(ADMIN&&state.status==='ok'){
    var dirty=isDirty();
    h='<div class="adminbar"><div class="txt"><b>Modo edición.</b> Tus cambios quedan en este navegador hasta que pulses <b>Publicar</b>; ahí el equipo los ve al instante. <button class="linkbtn" data-act="download">Descargar respaldo</button></div>'+
      '<div class="adm-actions">'+(dirty?'<span class="pill warn">Cambios sin publicar</span>':'')+
      (dirty?'<button class="btn" data-act="discard">'+(state.discardArmed?'¿Seguro? Descartar':'Descartar cambios')+'</button>':'')+
      '<button class="btn primary" data-act="publish"'+(dirty&&!state.publishing?'':' disabled')+'>'+ic('check',17)+(state.publishing?'Publicando…':'Publicar')+'</button></div></div>';
  }
  $('notice').innerHTML=h;
}
function cmpFeria(a,b){var x=(a.fecha||'')+(a.horaInicio||''),y=(b.fecha||'')+(b.horaInicio||'');return x<y?-1:x>y?1:0;}
function byName(a,b){var x=lower(a.nombre),y=lower(b.nombre);return x<y?-1:x>y?1:0;}
function people(txt){
  var parts=String(txt||'').split(/\s*[,;\n]\s*|\s+y\s+/i).map(function(s){return s.trim();}).filter(Boolean);
  if(!parts.length) return '<span class="none">Sin responsables</span>';
  return parts.map(function(p){return '<span class="person">'+avatar(p)+esc(p)+'</span>';}).join('');
}
function editBtn(kind,id,name){
  return ADMIN?'<button class="iconbtn" data-act="edit" data-kind="'+kind+'" data-id="'+esc(id)+'" aria-label="Editar '+esc(name)+'" title="Editar">'+ic('pencil',17)+'</button>':'';
}
function feriaRow(f,past,isNext){
  var d=parseDate(f.fecha), est=ESTADOS[f.estado]||ESTADOS.porconfirmar;
  var date=d?'<div class="d-num">'+d.getDate()+'</div><div class="d-mon">'+esc(monFmt.format(d).replace('.',''))+'</div><div class="d-wd">'+esc(wdFmt.format(d).replace('.',''))+'</div>':'<div class="d-num">—</div>';
  var hora=f.horaInicio?ic('clock',16)+'<span>'+esc(f.horaInicio)+(f.horaFin?' – '+esc(f.horaFin):'')+'</span>':'<span class="none">Sin hora</span>';
  return '<div class="row feria'+(past?' past':'')+(ADMIN?'':' noact')+'">'+
    '<div class="date">'+date+'</div>'+
    '<div class="main"><div class="name fname">'+feriaMark(f,'sm')+'<span>'+esc(f.nombre)+'</span></div>'+
      (f.lugar?'<div class="meta">'+ic('pin',15)+'<span>'+esc(f.lugar)+'</span></div>':'')+
      '<div class="tags"><span class="pill '+est[1]+'">'+est[0]+'</span>'+
        (MATERIALES[f.material]?'<span class="pill mat'+(f.material==='nada'?' none-mat':'')+'">'+MATERIALES[f.material]+'</span>':'')+
        (isNext?'<span class="tag-next">Siguiente</span>':'')+'</div>'+calBtn(f,past)+candLink(f)+'</div>'+
    '<div class="time">'+hora+'</div>'+
    '<div class="who">'+people(f.responsables)+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('feria',f.id,f.nombre)+'</div>':'')+
    (f.notas?'<details class="notebox" data-note="'+esc(f.id)+'"'+(state.openNotes[f.id]?' open':'')+'><summary>Notas</summary><div class="notetext">'+esc(f.notas)+'</div></details>':'')+
  '</div>';
}
/* ---------- Calendario ---------- */
/* ---------- Jóvenes Profesionales (JP) ----------
   Jornada de un día con charlas, actividades y almuerzo: lugar, fecha y hora, programa, traslado,
   qué llevar (se marca con un toque) y asistentes (editables e importables desde Excel). */
function jpEvent(j){
  var prog=jpSortAct(j.actividades).map(function(a){return (a.hora?a.hora+' ':'')+a.actividad;}).join('\n');
  return {id:j.id,nombre:'Jornada JP: '+(j.titulo||'Jóvenes Profesionales'),fecha:j.fecha,horaInicio:j.horaInicio||'',horaFin:j.horaFin||'',lugar:j.lugar||'',responsables:'',estado:'',material:'',notas:prog,sinEstado:true};
}
function jpSortAct(a){return (Array.isArray(a)?a:[]).slice().sort(function(x,y){var p=x.hora||'99',q=y.hora||'99';return p<q?-1:p>q?1:0;});}
function jpCard(j,past){
  var d=parseDate(j.fecha),t=todayStr();
  var date=d?'<div class="d-num">'+d.getDate()+'</div><div class="d-mon">'+esc(monFmt.format(d).replace('.',''))+'</div><div class="d-wd">'+esc(wdFmt.format(d).replace('.',''))+'</div>':'<div class="d-num">—</div>';
  var hora=j.horaInicio?j.horaInicio+(j.horaFin?' – '+j.horaFin:''):'';
  var dd=d?Math.round((d-parseDate(t))/864e5):null;
  var cuando=dd===null||past?'':dd===0?'<span class="pill warn">Hoy</span>':dd===1?'<span class="pill warn">Mañana</span>':'<span class="pill mat">En '+dd+' días</span>';
  var acts=jpSortAct(j.actividades);
  var prog=acts.length?'<ol class="jtl">'+acts.map(function(a){return '<li><span class="jt">'+esc(a.hora||'—')+'</span><span class="ja">'+esc(a.actividad)+'</span></li>';}).join('')+'</ol>':'<p class="none">Aún no hay actividades.</p>';
  var tr=j.traslado||{},trs=[['Bus',tr.bus],['Marca',tr.marca],['Chofer',tr.chofer],['Contacto',tr.telefono?'<a href="tel:'+esc(String(tr.telefono).replace(/[^\d+]/g,''))+'">'+esc(tr.telefono)+'</a>':''],['Salida',[tr.salidaHora,tr.salidaLugar].filter(Boolean).map(esc).join(', ')]]
    .filter(function(r){return r[1];});
  var trHtml=trs.length?'<dl class="jdl">'+trs.map(function(r){return '<dt>'+r[0]+'</dt><dd>'+(r[0]==='Bus'||r[0]==='Marca'||r[0]==='Chofer'?esc(r[1]):r[1])+'</dd>';}).join('')+'</dl>':'<p class="none">Sin traslado definido.</p>';
  var ll=Array.isArray(j.llevar)?j.llevar:[],listos=ll.filter(function(x){return x.listo;}).length;
  var llHtml=ll.length?'<ul class="cl">'+ll.map(function(x){
    return '<li class="'+(x.listo?'done':'')+'"><button type="button" class="cbtn" data-act="jpck" data-j="'+esc(j.id)+'" data-it="'+esc(x.id)+'" role="checkbox" aria-checked="'+(!!x.listo)+'" aria-label="'+esc(x.item)+(x.listo?': listo':': pendiente')+'">'+
      '<span class="cmark">'+(x.listo?ic('check',13):'')+'</span><span class="cname">'+esc(x.item)+'</span></button></li>';}).join('')+'</ul>':'<p class="none">La lista está vacía.</p>';
  var as=Array.isArray(j.asistentes)?j.asistentes:[],q=nz(state.jpq[j.id]||'');
  var asf=q?as.filter(function(a){return nz([a.nombre,a.area,a.correo].join(' ')).indexOf(q)>-1;}):as;
  var asHtml=as.length?(as.length>8?searchBox('jq-'+j.id,'Buscar asistente',state.jpq[j.id]||'','Buscar asistente'):'')+
    (asf.length?'<div class="jtable"><table><thead><tr><th>Nombre</th><th>Área</th><th>Correo</th><th>Teléfono</th></tr></thead><tbody>'+asf.map(function(a){
      return '<tr><td><b>'+esc(a.nombre)+'</b></td><td>'+esc(a.area||'')+'</td><td>'+(a.correo?'<a href="mailto:'+esc(a.correo)+'">'+esc(a.correo)+'</a>':'')+'</td><td>'+(a.telefono?'<a href="tel:'+esc(String(a.telefono).replace(/[^\d+]/g,''))+'">'+esc(a.telefono)+'</a>':'')+'</td></tr>';
    }).join('')+'</tbody></table></div>':'<p class="none">Nadie coincide con la búsqueda.</p>')+
    '<button class="linkbtn jcsv" data-act="jpcsv" data-j="'+esc(j.id)+'">'+ic('down',15)+'Descargar lista</button>'
    :'<p class="none">Aún no hay asistentes.'+(ADMIN?' Agrégalos en Editar o impórtalos desde Excel.':'')+'</p>';
  var kl='jl:'+j.id,ka='ja:'+j.id;
  return '<article class="jcard'+(past?' past':'')+'">'+
    '<div class="jhead"><div class="date">'+date+'</div><div class="jmain"><div class="name">'+esc(j.titulo||'Jornada Jóvenes Profesionales')+'</div>'+
      '<div class="jmeta">'+(hora?'<span>'+ic('clock',15)+esc(hora)+'</span>':'')+(j.lugar?'<span>'+ic('pin',15)+esc(j.lugar)+'</span>':'')+'</div>'+
      '<div class="tags">'+cuando+'<span class="pill mat">'+as.length+(as.length===1?' asistente':' asistentes')+'</span></div>'+calBtn(j,past)+'</div>'+
      (ADMIN?'<div class="act">'+editBtn('jp',j.id,j.titulo||'jornada')+'</div>':'')+'</div>'+
    '<div class="jgrid">'+
      '<section class="jsec"><h3>'+ic('clock',16)+'Programa</h3>'+prog+'</section>'+
      '<section class="jsec"><h3>'+ic('pin',16)+'Traslado</h3>'+trHtml+'</section>'+
    '</div>'+
    '<details class="notebox jdet" data-note="'+kl+'"'+(state.openNotes[kl]?' open':'')+'><summary>Qué llevar ('+listos+'/'+ll.length+' listo'+(ll.length===1?'':'s')+')</summary>'+llHtml+'</details>'+
    '<details class="notebox jdet" data-note="'+ka+'"'+(state.openNotes[ka]?' open':'')+'><summary>Asistentes ('+as.length+')</summary>'+asHtml+'</details>'+
    (j.notas?'<details class="notebox jdet" data-note="jn:'+esc(j.id)+'"'+(state.openNotes['jn:'+j.id]?' open':'')+'><summary>Notas</summary><div class="notetext">'+esc(j.notas)+'</div></details>':'')+
  '</article>';
}
function renderJP(){
  var el=$('panel-jp');if(!el||stateBlock(el))return;
  var t=todayStr(),js=state.jornadas.slice().sort(cmpFeria);
  var up=js.filter(function(j){return !j.fecha||j.fecha>=t;}),past=js.filter(function(j){return j.fecha&&j.fecha<t;}).reverse();
  var head='<div class="toolbar jp-intro"><div class="jp-title"><h2>Jóvenes Profesionales</h2><p>Jornada de un día con charlas, actividades y almuerzo.</p></div>'+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="jp">'+ic('plus',17)+'Nueva jornada</button>':'')+'</div>';
  var body;
  if(!js.length) body=emptyBlock('users',ADMIN?'Aún no hay jornadas':'Aún no hay jornadas JP',ADMIN?'Crea la jornada con lugar, fecha, programa, traslado, qué llevar y asistentes. Luego pulsa Publicar.':'Cuando se programe una jornada, la verás aquí.',ADMIN?'<button class="btn primary" data-act="new" data-kind="jp">'+ic('plus',17)+'Nueva jornada</button>':'');
  else body=up.map(function(j){return jpCard(j,false);}).join('')+(up.length?'':'<p class="none">No hay jornadas próximas.</p>')+
    (past.length?'<details class="pastbox"><summary>Jornadas anteriores ('+past.length+')</summary><div class="stack">'+past.map(function(j){return jpCard(j,true);}).join('')+'</div></details>':'');
  var a=document.activeElement,aid=a&&a.id&&a.id.indexOf('jq-')===0?a.id:'';
  keepFocus(aid,head+'<div class="stack">'+body+'</div>',el);
}
/* Formulario: listas editables (programa, qué llevar y asistentes). */
var JPL={
  act:{cols:[['hora','time','Hora',''],['actividad','text','Actividad','Ej: Charla de bienvenida']],add:'Agregar actividad',empty:'Sin actividades.'},
  llevar:{cols:[['listo','check','Listo'],['item','text','Qué llevar','Ej: Credenciales']],add:'Agregar a la lista',empty:'La lista está vacía.'},
  asis:{cols:[['nombre','text','Nombre','Nombre y apellido'],['area','text','Área','Área o gerencia'],['correo','email','Correo','Correo'],['telefono','tel','Teléfono','Teléfono']],add:'Agregar asistente',empty:'Sin asistentes. Agrégalos uno a uno o importa un Excel.'}
};
function jpLists(rec){
  var cp=function(a){return (Array.isArray(a)?a:[]).map(function(x){var o={};for(var k in x)o[k]=x[k];if(!o.id)o.id=newId();return o;});};
  return {act:cp(jpSortAct(rec.actividades)),llevar:cp(rec.llevar),asis:cp(rec.asistentes)};
}
function jlHtml(key){
  var L=state.edit.L[key],cfg=JPL[key];
  if(!L.length)return '<p class="none">'+cfg.empty+'</p>';
  return L.map(function(r,i){
    return '<div class="jlrow jl-'+key+'">'+cfg.cols.map(function(c){
      if(c[1]==='check')return '<input class="ck" type="checkbox" data-l="'+key+'" data-i="'+i+'" data-f="'+c[0]+'"'+(r[c[0]]?' checked':'')+' aria-label="'+c[2]+'">';
      return '<input type="'+c[1]+'" data-l="'+key+'" data-i="'+i+'" data-f="'+c[0]+'" value="'+esc(r[c[0]]||'')+'" placeholder="'+esc(c[3]||c[2])+'" aria-label="'+c[2]+'">';
    }).join('')+'<button type="button" class="iconbtn" data-act="ldel" data-l="'+key+'" data-i="'+i+'" aria-label="Quitar" title="Quitar">'+ic('x',16)+'</button></div>';
  }).join('');
}
function jlBlock(key,label,extra){
  return '<div class="fld full"><label>'+label+(key==='asis'?' (<span id="jlc-asis">'+state.edit.L.asis.length+'</span>)':'')+'</label>'+
    '<div class="jlist" id="jl-'+key+'">'+jlHtml(key)+'</div>'+
    '<div class="jl-actions"><button type="button" class="btn additem" data-act="ladd" data-l="'+key+'">'+ic('plus',16)+JPL[key].add+'</button>'+(extra||'')+'</div></div>';
}
function jlPaint(key){var el=$('jl-'+key);if(el)el.innerHTML=jlHtml(key);var c=$('jlc-'+key);if(c)c.textContent=state.edit.L[key].length;}
function jlAdd(key){
  if(!state.edit||!state.edit.L)return;
  state.edit.L[key].push({id:newId()});jlPaint(key);
  var el=$('jl-'+key),ins=el?el.querySelectorAll('input:not([type=checkbox])'):[];
  if(ins.length){var row=ins[ins.length-1].closest('.jlrow'),first=row.querySelector('input:not([type=checkbox])');if(first)first.focus();}
}
function syncList(t){
  if(!t||!t.getAttribute||!state.edit||!state.edit.L)return false;
  var k=t.getAttribute('data-l');if(!k||!state.edit.L[k])return false;
  var r=state.edit.L[k][+t.getAttribute('data-i')];if(!r)return true;
  r[t.getAttribute('data-f')]=t.type==='checkbox'?t.checked:t.value;
  return true;
}
function jpForm(rec){
  var tr=rec.traslado||{};
  return fld('titulo','Nombre de la jornada','text',rec.titulo||'Jornada Jóvenes Profesionales',{full:true})+
    fld('fecha','Día','date',rec.fecha)+
    fld('lugar','Lugar','text',rec.lugar,{ph:'Lugar o dirección'})+
    fld('horaInicio','Hora de inicio','time',rec.horaInicio)+
    fld('horaFin','Hora de término','time',rec.horaFin)+
    jlBlock('act','Actividades (hora y actividad)')+
    '<div class="fld full jsubt"><label>Traslado</label></div>'+
    fld('tr_bus','Bus','text',tr.bus,{ph:'Empresa o tipo de bus'})+
    fld('tr_marca','Marca del bus','text',tr.marca)+
    fld('tr_chofer','Chofer','text',tr.chofer,{ph:'Nombre del chofer'})+
    fld('tr_tel','Contacto del chofer','tel',tr.telefono,{ph:'+56 9 1234 5678'})+
    fld('tr_sh','Hora de salida','time',tr.salidaHora)+
    fld('tr_sl','Lugar de salida','text',tr.salidaLugar,{ph:'Punto de encuentro'})+
    jlBlock('llevar','Qué llevar')+
    jlBlock('asis','Asistentes','<button type="button" class="btn additem" data-act="asisimp">'+ic('down',16)+'Importar Excel</button><input type="file" id="jp-asisfile" accept=".xlsx,.csv" hidden>')+
    '<div class="fld full"><span class="hint" id="jp-asismsg">Para importar: un Excel o CSV con una columna Nombre y, si quieres, Área, Correo y Teléfono. Los repetidos no se agregan.</span></div>'+
    fld('notas','Notas','textarea',rec.notas,{full:true});
}
function jpEditorReady(){}
function jpCollect(){
  var L=state.edit.L,tx=function(v){return String(v==null?'':v).trim();};
  var d={titulo:val('titulo')||'Jornada Jóvenes Profesionales',fecha:val('fecha'),horaInicio:val('horaInicio'),horaFin:val('horaFin'),lugar:val('lugar'),notas:val('notas'),
    traslado:{bus:val('tr_bus'),marca:val('tr_marca'),chofer:val('tr_chofer'),telefono:val('tr_tel'),salidaHora:val('tr_sh'),salidaLugar:val('tr_sl')},
    actividades:jpSortAct(L.act.filter(function(a){return tx(a.actividad);}).map(function(a){return {id:a.id||newId(),hora:tx(a.hora),actividad:tx(a.actividad)};})),
    llevar:L.llevar.filter(function(x){return tx(x.item);}).map(function(x){return {id:x.id||newId(),item:tx(x.item),listo:!!x.listo};}),
    asistentes:L.asis.filter(function(x){return tx(x.nombre);}).map(function(x){return {id:x.id||newId(),nombre:tx(x.nombre),area:tx(x.area),correo:tx(x.correo),telefono:tx(x.telefono)};})};
  if(!d.fecha){ferr('Elige el día de la jornada.');return null;}
  if(d.horaInicio&&d.horaFin&&d.horaFin<d.horaInicio){ferr('La hora de término es anterior a la de inicio.');return null;}
  return d;
}
/* Importar asistentes desde Excel o CSV, sin duplicar a quienes ya están en la lista. */
async function importAsis(file){
  if(!file||!state.edit||!state.edit.L)return;
  var msg=$('jp-asismsg'),say=function(t){if(msg)msg.textContent=t;};
  if(!window.ExcelReader){say('No se pudo cargar el lector de Excel. Recarga la página.');return;}
  try{
    var rows=await ExcelReader.read(file);
    var hi=rows.findIndex(function(r){return r&&r.some(function(v){return v!=null&&String(v).trim();});});
    if(hi<0){say('El archivo está vacío.');return;}
    var head=rows[hi].map(function(h){return nz(h);});
    var col=function(re){for(var i=0;i<head.length;i++)if(head[i]&&re.test(head[i]))return i;return -1;};
    var iN=col(/^(nombre|nombre completo|nombres|asistente|participante|colaborador|colaboradora|trabajador|nombre y apellidos?)$/),
      iAp=col(/^(apellido|apellidos)$/),iM=col(/^(correo|e-?mail|mail|correo electronico)$/),
      iT=col(/^(telefono|celular|fono|movil|whatsapp|numero)$/),iA=col(/^(area|gerencia|cargo|departamento|empresa|unidad|sociedad)$/);
    if(iN<0){say('No encontré una columna “Nombre” en el archivo.');return;}
    var L=state.edit.L.asis,seen={};
    L.forEach(function(a){if(a.nombre)seen['n'+nz(a.nombre)]=1;if(a.correo)seen['c'+nz(a.correo)]=1;});
    var add=0,rep=0,get=function(r,i){return i<0||r[i]==null?'':String(r[i]).trim();};
    rows.slice(hi+1).forEach(function(r){
      if(!r)return;
      var n=get(r,iN);if(iAp>-1&&get(r,iAp))n=(n+' '+get(r,iAp)).trim();
      if(!n)return;
      var c=get(r,iM);
      if(seen['n'+nz(n)]||(c&&seen['c'+nz(c)])){rep++;return;}
      seen['n'+nz(n)]=1;if(c)seen['c'+nz(c)]=1;
      var t=get(r,iT);
      L.push({id:newId(),nombre:n,area:get(r,iA),correo:c,telefono:t&&ExcelReader.phone?ExcelReader.phone(t):t});add++;
    });
    jlPaint('asis');
    say(add+(add===1?' asistente agregado':' asistentes agregados')+(rep?', '+rep+(rep===1?' repetido omitido':' repetidos omitidos'):'')+'. Revisa la lista y pulsa Guardar.');
  }catch(e){
    say(String(e&&e.message)==='xls'?'Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx.':'No se pudo leer el archivo. Guárdalo como .xlsx o .csv e intenta de nuevo.');
  }
}
/* Marcar "qué llevar" con un toque: se guarda al instante, como las compras de cumpleaños. */
function setLlevar(jid,iid,val){
  return function(d){
    var j=(d.jornadas||[]).filter(function(x){return x.id===jid;})[0];if(!j)return;
    var it=(j.llevar||[]).filter(function(x){return x.id===iid;})[0];if(it)it.listo=val;
  };
}
function toggleLlevar(jid,iid){
  if(state.status!=='ok')return;
  if(state.offline||!navigator.onLine){toast('Sin conexión: no se puede marcar ahora.');return;}
  var j=state.jornadas.filter(function(x){return x.id===jid;})[0];
  var it=j&&(j.llevar||[]).filter(function(x){return x.id===iid;})[0];if(!it)return;
  var val=!it.listo,wasDirty=ADMIN&&isDirty(),mut=setLlevar(jid,iid,val);
  mut(state);renderAll();
  quickSave(mut).then(function(res){
    state.remoteTs=state.updated=res.ts;saveCache(res.contenido,res.ts);
    if(ADMIN){if(state.baseData)mut(state.baseData);if(!wasDirty){state.published=sig();persist();}}
    else{applyData(res.contenido);state.published=sig();}
    renderAll();
  }).catch(function(e){
    setLlevar(jid,iid,!val)(state);renderAll();
    toast(String(e&&e.message)==='ocupado'?'Hay muchos cambios al mismo tiempo. Intenta de nuevo.':dbMsg(e)+' No se guardó el cambio.');
  });
}
function jpCsv(jid){
  var j=state.jornadas.filter(function(x){return x.id===jid;})[0];if(!j)return;
  var rows=[['Nombre','Área','Correo','Teléfono']].concat((j.asistentes||[]).map(function(a){return [a.nombre,a.area,a.correo,a.telefono];}));
  var csv='\uFEFF'+rows.map(function(r){return r.map(function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
  var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  var a=document.createElement('a');a.href=url;a.download='asistentes-jp-'+(j.fecha||todayStr())+'.csv';document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},2000);
  toast('Lista descargada. Contiene datos personales: guárdala en un lugar privado.');
}
/* Acceso a los candidatos de cada feria (vienen de candidatos.js). */
function candLink(f){
  var H=window.CandHooks;if(!H||!H.feriaInfo||f.estado==='cancelada')return '';
  var inf=H.feriaInfo(f);if(!inf)return '';
  if(inf.n)return '<button class="calbtn candlink" data-act="c-feria" data-id="'+esc(f.id)+'">'+ic('users',15)+inf.n+(inf.n===1?' candidato':' candidatos')+
    (inf.alert?'<span class="pill warn">'+inf.alert+' por contactar</span>':'')+'</button>';
  return f.fecha&&f.fecha<=todayStr()?'<button class="calbtn candlink" data-act="c-newf" data-id="'+esc(f.id)+'">'+ic('plus',15)+'Registrar candidatos</button>':'';
}
function calBtn(f,past){
  if(past||f.estado==='cancelada'||!parseDate(f.fecha)) return '';
  return '<button class="calbtn" data-act="cal" data-id="'+esc(f.id)+'">'+ic('calplus',15)+'Agregar al calendario</button>';
}
function ymd(s){return s.replace(/-/g,'');}
function addDays(s,n){var d=parseDate(s);d.setDate(d.getDate()+n);return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate());}
function hm(t){return t.replace(':','')+'00';}
function plusHour(t){var p=t.split(':'),h=+p[0]+1;return h>23?'23:59':pad(h)+':'+p[1];}
function calData(f){
  var allDay=!f.horaInicio,start,end;
  var endD=(f.fechaFin&&f.fechaFin>f.fecha)?f.fechaFin:f.fecha;
  if(allDay){start=ymd(f.fecha);end=addDays(endD,1);}
  else{
    var fin=(f.horaFin&&(endD>f.fecha||f.horaFin>f.horaInicio))?f.horaFin:plusHour(f.horaInicio);
    start=ymd(f.fecha)+'T'+hm(f.horaInicio);end=ymd(endD)+'T'+hm(fin);
  }
  var parts=[];
  if(f.responsables) parts.push((f.sinEstado?'Responsable: ':'Responsables: ')+f.responsables);
  if(MATERIALES[f.material]) parts.push('Material: '+MATERIALES[f.material]);
  if(!f.sinEstado) parts.push('Estado: '+(ESTADOS[f.estado]||ESTADOS.porconfirmar)[0]);
  if(f.tentativa) parts.push('Fechas tentativas');
  if(f.notas) parts.push('Notas: '+(f.notas.length>500?f.notas.slice(0,500)+'…':f.notas));
  return {allDay:allDay,start:start,end:end,desc:parts.join('\n')};
}
function googleUrl(f){
  var c=calData(f);
  var det=c.desc.length>900?c.desc.slice(0,900)+'…':c.desc;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(f.nombre)+
    '&dates='+c.start+'/'+c.end+'&ctz=America%2FSantiago&details='+encodeURIComponent(det)+'&location='+encodeURIComponent(f.lugar||'');
}
function isoLocal(c,which){
  /* c.start / c.end: 'YYYYMMDD' o 'YYYYMMDDTHHMMSS' -> ISO local */
  var v=c[which];
  var d=v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6,8);
  return v.length>8?d+'T'+v.slice(9,11)+':'+v.slice(11,13)+':'+v.slice(13,15):d;
}
function outlookUrl(f,personal){
  var c=calData(f);
  var det=c.desc.length>900?c.desc.slice(0,900)+'…':c.desc;
  return 'https://'+(personal?'outlook.live.com':'outlook.office.com')+'/calendar/0/deeplink/compose?path='+encodeURIComponent('/calendar/action/compose')+'&rru=addevent'+
    '&subject='+encodeURIComponent(f.nombre)+'&startdt='+encodeURIComponent(isoLocal(c,'start'))+'&enddt='+encodeURIComponent(isoLocal(c,'end'))+
    (c.allDay?'&allday=true':'')+'&body='+encodeURIComponent(det)+'&location='+encodeURIComponent(f.lugar||'');
}
function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
function icsEsc(s){return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');}
function icsFold(l){var o=[],i=0;while(l.length>i+60){o.push(l.slice(i,i+60));i+=60;}o.push(l.slice(i));return o.join('\r\n ');}
function buildIcs(f){
  var c=calData(f),L=[];
  var stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  L.push('BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ferias Universitarias//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT');
  L.push('UID:'+icsEsc(f.id)+'@ferias-universitarias','DTSTAMP:'+stamp);
  if(c.allDay){L.push('DTSTART;VALUE=DATE:'+c.start,'DTEND;VALUE=DATE:'+c.end);}
  else{L.push('DTSTART:'+c.start,'DTEND:'+c.end);}
  L.push('SUMMARY:'+icsEsc(f.nombre));
  if(f.lugar) L.push('LOCATION:'+icsEsc(f.lugar));
  L.push('DESCRIPTION:'+icsEsc(c.desc));
  var alarms=c.allDay?['-PT15H','PT8H']:['-P1D','-PT1H'];
  alarms.forEach(function(t){L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc('Recordatorio: '+f.nombre),'TRIGGER:'+t,'END:VALARM');});
  L.push('END:VEVENT','END:VCALENDAR');
  return L.map(icsFold).join('\r\n')+'\r\n';
}
function slug(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'feria';}
function downloadIcs(f){
  var blob=new Blob([buildIcs(f)],{type:'text/calendar;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  if(isIOS()){
    /* En iPhone, abrir el archivo directamente ofrece "Agregar a Calendario". */
    window.location.href=url;
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    return;
  }
  var a=document.createElement('a');a.href=url;a.download=slug(f.nombre)+'.ics';document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},2000);
  toast('Archivo descargado. Ábrelo para agregarlo a Outlook o a tu calendario.');
}
function calItem(id){
  var f=state.ferias.filter(function(r){return r.id===id;})[0];if(f)return f;
  var e=state.eventosdo.filter(function(r){return r.id===id;})[0];if(e){var o={};for(var k in e)o[k]=e[k];o.sinEstado=true;return o;}
  var jj=state.jornadas.filter(function(r){return r.id===id;})[0];if(jj)return jpEvent(jj);
  var c=state.cumpleanos.filter(function(r){return r.id===id;})[0];return c?cumpleEvent(c):null;
}
function openCal(id){
  var f=calItem(id);if(!f)return;
  var d=parseDate(f.fecha);
  var when=d?shortFmt.format(d).replace(/\./g,''):'';
  var hora=f.horaInicio?(' · '+f.horaInicio+(f.horaFin?' – '+f.horaFin:'')):'';
  if(f.fechaFin&&f.fechaFin>f.fecha){when=rangeTxt(f);hora=f.tentativa?' · tentativo':'';}
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="cal-title">'+
    '<h2 id="cal-title">Agregar al calendario</h2>'+
    '<div><div class="name">'+esc(f.nombre)+'</div><div class="meta"><span>'+esc(when+hora)+'</span></div></div>'+
    '<div class="calopts"><button class="btn primary" type="button" data-act="ics" data-id="'+esc(f.id)+'">'+ic('calplus',17)+'iPhone (Calendario)</button>'+
    '<a class="btn primary" href="'+esc(outlookUrl(f))+'" target="_blank" rel="noopener">'+ic('calplus',17)+'Outlook (web)</a>'+
    '<button class="btn" type="button" data-act="ics" data-id="'+esc(f.id)+'">Outlook (aplicación)</button>'+
    '<a class="btn" href="'+esc(googleUrl(f))+'" target="_blank" rel="noopener">Google Calendar</a></div>'+
    '<p class="hint">'+(f.horaInicio?'':(f.sinEstado?'Se agrega como evento de todo el día. ':'Esta feria aún no tiene hora, así que se agrega como evento de todo el día. '))+
    '“iPhone” descarga un archivo que se abre en Calendario. “Outlook (web)” abre el evento listo para guardar, sin descargar nada. “Outlook (aplicación)” descarga el archivo para Outlook de escritorio o del celular.</p>'+
    '<div class="sheet-actions"><button class="btn" type="button" data-act="close">Cerrar</button></div></div></div>';
}
function emptyBlock(icon,title,text,btn){
  return '<div class="empty"><div class="badge">'+ic(icon,24)+'</div><h2>'+title+'</h2><p>'+text+'</p>'+(btn&&ADMIN?btn:'')+'</div>';
}
function searchBox(id,ph,val,label){
  return '<div class="search">'+ic('search',17)+'<input id="'+id+'" type="search" placeholder="'+ph+'" value="'+esc(val)+'" aria-label="'+label+'"></div>';
}
function keepFocus(id,html,el){
  var cur=document.activeElement&&document.activeElement.id===id;
  var pos=cur?document.activeElement.selectionStart:0;
  el.innerHTML=html;
  if(cur){var i=$(id);if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}
}
function stateBlock(el){
  if(state.status==='loading'){el.innerHTML='<p class="none">Cargando…</p>';return true;}
  if(state.status==='error'){el.innerHTML='<div class="empty"><div class="badge">'+ic('cal',24)+'</div><h2>No se pudieron cargar los datos</h2><p>'+esc(state.errMsg||'Revisa tu conexión y vuelve a abrir la app.')+'</p></div>';return true;}
  if(state.status==='nodata'){
    el.innerHTML=ADMIN?'<div class="empty"><div class="badge">'+ic('down',24)+'</div><h2>Traspasa los datos a la base privada</h2><p>Los datos de la app todavía no están en Supabase. Este paso copia el data.json actual una sola vez; después ya puedes borrarlo de GitHub.</p>'+
      (state.migErr?'<p class="cerr">'+esc(state.migErr)+'</p>':'')+
      '<div class="adm-actions"><button class="btn primary" data-act="migrate"'+(state.publishing?' disabled':'')+'>'+(state.publishing?'Traspasando…':'Traspasar data.json')+'</button>'+
      '<button class="btn" data-act="migrate-file">Elegir un respaldo</button></div></div>':
      '<div class="empty"><div class="badge">'+ic('cal',24)+'</div><h2>Aún no hay datos</h2><p>El administrador todavía no ha cargado la información. Vuelve a intentarlo más tarde.</p></div>';
    return true;
  }
  return false;
}
function renderFerias(){
  var el=$('panel-ferias');
  if(stateBlock(el))return;
  var t=todayStr(), all=state.ferias.slice();
  var upAll=all.filter(function(f){return (f.fecha||'9999')>=t;}).sort(cmpFeria);
  var porConf=upAll.filter(function(f){return f.estado!=='confirmada'&&f.estado!=='cancelada';}).length;
  var nextD=upAll.length?parseDate(upAll[0].fecha):null;
  var stats='<div class="stats"><div class="stat"><div class="v">'+upAll.length+'</div><div class="l">Ferias próximas</div></div>'+
    '<div class="stat"><div class="v">'+porConf+'</div><div class="l">Por confirmar</div></div>'+
    '<div class="stat"><div class="v txt">'+(nextD?esc(shortFmt.format(nextD).replace(/\./g,'')):'—')+'</div><div class="l">Siguiente feria</div></div></div>';
  var q=lower(state.q);
  var list=all.filter(function(f){
    if(state.estado!=='todos'&&(f.estado||'porconfirmar')!==state.estado) return false;
    if(!q) return true;
    return lower([f.nombre,f.lugar,f.responsables,f.notas].join(' ')).indexOf(q)>-1;
  }).sort(cmpFeria);
  var up=list.filter(function(f){return (f.fecha||'9999')>=t;});
  var past=list.filter(function(f){return (f.fecha||'9999')<t;}).reverse();
  var chipDefs=[['todos','Todas']].concat(Object.keys(ESTADOS).map(function(k){return [k,ESTADOS[k][0]];}));
  var toolbar='<div class="toolbar">'+searchBox('q-ferias','Buscar por feria, lugar o responsable',state.q,'Buscar ferias')+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="feria">'+ic('plus',17)+'Nueva feria</button>':'')+'</div>'+
    '<div class="fchips">'+chipDefs.map(function(c){return '<button class="fchip" data-act="estado" data-v="'+c[0]+'" aria-pressed="'+(state.estado===c[0])+'">'+c[1]+'</button>';}).join('')+'</div>';
  var body='';
  if(!all.length){
    body=emptyBlock('cal',ADMIN?'Aún no hay ferias':'Aún no hay ferias publicadas',ADMIN?'Agrega la primera con fecha, hora y responsables. Luego pulsa Publicar.':'Cuando se agreguen, las verás aquí.','<button class="btn primary" data-act="new" data-kind="feria">'+ic('plus',17)+'Agregar la primera feria</button>');
  }else if(!list.length){
    body='<p class="none">Ninguna feria coincide con la búsqueda.</p>';
  }else{
    var markNext=!state.q&&state.estado==='todos';
    if(up.length) body+='<div class="group-title">Próximas</div><div class="list">'+up.map(function(f,i){return feriaRow(f,false,markNext&&i===0&&f.estado!=='cancelada');}).join('')+'</div>';
    else body+='<p class="none">No hay ferias próximas con este filtro.</p>';
    if(past.length) body+='<details class="pastbox"><summary>Realizadas ('+past.length+')</summary><div class="list">'+past.map(function(f){return feriaRow(f,true,false);}).join('')+'</div></details>';
  }
  keepFocus('q-ferias',stats+toolbar+'<div class="stack">'+body+'</div>',el);
}
function contactRow(c){
  function line(kind,label,val){
    if(!val) return '';
    var href=kind==='mail'?'mailto:'+val:'tel:'+String(val).replace(/[^\d+]/g,'');
    return '<div class="cline"><a href="'+esc(href)+'">'+esc(val)+'</a><button class="copy" data-act="copy" data-text="'+esc(val)+'" aria-label="Copiar '+label+'">Copiar</button></div>';
  }
  var contact=line('mail','correo',c.correo)+line('tel','teléfono',c.telefono);
  return '<div class="row contact'+(ADMIN?'':' noact')+'">'+
    '<div class="cn">'+avatar(c.nombre,'lg')+'<div><div class="name">'+esc(c.nombre)+'</div>'+(c.cargo?'<div class="meta">'+esc(c.cargo)+'</div>':'')+'</div></div>'+
    '<div class="ci">'+(c.institucion?esc(c.institucion):'<span class="none">Sin institución</span>')+'</div>'+
    '<div class="cc">'+(contact||'<span class="none">Sin datos de contacto</span>')+'</div>'+
    '<div class="cx">'+esc(c.notas)+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('contacto',c.id,c.nombre)+'</div>':'')+
  '</div>';
}
function renderContactos(){
  var el=$('panel-contactos');
  if(stateBlock(el))return;
  var q=lower(state.cq);
  var insts={};state.contactos.forEach(function(c){if(c.institucion)insts[lower(c.institucion)]=1;});
  var stats='<div class="stats"><div class="stat"><div class="v">'+state.contactos.length+'</div><div class="l">Contactos</div></div>'+
    '<div class="stat"><div class="v">'+Object.keys(insts).length+'</div><div class="l">Instituciones</div></div></div>';
  var list=state.contactos.filter(function(c){
    return !q||lower([c.nombre,c.cargo,c.institucion,c.correo,c.telefono,c.notas].join(' ')).indexOf(q)>-1;
  }).sort(byName);
  var toolbar='<div class="toolbar">'+searchBox('q-contactos','Buscar por nombre, institución o correo',state.cq,'Buscar en el directorio')+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="contacto">'+ic('plus',17)+'Nuevo contacto</button>':'')+'</div>';
  var body;
  if(!state.contactos.length) body=emptyBlock('book',ADMIN?'El directorio está vacío':'El directorio aún está vacío',ADMIN?'Guarda aquí a quienes dirigen las ferias: cargo, institución, correo y teléfono.':'Cuando se agreguen contactos, los verás aquí.','<button class="btn primary" data-act="new" data-kind="contacto">'+ic('plus',17)+'Agregar el primer contacto</button>');
  else if(!list.length) body='<p class="none">Ningún contacto coincide con la búsqueda.</p>';
  else body='<div class="list">'+list.map(contactRow).join('')+'</div>';
  keepFocus('q-contactos',stats+toolbar+'<div class="stack">'+body+'</div>',el);
}
/* ---------- Cumpleaños ---------- */
var clp=new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
function money(n){return (n===''||n==null||isNaN(n))?'':clp.format(n);}
function toNum(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return (isFinite(n)&&n>=0)?Math.round(n):'';}
function daysUntil(s){var d=parseDate(s);if(!d)return null;var t=new Date();t=new Date(t.getFullYear(),t.getMonth(),t.getDate());return Math.round((d-t)/86400000);}
function dayLabel(n){return n<0?'Hace '+(-n)+(n===-1?' día':' días'):n===0?'Hoy':n===1?'Mañana':'En '+n+' días';}
function cumpleStats(c){
  var items=Array.isArray(c.items)?c.items:[],est=0,gas=0,pend=0;
  items.forEach(function(it){var v=+it.costo||0;est+=v;if(it.comprado)gas+=v;else pend++;});
  var pres=(c.presupuesto===''||c.presupuesto==null||isNaN(c.presupuesto))?null:+c.presupuesto;
  return {items:items,est:est,gas:gas,pend:pend,total:items.length,pres:pres};
}
function cumpleEvent(c){
  return {id:c.id,nombre:'Cumpleaños de '+c.nombre,fecha:c.fecha,horaInicio:'',horaFin:'',lugar:'',responsables:c.responsable||'',estado:'',material:'',notas:c.notas||'',sinEstado:true};
}
function budgetHtml(st){
  if(st.pres===null&&st.est===0) return '<span class="none">Sin presupuesto</span>';
  var h='<div class="bud-top"><b>'+money(st.pres!==null?st.pres:st.est)+'</b><span>'+(st.pres!==null?'presupuesto':'estimado')+'</span></div>';
  if(st.pres!==null&&st.pres>0){
    var pct=Math.min(100,Math.round(st.gas/st.pres*100));
    h+='<div class="bar'+(st.gas>st.pres?' over':'')+'" role="img" aria-label="Gastado '+pct+'% del presupuesto"><i style="width:'+pct+'%"></i></div>';
  }
  var sub='Gastado '+money(st.gas);
  if(st.pres!==null) sub+=st.gas>st.pres?' · <span class="neg">Excedido por '+money(st.gas-st.pres)+'</span>':' · Quedan '+money(st.pres-st.gas);
  h+='<div class="bud-sub">'+sub+'</div>';
  if(st.pres!==null&&st.est>st.pres&&st.gas<=st.pres) h+='<div class="bud-warn">Lo estimado ('+money(st.est)+') supera el presupuesto</div>';
  return h;
}
function cumpleRow(c,past,isNext){
  var st=cumpleStats(c),d=parseDate(c.fecha),n=daysUntil(c.fecha);
  var date=d?'<div class="d-num">'+d.getDate()+'</div><div class="d-mon">'+esc(monFmt.format(d).replace('.',''))+'</div><div class="d-wd">'+esc(wdFmt.format(d).replace('.',''))+'</div>':'<div class="d-num">—</div>';
  var tags='';
  if(!past&&n!==null) tags+='<span class="pill '+(n<=3?'warn':'mat')+'">'+dayLabel(n)+'</span>';
  if(st.total){
    if(!st.pend) tags+='<span class="pill ok">Todo comprado</span>';
    else tags+='<span class="pill '+((!past&&n!==null&&n<=7)?'warn':'mat')+'">'+st.pend+(st.pend===1?' compra pendiente':' compras pendientes')+'</span>';
  }
  if(isNext) tags+='<span class="tag-next">Siguiente</span>';
  var det='';
  if(st.total||c.notas){
    var label=st.total?('Compras ('+(st.total-st.pend)+'/'+st.total+')'+(c.notas?' y notas':'')):'Notas';
    var list=st.total?'<ul class="cl">'+st.items.map(function(it){
      return '<li class="'+(it.comprado?'done':'')+'"><button type="button" class="cbtn" data-act="ckbuy" data-c="'+esc(c.id)+'" data-it="'+esc(it.id)+'" role="checkbox" aria-checked="'+(!!it.comprado)+'" aria-label="'+esc(it.nombre)+(it.comprado?': comprado':': por comprar')+'">'+
        '<span class="cmark">'+(it.comprado?ic('check',13):'')+'</span><span class="cname">'+esc(it.nombre)+'</span></button><span class="ccost">'+(it.costo===''||it.costo==null?'—':money(it.costo))+'</span></li>';
    }).join('')+'</ul>':'';
    var key='c:'+c.id;
    det='<details class="notebox" data-note="'+esc(key)+'"'+(state.openNotes[key]?' open':'')+'><summary>'+label+'</summary>'+list+(c.notas?'<div class="notetext">'+esc(c.notas)+'</div>':'')+'</details>';
  }
  return '<div class="row feria cumple'+(past?' past':'')+(ADMIN?'':' noact')+'">'+
    '<div class="date">'+date+'</div>'+
    '<div class="main"><div class="name">'+esc(c.nombre)+'</div>'+(tags?'<div class="tags">'+tags+'</div>':'')+calBtn(cumpleEvent(c),past)+'</div>'+
    '<div class="bud">'+budgetHtml(st)+'</div>'+
    '<div class="who">'+people(c.responsable)+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('cumple',c.id,c.nombre)+'</div>':'')+
    det+
  '</div>';
}
function renderCumples(){
  var el=$('panel-cumpleanos');
  if(stateBlock(el))return;
  var t=todayStr(),all=state.cumpleanos.slice();
  var upAll=all.filter(function(c){return (c.fecha||'9999')>=t;}).sort(cmpFeria);
  var nx=upAll[0],stats;
  if(nx){
    var ns=cumpleStats(nx),nn=daysUntil(nx.fecha),nd=parseDate(nx.fecha);
    var faltan=ns.items.filter(function(i){return !i.comprado;}).map(function(i){return i.nombre;});
    var resp=String(nx.responsable||'').split(/\s*[,;\n]\s*|\s+y\s+/i).map(function(x){return x.trim();}).filter(Boolean);
    stats='<div class="stats"><div class="stat"><div class="v txt">'+esc(nx.nombre)+'</div><div class="l">Próximo cumpleaños · '+esc(dayLabel(nn).toLowerCase())+(nd?' ('+esc(shortFmt.format(nd).replace(/\./g,''))+')':'')+'</div></div>'+
      '<div class="stat"><div class="v txt">'+(!ns.total?'Sin compras definidas':faltan.length?esc(faltan.join(', ')):'Todo comprado')+'</div><div class="l">Falta por comprar</div></div>'+
      '<div class="stat"><div class="v txt">'+(resp.length?esc(resp.join(', ')):'Sin responsable')+'</div><div class="l">Responsable</div></div></div>';
  }else{
    stats='<div class="stats"><div class="stat"><div class="v txt">—</div><div class="l">Próximo cumpleaños</div></div><div class="stat"><div class="v txt">—</div><div class="l">Falta por comprar</div></div><div class="stat"><div class="v txt">—</div><div class="l">Responsable</div></div></div>';
  }
  var q=lower(state.cuq);
  var list=all.filter(function(c){
    if(!q) return true;
    var names=(Array.isArray(c.items)?c.items:[]).map(function(i){return i.nombre;}).join(' ');
    return lower([c.nombre,c.responsable,c.notas,names].join(' ')).indexOf(q)>-1;
  }).sort(cmpFeria);
  var up=list.filter(function(c){return (c.fecha||'9999')>=t;});
  var past=list.filter(function(c){return (c.fecha||'9999')<t;}).reverse();
  var toolbar='<div class="toolbar">'+searchBox('q-cumples','Buscar por persona, responsable o compra',state.cuq,'Buscar cumpleaños')+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="cumple">'+ic('plus',17)+'Nuevo cumpleaños</button>':'')+'</div>';
  var body='';
  if(!all.length){
    body=emptyBlock('cake',ADMIN?'Aún no hay cumpleaños':'Aún no hay cumpleaños registrados',ADMIN?'Agrega el primero con fecha, responsable, presupuesto y compras. Luego pulsa Publicar.':'Cuando se agreguen, los verás aquí.','<button class="btn primary" data-act="new" data-kind="cumple">'+ic('plus',17)+'Agregar el primer cumpleaños</button>');
  }else if(!list.length){
    body='<p class="none">Ningún cumpleaños coincide con la búsqueda.</p>';
  }else{
    var markNext=!state.cuq;
    if(up.length) body+='<div class="group-title">Próximos</div><div class="list">'+up.map(function(c,i){return cumpleRow(c,false,markNext&&i===0);}).join('')+'</div>';
    else body+='<p class="none">No hay cumpleaños próximos.</p>';
    if(past.length) body+='<details class="pastbox"><summary>Realizados ('+past.length+')</summary><div class="list">'+past.map(function(c){return cumpleRow(c,true,false);}).join('')+'</div></details>';
  }
  keepFocus('q-cumples',stats+toolbar+'<div class="stack">'+body+'</div>',el);
}
/* ---------- Inicio ---------- */
function avisoRow(a){
  var d=parseDate(a.fecha);
  var link=/^https?:\/\//i.test(a.enlace||'')?'<a class="avlink" href="'+esc(a.enlace)+'" target="_blank" rel="noopener">'+ic('link',14)+'Ver más</a>':'';
  return '<article class="aviso'+(a.importante?' imp':'')+'"><div class="avic">'+ic(a.importante?'megaphone':'check',18)+'</div><div class="avbody">'+
    '<div class="avtop"><h3>'+esc(a.titulo)+'</h3></div>'+
    (a.texto?'<p class="avtext">'+esc(a.texto)+'</p>':'')+
    '<div class="avmeta">'+(d?'<span>'+esc(shortFmt.format(d).replace(/\./g,''))+'</span>':'')+link+'</div></div>'+
    (ADMIN?'<div class="act">'+editBtn('aviso',a.id,a.titulo)+'</div>':'')+'</article>';
}
function bannerHtml(a){
  var d=parseDate(a.fecha);
  var img=/^https?:\/\//i.test(a.imagen||'')?" style=\"background-image:linear-gradient(135deg,rgba(6,60,52,.82),rgba(6,60,52,.35)),url('"+esc(encodeURI(a.imagen).replace(/'/g,'%27'))+"')\"":'';
  var link=/^https?:\/\//i.test(a.enlace||'')?'<a class="btn bnbtn" href="'+esc(a.enlace)+'" target="_blank" rel="noopener">Ver más'+ic('chev',16)+'</a>':'';
  return '<section class="banner'+(img?' hasimg':'')+(a.importante?' imp':'')+'"'+img+'>'+
    '<div class="bnlabel">'+ic('megaphone',16)+(a.importante?'Anuncio importante':'Anuncio')+(d?' · '+esc(shortFmt.format(d).replace(/\./g,'')):'')+'</div>'+
    '<h2 class="bntitle">'+esc(a.titulo)+'</h2>'+
    (a.texto?'<p class="bntext">'+esc(a.texto)+'</p>':'')+link+
    (ADMIN?'<div class="bnedit">'+editBtn('aviso',a.id,a.titulo)+'</div>':'')+'</section>';
}
function miniRow(o){
  var d=parseDate(o.fecha),n=daysUntil(o.fecha);
  var chip=d?'<div class="mdate"><b>'+d.getDate()+'</b><span>'+esc(monFmt.format(d).replace('.',''))+'</span></div>':'';
  return '<button class="mini" data-act="goto" data-tab="'+o.tab+'"'+(o.sub?' data-sub="'+o.sub+'"':'')+'>'+chip+
    '<div class="mtxt"><div class="mname">'+esc(o.nombre)+'</div><div class="msub">'+esc(o.sub2||'')+'</div></div>'+
    (o.pill?'<span class="pill '+o.pill.cls+'">'+esc(o.pill.txt)+'</span>':(n!==null?'<span class="pill '+(n<=3?'warn':'mat')+'">'+dayLabel(n)+'</span>':''))+ic('chev',16)+'</button>';
}
function renderInicio(){
  var el=$('panel-inicio');
  if(stateBlock(el))return;
  var t=todayStr();
  var fer=state.ferias.filter(function(f){return (f.fecha||'')>=t&&f.estado!=='cancelada';}).sort(cmpFeria);
  var cum=state.cumpleanos.filter(function(c){return (c.fecha||'')>=t;}).sort(cmpFeria);
  var av=state.avisos.slice().sort(function(a,b){
    if(!!a.importante!==!!b.importante) return a.importante?-1:1;
    return (b.fecha||'')<(a.fecha||'')?-1:(b.fecha||'')>(a.fecha||'')?1:0;
  });
  var more=av.length>3?'<p class="none">+ '+(av.length-3)+' aviso'+(av.length-3===1?'':'s')+' más</p>':'';
  var banner=av.length?bannerHtml(av[0]):'';
  var rest=av.slice(1);
  more=rest.length>3?'<p class="none">+ '+(rest.length-3)+' anuncio'+(rest.length-3===1?'':'s')+' más</p>':'';
  var avBlock=(ADMIN||rest.length)?'<section class="blk"><div class="blkhead"><h2>'+ic('megaphone',18)+'Novedades</h2>'+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="aviso">'+ic('plus',17)+'Nuevo anuncio</button>':'')+'</div>'+
    (rest.length?'<div class="avlist">'+rest.slice(0,3).map(avisoRow).join('')+'</div>'+more:'<p class="none">'+(av.length?'No hay más anuncios.':'Sin anuncios. Publica uno con “Nuevo anuncio”.')+'</p>')+'</section>':'';
  var c0=cum[0],f0=fer[0];
  var evs=state.eventosdo.filter(function(e){return doEnd(e)>=t;}).sort(cmpFeria),e0=evs[0];
  var pls=state.plataformas.filter(function(p){return p.renovacion;}).sort(function(a,b){return a.renovacion<b.renovacion?-1:a.renovacion>b.renovacion?1:0;});
  var p0=pls.filter(function(p){return p.renovacion>=t;})[0]||pls[pls.length-1];
  var cumBlock='<section class="blk"><div class="blkhead"><h2>'+ic('cake',18)+'Próximo cumpleaños</h2><button class="linkbtn" data-act="goto" data-tab="cumpleanos">Ver todos</button></div>'+
    (c0?'<div class="minilist">'+miniRow({tab:'cumpleanos',fecha:c0.fecha,nombre:c0.nombre,sub2:c0.responsable?'Responsable: '+c0.responsable:''})+'</div>':'<p class="none">No hay próximos.</p>')+'</section>';
  var ferBlock='<section class="blk"><div class="blkhead"><h2>'+ic('cal',18)+'Próxima feria</h2><button class="linkbtn" data-act="goto" data-tab="ferias" data-sub="calendario">Ver todas</button></div>'+
    (f0?'<div class="minilist">'+miniRow({tab:'ferias',sub:'calendario',fecha:f0.fecha,nombre:f0.nombre,sub2:f0.horaInicio?f0.horaInicio+(f0.horaFin?' – '+f0.horaFin:''):''})+'</div>':'<p class="none">No hay próximas.</p>')+'</section>';
  var evBlock='<section class="blk"><div class="blkhead"><h2>'+ic('cal',18)+'Próximo evento DO</h2><button class="linkbtn" data-act="goto" data-tab="do">Ver todos</button></div>'+
    (e0?'<div class="minilist">'+miniRow({tab:'do',fecha:e0.fecha,nombre:e0.nombre,sub2:rangeTxt(e0)||e0.horaInicio||'',pill:doStatus(e0)})+'</div>':'<p class="none">No hay próximos.</p>')+'</section>';
  var plBlock='<section class="blk"><div class="blkhead"><h2>'+ic('link',18)+'Próxima renovación</h2><button class="linkbtn" data-act="goto" data-tab="plataformas">Ver todas</button></div>'+
    (p0?'<div class="minilist">'+miniRow({tab:'plataformas',fecha:p0.renovacion,nombre:p0.nombre,sub2:''})+'</div>':'<p class="none">Sin renovaciones.</p>')+'</section>';
  var candBlock=window.CandHooks?window.CandHooks.inicioBlock():'';
  el.innerHTML=banner+candBlock+'<div class="twocol">'+ferBlock+cumBlock+evBlock+plBlock+'</div>'+avBlock;
}
/* ---------- Plataformas de reclutamiento ---------- */
function renewInfo(s){
  var n=daysUntil(s);
  if(n===null) return {txt:'Sin fecha de renovación',cls:'mat',n:null};
  if(n<0) return {txt:'Vencida hace '+(-n)+(n===-1?' día':' días'),cls:'bad',n:n};
  if(n===0) return {txt:'Renueva hoy',cls:'warn',n:n};
  if(n===1) return {txt:'Renueva mañana',cls:'warn',n:n};
  return {txt:'Renueva en '+n+' días',cls:n<=30?'warn':'ok',n:n};
}
function platRow(p){
  var d=parseDate(p.renovacion),r=renewInfo(p.renovacion);
  var date=d?'<div class="d-num">'+d.getDate()+'</div><div class="d-mon">'+esc(monFmt.format(d).replace('.',''))+'</div><div class="d-wd">'+d.getFullYear()+'</div>':'<div class="d-num">—</div>';
  var ok=/^https?:\/\//i.test(p.enlace||'');
  var open=ok?'<a class="btn openbtn" href="'+esc(p.enlace)+'" target="_blank" rel="noopener">'+ic('link',16)+'Abrir plataforma</a>':'<span class="none">Sin enlace</span>';
  return '<div class="row feria plat'+(ADMIN?'':' noact')+(r.n!==null&&r.n<0?' expired':'')+'">'+
    '<div class="date">'+date+'</div>'+
    '<div class="main"><div class="name">'+esc(p.nombre)+'</div><div class="tags"><span class="pill '+r.cls+'">'+r.txt+'</span></div></div>'+
    '<div class="bud">'+open+(p.costo!==''&&p.costo!=null?'<div class="bud-sub">'+money(p.costo)+'</div>':'')+'</div>'+
    '<div class="who">'+people(p.responsable)+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('plat',p.id,p.nombre)+'</div>':'')+
    (p.notas?'<details class="notebox" data-note="p:'+esc(p.id)+'"'+(state.openNotes['p:'+p.id]?' open':'')+'><summary>Notas</summary><div class="notetext">'+esc(p.notas)+'</div></details>':'')+
  '</div>';
}
function renderPlataformas(){
  var el=$('panel-plataformas');
  if(stateBlock(el))return;
  var q=lower(state.pq);
  var list=state.plataformas.filter(function(p){return !q||lower([p.nombre,p.responsable,p.notas].join(' ')).indexOf(q)>-1;}).sort(function(a,b){
    var x=a.renovacion||'9999',y=b.renovacion||'9999';return x<y?-1:x>y?1:0;
  });
  var toolbar='<div class="toolbar">'+searchBox('q-plat','Buscar plataforma o responsable',state.pq,'Buscar plataformas')+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="plat">'+ic('plus',17)+'Nueva plataforma</button>':'')+'</div>';
  var body;
  if(!state.plataformas.length) body=emptyBlock('link',ADMIN?'Aún no hay plataformas':'Aún no hay plataformas registradas',ADMIN?'Agrega cada plataforma de reclutamiento con su enlace y su fecha de renovación.':'Cuando se agreguen, las verás aquí.','<button class="btn primary" data-act="new" data-kind="plat">'+ic('plus',17)+'Agregar la primera plataforma</button>');
  else if(!list.length) body='<p class="none">Ninguna plataforma coincide con la búsqueda.</p>';
  else body='<div class="group-title">Por fecha de renovación</div><div class="list">'+list.map(platRow).join('')+'</div>';
  keepFocus('q-plat',toolbar+'<div class="stack">'+body+'</div>',el);
}

/* ---------- DO (Desarrollo Organizacional) ---------- */
function doEnd(f){return (f.fechaFin&&f.fechaFin>=f.fecha)?f.fechaFin:f.fecha;}
function rangeTxt(f){
  var a=parseDate(f.fecha),b=parseDate(doEnd(f));if(!a)return '';
  var m=function(d){return monFmt.format(d).replace('.','');};
  if(!b||doEnd(f)===f.fecha) return '';
  return a.getMonth()===b.getMonth()?a.getDate()+' al '+b.getDate()+' de '+m(b):a.getDate()+' '+m(a)+' al '+b.getDate()+' '+m(b);
}
function doStatus(f){
  var t=todayStr(),n=daysUntil(f.fecha),e=daysUntil(doEnd(f));
  if(n===null)return null;
  if(f.fecha<=t&&doEnd(f)>=t) return {txt:e===0?'En curso · termina hoy':'En curso · termina en '+e+(e===1?' día':' días'),cls:'ok',cur:true};
  if(doEnd(f)<t) return null;
  return {txt:dayLabel(n),cls:n<=3?'warn':'mat',cur:false};
}
function doRow(f,past,isNext){
  var d=parseDate(f.fecha);
  var date=d?'<div class="d-num">'+d.getDate()+'</div><div class="d-mon">'+esc(monFmt.format(d).replace('.',''))+'</div><div class="d-wd">'+esc(wdFmt.format(d).replace('.',''))+'</div>':'<div class="d-num">—</div>';
  var rg=rangeTxt(f);
  var hora=rg?ic('cal',16)+'<span>'+esc(rg)+'</span>':(f.horaInicio?ic('clock',16)+'<span>'+esc(f.horaInicio)+(f.horaFin?' – '+esc(f.horaFin):'')+'</span>':'<span class="none">Sin hora</span>');
  var st=past?null:doStatus(f),tags='';
  if(st) tags+='<span class="pill '+st.cls+'">'+st.txt+'</span>';
  if(f.tentativa) tags+='<span class="pill mat">Tentativa</span>';
  if(isNext) tags+='<span class="tag-next">Siguiente</span>';
  return '<div class="row feria'+(past?' past':'')+(ADMIN?'':' noact')+'">'+
    '<div class="date">'+date+'</div>'+
    '<div class="main"><div class="name">'+esc(f.nombre)+'</div>'+
      (f.lugar?'<div class="meta">'+ic('pin',15)+'<span>'+esc(f.lugar)+'</span></div>':'')+
      (tags?'<div class="tags">'+tags+'</div>':'')+calBtn(f,past)+'</div>'+
    '<div class="time">'+hora+'</div>'+
    '<div class="who">'+people(f.responsables)+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('evdo',f.id,f.nombre)+'</div>':'')+
    (f.notas?'<details class="notebox" data-note="d:'+esc(f.id)+'"'+(state.openNotes['d:'+f.id]?' open':'')+'><summary>Notas</summary><div class="notetext">'+esc(f.notas)+'</div></details>':'')+
  '</div>';
}
function renderDO(){
  var el=$('panel-do');
  if(stateBlock(el))return;
  var t=todayStr(),q=lower(state.dq);
  var list=state.eventosdo.filter(function(f){return !q||lower([f.nombre,f.lugar,f.responsables,f.notas].join(' ')).indexOf(q)>-1;}).sort(cmpFeria);
  var up=list.filter(function(f){return doEnd(f)>=t;});
  var past=list.filter(function(f){return doEnd(f)<t;}).reverse();
  var toolbar='<div class="toolbar">'+searchBox('q-do','Buscar evento, lugar o responsable',state.dq,'Buscar eventos de DO')+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="evdo">'+ic('plus',17)+'Nuevo evento</button>':'')+'</div>';
  var body='';
  if(!state.eventosdo.length) body=emptyBlock('cal',ADMIN?'Aún no hay eventos de DO':'Aún no hay eventos de DO',ADMIN?'Agrega los próximos eventos con fecha, hora, lugar y responsables.':'Cuando se agreguen, los verás aquí.','<button class="btn primary" data-act="new" data-kind="evdo">'+ic('plus',17)+'Agregar el primer evento</button>');
  else if(!list.length) body='<p class="none">Ningún evento coincide con la búsqueda.</p>';
  else{
    if(up.length) body+='<div class="group-title">Próximos</div><div class="list">'+up.map(function(f,i){return doRow(f,false,!q&&i===0);}).join('')+'</div>';
    else body+='<p class="none">No hay eventos próximos.</p>';
    if(past.length) body+='<details class="pastbox"><summary>Realizados ('+past.length+')</summary><div class="list">'+past.map(function(f){return doRow(f,true,false);}).join('')+'</div></details>';
  }
  keepFocus('q-do',toolbar+'<div class="stack">'+body+'</div>',el);
}
/* ---------- Equipo ---------- */
/* Marca de cada feria: el logo que subió el equipo o, si no hay, sus iniciales en color. */
var STOPW=/^(de|del|la|las|los|el|y|en|for|of|the|ing|ingenieria|comercial|civil|feria|ferias|entrevistas|practicantes|laboral)$/;
function feriaIni(n){
  var w=String(n||'').trim().split(/\s+/).filter(Boolean);if(!w.length)return '?';
  if(/^[A-ZÁÉÍÓÚÑ]{2,}$/.test(w[0]))return w[0].slice(0,6);
  var k=w.filter(function(x){return !STOPW.test(nz(x));});if(!k.length)k=w;
  if(k.length===1)return k[0].slice(0,2).toUpperCase();
  return (k[0].charAt(0)+k[1].charAt(0)).toUpperCase();
}
function feriaMark(f,cls){
  f=f||{};cls=cls||'';
  if(f.logo)return '<span class="fmark logo '+cls+'" aria-hidden="true"><img src="'+esc(f.logo)+'" alt=""></span>';
  var ini=feriaIni(f.nombre);
  return '<span class="fmark ini '+cls+(ini.length>3?' long':'')+'" style="--h:'+hue(ini)+'" aria-hidden="true">'+esc(ini)+'</span>';
}
function loadLogo(file){
  if(!file||!state.edit)return;
  if(file.size>5*1024*1024){ferr('La imagen pesa más de 5 MB. Usa una más liviana.');return;}
  var rd=new FileReader();
  rd.onload=function(){
    var im=new Image();
    im.onload=function(){
      /* Se ajusta entero (sin recortar) en un cuadrado de 160 px, conservando la transparencia. */
      var S=160,c=document.createElement('canvas');c.width=S;c.height=S;
      var w=im.naturalWidth||im.width||S,h=im.naturalHeight||im.height||S,k=Math.min(S/w,S/h),dw=w*k,dh=h*k;
      c.getContext('2d').drawImage(im,(S-dw)/2,(S-dh)/2,dw,dh);
      var out=c.toDataURL('image/webp',0.9);if(out.indexOf('data:image/webp')!==0)out=c.toDataURL('image/png');
      state.edit.logo=out;logoPaint();
    };
    im.onerror=function(){ferr('No se pudo leer esa imagen. Prueba con un PNG o JPG.');};
    im.src=rd.result;
  };
  rd.readAsDataURL(file);
}
function logoPaint(){var pv=$('logo-prev');if(pv)pv.innerHTML=feriaMark({nombre:val('nombre'),logo:state.edit.logo},'xl');}
function logoField(rec){
  /* Logos ya usados en otras ferias, para no tener que subirlos de nuevo. */
  var seen={},opts=state.ferias.filter(function(f){
    if(!f.logo||f.id===rec.id||seen[f.logo])return false;seen[f.logo]=1;return true;
  }).sort(function(a,b){return a.nombre.localeCompare(b.nombre,'es');});
  return '<div class="fld full"><label for="f-logofile">Logo</label><div class="photoedit"><div id="logo-prev">'+feriaMark(rec,'xl')+'</div>'+
    '<div class="photoctl"><input id="f-logofile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">'+
    (opts.length?'<select id="f-logoreuse" aria-label="Usar el logo de otra feria"><option value="">O usa el logo de otra feria…</option>'+opts.map(function(f){return '<option value="'+esc(f.id)+'">'+esc(f.nombre)+'</option>';}).join('')+'</select>':'')+
    '<button type="button" class="btn" data-act="logodel">Quitar logo</button></div></div>'+
    '<span class="hint">Sube el logo de la universidad o institución (PNG con fondo transparente se ve mejor). Se achica solo. Sin logo, se muestran las iniciales.</span></div>';
}
function photoPrev(name,foto){
  return foto?'<img class="ph lg" src="'+esc(foto)+'" alt="">':avatar(name||'?','xl');
}
function loadPhoto(file){
  if(!file||!state.edit)return;
  var rd=new FileReader();
  rd.onload=function(){
    var im=new Image();
    im.onload=function(){
      var S=256,c=document.createElement('canvas');c.width=S;c.height=S;
      var m=Math.min(im.width,im.height),sx=(im.width-m)/2,sy=(im.height-m)/2;
      var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,S,S);g.drawImage(im,sx,sy,m,m,0,0,S,S);
      state.edit.foto=c.toDataURL('image/jpeg',0.82);
      var pv=$('photo-prev');if(pv)pv.innerHTML=photoPrev(val('nombre'),state.edit.foto);
    };
    im.onerror=function(){ferr('No se pudo leer esa imagen. Prueba con otra.');};
    im.src=rd.result;
  };
  rd.readAsDataURL(file);
}
function nz(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
function splitPeople(txt){return String(txt||'').split(/\s*[,;\n]\s*|\s+y\s+/i).map(function(x){return x.trim();}).filter(Boolean);}
function tokenMatches(tok,p){
  var t=nz(tok).split(/\s+/).filter(Boolean);if(!t.length)return false;
  var words=nz(p.nombre).split(/\s+/).filter(Boolean);if(!words.length)return false;
  var al=splitPeople(p.alias).map(nz);
  if(al.indexOf(t.join(' '))>-1)return true;
  if(t.length===1){var w=t[0];return w.length>=3&&words[0].indexOf(w)===0;}
  if(words[0].indexOf(t[0])!==0)return false;
  return t.slice(1).every(function(x){return x.length>=2&&words.some(function(w,i){return i>0&&w.indexOf(x)===0;});});
}
function feriasDe(p){
  var t=todayStr(),done=[],next=[];
  state.ferias.forEach(function(f){
    if(f.estado==='cancelada'||!f.fecha)return;
    if(!splitPeople(f.responsables).some(function(tok){return tokenMatches(tok,p);}))return;
    (f.fecha<t?done:next).push(f);
  });
  done.sort(cmpFeria).reverse();next.sort(cmpFeria);
  return {done:done,next:next};
}
function feriaLi(f){var d=parseDate(f.fecha);return '<li><span class="fdate">'+(d?esc(shortFmt.format(d).replace(/\./g,'')):'')+'</span><span class="fname">'+esc(f.nombre)+'</span></li>';}
function cumpleDM(v){var m=/^(\d{2})-(\d{2})$/.exec(v||'');return m?m[2]+'-'+m[1]:'';}
var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function cargoRank(c){
  c=lower(c);
  if(/\bsub\s*gerente/.test(c))return 1;
  if(c.indexOf('gerente')>-1)return 0;
  if(c.indexOf('jefe')>-1||c.indexOf('jefa')>-1||c.indexOf('jefatura')>-1)return 2;
  if(c.indexOf('especialista')>-1)return 3;
  if(c.indexOf('analista')>-1)return 4;
  if(c.indexOf('asistente')>-1)return 5;
  return 6;
}
function byCargo(a,b){var x=cargoRank(a.cargo),y=cargoRank(b.cargo);return x!==y?x-y:byName(a,b);}
function eqCard(p){
  var cmm=/^(\d{2})-(\d{2})$/.exec(p.cumple||'');
  var bd=cmm?'<div class="cline bday">'+ic('cake',15)+'<span>Cumple el '+(+cmm[2])+' de '+MESES[+cmm[1]-1]+'</span></div>':'';
  var mail=p.correo?'<div class="cline"><a href="mailto:'+esc(p.correo)+'">'+esc(p.correo)+'</a><button class="copy" data-act="copy" data-text="'+esc(p.correo)+'" aria-label="Copiar correo">Copiar</button></div>':'';
  var tel=p.telefono?'<div class="cline"><a href="tel:'+esc(String(p.telefono).replace(/[^\d+]/g,''))+'">'+esc(p.telefono)+'</a><button class="copy" data-act="copy" data-text="'+esc(p.telefono)+'" aria-label="Copiar teléfono">Copiar</button></div>':'';
  return '<article class="pcard">'+
    '<div class="phead">'+(p.foto?'<img class="ph" src="'+esc(p.foto)+'" alt="Foto de '+esc(p.nombre)+'" loading="lazy">':avatar(p.nombre,'xl'))+
    '<div class="pinfo"><div class="name">'+esc(p.nombre)+'</div>'+(p.cargo?'<div class="meta">'+esc(p.cargo)+'</div>':'')+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('eq',p.id,p.nombre)+'</div>':'')+'</div>'+
    ((mail||tel||bd)?'<div class="pcontact">'+mail+tel+bd+'</div>':'<div class="none">Sin datos de contacto</div>')+
  '</article>';
}
function renderAsistencia(){
  var el=$('panel-asistencia');
  if(stateBlock(el))return;
  var rows=state.equipo.map(function(p){var x=feriasDe(p);return {p:p,x:x,n:x.done.length+x.next.length};})
    .sort(function(a,b){return b.n!==a.n?b.n-a.n:byCargo(a.p,b.p);});
  var tD=0,tN=0;rows.forEach(function(r){tD+=r.x.done.length;tN+=r.x.next.length;});
  var head='<div class="stats"><div class="stat"><div class="v">'+tD+'</div><div class="l">Asistencias hechas</div></div><div class="stat"><div class="v">'+tN+'</div><div class="l">Asistencias por hacer</div></div></div>';
  var body;
  if(!rows.length) body='<p class="none">Primero agrega personas en la pestaña Equipo.</p>';
  else body='<div class="group-title">Ferias por persona</div><div class="agrid">'+rows.map(function(r){
    var p=r.p,fx=r.x;
    var det=r.n?'<details class="notebox fdet" data-note="e:'+esc(p.id)+'"'+(state.openNotes['e:'+p.id]?' open':'')+'><summary>Ver ferias</summary>'+
      (fx.next.length?'<div class="flabel">Por asistir</div><ul class="flist">'+fx.next.map(feriaLi).join('')+'</ul>':'')+
      (fx.done.length?'<div class="flabel">Asistidas</div><ul class="flist">'+fx.done.map(feriaLi).join('')+'</ul>':'')+'</details>':'';
    return '<article class="acard"><div class="phead">'+(p.foto?'<img class="ph sm" src="'+esc(p.foto)+'" alt="" loading="lazy">':avatar(p.nombre,'lg'))+
      '<div class="pinfo"><div class="name">'+esc(p.nombre)+'</div>'+(p.cargo?'<div class="meta">'+esc(p.cargo)+'</div>':'')+'</div></div>'+
      '<div class="fstats"><div><b>'+fx.done.length+'</b><span>Asistidas</span></div><div><b>'+fx.next.length+'</b><span>Por asistir</span></div></div>'+det+'</article>';
  }).join('')+'</div>'+
  '<p class="hint">Se cuenta según el campo “Responsables” de cada feria. Las canceladas no cuentan. Si alguien usa un apodo que no se parece a su nombre, agrégalo en su ficha del Equipo.</p>';
  el.innerHTML=head+body;
}
function renderEquipo(){
  var el=$('panel-equipo');
  if(stateBlock(el))return;
  var q=lower(state.eq);
  var list=state.equipo.filter(function(p){return !q||lower([p.nombre,p.cargo,p.correo,p.telefono].join(' ')).indexOf(q)>-1;}).sort(byCargo);
  var toolbar='<div class="toolbar">'+searchBox('q-eq','Buscar por nombre, cargo o correo',state.eq,'Buscar en el equipo')+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="eq">'+ic('plus',17)+'Agregar persona</button>':'')+'</div>';
  var body;
  if(!state.equipo.length) body=emptyBlock('book',ADMIN?'Aún no hay personas':'Aún no hay personas registradas',ADMIN?'Agrega a cada integrante con foto, cargo, correo y teléfono.':'Cuando se agreguen, las verás aquí.','<button class="btn primary" data-act="new" data-kind="eq">'+ic('plus',17)+'Agregar la primera persona</button>');
  else if(!list.length) body='<p class="none">Nadie coincide con la búsqueda.</p>';
  else body='<div class="pgrid">'+list.map(eqCard).join('')+'</div>';
  keepFocus('q-eq',toolbar+'<div class="stack">'+body+'</div>',el);
}
function renderFoot(){
  var f=$('foot');if(!f)return;
  var h='';
  if(!ADMIN&&state.status==='ok'&&state.updated){var d=new Date(state.updated);if(!isNaN(d.getTime()))h+='<span>Datos actualizados el '+esc(fullFmt.format(d))+'</span>';}
  if(window.Sesion&&Sesion.user&&state.status==='ok')h+=ADMIN?'<a class="linkbtn" href="./">Salir del modo edición</a>':'<a class="linkbtn" href="admin.html">Editar datos</a>';
  if(window.Sesion&&Sesion.user){
    var em=lower(Sesion.email),p=state.equipo.filter(function(x){return lower(x.correo)===em;})[0];
    h+='<span class="footses">Conectado como <b>'+esc(p?p.nombre:Sesion.email)+'</b>'+
      '<button class="linkbtn" data-act="c-pass">Cambiar contraseña</button><button class="linkbtn" data-act="c-logout">Cerrar sesión</button></span>';
  }
  f.innerHTML=h;
}
function renderAll(){renderTabs();renderNotice();renderInicio();renderFerias();renderCumples();renderPlataformas();renderDO();renderJP();renderEquipo();renderAsistencia();renderContactos();renderFoot();}

/* ---------- Formulario (solo administrador) ---------- */
function fld(id,label,type,value,o){
  o=o||{};
  var input;
  if(type==='textarea') input='<textarea id="f-'+id+'">'+esc(value)+'</textarea>';
  else if(type==='select') input='<select id="f-'+id+'">'+(o.empty?'<option value="">'+o.empty+'</option>':'')+o.options.map(function(k){return '<option value="'+k+'"'+(value===k?' selected':'')+'>'+o.labels[k]+'</option>';}).join('')+'</select>';
  else input='<input id="f-'+id+'" type="'+type+'" value="'+esc(value)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.attrs?' '+o.attrs:'')+'>';
  return '<div class="fld'+(o.full?' full':'')+'"><label for="f-'+id+'">'+label+'</label>'+input+(o.hint?'<span class="hint">'+o.hint+'</span>':'')+'</div>';
}
function arrFor(kind){return kind==='jp'?state.jornadas:kind==='feria'?state.ferias:kind==='cumple'?state.cumpleanos:kind==='aviso'?state.avisos:kind==='plat'?state.plataformas:kind==='evdo'?state.eventosdo:kind==='eq'?state.equipo:state.contactos;}
function itemsHtml(){
  var its=state.edit&&state.edit.items?state.edit.items:[];
  if(!its.length) return '<p class="none">Sin artículos. Agrega torta, decoración, regalo u otros.</p>';
  return its.map(function(it,i){
    return '<div class="itrow"><input class="ck" type="checkbox" data-it="k" data-i="'+i+'"'+(it.comprado?' checked':'')+' aria-label="Comprado">'+
      '<input type="text" data-it="n" data-i="'+i+'" value="'+esc(it.nombre)+'" placeholder="Artículo" aria-label="Artículo">'+
      '<input type="number" inputmode="numeric" min="0" step="1000" data-it="c" data-i="'+i+'" value="'+esc(it.costo)+'" placeholder="Costo" aria-label="Costo en pesos">'+
      '<button type="button" class="iconbtn" data-act="itdel" data-i="'+i+'" aria-label="Quitar artículo" title="Quitar">'+ic('x',16)+'</button></div>';
  }).join('');
}
function syncItem(t){
  if(!t||!t.getAttribute||!state.edit||!state.edit.items) return false;
  var k=t.getAttribute('data-it');if(!k) return false;
  var it=state.edit.items[+t.getAttribute('data-i')];if(!it) return true;
  if(k==='n') it.nombre=t.value; else if(k==='c') it.costo=t.value; else if(k==='k') it.comprado=t.checked;
  return true;
}
function openSheet(kind,id){
  var arr=arrFor(kind);
  var rec=id?(arr.filter(function(r){return r.id===id;})[0]||{}):{};
  state.edit={kind:kind,id:id||null,items:null,L:kind==='jp'?jpLists(rec):null,foto:(kind==='eq'&&rec.foto)||'',logo:(kind==='feria'&&rec.logo)||''};state.armed=false;
  var f;
  if(kind==='jp'){
    f=jpForm(rec);
  }else if(kind==='feria'){
    f=fld('nombre','Feria o universidad','text',rec.nombre,{full:true,ph:'Ej: Feria de Postulación Universidad de Chile'})+
      fld('fecha','Fecha','date',rec.fecha)+
      fld('estado','Estado','select',rec.estado||'porconfirmar',{options:Object.keys(ESTADOS),labels:{confirmada:ESTADOS.confirmada[0],porconfirmar:ESTADOS.porconfirmar[0],cancelada:ESTADOS.cancelada[0]}})+
      fld('horaInicio','Hora de inicio','time',rec.horaInicio)+
      fld('horaFin','Hora de término','time',rec.horaFin)+
      fld('material','Material','select',rec.material||'',{options:Object.keys(MATERIALES),labels:MATERIALES,empty:'Sin definir'})+
      fld('lugar','Lugar','text',rec.lugar,{full:true,ph:'Sede, sala o dirección'})+
      fld('responsables','Responsables','text',rec.responsables,{full:true,hint:'Separa los nombres con coma o con “y”.'})+
      logoField(rec)+
      fld('notas','Notas','textarea',rec.notas,{full:true});
  }else if(kind==='eq'){
    f=fld('nombre','Nombre','text',rec.nombre,{full:true})+
      fld('cargo','Cargo','text',rec.cargo,{full:true})+
      fld('correo','Correo','email',rec.correo)+
      fld('telefono','Teléfono','tel',rec.telefono,{ph:'+56 9 1234 5678'})+
      fld('alias','Apodos (opcional)','text',rec.alias,{full:true,ph:'Ej: Ito, Edu',hint:'Cómo lo escriben en “Responsables” de las ferias. Sirve para contar sus ferias.'})+
      fld('cumple','Cumpleaños (día-mes)','text',cumpleDM(rec.cumple),{ph:'Ej: 02-04',hint:'Solo día y mes, sin año.'})+
      '<div class="fld full"><label for="f-fotofile">Foto</label><div class="photoedit"><div id="photo-prev">'+photoPrev(rec.nombre,state.edit.foto)+'</div>'+
        '<div class="photoctl"><input id="f-fotofile" type="file" accept="image/*"><button type="button" class="btn" data-act="photodel">Quitar foto</button></div></div>'+
        '<span class="hint">Se recorta cuadrada y se achica sola. Sin foto, se muestran las iniciales.</span></div>';
  }else if(kind==='plat'){
    f=fld('nombre','Plataforma','text',rec.nombre,{full:true,ph:'Ej: LinkedIn Talent, Laborum, Trabajando.com'})+
      fld('enlace','Enlace de acceso','url',rec.enlace,{full:true,ph:'https://',hint:'La página donde se entra a la plataforma.'})+
      fld('renovacion','Fecha de renovación','date',rec.renovacion)+
      fld('costo','Costo (CLP, opcional)','number',(rec.costo===''||rec.costo==null)?'':rec.costo,{attrs:'inputmode="numeric" min="0" step="1000"'})+
      fld('responsable','Responsable','text',rec.responsable,{full:true})+
      fld('notas','Notas','textarea',rec.notas,{full:true,hint:'No guardes usuarios ni contraseñas aquí: todo el equipo puede leer estas notas.'});
  }else if(kind==='evdo'){
    f=fld('nombre','Evento','text',rec.nombre,{full:true,ph:'Ej: Taller de liderazgo'})+
      fld('fecha','Fecha de inicio','date',rec.fecha)+
      fld('fechaFin','Fecha de término (si dura varios días)','date',rec.fechaFin)+
      fld('tentativa','Fechas','select',rec.tentativa?'si':'no',{options:['no','si'],labels:{no:'Confirmadas',si:'Tentativas'}})+
      fld('horaInicio','Hora de inicio','time',rec.horaInicio)+
      fld('horaFin','Hora de término','time',rec.horaFin)+
      fld('lugar','Lugar','text',rec.lugar,{full:true})+
      fld('responsables','Responsables','text',rec.responsables,{full:true})+
      fld('notas','Notas','textarea',rec.notas,{full:true});
  }else if(kind==='aviso'){
    f=fld('titulo','Título','text',rec.titulo,{full:true,ph:'Ej: Cambio de lugar de la feria UAI'})+
      fld('texto','Detalle','textarea',rec.texto,{full:true})+
      fld('fecha','Fecha del aviso','date',rec.fecha||todayStr())+
      fld('importante','Importancia','select',rec.importante?'si':'no',{options:['no','si'],labels:{no:'Normal',si:'Importante (se destaca)'}})+
      fld('enlace','Enlace (opcional)','url',rec.enlace,{full:true,ph:'https://'})+
      fld('imagen','Imagen del banner (enlace, opcional)','url',rec.imagen,{full:true,ph:'https://',hint:'Si lo dejas vacío, el banner usa el color de la app.'});
  }else if(kind==='cumple'){
    state.edit.items=id?(Array.isArray(rec.items)?rec.items.map(function(it){return {id:it.id||newId(),nombre:it.nombre||'',costo:(it.costo===''||it.costo==null)?'':it.costo,comprado:!!it.comprado};}):[]):
      ['Torta','Decoración','Regalo'].map(function(n){return {id:newId(),nombre:n,costo:'',comprado:false};});
    f=fld('nombre','Cumpleañero o cumpleañera','text',rec.nombre,{full:true,ph:'Nombre de la persona'})+
      fld('fecha','Fecha del cumpleaños','date',rec.fecha)+
      fld('presupuesto','Presupuesto (CLP)','number',(rec.presupuesto===''||rec.presupuesto==null)?'':rec.presupuesto,{ph:'Ej: 60000',attrs:'inputmode="numeric" min="0" step="1000"'})+
      fld('responsable','Responsable','text',rec.responsable,{full:true,hint:'Quién organiza. Puede ser más de una persona, separadas con coma o con “y”.'})+
      '<div class="fld full"><label>Compras</label><div class="items" id="items-editor">'+itemsHtml()+'</div>'+
        '<button type="button" class="btn additem" data-act="itadd">'+ic('plus',16)+'Agregar artículo</button>'+
        '<span class="hint">Marca la casilla cuando ya esté comprado. El costo puede quedar vacío.</span></div>'+
      fld('notas','Notas','textarea',rec.notas,{full:true});
  }else{
    f=fld('nombre','Nombre','text',rec.nombre,{full:true})+
      fld('cargo','Cargo','text',rec.cargo)+
      fld('institucion','Institución','text',rec.institucion)+
      fld('correo','Correo','email',rec.correo)+
      fld('telefono','Teléfono','tel',rec.telefono)+
      fld('notas','Notas','textarea',rec.notas,{full:true});
  }
  var title=(id?'Editar ':((kind==='feria'||kind==='plat'||kind==='jp')?'Nueva ':(kind==='eq'?'Nueva ':'Nuevo ')))+(kind==='jp'?'jornada':kind==='feria'?'feria':kind==='cumple'?'cumpleaños':kind==='aviso'?'anuncio':kind==='plat'?'plataforma':kind==='evdo'?'evento':kind==='eq'?'persona':'contacto');
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><form class="sheet'+(kind==='jp'?' wide':'')+'" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" novalidate>'+
    '<h2 id="sheet-title">'+title+'</h2><div class="fields">'+f+'</div><div class="ferr" id="ferr" role="alert"></div>'+
    '<div class="sheet-actions"><button class="btn primary" type="submit">Guardar</button><button class="btn" type="button" data-act="close">Cancelar</button>'+
    '<span class="sp"></span>'+(id?'<button class="btn danger" type="button" data-act="delete" id="del-btn">Eliminar</button>':'')+'</div></form></div>';
  var first=$('f-nombre')||$('f-titulo');if(first)first.focus();
  if(kind==='jp')jpEditorReady();
}
function closeSheet(){$('sheet-root').innerHTML='';state.edit=null;state.armed=false;}
function val(id){var e=$('f-'+id);return e?e.value.trim():'';}
function ferr(msg){var e=$('ferr');if(e)e.textContent=msg||'';}
function collect(kind){
  var d;
  if(kind==='jp'){
    d=jpCollect();if(!d)return null;
  }else if(kind==='feria'){
    d={nombre:val('nombre'),fecha:val('fecha'),estado:val('estado')||'porconfirmar',horaInicio:val('horaInicio'),horaFin:val('horaFin'),material:val('material'),lugar:val('lugar'),responsables:val('responsables'),notas:val('notas'),logo:state.edit.logo||''};
    if(!d.nombre){ferr('Escribe el nombre de la feria o la universidad.');return null;}
    if(!d.fecha){ferr('Elige la fecha de la feria.');return null;}
    if(d.horaInicio&&d.horaFin&&d.horaFin<d.horaInicio){ferr('La hora de término es anterior a la de inicio.');return null;}
  }else if(kind==='eq'){
    var cm=/^\s*(\d{1,2})\s*[-\/]\s*(\d{1,2})\s*$/.exec(val('cumple'));
    var cv='';
    if(val('cumple')){
      if(!cm||+cm[1]<1||+cm[1]>31||+cm[2]<1||+cm[2]>12){ferr('El cumpleaños va como día-mes, por ejemplo 02-04.');return null;}
      cv=pad(+cm[2])+'-'+pad(+cm[1]);
    }
    d={nombre:val('nombre'),cargo:val('cargo'),correo:val('correo'),telefono:val('telefono'),alias:val('alias'),cumple:cv,foto:state.edit.foto||''};
    if(!d.nombre){ferr('Escribe el nombre de la persona.');return null;}
  }else if(kind==='plat'){
    var pl=val('enlace');if(pl&&!/^https?:\/\//i.test(pl)) pl='https://'+pl;
    d={nombre:val('nombre'),enlace:pl,renovacion:val('renovacion'),costo:toNum(val('costo')),responsable:val('responsable'),notas:val('notas')};
    if(!d.nombre){ferr('Escribe el nombre de la plataforma.');return null;}
  }else if(kind==='evdo'){
    d={nombre:val('nombre'),fecha:val('fecha'),fechaFin:val('fechaFin'),tentativa:val('tentativa')==='si',horaInicio:val('horaInicio'),horaFin:val('horaFin'),lugar:val('lugar'),responsables:val('responsables'),notas:val('notas')};
    if(!d.nombre){ferr('Escribe el nombre del evento.');return null;}
    if(!d.fecha){ferr('Elige la fecha de inicio del evento.');return null;}
    if(d.fechaFin&&d.fechaFin<d.fecha){ferr('La fecha de término es anterior a la de inicio.');return null;}
    if(!d.fechaFin&&d.horaInicio&&d.horaFin&&d.horaFin<d.horaInicio){ferr('La hora de término es anterior a la de inicio.');return null;}
  }else if(kind==='aviso'){
    var en=val('enlace');if(en&&!/^https?:\/\//i.test(en)) en='https://'+en;
    var im=val('imagen');if(im&&!/^https?:\/\//i.test(im)) im='https://'+im;
    d={titulo:val('titulo'),texto:val('texto'),fecha:val('fecha')||todayStr(),importante:val('importante')==='si',enlace:en,imagen:im};
    if(!d.titulo){ferr('Escribe un título para el anuncio.');return null;}
  }else if(kind==='cumple'){
    var items=(state.edit.items||[]).map(function(it){return {id:it.id||newId(),nombre:String(it.nombre||'').trim(),costo:toNum(it.costo),comprado:!!it.comprado};}).filter(function(it){return it.nombre;});
    d={nombre:val('nombre'),fecha:val('fecha'),responsable:val('responsable'),presupuesto:toNum(val('presupuesto')),items:items,notas:val('notas')};
    if(!d.nombre){ferr('Escribe el nombre de la persona que cumple años.');return null;}
    if(!d.fecha){ferr('Elige la fecha del cumpleaños.');return null;}
  }else{
    d={nombre:val('nombre'),cargo:val('cargo'),institucion:val('institucion'),correo:val('correo'),telefono:val('telefono'),notas:val('notas')};
    if(!d.nombre){ferr('Escribe el nombre del contacto.');return null;}
  }
  return d;
}
function save(){
  if(!ADMIN||!state.edit)return;
  var kind=state.edit.kind;
  var data=collect(kind);if(!data)return;
  var arr=arrFor(kind);
  if(state.edit.id){
    data.id=state.edit.id;
    for(var i=0;i<arr.length;i++){if(arr[i].id===data.id){arr[i]=data;break;}}
  }else{data.id=newId();arr.push(data);}
  persist();closeSheet();renderAll();toast('Guardado. Pulsa Publicar para que el equipo lo vea.');
}
function remove(){
  if(!ADMIN||!state.edit||!state.edit.id)return;
  var b=$('del-btn');
  if(!state.armed){state.armed=true;b.textContent='Confirmar eliminación';b.classList.add('armed');return;}
  var id=state.edit.id;
  if(state.edit.kind==='feria') state.ferias=state.ferias.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='eq') state.equipo=state.equipo.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='plat') state.plataformas=state.plataformas.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='evdo') state.eventosdo=state.eventosdo.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='aviso') state.avisos=state.avisos.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='cumple') state.cumpleanos=state.cumpleanos.filter(function(r){return r.id!==id;});
  else state.contactos=state.contactos.filter(function(r){return r.id!==id;});
  persist();closeSheet();renderAll();toast('Eliminado');
}
function download(){
  var blob=new Blob([JSON.stringify(buildOut(),null,2)+'\n'],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='respaldo-datos-'+todayStr()+'.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},2000);
  toast('Respaldo descargado. Guárdalo en un lugar privado.');
}
function discard(){
  if(!state.discardArmed){state.discardArmed=true;renderNotice();return;}
  state.discardArmed=false;
  try{localStorage.removeItem(DRAFT_KEY);}catch(e){}
  load();toast('Cambios descartados');
}

/* ---------- Utilidades ---------- */
var toastTimer;
function toast(msg){
  $('toast-root').innerHTML='<div class="toast">'+esc(msg)+'</div>';
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast-root').innerHTML='';},2400);
}
function copyText(t){
  try{
    navigator.clipboard.writeText(t).then(function(){toast('Copiado');},function(){toast('No se pudo copiar');});
  }catch(e){toast('No se pudo copiar');}
}

/* ---------- Eventos ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;
  var act=b.getAttribute('data-act');
  if(act==='backdrop'){if(e.target===b)closeSheet();return;}
  if(act==='tab'){state.tab=b.getAttribute('data-tab');try{localStorage.setItem('ferias-tab',state.tab);}catch(x){}renderTabs();return;}
  if(act==='goto'){state.tab=b.getAttribute('data-tab');var gs=b.getAttribute('data-sub');if(gs){state.sub=gs;try{localStorage.setItem('ferias-sub',gs);}catch(x){}}try{localStorage.setItem('ferias-tab',state.tab);}catch(x){}renderTabs();window.scrollTo(0,0);return;}
  if(act==='sub'){state.sub=b.getAttribute('data-v');try{localStorage.setItem('ferias-sub',state.sub);}catch(x){}renderTabs();return;}
  if(act==='estado'){state.estado=b.getAttribute('data-v');renderFerias();return;}
  if(act==='new'){openSheet(b.getAttribute('data-kind'),null);return;}
  if(act==='edit'){openSheet(b.getAttribute('data-kind'),b.getAttribute('data-id'));return;}
  if(act==='close'){closeSheet();return;}
  if(act==='delete'){remove();return;}
  if(act==='copy'){copyText(b.getAttribute('data-text'));return;}
  if(act==='cal'){openCal(b.getAttribute('data-id'));return;}
  if(act==='ics'){var ff=calItem(b.getAttribute('data-id'));if(ff){downloadIcs(ff);closeSheet();}return;}
  if(act==='jpck'){toggleLlevar(b.getAttribute('data-j'),b.getAttribute('data-it'));return;}
  if(act==='jpcsv'){jpCsv(b.getAttribute('data-j'));return;}
  if(act==='ladd'){jlAdd(b.getAttribute('data-l'));return;}
  if(act==='ldel'){if(state.edit&&state.edit.L){state.edit.L[b.getAttribute('data-l')].splice(+b.getAttribute('data-i'),1);jlPaint(b.getAttribute('data-l'));}return;}
  if(act==='asisimp'){var af=$('jp-asisfile');if(af){af.value='';af.click();}return;}
  if(act==='ckbuy'){toggleBought(b.getAttribute('data-c'),b.getAttribute('data-it'));return;}
  if(act==='logodel'){if(state.edit){state.edit.logo='';logoPaint();var lf=$('f-logofile');if(lf)lf.value='';var lr=$('f-logoreuse');if(lr)lr.value='';}return;}
  if(act==='photodel'){if(state.edit){state.edit.foto='';var pv=$('photo-prev');if(pv)pv.innerHTML=photoPrev(val('nombre'),'');var fi=$('f-fotofile');if(fi)fi.value='';}return;}
  if(act==='itadd'){if(state.edit&&state.edit.items){state.edit.items.push({id:newId(),nombre:'',costo:'',comprado:false});var ed=$('items-editor');if(ed){ed.innerHTML=itemsHtml();var ins=ed.querySelectorAll('input[data-it="n"]');if(ins.length)ins[ins.length-1].focus();}}return;}
  if(act==='itdel'){if(state.edit&&state.edit.items){state.edit.items.splice(+b.getAttribute('data-i'),1);var ed2=$('items-editor');if(ed2)ed2.innerHTML=itemsHtml();}return;}
  if(act==='download'){download();return;}
  if(act==='publish'){publish();return;}
  if(act==='migrate'){migrate(null);return;}
  if(act==='migrate-file'){var mf=$('mig-file');if(mf){mf.value='';mf.click();}return;}
  if(act==='discard'){discard();return;}
});
document.addEventListener('submit',function(e){e.preventDefault();save();});
/* Recuerda qué notas están abiertas aunque la lista se vuelva a dibujar. */
document.addEventListener('toggle',function(e){
  var d=e.target;
  if(d&&d.classList&&d.classList.contains('notebox')){
    var id=d.getAttribute('data-note');
    if(d.open) state.openNotes[id]=true; else delete state.openNotes[id];
  }
},true);
document.addEventListener('input',function(e){
  if(syncItem(e.target))return;
  if(syncList(e.target))return;
  if(e.target.id&&e.target.id.indexOf('jq-')===0){state.jpq[e.target.id.slice(3)]=e.target.value;renderJP();return;}
  if(e.target.id==='q-eq'){state.eq=e.target.value;renderEquipo();}
  else if(e.target.id==='q-plat'){state.pq=e.target.value;renderPlataformas();}
  else if(e.target.id==='q-do'){state.dq=e.target.value;renderDO();}
  else if(e.target.id==='q-cumples'){state.cuq=e.target.value;renderCumples();}
  else if(e.target.id==='q-ferias'){state.q=e.target.value;renderFerias();}
  else if(e.target.id==='q-contactos'){state.cq=e.target.value;renderContactos();}
});
document.addEventListener('change',function(e){
  if(e.target&&e.target.id==='mig-file'){var fl=e.target.files&&e.target.files[0];if(fl)fl.text().then(function(t){var d=null;try{d=JSON.parse(t);}catch(x){}if(d)migrate(d);else{state.migErr='Ese archivo no parece un data.json de esta app.';renderAll();}});return;}
  if(e.target&&e.target.id==='f-fotofile'){loadPhoto(e.target.files&&e.target.files[0]);return;}
  if(e.target&&e.target.id==='jp-asisfile'){importAsis(e.target.files&&e.target.files[0]);return;}
  if(e.target&&e.target.id==='f-logofile'){loadLogo(e.target.files&&e.target.files[0]);return;}
  if(e.target&&e.target.id==='f-logoreuse'){var src=state.ferias.filter(function(x){return x.id===e.target.value;})[0];if(src&&state.edit){state.edit.logo=src.logo;logoPaint();}return;}
  syncItem(e.target);
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet();});
document.addEventListener('visibilitychange',function(){
  if(!ADMIN&&window.Sesion&&Sesion.user&&document.visibilityState==='visible'&&Date.now()-state.lastLoad>30000) load();
});

/* ---------- Puente para candidatos.js ---------- */
window.CC={feriaMark:feriaMark,state:state,ic:ic,esc:esc,toast:toast,avatar:avatar,parseDate:parseDate,todayStr:todayStr,searchBox:searchBox,keepFocus:keepFocus,
  closeSheet:closeSheet,renderTabs:renderTabs,renderInicio:renderInicio,
  renderFerias:renderFerias,
  goCand:function(){state.tab='ferias';state.sub='candidatos';try{localStorage.setItem('ferias-tab','ferias');localStorage.setItem('ferias-sub','candidatos');}catch(x){}renderTabs();},
  setTab:function(t){state.tab=t;try{localStorage.setItem('ferias-tab',t);}catch(x){}renderTabs();}};

/* ---------- Inicio ---------- */
var mig=document.createElement('input');mig.type='file';mig.id='mig-file';mig.accept='.json,application/json';mig.hidden=true;document.body.appendChild(mig);
renderAll();
if(window.Sesion){
  Sesion.on(function(u){
    if(u){load();return;}
    applyData({});state.status='loading';state.published='';state.updated='';state.remoteTs='';renderAll();
  });
}else{state.status='error';state.errMsg='No se pudo cargar la conexión con la base de datos.';renderAll();}
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
})();
