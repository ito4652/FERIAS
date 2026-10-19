(function(){
'use strict';
/* Modo "view": solo lectura (index.html). Modo "admin": edita en el navegador y descarga data.json (admin.html). */
var ADMIN=document.documentElement.getAttribute('data-mode')==='admin';
var DRAFT_KEY='ferias-borrador-v1';
var state={sub:'calendario',ferias:[],contactos:[],cumpleanos:[],avisos:[],plataformas:[],eventosdo:[],pq:'',dq:'',status:'loading',published:'',updated:'',tab:'inicio',q:'',estado:'todos',cq:'',cuq:'',
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
  chev:'<path d="m9 6 6 6-6 6"/>'
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
  return JSON.stringify(canon(o));
}
function isDirty(){return ADMIN&&state.status==='ok'&&sig()!==state.published;}
function norm(arr){return (Array.isArray(arr)?arr:[]).filter(function(r){return r&&typeof r==='object';}).map(function(r){if(!r.id)r.id=newId();return r;});}

try{var saved=localStorage.getItem('ferias-tab');if(saved==='inicio'||saved==='ferias'||saved==='cumpleanos'||saved==='plataformas'||saved==='do')state.tab=saved;else if(saved==='contactos'){state.tab='ferias';state.sub='directorio';}
  var ssub=localStorage.getItem('ferias-sub');if(ssub==='calendario'||ssub==='directorio')state.sub=ssub;}catch(e){}
$('brand').innerHTML=ic('cal',24);
if(!$('panel-inicio')){
  var pi=document.createElement('section');
  pi.id='panel-inicio';pi.className='panel';pi.setAttribute('role','tabpanel');pi.hidden=true;
  $('panel-ferias').before(pi);
}
['plataformas','do'].forEach(function(k){
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

/* ---------- Carga de datos ---------- */
async function load(){
  state.lastLoad=Date.now();
  try{
    var r=await fetch('data.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('http '+r.status);
    var d=await r.json();
    state.ferias=norm(d.ferias);state.contactos=norm(d.contactos);state.cumpleanos=norm(d.cumpleanos);state.avisos=norm(d.avisos);state.plataformas=norm(d.plataformas);state.eventosdo=norm(d.eventosdo);state.updated=d.actualizado||'';
    state.published=sig();
    var dropped=false;
    if(ADMIN){
      try{
        var raw=localStorage.getItem(DRAFT_KEY);
        if(raw){
          var dr=JSON.parse(raw);
          if(dr.base===state.published){
            /* El borrador parte de los datos publicados actuales: se conserva. */
            state.ferias=norm(dr.ferias);state.contactos=norm(dr.contactos);state.cumpleanos=norm(dr.cumpleanos);state.avisos=norm(dr.avisos);state.plataformas=norm(dr.plataformas);state.eventosdo=norm(dr.eventosdo);
            if(sig()===state.published) localStorage.removeItem(DRAFT_KEY);
          }else{
            /* Los datos publicados cambiaron desde que se hizo el borrador: se usan los publicados. */
            localStorage.removeItem(DRAFT_KEY);dropped=true;
          }
        }
      }catch(e){}
    }
    state.status='ok';
    renderAll();
    if(dropped) toast('Se cargaron los datos publicados más recientes');
    return;
  }catch(e){
    if(state.status!=='ok') state.status='error';
  }
  renderAll();
}
function persist(){
  if(!ADMIN)return;
  try{
    if(sig()===state.published) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY,JSON.stringify({base:state.published,ferias:state.ferias,contactos:state.contactos,cumpleanos:state.cumpleanos,avisos:state.avisos,plataformas:state.plataformas,eventosdo:state.eventosdo}));
  }catch(e){}
}

/* ---------- Render ---------- */
function renderTabs(){
  var ok=state.status==='ok';
  $('tabs').innerHTML=
    '<button class="tab" role="tab" data-act="tab" data-tab="inicio" aria-selected="'+(state.tab==='inicio')+'">Inicio</button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="ferias" aria-selected="'+(state.tab==='ferias')+'">Ferias<span class="n">'+(ok?state.ferias.length:'')+'</span></button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="cumpleanos" aria-selected="'+(state.tab==='cumpleanos')+'">Cumpleaños<span class="n">'+(ok?state.cumpleanos.length:'')+'</span></button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="do" aria-selected="'+(state.tab==='do')+'">DO</button>'+
    '<button class="tab" role="tab" data-act="tab" data-tab="plataformas" aria-selected="'+(state.tab==='plataformas')+'">Plataformas</button>';
  var sel=$('tabs').querySelector('[aria-selected="true"]');if(sel&&sel.scrollIntoView){try{sel.scrollIntoView({inline:'center',block:'nearest'});}catch(e){}}
  var sb=$('subtabs');
  sb.hidden=state.tab!=='ferias';
  sb.innerHTML='<button class="fchip" role="tab" data-act="sub" data-v="calendario" aria-selected="'+(state.sub==='calendario')+'" aria-pressed="'+(state.sub==='calendario')+'">Calendario</button>'+
    '<button class="fchip" role="tab" data-act="sub" data-v="directorio" aria-selected="'+(state.sub==='directorio')+'" aria-pressed="'+(state.sub==='directorio')+'">Directorio'+(ok?' · '+state.contactos.length:'')+'</button>';
  $('panel-ferias').hidden=!(state.tab==='ferias'&&state.sub==='calendario');
  $('panel-inicio').hidden=state.tab!=='inicio';
  $('panel-cumpleanos').hidden=state.tab!=='cumpleanos';
  $('panel-plataformas').hidden=state.tab!=='plataformas';
  $('panel-do').hidden=state.tab!=='do';
  $('panel-contactos').hidden=!(state.tab==='ferias'&&state.sub==='directorio');
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
      '<div class="tags"><span class="pill '+est[1]+'">'+est[0]+'</span>'+
        (MATERIALES[f.material]?'<span class="pill mat'+(f.material==='nada'?' none-mat':'')+'">'+MATERIALES[f.material]+'</span>':'')+
        (isNext?'<span class="tag-next">Siguiente</span>':'')+'</div>'+calBtn(f,past)+'</div>'+
    '<div class="time">'+hora+'</div>'+
    '<div class="who">'+people(f.responsables)+'</div>'+
    (ADMIN?'<div class="act">'+editBtn('feria',f.id,f.nombre)+'</div>':'')+
    (f.notas?'<details class="notebox" data-note="'+esc(f.id)+'"'+(state.openNotes[f.id]?' open':'')+'><summary>Notas</summary><div class="notetext">'+esc(f.notas)+'</div></details>':'')+
  '</div>';
}
/* ---------- Calendario ---------- */
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
  var a=document.createElement('a');a.href=url;a.download=slug(f.nombre)+'.ics';document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},2000);
  toast('Archivo descargado. Ábrelo para agregarlo al calendario.');
}
function calItem(id){
  var f=state.ferias.filter(function(r){return r.id===id;})[0];if(f)return f;
  var e=state.eventosdo.filter(function(r){return r.id===id;})[0];if(e){var o={};for(var k in e)o[k]=e[k];o.sinEstado=true;return o;}
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
    '<div class="calopts"><a class="btn primary" href="'+esc(googleUrl(f))+'" target="_blank" rel="noopener">Google Calendar</a>'+
    '<button class="btn" type="button" data-act="ics" data-id="'+esc(f.id)+'">Apple u otro calendario (.ics)</button></div>'+
    '<p class="hint">'+(f.horaInicio?'':(f.sinEstado?'Se agrega como evento de todo el día. ':'Esta feria aún no tiene hora, así que se agrega como evento de todo el día. '))+
    'El archivo .ics incluye un aviso el día anterior. En Google Calendar el aviso depende de tu configuración.</p>'+
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
      return '<li class="'+(it.comprado?'done':'')+'"><span class="cmark">'+(it.comprado?ic('check',13):'')+'</span><span class="cname">'+esc(it.nombre)+'</span><span class="ccost">'+(it.costo===''||it.costo==null?'—':money(it.costo))+'</span></li>';
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
    body=emptyBlock('cake',ADMIN?'Aún no hay cumpleaños':'Aún no hay cumpleaños registrados',ADMIN?'Agrega el primero con fecha, responsable, presupuesto y compras. Luego descarga data.json para publicarlo.':'Cuando se agreguen, los verás aquí.','<button class="btn primary" data-act="new" data-kind="cumple">'+ic('plus',17)+'Agregar el primer cumpleaños</button>');
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
  var avBlock='<section class="blk"><div class="blkhead"><h2>'+ic('megaphone',18)+'Novedades</h2>'+
    (ADMIN?'<button class="btn primary" data-act="new" data-kind="aviso">'+ic('plus',17)+'Nuevo aviso</button>':'')+'</div>'+
    (av.length?'<div class="avlist">'+av.slice(0,3).map(avisoRow).join('')+'</div>'+more:'<p class="none">'+(ADMIN?'Sin avisos. Publica uno con “Nuevo aviso”.':'Sin novedades por ahora.')+'</p>')+'</section>';
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
  el.innerHTML='<div class="twocol">'+ferBlock+cumBlock+evBlock+plBlock+'</div>'+avBlock;
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
function renderFoot(){
  var f=$('foot');if(!f)return;
  if(ADMIN||state.status!=='ok'||!state.updated){f.textContent='';return;}
  var d=new Date(state.updated);
  f.textContent=isNaN(d.getTime())?'':'Datos actualizados el '+fullFmt.format(d);
}
function renderAll(){renderTabs();renderNotice();renderInicio();renderFerias();renderCumples();renderPlataformas();renderDO();renderContactos();renderFoot();}

/* ---------- Formulario (solo administrador) ---------- */
function fld(id,label,type,value,o){
  o=o||{};
  var input;
  if(type==='textarea') input='<textarea id="f-'+id+'">'+esc(value)+'</textarea>';
  else if(type==='select') input='<select id="f-'+id+'">'+(o.empty?'<option value="">'+o.empty+'</option>':'')+o.options.map(function(k){return '<option value="'+k+'"'+(value===k?' selected':'')+'>'+o.labels[k]+'</option>';}).join('')+'</select>';
  else input='<input id="f-'+id+'" type="'+type+'" value="'+esc(value)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.attrs?' '+o.attrs:'')+'>';
  return '<div class="fld'+(o.full?' full':'')+'"><label for="f-'+id+'">'+label+'</label>'+input+(o.hint?'<span class="hint">'+o.hint+'</span>':'')+'</div>';
}
function arrFor(kind){return kind==='feria'?state.ferias:kind==='cumple'?state.cumpleanos:kind==='aviso'?state.avisos:kind==='plat'?state.plataformas:kind==='evdo'?state.eventosdo:state.contactos;}
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
  state.edit={kind:kind,id:id||null,items:null};state.armed=false;
  var f;
  if(kind==='feria'){
    f=fld('nombre','Feria o universidad','text',rec.nombre,{full:true,ph:'Ej: Feria de Postulación Universidad de Chile'})+
      fld('fecha','Fecha','date',rec.fecha)+
      fld('estado','Estado','select',rec.estado||'porconfirmar',{options:Object.keys(ESTADOS),labels:{confirmada:ESTADOS.confirmada[0],porconfirmar:ESTADOS.porconfirmar[0],cancelada:ESTADOS.cancelada[0]}})+
      fld('horaInicio','Hora de inicio','time',rec.horaInicio)+
      fld('horaFin','Hora de término','time',rec.horaFin)+
      fld('material','Material','select',rec.material||'',{options:Object.keys(MATERIALES),labels:MATERIALES,empty:'Sin definir'})+
      fld('lugar','Lugar','text',rec.lugar,{full:true,ph:'Sede, sala o dirección'})+
      fld('responsables','Responsables','text',rec.responsables,{full:true,hint:'Separa los nombres con coma o con “y”.'})+
      fld('notas','Notas','textarea',rec.notas,{full:true});
  }else if(kind==='plat'){
    f=fld('nombre','Plataforma','text',rec.nombre,{full:true,ph:'Ej: LinkedIn Talent, Laborum, Trabajando.com'})+
      fld('enlace','Enlace de acceso','url',rec.enlace,{full:true,ph:'https://',hint:'La página donde se entra a la plataforma.'})+
      fld('renovacion','Fecha de renovación','date',rec.renovacion)+
      fld('costo','Costo (CLP, opcional)','number',(rec.costo===''||rec.costo==null)?'':rec.costo,{attrs:'inputmode="numeric" min="0" step="1000"'})+
      fld('responsable','Responsable','text',rec.responsable,{full:true})+
      fld('notas','Notas','textarea',rec.notas,{full:true,hint:'No guardes usuarios ni contraseñas aquí: el repositorio es público.'});
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
      fld('enlace','Enlace (opcional)','url',rec.enlace,{full:true,ph:'https://'});
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
  var title=(id?'Editar ':((kind==='feria'||kind==='plat')?'Nueva ':'Nuevo '))+(kind==='feria'?'feria':kind==='cumple'?'cumpleaños':kind==='aviso'?'aviso':kind==='plat'?'plataforma':kind==='evdo'?'evento':'contacto');
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><form class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" novalidate>'+
    '<h2 id="sheet-title">'+title+'</h2><div class="fields">'+f+'</div><div class="ferr" id="ferr" role="alert"></div>'+
    '<div class="sheet-actions"><button class="btn primary" type="submit">Guardar</button><button class="btn" type="button" data-act="close">Cancelar</button>'+
    '<span class="sp"></span>'+(id?'<button class="btn danger" type="button" data-act="delete" id="del-btn">Eliminar</button>':'')+'</div></form></div>';
  var first=$('f-nombre')||$('f-titulo');if(first)first.focus();
}
function closeSheet(){$('sheet-root').innerHTML='';state.edit=null;state.armed=false;}
function val(id){var e=$('f-'+id);return e?e.value.trim():'';}
function ferr(msg){var e=$('ferr');if(e)e.textContent=msg||'';}
function collect(kind){
  var d;
  if(kind==='feria'){
    d={nombre:val('nombre'),fecha:val('fecha'),estado:val('estado')||'porconfirmar',horaInicio:val('horaInicio'),horaFin:val('horaFin'),material:val('material'),lugar:val('lugar'),responsables:val('responsables'),notas:val('notas')};
    if(!d.nombre){ferr('Escribe el nombre de la feria o la universidad.');return null;}
    if(!d.fecha){ferr('Elige la fecha de la feria.');return null;}
    if(d.horaInicio&&d.horaFin&&d.horaFin<d.horaInicio){ferr('La hora de término es anterior a la de inicio.');return null;}
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
    d={titulo:val('titulo'),texto:val('texto'),fecha:val('fecha')||todayStr(),importante:val('importante')==='si',enlace:en};
    if(!d.titulo){ferr('Escribe un título para el aviso.');return null;}
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
  persist();closeSheet();renderAll();toast('Guardado en este navegador');
}
function remove(){
  if(!ADMIN||!state.edit||!state.edit.id)return;
  var b=$('del-btn');
  if(!state.armed){state.armed=true;b.textContent='Confirmar eliminación';b.classList.add('armed');return;}
  var id=state.edit.id;
  if(state.edit.kind==='feria') state.ferias=state.ferias.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='plat') state.plataformas=state.plataformas.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='evdo') state.eventosdo=state.eventosdo.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='aviso') state.avisos=state.avisos.filter(function(r){return r.id!==id;});
  else if(state.edit.kind==='cumple') state.cumpleanos=state.cumpleanos.filter(function(r){return r.id!==id;});
  else state.contactos=state.contactos.filter(function(r){return r.id!==id;});
  persist();closeSheet();renderAll();toast('Eliminado');
}
function download(){
  var out={actualizado:new Date().toISOString(),ferias:state.ferias.slice().sort(cmpFeria),cumpleanos:state.cumpleanos.slice().sort(cmpFeria),avisos:state.avisos.slice().sort(byId),plataformas:state.plataformas.slice().sort(byName),eventosdo:state.eventosdo.slice().sort(cmpFeria),contactos:state.contactos.slice().sort(byName)};
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
  if(act==='itadd'){if(state.edit&&state.edit.items){state.edit.items.push({id:newId(),nombre:'',costo:'',comprado:false});var ed=$('items-editor');if(ed){ed.innerHTML=itemsHtml();var ins=ed.querySelectorAll('input[data-it="n"]');if(ins.length)ins[ins.length-1].focus();}}return;}
  if(act==='itdel'){if(state.edit&&state.edit.items){state.edit.items.splice(+b.getAttribute('data-i'),1);var ed2=$('items-editor');if(ed2)ed2.innerHTML=itemsHtml();}return;}
  if(act==='download'){download();return;}
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
  if(e.target.id==='q-plat'){state.pq=e.target.value;renderPlataformas();}
  else if(e.target.id==='q-do'){state.dq=e.target.value;renderDO();}
  else if(e.target.id==='q-cumples'){state.cuq=e.target.value;renderCumples();}
  else if(e.target.id==='q-ferias'){state.q=e.target.value;renderFerias();}
  else if(e.target.id==='q-contactos'){state.cq=e.target.value;renderContactos();}
});
document.addEventListener('change',function(e){syncItem(e.target);});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeSheet();});
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
