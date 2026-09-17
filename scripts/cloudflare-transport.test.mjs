import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../cf-transport.js',import.meta.url),'utf8');
const hash='a'.repeat(64);
const record=(state={students:[{id:'one',name:'initial'}]},revision=0,mode='active')=>({state,revision,mode,hash});
const json=(value,status=200)=>Response.json(value,{status});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(fetch,options={}){
  const timers=new Map();let next=0;
  const context={fetch,AbortController,Response,Blob,TextEncoder,Uint8Array,atob,crypto:webcrypto,
    setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),...options};
  vm.runInNewContext(source,context);
  return {api:context.VCFTransport,timers};
}
const doc=h=>h.api.database().collection().doc();
test('a login HTML response cannot masquerade as a missing customer database',async()=>{
  const h=harness(async()=>new Response('<html>Login</html>',{headers:{'content-type':'text/html'}}));
  await assert.rejects(doc(h).get());
});
test('malformed and incomplete customer snapshots are rejected',async()=>{
  for(const value of [{},{state:{},mode:'active',revision:-1,hash},{state:[],mode:'active',revision:0,hash},
    {state:{},mode:'unknown',revision:0,hash},{state:{},mode:'active',revision:0.5,hash},record({},Number.MAX_SAFE_INTEGER+1)]){
    const h=harness(async()=>json(value));await assert.rejects(doc(h).get());
  }
});
test('only the explicit missing-state error denotes an empty destination',async()=>{
  const h=harness(async()=>json({error:'missing-state'},404));assert.equal((await doc(h).get()).exists,false);
  for(const response of [json({error:'not-found'},404),new Response('missing',{status:404})]){
    const bad=harness(async()=>response);await assert.rejects(doc(bad).get());
  }
});
test('a commit needs a valid acknowledgement, not merely HTTP 200',async()=>{
  for(const ack of [new Response('<html>Login</html>'),json({}),json({...record({},1),ok:false}),
    json({...record({},8),ok:true}),json({...record({students:[{id:'one',name:'wrong'}]},1),ok:true})]){
    const h=harness(async path=>path==='/api/state'?json(record()):ack);
    await assert.rejects(h.api.database().runTransaction(async tx=>{
      const s=await tx.get();const data=s.data();data.students[0].name='saved';tx.set(null,data);return 'accepted';
    }));
  }
});
test('valid commits preserve unknown root fields and acknowledge exactly one revision',async()=>{
  const state={students:[{id:'one',name:'initial'}],future:{retained:true}};let calls=0;
  const h=harness(async(path,options)=>{
    if(path==='/api/state')return json(record(state,4));
    calls++;const body=JSON.parse(options.body);assert.equal(body.baseRevision,4);
    assert.equal(body.state._vsSyncRevision,undefined);assert.ok(body.requestId.length>=8);
    return json({...record({...state,...body.state},5),ok:true});
  });
  const result=await h.api.database().runTransaction(async tx=>{
    const s=await tx.get();const value=s.data();value.students[0].name='saved';tx.set(null,value);return 'accepted';
  });
  assert.equal(result,'accepted');assert.equal(calls,1);
});
test('unsubscribed polling cannot deliver late customer data or errors',async()=>{
  for(const fail of [false,true]){
    let complete;const h=harness(()=>new Promise((resolve,reject)=>{complete=()=>fail?reject(Error('offline')):resolve(json(record()));}));
    let calls=0;const stop=doc(h).onSnapshot({},()=>calls++,()=>calls++);stop();complete();
    await tick();await tick();assert.equal(calls,0);assert.equal(h.timers.size,0);
  }
});
test('API requests reject redirects and bypass caches',async()=>{
  let observed;const h=harness(async(path,init)=>{observed=init;return json({ok:true});});
  await h.api.api('/api/session');assert.equal(observed.cache,'no-store');assert.equal(observed.redirect,'error');
  assert.equal(observed.credentials,'same-origin');assert.equal(observed.headers['X-VS-Protocol'],'vs-cf-1');
});
test('a hung response is aborted within a bounded request deadline',async()=>{
  const h=harness((path,init)=>new Promise((resolve,reject)=>init.signal?.addEventListener('abort',()=>reject(Error('aborted')))));
  const pending=doc(h).get();
  const deadline=[...h.timers.values()].find(t=>t.ms>=1000&&t.ms<=30000);assert.ok(deadline,'request timeout exists');
  const rejected=assert.rejects(pending);deadline.fn();await rejected;assert.equal(h.timers.size,0);
});
test('staged customer state cannot be committed',async()=>{
  let writes=0;const h=harness(async path=>{if(path!=='/api/state')writes++;return json(record({},0,'staged'));});
  await assert.rejects(h.api.database().runTransaction(async tx=>{await tx.get();tx.set(null,{students:[]});}));assert.equal(writes,0);
});
test('revision conflicts remain visible and never report successful saving',async()=>{
  const h=harness(async path=>path==='/api/state'?json(record()):json({error:'revision-conflict'},409));
  await assert.rejects(h.api.database().runTransaction(async tx=>{const s=await tx.get();tx.set(null,s.data());}));
});
