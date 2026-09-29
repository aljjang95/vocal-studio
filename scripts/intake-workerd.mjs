import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
mkdirSync(path.join(root,'work'),{recursive:true});
const persist=mkdtempSync(path.join(root,'work','intake-workerd-'));
const checks=[];let deliveries=0,releaseFirst,enterFirst;
const firstHeld=new Promise(resolve=>releaseFirst=resolve),firstEntered=new Promise(resolve=>enterFirst=resolve);
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const options={...convertV4MiniflareOptions({cf:false,workers:[
  {name:'probe',modules:true,compatibilityDate:'2026-09-14',serviceBindings:{INTAKE:{name:'studio',entrypoint:'BookingIntake'}},
    script:'export default {async fetch(r,env){return Response.json(await env.INTAKE.create(await r.json()));}}'},
  {name:'studio',modules:true,scriptPath:path.join(root,'work/intake-bundle/entry.js'),compatibilityDate:'2026-09-14',
    durableObjects:{STUDIO:{className:'StudioState',useSQLite:true}},
    bindings:{ENVIRONMENT:'local-test',STUDIO_NAMESPACE:'synthetic-intake',BOOKING_NOTIFICATIONS_ENABLED:'true',BOOKING_TELEGRAM_TOKEN:'synthetic-test',BOOKING_TELEGRAM_CHAT_ID:'synthetic-test'},
    outboundService:async request=>{
      const url=new URL(request.url);
      assert.equal(url.hostname,'api.telegram.org');assert.equal(request.method,'POST');
      const body=await request.json();assert.equal(body.chat_id,'synthetic-test');assert.equal(body.parse_mode,undefined);
      const attempt=++deliveries;
      if(attempt===1){enterFirst();await firstHeld;return Response.json({ok:false},{status:503});}
      return Response.json({ok:true,result:{message_id:100+attempt}});
    },
  },
]}),resourcePersistencePath:persist,unsafeDevRegistryPath:path.join(persist,'registry')};
let mf=new Miniflare(options);
const booking={submissionId:crypto.randomUUID(),clientKey:'a'.repeat(64),booking:{name:'Synthetic Intake',phone:'01000001111',gender:'female',preferredDay:'평일 저녁'}};
try{
  await mf.ready;
  let ns=await mf.getDurableObjectNamespace('STUDIO','studio'),stub=ns.get(ns.idFromName('synthetic-intake'));
  const call=(path,body)=>stub.fetch('https://state.local'+path,{method:body===undefined?'GET':'POST',headers:{'X-VS-Principal':'local-qa'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let r=await call('/import',{state:{students:[],inquiries:[],consults:[],weekOvr:{},future:{preserved:true}}});check('stage',r.status===201);
  const staged=await(await call('/export')).json();check('activate',(await call('/activate',{hash:staged.hash})).ok);
  const submit=async()=>await(await mf.dispatchFetch('https://probe.local/',{method:'POST',body:JSON.stringify(booking)})).json();
  const results=await Promise.all(Array.from({length:8},submit));
  check('named RPC real Workerd one write',results.filter(x=>x.status===201).length===1&&results.filter(x=>x.status===200).length===7);
  check('receipt minimal',results.every(x=>Object.keys(x.body.data).join(',')==='id'));
  const saved=await(await call('/state')).json();check('canonical queryable',saved.revision===1&&saved.state.inquiries.length===1&&saved.state.future.preserved);
  check('no inferred schedule',saved.state.inquiries[0].visitDate===''&&saved.state.inquiries[0].visitTime==='');
  await Promise.race([firstEntered,new Promise((_,reject)=>setTimeout(()=>reject(Error('alarm did not fire')),8000))]);
  try{
    const start=performance.now();
    const whileSending=await Promise.race([call('/state'),new Promise((_,reject)=>setTimeout(()=>reject(Error('canonical read blocked by external I/O')),1500))]);
    check('real Workerd canonical read while outbound fetch suspended',whileSending.status===200&&performance.now()-start<1500);
  }finally{releaseFirst();}
  let outbox;
  for(let i=0;i<80;i++){
    outbox=await(await call('/intake/notifications')).json();
    if(outbox.notifications[0]?.attempts===1)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  check('failed send retained durable pending item',outbox.notifications[0]?.status==='pending'&&deliveries===1);
  // Stop/recreate while PENDING, against the same local SQLite persistence.
  await mf.dispose();mf=new Miniflare(options);await mf.ready;
  ns=await mf.getDurableObjectNamespace('STUDIO','studio');stub=ns.get(ns.idFromName('synthetic-intake'));
  const replay=await(await mf.dispatchFetch('https://probe.local/',{method:'POST',body:JSON.stringify(booking)})).json();
  check('runtime restart replay',replay.status===200&&replay.body.data.id===booking.submissionId);
  check('runtime restart canonical once',(await(await stub.fetch('https://state.local/state')).json()).revision===1);
  const pending=await(await stub.fetch('https://state.local/intake/notifications')).json();
  check('runtime restart pending retained',pending.notifications[0]?.status==='pending'&&pending.notifications[0]?.attempts===1);
  // New intake arms an early alarm; the old pending item must retain its real retry deadline.
  const second={...booking,submissionId:crypto.randomUUID(),booking:{...booking.booking,phone:'01000002222'}};
  check('new intake after restart',(await(await mf.dispatchFetch('https://probe.local/',{method:'POST',body:JSON.stringify(second)})).json()).status===201);
  for(let i=0;i<700;i++){
    outbox=await(await stub.fetch('https://state.local/intake/notifications')).json();
    if(outbox.notifications.length===2&&outbox.notifications.every(x=>x.status==='sent'))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  check('actual alarm retried old pending and delivered new item',outbox.notifications.length===2&&outbox.notifications.every(x=>x.status==='sent')&&deliveries===3);
  check('acknowledgements persisted',outbox.notifications.every(x=>Number(x.message_id)>=102));
  const denied=await(await mf.getWorker('studio')).fetch('https://studio.test/booking',{method:'POST',body:JSON.stringify(booking)});
  check('default entrypoint refuses private path',denied.status===401);
  writeFileSync(path.join(root,'work/intake-workerd-result.json'),JSON.stringify({ok:true,checks,deliveries,realTelegram:false,at:new Date().toISOString()},null,2));
  console.log(JSON.stringify({ok:true,checks:checks.length,deliveries,realTelegram:false}));
}finally{releaseFirst();await mf.dispose();}
