import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import sync from '../vs-sync.js';

const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fields={vsC_s:'students',vsC_l:'logs',vsC_wo:'weekOvr',vsC_c:'consults',vsC_p:'payments',vsC_iq:'inquiries'};
const copy=value=>JSON.parse(JSON.stringify(value));
function storage(limit=Infinity){
  const map=new Map(),writes=[],removed=[];
  return {map,writes,removed,limit,
    get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,
    setItem(k,v){writes.push({key:k,text:v});const bytes=[...map].reduce((n,[key,text])=>n+(key===k?0:2*(key.length+text.length)),2*(k.length+v.length));if(bytes>this.limit)throw new DOMException('full','QuotaExceededError');map.set(k,v);},
    removeItem(k){removed.push(k);map.delete(k);}};
}
function source(name,optional=false){
  const text=index.match(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'))?.[0];
  if(!optional)assert.ok(text,'actual app function '+name+' exists');
  return text||'';
}
function harness(store,codec=sync,extra={}){
  const context=vm.createContext({localStorage:store,...(codec?{VSSync:codec}:{}),...extra});
  vm.runInContext(['_decodeAppCache','_safeParseLS','_safeSetLS','_cfLocalOwnerKey','_cfLoadLocalResume'].map(n=>source(n,n==='_decodeAppCache')).join('\n'),context);
  return context;
}
function fixture(){
  const metadata=JSON.parse('{"__proto__":{"retained":true},"constructor":"保留","future":{"tags":["🎤","한글","日本語"],"nested":[null,false,0,{"memo":"반복 音楽 🎵"}]}}');
  return {students:Array.from({length:900},(_,i)=>({id:'synthetic-'+i,name:'合성 🎤 '+i,memo:'상담 기록 🎶 nested metadata '.repeat(25),metadata,photo:'/api/media/photo-'+i,_photoKey:'vsC_ph_synthetic-'+i,audios:[{name:'take',url:'/api/media/audio-'+i,data:'[saved]',_mediaKey:'media-'+i}],videos:[{url:'/api/media/video-'+i}],consentRec:{url:'/api/media/consent-'+i}})),logs:[],weekOvr:{w:{'synthetic-0':[{day:'월',time:'10:00'}]}},consults:[],payments:[],inquiries:[]};
}
function seedCache(store,data){store.map.set('vsC_cf_owner_v1','synthetic-owner');for(const [key,field]of Object.entries(fields))store.map.set(key,JSON.stringify(data[field]));}
function retain(store){
  for(const [key,text]of [['vsC_sync_v1:foreign:backup:pending','UNSENT synthetic foreign intent'],['vsC_recovery_latest','retained latest'],['vsC_recovery_123','retained recovery'],['vsC_ph_synthetic','retained photo'],['vsC_draft','retained draft'],['vsC_draftPh','retained draft photo'],['vsC_mediaQueue','retained media']])store.map.set(key,text);
  return new Map(store.map);
}
function intact(store,old){for(const [key,text]of old)assert.equal(store.getItem(key),text,key+' retained');assert.deepEqual(store.removed,[]);}

test('public storage codec round-trips large Unicode, nested unknown fields and reserved names exactly',()=>{
  assert.equal(typeof sync.encodeStorage,'function');assert.equal(typeof sync.decodeStorage,'function');
  const text=JSON.stringify(fixture().students),packed=sync.encodeStorage(text);
  assert.ok(packed.length<text.length/2);assert.equal(sync.decodeStorage(packed),text);
  assert.deepEqual(JSON.parse(sync.decodeStorage(packed)),JSON.parse(text));
  assert.equal(sync.decodeStorage('[{"id":"legacy"}]'),'[{"id":"legacy"}]');
  assert.equal(sync.encodeStorage('[]'),'[]');
});

test('six-key app cache compresses before quota failure and reload preserves metadata and media pointers',()=>{
  const store=storage(500000),old=retain(store),data=fixture(),h=harness(store);
  for(const [key,field]of Object.entries(fields))h._safeSetLS(key,JSON.stringify(data[field]));
  store.map.set('vsC_cf_owner_v1','synthetic-owner');
  assert.equal(JSON.parse(store.getItem('vsC_s')).encoding,'vs-lz-utf16-1');
  assert.equal(store.writes.filter(w=>w.key==='vsC_s').length,1,'no oversized plain write first');
  const reload=harness(store);
  for(const [key,field]of Object.entries(fields))assert.deepEqual(copy(reload._safeParseLS(key,null)),data[field]);
  assert.deepEqual(copy(reload._cfLoadLocalResume('synthetic-owner')),data);intact(store,old);
});

test('actual saveAll replaces an already-full legacy cache with a 224000-character Unicode edit and survives remote display',()=>{
  const store=storage(),old=retain(store),baseline=fixture();baseline.students[0].memo='baseline '.repeat(21);
  seedCache(store,baseline);
  store.map.set('vsC_sync_v1:foreign:backup:full','protected pending '.repeat(10000));old.set('vsC_sync_v1:foreign:backup:full',store.getItem('vsC_sync_v1:foreign:backup:full'));
  store.limit=[...store.map].reduce((n,[key,text])=>n+2*(key.length+text.length),0);
  const data=copy(baseline);data.students[0].memo='한🎤'.repeat(74667).slice(0,224000);
  assert.equal(data.students[0].memo.length,224000);
  const toasts=[],h=harness(store,sync,{...data,_backupOrphanPhotos(){},_writeRecoverySnapshot(){},toast:text=>toasts.push(text)});
  vm.runInContext(source('saveAll'),h);h.saveAll();h.saveAll();
  assert.deepEqual(toasts,[]);assert.deepEqual(copy(h._cfLoadLocalResume('synthetic-owner')),data);
  assert.ok(store.writes.filter(w=>w.key==='vsC_s').every(w=>w.text.length<JSON.stringify(baseline.students).length));
  intact(store,old);
});

test('allowlist covers every cache key and leaves large draft/recovery/photo/journal writes plain',()=>{
  const store=storage(),h=harness(store),text=JSON.stringify(fixture().students);
  for(const key of Object.keys(fields)){h._safeSetLS(key,text);assert.equal(JSON.parse(store.getItem(key)).encoding,'vs-lz-utf16-1');assert.equal(sync.decodeStorage(store.getItem(key)),text);}
  for(const key of ['vsC_draft','vsC_ph_one','vsC_recovery_latest','vsC_sync_v1:owner:backup:one']){h._safeSetLS(key,text);assert.equal(store.getItem(key),text);}
});

test('plain legacy cache and explicit empty collections remain valid for the exact owner',()=>{
  const store=storage(),data={students:[],logs:[],weekOvr:{},consults:[],payments:[],inquiries:[]};seedCache(store,data);
  const h=harness(store);assert.deepEqual(copy(h._cfLoadLocalResume('synthetic-owner')),data);
  assert.equal(h._cfLoadLocalResume('other-owner'),null);assert.equal(h._cfLoadLocalResume(null),null);
});

test('missing, malformed and wrong-shaped cache components fail strict resume closed',()=>{
  for(const key of Object.keys(fields))for(const invalid of [null,'{broken','null','"wrong"',key==='vsC_wo'?'[]':'{}']){
    const store=storage();seedCache(store,{students:[],logs:[],weekOvr:{},consults:[],payments:[],inquiries:[]});
    if(invalid===null)store.map.delete(key);else store.map.set(key,invalid);
    assert.equal(harness(store)._cfLoadLocalResume('synthetic-owner'),null,key+': '+invalid);
  }
});

test('corrupt compressed cache rejects resume while ordinary parsing retains its recovery fallback',()=>{
  const store=storage(),data=fixture();seedCache(store,data);const h=harness(store);
  h._safeSetLS('vsC_s',JSON.stringify(data.students));
  const packed=JSON.parse(store.getItem('vsC_s'));packed.checksum='corrupt';store.map.set('vsC_s',JSON.stringify(packed));
  assert.equal(h._cfLoadLocalResume('synthetic-owner'),null);
  store.map.set('vsC_recovery_latest',JSON.stringify({data:{vsC_s:[{id:'synthetic recovery'}]}}));
  assert.deepEqual(copy(h._safeParseLS('vsC_s',[])),[{id:'synthetic recovery'}]);
});

test('codec absent or no size savings falls back to one plain write without losing legacy reads',()=>{
  const text=JSON.stringify(fixture().students);
  for(const codec of [null,{encodeStorage:value=>value,decodeStorage:value=>value},{encodeStorage:()=>{throw Error('codec');},decodeStorage:value=>value}]){
    const store=storage(),h=harness(store,codec);h._safeSetLS('vsC_s',text);assert.equal(store.getItem('vsC_s'),text);assert.equal(store.writes.length,1);
    assert.deepEqual(copy(h._safeParseLS('vsC_s',[])),JSON.parse(text));
  }
});

test('compressed read requires its decoder and cannot become an authoritative envelope-shaped cache',()=>{
  const store=storage(),data=fixture();seedCache(store,data);harness(store)._safeSetLS('vsC_s',JSON.stringify(data.students));
  const h=harness(store,null);assert.equal(h._cfLoadLocalResume('synthetic-owner'),null);assert.deepEqual(copy(h._safeParseLS('vsC_s',[])),[]);
});

test('compressed write failure can use verified plain replacement; both failures preserve every prior value',()=>{
  const text=JSON.stringify(fixture().students),store=storage(),old=retain(store),write=store.setItem.bind(store);
  store.setItem=(key,value)=>{if(value!==text)throw Error('compressed-route');write(key,value);};
  harness(store)._safeSetLS('vsC_s',text);assert.equal(store.getItem('vsC_s'),text);intact(store,old);
  const full=storage(),retained=retain(full);full.map.set('vsC_s','[{"id":"old"}]');retained.set('vsC_s',full.getItem('vsC_s'));full.limit=1;
  assert.throws(()=>harness(full)._safeSetLS('vsC_s',text),/full/);intact(full,retained);
});

test('codec round-trip mismatch falls back to plain and write readback mismatch is an explicit failure',()=>{
  const text=JSON.stringify(fixture().students),store=storage();
  harness(store,{encodeStorage:()=> 'bad',decodeStorage:()=> 'wrong'})._safeSetLS('vsC_s',text);assert.equal(store.getItem('vsC_s'),text);
  const bad=storage();bad.setItem=()=>{};assert.throws(()=>harness(bad)._safeSetLS('vsC_s',text),/readback/);
});

test('app cache failure preserves media metadata and does not assert a failed durable server save',()=>{
  const data=fixture(),toasts=[],h=vm.createContext({...data,_backupOrphanPhotos(){},_safeSetLS(){throw Error('quota');},_writeRecoverySnapshot(){},toast:text=>toasts.push(text)});
  vm.runInContext(source('saveAll'),h);h.saveAll();
  assert.equal(toasts.length,1);assert.doesNotMatch(toasts[0],/저장 실패:|미디어가 제외/);
  assert.deepEqual(copy(h.students),data.students);assert.deepEqual(copy(h.consults),data.consults);
});

test('actual saveAll wrapper still submits durable sync after a cache failure',async()=>{
  let synced=0;const toasts=[],h=vm.createContext({students:[],consults:[],logs:[],weekOvr:{},payments:[],inquiries:[],
    _backupOrphanPhotos(){},_safeSetLS(){throw Error('quota');},_writeRecoverySnapshot(){},toast:text=>toasts.push(text),
    hasAdminSession:()=>true,_cfBindLocalOwner(){},_fbApplyingRemote:false,_vsSync:{save(){synced++;return Promise.resolve(true);}}});
  vm.runInContext(source('saveAll')+'\nvar _saveAllOrig=saveAll;\n'+index.match(/saveAll=function\(\)\{[\s\S]*?\n\};/)[0],h);
  h.saveAll();await Promise.resolve();assert.equal(synced,1);assert.equal(toasts.length,1);assert.doesNotMatch(toasts[0],/저장 실패:|미디어가 제외/);
});
