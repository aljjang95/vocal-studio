import test from 'node:test';
import assert from 'node:assert/strict';
import backup from '../vs-backup.js';

const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<4;i++)await tick();}
// Small deterministic IDB contract double: request-success, transaction-complete and
// committed visibility are independently controlled. No browser/runtime proof is claimed.
function database(){
  const w={rows:new Map(),transactions:[],opens:[],closes:0,created:[],holdWrite:false,holdRead:false,eventErrors:[]};
  function request(){
    let value,handler,handlerRegistered=false;const listeners=[];
    return {readyState:'pending',
      get result(){if(this.readyState!=='done')throw new DOMException('request has not finished','InvalidStateError');return value;},
      get onsuccess(){return handler;},set onsuccess(fn){handler=fn;if(!handlerRegistered){handlerRegistered=true;listeners.push(()=>handler?.());}},
      addEventListener(type,fn){assert.equal(type,'success');listeners.push(fn);},
      setResult(result){value=result;this.readyState='done';},
      success(result){this.setResult(result);for(const fn of listeners){try{fn();}catch(error){w.eventErrors.push(error);this.onUnhandled?.(error);}}}
    };
  }
  w.request=request;
  w.idb={open(name,version){w.opens.push({name,version});const req=request();queueMicrotask(()=>{
    if(w.openFailure){req.error=Error('open-error');req.onerror?.();return;}
    if(w.blocked){req.onblocked?.();return;}
    const db={objectStoreNames:{contains:()=>w.created.length>0},createObjectStore:n=>w.created.push(n),close(){w.closes++;},transaction(name,mode,options){
      const tx={name,mode,options,aborted:false,abort(){this.aborted=true;this.error=Error('abort');this.onabort?.();},complete(){if(this.aborted)return;if(this.write&&!w.abortWrite)w.rows.set(...this.write);this.oncomplete?.();},objectStore(){return {
        put(value,key){const r=request();tx.write=[key,value];queueMicrotask(()=>{
          if(w.putFailure){r.error=Error('quota');r.onerror?.();tx.abort();return;}
          r.success(key);if(w.abortWrite)tx.abort();else if(!w.holdWrite)tx.complete();
        });return r;},
        get(key){const r=request();queueMicrotask(()=>{r.success(w.mismatch?'corrupt':w.rows.get(key));if(w.abortRead)tx.abort();else if(!w.holdRead)tx.complete();});return r;},
        openCursor(range){const r=request(),rows=[...w.rows].filter(([key])=>key>=range.lower&&key<=range.upper);let index=0;
          r.onUnhandled=()=>tx.abort();
          function next(){if(tx.aborted)return;const row=rows[index++];r.success(row?{key:row[0],value:row[1],continue(){r.readyState='pending';queueMicrotask(next);}}:null);if(!row&&!w.holdRead)tx.complete();}
          queueMicrotask(next);return r;}
      };}};w.transactions.push(tx);return tx;}};
    req.setResult(db);req.onupgradeneeded?.();req.success(db);
  });return req;}};
  w.store=()=>backup.create({indexedDB:w.idb,IDBKeyRange:{bound:(lower,upper)=>({lower,upper})},timeoutMs:20});return w;
}
test('put requires strict committed write and completed separate exact readback',async()=>{
  const w=database();w.holdWrite=true;w.holdRead=true;let done=false;
  const p=w.store().put('owner-A:tab','exact 한글 🎵').then(v=>{done=true;return v;});await settle();
  assert.equal(done,false);assert.equal(w.rows.size,0);assert.equal(w.transactions.length,1);
  assert.deepEqual(w.transactions[0].options,{durability:'strict'});w.transactions[0].complete();await settle();
  assert.equal(w.transactions.length,2);assert.equal(done,false);assert.equal(w.transactions[1].mode,'readonly');w.transactions[1].complete();
  assert.equal(await p,'exact 한글 🎵');assert.equal(w.closes,1);assert.deepEqual(w.opens,[{name:'vsSyncBackupDB',version:1}]);assert.deepEqual(w.created,['backups']);
});
for(const failure of ['putFailure','abortWrite','abortRead','mismatch','openFailure','blocked'])test('durable store rejects '+failure,async()=>{
  const w=database();w[failure]=true;await assert.rejects(w.store().put('owner-A:tab','exact'));
});
test('unavailable and hung IDB fail closed',async()=>{
  await assert.rejects(backup.create({}).put('key','exact'),/unavailable/);
  const w=database();w.holdWrite=true;await assert.rejects(w.store().put('key','exact'),/timeout|abort/);assert.equal(w.closes,1);
});
test('list reads only the selected principal prefix and waits for cursor transaction completion',async()=>{
  const w=database();w.rows.set('owner-A:tab1','one');w.rows.set('owner-A:tab2','two');w.rows.set('owner-B:tab','secret synthetic');
  assert.deepEqual(await w.store().list('owner-A:'),[{key:'owner-A:tab1',text:'one'},{key:'owner-A:tab2',text:'two'}]);
  assert.equal(w.eventErrors.length,0);
});
test('IDB request double dispatches registration order and result throws after cursor continuation',()=>{
  const w=database(),r=w.request(),calls=[];
  assert.throws(()=>r.result,{name:'InvalidStateError'});
  r.addEventListener('success',()=>{calls.push('first listener');r.result.continue();});
  r.onsuccess=()=>{calls.push('later onsuccess');void r.result;};
  r.success({continue(){r.readyState='pending';}});
  assert.deepEqual(calls,['first listener','later onsuccess']);assert.equal(w.eventErrors.length,1);assert.equal(w.eventErrors[0].name,'InvalidStateError');
});
test('list captures existing cursor rows before continuation and resolves only after transaction commit',async()=>{
  const w=database();w.holdRead=true;w.rows.set('owner-A:tab1','one');w.rows.set('owner-A:tab2','two');let done=false;
  let failure;const p=w.store().list('owner-A:').then(rows=>{done=true;return rows;},error=>{failure=error;return [];});await settle();
  assert.equal(w.eventErrors.length,0,'no request.result read may follow cursor.continue in the same success event');assert.equal(done,false);
  w.transactions[0].complete();assert.deepEqual(await p,[{key:'owner-A:tab1',text:'one'},{key:'owner-A:tab2',text:'two'}]);assert.equal(failure,undefined);assert.equal(w.closes,1);
});
