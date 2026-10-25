self.addEventListener("install", function(e){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function(e){
  var u = new URL(e.request.url);
  if(e.request.method !== "GET" || u.pathname.indexOf("/api/") === 0) return;
  e.respondWith(fetch(e.request).then(function(r){
    var c = r.clone(); caches.open("bc1").then(function(k){ k.put(e.request, c); }); return r;
  }).catch(function(){ return caches.match(e.request); }));
});
