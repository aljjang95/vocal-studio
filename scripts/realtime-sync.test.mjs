import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const transport=read('cf-transport.js'),worker=read('worker/index.mjs'),state=read('worker/state.mjs');
const hash='a'.repeat(64);
const record=(revision=0)=>({state:{students:[{id:'s1',name:'QA'}]},revision,mode:'active',hash});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('worker exposes authenticated same-origin realtime events through the Durable Object',()=>{
  assert.match(worker,/\/api\/events/);assert.match(worker,/sameOrigin\(request, url\)/);
  assert.match(state,/acceptWebSocket/);assert.match(state,/getWebSockets/);assert.match(state,/state-changed/);
});
test('transport uses push events and only a low-frequency audit instead of one request per second',async()=>{
  const sockets=[];class FakeWebSocket{constructor(url){this.url=url;this.readyState=0;sockets.push(this);}close(){this.readyState=3;}}
  const timers=new Map();let timerId=0,reads=0;
  const context={fetch:async()=>{reads++;return Response.json(record(reads-1));},AbortController,Response,Blob,TextEncoder,Uint8Array,atob,crypto:webcrypto,
    WebSocket:FakeWebSocket,location:{protocol:'https:',host:'studio.example'},
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(transport,context);let values=0;
  const stop=context.VCFTransport.database().collection().doc().onSnapshot({},()=>values++,()=>{});
  await tick();await tick();assert.equal(reads,1);assert.equal(sockets.length,1);assert.match(sockets[0].url,/wss:\/\/studio\.example\/api\/events/);
  sockets[0].onopen?.();assert.ok([...timers.values()].every(t=>t.ms>=60000),'no fast polling timer');
  sockets[0].onmessage?.({data:JSON.stringify({type:'state-changed',revision:1})});await tick();await tick();
  assert.equal(reads,2);assert.equal(values,2);stop();assert.equal(timers.size,0);
});
