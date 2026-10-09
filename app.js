(function(){
'use strict';
/* Modo "view": solo lectura (index.html). Modo "admin": edita en el navegador y descarga data.json (admin.html). */
var ADMIN=document.documentElement.getAttribute('data-mode')==='admin';
var DRAFT_KEY='ferias-borrador-v1';
var state={ferias:[],contactos:[],status:'loading',published:'',updated:'',tab:'ferias',q:'',estado:'todos',cq:'',
  edit:null,armed:false,discardArmed:false,lastLoad:0};
var ESTADOS={confirmada:['Confirmada','ok'],porconfirmar:['Por confirmar','warn'],cancelada:['Cancelada','bad']};
var wdFmt=new Intl.DateTimeFormat('es-CL',{weekday:'short'});
var monFmt=new Intl.DateTimeFormat('es-CL',{month:'short'});
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
  down:'<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>'
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
function sig(){return JSON.stringify(canon({ferias:state.ferias.slice().sort(byId),contactos:state.contactos.slice().sort(byId)}));}
function isDirty(){return ADMIN&&state.status==='ok'&&sig()!==state.published;}
function norm(arr){return (Array.isArray(arr)?arr:[]).filter(function(r){return r&&typeof r==='object';}).map(function(r){if(!r.id)r.id=newId();return r;});}

try{var saved=localStorage.getItem('ferias-tab');if(saved==='ferias'||saved==='contactos')state.tab=saved;}catch(e){}
$('brand').innerHTML=ic('cal',24);

/* ---------- Carga de datos ---------- */
async function load(){
  state.lastLoad=Date.now();
  try{
    var r=await fetch('data.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('http '+r.status);
    var d=await r.json();
    state.ferias=norm(d.ferias);state.contactos=norm(d.contactos);state.updated=d.actualizado||'';
    state.published=sig();
    if(ADMIN){
      try{
        var raw=localStorage.getItem(DRAFT_KEY);
        if(raw){
          var dr=JSON.parse(raw);
          state.ferias=norm(dr.ferias);state.contactos=norm(dr.contactos);
          if(sig()===state.published) localStorage.removeItem(DRAFT_KEY);
        }
      }catch(e){}
    }
    state.status='ok';
  }catch(e){
    if(state.status!=='ok') state.status='error';
  }
  renderAll();
}
function persist(){
  if(!ADMIN)return;
  try{
    if(sig()===state.published) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY,JSON.stringify({ferias:state.ferias,contactos:state.contactos}));
  }catch(e){}
}

/* ---------- Render ---------- */
function renderTabs(){
  var ok=state.status==='ok';
  $('tabs').innerHTML=
    '<button class="tab" role="tab" data-act="tab" data-tab="ferias" aria-selected="'+(state.tab==='ferias')+'">Ferias<span class="n">'+(ok?state.ferias.length:'')+'</span></button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="contactos" aria-selected="'+(state.tab==='contactos')+'">Directorio<span class="n">'+(ok?state.contactos.length:'')+'</span></button>';
  $('panel-ferias').hidden=state.tab!=='ferias';
  $('panel-contactos').hidden=state.tab!=='contactos';
}
function renderNotice(){
  var h='';
  if(state.status==='error') h='<div class="notice">No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.</div>';
  else if(ADMIN&&state.status==='ok'){
    var dirty=isDirty();
    h='<div class="adminbar"><div class="txt"><b>Modo administrador.</b> Los cambios se guardan solo en este navegador. Para publicarlos, descarga data.json y súbelo a GitHub.</div>'+
      '<div class="adm-actions">'+(dirty?'<span class="pill warn">Cambios sin publicar</span>':'')+
      (dirty?'<button class="btn" data-act="discard">'+(state.discardArmed?'¿Seguro? Descartar':'Descartar cambios')+'</button>':'')+
      '<button class="btn primary" data-act="download">'+ic('down',17)+'Descargar data.json</button></div></div>';
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
    '<div class="main"><div class="name">'+esc(f.nombre)+'</div>'+
      (f.lugar?'<div class="meta">'+ic('pin',15)+'<span>'+esc(f.lugar)+'</span></div>':'')+
      '<div class="tags"><span class="pill '+est[1]+'">'+est[0]+'</span>'+(isNext?'<span class="tag-next">Siguiente</span>':'')+'</div>'+
      (f.notas?'<div class="notes">'+esc(f.notas)+'</div>':'')+'</div>'+
    '<div class="time">'+hora+'</div>'+
    '<div class="who">'+people(f.responsables)+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('feria',f.id,f.nombre)+'</div>':'')+
  '</div>';
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
  if(state.status==='error'){el.innerHTML='<div class="empty"><div class="badge">'+ic('cal',24)+'</div><h2>Sin conexión</h2><p>No se pudo cargar el calendario. Vuelve a abrir la app cuando tengas internet.</p></div>';return true;}
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
    body=emptyBlock('cal',ADMIN?'Aún no hay ferias':'Aún no hay ferias publicadas',ADMIN?'Agrega la primera con fecha, hora y responsables. Luego descarga data.json para publicarla.':'Cuando se agreguen, las verás aquí.','<button class="btn primary" data-act="new" data-kind="feria">'+ic('plus',17)+'Agregar la primera feria</button>');
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
function renderFoot(){
  var f=$('foot');if(!f)return;
  if(ADMIN||state.status!=='ok'||!state.updated){f.textContent='';return;}
  var d=new Date(state.updated);
  f.textContent=isNaN(d.getTime())?'':'Datos actualizados el '+fullFmt.format(d);
}
function renderAll(){renderTabs();renderNotice();renderFerias();renderContactos();renderFoot();}

/* ---------- Formulario (solo administrador) ---------- */
function fld(id,label,type,value,o){
  o=o||{};
  var input;
  if(type==='textarea') input='<textarea id="f-'+id+'">'+esc(value)+'</textarea>';
  else if(type==='select') input='<select id="f-'+id+'">'+o.options.map(function(k){return '<option value="'+k+'"'+(value===k?' selected':'')+'>'+ESTADOS[k][0]+'</option>';}).join('')+'</select>';
  else input='<input id="f-'+id+'" type="'+type+'" value="'+esc(value)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+'>';
  return '<div class="fld'+(o.full?' full':'')+'"><label for="f-'+id+'">'+label+'</label>'+input+(o.hint?'<span class="hint">'+o.hint+'</span>':'')+'</div>';
}
function openSheet(kind,id){
  var arr=kind==='feria'?state.ferias:state.contactos;
  var rec=id?(arr.filter(function(r){return r.id===id;})[0]||{}):{};
  state.edit={kind:kind,id:id||null};state.armed=false;
  var f;
  if(kind==='feria'){
    f=fld('nombre','Feria o universidad','text',rec.nombre,{full:true,ph:'Ej: Feria de Postulación Universidad de Chile'})+
      fld('fecha','Fecha','date',rec.fecha)+
      fld('estado','Estado','select',rec.estado||'porconfirmar',{options:Object.keys(ESTADOS)})+
      fld('horaInicio','Hora de inicio','time',rec.horaInicio)+
      fld('horaFin','Hora de término','time',rec.horaFin)+
      fld('lugar','Lugar','text',rec.lugar,{full:true,ph:'Sede, sala o dirección'})+
      fld('responsables','Responsables','text',rec.responsables,{full:true,hint:'Separa los nombres con coma o con “y”.'})+
      fld('notas','Notas','textarea',rec.notas,{full:true});
  }else{
    f=fld('nombre','Nombre','text',rec.nombre,{full:true})+
      fld('cargo','Cargo','text',rec.cargo)+
      fld('institucion','Institución','text',rec.institucion)+
      fld('correo','Correo','email',rec.correo)+
      fld('telefono','Teléfono','tel',rec.telefono)+
      fld('notas','Notas','textarea',rec.notas,{full:true});
  }
  var title=(id?'Editar ':'Nueva ')+(kind==='feria'?'feria':'contacto');
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><form class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" novalidate>'+
    '<h2 id="sheet-title">'+title+'</h2><div class="fields">'+f+'</div><div class="ferr" id="ferr" role="alert"></div>'+
    '<div class="sheet-actions"><button class="btn primary" type="submit">Guardar</button><button class="btn" type="button" data-act="close">Cancelar</button>'+
    '<span class="sp"></span>'+(id?'<button class="btn danger" type="button" data-act="delete" id="del-btn">Eliminar</button>':'')+'</div></form></div>';
  var first=$('f-nombre');if(first)first.focus();
}
function closeSheet(){$('sheet-root').innerHTML='';state.edit=null;state.armed=false;}
function val(id){var e=$('f-'+id);return e?e.value.trim():'';}
function ferr(msg){var e=$('ferr');if(e)e.textContent=msg||'';}
function collect(kind){
  var d;
  if(kind==='feria'){
    d={nombre:val('nombre'),fecha:val('fecha'),estado:val('estado')||'porconfirmar',horaInicio:val('horaInicio'),horaFin:val('horaFin'),lugar:val('lugar'),responsables:val('responsables'),notas:val('notas')};
    if(!d.nombre){ferr('Escribe el nombre de la feria o la universidad.');return null;}
    if(!d.fecha){ferr('Elige la fecha de la feria.');return null;}
    if(d.horaInicio&&d.horaFin&&d.horaFin<d.horaInicio){ferr('La hora de término es anterior a la de inicio.');return null;}
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
  var arr=kind==='feria'?state.ferias:state.contactos;
  if(state.edit.id){
    data.id=state.edit.id;
    for(var i=0;i<arr.length;i++){if(arr[i].id===data.id){arr[i]=data;break;}}
  }else{data.id=newId();arr.push(data);}
  persist();closeSheet();renderAll();toast('Guardado en este navegador');
}
function remove(){
  if(!ADMIN||!state.edit||!state.edit.id)return;
  var b=$('del-btn');
  if(!state.armed){state.armed=true;b.textContent='Confirmar eliminación';b.classList.add('armed');return;}
  var id=state.edit.id;
  if(state.edit.kind==='feria') state.ferias=state.ferias.filter(function(r){return r.id!==id;});
  else state.contactos=state.contactos.filter(function(r){return r.id!==id;});
  persist();closeSheet();renderAll();toast('Eliminado');
}
function download(){
  var out={actualizado:new Date().toISOString(),ferias:state.ferias.slice().sort(cmpFeria),contactos:state.contactos.slice().sort(byName)};
  var blob=new Blob([JSON.stringify(out,null,2)+'\n'],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='data.json';document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},2000);
  toast('Descargado. Súbelo a GitHub para publicar.');
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
  if(act==='estado'){state.estado=b.getAttribute('data-v');renderFerias();return;}
  if(act==='new'){openSheet(b.getAttribute('data-kind'),null);return;}
  if(act==='edit'){openSheet(b.getAttribute('data-kind'),b.getAttribute('data-id'));return;}
  if(act==='close'){closeSheet();return;}
  if(act==='delete'){remove();return;}
  if(act==='copy'){copyText(b.getAttribute('data-text'));return;}
  if(act==='download'){download();return;}
  if(act==='discard'){discard();return;}
});
document.addEventListener('submit',function(e){e.preventDefault();save();});
document.addEventListener('input',function(e){
  if(e.target.id==='q-ferias'){state.q=e.target.value;renderFerias();}
  else if(e.target.id==='q-contactos'){state.cq=e.target.value;renderContactos();}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&state.edit)closeSheet();});
document.addEventListener('visibilitychange',function(){
  if(!ADMIN&&document.visibilityState==='visible'&&Date.now()-state.lastLoad>30000) load();
});

/* ---------- Inicio ---------- */
renderAll();
load();
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
})();
