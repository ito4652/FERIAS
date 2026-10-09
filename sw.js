/* Primero la red, con copia guardada como respaldo: los datos siempre se ven al día y la app abre sin conexión. */
var CACHE='ferias-v1';
var ASSETS=['./','index.html','app.css','app.js','data.json','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  e.respondWith(
    fetch(req).then(function(res){
      if(res&&res.ok){
        var copy=res.clone();
        var key=url.pathname.slice(-9)==='data.json'?new Request(url.origin+url.pathname):req;
        caches.open(CACHE).then(function(c){c.put(key,copy);});
      }
      return res;
    }).catch(function(){
      var key=url.pathname.slice(-9)==='data.json'?new Request(url.origin+url.pathname):req;
      return caches.match(key,{ignoreSearch:true}).then(function(hit){return hit||caches.match('index.html');});
    })
  );
});
