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
    if(options.requireBackup)c.ui.students[0].name+=' retained local recovery';
    c.controller=sync.create({namespace:'demo/studio/data',instanceId:'client-'+(++w.clients),forkInstance:!!options.forkInstance,store:c.store,backupStore:w.backup,reclaim:options.reclaim,
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

test('two clients converge distinct fields of the same student through transaction retry',async()=>{
  const w=world(),a=w.client(),b=w.client();a.ui.students[0].name='PC name';b.ui.students[0].memo='Mobile note';
  await Promise.all([a.controller.save(),b.controller.save()]);await settle();
  assert.equal(w.data.students[0].name,'PC name');assert.equal(w.data.students[0].memo,'Mobile note');
  for(const c of [a,b]){assert.equal(c.controller.pending(),0);assert.equal(c.controller.blocked,false);assert.deepEqual(c.ui.students,w.data.students);}
});

test('two clients converge different unique days within the same student week',async()=>{
  const w=world();w.data.weekOvr.w1.s1=[{day:'화',time:'10:00'},{day:'목',time:'11:00'}];
  const a=w.client(),b=w.client();a.ui.weekOvr.w1.s1[0].time='12:00';b.ui.weekOvr.w1.s1[1].time='13:00';
  await Promise.all([a.controller.save(),b.controller.save()]);await settle();
  for(const c of [a,b]){assert.equal(c.controller.pending(),0);assert.equal(c.controller.blocked,false);assert.deepEqual(c.ui.weekOvr.w1.s1,[{day:'화',time:'12:00'},{day:'목',time:'13:00'}]);}
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
  assert.equal(w.backup.length,0);c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();await settle();
  assert.equal(w.data.weekOvr.w1.s1.time,'11:00');assert.equal(w.backup.length,1);
  assert.deepEqual(JSON.parse(c.store.getItem(c.controller.key)),c.controller.state);
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

test('offline retry retains exactly one cancellable subscription',async()=>{
  const w=world(),c=w.client();assert.equal(w.listeners.size,1);
  const disconnected=[...w.listeners][0];disconnected.error(Error('offline'));
  assert.equal(w.listeners.size,1,'polling subscription remains available to recover');
  await c.controller.retry();await settle();assert.equal(w.listeners.size,1);
  c.controller.disconnect();assert.equal(w.listeners.size,0);
});
test('missing or invalid state revokes the ready indicator without removing customer data',async()=>{
  const w=world(),c=w.client(),saved=copy(c.ui);assert.equal(c.controller.ready,true);
  w.missing=true;await c.controller.retry();assert.equal(c.controller.ready,false);assert.deepEqual(c.ui,saved);
  w.missing=false;w.emit();assert.equal(c.controller.ready,true);
  for(const listener of w.listeners)listener.next({exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>({students:'corrupted'})});
  assert.equal(c.controller.ready,false);assert.deepEqual(c.ui,saved);
});
test('pending schedule registered offline converges without resurrecting an unrelated server deletion',async()=>{
  const w=world(),mobile=w.client(),desktop=w.client();mobile.frozen=true;
  mobile.ui.students.push({id:'mobile-new',name:'Synthetic mobile registration'});
  mobile.ui.weekOvr.w1['mobile-new']=[{day:'목',time:'14:00',absent:false}];await mobile.controller.save();
  delete desktop.ui.weekOvr.w1.s1;await desktop.controller.save();await settle();mobile.frozen=false;
  await mobile.controller.retry();await settle();
  assert.equal(w.data.students.filter(s=>s.id==='mobile-new').length,1);
  assert.ok(!Object.hasOwn(w.data.weekOvr.w1,'s1'));
  assert.deepEqual(sync.normalize(mobile.ui),sync.normalize(desktop.ui));
});

const backupPrefix='vsC_sync_v1:'+encodeURIComponent('demo/studio/data:admin-A')+':backup:';
function boundBackup(w,limit){
  const write=w.backup.setItem.bind(w.backup);
  w.backup.setItem=(key,value)=>{let size=value.length;for(let i=0;i<w.backup.length;i++){const other=w.backup.key(i);if(other!==key)size+=w.backup.getItem(other).length;}if(size>limit)throw Error('bounded-backup-quota');write(key,value);};
  return write;
}
function journal(base,local,recovery=[],extra={}){return {version:1,namespace:'demo/studio/data',owner:'admin-A',revision:0,base,local,recovery,...extra};}
function oldContainedBackups(w,extra={}){
  w.data._vsSyncRevision=25;
  const old=sync.normalize(w.data);old.students[1].name='Earlier confirmed name';
  const recovery=copy(old);recovery.consults.push({id:'old-recovery',name:'Synthetic retained consultation'});
  const small=JSON.stringify(journal(old,old,[],{revision:9,...extra}));
  const anchor=JSON.stringify(journal(old,old,[recovery],{revision:9,...extra}));
  return {small,anchor};
}
test('quota preserves every foreign contained backup and blocks when no own copy fits',()=>{
  const w=world(),{small,anchor}=oldContainedBackups(w),write=boundBackup(w,small.length+anchor.length+100);
  write(backupPrefix+'small',small);write(backupPrefix+'anchor',anchor);
  const c=w.client({requireBackup:true});
  assert.equal(c.mode,'storage-error');assert.equal(c.controller.blocked,true);assert.equal(w.writes,0);
  assert.equal(w.backup.getItem(backupPrefix+'small'),small);
  assert.equal(w.backup.getItem(backupPrefix+'anchor'),anchor);
  assert.ok(c.store.getItem(c.controller.key));
});
test('containment never merges different metadata, owners, namespaces, revisions, ack or unsynced intent',()=>{
  for(const change of [
    s=>s.owner='another-owner',s=>s.namespace='another-namespace',s=>s.revision++,
    s=>s.unknownMetadata={keep:true},s=>s.resumeConflict=true,
    s=>Object.defineProperty(s,'__proto__',{value:{unique:true},enumerable:true}),
    s=>s.recovery.push({...copy(s.base),inquiries:[{id:'unique'}]}),
    s=>s.local.students[0].name='Unsent change',s=>s.ack={revision:9,data:s.base}
  ]){
    const w=world(),pair=oldContainedBackups(w),small=JSON.parse(pair.small);change(small);
    const raw=JSON.stringify(small),write=boundBackup(w,raw.length+pair.anchor.length+10);
    write(backupPrefix+'small',raw);write(backupPrefix+'anchor',pair.anchor);
    const c=w.client({requireBackup:true});assert.equal(c.mode,'storage-error');assert.equal(w.writes,0);
    assert.equal(w.backup.getItem(backupPrefix+'small'),raw);assert.equal(w.backup.getItem(backupPrefix+'anchor'),pair.anchor);
  }
});
test('even matching pending or acknowledged old journals are preserved',()=>{
  for(const pending of [true,false]){
    const w=world(),pair=oldContainedBackups(w),small=JSON.parse(pair.small),anchor=JSON.parse(pair.anchor);
    for(const j of [small,anchor]){if(pending)j.local.students[0].name='Unsent';else j.ack={revision:9,data:j.base};}
    const a=JSON.stringify(small),b=JSON.stringify(anchor),write=boundBackup(w,a.length+b.length+10);
    write(backupPrefix+'small',a);write(backupPrefix+'anchor',b);
    const c=w.client({requireBackup:true});assert.equal(c.mode,'storage-error');assert.equal(w.backup.getItem(backupPrefix+'small'),a);assert.equal(w.backup.getItem(backupPrefix+'anchor'),b);
  }
});
test('equivalent foreign copies all remain intact under quota',()=>{
  const w=world(),{anchor}=oldContainedBackups(w),write=boundBackup(w,anchor.length*3+10);
  for(const key of ['one','two','three'])write(backupPrefix+key,anchor);
  const c=w.client({requireBackup:true});assert.equal(c.mode,'storage-error');
  for(const key of ['one','two','three'])assert.equal(w.backup.getItem(backupPrefix+key),anchor);
  assert.equal(w.writes,0);
});
test('a peer update during a quota write survives every retry',()=>{
  const w=world(),{small,anchor}=oldContainedBackups(w);
  const write=w.backup.setItem.bind(w.backup);
  write(backupPrefix+'small',small);write(backupPrefix+'anchor',anchor);
  const updated=JSON.stringify({...JSON.parse(small),unknownMetadata:'new peer intent'});
  let attempts=0,removals=0;
  w.backup.setItem=(key,value)=>{if(key===backupPrefix+'client-1'){attempts++;write(backupPrefix+'small',updated);throw Error('quota');}write(key,value);};
  w.backup.removeItem=()=>{removals++;};
  const c=w.client({requireBackup:true});assert.ok(attempts>0);assert.equal(c.mode,'storage-error');assert.equal(w.writes,0);
  assert.equal(removals,0);assert.equal(w.backup.getItem(backupPrefix+'small'),updated);
  assert.equal(w.backup.getItem(backupPrefix+'anchor'),anchor);
});
test('failed write leaves contained foreign backups untouched',()=>{
  const w=world(),{small,anchor}=oldContainedBackups(w),write=boundBackup(w,small.length+anchor.length+10);
  write(backupPrefix+'small',small);write(backupPrefix+'anchor',anchor);
  const ui=copy(w.data);ui.inquiries.push({id:'large-draft',note:'x'.repeat(small.length*3)});
  const c=w.client({ui});assert.equal(c.mode,'storage-error');assert.equal(w.writes,0);
  assert.equal(w.backup.getItem(backupPrefix+'small'),small);assert.equal(w.backup.getItem(backupPrefix+'anchor'),anchor);
});
test('legacy session rescue copies remain exportable after reload',()=>{
  const w=world(),c=w.client(),legacy=JSON.stringify({retained:'legacy exact recovery'});
  c.store.setItem(c.controller.key+':reclaimed:0',legacy);
  assert.deepEqual(c.controller.exportData().reclaimedBackups,[JSON.parse(legacy)]);
  c.controller.disconnect();const resumed=w.client({store:c.store,ui:copy(c.ui)});
  assert.deepEqual(resumed.controller.exportData().reclaimedBackups,[JSON.parse(legacy)]);
});
test('full rescue journal refuses containment removal and keeps both original backups',()=>{
  const w=world(),{small,anchor}=oldContainedBackups(w),write=boundBackup(w,small.length+anchor.length+100);
  write(backupPrefix+'small',small);write(backupPrefix+'anchor',anchor);
  const session=storage(),save=session.setItem.bind(session);
  session.setItem=(key,value)=>{if(key.includes(':reclaimed:'))throw Error('rescue-quota');save(key,value);};
  const c=w.client({store:session,requireBackup:true});assert.equal(c.mode,'storage-error');assert.equal(w.writes,0);
  assert.equal(w.backup.getItem(backupPrefix+'small'),small);assert.equal(w.backup.getItem(backupPrefix+'anchor'),anchor);
});
test('rescue journals never overwrite earlier distinct copies',()=>{
  const w=world(),c=w.client(),a=JSON.stringify({old:'first'}),b=JSON.stringify({old:'second'});
  assert.equal(c.controller.preserveReclaimedBackup(a),true);
  assert.equal(c.controller.preserveReclaimedBackup(b),true);
  assert.equal(c.controller.preserveReclaimedBackup(a),true);
  assert.deepEqual(c.controller.exportData().reclaimedBackups,[JSON.parse(a),JSON.parse(b)]);
});
test('server view retains unique local recovery without duplicating the selected server base',()=>{
  const w=world(),c=w.client(),remote=copy(c.controller.state.base),local=copy(remote);
  local.students.splice(0,1);local.weekOvr.w1.s1.time='09:00';
  c.controller.state={...c.controller.state,local,recovery:[copy(remote)],resumeConflict:true};
  c.controller.blocked=true;
  const compactSize=JSON.stringify(journal(remote,remote,[local])).length;
  boundBackup(w,compactSize+10);
  assert.equal(c.controller.useServer(),true);
  assert.equal(c.controller.pending(),0);assert.equal(w.writes,0);
  assert.deepEqual(c.controller.state.recovery,[local]);
  assert.deepEqual(c.controller.state.base,remote);assert.deepEqual(c.controller.state.local,remote);
});
test('failed server-view persistence leaves all earlier recovery and pending changes intact',()=>{
  const w=world(),c=w.client(),remote=copy(c.controller.state.base),local=copy(remote);
  local.students.splice(0,1);
  c.controller.state={...c.controller.state,local,recovery:[copy(remote)],resumeConflict:true};
  const before=copy(c.controller.state);c.store.fail=true;
  assert.equal(c.controller.useServer(),false);assert.equal(w.writes,0);
  assert.deepEqual(c.controller.state,before);
});
test('server view does not report recovery success when applying its local data fails',()=>{
  const w=world(),c=w.client();c.controller.a.setData=()=>{throw Error('local-data-quota');};
  assert.equal(c.controller.useServer(),false);assert.equal(c.mode,'apply-error');
  assert.equal(c.controller.blocked,true);assert.equal(w.writes,0);
});
test('a full backup store preserves foreign confirmed copies even if a tab appears closed',async()=>{
  const w=world(),confirmed=sync.normalize(w.data),older=copy(confirmed);older.students[1].name='Older server name';
  const same=JSON.stringify(journal(confirmed,confirmed)),superseded=JSON.stringify(journal(older,confirmed,[older],{resumeConflict:true}));
  const write=boundBackup(w,same.length+superseded.length+50);
  write(backupPrefix+'closed-same',same);write(backupPrefix+'closed-superseded',superseded);
  const c=w.client({requireBackup:true});assert.equal(c.controller.blocked,true);assert.equal(c.mode,'storage-error');
  assert.equal(w.backup.getItem(backupPrefix+'closed-same'),same);assert.equal(w.backup.getItem(backupPrefix+'closed-superseded'),superseded);
  c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();await settle();
  assert.equal(w.writes,0);assert.equal(c.ui.weekOvr.w1.s1.time,'11:00');
  assert.equal(c.controller.ready,false);assert.ok(c.store.getItem(c.controller.key));
});
test('a closed-tab backup with unsynced edits is never reclaimed and sync stops safely instead',async()=>{
  const w=world(),confirmed=sync.normalize(w.data),edited=copy(confirmed);edited.weekOvr.w1.s1.time='09:00';
  const pending=JSON.stringify(journal(confirmed,edited));
  const write=boundBackup(w,pending.length+50);write(backupPrefix+'closed-pending',pending);
  const c=w.client({requireBackup:true});
  assert.equal(w.backup.getItem(backupPrefix+'closed-pending'),pending);
  assert.equal(c.mode,'storage-error');assert.equal(c.controller.blocked,true);assert.equal(w.writes,0);
});
test('a closed-tab recovery copy that differs from confirmed data is kept',async()=>{
  const w=world(),confirmed=sync.normalize(w.data),offline=copy(confirmed);offline.students.push({id:'offline-row',name:'Offline only'});
  const kept=JSON.stringify(journal(confirmed,confirmed,[offline]));
  const write=boundBackup(w,kept.length+50);write(backupPrefix+'closed-recovery',kept);
  const c=w.client({requireBackup:true});
  assert.equal(w.backup.getItem(backupPrefix+'closed-recovery'),kept);assert.equal(c.mode,'storage-error');
});
test('adapter reclaim frees app cache space as a last resort and preserves unsynced backups',async()=>{
  const w=world(),confirmed=sync.normalize(w.data),edited=copy(confirmed);edited.weekOvr.w1.s1.time='09:00';
  const pending=JSON.stringify(journal(confirmed,edited)),cache='X'.repeat(2000);
  const write=boundBackup(w,pending.length+cache.length+JSON.stringify(journal(confirmed,confirmed)).length-500);
  write(backupPrefix+'closed-pending',pending);write('app-recovery-snapshot',cache);
  let calls=0;
  const c=w.client({requireBackup:true,reclaim:()=>{calls++;const had=w.backup.getItem('app-recovery-snapshot')!==null;w.backup.removeItem('app-recovery-snapshot');return had?1:0;}});
  assert.equal(calls,1);assert.equal(c.controller.blocked,false);assert.equal(c.mode,'recovery');
  assert.equal(w.backup.getItem(backupPrefix+'closed-pending'),pending);
});
test('when app-cache reclaim falls short, foreign backups remain untouched',async()=>{
  const w=world(),confirmed=sync.normalize(w.data),divergent=copy(w.data);divergent.students.push({id:'local-only',name:'Local only row'});
  const superseded=JSON.stringify(journal(confirmed,confirmed)),cache='X'.repeat(2000);
  const write=boundBackup(w,cache.length+superseded.length+10+20);
  write('app-cache',cache);write('tiny-cache','T'.repeat(10));write(backupPrefix+'closed-superseded',superseded);
  let calls=0;
  const c=w.client({ui:divergent,reclaim:()=>{calls++;const had=w.backup.getItem('tiny-cache')!==null;w.backup.removeItem('tiny-cache');return had?1:0;}});
  assert.equal(calls,1);assert.equal(c.mode,'storage-error');assert.equal(c.controller.blocked,true);assert.equal(w.writes,0);
  assert.equal(w.backup.getItem(backupPrefix+'closed-superseded'),superseded,'foreign backup remains when the write still fails');
  assert.equal(w.backup.getItem('app-cache'),cache);
});
test('a closed-tab recovery copy shared only with the current tab is still kept',async()=>{
  const w=world(),confirmed=sync.normalize(w.data),divergent=copy(w.data);divergent.students.push({id:'shared-local',name:'Shared local row'});
  const shared=JSON.stringify(journal(confirmed,confirmed,[sync.normalize(divergent)],{resumeConflict:true}));
  const write=boundBackup(w,shared.length+50);write(backupPrefix+'closed-shared',shared);
  const c=w.client({ui:divergent});
  assert.equal(w.backup.getItem(backupPrefix+'closed-shared'),shared);assert.equal(c.mode,'storage-error');
});
test('a byte-identical foreign backup is preserved when the current tab cannot fit',()=>{
  const w=world(),confirmed=sync.normalize(w.data),divergent=copy(w.data);divergent.students.push({id:'shared-local',name:'Shared local row'});
  const same=JSON.stringify(journal(confirmed,confirmed,[sync.normalize(divergent)]));
  const write=boundBackup(w,same.length+50);write(backupPrefix+'closed-same-recovery',same);
  const c=w.client({ui:divergent});
  assert.equal(w.backup.getItem(backupPrefix+'closed-same-recovery'),same);
  assert.equal(c.mode,'storage-error');assert.equal(w.writes,0);
  assert.equal(c.store.getItem(c.controller.key),same);
});
test('closed-tab backups with a newer revision or a saved ack are never reclaimed',async()=>{
  const w=world(),confirmed=sync.normalize(w.data);
  const newer=JSON.stringify(journal(confirmed,confirmed,[],{revision:5}));
  const acked=JSON.stringify(journal(confirmed,confirmed,[],{ack:{sent:confirmed,value:confirmed,revision:0}}));
  const write=boundBackup(w,newer.length+acked.length+50);write(backupPrefix+'closed-newer',newer);write(backupPrefix+'closed-acked',acked);
  const c=w.client({requireBackup:true});
  assert.equal(w.backup.getItem(backupPrefix+'closed-newer'),newer);assert.equal(w.backup.getItem(backupPrefix+'closed-acked'),acked);
  assert.equal(c.mode,'storage-error');assert.equal(w.writes,0);
});

function fullHistoricalStorage(){
  const w=world();
  w.data.students[0].notes='합성 🎵 / unicode \ud800 / '.repeat(6000);
  w.data._vsSyncRevision=26;
  const originals=[];
  for(const rev of [9,13,25]){
    const base=sync.normalize(w.data);base.students[0].name='Historical '+rev;
    const local=copy(base);local.logs.push({id:'retained-offline-'+rev,note:'Do not discard'});
    originals.push([backupPrefix+'historic-'+rev,JSON.stringify(journal(base,base,[local],{revision:rev,unknownMetadata:{keep:rev}}))]);
  }
  const size=originals.reduce((sum,p)=>sum+p[1].length,0);
  const current=JSON.stringify(journal(sync.normalize(w.data),sync.normalize(w.data),[],{revision:26}));
  const headroom=24000;
  assert.ok(current.length>headroom*5);
  const write=boundBackup(w,size+headroom);
  for(const [key,raw]of originals)write(key,raw);
  return {w,originals,headroom};
}

test('full durable history permits a fresh tab and reload by compressing only its own new backup',()=>{
  const {w,originals,headroom}=fullHistoricalStorage();
  const write=w.backup.setItem.bind(w.backup);let stored;
  w.backup.setItem=(key,value)=>{write(key,value);stored=value;};
  const c=w.client({requireBackup:true});
  assert.equal(c.mode,'recovery');assert.equal(c.controller.blocked,false);assert.equal(w.writes,0);
  const key=c.controller.key+':backup:'+c.controller.instance;
  assert.equal(JSON.parse(stored).encoding,'vs-lz-utf16-1');assert.ok(stored.length<headroom);
  assert.equal(w.backup.getItem(key),stored,'recovery requires durable storage');
  assert.deepEqual(JSON.parse(c.store.getItem(c.controller.key)),c.controller.state);
  for(const [key,raw]of originals)assert.equal(w.backup.getItem(key),raw,'distinct historical bytes remain untouched');
  c.controller.disconnect();
  const reloaded=w.client({store:c.store});
  assert.equal(reloaded.controller.ready,true);assert.equal(reloaded.controller.blocked,false);
  const second=w.client({forkInstance:true});
  assert.equal(second.controller.ready,true);assert.equal(second.controller.blocked,false);
  assert.deepEqual(second.ui,sync.normalize(w.data));
  for(const [key,raw]of originals)assert.equal(w.backup.getItem(key),raw);
  assert.equal(second.controller.exportData().backups.filter(b=>b.recovery?.length).length,4);
  assert.equal(w.writes,0);
});

test('compressed backup exports Unicode and unsent changes exactly through failed write and reload',async()=>{
  const {w,originals}=fullHistoricalStorage(),c=w.client();
  c.ui.inquiries.push({id:'offline-unicode',name:'한글 🎼 \ud800',note:'retained intent'});
  w.failNext=1;await c.controller.save();await settle();
  assert.equal(w.writes,0);assert.equal(c.controller.pending(),1);
  const saved=copy(c.controller.state),key=c.controller.key+':backup:'+c.controller.instance;
  assert.equal(JSON.parse(w.backup.getItem(key)).encoding,'vs-lz-utf16-1');
  assert.ok(c.controller.exportData().backups.some(b=>JSON.stringify(b)===JSON.stringify(saved)));
  c.controller.disconnect();
  const reloaded=w.client({store:c.store,ui:saved.local});
  assert.equal(reloaded.controller.pending(),1);assert.equal(reloaded.ui.inquiries.at(-1).name,'한글 🎼 \ud800');
  await reloaded.controller.retry();await settle();
  assert.equal(w.writes,1);assert.equal(reloaded.controller.pending(),0);
  assert.equal(w.data.inquiries.filter(q=>q.id==='offline-unicode').length,1);
  for(const [key,raw]of originals)assert.equal(w.backup.getItem(key),raw);
});

test('compressed durable readback corruption fails closed without sending or altering historical backups',()=>{
  const {w,originals}=fullHistoricalStorage(),originalSet=w.backup.setItem.bind(w.backup);
  w.backup.setItem=(key,value)=>{
    const parsed=JSON.parse(value);
    if(parsed.encoding==='vs-lz-utf16-1')value=JSON.stringify({...parsed,checksum:'corrupt'});
    originalSet(key,value);
  };
  const c=w.client({requireBackup:true});
  assert.equal(c.mode,'storage-error');assert.equal(c.controller.blocked,true);assert.equal(w.writes,0);
  assert.ok(c.controller.exportData().backups.some(b=>b.unreadable===true));
  for(const [key,raw]of originals)assert.equal(w.backup.getItem(key),raw);
});

function variedHistoricalStorage(){
  const w=world();let random=0x12345678;
  const bytes=Buffer.alloc(90000);
  for(let i=0;i<bytes.length;i++){random^=random<<13;random^=random>>>17;random^=random<<5;bytes[i]=random&255;}
  w.data.students[0].notes=bytes.toString('base64');w.data._vsSyncRevision=26;
  const originals=[];
  for(const rev of [9,13,25]){
    const base=sync.normalize(w.data),local=copy(base);local.students[0].name='Unsent '+rev;
    originals.push([backupPrefix+'varied-'+rev,JSON.stringify(journal(base,local,[local],{revision:rev}))]);
  }
  const size=originals.reduce((n,[,v])=>n+v.length,0),headroom=90000;
  const write=boundBackup(w,size+headroom);for(const [k,v]of originals)write(k,v);
  return {w,originals,headroom};
}

test('near-full varied history supports ordinary edit, ACK, new tab and reload without backup size doubling',async()=>{
  const {w,originals,headroom}=variedHistoricalStorage();
  const write=w.backup.setItem.bind(w.backup);let stored;
  w.backup.setItem=(key,value)=>{write(key,value);stored=value;};
  const c=w.client({requireBackup:true});
  assert.equal(c.controller.blocked,false);
  const key=c.controller.key+':backup:'+c.controller.instance,initial=stored.length;
  c.ui.students[0].name='Edited name 한글 🎵';w.failNext=1;
  await c.controller.save();await settle();
  assert.equal(c.controller.blocked,false,'ordinary edit must still fit durable quota');
  assert.equal(c.controller.pending(),1);assert.equal(w.writes,0);
  const edited=w.backup.getItem(key).length;
  assert.ok(edited<initial+5000,`small edit grew backup ${initial} -> ${edited}`);
  assert.ok(edited<headroom);
  assert.deepEqual(c.controller.exportData().backups.at(-1),c.controller.state);
  c.controller.disconnect();const reloaded=w.client({store:c.store,ui:c.ui});
  assert.equal(reloaded.controller.pending(),1);
  await reloaded.controller.retry();await settle();
  assert.equal(w.writes,1);assert.equal(reloaded.controller.pending(),0);
  assert.equal(reloaded.controller.blocked,false);assert.equal(w.data.students[0].name,'Edited name 한글 🎵');
  reloaded.controller.disconnect();
  const fresh=w.client({forkInstance:true});
  assert.equal(fresh.controller.ready,true);assert.equal(fresh.controller.blocked,false);
  assert.equal(fresh.ui.students[0].name,'Edited name 한글 🎵');
  fresh.ui.students[1].name='Fresh tab edit';await fresh.controller.save();await settle();
  assert.equal(fresh.controller.blocked,true);assert.equal(w.writes,1);
  assert.equal(JSON.parse(fresh.store.getItem(fresh.controller.key)).local.students[1].name,'Fresh tab edit');
  assert.ok(fresh.controller.exportData().backups.some(b=>b.local?.students[0]?.name==='Edited name 한글 🎵'));
  for(const [k,v]of originals)assert.equal(w.backup.getItem(k),v);
});

test('varied backup preserves differing recovery snapshots and deferred acknowledgement exactly',()=>{
  const {w,originals}=variedHistoricalStorage(),c=w.client(),next=copy(c.controller.state);
  next.local.students[0].name='Pending edit';
  next.local.inquiries.push({id:'pending-inquiry',name:'Distant field edit'});
  const recovery=copy(next.base);recovery.students[0].name='Recovery variant';next.recovery=[recovery];
  next.ack={sent:copy(next.local),value:copy(next.local),revision:27};
  Object.defineProperty(next,'__proto__',{value:{preserve:true},enumerable:true});
  assert.equal(c.controller.persist(next),true);
  assert.equal(JSON.stringify(c.controller.exportData().backups.at(-1)),JSON.stringify(next));
  for(const [k,v]of originals)assert.equal(w.backup.getItem(k),v);
  assert.equal(w.writes,0);
});

test('successful persistence never removes a peer key even when it appears byte-identical',()=>{
  const w=world(),c=w.client(),raw=JSON.stringify(c.controller.state),peer=backupPrefix+'peer';
  w.backup.setItem(peer,raw);
  const get=w.backup.getItem.bind(w.backup),write=w.backup.setItem.bind(w.backup),remove=w.backup.removeItem.bind(w.backup);
  const newer=JSON.parse(raw);newer.local.students[0].name='Newest peer offline edit';const updated=JSON.stringify(newer);
  let removals=0;
  w.backup.getItem=key=>{const result=get(key);if(key===peer)write(peer,updated);return result;};
  w.backup.removeItem=key=>{if(key===peer){removals++;write(peer,updated);}remove(key);};
  assert.equal(c.controller.persist(JSON.parse(raw)),true);
  assert.equal(removals,0);assert.ok([raw,updated].includes(get(peer)));
});

test('new clean allocation exception requires exact confirmed state and preserves every unique journal field',()=>{
  for(const change of [
    (n,c)=>n.local.students[0].name='pending',
    n=>n.recovery.push(copy(n.base)),
    n=>n.ack={sent:copy(n.local),value:copy(n.local),revision:n.revision},
    n=>n.resumeConflict=false,n=>n.unknownMetadata={keep:true},
    n=>Object.defineProperty(n,'__proto__',{value:{keep:true},enumerable:true}),
    n=>n.version=2,n=>n.owner='other',n=>n.namespace='other',
    (n,c)=>c.latest=null,(n,c)=>c.latest._vsSyncRevision++,
    (n,c)=>c.latest.students[0].name='different confirmed data'
  ]){
    const w=world(),c=w.client(),next=copy(c.controller.state);
    // base/local must not alias in a pending-intent case.
    next.local=copy(next.local);change(next,c.controller);
    const key=c.controller.key+':backup:'+c.controller.instance,raw=JSON.stringify(next);
    assert.equal(c.controller.persist(next),true);
    assert.equal(w.backup.getItem(key),raw);
    assert.equal(c.store.getItem(c.controller.key),raw);
  }
});

test('existing own backup cannot use the clean allocation exception',()=>{
  const w=world(),c=w.client(),next=copy(c.controller.state);
  w.backup.setItem(c.controller.key+':backup:'+c.controller.instance,JSON.stringify(next));
  w.backup.fail=true;
  assert.equal(c.controller.persist(next),false);assert.equal(c.controller.blocked,true);
  assert.equal(c.store.getItem(c.controller.key),JSON.stringify(next));
  assert.equal(w.writes,0);
});
