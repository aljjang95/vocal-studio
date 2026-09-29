import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { StudioState } from '../worker/state.mjs';
import worker from '../worker/index.mjs';
import { normalizeIntake, deliverTelegram } from '../worker/intake.mjs';
const input=(changes={})=>({submissionId:crypto.randomUUID(),clientKey:'a'.repeat(64),booking:{name:'합성 QA',phone:'010-0000-1234',gender:'female',goal:'보컬 기초',preferredDay:'평일 저녁',...changes}});
function fixture(t,env={}) {
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  let tail=Promise.resolve();
  const control={fail:'',alarm:null,failAlarm:false};
  const ctx={storage:{sql:{exec(query,...params){
    if(control.fail&&query.startsWith(control.fail)){control.fail='';throw Error('synthetic private failure');}
    const rows=db.prepare(query).all(...params);return {toArray:()=>rows};
  }},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},
  async getAlarm(){return control.alarm;},async setAlarm(at){if(control.failAlarm)throw Error('alarm-unavailable');control.alarm=at;}},
  blockConcurrencyWhile(fn){const r=tail.then(fn);tail=r.catch(()=>{});return r;},getWebSockets(){return [];}};
  const state=new StudioState(ctx,env);
  const api=(path,body)=>state.fetch(new Request('https://studio.internal'+path,{method:body===undefined?'GET':'POST',headers:{'X-VS-Principal':'synthetic'},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {db,state,api,control,async activate(data={}){await api('/import',{state:{students:[],inquiries:[],consults:[],unknown:{retain:true},...data}});const r=await(await api('/export')).json();await api('/activate',{hash:r.hash});}};
}
test('required gender/contact/UUID and hostile authority fields rejected',()=>{
  for(const changes of [{gender:''},{phone:'x01012345678'},{name:' '},{memo:'x'.repeat(501)},{visitDate:'2026-10-01'},{status:'등록 완료'},{name:'x\u0000y'}])assert.throws(()=>normalizeIntake(input(changes)));
  const i=input();i.submissionId='constructor';assert.throws(()=>normalizeIntake(i));
});
test('atomic canonical inquiry and minimal receipt; no appointment inferred',async t=>{
  const f=fixture(t);await f.activate();const i=input(),r=await f.api('/booking',i),body=await r.json();
  assert.equal(r.status,201);assert.equal(body.data.id,i.submissionId);assert.equal(body.success,true);
  assert.ok(!JSON.stringify(body).includes(i.booking.phone));
  const s=(await(await f.api('/state')).json());assert.equal(s.revision,1);assert.deepEqual(s.state.unknown,{retain:true});
  const q=s.state.inquiries[0];assert.equal(q.gender,'여');assert.equal(q.phone,'01000001234');assert.equal(q.visitDate,'');assert.equal(q.visitTime,'');assert.match(q.memo,/평일 저녁/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM booking_outbox').get().n,1);assert.ok(f.control.alarm>Date.now()-100);
});
test('parallel duplicate and changed-payload retries cannot duplicate receipt or inquiry',async t=>{
  const f=fixture(t);await f.activate();const i=input();
  const rs=await Promise.all(Array.from({length:12},()=>f.api('/booking',i)));
  assert.equal(rs.filter(r=>r.status===201).length,1);assert.equal(rs.filter(r=>r.status===200).length,11);
  assert.equal(new Set(await Promise.all(rs.map(r=>r.text()))).size,1);
  assert.equal((await f.api('/booking',{...i,booking:{...i.booking,name:'different'}})).status,409);
  assert.equal((await(await f.api('/state')).json()).revision,1);
});
test('same phone preserves existing record and creates marked review inquiry',async t=>{
  const old={id:'existing',name:'원본',ph:'010-0000-1234',keep:true},f=fixture(t);await f.activate({students:[old]});
  await f.api('/booking',input());const s=(await(await f.api('/state')).json()).state;
  assert.deepEqual(s.students,[old]);assert.equal(s.inquiries[0].reviewRequired,true);assert.deepEqual(s.inquiries[0].relatedCustomer,{kind:'student',id:'existing'});
});
test('rate limit is transactional, replay works after limit without another charge',async t=>{
  const f=fixture(t);await f.activate();const first=input();await f.api('/booking',first);
  assert.equal((await f.api('/booking',input())).status,201);assert.equal((await f.api('/booking',input())).status,201);
  const rejected=await f.api('/booking',input());assert.equal(rejected.status,429);assert.ok(Number(rejected.headers.get('Retry-After'))>0);
  assert.equal((await f.api('/booking',first)).status,200);assert.equal((await(await f.api('/state')).json()).revision,3);
});
test('IP limit covers different phone numbers',async t=>{
  const f=fixture(t);await f.activate();
  for(let k=0;k<5;k++)assert.equal((await f.api('/booking',input({phone:'0100000123'+k}))).status,201);
  assert.equal((await f.api('/booking',input({phone:'01000001239'}))).status,429);
});
for(const fail of ['INSERT INTO booking_receipts','INSERT INTO booking_outbox','INSERT INTO booking_limits'])test('rollback all canonical and outbox changes on '+fail,async t=>{
  const f=fixture(t);await f.activate();f.control.fail=fail;const i=input();const r=await f.api('/booking',i);
  assert.equal(r.status,503);assert.ok(!(await r.text()).includes('synthetic private failure'));
  assert.equal((await(await f.api('/state')).json()).revision,0);
  assert.equal(f.db.prepare('SELECT count(*) n FROM booking_receipts').get().n,0);assert.equal(f.db.prepare('SELECT count(*) n FROM booking_outbox').get().n,0);
  assert.equal((await f.api('/booking',i)).status,201);
});
test('alarm failure prevents accepted but unwakeable notification',async t=>{
  const f=fixture(t);await f.activate();f.control.failAlarm=true;
  assert.equal((await f.api('/booking',input())).status,503);assert.equal((await(await f.api('/state')).json()).revision,0);
});
test('missing/staged or malformed schema does not accept customer data',async t=>{
  const f=fixture(t);assert.equal((await f.api('/booking',input())).status,503);
  await f.api('/import',{state:{students:[],inquiries:[]}});assert.equal((await f.api('/booking',input())).status,503);
  const g=fixture(t);await g.activate({inquiries:{}});assert.equal((await g.api('/booking',input())).status,503);
});
test('booking increments revision and rejects stale client commit',async t=>{
  const f=fixture(t);await f.activate();await f.api('/booking',input());
  assert.equal((await f.api('/commit',{baseRevision:0,requestId:'stale-write-123',state:{inquiries:[]}})).status,409);
  assert.equal((await(await f.api('/state')).json()).state.inquiries.length,1);
});
test('notification unavailable remains durable pending, with safe status and later alarm',async t=>{
  const f=fixture(t);await f.activate();await f.api('/booking',input());await f.state.alarm();
  const status=await(await f.api('/intake/notifications')).json();assert.equal(status.notifications[0].status,'pending');assert.equal(status.notifications[0].last_code,'notification-not-configured');
  assert.equal(status.notifications[0].attempts,1);assert.ok(f.control.alarm>Date.now()+3500000);assert.ok(!JSON.stringify(status).includes('01000001234'));
});
test('Telegram requires real acknowledgement and never exposes errors or markup options',async()=>{
  const env={BOOKING_NOTIFICATIONS_ENABLED:'true',BOOKING_TELEGRAM_TOKEN:'synthetic-only',BOOKING_TELEGRAM_CHAT_ID:'qa'};
  let sent;
  const ok=await deliverTelegram(env,input().booking,async(url,options)=>{sent=JSON.parse(options.body);return Response.json({ok:true,result:{message_id:23}});});
  assert.deepEqual(ok,{ok:true,messageId:'23'});assert.equal(sent.parse_mode,undefined);
  assert.equal((await deliverTelegram(env,{},async()=>Response.json({ok:false},{status:200}))).ok,false);
  assert.deepEqual(await deliverTelegram(env,{},async()=>{throw Error('contains secret');}),{ok:false,code:'telegram-delivery-unconfirmed'});
});
test('default public Worker never exposes internal booking entrypoint or state',async()=>{
  for(const path of ['/booking','/api/booking','/api/intake/notifications']){
    const r=await worker.fetch(new Request('https://hlb.tllhouse.com'+path,{method:'POST',body:'{}'}),{});assert.equal(r.status,401);
  }
});
const notifyEnv={BOOKING_NOTIFICATIONS_ENABLED:'true',BOOKING_TELEGRAM_TOKEN:'synthetic',BOOKING_TELEGRAM_CHAT_ID:'synthetic'};
test('slow notifications release canonical gate; concurrent alarm cannot claim live leases',async t=>{
  const f=fixture(t,notifyEnv);await f.activate();await f.api('/booking',input());await f.api('/booking',input({phone:'01000001235'}));
  const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;});
  let release,entered,count=0;
  const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  globalThis.fetch=async()=>{if(++count===2)entered();await held;return Response.json({ok:true,result:{message_id:count}});};
  const drain=f.state.alarm();await started;
  try{
    const read=await Promise.race([f.api('/state'),new Promise((_,reject)=>setTimeout(()=>reject(Error('canonical gate blocked by notification')),200))]);
    assert.equal(read.status,200);
    await f.state.alarm();assert.equal(count,2);
    const result=await f.api('/commit',{baseRevision:2,requestId:'live-edit-during-notify',state:{unknown:{edited:true}}});assert.equal(result.status,200);
  }finally{release();await drain;}
  assert.equal(f.db.prepare("SELECT count(*) n FROM booking_outbox WHERE status='sent'").get().n,2);
});
test('post-ACK SQL failure retains lease and wakeup; expired lease retries safely',async t=>{
  const f=fixture(t,notifyEnv);await f.activate();await f.api('/booking',input());
  const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;});let count=0;
  globalThis.fetch=async()=>Response.json({ok:true,result:{message_id:++count}});
  f.control.fail="UPDATE booking_outbox SET status='sent'";await assert.rejects(f.state.alarm());
  const row=f.db.prepare('SELECT * FROM booking_outbox').get();assert.equal(row.status,'sending');assert.ok(row.lease_token);assert.ok(f.control.alarm>=row.lease_until);
  f.db.exec('UPDATE booking_outbox SET lease_until=0');await f.state.alarm();
  assert.equal(f.db.prepare('SELECT status FROM booking_outbox').get().status,'sent');assert.equal(count,2);
});
test('a stale result cannot overwrite a recovered lease acknowledgement',async t=>{
  const f=fixture(t,notifyEnv);await f.activate();await f.api('/booking',input());
  const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old;});let release,entered,count=0;
  const held=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  globalThis.fetch=async()=>{const n=++count;if(n===1){entered();await held;}return Response.json({ok:true,result:{message_id:n}});};
  const first=f.state.alarm();await started;
  f.db.exec('UPDATE booking_outbox SET lease_until=0');await f.state.alarm();
  release();await first;
  assert.equal(f.db.prepare('SELECT message_id FROM booking_outbox').get().message_id,'2');
});
