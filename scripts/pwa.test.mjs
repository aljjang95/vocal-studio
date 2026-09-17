import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const html=read('index.html'),manifest=JSON.parse(read('manifest.json'));
test('installed identity stays tied to the previous start URL and uses both device layouts',()=>{
  assert.equal(manifest.id,'/index.html');assert.equal(manifest.start_url,'/index.html');assert.equal(manifest.scope,'/');
  assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'any');assert.equal(manifest.lang,'ko-KR');
  assert.equal(manifest.theme_color,'#245f75');assert.equal(manifest.background_color,'#f3f5f8');
});
test('manifest credentials and Apple icon are explicit without disabling zoom',()=>{
  assert.match(html,/<link[^>]+rel="manifest"[^>]+crossorigin="use-credentials"/);
  assert.match(html,/<link[^>]+rel="apple-touch-icon"[^>]+href="\/icon-192.png"/);
  assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1(?:\.0)?[,"]/);
});
test('installation icons match declared PNG sizes and do not falsely claim maskable artwork',()=>{
  for(const size of [192,512]){const icon=manifest.icons.find(x=>x.sizes===`${size}x${size}`);assert.ok(icon);
    const bytes=readFileSync(new URL(icon.src,root));assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
    assert.equal(icon.purpose,'any');}
});
test('PWA workspace links to the existing today, schedule and customer actions',()=>{
  assert.match(html,/id="pwaWorkspace"/);assert.match(html,/id="pwaInstallHelp"/);
  for(const action of ['today','schedule','students'])assert.match(html,new RegExp('id="pwaGo'+action+'"[^>]+onclick="go\\(\''+action+'\'\\)"'));
  assert.match(html,/홈 화면에 추가/);assert.match(html,/서버 전송 대기/);
});
function serviceWorker(fetch){
  const events={},removed=[];const self={location:{origin:'https://studio.example'},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  const caches={keys:async()=>['vs-v2-old','unrelated-cache'],delete:async name=>{removed.push(name);}};
  vm.runInNewContext(read('sw.js'),{self,fetch,Response,URL,caches});
  return {events,removed,request:request=>{let result;events.fetch({request,respondWith:r=>result=r});return result;}};
}
test('offline app launch is a generic reconnect screen, never cached private customer data',async()=>{
  const sw=serviceWorker(async()=>{throw Error('network');});
  const response=await sw.request({url:'https://studio.example/index.html',method:'GET',mode:'navigate'});
  assert.equal(response.status,503);assert.match(response.headers.get('cache-control'),/no-store/);
  const text=await response.text();assert.match(text,/인터넷 연결/);assert.match(text,/다시 열기/);
  assert.doesNotMatch(text,/localStorage|indexedDB|__QA_CUSTOMER__|<script/i);
});
test('API requests, mutations and external navigations never get fake offline success',async()=>{
  const sw=serviceWorker(async()=>{throw Error('network');});
  for(const request of [{url:'https://studio.example/api/state',method:'GET',mode:'navigate'},
    {url:'https://studio.example/api/commit',method:'POST',mode:'cors'},
    {url:'https://studio.example/index.html',method:'POST',mode:'navigate'},
    {url:'https://other.example/index.html',method:'GET',mode:'navigate'}])await assert.rejects(sw.request(request));
});
test('authentication replies and online responses pass through unchanged',async()=>{
  for(const status of [200,401,403,503]){const expected=new Response('upstream',{status});const sw=serviceWorker(async()=>expected);
    assert.equal(await sw.request({url:'https://studio.example/index.html',method:'GET',mode:'navigate'}),expected);}
});
test('only the app old cache is retired, no private state is cached',async()=>{
  const sw=serviceWorker(async()=>Response.json({}));let task;sw.events.activate({waitUntil:p=>task=p});await task;
  assert.deepEqual(sw.removed,['vs-v2-old']);assert.doesNotMatch(read('sw.js'),/caches\.(open|match)|cache\.put/);
});
