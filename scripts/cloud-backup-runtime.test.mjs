import test from 'node:test';
import assert from 'node:assert/strict';
import cloud from '../vs-cloud-backup.js';
import sync from '../vs-sync.js';
import {createHash} from 'node:crypto';

const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<20;i++)await tick();}
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const ns='vocal-studio';
const prefix=o=>'vsC_sync_v1:'+encodeURIComponent(ns+':'+o)+':backup:';
const journal=(owner,revision,memo,extra={})=>JSON.stringify({version:1,namespace:ns,owner,revision,base:{students:[]},local:{students:[{id:'s1',memo}]},recovery:[],...extra});

function server(){
  const s={rows:new Map(),calls:[],mode:'ok',gates:[],pageSize:100};
  s.fetch=async(url,init={})=>{
    s.calls.push({url,init});
    const g=s.gates.shift();if(g)await g.promise;
    if(s.mode==='down')throw new TypeError('offline');
    if(s.mode==='hang')return new Promise(()=>{});
    if(s.mode==='500'||s.mode==='403')return new Response('x',{status:Number(s.mode)});
    if(s.mode==='html')return new Response('<html>',{status:200});
    if(init.method==='POST'){
      const b=JSON.parse(init.body);s.rows.set(b.key,b.text);
      if(s.mode==='partial')return Response.json({key:b.key,text:b.text.slice(0,-3)});
      if(s.mode==='otherkey')return Response.json({key:b.key+'x',text:b.text});
      return Response.json({key:b.key,text:s.rows.get(b.key)});
    }
    if(s.mode==='noRows')return Response.json({ok:true});
    const query=new URL(url,'http://local.test').searchParams,p=query.get('prefix'),key=query.get('key');
    if(key!==null)return Response.json({rows:s.rows.has(key)?[{key,text:s.rows.get(key)}]:[]});
    assert.equal(query.get('metadata'),'1');
    const offset=Number(query.get('cursor')||0),all=[...s.rows].filter(([k])=>k.startsWith(p)),page=all.slice(offset,offset+s.pageSize);
    return Response.json({rows:page.map(([key,text])=>{
      let j;try{j=JSON.parse(text);}catch{return {key,sha256:'invalid'};}
      return {key,sha256:createHash('sha256').update(text).digest('hex'),length:text.length,revision:j.revision,
        pending:JSON.stringify(j.base)!==JSON.stringify(j.local)||!!j.ack,recoveryCount:(j.recovery?.length||0)+(j.overflowPrevious?.length||0)};
    }),cursor:offset+page.length<all.length?String(offset+page.length):null});
  };
  return s;
}
function local(){
  const l={rows:new Map(),putFail:false,listFail:false,removeFail:false,corrupt:false,removes:[]};
  l.put=async(k,t)=>{if(l.putFail)throw Error('idb');l.rows.set(k,t);return l.corrupt?t+'!':t;};
  l.list=async p=>{if(l.listFail)throw Error('idb');return [...l.rows].filter(([k])=>k.startsWith(p)).map(([key,text])=>({key,text}));};
  l.remove=async(k,e)=>{if(l.removeFail)throw Error('idb');l.removes.push([k,e]);if(l.rows.get(k)===e){l.rows.delete(k);return true;}return false;};
  return l;
}
function setup(options={}){
  const srv=options.server||server(),disk=options.local||local(),state={owner:options.owner===undefined?'admin-A':options.owner},durable=[];
  const api=cloud.create({localStore:disk,owner:()=>state.owner,namespace:ns,fetch:srv.fetch,timeoutMs:options.timeoutMs||40,
    resumeHint:options.resumeHint,currentKey:options.currentKey,
    onDurable:options.onDurable||((k,t,location)=>durable.push([k,t,location]))});
  return {api,srv,disk,state,durable,key:prefix('admin-A')+'tab-1'};
}

test('cloud success is verified, uses the same-origin protocol, and removes only the exact device copy',async()=>{
  const h=setup(),text=journal('admin-A',3,'one');h.disk.rows.set(h.key,text);
  assert.equal(await h.api.put(h.key,text),text);
  assert.equal(h.srv.rows.get(h.key),text);assert.equal(h.disk.rows.size,0);assert.deepEqual(h.durable,[[h.key,text,'cloud']]);
  const call=h.srv.calls[0];assert.equal(call.url,'/api/backups');assert.equal(call.init.method,'POST');assert.equal(call.init.credentials,'same-origin');
  assert.equal(call.init.headers['X-VS-Protocol'],'vs-cf-1');assert.equal(call.init.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(call.init.body),{key:h.key,text});
});
test('offline saves stay on the device, are acknowledged only after a verified IndexedDB write, and list from disk',async()=>{
  const h=setup();h.srv.mode='down';const text=journal('admin-A',3,'offline');
  assert.equal(await h.api.put(h.key,text),text);assert.equal(h.disk.rows.get(h.key),text);assert.deepEqual(h.durable,[[h.key,text,'device']]);
  assert.deepEqual(await h.api.list(prefix('admin-A')),[{key:h.key,text}]);
  const get=h.srv.calls.at(-1);assert.equal(get.init.method,'GET');assert.equal(get.url,'/api/backups?prefix='+encodeURIComponent(prefix('admin-A'))+'&metadata=1');
});
test('each bad cloud answer falls back to the device copy',async()=>{
  for(const mode of ['500','partial','otherkey','html','hang']){
    const h=setup();h.srv.mode=mode;const text=journal('admin-A',1,mode);
    assert.equal(await h.api.put(h.key,text),text,mode);assert.equal(h.disk.rows.get(h.key),text,mode);assert.equal(h.durable.length,1,mode);
  }
});
test('no acknowledgement when the device write fails too, or reads back different bytes',async()=>{
  for(const flaw of ['putFail','corrupt']){
    const h=setup();h.srv.mode='down';h.disk[flaw]=true;
    await assert.rejects(h.api.put(h.key,journal('admin-A',1,'x')));assert.deepEqual(h.durable,[]);
  }
  const bare=cloud.create({owner:()=> 'admin-A',namespace:ns,fetch:async()=>{throw Error('down');},timeoutMs:20});
  await assert.rejects(bare.put(prefix('admin-A')+'t',journal('admin-A',1,'x')),/backup-unavailable/);
});
test('a failing session pointer callback does not fail a durable save',async()=>{
  const h=setup({onDurable(){throw Error('quota');}});const text=journal('admin-A',1,'x');
  assert.equal(await h.api.put(h.key,text),text);
});
test('concurrent saves to one key reach the server in order and only the newest is marked durable',async()=>{
  const h=setup(),a=journal('admin-A',1,'A'),b=journal('admin-A',2,'B'),g=gate();h.srv.gates.push(g);
  const first=h.api.put(h.key,a);await settle();const second=h.api.put(h.key,b);await settle();
  assert.equal(h.srv.calls.length,1);g.resolve();assert.equal(await first,a);assert.equal(await second,b);
  assert.deepEqual(h.srv.calls.map(c=>JSON.parse(c.init.body).text),[a,b]);assert.equal(h.srv.rows.get(h.key),b);assert.deepEqual(h.durable,[[h.key,b,'cloud']]);
});
test('earlier offline copies are removed after a newer cloud save, but a different newer device row survives',async()=>{
  const h=setup(),a=journal('admin-A',1,'A'),b=journal('admin-A',2,'B');
  h.srv.mode='down';await h.api.put(h.key,a);assert.equal(h.disk.rows.get(h.key),a);
  h.srv.mode='ok';await h.api.put(h.key,b);assert.equal(h.disk.rows.size,0);
  h.srv.mode='down';await h.api.put(h.key,a);h.disk.rows.set(h.key,journal('admin-A',9,'newer offline'));
  await h.api.list(prefix('admin-A'));
  h.srv.mode='ok';await h.api.put(h.key,b);assert.equal(JSON.parse(h.disk.rows.get(h.key)).local.students[0].memo,'newer offline');
});
test('a failed device cleanup is retried and never fails the cloud-durable save',async()=>{
  const h=setup(),a=journal('admin-A',1,'A'),b=journal('admin-A',2,'B'),c=journal('admin-A',3,'C');
  h.srv.mode='down';await h.api.put(h.key,a);h.srv.mode='ok';h.disk.removeFail=true;
  assert.equal(await h.api.put(h.key,b),b);assert.equal(h.disk.rows.get(h.key),b);
  h.disk.removeFail=false;await h.api.put(h.key,c);assert.equal(h.disk.rows.size,0);
});
test('owner switches cannot write, list, mark durable or load another owner',async()=>{
  const h=setup(),g=gate();h.srv.gates.push(g);const pending=h.api.put(h.key,journal('admin-A',1,'A'));await settle();
  h.state.owner='admin-B';g.resolve();await assert.rejects(pending,/owner-changed/);assert.deepEqual(h.durable,[]);
  assert.deepEqual(await h.api.list(prefix('admin-B')),[]);
  await assert.rejects(h.api.list(prefix('admin-A')),/invalid-backup-owner/);
  await assert.rejects(h.api.put(h.key,journal('admin-A',1,'A')),/invalid-backup-owner/);
  await assert.rejects(h.api.put(prefix('admin-B')+'t',journal('admin-A',1,'A')),/invalid-backup-owner/);
  const calls=h.srv.calls.length;h.state.owner=null;
  await assert.rejects(h.api.put(prefix('admin-B')+'t',journal('admin-B',1,'x')),/auth-required/);await assert.rejects(h.api.list(prefix('admin-B')),/auth-required/);assert.equal(h.srv.calls.length,calls);
  h.state.owner='admin-A';const g2=gate();h.srv.gates.push(g2);const listing=h.api.list(prefix('admin-A'));await settle();h.state.owner='admin-B';g2.resolve();
  await assert.rejects(listing,/owner-changed/);
});
test('an offline journal that was already acknowledged stays recoverable after the owner switches mid-save',async()=>{
  const h=setup(),g=gate();h.srv.mode='down';h.srv.gates.push(g);const p=h.api.put(h.key,journal('admin-A',1,'A'));await settle();
  h.state.owner='admin-B';g.resolve();await assert.rejects(p,/owner-changed/);assert.deepEqual(h.durable,[]);
  h.state.owner='admin-A';assert.equal((await h.api.list(prefix('admin-A'))).length,1);
});
test('list merges cloud and device rows, keeps the unsent device journal first and the cloud one once',async()=>{
  const h=setup(),k=prefix('admin-A'),c=journal('admin-A',5,'cloud'),l=journal('admin-A',6,'local');
  h.srv.rows.set(k+'cloud-only',c);h.disk.rows.set(k+'local-only',l);h.srv.rows.set(k+'same',c);h.disk.rows.set(k+'same',c);
  h.srv.rows.set(k+'both',c);h.disk.rows.set(k+'both',l);
  const rows=await h.api.list(k),by=Object.fromEntries(rows.map(r=>[r.key,r.text]));
  assert.equal(rows.length,4);assert.equal(by[k+'cloud-only'],c);assert.equal(by[k+'local-only'],l);assert.equal(by[k+'same'],c);
  const merged=JSON.parse(by[k+'both']);assert.equal(merged.local.students[0].memo,'local');assert.equal(merged.revision,6);
  assert.equal(merged.overflowPrevious.length,1);assert.equal(JSON.stringify(merged.overflowPrevious[0]),c);
  assert.deepEqual(await h.api.list(k),rows);
  // Re-listing a journal that already carries the cloud copy does not duplicate it.
  h.disk.rows.set(k+'both',by[k+'both']);assert.equal(JSON.parse((await h.api.list(k)).find(r=>r.key===k+'both').text).overflowPrevious.length,1);
  assert.equal(h.disk.rows.get(k+'local-only'),l);assert.equal(h.srv.rows.get(k+'cloud-only'),c);
});
test('a merged journal persisted by the controller supersedes the device copy it came from',async()=>{
  const h=setup(),k=prefix('admin-A'),key=k+'tab-1',c=journal('admin-A',5,'cloud'),l=journal('admin-A',6,'local');
  h.srv.rows.set(key,c);h.disk.rows.set(key,l);
  const merged=(await h.api.list(k))[0].text;assert.notEqual(merged,l);
  assert.equal(await h.api.put(key,merged),merged);assert.equal(h.disk.rows.size,0);assert.equal(h.srv.rows.get(key),merged);
  assert.deepEqual(await h.api.list(k),[{key,text:merged}]);assert.deepEqual(h.durable,[[key,merged,'cloud']]);
});
test('invalid or foreign rows are reported, never replaced by the device copy or hidden',async()=>{
  const k=prefix('admin-A'),good=journal('admin-A',1,'good');
  const cases=[
    [h=>h.srv.rows.set(k+'a',journal('admin-B',1,'foreign'))],
    [h=>h.srv.rows.set(k+'a','not json')],
    [h=>h.srv.rows.set(k+'a',JSON.stringify({version:2,namespace:ns,owner:'admin-A',revision:1,base:{},local:{x:1},recovery:[]}))],
    [h=>h.srv.rows.set(k+'a',journal('admin-A',-1,'bad revision'))],
    [h=>h.srv.rows.set(k+'a',JSON.stringify({version:1,namespace:ns,owner:'admin-A',revision:1,base:[],local:{},recovery:[]}))],
    [h=>{h.srv.fetch=async()=>Response.json({rows:[{key:prefix('admin-B')+'a',sha256:'a'.repeat(64),length:1,revision:1,pending:true,recoveryCount:0}],cursor:null});h.api=cloud.create({localStore:h.disk,owner:()=> 'admin-A',namespace:ns,fetch:h.srv.fetch,timeoutMs:40});}],
    [h=>h.srv.rows.set(k+'a',JSON.stringify({...JSON.parse(good),namespace:'other'}))],
  ];
  for(const [seed] of cases){const h=setup();h.disk.rows.set(k+'ok',good);seed(h);await assert.rejects(h.api.list(k));}
  const h=setup();h.srv.mode='down';h.disk.rows.set(k+'a',journal('admin-B',1,'foreign on device'));h.disk.rows.set(k+'ok',good);
  await assert.rejects(h.api.list(k),/invalid-backup-owner/);
  const bad=setup();bad.srv.rows.set(k+'a',good);bad.disk.listFail=true;await assert.rejects(bad.api.list(k),/idb/);
  const both=setup();both.srv.mode='down';both.disk.listFail=true;await assert.rejects(both.api.list(k));
});
test('only transport trouble (network, timeout, HTTP status) lists the device copy',async()=>{
  const k=prefix('admin-A'),text=journal('admin-A',1,'x');
  for(const mode of ['down','500','hang']){const h=setup();h.srv.mode=mode;h.disk.rows.set(k+'a',text);assert.deepEqual(await h.api.list(k),[{key:k+'a',text}],mode);}
  const h=setup();h.srv.rows.set(k+'c',text);assert.deepEqual(await h.api.list(k),[{key:k+'c',text}]);
});
test('a cloud answer that arrives but is malformed fails closed instead of listing the device copy',async()=>{
  const k=prefix('admin-A'),text=journal('admin-A',1,'x');
  for(const mode of ['html','noRows']){const h=setup();h.srv.mode=mode;h.disk.rows.set(k+'a',text);await assert.rejects(h.api.list(k),/cloud-backup-response/,mode);}
  const h=setup();h.disk.rows.set(k+'a',text);h.srv.fetch=async()=>Response.json({rows:[{key:k+'b',text:42}]});
  h.api=cloud.create({localStore:h.disk,owner:()=> 'admin-A',namespace:ns,fetch:h.srv.fetch,timeoutMs:40});await assert.rejects(h.api.list(k),/cloud-backup-response/);
});
test('an unreachable cloud with no device journal rejects instead of starting empty',async()=>{
  const k=prefix('admin-A');
  for(const mode of ['down','500','hang']){const h=setup();h.srv.mode=mode;await assert.rejects(h.api.list(k),/cloud-backup-unavailable/,mode);}
  const bare=cloud.create({owner:()=> 'admin-A',namespace:ns,fetch:async()=>{throw TypeError('off');},timeoutMs:20});
  await assert.rejects(bare.list(k),/cloud-backup-unavailable/);
});
test('the account is checked before device cleanup, so a switch after the cloud save deletes nothing',async()=>{
  const h=setup(),a=journal('admin-A',1,'A'),b=journal('admin-A',2,'B'),g=gate();
  h.srv.mode='down';await h.api.put(h.key,a);h.srv.mode='ok';h.srv.gates.push(g);
  const p=h.api.put(h.key,b);await settle();h.state.owner='admin-B';g.resolve();
  await assert.rejects(p,/owner-changed/);assert.deepEqual(h.disk.removes,[]);assert.equal(h.disk.rows.get(h.key),b);assert.equal(h.srv.rows.get(h.key),b);assert.deepEqual(h.durable,[[h.key,a,'device']]);
});
test('a listed device journal is deleted only when the saved text includes all of its pending data',async()=>{
  const k=prefix('admin-A'),key=k+'tab-1',cloudText=journal('admin-A',5,'cloud'),
    pending=journal('admin-A',6,'pending-edit',{recovery:[{students:[{id:'s1',memo:'alt'}]}]});
  const reload=()=>{const h=setup();h.srv.rows.set(key,cloudText);h.disk.rows.set(key,pending);return h;};
  // 1. A journal that lost the pending edit and recovery snapshot leaves the device copy in place.
  let h=reload();await h.api.list(k);const unrelated=journal('admin-A',7,'something else');
  await h.api.put(key,unrelated);assert.equal(h.disk.rows.get(key),pending);assert.equal(h.srv.rows.get(key),unrelated);
  // 2. Keeping the edit but not the recovery snapshot is still not enough.
  h=reload();await h.api.list(k);await h.api.put(key,journal('admin-A',7,'pending-edit'));assert.equal(h.disk.rows.get(key),pending);
  // 3. The merged journal and a successor that keeps every pending item are enough.
  h=reload();const merged=(await h.api.list(k))[0].text;await h.api.put(key,merged);assert.equal(h.disk.rows.size,0);
  h=reload();await h.api.list(k);
  const kept=journal('admin-A',7,'newer edit',{base:{students:[]},recovery:[{students:[{id:'s1',memo:'pending-edit'}]},{students:[{id:'s1',memo:'alt'}]}]});
  await h.api.put(key,kept);assert.equal(h.disk.rows.size,0);
  // 4. A listed journal carrying ACK metadata must be carried whole.
  h=reload();h.disk.rows.set(key,journal('admin-A',6,'pending-edit',{ack:{sent:{},value:{},revision:5}}));await h.api.list(k);
  await h.api.put(key,kept);assert.ok(h.disk.rows.has(key));
});
test('the default fetch is resolved when used, not when the module is created',async()=>{
  const original=globalThis.fetch,seen=[];
  const api=cloud.create({owner:()=> 'admin-A',namespace:ns,localStore:local(),timeoutMs:50});
  globalThis.fetch=async(url,init)=>{seen.push(url);return Response.json({key:JSON.parse(init.body).key,text:JSON.parse(init.body).text});};
  try{const text=journal('admin-A',1,'lazy');assert.equal(await api.put(prefix('admin-A')+'t',text),text);assert.deepEqual(seen,['/api/backups']);}
  finally{globalThis.fetch=original;}
});

function session(){
  const map=new Map(),s={map,sets:[],failSet:null,
    get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,
    setItem(k,v){if(s.failSet&&s.failSet(k,v))throw Error('QuotaExceededError');s.sets.push(k);map.set(k,v);},removeItem(k){map.delete(k);}};
  return s;
}
const jkey=prefix('admin-A').slice(0,-':backup:'.length);
const ikey='vsC_sync_instance_v1:'+encodeURIComponent(ns);

test('full journals stay in memory with exact readback when session quota fails; reclaimed keys are not durable',()=>{
  const s=session(),store=cloud.journalStore(s),big=journal('admin-A',1,'x'.repeat(2e6));
  s.failSet=(k,v)=>v.length>1000;
  assert.equal(store.setItem(jkey,big),false);assert.equal(store.getItem(jkey),big);assert.equal(s.map.get(jkey),'{"vsCloudJournalStale":1}','only a stale marker reaches the session');
  assert.equal(cloud.journalStore(s).getItem(jkey),null);assert.equal(cloud.journalStore(s).staleHead(jkey),true);
  store.setItem(ikey,'tab-1');assert.equal(s.getItem(ikey),'tab-1');assert.equal(cloud.journalStore(s).getItem(ikey),'tab-1');
  assert.equal(store.setItem('vsC_sync_v1:other:reclaimed:0',big),false);assert.equal(s.map.has('vsC_sync_v1:other:reclaimed:0'),false);
  assert.deepEqual([store.length,store.key(0),store.key(1)].slice(0,1),[3]);assert.equal(store.key(99),null);
});
test('markDurable writes a compact pointer only for the exact in-memory journal, and a reload reads it as empty',()=>{
  const s=session(),store=cloud.journalStore(s),first=journal('admin-A',1,'first'),second=journal('admin-A',2,'second');
  store.setItem(jkey,first);store.setItem(jkey,second);
  assert.equal(store.markDurable(jkey,first),false);assert.equal(s.getItem(jkey),second);
  assert.equal(store.markDurable(jkey,second),true);const pointer=s.getItem(jkey);
  assert.ok(pointer.length<200&&!pointer.includes('second'));assert.ok(cloud.isPointer(pointer));assert.equal(store.getItem(jkey),second);
  const reload=cloud.journalStore(s);assert.equal(reload.getItem(jkey),null);assert.equal(reload.length,0);
  assert.equal(reload.markDurable(jkey,second),false);
});
test('a session quota error on the pointer keeps the memory journal and reports not marked',()=>{
  const s=session(),store=cloud.journalStore(s),text=journal('admin-A',2,'kept');s.failSet=()=>true;
  store.setItem(jkey,text);assert.equal(store.markDurable(jkey,text),false);assert.equal(store.getItem(jkey),text);
});
test('a legacy full session journal is readable, and a newer journal that does not fit replaces it with a stale marker',()=>{
  const s=session(),legacy=journal('admin-A',1,'legacy');s.map.set(jkey,legacy);const store=cloud.journalStore(s);
  s.failSet=(k,v)=>!cloud.isPointer(v);
  assert.equal(store.getItem(jkey),legacy);
  store.removeItem(jkey);assert.equal(s.getItem(jkey),legacy,'removeItem never deletes a full journal');assert.equal(store.getItem(jkey),null);
  s.failSet=(k,v)=>!cloud.isPointer(v)&&v!=='{"vsCloudJournalStale":1}';
  const next=journal('admin-A',2,'next');assert.equal(store.setItem(jkey,next),false);
  // The newer journal was derived from the legacy one read at startup; a reload must not resume the older head.
  assert.equal(s.getItem(jkey),'{"vsCloudJournalStale":1}');assert.equal(store.getItem(jkey),next);assert.equal(cloud.journalStore(s).getItem(jkey),null);
  s.failSet=()=>true;assert.equal(store.markDurable(jkey,next),false);assert.equal(cloud.journalStore(s).staleHead(jkey),true);
  s.failSet=null;assert.equal(store.markDurable(jkey,next),true);assert.ok(cloud.isPointer(s.getItem(jkey)));
  store.removeItem(jkey);assert.equal(s.getItem(jkey),null);
});
test('the facade works when sessionStorage itself is unavailable',()=>{
  const broken={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');},get length(){throw Error('denied');},key(){throw Error('denied');}};
  const store=cloud.journalStore(broken),text=journal('admin-A',1,'x');
  store.setItem(jkey,text);store.setItem(ikey,'tab');assert.equal(store.getItem(jkey),text);assert.equal(store.getItem(ikey),'tab');assert.equal(store.markDurable(jkey,text),false);assert.equal(store.length,2);
});
test('storage wiring: a cloud save marks the exact memory journal and a newer memory journal is never pointed to',async()=>{
  const s=session(),store=cloud.journalStore(s),h=setup({onDurable:(k,t)=>{store.markDurable(k.replace(/:backup:[^:]+$/,''),t);}});
  const a=journal('admin-A',1,'A'),b=journal('admin-A',2,'B');
  store.setItem(jkey,a);const first=h.api.put(h.key,a);store.setItem(jkey,b);await first;
  assert.equal(s.getItem(jkey),b);assert.equal(store.getItem(jkey),b);
  await h.api.put(h.key,b);assert.ok(cloud.isPointer(s.getItem(jkey)));assert.equal(cloud.journalStore(s).getItem(jkey),null);
});

test('metadata listing paginates at 100, loads pending rows, and loads the clean current key only',async()=>{
  const h=setup(),p=prefix('admin-A'),clean=journal('admin-A',1,'clean'),pending=journal('admin-A',2,'pending',{recovery:[{students:[]}]});
  h.srv.pageSize=1;h.srv.rows.set(p+'clean',clean);h.srv.rows.set(p+'pending',pending);
  const rows=await h.api.list(p);
  assert.deepEqual(rows.map(row=>row.key),[p+'clean',p+'pending']);
  assert.equal(h.srv.calls.filter(call=>call.init.method==='GET').length,4);
  assert.ok(h.srv.calls.some(call=>call.url.includes('&metadata=1&cursor=1')));
  assert.ok(h.srv.calls.some(call=>call.url.includes('&key='+encodeURIComponent(p+'clean'))));
  assert.ok(h.srv.calls.some(call=>call.url.includes('&key='+encodeURIComponent(p+'pending'))));
});

test('a durable hint selects the exact cloud or device variant and preserves the other whole',async()=>{
  const s=session(),store=cloud.journalStore(s),h=setup({resumeHint:()=>({key:hKey,hint:store.readDurableHint(jkey)}),currentKey:()=>hKey}),
    hKey=prefix('admin-A')+'tab-1',committed=journal('admin-A',4,'committed'),newer=journal('admin-A',5,'newer');
  store.setItem(jkey,committed);assert.equal(store.markDurable(jkey,committed),true);
  h.srv.rows.set(hKey,newer);h.disk.rows.set(hKey,committed);
  const selected=JSON.parse((await h.api.list(prefix('admin-A')))[0].text);
  assert.equal(selected.revision,4);assert.equal(JSON.stringify(selected.overflowPrevious[0]),newer);
  const h2=setup({resumeHint:()=>({key:hKey,hint:store.readDurableHint(jkey)}),currentKey:()=>hKey});
  h2.srv.rows.set(hKey,newer);h2.disk.rows.set(hKey,journal('admin-A',6,'other'));
  await assert.rejects(h2.api.list(prefix('admin-A')),/backup-hint-mismatch/);
});

test('a hint requires its own key when cloud is unavailable and ignores another local row',async()=>{
  const s=session(),store=cloud.journalStore(s),key=prefix('admin-A')+'tab-1',other=prefix('admin-A')+'tab-2',text=journal('admin-A',1,'saved');
  store.setItem(jkey,text);assert.equal(store.markDurable(jkey,text),true);
  const h=setup({resumeHint:()=>({key,hint:store.readDurableHint(jkey)}),currentKey:()=>key});h.srv.mode='down';h.disk.rows.set(other,text);
  await assert.rejects(h.api.list(prefix('admin-A')),/backup-hint-missing/);
});

test('a pointer written by an earlier page instance in this tab is not required under the new instance key',async()=>{
  const s=session(),store=cloud.journalStore(s),earlier=prefix('admin-A')+'tab-1',current=prefix('admin-A')+'tab-2',text=journal('admin-A',1,'saved',{ack:{id:'x'}});
  store.setItem(jkey,text);assert.equal(store.markDurable(jkey,text,'tab-1'),true);assert.equal(JSON.parse(s.getItem(jkey)).instance,'tab-1');
  const h=setup({resumeHint:()=>({key:current,hint:store.readDurableHint(jkey)}),currentKey:()=>current});h.srv.rows.set(earlier,text);
  assert.deepEqual(await h.api.list(prefix('admin-A')),[{key:earlier,text}]);
  const down=setup({resumeHint:()=>({key:current,hint:store.readDurableHint(jkey)}),currentKey:()=>current});down.srv.mode='down';down.disk.rows.set(earlier,text);
  await assert.rejects(down.api.list(prefix('admin-A')),/backup-hint-missing/);
  const own=setup({resumeHint:()=>({key:earlier,hint:store.readDurableHint(jkey)}),currentKey:()=>earlier});own.srv.mode='down';own.disk.rows.set(current,text);
  await assert.rejects(own.api.list(prefix('admin-A')),/backup-hint-missing/);
});

test('an older instance-less pointer is attributed to another key only by an exact row in a verified cloud list',async()=>{
  const clean=memo=>journal('admin-A',104,memo,{base:{students:[{id:'s1',memo}]}});
  const s=session(),store=cloud.journalStore(s),earlier=prefix('admin-A')+'tab-1',current=prefix('admin-A')+'tab-2',
    text=clean('saved'),same=clean('SAVED');
  store.setItem(jkey,text);assert.equal(store.markDurable(jkey,text),true);assert.equal(JSON.parse(s.getItem(jkey)).instance,undefined);
  const hint=()=>({key:current,hint:store.readDurableHint(jkey)});
  const h=setup({resumeHint:hint,currentKey:()=>current});h.srv.rows.set(earlier,text);h.srv.rows.set(prefix('admin-A')+'tab-3',same);
  h.srv.rows.set(prefix('admin-A')+'tab-4',clean('shorter'));
  assert.deepEqual((await h.api.list(prefix('admin-A'))).map(row=>row.key).sort(),[earlier,prefix('admin-A')+'tab-3']);
  assert.ok(h.srv.calls.some(call=>call.url.includes('&key='+encodeURIComponent(earlier))));
  const unknown=setup({resumeHint:hint,currentKey:()=>current});unknown.srv.rows.set(earlier,same);
  await assert.rejects(unknown.api.list(prefix('admin-A')),/backup-hint-missing/);
});

test('session journal codec stores a checked compressed full value before a durable pointer',()=>{
  const s=session(),codec={encode:sync.encodeStorage,decode:sync.decodeStorage},store=cloud.journalStore(s,codec),text=journal('admin-A',1,'x'.repeat(200000));
  assert.equal(store.setItem(jkey,text),true);assert.notEqual(s.getItem(jkey),text);assert.equal(store.getItem(jkey),text);
  const reload=cloud.journalStore(s,codec);assert.equal(reload.getItem(jkey),text);
  assert.equal(store.markDurable(jkey,text),true);assert.ok(cloud.isPointer(s.getItem(jkey)));assert.equal(cloud.matchesHint(text,store.readDurableHint(jkey)),true);
});

test('local failure still attempts cloud and reports cloud, while local success reports device on cloud transport failure',async()=>{
  const localFail=local();localFail.putFail=true;const h=setup({local:localFail}),text=journal('admin-A',1,'cloud-after-local-failure');
  assert.equal(await h.api.put(h.key,text),text);assert.deepEqual(h.durable,[[h.key,text,'cloud']]);
  const d=setup(),deviceText=journal('admin-A',1,'device-after-cloud-failure');d.srv.mode='403';
  assert.equal(await d.api.put(d.key,deviceText),deviceText);assert.deepEqual(d.durable,[[d.key,deviceText,'device']]);
});

test('a newer journal that cannot reach the session retires the old hint instead of leaving it to resume',async()=>{
  const s=session(),store=cloud.journalStore(s),oldText=journal('admin-A',1,'old'),newText=journal('admin-A',2,'new'),key=prefix('admin-A')+'tab-1';
  store.setItem(jkey,oldText);assert.equal(store.markDurable(jkey,oldText),true);s.failSet=(k,v)=>v!=='{"vsCloudJournalStale":1}';
  assert.equal(store.setItem(jkey,newText),false);assert.equal(store.markDurable(jkey,newText),false);
  assert.equal(store.readDurableHint(jkey),null);assert.equal(cloud.journalStore(s).staleHead(jkey),true);
  // With the marker the controller keeps the older durable head as recovery only (see cloud-first-sync tests).
  const h=setup({resumeHint:()=>({key,hint:store.readDurableHint(jkey)}),currentKey:()=>key});h.srv.rows.set(key,oldText);h.disk.rows.set(key,oldText);
  assert.deepEqual((await h.api.list(prefix('admin-A'))).map(row=>row.text),[oldText]);
});
