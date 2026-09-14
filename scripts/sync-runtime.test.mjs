import test from 'node:test';
import assert from 'node:assert/strict';
import sync from '../vs-sync.js';
const copy=structuredClone;
const seed=()=>({students:[{id:'s1',name:'Synthetic A'},{id:'s2',name:'Synthetic B'}],logs:[],payments:[],consults:[],inquiries:[],weekOvr:{w1:{s1:{time:'10:00'}}},_vsSyncRevision:0,futureServerField:{keep:true}});
function storage(){const map=new Map();return {fail:false,getItem(key){return map.get(key)??null;},setItem(key,value){if(this.fail)throw Error('quota');map.set(key,value);},removeItem(key){map.delete(key);},key(i){return [...map.keys()][i]??null;},get length(){return map.size;}};}
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<6;i++)await tick();}
function world(){
  const w={data:seed(),version:0,listeners:new Set(),writes:0,attempts:0,failNext:0,backup:storage(),clients:0,missing:false};
  w.snapshot=(metadata={fromCache:false,hasPendingWrites:false})=>{const data=copy(w.data);return {exists:!w.missing,metadata,data:()=>copy(data)};};
  w.emit=(metadata)=>{for(const entry of w.listeners)entry.next(w.snapshot(metadata));};
  w.external=fn=>{fn(w.data);w.data._vsSyncRevision++;w.version++;w.emit();};
  w.db={collection:()=>({doc:()=>({
    onSnapshot(options,next,error){assert.equal(options.includeMetadataChanges,true);const entry={next,error};w.listeners.add(entry);return ()=>w.listeners.delete(entry);},
    get:async()=>w.snapshot()
  })}),async runTransaction(callback){
    if(w.failNext){w.failNext--;throw Error('injected-write-failure');}
    for(let i=0;i<5;i++){
      w.attempts++;const version=w.version;let write=null;
      const result=await callback({get:async()=>w.snapshot(),set(ref,data){write=copy(data);}});
      if(version!==w.version)continue;
      if(write){w.data=write;w.version++;w.writes++;w.emit();}
      if(w.ackGate){const wait=w.ackGate;w.ackGate=null;await wait.promise;}
      if(w.failAfterCommit){w.failAfterCommit=false;throw Error('unknown-outcome');}
      return result;
    }
    throw Error('exhausted-conflicts');
  }};
  w.client=(options={})=>{
    const c={ui:sync.normalize(options.ui||w.data),owner:'admin-A',editing:false,frozen:false,renders:0,store:options.store||storage()};
    c.controller=sync.create({namespace:'demo/studio/data',instanceId:'client-'+(++w.clients),forkInstance:!!options.forkInstance,store:c.store,backupStore:w.backup,
      owner:()=>c.owner,database:()=>w.db,timestamp:()=> 'synthetic-timestamp',frozen:()=>c.frozen,editing:()=>c.editing,
      getData:()=>c.ui,setData:data=>{c.ui=data;},render:()=>{c.renders++;},status:(mode,detail)=>{c.mode=mode;c.detail=detail;},later:fn=>queueMicrotask(fn)});
    c.controller.connect();if(options.emit!==false)w.emit();return c;
  };
  return w;
}
test('cached and local-pending snapshots cannot confirm server state',()=>{
  const w=world(),c=w.client({emit:false});w.emit({fromCache:true,hasPendingWrites:false});assert.equal(c.controller.ready,false);
  w.emit({fromCache:false,hasPendingWrites:true});assert.equal(c.controller.ready,false);w.emit();assert.equal(c.controller.ready,true);
});
test('cold start retains divergent local records as recovery without uploading them',()=>{
  const w=world(),local=seed();local.students.push({id:'local-only',name:'Synthetic offline'});const c=w.client({ui:local});
  assert.equal(w.writes,0);assert.equal(c.controller.state.recovery.length,1);assert.equal(c.ui.students.length,2);
});
test('missing server document cannot be bootstrapped by a stale client',async()=>{
  const w=world();w.missing=true;const c=w.client();c.ui.logs.push({id:'l1',sid:'s1'});await c.controller.save();assert.equal(w.writes,0);assert.equal(c.controller.ready,false);
});
test('transaction preserves unknown server fields and uses server confirmation',async()=>{
  const w=world(),c=w.client();c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();await settle();
  assert.equal(w.data.weekOvr.w1.s1.time,'11:00');assert.deepEqual(w.data.futureServerField,{keep:true});assert.equal(c.controller.pending(),0);assert.equal(w.data._vsSyncRevision,1);
});
test('same payload can retry after a rejected write; intent survives rejection',async()=>{
  const w=world(),c=w.client();w.failNext=1;c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();assert.equal(c.controller.pending(),1);
  await c.controller.retry();await settle();assert.equal(w.data.weekOvr.w1.s1.time,'11:00');assert.equal(c.controller.pending(),0);
});
test('two clients converge independent edits through transaction retry',async()=>{
  const w=world(),a=w.client(),b=w.client();a.ui.students[0].name='A edit';b.ui.students[1].name='B edit';
  await Promise.all([a.controller.save(),b.controller.save()]);await settle();
  assert.equal(w.data.students[0].name,'A edit');assert.equal(w.data.students[1].name,'B edit');assert.ok(w.attempts>=3);
});
test('same-item concurrent edits retain the losing local intent as a conflict',async()=>{
  const w=world(),a=w.client(),b=w.client();a.ui.weekOvr.w1.s1.time='11:00';b.ui.weekOvr.w1.s1.time='12:00';
  await Promise.all([a.controller.save(),b.controller.save()]);await settle();
  assert.equal(w.writes,1);assert.ok(a.controller.pending()+b.controller.pending()>=1);assert.ok([a.mode,b.mode].includes('conflict'));
});
test('edit while write is in flight survives snapshot-before-ACK and drains once',async()=>{
  const w=world(),c=w.client(),wait=gate();w.ackGate=wait;c.ui.weekOvr.w1.s1.time='11:00';const first=c.controller.save();await tick();
  c.ui.weekOvr.w1.s1.time='12:00';await c.controller.save();wait.resolve();await first;await settle();
  assert.equal(w.data.weekOvr.w1.s1.time,'12:00');assert.equal(c.ui.weekOvr.w1.s1.time,'12:00');assert.equal(c.controller.pending(),0);assert.equal(w.writes,2);
});
test('an ACK deferred by an open form is durable across reload',async()=>{
  const w=world(),c=w.client(),wait=gate();w.ackGate=wait;c.ui.weekOvr.w1.s1.time='11:00';const first=c.controller.save();await tick();
  c.editing=true;c.ui.weekOvr.w1.s1.time='12:00';await c.controller.save();wait.resolve();await first;
  assert.ok(c.controller.state.ack);assert.equal(c.ui.weekOvr.w1.s1.time,'12:00');
  const savedApplication=copy(c.ui);c.controller.disconnect();const reloaded=w.client({store:c.store,ui:savedApplication});await settle();
  assert.equal(reloaded.ui.weekOvr.w1.s1.time,'12:00');assert.equal(w.data.weekOvr.w1.s1.time,'12:00');
});
test('late ACK after account change cannot replace the new session state',async()=>{
  const w=world(),c=w.client(),wait=gate();w.ackGate=wait;c.ui.weekOvr.w1.s1.time='11:00';const first=c.controller.save();await tick();
  c.owner='admin-B';c.controller.connect();w.emit();const after=copy(c.controller.state);wait.resolve();await first;await settle();assert.deepEqual(c.controller.state,after);
});
test('offline pending intent survives reload and reconnect',async()=>{
  const w=world(),c=w.client();w.failNext=1;c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();const savedApplication=copy(c.ui);c.controller.disconnect();
  const next=w.client({store:c.store,ui:savedApplication});await settle();assert.equal(w.data.weekOvr.w1.s1.time,'11:00');assert.equal(next.controller.pending(),0);
});
test('storage failure holds local edits through repeated remote notifications',async()=>{
  const w=world(),c=w.client();c.store.fail=true;c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();w.emit();
  c.store.fail=false;w.external(data=>data.students[1].name='Remote edit');assert.equal(c.ui.weekOvr.w1.s1.time,'11:00');assert.equal(w.writes,0);
});
test('explicit retry recovers a freed journal without losing the blocked edit',async()=>{
  const w=world(),c=w.client();c.store.fail=true;c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();c.store.fail=false;
  await c.controller.retry();await settle();assert.equal(w.data.weekOvr.w1.s1.time,'11:00');
});
test('freeze retains local intent but never submits a transaction',async()=>{
  const w=world(),c=w.client();c.frozen=true;c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();assert.equal(w.writes,0);assert.equal(c.controller.pending(),1);assert.equal(c.mode,'frozen');
});
test('form input is not refreshed by remote updates until the form closes',async()=>{
  const w=world(),c=w.client(),renders=c.renders;c.editing=true;w.external(data=>data.weekOvr.w1.s1.time='11:00');
  assert.equal(c.ui.weekOvr.w1.s1.time,'10:00');assert.equal(c.renders,renders);c.editing=false;c.controller.drain();assert.equal(c.ui.weekOvr.w1.s1.time,'11:00');
});
test('unchanged server echo does not rerender the app',()=>{
  const w=world(),c=w.client(),renders=c.renders;w.emit();w.emit();assert.equal(c.renders,renders);
});
test('same-owner tabs retain separate session journals and persistent backups',async()=>{
  const w=world(),a=w.client(),b=w.client();a.frozen=b.frozen=true;a.ui.weekOvr.w1.s1.time='11:00';b.ui.weekOvr.w1.s1.time='12:00';
  await Promise.all([a.controller.save(),b.controller.save()]);assert.notEqual(a.store.getItem(a.controller.key),b.store.getItem(b.controller.key));assert.equal(w.backup.length,2);
});
test('unauthenticated local edits remain recoverable when an existing owner journal resumes',async()=>{
  const w=world(),c=w.client();c.controller.disconnect();c.owner=null;c.ui.logs.push({id:'anonymous-draft',sid:'s1'});await c.controller.save();
  c.owner='admin-A';c.controller.connect();w.emit();
  assert.ok(c.controller.state.recovery.some(data=>data.logs.some(row=>row.id==='anonymous-draft')));assert.equal(w.data.logs.length,0);
});
test('large media is excluded from journals and writes while later schedules still sync',async()=>{
  const w=world(),c=w.client();
  c.ui.students[0].audios=[{id:'audio-a',data:'data:audio/wav;base64,'+'A'.repeat(1200000),_mediaKey:'local-audio'}];
  c.ui.students[0].videos=[{id:'video-a',data:'data:video/mp4;base64,'+'B'.repeat(1200000),_mediaKey:'local-video'}];
  c.ui.students[0].photo='data:image/jpeg;base64,'+'C'.repeat(6000);c.ui.students[0]._photoKey='local-photo';
  await c.controller.save();await settle();c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();await settle();
  assert.ok(JSON.stringify(w.data).length<10000);assert.ok(c.store.getItem(c.controller.key).length<20000);
  assert.equal(w.data.students[0].audios[0].data,'[saved]');assert.equal(w.data.students[0].videos[0].data,'[saved]');
  assert.equal(w.data.weekOvr.w1.s1.time,'11:00');assert.equal(c.controller.pending(),0);
});
test('failed journal write followed by reload retains newer app data before restore',async()=>{
  const w=world(),c=w.client();c.store.fail=true;c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();
  const newer=copy(c.ui);c.controller.disconnect();c.store.fail=false;const reloaded=w.client({store:c.store,ui:newer});
  assert.ok(reloaded.controller.state.recovery.some(data=>data.weekOvr.w1.s1.time==='11:00'));
  assert.equal(w.writes,0);
});
test('reloading unchanged data keeps backup space bounded and permits saving',async()=>{
  const w=world();let c=w.client();const store=c.store;
  for(let i=0;i<20;i++){const ui=copy(c.ui);c.controller.disconnect();c=w.client({store,ui});}
  assert.equal(w.backup.length,1);c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();await settle();
  assert.equal(w.data.weekOvr.w1.s1.time,'11:00');assert.equal(w.backup.length,1);
});
test('a new tab cloned from session storage forks its backup identity',async()=>{
  const w=world(),a=w.client(),cloned=storage();
  for(let i=0;i<a.store.length;i++){const key=a.store.key(i);cloned.setItem(key,a.store.getItem(key));}
  const b=w.client({store:cloned,ui:copy(a.ui),forkInstance:true});assert.notEqual(a.controller.instance,b.controller.instance);
  a.frozen=b.frozen=true;a.ui.weekOvr.w1.s1.time='11:00';b.ui.weekOvr.w1.s1.time='12:00';
  await Promise.all([a.controller.save(),b.controller.save()]);assert.equal(w.backup.length,2);
  assert.notEqual(w.backup.getItem(a.controller.key+':backup:'+a.controller.instance),w.backup.getItem(b.controller.key+':backup:'+b.controller.instance));
});
test('bounded backup capacity remains writable after twenty reloads',async()=>{
  const w=world(),write=w.backup.setItem.bind(w.backup);
  w.backup.setItem=(key,value)=>{let size=value.length;for(let i=0;i<w.backup.length;i++){const other=w.backup.key(i);if(other!==key)size+=w.backup.getItem(other).length;}if(size>4000)throw Error('bounded-backup-quota');write(key,value);};
  let c=w.client();const store=c.store;
  for(let i=0;i<20;i++){const ui=copy(c.ui);c.controller.disconnect();c=w.client({store,ui});assert.equal(c.controller.blocked,false);}
  c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();await settle();assert.equal(w.data.weekOvr.w1.s1.time,'11:00');assert.equal(c.controller.pending(),0);
});
test('undo-to-baseline after a failed journal write is recovered without uploading the cancelled edit',async()=>{
  const w=world(),c=w.client();w.failNext=1;c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();
  c.store.fail=true;c.ui.weekOvr.w1.s1.time='10:00';await c.controller.save();const latest=copy(c.ui);
  c.controller.disconnect();c.store.fail=false;const resumed=w.client({store:c.store,ui:latest});await settle();
  assert.ok(resumed.controller.state.recovery.some(data=>data.weekOvr.w1.s1.time==='10:00'));
  assert.equal(resumed.ui.weekOvr.w1.s1.time,'10:00');assert.equal(w.data.weekOvr.w1.s1.time,'10:00');assert.equal(w.writes,0);assert.equal(resumed.mode,'conflict');
  await resumed.controller.retry();await settle();assert.equal(w.writes,0);
  assert.equal(resumed.controller.useServer(),true);assert.equal(resumed.ui.weekOvr.w1.s1.time,'10:00');assert.equal(resumed.controller.pending(),0);
});
