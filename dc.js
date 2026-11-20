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
/* Gerencias de ICB, en el orden de sus carpetas. */
var GERENCIAS=['Gerencia General','Gerencia Legal','Gerencia Comercial','Gerencia Marketing','Agencia Marketing','Gerencia Operaciones',
  'Subgerencia Calidad y MA','Gerencia de Logística','Gerencia Supply Chain y Nuevos Negocios','Gerencia Finanzas e Informática','Gerencia Recursos Humanos'];
/* Reconoce una gerencia desde un nombre de carpeta como "3. Gerencia Comercial" o "6a Subgerencia Calidad y MA". */
function gerDe(txt){
  var t=nz(String(txt||'').replace(/^\s*\d+\s*[a-z]?\s*[.)\-]?\s*/i,''));if(!t)return '';
  for(var i=0;i<GERENCIAS.length;i++)if(nz(GERENCIAS[i])===t)return GERENCIAS[i];
  for(var j=0;j<GERENCIAS.length;j++){var g=nz(GERENCIAS[j]).replace(/^(sub)?gerencia (de )?/,'');if(g&&t.replace(/^(sub)?gerencia (de )?/,'')===g)return GERENCIAS[j];}
  return '';
}
function gerOrden(g){var i=GERENCIAS.indexOf(g);return i<0?(g?90:99):i;}
function gerOptions(sel,vacio){
  var extra=sel&&GERENCIAS.indexOf(sel)<0?[sel]:[];
  return '<option value="">'+(vacio||'Sin gerencia')+'</option>'+GERENCIAS.concat(extra).map(function(g){return '<option'+(g===sel?' selected':'')+'>'+esc(g)+'</option>';}).join('');
}
var EST_CLS={'Vigente':'ok','En revisión':'mat','Por actualizar':'warn'};
var fFecha=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'});
var S={status:'idle',items:[],error:'',q:'',fe:'todos',ger:'',edit:null,file:null,busy:false,armed:false};

var I={doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  alert:'<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17.5v.5"/>',
  upload:'<path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'};
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
  var list=S.items.filter(function(c){
    return !q||nz([c.cargo,c.gerencia,c.reporta,c.responsable,c.notas].join(' ')).indexOf(q)>-1;
  });
  var head='<div class="cu-head pf-top"><div><h2>Descriptores de cargo</h2><p class="pf-sub">'+S.items.length+(S.items.length===1?' descriptor':' descriptores')+
    (nViejos?' · <b class="pf-next">'+nViejos+' sin actualizar hace más de un año</b>':'')+'</p></div>'+
    '<div class="cu-tools">'+CC.searchBox('q-dc','Buscar cargo, gerencia o responsable',S.q,'Buscar descriptores')+
    '<button class="btn" data-act="dc-multi">'+di('upload',17)+'Subir varios</button>'+
    '<button class="btn" data-act="dc-folder">'+di('folder',17)+'Subir carpeta</button>'+
    '<button class="btn primary" data-act="dc-new">'+ic('plus',17)+'Nuevo descriptor</button></div></div>';
  var body;
  if(!S.items.length)body='<div class="empty"><div class="badge">'+di('doc',24)+'</div><h2>Aún no hay descriptores</h2><p>Agrega cada cargo con su gerencia, a quién reporta, su estado y el documento del descriptor.</p><div class="adm-actions"><button class="btn primary" data-act="dc-new">'+ic('plus',17)+'Agregar uno</button><button class="btn" data-act="dc-multi">'+di('upload',17)+'Subir varios documentos</button></div></div>';
  else if(!list.length)body='<p class="none">Ningún descriptor coincide con la búsqueda o los filtros.</p>';
  else{
    var G={},order=[];
    list.forEach(function(c){var k=c.gerencia||'';if(!G[k]){G[k]=[];order.push(k);}G[k].push(c);});
    order.sort(function(a,b){return gerOrden(a)-gerOrden(b)||a.localeCompare(b,'es');});
    body=order.map(function(k){
      return '<section class="pf-group"><h3 class="do-st">'+esc(k||'Sin gerencia')+' <span>'+G[k].length+'</span></h3><div class="dc-grid">'+
        G[k].sort(function(a,b){return a.cargo.localeCompare(b.cargo,'es');}).map(card).join('')+'</div></section>';
    }).join('');
  }
  CC.keepFocus('q-dc','<div class="cu">'+head+body+'</div>',el);
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
    '<div class="fld"><label for="dc-gerencia">Gerencia</label><select id="dc-gerencia">'+gerOptions(rec.gerencia)+'</select></div>'+
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

/* ---------- Subir varios documentos de una vez ----------
   El cargo se propone desde el nombre del archivo; si ya existe un descriptor con ese cargo, se le reemplaza el documento. */
function cargoDeArchivo(n){
  var t=String(n||'').replace(/\.[a-z0-9]{1,5}$/i,'').replace(/[_\-.]+/g,' ').replace(/\s+/g,' ').trim();
  t=t.replace(/^(descriptor(es)?( de)?( cargo(s)?)?|dc|perfil( de)?( cargo)?)\s+/i,'').replace(/\s+(v\d+|final|vf|\d{4})$/i,'').trim();
  return t?t.charAt(0).toUpperCase()+t.slice(1):'';
}
function buscarCargo(cargo){var k=nz(cargo);return k?S.items.filter(function(c){return nz(c.cargo)===k;})[0]||null:null;}
function bAcc(it){return it.big?'<span class="pill bad">Pesa más de '+MAX_MB+' MB</span>':!it.cargo.trim()?'<span class="pill warn">Falta el cargo</span>':it.match?'<span class="pill mat">Reemplaza documento</span>':'<span class="pill ok">Nuevo descriptor</span>';}
function openBulk(files){
  files=Array.prototype.slice.call(files||[]).filter(function(f){return /\.(pdf|docx?)$/i.test(f.name);});
  if(!files.length){toast('Elige archivos PDF o Word.');return;}
  S.bulk={items:files.map(function(f){
    var c=cargoDeArchivo(f.name),m=buscarCargo(c),big=f.size>MAX_MB*1024*1024;
    var segs=String(f.webkitRelativePath||'').split('/').slice(0,-1),g='';
    for(var k=segs.length-1;k>=0&&!g;k--)g=gerDe(segs[k]);
    return {file:f,cargo:c,on:!big,match:m?m.id:null,big:big,ger:g||(m?m.gerencia:'')};
  }),busy:false};
  var conGer=S.bulk.items.filter(function(x){return x.ger;}).length;
  var gers=[];S.items.forEach(function(c){if(c.gerencia&&gers.indexOf(c.gerencia)<0)gers.push(c.gerencia);});
  $('sheet-root').innerHTML='<div class="backdrop" data-act="backdrop"><form class="sheet wide" id="dcbulk" role="dialog" aria-modal="true" aria-labelledby="dcb-t" novalidate>'+
    '<h2 id="dcb-t">Subir '+files.length+(files.length===1?' documento':' documentos')+'</h2>'+
    '<p class="imeta">Revisa el nombre de cada cargo. Si ya existe un descriptor con ese cargo, se reemplaza su documento.</p>'+
    (conGer?'<p class="imeta"><b>'+conGer+' de '+files.length+'</b> archivos tienen la gerencia detectada desde su carpeta.</p>':'')+
    '<div class="fields"><div class="fld"><label for="dc-bger">Asignar gerencia a todos</label><select id="dc-bger">'+gerOptions('','Elegir…')+'</select></div>'+
      fld('best','Estado (para los nuevos)','select','Vigente',{options:ESTADOS})+fld('bfecha','Última actualización','date',CC.todayStr())+
      '</div>'+
    '<div class="itable"><table><thead><tr><th></th><th>Archivo</th><th>Cargo</th><th>Gerencia</th><th>Qué pasará</th></tr></thead><tbody>'+
      S.bulk.items.map(function(it,i){
        return '<tr'+(it.on?'':' class="off"')+'><td><input type="checkbox" data-bi="'+i+'"'+(it.on?' checked':'')+(it.big?' disabled':'')+' aria-label="Subir '+esc(it.file.name)+'"></td>'+
          '<td><span class="dcb-file">'+di('doc',15)+'<span>'+esc(it.file.name)+'</span></span></td>'+
          '<td><input type="text" data-bc="'+i+'" value="'+esc(it.cargo)+'" aria-label="Cargo para '+esc(it.file.name)+'"></td>'+
          '<td><select data-bg="'+i+'" aria-label="Gerencia para '+esc(it.file.name)+'">'+gerOptions(it.ger)+'</select></td><td id="dcb-acc-'+i+'">'+bAcc(it)+'</td></tr>';
      }).join('')+'</tbody></table></div>'+
    '<div class="ferr" id="dcerr" role="alert"></div>'+
    '<div class="sheet-actions"><button class="btn primary" type="submit" id="dc-save">'+bulkBtn()+'</button><button class="btn" type="button" data-act="close">Cancelar</button></div></form></div>';
}
function bulkBtn(){var n=S.bulk.items.filter(function(x){return x.on;}).length;return 'Subir '+n+(n===1?' documento':' documentos');}
function bulkRefresh(){var b=$('dc-save');if(b&&!S.bulk.busy){b.textContent=bulkBtn();b.disabled=!S.bulk.items.some(function(x){return x.on;});}}
async function runBulk(){
  var B=S.bulk;if(!B||B.busy)return;
  var sel=B.items.filter(function(x){return x.on;});if(!sel.length)return;
  if(sel.some(function(x){return !x.cargo.trim();})){ferr('Hay archivos sin nombre de cargo. Escríbelo o desmárcalos.');return;}
  var est=v('best')||'Vigente',fecha=v('bfecha');
  B.busy=true;ferr('');var btn=$('dc-save');if(btn)btn.disabled=true;
  var ok=0,mal=[];
  for(var i=0;i<sel.length;i++){
    var it=sel[i];if(btn)btn.textContent='Subiendo '+(i+1)+' de '+sel.length+'…';
    var nuevo='';
    try{
      var prev=it.match?S.items.filter(function(c){return c.id===it.match;})[0]:null;
      var c=prev?Object.assign({},prev):{cargo:it.cargo.trim(),gerencia:it.ger,reporta:'',estado:est,responsable:'',notas:''};
      if(prev&&it.ger)c.gerencia=it.ger;
      if(fecha)c.fecha=fecha;
      nuevo=await upload(c,it.file);
      var oldDoc=prev&&prev.docPath;
      c.docPath=nuevo;c.docNombre=it.file.name;
      var saved;
      if(prev){saved=fromRow(chk(await sb.from(TABLE).update(toRow(c)).eq('id',prev.id).select().single()));S.items=S.items.map(function(x){return x.id===saved.id?saved:x;});if(oldDoc)removeDoc(oldDoc);}
      else{saved=fromRow(chk(await sb.from(TABLE).insert(toRow(c)).select().single()));S.items.push(saved);}
      ok++;
    }catch(e){if(nuevo)removeDoc(nuevo);mal.push(it.file.name+': '+errMsg(e));}
  }
  B.busy=false;
  if(!mal.length){CC.closeSheet();S.bulk=null;toast(ok+(ok===1?' descriptor guardado':' descriptores guardados'));render();return;}
  render();ferr('Se guardaron '+ok+'. No se pudieron subir: '+mal.join(' · '));if(btn){btn.disabled=false;btn.textContent='Cerrar';btn.setAttribute('data-done','1');}
}

/* ---------- Eventos ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b)return;
  var act=b.getAttribute('data-act');if(act.indexOf('dc-')!==0)return;
  if(act==='dc-new'){openForm(null);return;}
  if(act==='dc-multi'){var mi=$('dc-multifile');if(mi){mi.value='';mi.click();}return;}
  if(act==='dc-folder'){var fo=$('dc-folderfile');if(fo){fo.value='';fo.click();}return;}
  if(act==='dc-edit'){openForm(b.getAttribute('data-id'));return;}
  if(act==='dc-doc'){e.preventDefault();openDoc(b.getAttribute('data-path'));return;}
  if(act==='dc-del'){del();return;}
  if(act==='dc-reload'){load();return;}
  if(act==='dc-fe'){S.fe=b.getAttribute('data-v');render();return;}
});
document.addEventListener('submit',function(e){
  if(e.target&&e.target.id==='dcsheet'){e.preventDefault();e.stopPropagation();save();}
  if(e.target&&e.target.id==='dcbulk'){e.preventDefault();e.stopPropagation();var b=$('dc-save');if(b&&b.getAttribute('data-done')){CC.closeSheet();S.bulk=null;return;}runBulk();}
},true);
document.addEventListener('input',function(e){
  if(e.target.id==='q-dc'){S.q=e.target.value;render();return;}
  if(S.bulk&&e.target.hasAttribute&&e.target.hasAttribute('data-bc')){
    var i=+e.target.getAttribute('data-bc'),it=S.bulk.items[i];it.cargo=e.target.value;var m=buscarCargo(it.cargo);it.match=m?m.id:null;
    var cell=$('dcb-acc-'+i);if(cell)cell.innerHTML=bAcc(it);
  }
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='dc-multifile'||t.id==='dc-folderfile'){openBulk(t.files);return;}
  if(S.bulk&&t.id==='dc-bger'){if(!t.value)return;S.bulk.items.forEach(function(it,i){it.ger=t.value;var s2=document.querySelector('select[data-bg="'+i+'"]');if(s2)s2.value=t.value;});return;}
  if(S.bulk&&t.hasAttribute&&t.hasAttribute('data-bg')){S.bulk.items[+t.getAttribute('data-bg')].ger=t.value;return;}
  if(S.bulk&&t.hasAttribute&&t.hasAttribute('data-bi')){var it=S.bulk.items[+t.getAttribute('data-bi')];it.on=t.checked;t.closest('tr').className=it.on?'':'off';bulkRefresh();return;}
  if(t.id==='dc-file'){S.file=t.files&&t.files[0]||null;var h=$('dc-filehint');if(h&&S.file)h.textContent=S.file.size>MAX_MB*1024*1024?'Este archivo pesa más de '+MAX_MB+' MB.':'Se subirá: '+S.file.name+' ('+Math.max(1,Math.round(S.file.size/1024))+' KB).';}
});

var mf=document.createElement('input');mf.type='file';mf.id='dc-multifile';mf.multiple=true;mf.accept='.pdf,.doc,.docx';mf.hidden=true;document.body.appendChild(mf);
var fd=document.createElement('input');fd.type='file';fd.id='dc-folderfile';fd.multiple=true;fd.setAttribute('webkitdirectory','');fd.hidden=true;document.body.appendChild(fd);
if(window.Sesion)Sesion.on(function(u){if(u)load();else{S.items=[];S.status='idle';render();}});
})();
