import test from 'node:test';
import assert from 'node:assert/strict';
import sync from '../vs-sync.js';
import cloud from '../vs-cloud-backup.js';
import {createHash} from 'node:crypto';

const copy=structuredClone,tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<16;i++)await tick();}
function storage(limit=Infinity){
  const map=new Map(),writes=[];
  return {map,writes,get length(){return map.size;},key:i=>[...map.keys()][i]??null,
    getItem:k=>map.get(k)??null,setItem(k,v){writes.push([k,v.length]);if(v.length>limit)throw Error('quota');map.set(k,v);},removeItem:k=>map.delete(k)};
}
function world(){
  const w={data:{students:[{id:'s1',name:'Synthetic',memo:'initial',photo:'/api/media/synthetic.jpg'}],logs:[],consults:[],payments:[],inquiries:[],weekOvr:{},_vsSyncRevision:0,futureRoot:{keep:true}},listeners:new Set(),cloud:new Map(),offline:new Map(),localWrites:0,canonicalWrites:0,cloudDown:false};
  w.backup=storage();w.backup.map.set('vsC_recovery_latest','synthetic retained snapshot');w.backup.map.set('vsC_sync_v1:foreign:backup:pending','synthetic unsent');w.backup.map.set('vsC_ph_retained','synthetic photo');
  w.snapshot=()=>({exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>copy(w.data)});
  w.emit=()=>{for(const next of w.listeners)next(w.snapshot());};
  w.db={collection:()=>({doc:()=>({onSnapshot(options,next){w.listeners.add(next);return ()=>w.listeners.delete(next);},get:async()=>w.snapshot()})}),async runTransaction(fn){
    let value;const result=await fn({get:async()=>w.snapshot(),set(ref,data){value=copy(data);}});
    if(value){w.data=value;w.canonicalWrites++;w.emit();}if(w.ackGate){const gate=w.ackGate;w.ackGate=null;await gate;}return result;
  }};
  w.fetch=async(url,init)=>{
    if(w.cloudDown)throw Error('offline');
    if(init.method==='POST'){const row=JSON.parse(init.body);w.cloud.set(row.key,row.text);return Response.json(row);}
    const params=new URL(url,'https://synthetic.invalid').searchParams,prefix=params.get('prefix');
    const rows=[...w.cloud].filter(([key])=>key.startsWith(prefix)&&(!params.has('key')||params.get('key')===key));
    if(params.get('metadata')==='1')return Response.json({rows:rows.map(([key,text])=>{const j=JSON.parse(text);return {key,sha256:createHash('sha256').update(text).digest('hex'),length:text.length,revision:j.revision,pending:!!j.ack||!!j.resumeConflict||!sync.equal(j.base,j.local),recoveryCount:j.recovery.length+(j.overflowPrevious?.length||0)};}),cursor:null});
    return Response.json({rows:rows.map(([key,text])=>({key,text}))});
  };
  w.local={async put(key,text){w.localWrites++;w.offline.set(key,text);return text;},async list(prefix){return [...w.offline].filter(([key])=>key.startsWith(prefix)).map(([key,text])=>({key,text}));},async remove(key,text){if(w.offline.get(key)!==text)return false;w.offline.delete(key);return true;}};
  w.client=async(session=storage(256),instance='synthetic-tab',fork=false)=>{
    const c={ui:sync.normalize({}),owner:'owner-A',session,store:cloud.journalStore(session,{encode:sync.encodeStorage,decode:sync.decodeStorage}),editing:false};
    c.controller=sync.create({namespace:'vocal-studio',instanceId:instance,forkInstance:fork,store:c.store,backupStore:w.backup,preferOverflow:true,cloudFirst:true,
      overflowStore:cloud.create({namespace:'vocal-studio',owner:()=>c.owner,localStore:w.local,fetch:w.fetch,
        currentKey:()=>c.controller?.key?c.controller.key+':backup:'+c.controller.instance:null,
        resumeHint:()=>c.controller?.key&&c.store.readDurableHint?{key:c.controller.key+':backup:'+c.controller.instance,hint:c.store.readDurableHint(c.controller.key)}:null,
        onDurable:(key,text)=>c.store.markDurable(key.replace(/:backup:[^:]+$/,''),text,key.replace(/^.*:backup:/,''))}),
      owner:()=>c.owner,database:()=>w.db,hydrated:()=>false,resumeData:()=>null,timestamp:()=> 'synthetic-time',frozen:()=>false,editing:()=>c.editing,
      getData:()=>c.ui,setData:data=>{c.ui=data;},render(){},status:mode=>{c.mode=mode;(c.modes||(c.modes=[])).push(mode);},later:fn=>queueMicrotask(fn)});
    await c.controller.connect();w.emit();await settle();return c;
  };
  return w;
}

test('cloud-first controller saves and reloads a large edit without any full Web Storage copies',async()=>{
  const w=world(),preserved=new Map(w.backup.map),c=await w.client();assert.equal(c.controller.ready,true);
  c.ui.students[0].memo='한글 😀 consultation '.repeat(16000);const expected=c.ui.students[0].memo;
  await c.controller.save();await settle();
  assert.equal(w.data.students[0].memo,expected);assert.equal(c.controller.pending(),0);
  assert.equal(w.offline.size,0);assert.equal(w.backup.writes.length,0);assert.deepEqual(w.backup.map,preserved);
  assert.ok(w.cloud.size>0);assert.ok([...c.session.map.values()].every(text=>text.length<=256));
  assert.equal(JSON.parse(c.session.getItem(c.controller.key)).vsCloudJournalPointer,1);
  c.controller.disconnect();const reloaded=await w.client(c.session);
  assert.equal(reloaded.controller.ready,true);assert.equal(reloaded.ui.students[0].memo,expected);
  assert.equal(w.data.futureRoot.keep,true);assert.equal(reloaded.ui.students[0].photo,'/api/media/synthetic.jpg');
});

test('reopening a different tab surfaces closed-tab pending intent as recovery without replaying it',async()=>{
  const w=world(),c=await w.client();w.cloudDown=true;c.editing=true;
  c.ui.students[0].memo='closed-tab offline intent';await c.controller.save();c.controller.disconnect();w.cloudDown=false;
  const reopened=await w.client(storage(256),'fresh-tab');
  assert.equal(reopened.ui.students[0].memo,'initial');assert.equal(w.data.students[0].memo,'initial');
  assert.equal(reopened.mode,'recovery');assert.ok(reopened.controller.otherRecovery.length);
  const exported=await reopened.controller.exportData();assert.ok(exported.backups.some(j=>j.local.students[0].memo==='closed-tab offline intent'));
});

test('a previously archived startup value does not get copied into every fresh tab journal',async()=>{
  const w=world(),c=await w.client();c.controller.disconnect();
  const reopened=await w.client(storage(256),'fresh-tab');
  assert.deepEqual(reopened.controller.state.recovery,[]);assert.equal(w.canonicalWrites,0);
});

test('offline intent is durable in IndexedDB fallback and is restored before any reload flush',async()=>{
  const w=world(),c=await w.client(),initial=w.data.students[0].memo;w.cloudDown=true;c.editing=true;
  c.ui.students[0].memo='offline pending';await c.controller.save();await settle();
  assert.equal(w.offline.size,1);assert.equal(w.data.students[0].memo,initial);assert.equal(w.backup.writes.length,0);
  c.controller.disconnect();const reloaded=await w.client(c.session);
  assert.equal(reloaded.ui.students[0].memo,'offline pending');await settle();
  assert.equal(w.data.students[0].memo,'offline pending');
  w.cloudDown=false;await reloaded.controller.retry();await settle();
  assert.equal(w.offline.size,0);assert.equal(w.data.students[0].memo,'offline pending');
});

test('an edit made while canonical acknowledgement is delayed survives cloud journaling and reload',async()=>{
  const w=world(),c=await w.client();let release;w.ackGate=new Promise(r=>{release=r;});
  c.ui.students[0].memo='first edit';const saving=c.controller.save();await settle();
  c.ui.students[0].memo='second edit';const later=c.controller.save();await settle();release();
  await saving;await later;await settle();assert.equal(w.data.students[0].memo,'second edit');
  c.controller.disconnect();const reloaded=await w.client(c.session);assert.equal(reloaded.ui.students[0].memo,'second edit');
});

test('an unavailable backup list opens the server copy under a fresh key and leaves the cloud journal untouched',async()=>{
  const w=world(),c=await w.client();c.ui.students[0].memo='before reload';await c.controller.save();await settle();
  const oldKey=c.controller.key+':backup:'+c.controller.instance,before=w.cloud.get(oldKey);assert.ok(before);
  c.controller.disconnect();await settle();w.cloudDown=true;const deviceList=w.local.list;w.local.list=async()=>{throw Error('synthetic IndexedDB unavailable');};
  const reloaded=await w.client(c.session);assert.equal(reloaded.controller.ready,true);assert.notEqual(reloaded.mode,'storage-error');
  assert.equal(reloaded.ui.students[0].memo,'before reload');assert.notEqual(reloaded.controller.instance,'synthetic-tab');
  assert.equal(reloaded.controller.backupsUnchecked,true);assert.equal(w.cloud.get(oldKey),before);assert.equal(w.backup.writes.length,0);
  w.cloudDown=false;w.local.list=deviceList;await reloaded.controller.retry();await settle();assert.equal(reloaded.controller.backupsUnchecked,false);
  assert.equal(w.cloud.get(oldKey),before,'a journal that could not be listed is never overwritten');
});

test('a pending edit is sent to the server even when every backup write fails',async()=>{
  const w=world(),c=await w.client();w.cloudDown=true;w.local.put=async()=>{throw Error('device storage full');};
  c.ui.students[0].memo='server first';await c.controller.save();await settle();
  assert.equal(w.data.students[0].memo,'server first');assert.equal(c.controller.pending(),0);assert.equal(c.controller.ready,true);
  assert.notEqual(c.mode,'storage-error');assert.equal(c.controller.backupFailed,true);
});

test('a stale resume pointer cannot replay an edit after its undo was committed while backups failed',async()=>{
  const w=world(),c=await w.client(),put=w.local.put;
  c.editing=true;c.ui.students[0].memo='A';await c.controller.save();await settle();
  assert.equal(w.data.students[0].memo,'initial','an open form holds the send');
  assert.equal(JSON.parse(c.session.getItem(c.controller.key)).vsCloudJournalPointer,1,'pointer names the pending A journal');
  w.cloudDown=true;w.local.put=async()=>{throw Error('device storage full');};
  c.editing=false;await c.controller.drain();await settle();assert.equal(w.data.students[0].memo,'A');
  c.ui.students[0].memo='initial';await c.controller.save();await settle();
  assert.equal(w.data.students[0].memo,'initial');assert.equal(c.controller.pending(),0);const writes=w.canonicalWrites;
  c.controller.disconnect();w.cloudDown=false;w.local.put=put;
  const reloaded=await w.client(c.session);await settle();
  assert.equal(w.data.students[0].memo,'initial','the acknowledged undo stays on the server');assert.equal(w.canonicalWrites,writes);
  assert.equal(reloaded.ui.students[0].memo,'initial');assert.equal(reloaded.controller.ready,true);
  assert.ok(reloaded.controller.hasRecovery(),'the older journal stays visible as recovery evidence');
});

test('startup reports the server check after backup storage is verified, not a storage wait',async()=>{
  const w=world(),c=await w.client();
  const pending=c.modes.indexOf('storage-pending'),server=c.modes.indexOf('checking-server'),done=c.modes.findIndex(m=>m==='synced'||m==='recovery');
  assert.ok(pending>=0&&server>pending&&done>server,JSON.stringify(c.modes));
});

test('a new page instance in the same tab starts after an earlier durable save instead of blocking storage',async()=>{
  const w=world(),c=await w.client();c.ui.students[0].memo='saved before navigation';await c.controller.save();await settle();
  assert.equal(w.data.students[0].memo,'saved before navigation');assert.equal(JSON.parse(c.session.getItem(c.controller.key)).instance,'synthetic-tab');
  c.controller.disconnect();
  const next=await w.client(c.session,'next-page',true);
  assert.equal(next.controller.instance,'next-page');assert.notEqual(next.mode,'storage-error');assert.equal(next.controller.ready,true);
  assert.equal(next.ui.students[0].memo,'saved before navigation');
  next.ui.students[0].memo='edited after navigation';await next.controller.save();await settle();
  assert.equal(w.data.students[0].memo,'edited after navigation');assert.equal(JSON.parse(next.session.getItem(next.controller.key)).instance,'next-page');
  next.controller.disconnect();const reloaded=await w.client(next.session,'unused-id');
  assert.equal(reloaded.controller.instance,'next-page');assert.equal(reloaded.controller.ready,true);
});
