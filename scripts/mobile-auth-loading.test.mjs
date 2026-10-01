import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const read=name=>readFileSync(process.env.HLB_AUTH_TEST_SOURCE_DIR?resolve(process.env.HLB_AUTH_TEST_SOURCE_DIR,name):new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<5;i++)await tick();}
const record=()=>({state:{students:[],logs:[],payments:[],consults:[],inquiries:[],weekOvr:{}},revision:40,mode:'active',hash:'a'.repeat(64)});
function element(tag='div'){
  return {tag,children:[],attributes:{},style:{setProperty(){}},dataset:{},hidden:false,
    appendChild(child){child.parentNode=this;this.children.push(child);return child;},
    removeChild(child){this.children.splice(this.children.indexOf(child),1);},
    insertBefore(child){this.appendChild(child);},closest(){return null;},
    remove(){this.parentNode?.removeChild(this);},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},
    get firstChild(){return this.children[0];}};
}
function harness(fetch=async()=>Response.json(record())){
  const timers=new Map(),nodes=new Map(),sockets=[],events=new Map();let id=0;
  const document={visibilityState:'visible',activeElement:null,createElement:tag=>element(tag),querySelector:()=>null,
    addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:(key,fn)=>{if(events.get(key)===fn)events.delete(key);}};
  for(const name of ['content','topSyncStatus','vsSyncPanel','adminLoginBtn','adminLogoutBtn','topAdminLoginBtn','topAdminLogoutBtn']){
    const el=element();el.id=name;nodes.set(name,el);
  }
  nodes.get('vsSyncPanel').appendChild(nodes.get('topSyncStatus'));
  class WebSocket{constructor(){sockets.push(this);}close(){}}
  const context=vm.createContext({fetch,AbortController,Response,Blob,TextEncoder,Uint8Array,atob,WebSocket,document,
    console:{error(){}},location:{host:'studio.example',protocol:'https:',reload(){context.navigations++;},assign(){context.navigations++;}},navigations:0,
    setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key;},clearTimeout:key=>timers.delete(key),
    ge:name=>nodes.get(name)||[...nodes.values()].flatMap(x=>[...x.children,...x.children.flatMap(y=>y.children)]).find(x=>x.id===name),
    _showSyncStatus:text=>{context.message=text;},_cfMediaPendingCount:()=>0,_vsSync:null,_fbReady:false,_cfAppHydrated:false,
    _vsEditing:()=>false,render(){},window:{}});
  vm.runInContext(read('cf-transport.js'),context);
  vm.runInContext(html.slice(html.indexOf('var _cfSession='),html.indexOf('function toggleSunCollapse()')),context);
  vm.runInContext(html.slice(html.indexOf('function initCloudflare()'),html.indexOf('function _cfDatabase()')),context);
  vm.runInContext(html.slice(html.indexOf('var _vsSyncLabels='),html.indexOf('function _vsEditing()')),context);
  vm.runInContext(html.slice(html.indexOf('function _retryCloudflareSync()'),html.indexOf('function _vsDrainSoon()')),context);
  const callback=html.match(/status:function\(mode,count\)\{[^\n]*\}/)[0];
  context.status=vm.runInContext('({'+callback+'}).status',context);
  return {context,timers,nodes,sockets,events,fire(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();}};
}
function live(h){
  vm.runInContext(read('vs-sync.js'),h.context);h.context._cfSession={ok:true,principal:'synthetic-owner'};
  let data=record().state,editing=false;const journal=new Map(),backups=new Map();
  const store=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),get length(){return map.size;},key:i=>[...map.keys()][i]});
  h.context._vsSync=h.context.VSSync.create({namespace:'auth-boundary',instanceId:'bounded',store:store(journal),backupStore:store(backups),
    owner:()=>h.context._cfSession.principal,database:()=>h.context.VCFTransport.database(),getData:()=>data,
    setData:value=>{data=value;},render(){},editing:()=>editing,status:h.context.status,
    ready:value=>{h.context._fbReady=value;},timestamp:()=> 'synthetic-time',later:fn=>queueMicrotask(fn),frozen:()=>false});
  return {journal,backups,edit(){editing=true;data.students.push({id:'pending',name:'Synthetic pending'});},pause(){editing=true;},stopEdit(){editing=false;}};
}
test('deadline settles a stalled fetch even if abort is ignored',async()=>{
  const h=harness(()=>new Promise(()=>{}));let error;
  h.context.VCFTransport.session().catch(e=>{error=e;});h.fire(20000);await settle();
  assert.equal(error?.kind,'timeout');assert.equal(h.timers.size,0);
});
test('deadline also settles a stalled response body',async()=>{
  const h=harness(async()=>({text:()=>new Promise(()=>{})}));let error;
  h.context.VCFTransport.session().catch(e=>{error=e;});await settle();h.fire(20000);await settle();
  assert.equal(error?.kind,'timeout');
});
test('401, 403, login HTML and opaque redirect are distinct from network or malformed JSON',async()=>{
  for(const response of [Response.json({error:'access-required'},{status:401}),new Response('Denied',{status:403}),
    new Response('<html>Login</html>',{headers:{'content-type':'text/html'}}),{type:'opaqueredirect',status:0}]){
    const h=harness(async()=>response);await assert.rejects(h.context.VCFTransport.session(),e=>e.kind==='auth');
  }
  for(const [fetch,kind] of [[async()=>{throw TypeError('offline');},'network'],[async()=>new Response('bad-json'),'invalid-response']]){
    const h=harness(fetch);await assert.rejects(h.context.VCFTransport.session(),e=>e.kind===kind);
  }
});
test('actual sync adapter displays expiry and relogin without changing journal owner',async()=>{
  const h=harness(async()=>Response.json({error:'access-required'},{status:401}));
  vm.runInContext(read('vs-sync.js'),h.context);h.context._cfSession={ok:true,principal:'synthetic-owner'};
  const map=new Map();const store={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  h.context._vsSync=h.context.VSSync.create({namespace:'synthetic',store,backupStore:store,
    owner:()=>h.context._cfSession.principal,database:()=>h.context.VCFTransport.database(),getData:()=>record().state,
    setData(){},render(){},status:h.context.status});
  h.context._vsSync.connect();await settle();
  assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'auth-required');
  assert.equal(h.context._vsSync.ready,false);assert.equal(h.context._cfSession.principal,'synthetic-owner');
  assert.equal(h.context.navigations,0);
  assert.equal(h.context.ge('vsSyncLogin')?.hidden,false);
});
test('matching socket hello retries a failed read before the five minute audit',async()=>{
  let fail=false,reads=0;const h=harness(async()=>{reads++;return fail?Response.json({error:'access-required'},{status:403}):Response.json(record());});
  const seen=[],errors=[];const stop=h.context.VCFTransport.database().collection().doc().onSnapshot({},s=>seen.push(s),e=>errors.push(e));
  await settle();h.sockets[0].onopen();fail=true;h.fire(300000);await settle();assert.equal(errors.length,1);
  fail=false;h.sockets[0].onmessage({data:JSON.stringify({type:'hello',revision:40})});await settle();
  assert.equal(reads,3);assert.equal(seen.length,2);stop();assert.equal(h.timers.size,0);
});
test('visible mobile resume refreshes an apparently open silent socket and removes its listener on stop',async()=>{
  let reads=0;const h=harness(async()=>{reads++;return Response.json(record());});
  const doc=h.context.VCFTransport.database().collection().doc();const stop=doc.onSnapshot({},()=>{},()=>{});
  await settle();h.sockets[0].onopen();h.context.document.visibilityState='hidden';h.events.get('visibilitychange')?.();await settle();
  assert.equal(reads,1);h.context.document.visibilityState='visible';h.events.get('visibilitychange')?.();await settle();
  assert.equal(reads,2,'foreground confirmation must not wait for a silent OPEN socket or five-minute audit');
  assert.equal(h.sockets.length,1);stop();assert.equal(h.events.size,0);assert.equal(h.timers.size,0);
  const again=doc.onSnapshot({},()=>{},()=>{});await settle();assert.equal(h.events.size,1);again();assert.equal(h.events.size,0);
});
test('initial loading expires visibly, storage delay stays separate, and fresh confirmation restores the pane',async()=>{
  const h=harness();h.context._vsSyncActions('checking-server');h.fire(25000);
  assert.equal(h.nodes.get('content').attributes['aria-busy'],undefined);
  assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'connection-delayed');assert.equal(h.context.navigations,0);
  h.context._vsSyncActions('synced');assert.equal(h.nodes.get('content').children.length,0);
  h.context._vsSyncActions('storage-pending');h.fire(25000);
  assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'storage-delayed');
  assert.equal(h.context.ge('vsSyncLogin')?.hidden,true);
});
test('initial session failure exits loading with visible login and cannot initialize a controller',async()=>{
  const h=harness(async()=>Response.json({error:'access-required'},{status:401}));let connects=0;
  h.context._vsSync={connect(){connects++;},unready(){},disconnect(){}};
  assert.equal(await h.context.initCloudflare(),false);
  assert.equal(connects,0);assert.equal(h.context.hasAdminSession(),false);
  assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'auth-required');assert.equal(h.context.ge('vsSyncLogin').hidden,false);
  assert.equal(h.context._fbReady,false);assert.equal(h.context.navigations,0);assert.equal(h.timers.size,0);
});
test('session timeout exposes recovery and late success cannot authenticate or connect',async()=>{
  let complete;const h=harness(()=>new Promise(resolve=>{complete=resolve;}));let connects=0;
  h.context._vsSync={connect(){connects++;},unready(){}};
  const pending=h.context.initCloudflare();h.fire(20000);assert.equal(await pending,false);
  assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'connection-delayed');assert.equal(h.context.ge('vsSyncLogin').hidden,false);
  complete(Response.json({ok:true,principal:'late-owner',protocol:'vs-cf-1'}));await settle();
  assert.equal(h.context.hasAdminSession(),false);assert.equal(connects,0);assert.equal(h.context._fbReady,false);
});
test('initialization deduplicates, awaits connect and ignores invalidated owner attempts',async()=>{
  let release,reads=0;const h=harness(async()=>{reads++;return Response.json({ok:true,principal:'owner',protocol:'vs-cf-1'});});
  h.context._vsSync={connect:()=>new Promise(resolve=>{release=resolve;})};
  const first=h.context.initCloudflare();assert.equal(first,h.context.initCloudflare());let finished=false;first.then(()=>{finished=true;});
  await settle();assert.equal(reads,1);assert.equal(finished,false);assert.equal(h.context._fbReady,false);release(true);assert.equal(await first,true);
  let complete,connects=0;const stale=harness(()=>new Promise(resolve=>{complete=resolve;}));
  stale.context._vsSync={connect(){connects++;},disconnect(){}};
  const attempt=stale.context.initCloudflare();stale.context._disableCloudflareSync();
  complete(Response.json({ok:true,principal:'stale-owner',protocol:'vs-cf-1'}));assert.equal(await attempt,false);
  assert.equal(stale.context.hasAdminSession(),false);assert.equal(connects,0);
});
test('explicit login navigation protects an open form; retry never navigates automatically',async()=>{
  const h=harness();h.context._vsEditing=()=>true;h.context.confirm=()=>false;
  assert.equal(await h.context.signInAdmin(),false);assert.equal(h.context.navigations,0);
  h.context.confirm=()=>true;assert.equal(await h.context.signInAdmin(),true);assert.equal(h.context.navigations,1);
});
test('an old synced repaint cannot hide failed session confirmation',async()=>{
  const h=harness(async()=>Response.json({error:'access-required'},{status:403}));
  h.context._cfSession={ok:true,principal:'existing-owner'};
  h.context._vsSync={ready:true,confirmed:true,unready(){this.ready=false;this.confirmed=false;}};
  assert.equal(await h.context.initCloudflare(),false);h.context._vsSyncActions('synced');
  assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'auth-required');assert.equal(h.context.ge('vsSyncLogin').hidden,false);
  assert.equal(h.context.hasAdminSession(),true);assert.equal(h.context._vsSync.ready,false);
});
test('state expiry preserves an existing pending journal, then session retry restores with an acknowledged save',async()=>{
  let fail=false,state=record(),writes=0;const h=harness(async(path,options)=>{
    if(fail)return Response.json({error:'access-required'},{status:401});
    if(path==='/api/session')return Response.json({ok:true,principal:'synthetic-owner',protocol:'vs-cf-1'});
    if(path==='/api/commit'){writes++;const body=JSON.parse(options.body);state={...state,state:body.state,revision:state.revision+1};return Response.json({...state,ok:true});}
    return Response.json(state);
  });
  vm.runInContext(read('vs-sync.js'),h.context);h.context._cfSession={ok:true,principal:'synthetic-owner'};
  let data=record().state,editing=false;const map=new Map();const store={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  h.context._vsSync=h.context.VSSync.create({namespace:'synthetic',instanceId:'auth-repro',store,backupStore:store,
    owner:()=>h.context._cfSession.principal,database:()=>h.context.VCFTransport.database(),getData:()=>data,
    setData:value=>{data=value;},render(){},editing:()=>editing,status:h.context.status,
    timestamp:()=> 'synthetic-time',later:fn=>queueMicrotask(fn),frozen:()=>false});
  h.context._vsSync.connect();await settle();h.sockets[0].onopen();assert.equal(h.context._vsSync.ready,true);
  editing=true;data.students.push({id:'pending',name:'Synthetic pending'});await h.context._vsSync.save();
  assert.equal(h.context._vsSync.pending(),1);const before=[...map];fail=true;h.fire(300000);await settle();
  assert.equal(h.context._vsSync.ready,false);assert.equal(h.context._vsSync.pending(),1);assert.deepEqual([...map],before);
  assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'auth-required');assert.equal(writes,0);assert.equal(h.context.navigations,0);
  fail=false;editing=false;await h.context._retryCloudflareSync();await settle();
  assert.equal(h.context._vsSync.ready,true,JSON.stringify({mode:h.context._vsSync.mode,error:h.context.VCFTransport.stateError()?.message,sessionIssue:h.context._cfConnectionIssue?.message,writes}));assert.equal(h.context._vsSync.pending(),0);assert.equal(writes,1);
  assert.equal(state.state.students[0].name,'Synthetic pending');assert.equal(h.context._cfSession.principal,'synthetic-owner');
  h.context._vsSync.disconnect();assert.equal(h.timers.size,0);
});
test('manual retry failure shares the subscription hello recovery flag without rewriting pending bytes',async()=>{
  let fail=false,reads=0;const h=harness(async()=>{reads++;return fail?Response.json({error:'access-required'},{status:401}):Response.json(record());});
  const c=live(h);h.context._vsSync.connect();await settle();h.sockets[0].onopen();
  c.edit();await h.context._vsSync.save();const journal=[...c.journal],backups=[...c.backups];
  fail=true;await h.context._vsSync.retry();assert.equal(reads,2);assert.equal(h.context._vsSync.ready,false);
  assert.equal(h.context._vsSync.pending(),1);assert.deepEqual([...c.journal],journal);assert.deepEqual([...c.backups],backups);
  fail=false;h.sockets[0].onmessage({data:JSON.stringify({type:'hello',revision:40})});await settle();
  assert.equal(reads,3);assert.equal(h.context._vsSync.pending(),1);assert.deepEqual([...c.journal],journal);
  assert.deepEqual([...c.backups],backups);h.context._vsSync.disconnect();
});
test('session failure invalidates a held audit GET while retaining pending journal, backups, owner and epoch',async()=>{
  let reads=0,release,writes=0;const h=harness(async path=>{
    if(path==='/api/session')return Response.json({error:'access-required'},{status:401});
    if(path==='/api/commit'){writes++;throw Error('unexpected commit');}
    reads++;if(reads===2)return new Promise(resolve=>{release=resolve;});return Response.json(record());
  });
  const c=live(h);h.context._vsSync.connect();await settle();h.sockets[0].onopen();c.edit();await h.context._vsSync.save();
  const journal=[...c.journal],backups=[...c.backups],epoch=h.context._vsSync.epoch;
  h.fire(300000);await settle();assert.equal(await h.context.initCloudflare(),false);
  release(Response.json(record()));await settle();
  assert.equal(reads,2);assert.equal(writes,0);assert.equal(h.context._vsSync.ready,false);assert.equal(h.context._fbReady,false);
  assert.equal(h.context._cfAuthIssue,true);assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'auth-required');
  assert.equal(h.context._vsSync.pending(),1);assert.equal(h.context._vsSync.epoch,epoch);assert.equal(h.context._vsSync.owner,'synthetic-owner');
  assert.deepEqual([...c.journal],journal);assert.deepEqual([...c.backups],backups);h.context._vsSync.disconnect();
});
test('invalidated manual GET cannot later unready a newer good confirmation',async()=>{
  let reads=0,release;const h=harness(async path=>{
    if(path==='/api/session')return Response.json({error:'access-required'},{status:401});
    reads++;if(reads===2)return new Promise(resolve=>{release=resolve;});return Response.json(record());
  });
  live(h);h.context._vsSync.connect();await settle();const old=h.context._vsSync.retry();await settle();
  assert.equal(await h.context.initCloudflare(),false);await old;assert.equal(h.context._vsSync.ready,false);
  await h.context._vsSync.retry();assert.equal(reads,3);assert.equal(h.context._vsSync.ready,true);
  release(Response.json(record()));await settle();assert.equal(h.context._vsSync.ready,true);
  assert.equal(h.context._cfAuthIssue,false);h.context._vsSync.disconnect();
});
test('auth remains visible across network and timeout failures without rewriting pending bytes',async()=>{
  let mode='ok';const h=harness(async()=>{
    if(mode==='auth')return Response.json({error:'access-required'},{status:401});
    if(mode==='network')throw TypeError('offline');if(mode==='timeout')return new Promise(()=>{});
    return Response.json(record());
  });
  const c=live(h);h.context._vsSync.connect();await settle();h.sockets[0].onopen();c.edit();await h.context._vsSync.save();
  const journal=[...c.journal],backups=[...c.backups];mode='auth';h.fire(300000);await settle();
  for(const failure of ['network','timeout']){
    mode=failure;h.events.get('visibilitychange')();await settle();if(failure==='timeout'){h.fire(20000);await settle();}
    assert.equal(h.context._cfAuthIssue,true);assert.equal(h.context.ge('vsSyncLogin').hidden,false);
    assert.equal(h.nodes.get('vsSyncPanel').dataset.mode,'auth-required');assert.equal(h.context._vsSync.pending(),1);
    assert.deepEqual([...c.journal],journal);assert.deepEqual([...c.backups],backups);
  }
  h.context._vsSync.disconnect();
});
test('invalidated commit auth, network and acknowledgement results cannot publish into a newer generation',async()=>{
  for(const outcome of ['auth','network','ack']){
    let release;const h=harness(async(path,options)=>{
      if(path!=='/api/commit')return Response.json(record());
      const body=JSON.parse(options.body);
      return new Promise((resolve,reject)=>{release=()=>outcome==='network'?reject(TypeError('old network failure')):
        resolve(outcome==='auth'?Response.json({error:'access-required'},{status:401}):Response.json({...record(),revision:41,state:body.state,ok:true}));});
    });
    const transaction=h.context.VCFTransport.database().runTransaction(async tx=>{
      const value=(await tx.get()).data();value.students.push({id:'pending',name:'Synthetic pending'});tx.set(null,value);return 'old-result';
    });
    await settle();h.context.VCFTransport.invalidateStateReads();await h.context.VCFTransport.database().collection().doc().get();
    const rejected=assert.rejects(transaction,error=>error.kind==='cancelled');release();await rejected;
    assert.equal(h.context.VCFTransport.stateError(),null);assert.equal(h.timers.size,0);
  }
});
test('old commit outcomes preserve raw pending journals and cannot relatch auth or create an unconfirmed ACK',async()=>{
  for(const outcome of ['auth','network','ack']){
    let release,expired=false,writes=0;const h=harness(async(path,options)=>{
      if(path==='/api/session')return expired?Response.json({error:'access-required'},{status:401}):Response.json({ok:true,principal:'synthetic-owner',protocol:'vs-cf-1'});
      if(path!=='/api/commit')return Response.json(record());
      writes++;const body=JSON.parse(options.body);
      return new Promise((resolve,reject)=>{release=()=>outcome==='network'?reject(TypeError('old network failure')):
        resolve(outcome==='auth'?Response.json({error:'access-required'},{status:401}):Response.json({...record(),revision:41,state:body.state,ok:true}));});
    });
    const c=live(h);h.context._vsSync.connect();await settle();c.edit();await h.context._vsSync.save();c.stopEdit();
    const journal=[...c.journal],backups=[...c.backups],epoch=h.context._vsSync.epoch;
    const old=h.context._vsSync.flush();await settle();assert.equal(writes,1);
    expired=true;assert.equal(await h.context.initCloudflare(),false);expired=false;
    await h.context.initCloudflare();await settle();assert.equal(h.context._vsSync.confirmed,true);assert.equal(h.context._cfAuthIssue,false);
    c.pause();release();assert.equal(await old,false);await settle();
    assert.equal(h.context.VCFTransport.stateError(),null);assert.equal(h.context._cfAuthIssue,false);
    assert.equal(h.context._vsSync.pending(),1);assert.equal(h.context._vsSync.state.ack,undefined);assert.equal(writes,1);
    assert.equal(h.context._vsSync.epoch,epoch);assert.equal(h.context._vsSync.owner,'synthetic-owner');
    assert.deepEqual([...c.journal],journal);assert.deepEqual([...c.backups],backups);h.context._vsSync.disconnect();assert.equal(h.timers.size,0);
  }
});
