/* Vocal Studio Service Worker — offline-first cache shell
 * 전략 매핑 (PWA 2026 best practices):
 *  - HTML/navigate : Network-first + cached fallback  (최신 버전 우선)
 *  - 정적 자원      : Cache-first  + 백그라운드 갱신  (성능)
 *  - Firestore/Firebase : 항상 네트워크 (실시간 데이터)
 */
const VERSION = 'vs-v2-2026-06-20-schedule-count-visibility';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(VERSION).then(function(c){
      return c.addAll(CORE).catch(function(){ /* 일부 누락 무시 */ });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==VERSION;}).map(function(k){return caches.delete(k);}));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Firestore / Firebase / Google API 는 항상 네트워크 (실시간 동기화) */
  if (url.hostname.indexOf('firestore') >= 0 ||
      url.hostname.indexOf('firebaseio') >= 0 ||
      url.hostname.indexOf('googleapis.com') >= 0) {
    return;
  }

  /* HTML/내비게이션 — Network-first */
  if (req.mode === 'navigate' || (req.headers.get('accept')||'').indexOf('text/html') >= 0) {
    e.respondWith(
      fetch(req).then(function(res){
        const copy = res.clone();
        caches.open(VERSION).then(function(c){ c.put(req, copy).catch(function(){}); });
        return res;
      }).catch(function(){ return caches.match(req).then(function(r){ return r || caches.match('./index.html'); }); })
    );
    return;
  }

  /* 정적 자원 — Cache-first + 백그라운드 갱신 (stale-while-revalidate) */
  e.respondWith(
    caches.match(req).then(function(cached){
      const fetchPromise = fetch(req).then(function(res){
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(VERSION).then(function(c){ c.put(req, copy).catch(function(){}); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    })
  );
});
