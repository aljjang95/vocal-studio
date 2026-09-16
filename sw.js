/* Vocal Studio Cloudflare unified service worker.
 * Network-only by design: authenticated state/assets must never be served from an old cache.
 */
self.addEventListener('install',function(event){
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(key){return key.indexOf('vs-v2-')===0;}).map(function(key){return caches.delete(key);}));
  }).then(function(){return self.clients.claim();}));
});

self.addEventListener('fetch',function(event){
  event.respondWith(fetch(event.request));
});
