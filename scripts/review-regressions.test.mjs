import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import sync from '../vs-sync.js';

const copy=structuredClone;
const seed=()=>({students:[{id:'s1',name:'A'}],logs:[],payments:[],consults:[],inquiries:[],weekOvr:{w1:{s1:{time:'10:00'}}}});
function storage(){
  const map=new Map();
  return{fail:false,getItem(k){return map.get(k)??null;},setItem(k,v){if(this.fail)throw Error('quota');map.set(k,v);},removeItem(k){map.delete(k);},key(i){return [...map.keys()][i]??null;},get length(){return map.size;}};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('quota-only snapshot reclaim removes exact duplicates only after preserving their bytes',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=index.match(/function _reclaimDuplicateRecoverySnapshot\(\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source,'quota-only recovery deduplication helper exists');
  for(const mode of ['same','unique','no-rescue-space','concurrent']){
    const values=new Map([['vsC_recovery_latest','same'],['vsC_recovery_123',mode==='unique'?'unique':'same'],['unrelated','keep']]);
    const preserved=[];let reads=0;
    const localStorage={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>{if(mode==='concurrent'&&k==='vsC_recovery_latest'&&++reads===2)values.set(k,'newer');return values.get(k)??null;},removeItem:k=>values.delete(k)};
    const _vsSync={preserveReclaimedBackup:raw=>{if(mode==='no-rescue-space')return false;preserved.push(raw);return true;}};
    const context=vm.createContext({localStorage,_vsSync,RECOVERY_PREFIX:'vsC_recovery_'});
    vm.runInContext(source,context);
    const removed=vm.runInContext('_reclaimDuplicateRecoverySnapshot()',context);
    assert.equal(removed,mode==='same'?1:0);
    assert.equal(values.has('vsC_recovery_123'),mode!=='same');assert.equal(values.get('unrelated'),'keep');
    if(mode==='same')assert.deepEqual(preserved,['same']);
  }
});
async function settle(){for(let i=0;i<5;i++)await tick();}

test('local state replacement needs no duplicate quota and keeps old value on failure',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=index.match(/function _safeSetLS\(key,val\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(source,'local storage writer exists');
  const values=new Map([['vsC_s','old']]);
  const writes=[];
  const localStorage={
    setItem(key,value){
      writes.push(key);
      const other=[...values].reduce((sum,[k,v])=>sum+(k===key?0:v.length),0);
      if(other+value.length>10)throw new DOMException('full','QuotaExceededError');
      values.set(key,value);
    },
    getItem:key=>values.get(key)??null
  };
  const context=vm.createContext({localStorage});
  vm.runInContext(source,context);
  vm.runInContext("_safeSetLS('vsC_s','1234567890')",context);
  assert.equal(values.get('vsC_s'),'1234567890');
  assert.deepEqual(writes,['vsC_s']);
  assert.throws(()=>vm.runInContext("_safeSetLS('vsC_s','12345678901')",context),/full/);
  assert.equal(values.get('vsC_s'),'1234567890');
});
test('a larger local data replacement reclaims a preserved duplicate once before retrying intact',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=index.match(/function _safeSetLS\(key,val\)\{[\s\S]*?\n\}/)[0];
  const values=new Map([['vsC_s','old'],['duplicate','123456']]);let reclaimed=0,attempts=0;
  const localStorage={setItem(key,value){attempts++;const total=[...values].reduce((n,[k,v])=>n+(key===k?0:v.length),value.length);if(total>10)throw Error('quota');values.set(key,value);}};
  const context=vm.createContext({localStorage,_reclaimDuplicateRecoverySnapshot:()=>{reclaimed++;values.delete('duplicate');return 1;}});
  vm.runInContext(source,context);vm.runInContext("_safeSetLS('vsC_s','1234567890')",context);
  assert.equal(reclaimed,1);assert.equal(attempts,2);assert.equal(values.get('vsC_s'),'1234567890');
});
function makeWorld(){
  const w={data:seed(),revision:0,writes:0,failNext:0,listeners:new Set()};
  w.snapshot=()=>({
    exists:true,metadata:{fromCache:false,hasPendingWrites:false},
    data:()=>({...copy(w.data),_vsSyncRevision:w.revision})
  });
  w.emit=()=>{for(const fn of w.listeners)fn(w.snapshot());};
  w.db={
    collection:()=>({doc:()=>({
      onSnapshot(options,next){w.listeners.add(next);return()=>w.listeners.delete(next);},
      get:async()=>w.snapshot()
    })}),
    runTransaction:async fn=>{
      if(w.failNext){w.failNext--;throw Error('injected-write-failure');}
      let written=null;
      const result=await fn({get:async()=>w.snapshot(),set(ref,value){written=copy(value);}});
      if(written){delete written._vsSyncRevision;w.data=sync.normalize(written);w.revision++;w.writes++;w.emit();}
      return result;
    }
  };
  return w;
}
function client(w,options={}){
  const c={
    ui:copy(options.ui||w.data),owner:'admin-A',store:options.store||storage(),
    hydrated:options.hydrated!==false,durable:options.durable||null,renders:0,mode:''
  };
  c.controller=sync.create({
    namespace:'vocal-studio',instanceId:options.instanceId||'review-client',store:c.store,backupStore:storage(),
    owner:()=>c.owner,database:()=>w.db,timestamp:()=>new Date(0).toISOString(),
    frozen:()=>false,editing:()=>false,later:fn=>queueMicrotask(fn),
    hydrated:()=>c.hydrated,resumeData:()=>c.durable?copy(c.durable):null,
    getData:()=>c.ui,setData:data=>{c.ui=copy(data);c.hydrated=true;},
    render:()=>{c.renders++;},status:mode=>{c.mode=mode;}
  });
  c.controller.connect();w.emit();return c;
}

test('auth-cleared unhydrated reload prefers latest principal-bound durable undo over older pending journal',async()=>{
  const w=makeWorld(),c=client(w);w.failNext=1;
  c.ui.weekOvr.w1.s1.time='11:00';await c.controller.save();
  assert.equal(c.controller.pending(),1);assert.equal(w.writes,0);
  c.store.fail=true;c.ui.weekOvr.w1.s1.time='10:00';const durable=copy(c.ui);await c.controller.save();
  c.controller.disconnect();c.store.fail=false;
  const resumed=client(w,{store:c.store,ui:{},hydrated:false,durable,instanceId:'reload'});await settle();
  assert.equal(resumed.ui.weekOvr.w1.s1.time,'10:00');assert.equal(w.data.weekOvr.w1.s1.time,'10:00');
  assert.equal(w.writes,0);assert.equal(resumed.controller.state.resumeConflict,true);assert.equal(resumed.mode,'conflict');
  assert.ok(resumed.controller.state.recovery.some(data=>data.weekOvr.w1.s1.time==='11:00'));
  await resumed.controller.retry();await settle();assert.equal(w.writes,0);
});
test('media retry action remains reachable while state mode is synced',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(index,/function _cfMediaPendingCount\(\)/);
  assert.match(index,/mode==='synced'&&mediaPending===0/);
  assert.match(index,/\['vsMediaRetry','미디어 다시 전송'/);
  assert.match(index,/window\.addEventListener\('online',[\s\S]*?_cfDrainMedia\(\)/);
  assert.match(index,/setTimeout\(_cfDrainMedia,0\)/);
});

test('principal-bound local resume is mandatory for unhydrated startup',()=>{
  const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(index,/localStorage\.getItem\(_cfLocalOwnerKey\(\)\)!==owner/);
  assert.match(index,/resumeData:function\(owner\)\{return _cfLoadLocalResume\(owner\);\}/);
  assert.match(index,/_cfBindLocalOwner\(\);_saveAllOrig\(\)/);
});

test('deployment remains locally locked',()=>{
  const config=fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  const lock=fs.readFileSync(new URL('./deploy-locked.mjs',import.meta.url),'utf8');
  assert.match(config,/"DEPLOYMENT_ENABLED": "false"/);
  assert.match(lock,/production deployment locked/);
});
