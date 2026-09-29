// Private service boundary: never exposes arbitrary state reads or writes.
const FIELDS = new Set(['name','phone','gender','ageGroup','goal','experience','preferredDay','memo']);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const intakeJSON = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...headers },
});
export const intakeError = (code, status, message = '접수하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.') => intakeJSON({success:false,code,message},status);
function text(value,max,required=false) {
  if(value===undefined&&!required)return '';
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('invalid-field');
  const clean=value.replace(/\s+/g,' ').trim();
  if(required&&!clean)throw Error('required-field');
  return clean;
}
export function normalizeIntake(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)||!ID.test(input.submissionId||'')||!/^[a-f0-9]{64}$/.test(input.clientKey||''))throw Error('invalid-submission');
  const raw=input.booking;
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!FIELDS.has(k)))throw Error('invalid-booking');
  const phone=text(raw.phone,30,true).replace(/[\s()-]/g,'');
  if(!/^0\d{8,10}$/.test(phone)||!['male','female'].includes(raw.gender))throw Error('invalid-contact');
  return {submissionId:input.submissionId.toLowerCase(),clientKey:input.clientKey,booking:{
    name:text(raw.name,80,true),phone,gender:raw.gender,ageGroup:text(raw.ageGroup,40),goal:text(raw.goal,120),
    experience:text(raw.experience,120),preferredDay:text(raw.preferredDay,120),memo:text(raw.memo,500),
  }};
}
export async function intakeHash(value) {
  const bytes=new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function makeInquiry(booking,id,state,now) {
  for(const key of ['inquiries','consults','students'])if(state[key]!==undefined&&!Array.isArray(state[key]))throw Error('invalid-studio-schema');
  const digits=value=>String(value||'').replace(/\D/g,'');
  const match=[
    ...(state.inquiries||[]).map(x=>({kind:'inquiry',id:x.id,phone:x.phone})),
    ...(state.consults||[]).map(x=>({kind:'consult',id:x.id,phone:x.phone??x.ph})),
    ...(state.students||[]).map(x=>({kind:'student',id:x.id,phone:x.ph??x.phone})),
  ].find(x=>digits(x.phone)===booking.phone);
  const gender=booking.gender==='male'?'남':'여';
  return {id:`web_${id}`,sourceBookingId:id,name:booking.name,phone:booking.phone,gender,channel:'web',status:'문의',
    date:new Date(now+9*3600000).toISOString().slice(0,10),createdAt:now,
    // A preferred time band cannot become a confirmed appointment.
    visitDate:'',visitTime:'',reviewRequired:!!match,...(match?{relatedCustomer:{kind:match.kind,id:match.id}}:{}),
    memo:[match&&'기존 연락처 확인 필요',`성별: ${gender}`,booking.ageGroup&&`연령대: ${booking.ageGroup}`,booking.goal&&`목표: ${booking.goal}`,booking.experience&&`경험: ${booking.experience}`,booking.preferredDay&&`희망: ${booking.preferredDay}`,booking.memo].filter(Boolean).join(' · '),
  };
}
export function initIntakeTables(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS booking_receipts (id TEXT PRIMARY KEY,payload_sha TEXT NOT NULL,response_json TEXT NOT NULL,created_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS booking_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS booking_outbox (id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,last_code TEXT,message_id TEXT,updated_at INTEGER NOT NULL,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0)');
  sql.exec('CREATE INDEX IF NOT EXISTS booking_outbox_pending ON booking_outbox(status,next_at)');
}
export async function acceptIntake(owner,input) {
  let normalized;
  try{normalized=normalizeIntake(input);}catch{return intakeError('INVALID_BOOKING',400);}
  const {submissionId,clientKey,booking}=normalized,payloadSha=await intakeHash(booking);
  const prior=owner.sql.exec('SELECT payload_sha,response_json FROM booking_receipts WHERE id=?',submissionId).toArray()[0];
  if(prior)return prior.payload_sha===payloadSha
    ?new Response(prior.response_json,{status:200,headers:{'content-type':'application/json','cache-control':'no-store','X-VS-Idempotent-Replay':'1'}})
    :intakeError('IDEMPOTENCY_CONFLICT',409,'동일 접수 번호의 내용이 변경되었습니다. 새 신청으로 다시 시도해주세요.');
  const record=owner.record();
  if(!record||record.mode!=='active'||!Number.isSafeInteger(record.revision)||record.revision>=Number.MAX_SAFE_INTEGER)return intakeError('STUDIO_UNAVAILABLE',503,'접수 연결을 확인 중입니다. 잠시 뒤 다시 시도해주세요.');
  const now=Date.now();let inquiry;
  try{inquiry=makeInquiry(booking,submissionId,record.state,now);}catch{return intakeError('STUDIO_UNAVAILABLE',503);}
  const phoneKey=await intakeHash(booking.phone),window=Math.floor(now/600000),day=Math.floor((now+9*3600000)/86400000);
  const limits=[
    {key:`ip:${window}:${clientKey}`,max:5,expires:(window+1)*600000},
    {key:`phone:${day}:${phoneKey}`,max:3,expires:(day+1)*86400000-9*3600000},
    {key:`global:${day}`,max:100,expires:(day+1)*86400000-9*3600000},
  ];
  for(const limit of limits){
    const count=owner.sql.exec('SELECT count FROM booking_limits WHERE key=?',limit.key).toArray()[0]?.count||0;
    if(count>=limit.max)return intakeJSON({success:false,code:'RATE_LIMITED',message:'신청이 여러 번 접수됐습니다. 잠시 뒤 다시 시도하거나 전화로 문의해주세요.'},429,{'Retry-After':String(Math.max(1,Math.ceil((limit.expires-now)/1000)))});
  }
  const next={...record,revision:record.revision+1,state:{...record.state,inquiries:[inquiry,...(record.state.inquiries||[])]}};
  const response=JSON.stringify({success:true,data:{id:submissionId},message:'신청서가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.'});
  // A durable wakeup must exist before committing the outbox. An empty wakeup is harmless.
  const alarm=await owner.ctx.storage.getAlarm();
  if(alarm===null||alarm>now+1000)await owner.ctx.storage.setAlarm(now+1000);
  owner.ctx.storage.transactionSync(()=>{
    owner.setKV('record',next);
    owner.sql.exec('INSERT INTO booking_receipts(id,payload_sha,response_json,created_at) VALUES(?,?,?,?)',submissionId,payloadSha,response,now);
    owner.sql.exec('INSERT INTO booking_outbox(id,payload_json,status,next_at,updated_at) VALUES(?,?,?,?,?)',submissionId,JSON.stringify({...booking,submissionId,createdAt:now}),'pending',now,now);
    for(const limit of limits)owner.sql.exec('INSERT INTO booking_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',limit.key,limit.expires);
    owner.sql.exec('DELETE FROM booking_limits WHERE expires_at<=?',now);
  });
  owner.broadcast(next);
  return new Response(response,{status:201,headers:{'content-type':'application/json','cache-control':'no-store'}});
}
export async function deliverTelegram(env,booking,fetcher=fetch) {
  if(env.BOOKING_NOTIFICATIONS_ENABLED!=='true'||!env.BOOKING_TELEGRAM_TOKEN||!env.BOOKING_TELEGRAM_CHAT_ID)return {ok:false,code:'notification-not-configured'};
  // No parse_mode: applicant strings are untrusted text, never markup.
  const text=`🔔 [HLB 보컬스튜디오] 1:1 정밀 진단 신청 접수!

👤 이름: ${booking.name}
📞 연락처: ${booking.phone}
🌿 성별: ${booking.gender==='male'?'남':'여'}
🎯 목표 트랙: ${booking.goal||'상담 후 결정'}
⏳ 연령대: ${booking.ageGroup||'미입력'} | 가창 경력: ${booking.experience||'미입력'}
📅 희망 시간: ${booking.preferredDay||'일정 상의 후 조율'}
📝 상담 메모: ${booking.memo||'없음'}${Number.isSafeInteger(booking.createdAt)?`\n⏰ 신청 일시: ${new Date(booking.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`:''}

👉 원장님, 관리 화면에서 신청 내용을 확인해주세요.
https://hlb.tllhouse.com/

💬 신청 내용을 확인하신 뒤 상담 일정을 안내해주세요.
접수번호: ${booking.submissionId}`;
  try{
    const response=await fetcher(`https://api.telegram.org/bot${env.BOOKING_TELEGRAM_TOKEN}/sendMessage`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({chat_id:env.BOOKING_TELEGRAM_CHAT_ID,text,disable_web_page_preview:true}),signal:AbortSignal.timeout(8000),
    });
    const result=await response.json().catch(()=>null);
    if(response.ok&&result?.ok===true&&Number.isSafeInteger(result?.result?.message_id))return {ok:true,messageId:String(result.result.message_id)};
    return {ok:false,code:`telegram-http-${response.status}`};
  }catch{return {ok:false,code:'telegram-delivery-unconfirmed'};}
}
async function scheduleOutbox(owner) {
  const next=owner.sql.exec("SELECT MIN(CASE WHEN status='sending' THEN lease_until ELSE next_at END) AS at FROM booking_outbox WHERE status IN ('pending','sending')").toArray()[0]?.at;
  if(next!=null)await owner.ctx.storage.setAlarm(Math.max(Date.now()+1000,next));
}
export async function drainIntakeOutbox(owner) {
  const token=crypto.randomUUID();
  // Serialize only the local claim. External I/O must never lock canonical reads or commits.
  const due=await owner.ctx.blockConcurrencyWhile(async()=>{
    const now=Date.now(),leaseUntil=now+60000;
    const rows=owner.sql.exec("SELECT id,payload_json,attempts FROM booking_outbox WHERE (status='pending' AND next_at<=?) OR (status='sending' AND lease_until<=?) ORDER BY next_at LIMIT 2",now,now).toArray();
    if(rows.length){
      // Durable lease recovery wakeup precedes every claim, including after a runtime restart.
      await owner.ctx.storage.setAlarm(leaseUntil);
      owner.ctx.storage.transactionSync(()=>{
        for(const row of rows)owner.sql.exec("UPDATE booking_outbox SET status='sending',lease_token=?,lease_until=? WHERE id=?",token,leaseUntil,row.id);
      });
    }
    await scheduleOutbox(owner);
    return rows;
  });
  try{
    const settled=await Promise.allSettled(due.map(async row=>{
      const result=await deliverTelegram(owner.env,JSON.parse(row.payload_json));
      await owner.ctx.blockConcurrencyWhile(async()=>{
        if(result.ok)owner.sql.exec("UPDATE booking_outbox SET status='sent',payload_json='{}',attempts=attempts+1,message_id=?,last_code=NULL,updated_at=?,lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?",result.messageId,Date.now(),row.id,token);
        else{
          const delay=result.code==='notification-not-configured'?3600000:Math.min(3600000,60000*2**Math.min(row.attempts,6));
          owner.sql.exec("UPDATE booking_outbox SET status='pending',attempts=attempts+1,next_at=?,last_code=?,updated_at=?,lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?",Date.now()+delay,result.code,Date.now(),row.id,token);
        }
        await scheduleOutbox(owner);
      });
    }));
    if(settled.some(x=>x.status==='rejected'))throw Error('notification-settlement-pending');
  }finally{
    await owner.ctx.blockConcurrencyWhile(()=>scheduleOutbox(owner));
  }
  // Telegram is at-least-once. A lost ACK or lease recovery may repeat the labelled receipt.
}
export function notificationStatus(owner) {
  return intakeJSON({ok:true,notifications:owner.sql.exec('SELECT id,status,attempts,last_code,message_id,updated_at FROM booking_outbox ORDER BY updated_at DESC LIMIT 100').toArray()});
}
