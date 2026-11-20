/* Descriptores de cargo (DC): tabla "descriptores" en Supabase y documentos en el almacenamiento privado "descriptores".
   Cualquier cuenta del equipo puede agregar, editar o eliminar; los cambios se guardan al instante.
   Requiere: supabase.min.js, sesion.js y app.js (window.CC). */
(function(){
'use strict';
var CC=window.CC;if(!CC||!window.SB)return;
var sb=window.SB,ic=CC.ic,esc=CC.esc,toast=CC.toast;
function $(id){return document.getElementById(id);}
function nz(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
var TABLE='descriptores',BUCKET='descriptores',MAX_MB=25;
var ESTADOS=['Vigente','En revisión','Por actualizar'];
var EST_CLS={'Vigente':'ok','En revisión':'mat','Por actualizar':'warn'};
var fFecha=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'});
var S={status:'idle',items:[],error:'',q:'',fe:'todos',ger:'',edit:null,file:null,busy:false,armed:false};

var I={doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  alert:'<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17.5v.5"/>'};
function di(n,s){s=s||18;return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[n]+'</svg>';}

/* ---------- Fechas: un descriptor se considera desactualizado tras un año ---------- */
function meses(fecha){var d=CC.parseDate(fecha);if(!d)return null;var h=new Date();return (h.getFullYear()-d.getFullYear())*12+(h.getMonth()-d.getMonth())-(h.getDate()<d.getDate()?1:0);}
function viejo(c){var m=meses(c.fecha);return m===null||m>=12;}
function haceTxt(c){
  var m=meses(c.fecha);if(m===null)return 'Sin fecha de actualización';
  var d=CC.parseDate(c.fecha),f='Actualizado el '+fFecha.format(d).replace(/\./g,'');
  if(m<1)return f+' · este mes';
  if(m<12)return f+' · hace '+m+(m===1?' mes':' meses');
  var a=Math.floor(m/12);return f+' · hace '+(a===1?'más de un año':a+' años');
}

/* ---------- Datos ---------- */
function errMsg(e){
  var code=e&&e.code,m=String((e&&e.message)||'');
  if(code==='PGRST205'||code==='42P01'||/does not exist|schema cache/i.test(m))return 'Falta preparar la base de datos: ejecuta dc.sql en Supabase.';
  if(code==='42501'||/row-level security|permission denied/i.test(m))return 'Tu cuenta no tiene permiso para esta acción.';
  if(/payload too large|exceeded the maximum/i.test(m))return 'El archivo es demasiado grande. Usa uno de menos de '+MAX_MB+' MB.';
  if(!navigator.onLine)return 'Sin conexión. Los descriptores solo se ven con internet.';
  return 'No se pudo completar la operación ('+(m||'error desconocido')+').';
}
function chk(r){if(r&&r.error)throw r.error;return r?r.data:null;}
function fromRow(r){return {id:r.id,cargo:r.cargo||'',gerencia:r.gerencia||'',reporta:r.reporta_a||'',estado:r.estado||'Vigente',fecha:r.fecha_actualizacion||'',
  responsable:r.responsable||'',docPath:r.doc_path||'',docNombre:r.doc_nombre||'',notas:r.notas||'',creado:r.creado||''};}
function nul(v){return v===''||v==null?null:v;}
function toRow(c){return {cargo:c.cargo,gerencia:nul(c.gerencia),reporta_a:nul(c.reporta),estado:c.estado,fecha_actualizacion:nul(c.fecha),
  responsable:nul(c.responsable),doc_path:nul(c.docPath),doc_nombre:nul(c.docNombre),notas:nul(c.notas)};}
async function load(){
  S.status='loading';render();
  try{S.items=(chk(await sb.from(TABLE).select('*').order('cargo',{ascending:true}))||[]).map(fromRow);S.status='ok';S.error='';}
  catch(e){S.status='error';S.error=errMsg(e);}
  render();
}
function slug(s){return nz(s).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'sin-nombre';}
async function upload(c,file){
  var ext=(/\.[a-z0-9]{1,5}$/i.exec(file.name)||[''])[0].toLowerCase();
  var path=slug(c.gerencia||'sin-gerencia')+'/'+Date.now().toString(36)+'-'+slug(c.cargo)+ext;
  chk(await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false}));
  return path;
}
async function removeDoc(path){if(!path)return;try{await sb.storage.from(BUCKET).remove([path]);}catch(e){}}
async function openDoc(path){
  var w=window.open('','_blank');
  try{var d=chk(await sb.storage.from(BUCKET).createSignedUrl(path,600));if(w)w.location.href=d.signedUrl;else location.assign(d.signedUrl);}
  catch(e){if(w)w.close();toast(errMsg(e));}
}

/* ---------- Vista ---------- */
function card(c){
  var v=viejo(c);
  return '<article class="dc-card'+(v?' old':'')+'">'+
    '<div class="dc-top"><span class="dc-ico">'+di('doc',20)+'</span><div class="dc-t"><span class="dc-cargo">'+esc(c.cargo)+'</span>'+
      (c.reporta?'<span class="dc-sub">Reporta a: '+esc(c.reporta)+'</span>':'')+'</div>'+
      '<button class="iconbtn" data-act="dc-edit" data-id="'+esc(c.id)+'" aria-label="Editar '+esc(c.cargo)+'" title="Editar">'+ic('pencil',17)+'</button></div>'+
    '<div class="dc-mid"><span class="pill '+(EST_CLS[c.estado]||'mat')+'">'+esc(c.estado)+'</span><span class="dc-when'+(v?' warn':'')+'">'+esc(haceTxt(c))+'</span></div>'+
    '<div class="dc-foot"><span>'+(c.responsable?'Responsable: <b>'+esc(c.responsable)+'</b>':'Sin responsable')+'</span>'+
      (c.docPath?'<button class="btn dc-open" data-act="dc-doc" data-path="'+esc(c.docPath)+'">'+di('doc',16)+'Ver documento</button>':'<span class="dc-nodoc">Sin documento</span>')+'</div>'+
    (c.notas?'<details class="notebox"><summary>Notas</summary><div class="notetext">'+esc(c.notas)+'</div></details>':'')+
  '</article>';
}
function render(){
  var el=$('panel-dc');if(!el)return;
  if(S.status==='idle'||S.status==='loading'){el.innerHTML='<p class="none">Cargando descriptores…</p>';return;}
  if(S.status==='error'){el.innerHTML='<div class="empty"><div class="badge">'+di('doc',24)+'</div><h2>No se pudieron cargar los descriptores</h2><p>'+esc(S.error)+'</p><button class="btn primary" data-act="dc-reload">Reintentar</button></div>';return;}
  var nViejos=S.items.filter(viejo).length,q=nz(S.q);
  var gers=[];S.items.forEach(function(c){if(c.gerencia&&gers.indexOf(c.gerencia)<0)gers.push(c.gerencia);});gers.sort(function(a,b){return a.localeCompare(b,'es');});
  if(S.ger&&gers.indexOf(S.ger)<0)S.ger='';
  var list=S.items.filter(function(c){
    if(S.ger&&c.gerencia!==S.ger)return false;
    if(S.fe==='viejos'&&!viejo(c))return false;
    if(S.fe!=='todos'&&S.fe!=='viejos'&&c.estado!==S.fe)return false;
    return !q||nz([c.cargo,c.gerencia,c.reporta,c.responsable,c.notas].join(' ')).indexOf(q)>-1;
  });
  var head='<div class="cu-head pf-top"><div><h2>Descriptores de cargo</h2><p class="pf-sub">'+S.items.length+(S.items.length===1?' descriptor':' descriptores')+
    (nViejos?' · <b class="pf-next">'+nViejos+' sin actualizar hace más de un año</b>':'')+'</p></div>'+
    '<div class="cu-tools">'+CC.searchBox('q-dc','Buscar cargo, gerencia o responsable',S.q,'Buscar descriptores')+
    '<button class="btn primary" data-act="dc-new">'+ic('plus',17)+'Nuevo descriptor</button></div></div>';
  var chips=[['todos','Todos'],['Vigente','Vigente'],['En revisión','En revisión'],['Por actualizar','Por actualizar'],['viejos','Más de un año sin actualizar']];
  var filt='<div class="dc-filters"><div class="fchips">'+chips.map(function(c){return '<button class="fchip" data-act="dc-fe" data-v="'+esc(c[0])+'" aria-pressed="'+(S.fe===c[0])+'">'+c[1]+'</button>';}).join('')+'</div>'+
    (gers.length>1?'<select id="dc-ger" class="cfilter" aria-label="Filtrar por gerencia"><option value="">Todas las gerencias</option>'+gers.map(function(g){return '<option'+(S.ger===g?' selected':'')+'>'+esc(g)+'</option>';}).join('')+'</select>':'')+'</div>';
  var body;
  if(!S.items.length)body='<div class="empty"><div class="badge">'+di('doc',24)+'</div><h2>Aún no hay descriptores</h2><p>Agrega cada cargo con su gerencia, a quién reporta, su estado y el documento del descriptor.</p><button class="btn primary" data-act="dc-new">'+ic('plus',17)+'Agregar el primero</button></div>';
  else if(!list.length)body='<p class="none">Ningún descriptor coincide con la búsqueda o los filtros.</p>';
  else{
    var G={},order=[];
    list.forEach(function(c){var k=c.gerencia||'';if(!G[k]){G[k]=[];order.push(k);}G[k].push(c);});
    order.sort(function(a,b){if(!a)return 1;if(!b)return -1;return a.localeCompare(b,'es');});
    body=order.map(function(k){
      return '<section class="pf-group"><h3 class="do-st">'+esc(k||'Sin gerencia')+' <span>'+G[k].length+'</span></h3><div class="dc-grid">'+
        G[k].sort(function(a,b){return a.cargo.localeCompare(b.cargo,'es');}).map(card).join('')+'</div></section>';
    }).join('');
  }
  CC.keepFocus('q-dc','<div class="cu">'+head+filt+body+'</div>',el);
}

/* ---------- Formulario ---------- */
function fld(id,label,type,value,o){
  o=o||{};var input;
  if(type==='textarea')input='<textarea id="dc-'+id+'">'+esc(value)+'</textarea>';
  else if(type==='select')input='<select id="dc-'+id+'">'+o.options.map(function(v){return '<option'+(v===value?' selected':'')+'>'+esc(v)+'</option>';}).join('')+'</select>';
  else input='<input id="dc-'+id+'" type="'+type+'" value="'+esc(value)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.list?' list="'+o.list+'"':'')+'>';
  return '<div class="fld'+(o.full?' full':'')+'"><label for="dc-'+id+'">'+label+'</label>'+input+(o.hint?'<span class="hint">'+o.hint+'</span>':'')+'</div>';
}
function v(id){var e=$('dc-'+id);return e?e.value.trim():'';}
function ferr(m){var e=$('dcerr');if(e)e.textContent=m||'';}
function openForm(id){
  var rec=id?(S.items.filter(function(c){return c.id===id;})[0]||{}):{estado:'Vigente',fecha:CC.todayStr()};
  S.edit={id:id||null,rec:rec};S.file=null;S.busy=false;S.armed=false;
  var gers=[];S.items.forEach(function(c){if(c.gerencia&&gers.indexOf(c.gerencia)<0)gers.push(c.gerencia);});
  var f=fld('cargo','Cargo','text',rec.cargo,{full:true,ph:'Ej: Analista de Remuneraciones'})+
    fld('gerencia','Gerencia o área','text',rec.gerencia,{ph:'Ej: Personas',list:'dc-gers'})+
    fld('reporta','Reporta a','text',rec.reporta,{ph:'Ej: Jefe de Remuneraciones'})+
    fld('estado','Estado','select',rec.estado||'Vigente',{options:ESTADOS})+
    fld('fecha','Última actualización','date',rec.fecha)+
    fld('responsable','Responsable','text',rec.responsable,{full:true,ph:'Quién lo mantiene al día'})+
    '<div class="fld full"><label for="dc-file">Documento</label>'+
      (rec.docPath?'<div class="cvcur">'+di('doc',16)+'<button type="button" class="linkbtn" data-act="dc-doc" data-path="'+esc(rec.docPath)+'">'+esc(rec.docNombre||'Ver documento actual')+'</button></div>':'')+
      '<input id="dc-file" type="file" accept=".pdf,.doc,.docx">'+
      '<span class="hint" id="dc-filehint">'+(rec.docPath?'Si subes otro archivo, reemplaza al actual. ':'')+'PDF o Word, hasta '+MAX_MB+' MB.</span></div>'+
    fld('notas','Notas','textarea',rec.notas,{full:true})+
    '<datalist id="dc-gers">'+gers.map(function(g){return '<option value="'+esc(g)+'">';}).join('')+'</datalist>';
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><form class="sheet" id="dcsheet" role="dialog" aria-modal="true" aria-labelledby="dc-title" novalidate>'+
    '<h2 id="dc-title">'+(id?'Editar descriptor':'Nuevo descriptor')+'</h2><div class="fields">'+f+'</div><div class="ferr" id="dcerr" role="alert"></div>'+
    '<div class="sheet-actions"><button class="btn primary" type="submit" id="dc-save">Guardar</button><button class="btn" type="button" data-act="close">Cancelar</button><span class="sp"></span>'+
    (id?'<button class="btn danger" type="button" data-act="dc-del" id="dc-delbtn">Eliminar</button>':'')+'</div></form></div>';
  var c=$('dc-cargo');if(c)c.focus();
}
function busy(on,label){S.busy=on;var b=$('dc-save');if(b){b.disabled=on;b.textContent=on?(label||'Guardando…'):'Guardar';}}
async function save(){
  if(S.busy||!S.edit)return;
  var c=Object.assign({},S.edit.rec,{cargo:v('cargo'),gerencia:v('gerencia'),reporta:v('reporta'),estado:v('estado')||'Vigente',fecha:v('fecha'),responsable:v('responsable'),notas:v('notas')});
  if(!c.cargo){ferr('Escribe el nombre del cargo.');$('dc-cargo').focus();return;}
  if(S.file&&S.file.size>MAX_MB*1024*1024){ferr('El archivo pesa más de '+MAX_MB+' MB.');return;}
  ferr('');
  var old=S.edit.rec.docPath,nuevo='';
  try{
    if(S.file){busy(true,'Subiendo documento…');nuevo=await upload(c,S.file);c.docPath=nuevo;c.docNombre=S.file.name;}
    busy(true,'Guardando…');
    var saved;
    if(S.edit.id){
      saved=fromRow(chk(await sb.from(TABLE).update(toRow(c)).eq('id',S.edit.id).select().single()));
      S.items=S.items.map(function(x){return x.id===saved.id?saved:x;});
    }else{
      saved=fromRow(chk(await sb.from(TABLE).insert(toRow(c)).select().single()));
      S.items.push(saved);
    }
    if(nuevo&&old)removeDoc(old);
    CC.closeSheet();S.edit=null;S.file=null;S.busy=false;toast('Descriptor guardado');render();
  }catch(e){if(nuevo)removeDoc(nuevo);busy(false);ferr(errMsg(e));}
}
async function del(){
  if(!S.edit||!S.edit.id||S.busy)return;
  var b=$('dc-delbtn');
  if(!S.armed){S.armed=true;if(b){b.textContent='¿Seguro? Se borra también el documento';b.classList.add('armed');}return;}
  var rec=S.edit.rec;S.busy=true;if(b){b.disabled=true;b.textContent='Eliminando…';}
  try{
    chk(await sb.from(TABLE).delete().eq('id',rec.id));await removeDoc(rec.docPath);
    S.items=S.items.filter(function(x){return x.id!==rec.id;});
    CC.closeSheet();S.edit=null;S.busy=false;toast('Descriptor eliminado');render();
  }catch(e){S.busy=false;S.armed=false;if(b){b.disabled=false;b.textContent='Eliminar';b.classList.remove('armed');}ferr(errMsg(e));}
}

/* ---------- Eventos ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;
  var act=b.getAttribute('data-act');if(act.indexOf('dc-')!==0)return;
  if(act==='dc-new'){openForm(null);return;}
  if(act==='dc-edit'){openForm(b.getAttribute('data-id'));return;}
  if(act==='dc-doc'){e.preventDefault();openDoc(b.getAttribute('data-path'));return;}
  if(act==='dc-del'){del();return;}
  if(act==='dc-reload'){load();return;}
  if(act==='dc-fe'){S.fe=b.getAttribute('data-v');render();return;}
});
document.addEventListener('submit',function(e){if(e.target&&e.target.id==='dcsheet'){e.preventDefault();e.stopPropagation();save();}},true);
document.addEventListener('input',function(e){if(e.target.id==='q-dc'){S.q=e.target.value;render();}});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='dc-ger'){S.ger=t.value;render();return;}
  if(t.id==='dc-file'){S.file=t.files&&t.files[0]||null;var h=$('dc-filehint');if(h&&S.file)h.textContent=S.file.size>MAX_MB*1024*1024?'Este archivo pesa más de '+MAX_MB+' MB.':'Se subirá: '+S.file.name+' ('+Math.max(1,Math.round(S.file.size/1024))+' KB).';}
});

if(window.Sesion)Sesion.on(function(u){if(u)load();else{S.items=[];S.status='idle';render();}});
})();
