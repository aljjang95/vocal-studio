/* Vocal Studio PWA. Network-only private data; generic offline navigation notice. */
self.addEventListener('install',function(event){event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(key){return key.indexOf('vs-v2-')===0;}).map(function(key){return caches.delete(key);}));
  }).then(function(){return self.clients.claim();}));
});
function offlineNotice(){
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#245f75"><title>연결 확인 · 보컬스튜디오</title>
<style>body{margin:0;background:#f3f5f8;color:#18283b;font:16px/1.8 system-ui,sans-serif;padding:24px}main{max-width:480px;margin:12vh auto;background:white;border:1px solid #d8e2eb;border-radius:20px;padding:28px}small{color:#245f75;letter-spacing:2px}h1{font-size:25px;line-height:1.4}p{color:#43576c}a{display:inline-block;min-height:44px;box-sizing:border-box;padding:12px 20px;background:#245f75;border-radius:10px;color:white;text-decoration:none;font-weight:600}a:focus-visible{outline:3px solid #62a9cc;outline-offset:4px}</style></head>
<body><main><small>VOCAL STUDIO</small><h1>인터넷 연결을 확인해 주세요</h1><p>고객 자료를 안전하게 불러오려면 연결이 필요합니다. 현재 화면은 저장된 고객 목록이나 최신 일정이 아닙니다.</p><p>이미 열려 있는 앱에서 기기 저장에 성공한 미전송 변경은 연결 복구 후 동기화 상태를 확인하세요. 앱을 삭제하거나 기기 저장소를 지우지 마세요.</p><a href="/index.html">연결 후 다시 열기</a></main></body></html>`,{
    status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
self.addEventListener('fetch',function(event){
  var request=event.request,url=new URL(request.url);
  if(request.method==='GET'&&request.mode==='navigate'&&url.origin===self.location.origin&&['/','/index.html'].includes(url.pathname)){
    event.respondWith(fetch(request).catch(function(){return offlineNotice();}));return;
  }
  // Never turn an API/mutation error into an HTML success or queue writes here.
  event.respondWith(fetch(event.request));
});
