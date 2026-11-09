/* Candidatos de ferias: fichas en una base de datos de Supabase y CV en un almacenamiento privado.
   Nada de esto pasa por GitHub: el repositorio es público, los datos de candidatos no.
   Requiere: supabase.min.js, candidatos-config.js, sesion.js (conexión e ingreso) y app.js (que expone window.CC). */
(function(){
'use strict';
var CC=window.CC;if(!CC)return;
var CFG=window.CAND_CONFIG||{};
var ic=CC.ic,esc=CC.esc,toast=CC.toast;
function $(id){return document.getElementById(id);}
function pad(n){return n<10?'0'+n:''+n;}
function lower(s){return String(s||'').toLowerCase();}
var ALERT_DAYS=+CFG.alertDays||30;
var configured=!!window.SB;
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
  upload:'<path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'
};
function ci(name,size){size=size||18;return '<svg class="ic" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[name]+'</svg>';}

var S={status:configured?'starting':'unconfigured',user:null,items:[],error:'',
  q:'',filtro:'todos',open:{},edit:null,file:null,busy:false,delArmed:false,lastLoad:0};

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
  if(!configured||!window.Sesion){S.status=configured?'error':'unconfigured';repaint();return;}
  sb=window.SB;
  Sesion.on(function(u){
    S.user=u;
    if(!u){S.items=[];S.status='idle';repaint();return;}
    loadAll();
  });
}
function fromRow(r){
  return {id:r.id,nombre:r.nombre||'',feria:r.feria||'',feriaId:r.feria_id||'',universidad:r.universidad||'',carrera:r.carrera||'',
    tipo:r.tipo||'',buscaDesde:r.busca_desde||'',nivel:r.nivel||'',area:r.area_interes||'',duracion:r.duracion||'',correo:r.correo||'',telefono:r.telefono||'',
    evaluacion:r.evaluacion==null?'':String(r.evaluacion),estado:r.estado||'Por contactar',notas:r.notas||'',
    cvPath:r.cv_path||'',cvNombre:r.cv_nombre||'',entrevistador:r.entrevistador||'',consentimiento:!!r.consentimiento,creado:r.creado||''};
}
function nul(v){return v===''||v==null?null:v;}
function toRow(c){
  return {nombre:c.nombre,feria:nul(c.feria),feria_id:nul(c.feriaId),universidad:nul(c.universidad),carrera:nul(c.carrera),tipo:nul(c.tipo),
    busca_desde:nul(c.buscaDesde),nivel:nul(c.nivel),area_interes:nul(c.area),duracion:nul(c.duracion),correo:nul(c.correo),telefono:nul(c.telefono),evaluacion:c.evaluacion===''?null:+c.evaluacion,
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
function row(c,inGroup){
  var a=isAlert(c);
  var sub=[c.carrera,c.nivel,c.universidad].filter(Boolean).join(', ');
  var contact=(c.correo?'<a href="mailto:'+esc(c.correo)+'">'+ci('mail',14)+esc(c.correo)+'</a>':'')+
    (c.telefono?'<a href="tel:'+esc(c.telefono.replace(/[^\d+]/g,''))+'">'+ci('phone',14)+esc(c.telefono)+'</a>':'');
  var cv=c.cvPath?'<button class="iconbtn" data-act="c-cv" data-path="'+esc(c.cvPath)+'" title="Ver CV" aria-label="Ver CV de '+esc(c.nombre)+'">'+ci('file',17)+'</button>':'';
  return '<div class="row cand'+(a?' alert':'')+(c.estado==='Descartado'?' past':'')+'">'+
    '<div class="cn">'+CC.avatar(c.nombre||'?','lg')+'<div><div class="name">'+esc(c.nombre)+'</div>'+(sub?'<div class="csub">'+esc(sub)+'</div>':'')+'</div></div>'+
    '<div class="cf">'+(c.feria&&!inGroup?'<span class="cline">'+ic('cal',14)+esc(c.feria)+'</span>':'')+(contact?'<span class="ccontact">'+contact+'</span>':'')+
      ((c.area||c.duracion)?'<span class="carea">'+esc([c.area?'Interés: '+c.area:'',c.duracion?'Práctica de '+c.duracion:''].filter(Boolean).join('. '))+'</span>':'')+'</div>'+
    '<div class="cw">'+buscaPill(c)+'<span class="pill '+(ESTADO_CLS[c.estado]||'mat')+'">'+esc(c.estado)+'</span>'+stars(c.evaluacion)+
      (c.consentimiento?'':'<span class="pill bad" title="Falta registrar que el candidato autorizó guardar sus datos">Sin autorización</span>')+
      (a?'<button class="calbtn" data-act="c-contacted" data-id="'+esc(c.id)+'">'+ic('check',15)+'Marcar contactado</button>':'')+'</div>'+
    '<div class="act">'+cv+'<button class="iconbtn" data-act="c-edit" data-id="'+esc(c.id)+'" aria-label="Editar '+esc(c.nombre)+'" title="Editar">'+ic('pencil',17)+'</button></div>'+
    ((c.notas||c.entrevistador)?'<details class="notebox"><summary>Notas</summary><div class="notetext">'+esc(c.notas||'Sin notas.')+(c.entrevistador?'\n\nEntrevistó: '+esc(c.entrevistador):'')+'</div></details>':'')+
  '</div>';
}
/* Candidatos agrupados por feria, en tarjetas plegables. Dentro de cada feria: primero a quién contactar ahora. */
var fechaFeria=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'});
function groups(list,byNew){
  var G={},order=[];
  list.forEach(function(c){
    var k=c.feria||'';
    if(!G[k]){G[k]=[];order.push(k);}
    G[k].push(c);
  });
  var feriaDe=function(k){
    if(!k)return null;
    var it=G[k][0];
    return CC.state.ferias.filter(function(x){return it.feriaId&&x.id===it.feriaId;})[0]||CC.state.ferias.filter(function(x){return x.nombre===k;})[0]||null;
  };
  var fecha=function(k){var f=feriaDe(k);return f&&f.fecha||'';};
  order.sort(function(a,b){
    if(!a)return 1;if(!b)return -1;
    var x=fecha(a),y=fecha(b);
    if(x!==y)return x<y?1:-1;
    return a.localeCompare(b,'es');
  });
  var auto=!!S.q||S.filtro!=='todos';
  var rank=function(c){return isAlert(c)?0:c.estado==='Por contactar'?1:2;};
  return order.map(function(k){
    var cs=G[k].slice().sort(function(a,b){
      var r=rank(a)-rank(b);if(r)return r;
      if(rank(a)<2){var x=validYm(a.buscaDesde)?a.buscaDesde:'9999',y=validYm(b.buscaDesde)?b.buscaDesde:'9999';if(x!==y)return x<y?-1:1;}
      return byNew(a,b);
    });
    var nAl=cs.filter(isAlert).length,d=CC.parseDate(fecha(k));
    var open=S.open.hasOwnProperty(k)?S.open[k]:auto;
    var sub=[d?fechaFeria.format(d).replace(/\./g,''):'',cs.length+(cs.length===1?' candidato':' candidatos')].filter(Boolean).join(' · ');
    return '<details class="fgroup'+(nAl?' alert':'')+'" data-g="'+esc(k)+'"'+(open?' open':'')+'>'+
      '<summary><span class="fg-ic">'+(k&&CC.feriaMark?CC.feriaMark(feriaDe(k)||{nombre:k}):ic('cal',18))+'</span><span class="fg-main"><span class="fg-name">'+esc(k||'Sin feria')+'</span><span class="fg-sub">'+esc(sub)+'</span></span>'+
      (nAl?'<span class="pill warn">'+nAl+' por contactar</span>':'')+'<span class="fg-chev">'+ic('chev',18)+'</span></summary>'+
      '<div class="list">'+cs.map(function(c){return row(c,true);}).join('')+'</div></details>';
  }).join('');
}
function gate(icon,title,text,extra){
  return '<div class="empty"><div class="badge">'+icon+'</div><h2>'+title+'</h2><p>'+text+'</p>'+(extra||'')+'</div>';
}
function render(){
  var el=$('panel-candidatos');if(!el)return;
  if(S.status==='unconfigured'){el.innerHTML=gate(ci('lock',24),'Falta conectar la base de datos','Completa candidatos-config.js con la dirección y la clave de tu proyecto de Supabase. Los pasos están en CANDIDATOS.md.');return;}
  if(S.status==='starting'||S.status==='loading'){el.innerHTML='<p class="none">Cargando candidatos…</p>';return;}
  if(S.status==='idle'){el.innerHTML='';return;}
  if(S.status==='error'){el.innerHTML=gate(ci('lock',24),'No se pudieron cargar los candidatos',esc(S.error),'<button class="btn primary" data-act="c-reload">'+ci('refresh',17)+'Reintentar</button>');return;}

  var al=alerts(),soon=al.filter(function(c){return due(c)==='soon';}).length;
  var stats='<div class="stats"><div class="stat"><div class="v">'+(al.length-soon)+'</div><div class="l">Ya están buscando</div></div>'+
    '<div class="stat"><div class="v">'+soon+'</div><div class="l">Empiezan en '+ALERT_DAYS+' días</div></div>'+
    '<div class="stat"><div class="v">'+S.items.length+'</div><div class="l">Candidatos registrados</div></div></div>';
  var chips=[['todos','Todos'],['alerta','Por contactar ahora'],['Práctica','Práctica'],['Trabajo','Trabajo']];
  var toolbar='<div class="toolbar">'+CC.searchBox('q-cand','Buscar por nombre, carrera o área de interés',S.q,'Buscar candidatos')+
    '<button class="btn" data-act="c-import">'+ci('upload',17)+'Importar Excel</button>'+
    '<button class="btn primary" data-act="c-new">'+ic('plus',17)+'Nuevo candidato</button></div>'+
    '<div class="fchips">'+chips.map(function(c){return '<button class="fchip" data-act="c-filter" data-v="'+c[0]+'" aria-pressed="'+(S.filtro===c[0])+'">'+c[1]+'</button>';}).join('')+'</div>';
  var q=lower(S.q);
  var list=S.items.filter(function(c){
    if(S.filtro==='alerta'&&!isAlert(c))return false;
    if((S.filtro==='Práctica'||S.filtro==='Trabajo')&&c.tipo!==S.filtro)return false;
    return !q||lower([c.nombre,c.carrera,c.universidad,c.feria,c.correo,c.notas,c.area,c.nivel,c.telefono].join(' ')).indexOf(q)>-1;
  });
  var byNew=function(a,b){return a.creado<b.creado?1:a.creado>b.creado?-1:0;};
  var body;
  if(!S.items.length){
    body=gate(ci('user',24),'Aún no hay candidatos','Registra a las personas que entrevistes en cada feria, con el mes en que empiezan a buscar. La app te avisará cuando sea momento de contactarlas.','<div class="adm-actions"><button class="btn primary" data-act="c-new">'+ic('plus',17)+'Registrar el primero</button><button class="btn" data-act="c-import">'+ci('upload',17)+'Importar desde Excel</button></div>');
  }else if(!list.length){
    body='<p class="none">Ningún candidato coincide con la búsqueda.</p>';
  }else{
    body=groups(list,byNew);
  }
  var who='<div class="whoami"><span></span><button class="linkbtn" data-act="c-reload">'+ci('refresh',14)+'Actualizar candidatos</button></div>';
  CC.keepFocus('q-cand',stats+toolbar+'<div class="stack">'+body+'</div>'+who,el);
}
function inicioBlock(){
  if(!configured)return '';
  var head='<div class="blkhead"><h2>'+ci('bell',18)+'Candidatos por contactar</h2><button class="linkbtn" data-act="c-goto" data-v="todos">Ver todos</button></div>';
  var b;
  if(S.status==='idle')return '';
  if(S.status==='starting'||S.status==='loading')b='<p class="none">Cargando…</p>';
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
    fld('nivel','Año o situación','text',rec.nivel,{ph:'Ej: 4° año, Titulado'})+
    fld('duracion','Duración de práctica','text',rec.duracion,{ph:'Ej: 2 meses'})+
    fld('area','Área de interés','text',rec.area,{full:true,ph:'Ej: Calidad, procesos'})+
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
  c.nombre=cv('nombre');c.universidad=cv('universidad');c.carrera=cv('carrera');c.nivel=cv('nivel');c.area=cv('area');c.duracion=cv('duracion');c.tipo=cv('tipo');
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

/* ---------- Importar desde Excel o CSV ----------
   El archivo se lee en el navegador (sin librerías externas) y va directo a Supabase. */
function nz(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
async function readZip(buf){
  var dv=new DataView(buf),u8=new Uint8Array(buf),td=new TextDecoder(),e=-1;
  for(var i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-65557);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break;}}
  if(e<0)throw new Error('formato');
  var n=dv.getUint16(e+10,true),off=dv.getUint32(e+16,true),files={};
  for(var k=0;k<n&&dv.getUint32(off,true)===0x02014b50;k++){
    var nl=dv.getUint16(off+28,true);
    files[td.decode(u8.subarray(off+46,off+46+nl))]={m:dv.getUint16(off+10,true),cs:dv.getUint32(off+20,true),loc:dv.getUint32(off+42,true)};
    off+=46+nl+dv.getUint16(off+30,true)+dv.getUint16(off+32,true);
  }
  return {names:Object.keys(files),get:async function(name){
    var f=files[name];if(!f)return null;
    var st=f.loc+30+dv.getUint16(f.loc+26,true)+dv.getUint16(f.loc+28,true),data=u8.slice(st,st+f.cs);
    if(f.m===0)return td.decode(data);
    if(f.m!==8||!window.DecompressionStream)throw new Error('navegador');
    return td.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }};
}
function colIdx(ref){var m=/^([A-Z]+)/.exec(ref||''),n=0;if(!m)return -1;for(var i=0;i<m[1].length;i++)n=n*26+m[1].charCodeAt(i)-64;return n-1;}
async function readXlsx(buf){
  var z=await readZip(buf),P=new DOMParser();
  function x(s){return s?P.parseFromString(s,'application/xml'):null;}
  function texts(el){return Array.from(el.getElementsByTagName('t')).filter(function(t){return t.parentNode.nodeName!=='rPh';}).map(function(t){return t.textContent;}).join('');}
  var ss=[],sx=x(await z.get('xl/sharedStrings.xml'));
  if(sx)Array.from(sx.getElementsByTagName('si')).forEach(function(si){ss.push(texts(si));});
  var path='';
  try{
    var wb=x(await z.get('xl/workbook.xml')),rel=x(await z.get('xl/_rels/workbook.xml.rels'));
    var rid=wb.getElementsByTagName('sheet')[0].getAttribute('r:id');
    var t=Array.from(rel.getElementsByTagName('Relationship')).filter(function(r){return r.getAttribute('Id')===rid;})[0].getAttribute('Target');
    path=t.charAt(0)==='/'?t.slice(1):'xl/'+t;
  }catch(e){}
  if(!path||z.names.indexOf(path)<0)path=z.names.filter(function(n){return /^xl\/worksheets\/sheet\d+\.xml$/.test(n);}).sort()[0];
  var sh=x(await z.get(path));if(!sh)throw new Error('formato');
  var out=[];
  Array.from(sh.getElementsByTagName('row')).forEach(function(r,ri){
    var rn=(+r.getAttribute('r')||ri+1)-1,row=out[rn]=[];
    Array.from(r.getElementsByTagName('c')).forEach(function(c,ci){
      var t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0],val=null,col=colIdx(c.getAttribute('r'));if(col<0)col=ci;
      if(t==='s')val=v?ss[+v.textContent]:'';
      else if(t==='inlineStr')val=texts(c);
      else if(t==='b')val=v&&v.textContent==='1'?'Sí':'No';
      else if(v)val=t==='str'||t==='e'?v.textContent:(isNaN(+v.textContent)?v.textContent:+v.textContent);
      row[col]=val;
    });
  });
  return Array.from(out,function(r){return r||[];});
}
function readCsv(text){
  var first=text.split(/\r?\n/)[0]||'',sep=(first.split(';').length>first.split(',').length)?';':(first.split('\t').length>first.split(',').length?'\t':',');
  var rows=[],row=[],cur='',q=false;
  for(var i=0;i<text.length;i++){
    var ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}
    else if(ch==='"')q=true;
    else if(ch===sep){row.push(cur);cur='';}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur='';}
    else cur+=ch;
  }
  if(cur||row.length){row.push(cur);rows.push(row);}
  return rows;
}
async function readSheet(file){
  var buf=await file.arrayBuffer();
  if(/\.csv$|\.txt$/i.test(file.name)){
    var t=new TextDecoder('utf-8').decode(buf);
    if(t.indexOf('\uFFFD')>-1)t=new TextDecoder('windows-1252').decode(buf);
    return readCsv(t.replace(/^\uFEFF/,''));
  }
  if(/\.xls$/i.test(file.name))throw new Error('xls');
  return readXlsx(buf);
}

var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var MES_RE=/\b(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\b/;
function nextOcc(m){var h=new Date(),y=h.getFullYear();if(m<h.getMonth()+1)y++;return y+'-'+pad(m);}
/* Convierte lo que venga en "Disponibilidad" a AAAA-MM. Devuelve '' si no se puede saber el mes. */
function parseDisp(v){
  if(v==null||v==='')return '';
  if(typeof v==='number'&&v>30000&&v<80000){var d=new Date(Math.round((v-25569)*864e5));return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1);}
  var s=nz(v),m;
  if(/inmediat|^ya$|desde ya|ahora|cuanto antes|disponible$/.test(s))return ym(new Date());
  if((m=/\b(20\d{2})[-\/.](\d{1,2})\b/.exec(s))&&+m[2]>=1&&+m[2]<=12)return m[1]+'-'+pad(+m[2]);
  if((m=/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/.exec(s))&&+m[2]>=1&&+m[2]<=12)return (m[3].length===2?'20'+m[3]:m[3])+'-'+pad(+m[2]);
  if((m=/\b(\d{1,2})[-\/.](20\d{2})\b/.exec(s))&&+m[1]>=1&&+m[1]<=12)return m[2]+'-'+pad(+m[1]);
  var yr=/\b(20\d{2})\b/.exec(s);
  if((m=/\b(primer|1er|1|segundo|2do|2)\s*(?:°|º)?\s*sem/.exec(s))){var mm=/^(primer|1er|1)$/.test(m[1])?3:8;return yr?yr[1]+'-'+pad(mm):nextOcc(mm);}
  if((m=MES_RE.exec(s))){
    var k=m[1].slice(0,3)==='set'?8:['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'].indexOf(m[1].slice(0,3));
    return yr?yr[1]+'-'+pad(k+1):nextOcc(k+1);
  }
  return '';
}
/* Qué columna del Excel corresponde a cada campo, según el encabezado. */
var COLS=[
  ['nombre',/^(nombre( completo)?|postulante|candidat[oa]|nombre y apellidos?)$/],
  ['correo',/^(correo|e-?mail|mail|correo electronico)$/],
  ['contacto',/^(contacto|telefono|fono|celular|movil|whatsapp|numero)$/],
  ['carrera',/^carrera$/],
  ['universidad',/^(universidad|institucion|casa de estudios?|u)$/],
  ['nivel',/^(estado|nivel|ano|año|situacion|situacion academica|curso|ano de carrera)$/],
  ['titulado',/^¿?titulad[oa]\??$/],
  ['area',/^(area de interes|area|areas de interes|interes|intereses)$/],
  ['disp',/^(disponibilidad|busca desde|disponible desde|fecha de inicio|inicio|fecha|cuando busca)$/],
  ['duracion',/^(duracion|duracion de (la )?practica)$/],
  ['tipo',/^(tipo|busca)$/],
  ['notas',/^(notas|observaciones?|comentarios?)$/]
];
var COL_LBL={nombre:'Nombre',correo:'Correo',contacto:'Teléfono o correo',carrera:'Carrera',universidad:'Universidad',nivel:'Año o situación',titulado:'Titulado',area:'Área de interés',disp:'Empieza a buscar',duracion:'Duración de práctica',tipo:'Busca',notas:'Notas'};
function fmtPhone(v){
  var d=String(v||'').replace(/\D/g,'');
  if(/^569\d{8}$/.test(d))d=d.slice(2);else if(/^56\d{9}$/.test(d))return '+56 '+d.slice(2,3)+' '+d.slice(3,7)+' '+d.slice(7);
  return /^9\d{8}$/.test(d)?'+56 9 '+d.slice(1,5)+' '+d.slice(5):String(v||'').trim();
}
function digits(s){return String(s||'').replace(/\D/g,'').slice(-8);}
function buildImport(rows,fileName){
  var hi=rows.findIndex(function(r){return r.filter(function(v){return v!=null&&String(v).trim();}).length>=2;});
  if(hi<0)throw new Error('vacio');
  var head=rows[hi].map(function(h){return String(h==null?'':h).trim();}),map={},extra=[];
  head.forEach(function(h,i){
    if(!h)return;var n=nz(h),hit=COLS.filter(function(c){return c[1].test(n);})[0];
    if(hit&&map[hit[0]]==null)map[hit[0]]=i;else extra.push(i);
  });
  /* Si "Estado" trae los estados de contacto de la app, no es el año de carrera. */
  var est=null;
  if(map.nivel!=null){var vals=rows.slice(hi+1).map(function(r){return String(r[map.nivel]||'');}).filter(Boolean);
    if(vals.length&&vals.every(function(v){return ESTADOS.indexOf(v)>-1;})){est=map.nivel;delete map.nivel;}}
  if(map.nombre==null)throw new Error('nombre');
  var get=function(r,k){var i=map[k];return i==null||r[i]==null?'':String(r[i]).trim();};
  var seen={},items=[];
  rows.slice(hi+1).forEach(function(r){
    if(!r.some(function(v){return v!=null&&String(v).trim();}))return;
    var c={nombre:get(r,'nombre'),carrera:get(r,'carrera'),universidad:get(r,'universidad'),nivel:get(r,'nivel'),area:get(r,'area'),duracion:get(r,'duracion'),
      correo:get(r,'correo'),telefono:'',notas:get(r,'notas'),tipo:'',estado:est!=null&&r[est]?String(r[est]):'Por contactar'};
    var ct=get(r,'contacto');
    if(ct){if(/@/.test(ct)&&!c.correo)c.correo=ct;else c.telefono=fmtPhone(ct);}
    if(!c.nivel&&/^s/i.test(nz(get(r,'titulado'))))c.nivel='Titulado';
    var tp=nz(get(r,'tipo'));if(/pract/.test(tp))c.tipo='Práctica';else if(/trab|empleo/.test(tp))c.tipo='Trabajo';
    var dr=map.disp==null?null:r[map.disp];
    c.buscaDesde=parseDisp(dr);c.dispOrig=dr==null?'':String(dr);
    var ex=extra.map(function(i){return r[i]!=null&&String(r[i]).trim()?head[i]+': '+String(r[i]).trim():'';}).filter(Boolean);
    if(c.dispOrig&&!/^\d{4}-\d{2}$/.test(c.dispOrig))ex.unshift('Disponibilidad indicada: '+c.dispOrig);
    if(ex.length)c.notas=(c.notas?c.notas+'\n':'')+ex.join('\n');
    /* Duplicados: mismo teléfono, mismo correo o mismo nombre, ya registrado o repetido en el archivo. */
    var keys=[c.telefono&&'t'+digits(c.telefono),c.correo&&'c'+lower(c.correo),c.nombre&&'n'+nz(c.nombre)].filter(Boolean);
    var dup=S.items.some(function(x){return (c.telefono&&digits(x.telefono)===digits(c.telefono))||(c.correo&&lower(x.correo)===lower(c.correo))||(nz(x.nombre)===nz(c.nombre));})?'ya':
      keys.some(function(k){return seen[k];})?'archivo':'';
    keys.forEach(function(k){seen[k]=1;});
    items.push({c:c,dup:dup,on:!!c.nombre&&!dup});
  });
  /* Primero las filas que necesitan revisión. */
  var rank={bad:0,warn:1,ok:2};
  items=items.map(function(it,i){return [it,i];}).sort(function(a,b){return rank[impIssue(a[0])[0]]-rank[impIssue(b[0])[0]]||a[1]-b[1];}).map(function(x){return x[0];});
  return {file:fileName,items:items,map:map,extra:extra.map(function(i){return head[i];}),head:head,
    tipo:'Práctica',feria:'',consent:false,busy:false};
}
function impIssue(it){
  if(!it.c.nombre)return ['bad','Sin nombre'];
  if(it.dup==='ya')return ['bad','Ya registrado'];
  if(it.dup==='archivo')return ['bad','Repetido en el archivo'];
  if(!validYm(it.c.buscaDesde))return ['warn','Falta el mes'];
  return ['ok','Listo'];
}
function impBody(){
  var M=S.imp,n=M.items.filter(function(i){return i.on;}).length;
  var recog=Object.keys(M.map).map(function(k){return '<b>'+esc(M.head[M.map[k]])+'</b> → '+esc(COL_LBL[k]);}).join(', ');
  var rows=M.items.map(function(it,i){
    var is=impIssue(it),c=it.c;
    return '<tr'+(it.on?'':' class="off"')+'><td><input type="checkbox" data-ii="'+i+'"'+(it.on?' checked':'')+(c.nombre?'':' disabled')+' aria-label="Importar '+esc(c.nombre)+'"></td>'+
      '<td><b>'+esc(c.nombre||'(sin nombre)')+'</b><div class="isub">'+esc([c.carrera,c.nivel].filter(Boolean).join(', '))+'</div></td>'+
      '<td>'+esc(c.telefono||c.correo||'')+'</td>'+
      '<td><input type="month" data-im="'+i+'" value="'+esc(c.buscaDesde)+'" aria-label="Mes en que empieza a buscar">'+(c.dispOrig?'<div class="isub">Excel: '+esc(c.dispOrig)+'</div>':'')+'</td>'+
      '<td><span class="pill '+is[0]+'">'+is[1]+'</span></td></tr>';
  }).join('');
  var fs=feriaOptions({});
  var cnt={};M.items.forEach(function(it){var k=impIssue(it)[1];cnt[k]=(cnt[k]||0)+1;});
  var sum=Object.keys(cnt).map(function(k){return cnt[k]+' '+lower(k);}).join(', ');
  return '<p class="imeta">'+M.items.length+' filas leídas de <b>'+esc(M.file)+'</b>. Columnas reconocidas: '+recog+'.'+
      (M.extra.length?' Irán a las notas: '+M.extra.map(esc).join(', ')+'.':'')+'</p>'+
    '<p class="isum">Revisión: '+esc(sum)+'.</p>'+
    '<div class="fields">'+
      fld('if','Feria donde los conocieron','select',M.feria,{options:fs,empty:'Otra o sin feria'})+
      fld('it','Buscan','select',M.tipo,{options:TIPOS.map(function(t){return [t,t];})})+
      '<div class="fld full"><label class="ckline"><input type="checkbox" id="cf-ic"'+(M.consent?' checked':'')+'><span>Todos autorizaron que guardemos sus datos para futuros procesos de selección.</span></label></div>'+
    '</div>'+
    '<div class="itable"><table><thead><tr><th></th><th>Candidato</th><th>Contacto</th><th>Empieza a buscar</th><th>Revisión</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<p class="hint">Revisa los meses calculados: cuando el Excel no trae el año, se usa la próxima vez que llega ese mes. Los CV se suben después, desde la ficha de cada candidato.</p>';
}
function impPaint(){
  var b=$('cimp-body');if(b)b.innerHTML=impBody();
  var n=S.imp.items.filter(function(i){return i.on;}).length,btn=$('c-save');
  if(btn&&!S.imp.busy){btn.textContent='Importar '+n+' candidato'+(n===1?'':'s');btn.disabled=!n;}
}
function openImport(M){
  S.imp=M;S.edit=null;
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><form class="sheet wide" id="cimp" role="dialog" aria-modal="true" aria-labelledby="cimp-title" novalidate>'+
    '<h2 id="cimp-title">Importar candidatos</h2><div id="cimp-body"></div><div class="ferr" id="cferr" role="alert"></div>'+
    '<div class="sheet-actions"><button class="btn primary" type="submit" id="c-save">Importar</button><button class="btn" type="button" data-act="close">Cancelar</button></div></form></div>';
  impPaint();
}
async function pickImport(file){
  if(!file)return;
  try{
    var rows=await readSheet(file);
    openImport(buildImport(rows,file.name));
  }catch(e){
    var m=String(e&&e.message);
    toast(m==='xls'?'Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx.':
      m==='nombre'?'No se encontró una columna “Nombre” en el archivo.':
      m==='vacio'?'El archivo está vacío.':
      m==='navegador'?'Tu navegador no puede leer este Excel. Actualízalo o guarda el archivo como CSV.':
      'No se pudo leer el archivo. Guárdalo como .xlsx o .csv e intenta de nuevo.');
  }
}
async function runImport(){
  var M=S.imp;if(!M||M.busy)return;
  var sel=M.items.filter(function(i){return i.on;});if(!sel.length)return;
  var fr=CC.state.ferias.filter(function(x){return x.id===M.feria;})[0],me=myName();
  var payload=sel.map(function(it){
    var c=Object.assign({},it.c);
    c.tipo=c.tipo||M.tipo;c.feriaId=M.feria;c.feria=fr?fr.nombre:'';c.consentimiento=M.consent;c.entrevistador=me;c.evaluacion='';
    if(!validYm(c.buscaDesde))c.buscaDesde='';
    if(ESTADOS.indexOf(c.estado)<0)c.estado='Por contactar';
    return toRow(c);
  });
  M.busy=true;var b=$('c-save');if(b){b.disabled=true;b.textContent='Importando…';}
  try{
    var data=chk(await sb.from(TABLE).insert(payload).select());
    S.items=(data||[]).map(fromRow).concat(S.items);
    CC.closeSheet();S.imp=null;S.filtro='todos';
    toast((data||[]).length+' candidatos importados');repaint();
  }catch(e){M.busy=false;impPaint();ferr(errMsg(e));}
}

/* ---------- Eventos ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;
  var act=b.getAttribute('data-act');if(act.indexOf('c-')!==0)return;
  if(act==='c-logout'){Sesion.signOut();return;}
  if(act==='c-reload'){loadAll();return;}
  if(act==='c-new'){openForm(null);return;}
  if(act==='c-import'){var fi=$('c-impfile');if(fi){fi.value='';fi.click();}return;}
  if(act==='c-edit'){openForm(b.getAttribute('data-id'));return;}
  if(act==='c-pass'){openPass();return;}
  if(act==='c-cv'){e.preventDefault();openCv(b.getAttribute('data-path'));return;}
  if(act==='c-delete'){removeCand();return;}
  if(act==='c-contacted'){markContacted(b.getAttribute('data-id'));return;}
  if(act==='c-filter'){S.filtro=b.getAttribute('data-v');S.open={};render();return;}
  if(act==='c-goto'){S.filtro=b.getAttribute('data-v')||'todos';CC.setTab('candidatos');render();window.scrollTo(0,0);return;}
});
/* Los formularios de candidatos se manejan aquí, no con el guardado de data.json de app.js. */
document.addEventListener('submit',function(e){
  var id=e.target&&e.target.id;
  if(id==='csheet'||id==='cpass'||id==='cimp'){
    e.preventDefault();e.stopPropagation();
    if(id==='csheet')save();else if(id==='cpass')savePass();else runImport();
  }
},true);
document.addEventListener('input',function(e){
  if(e.target.id==='q-cand'){S.q=e.target.value;S.open={};render();}
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='c-impfile'){pickImport(t.files&&t.files[0]);return;}
  if(S.imp&&t.closest&&t.closest('#cimp')){
    var M=S.imp;
    if(t.hasAttribute('data-ii')){M.items[+t.getAttribute('data-ii')].on=t.checked;impPaint();return;}
    if(t.hasAttribute('data-im')){var it=M.items[+t.getAttribute('data-im')];it.c.buscaDesde=validYm(t.value)?t.value:'';impPaint();return;}
    if(t.id==='cf-if')M.feria=t.value;else if(t.id==='cf-it')M.tipo=t.value;else if(t.id==='cf-ic')M.consent=t.checked;
    return;
  }
  if(t.id==='cf-cv'){
    S.file=t.files&&t.files[0]||null;
    var h=$('cf-cvhint');
    if(h&&S.file)h.textContent=S.file.size>MAX_MB*1024*1024?'Este archivo pesa más de '+MAX_MB+' MB.':'Se subirá: '+S.file.name+' ('+Math.max(1,Math.round(S.file.size/1024))+' KB).';
  }
});
document.addEventListener('toggle',function(e){
  var t=e.target;if(t&&t.classList&&t.classList.contains('fgroup'))S.open[t.getAttribute('data-g')]=t.open;
},true);
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&S.status==='ok'&&Date.now()-S.lastLoad>60000)loadAll();
});

var impInput=document.createElement('input');impInput.type='file';impInput.id='c-impfile';impInput.accept='.xlsx,.csv';impInput.hidden=true;document.body.appendChild(impInput);
window.CandHooks={badge:badge,inicioBlock:inicioBlock,render:render};
repaint();
init();
})();
