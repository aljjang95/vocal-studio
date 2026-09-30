import test from 'node:test';
import assert from 'node:assert/strict';
import sync from '../vs-sync.js';

const copy=structuredClone, tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<30;i++)await tick();}
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function storage(){const map=new Map();return {map,get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem(k,v){map.set(k,v);}};}
const seed=()=>sync.normalize({students:[{id:'s1',name:'Synthetic',memo:'base',fee:100}],weekOvr:{w:{s1:{time:'10:00'}}}});
const namespace='overflow-test',owner='admin-A',prefix='vsC_sync_v1:'+encodeURIComponent(namespace+':'+owner);
function world(){
  const w={data:seed(),rev:40,writes:0,subscriptions:0,listeners:new Set(),backup:storage(),rows:new Map(),gates:[],puts:[],clients:0};
  w.originals=[16159,2777,10773,9129].map((size,i)=>[prefix+':backup:historic-'+i,JSON.stringify({retained:'Synthetic '+i+' '.repeat(size)})]);
  for(const [k,v]of w.originals)w.backup.setItem(k,v);
  w.backup.setItem('vsC_recovery_latest','Synthetic latest - retain');
  w.backup.setItem('vsC_s','Synthetic app cache - retain');
  w.backup.setItem=()=>{throw Error('quota');};
  w.overflow={async list(p){if(w.listGate)await w.listGate.promise;if(w.listFail)throw Error('unavailable');return [...w.rows].filter(([k])=>k.startsWith(p)).map(([key,text])=>({key,text}));},async put(key,text){w.puts.push({key,text});const g=w.gates.shift();if(g)await g.promise;if(w.putFail)throw Error('quota');w.rows.set(key,text);return w.mismatch?'corrupt':text;}};
  w.snapshot=()=>({exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:()=>({...copy(w.data),_vsSyncRevision:w.rev})});
  w.emit=()=>{for(const cb of w.listeners)cb(w.snapshot());};
  w.db={collection:()=>({doc:()=>({onSnapshot(opts,cb){w.subscriptions++;w.listeners.add(cb);queueMicrotask(()=>cb(w.snapshot()));return ()=>w.listeners.delete(cb);},get:async()=>w.snapshot()})}),async runTransaction(fn){
    for(let i=0;i<5;i++){const rev=w.rev;let write;const result=await fn({get:async()=>w.snapshot(),set(ref,data){write=copy(data);}});if(rev!==w.rev)continue;
      if(write){w.data=sync.normalize(write);w.rev=write._vsSyncRevision;w.writes++;w.emit();}
      if(w.ackGate){const g=w.ackGate;w.ackGate=null;await g.promise;}return result;
    }throw Error('exhausted');
  }};
  w.client=(options={})=>{
    const c={ui:copy(options.ui||w.data),owner:options.owner||owner,store:options.store||storage(),editing:false};
    const recovery=copy(w.data);recovery.students[0].name='Retained variant';recovery.students[0].memo='alternate';recovery.students[0].fee=200;
    if(!options.noJournal)c.store.setItem(prefix,JSON.stringify({version:1,namespace,owner,revision:40,base:copy(w.data),local:copy(c.ui),recovery:[recovery]}));
    c.controller=sync.create({namespace,store:c.store,backupStore:w.backup,overflowStore:w.overflow,instanceId:'tab-'+(++w.clients),forkInstance:!!options.forkInstance,
      owner:()=>c.owner,database:()=>w.db,timestamp:()=> 'synthetic',frozen:()=>!!c.frozen,editing:()=>c.editing,getData:()=>c.ui,setData:d=>{c.ui=d;},render(){},ready:r=>{c.ready=r;},status:m=>{c.mode=m;},later:queueMicrotask});
    c.connection=c.controller.connect();return c;
  };
  w.intact=()=>{for(const [k,v]of w.originals)assert.equal(w.backup.getItem(k),v);assert.equal(w.backup.getItem('vsC_recovery_latest'),'Synthetic latest - retain');assert.equal(w.backup.getItem('vsC_s'),'Synthetic app cache - retain');};
  return w;
}

test('full quota with a divergent recovery waits for durable commit before ready or server writes',async()=>{
  const w=world(),g=gate();w.gates.push(g);const c=w.client();await settle();
  assert.equal(c.mode,'storage-pending');assert.equal(c.ready,false);assert.equal(w.subscriptions,0);assert.equal(w.writes,0);
  g.resolve();await c.connection;await settle();
  assert.equal(c.ready,true);assert.equal(c.controller.blocked,false);assert.equal(c.controller.pending(),0);assert.equal(c.controller.state.recovery.length,1);
  assert.equal(c.controller.state.recovery[0].students[0].fee,200);assert.equal(w.writes,0);
  const exported=await c.controller.exportData();assert.ok(exported.backups.some(b=>b.recovery?.[0]?.students[0]?.name==='Retained variant'));w.intact();
});
test('a save during pending archive retains newest intent and sends only after its own durability',async()=>{
  const w=world(),c=w.client();await c.connection;await settle();const a=gate(),b=gate();w.gates.push(a,b);
  c.ui.students[0].memo='first';const first=c.controller.save();await settle();
  c.ui.students[0].memo='second';const second=c.controller.save();await settle();assert.equal(w.writes,0);
  a.resolve();await settle();assert.equal(w.writes,0);assert.equal(c.ui.students[0].memo,'second');assert.equal(c.ready,false);
  b.resolve();await Promise.all([first,second]);await settle();assert.equal(w.data.students[0].memo,'second');assert.equal(c.controller.pending(),0);assert.equal(c.controller.state.recovery.length,1);w.intact();
});
test('stale overflow completion cannot resume a disconnected account or export another owner',async()=>{
  const w=world(),g=gate();w.gates.push(g);const c=w.client();await settle();c.owner='admin-B';c.controller.disconnect();g.resolve();await c.connection;await settle();
  assert.equal(c.ready,false);assert.equal(c.controller.state,null);assert.equal(w.subscriptions,0);assert.equal(w.writes,0);
  assert.deepEqual((await c.controller.exportData()).backups,[]);w.intact();
});
test('committed own overflow survives missing session journal and a fork exports all owner backups',async()=>{
  const w=world(),c=w.client();await c.connection;await settle();c.frozen=true;c.ui.students[0].memo='unsent';await c.controller.save();await settle();
  c.controller.disconnect();c.store.map.delete(prefix);const reload=w.client({store:c.store,noJournal:true});await reload.connection;await settle();
  assert.equal(reload.controller.state.local.students[0].memo,'unsent');assert.equal(reload.controller.state.recovery[0].students[0].fee,200);
  const fork=w.client({noJournal:true,forkInstance:true});await fork.connection;await settle();assert.notEqual(fork.controller.instance,reload.controller.instance);
  assert.ok((await fork.controller.exportData()).backups.some(b=>b.local?.students[0]?.memo==='unsent'));w.intact();
});
test('overflow load/write failures fail closed and retry preserves recovery',async()=>{
  const w=world();w.listFail=true;const c=w.client();await c.connection;await settle();assert.equal(c.mode,'storage-error');assert.equal(w.subscriptions,0);
  w.listFail=false;w.putFail=true;await c.controller.retry();await settle();assert.equal(c.ready,false);assert.equal(w.writes,0);
  w.putFail=false;await c.controller.retry();await settle();assert.equal(c.ready,true);assert.equal(c.controller.state.recovery.length,1);w.intact();
});
test('load completes before connecting, and owner-mismatched stored payloads fail closed',async()=>{
  const w=world();w.listGate=gate();const c=w.client();await settle();assert.equal(w.subscriptions,0);assert.equal(c.ready,false);
  w.rows.set(prefix+':backup:bad',JSON.stringify({version:1,owner:'admin-B',namespace}));w.listGate.resolve();await c.connection;await settle();
  assert.equal(c.mode,'storage-error');assert.equal(w.subscriptions,0);assert.equal(w.writes,0);w.intact();
});
test('readback mismatch preserves staged edits/recovery and prohibits transaction until explicit retry',async()=>{
  const w=world(),c=w.client();await c.connection;await settle();w.mismatch=true;c.ui.students[0].memo='new intent';
  assert.equal(await c.controller.save(),false);assert.equal(c.ready,false);assert.equal(c.mode,'storage-error');assert.equal(w.writes,0);
  assert.equal(JSON.parse(c.store.getItem(prefix)).local.students[0].memo,'new intent');assert.equal(c.controller.state.recovery.length,1);
  w.mismatch=false;await c.controller.retry();await settle();assert.equal(w.data.students[0].memo,'new intent');assert.equal(c.controller.pending(),0);w.intact();
});
test('save during deferred ACK and its archive preserves both newer intent and recovery through reload',async()=>{
  const w=world(),c=w.client();await c.connection;await settle();const ack=gate();w.ackGate=ack;
  c.ui.students[0].memo='first';const first=c.controller.save();await settle();assert.equal(w.writes,1);
  c.editing=true;c.ui.students[0].fee=333;await c.controller.save();const archive=gate();w.gates.push(archive);ack.resolve();await settle();
  assert.ok(c.controller.state.ack);assert.equal(c.ready,false);assert.equal(w.writes,1);
  c.ui.students[0].memo='newest';const save=c.controller.save();archive.resolve();await Promise.all([first,save]);await settle();
  assert.ok(c.controller.state.ack);assert.equal(c.controller.state.local.students[0].memo,'newest');assert.equal(c.controller.state.recovery.length,1);
  const savedUI=copy(c.ui);c.controller.disconnect();const reload=w.client({store:c.store,noJournal:true,ui:savedUI});await reload.connection;await settle();
  assert.equal(w.data.students[0].memo,'newest');assert.equal(w.data.students[0].fee,333);assert.equal(reload.controller.pending(),0);assert.equal(reload.controller.state.recovery.length,1);w.intact();
});
test('two overflow tabs converge disjoint saves without overwriting each other durable key',async()=>{
  const w=world(),a=w.client(),b=w.client();await Promise.all([a.connection,b.connection]);await settle();
  a.ui.students[0].memo='tab A';b.ui.students[0].fee=555;await Promise.all([a.controller.save(),b.controller.save()]);await settle();
  assert.equal(w.data.students[0].memo,'tab A');assert.equal(w.data.students[0].fee,555);
  for(const c of [a,b]){assert.equal(c.controller.pending(),0);assert.equal(c.ready,true);assert.equal(c.controller.state.recovery.length,1);assert.deepEqual(c.ui.students,w.data.students);}
  assert.ok(w.rows.has(prefix+':backup:'+a.controller.instance));assert.ok(w.rows.has(prefix+':backup:'+b.controller.instance));w.intact();
});
test('newer session after close-before-commit keeps the entire previous committed ACK and recovery',async()=>{
  const w=world(),c=w.client();await c.connection;await settle();const key=prefix+':backup:'+c.controller.instance;
  const committed=JSON.parse(w.rows.get(key));committed.ack={sent:copy(committed.local),value:copy(committed.local),revision:40};committed.extraMetadata={retain:true};w.rows.set(key,JSON.stringify(committed));
  const session=JSON.parse(c.store.getItem(prefix));session.local.students[0].memo='session newer';c.store.setItem(prefix,JSON.stringify(session));c.controller.disconnect();
  const reload=w.client({store:c.store,noJournal:true,ui:session.local});await reload.connection;await settle();
  assert.deepEqual(reload.controller.state.overflowPrevious,[committed]);assert.equal(w.data.students[0].memo,'session newer');w.intact();
  await reload.controller.useServer();assert.deepEqual(reload.controller.state.overflowPrevious,[committed]);w.intact();
});
test('export waits for pending archive, rejects account changes and omits other principal rows',async()=>{
  const w=world(),c=w.client();await c.connection;await settle();w.rows.set('vsC_sync_v1:'+encodeURIComponent(namespace+':admin-B')+':backup:other',JSON.stringify({owner:'admin-B',namespace,secret:'synthetic'}));
  const data=await c.controller.exportData();assert.ok(data.backups.every(b=>b.secret===undefined));
  const g=gate();w.gates.push(g);c.ui.students[0].memo='export pending';const saving=c.controller.save();await settle();let done=false;
  const exporting=c.controller.exportData();exporting.then(()=>{done=true;},()=>{done=true;});await settle();assert.equal(done,false);
  c.owner='admin-B';c.controller.disconnect();g.resolve();await saving;await assert.rejects(exporting,/session-changed/);w.intact();
});
test('normal localStorage remains synchronous after overflow inventory loads, without IDB writes',async()=>{
  const w=world();w.backup.setItem=(k,v)=>w.backup.map.set(k,v);const c=w.client();await c.connection;await settle();
  assert.equal(c.ready,true);assert.equal(w.puts.length,0);c.ui.students[0].memo='local path';await c.controller.save();await settle();
  assert.equal(w.data.students[0].memo,'local path');assert.equal(w.puts.length,0);w.intact();
});
test('an offline or invalid-remote gate is not lifted merely by finishing a pending archive',async()=>{
  const w=world(),c=w.client();await c.connection;await settle();const g=gate();w.gates.push(g);
  c.ui.students[0].memo='wait for reconnect';const saving=c.controller.save();await settle();c.controller.unready();c.controller.status('offline');
  g.resolve();await saving;await settle();assert.equal(c.ready,false);assert.equal(w.writes,0);
  await c.controller.retry();await settle();assert.equal(c.ready,true);assert.equal(w.data.students[0].memo,'wait for reconnect');w.intact();
});
test('an explicit save during startup archive is committed before subscription and keeps newest edits',async()=>{
  const w=world(),a=gate(),b=gate();w.gates.push(a,b);const c=w.client();await settle();c.ui.students[0].memo='during startup';const saving=c.controller.save();
  a.resolve();await settle();assert.equal(w.subscriptions,0);assert.equal(w.writes,0);assert.equal(c.ready,false);
  b.resolve();await Promise.all([c.connection,saving]);await settle();assert.equal(w.subscriptions,1);assert.equal(w.data.students[0].memo,'during startup');assert.equal(c.controller.pending(),0);assert.equal(c.controller.state.recovery.length,1);w.intact();
});
