// Cache only the app shell. Budget data is synced through Firestore, not this cache.
const CACHE='little-by-little-shell-v6-income-paydays';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);if(u.origin!==self.location.origin||event.request.method!=='GET')return;
 if(event.request.mode==='navigate'){
   event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return r})));
});
