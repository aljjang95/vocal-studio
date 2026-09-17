/** HLB Studio V2 — pure, legacy-compatible domain rules. No network or storage. */
export const DAYS = ['월','화','수','목','금','토','일'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const copy=v=>JSON.parse(JSON.stringify(v));
const DAY=86400000;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
function stable(v){return Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;}
function fail(message){throw new Error(message);}
function dateValue(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))fail('날짜를 정확하게 선택해 주세요.');
 const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)fail('존재하지 않는 날짜입니다.');return d;
}
export function today(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function addDays(s,n){return new Date(+dateValue(s)+n*DAY).toISOString().slice(0,10);}
export function monday(s){const d=dateValue(s);return addDays(s,-((d.getUTCDay()+6)%7));}
export function weekKey(s){const d=dateValue(monday(s)),y=d.getUTCFullYear(),first=new Date(Date.UTC(y,0,1));return y+'-W'+String(Math.ceil(((d-first)/DAY+first.getUTCDay()+1)/7)).padStart(2,'0');}
export function minutes(t){if(typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))fail('시간은 00:00~23:59 형식으로 입력해 주세요.');return +t.slice(0,2)*60 + +t.slice(3);}
export function formatPhone(value){
 let n=String(value||'').replace(/[\s()+.-]/g,'');if(n.startsWith('82'))n='0'+n.slice(2);if(!/^0\d{8,10}$/.test(n))fail('연락처를 정확하게 입력해 주세요.');
 return n.startsWith('02')?n.replace(/^(02)(\d{3,4})(\d{4})$/,'$1-$2-$3'):n.replace(/^(\d{3})(\d{3,4})(\d{4})$/,'$1-$2-$3');
}
function text(v,max=3000){return String(v??'').trim().slice(0,max);}
function duration(v,fallback=50){const n=v==null||v===''?fallback:Number(v);if(!Number.isInteger(n)||n<5||n>240)fail('소요 시간은 5~240분으로 입력해 주세요.');return n;}
function slotInput(p){dateValue(p.date);const start=minutes(p.time),len=duration(p.duration);if(start+len>1440)fail('일정은 같은 날짜 안에서 끝나야 합니다.');return {date:p.date,day:DAYS[(dateValue(p.date).getUTCDay()+6)%7],time:p.time,duration:len,absent:false};}
function id(v){if(!['string','number'].includes(typeof v)||!String(v)||String(v).length>160)fail('항목을 다시 선택해 주세요.');return v;}
function find(list,key){const row=list.find(x=>String(x.id)===String(key));if(!row)fail('원본 항목을 찾지 못했습니다. 최신 내용을 다시 확인해 주세요.');return row;}
function validateState(s){for(const k of ['students','logs','consults','payments','inquiries'])if(s[k]!=null&&!Array.isArray(s[k]))fail('데이터 형식을 확인해야 합니다: '+k);if(s.weekOvr!=null&&(typeof s.weekOvr!=='object'||Array.isArray(s.weekOvr)))fail('주간 일정 형식을 확인해야 합니다.');}
function rows(s,k){return Array.isArray(s[k])?s[k]:[];}
function ruleSlots(student,date){
 const histories=student.v2FixedRules||[];
 const matching=histories.filter(r=>r.start<=date&&(!r.end||date<=r.end)).sort((a,b)=>a.start.localeCompare(b.start));
 if(matching.length)return matching.at(-1).slots||[];
 if(histories.length){const first=histories.map(r=>r.start).sort()[0];if(date>=first)return [];}
 const base=student.v2PreviousSchedule||student;
 return base.schedType==='flex'?[]:(base.days||[]).map(day=>({day,time:base.times?.[day]||'10:00',duration:base.duration||student.duration||50}));
}
function studentWeek(student,state,mon){
 const wk=state.weekOvr?.[weekKey(mon)]||{};
 if(own(wk,student.id)){if(!Array.isArray(wk[student.id]))return [];return copy(wk[student.id]);}
 return DAYS.flatMap((day,i)=>ruleSlots(student,addDays(mon,i)).filter(s=>s.day===day).map(copy));
}
export function eventsForWeek(state,date){
 const mon=monday(date),end=addDays(mon,6),out=[],seen=new Set();
 function add(row,kind,slot,idx=0,completed=false){
  try{
   const day=slot.day||DAYS[(dateValue(slot.date).getUTCDay()+6)%7];if(!DAYS.includes(day))return;
   const d=slot.date||addDays(mon,DAYS.indexOf(day));dateValue(d);if(d<mon||d>end||(row.st&&d<row.st))return;
   const time=slot.time;if(!time)return;minutes(time);
   const len=duration(slot.duration??row.duration,kind==='lesson'?50:30);
   const key=JSON.stringify([kind,row.id,d,time,idx]);if(seen.has(key))return;seen.add(key);
   out.push({key,ownerId:row.id,kind,date:d,day,time,duration:len,name:row.name||row.phone||row.ph||'이름 미등록',phone:row.phone||row.ph||'',scheduleType:kind==='lesson'?(own(state.weekOvr?.[weekKey(mon)]||{},row.id)?'flex':'fixed'):'consult',cancelled:!!slot.absent||slot.kind==='cancel'||!!slot.cancelled,completed,room:slot.room||row.room||'studio',groupId:row.groupId||row.consultData?.groupId||'',source:slot});
  }catch{/* A malformed inherited slot is retained in state, not fabricated on the calendar. */}
 }
 for(const s of rows(state,'students'))if(s.status==='수강중')studentWeek(s,state,mon).forEach((x,i)=>add(s,'lesson',x,i));
 for(const c of rows(state,'consults')){
  if(c.hold||(c.converted&&!c.v2Completed))continue;
  const ds=c.confirmedDates?.length?c.confirmedDates:c.firstDate?[{date:c.firstDate,time:c.firstTime||c.time||'10:00'}]:[];
  ds.forEach((x,i)=>add(c,'consult',x,i,!!c.v2Completed));
 }
 for(const q of rows(state,'inquiries'))if(q.visitDate&&q.visitTime&&!q.consultId&&!q.v2Cancelled&&!rows(state,'consults').some(c=>c._inquiryId===q.id))add(q,'inquiry',{date:q.visitDate,time:q.visitTime,duration:q.duration||30});
 return out.sort((a,b)=>a.date.localeCompare(b.date)||minutes(a.time)-minutes(b.time)||String(a.ownerId).localeCompare(String(b.ownerId)));
}
function conflictPairs(events){
 const active=events.filter(e=>!e.cancelled&&!e.completed),result=[];
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j];if(a.date!==b.date||a.room!==b.room||(a.groupId&&a.groupId===b.groupId&&a.ownerId!==b.ownerId))continue;
  if(minutes(a.time)<minutes(b.time)+b.duration&&minutes(b.time)<minutes(a.time)+a.duration)result.push({signature:[a.key,b.key].sort().join('|')+'|'+a.duration+'|'+b.duration,a,b});
 }
 return result;
}
function witnessWeeks(states){
 const weeks=new Set();function add(d){try{const w=monday(d);weeks.add(w);weeks.add(addDays(w,7));}catch{}}
 add(today());
 for(const s of states){
  for(const row of rows(s,'students')){add(row.st);for(const r of row.v2FixedRules||[]){add(r.start);add(r.end);}}
  for(const q of rows(s,'inquiries'))add(q.visitDate);
  for(const c of rows(s,'consults')){add(c.firstDate);for(const x of c.confirmedDates||[])add(x.date);}
  for(const key of Object.keys(s.weekOvr||{})){
   const y=Number(key.slice(0,4));if(!Number.isInteger(y)||y<1900||y>2200)continue;
   let d=monday(`${y}-01-01`);for(let i=0;i<55;i++,d=addDays(d,7))if(weekKey(d)===key){add(d);break;}
  }
 }
 return [...weeks];
}
/** Check weekly-pattern boundaries and every explicit exception week; grandfather existing collisions. */
export function assertNoNewConflicts(before,after){
 validateState(after);
 if(equal([before.students,before.weekOvr,before.consults,before.inquiries],[after.students,after.weekOvr,after.consults,after.inquiries]))return;
 for(const mon of witnessWeeks([before,after])){
  const old=new Set(conflictPairs(eventsForWeek(before,mon)).map(c=>c.signature));
  const added=conflictPairs(eventsForWeek(after,mon)).find(c=>!old.has(c.signature));
  if(added)fail(`${added.a.date} ${added.a.time} 일정이 ${added.b.name}님의 ${added.b.time} 일정과 겹칩니다.`);
 }
}
function putOverride(state,student,mon,slots){state.weekOvr[weekKey(mon)]??={};Object.defineProperty(state.weekOvr[weekKey(mon)],student.id,{value:slots,writable:true,enumerable:true,configurable:true});}
function eventFromKey(state,key){let parts;try{parts=JSON.parse(key);}catch{fail('일정을 다시 선택해 주세요.');}const event=eventsForWeek(state,parts[2]).find(e=>e.key===key);if(!event)fail('다른 기기에서 일정이 변경됐습니다. 다시 확인해 주세요.');return event;}
function removeEvent(state,event){
 if(event.kind==='lesson'){
  const s=find(state.students,event.ownerId),mon=monday(event.date),slots=studentWeek(s,state,mon);
  const idx=slots.findIndex(x=>x.day===event.day&&x.time===event.time&&!x.absent);if(idx<0)fail('변경된 일정입니다. 다시 확인해 주세요.');
  slots[idx]={...slots[idx],absent:true,kind:'cancel'};putOverride(state,s,mon,slots);
 }else if(event.kind==='inquiry'){const q=find(state.inquiries,event.ownerId);q.v2Cancelled=true;}
 else {const c=find(state.consults,event.ownerId);c.confirmedDates=(c.confirmedDates?.length?c.confirmedDates:[{date:c.firstDate,time:c.firstTime||c.time||'10:00'}]).map(x=>x.date===event.date&&x.time===event.time?{...x,cancelled:true}:x);}
}
export function applyAction(original,action){
 validateState(original);const s=copy(original),p=action.payload||{};
 for(const k of ['students','logs','consults','payments','inquiries'])s[k]??=[];s.weekOvr??={};
 switch(action.type){
 case 'inquiry.save':{
  const phone=formatPhone(p.phone),existing=s.inquiries.find(x=>x.id===p.id);
  const q={...existing,id:id(p.id),name:text(p.name,100)||phone,phone,memo:text(p.memo),source:text(p.source||'phone',30),date:existing?.date||today()};
  if(existing)Object.assign(existing,q);else s.inquiries.unshift(q);break;
 }
 case 'inquiry.book':{const q=find(s.inquiries,p.id),slot=slotInput(p);if(q.consultId)fail('이미 상담으로 전환된 문의입니다. 상담 일정을 선택해 주세요.');Object.assign(q,{visitDate:slot.date,visitTime:slot.time,duration:slot.duration,v2Cancelled:false});break;}
 case 'application.save':{
  if(p.confirmed!==true||!text(p.name)||!text(p.goal))fail('이름, 상담 목표를 입력하고 신청서 확인에 체크해 주세요.');
  const phone=formatPhone(p.phone),q=p.inquiryId?find(s.inquiries,p.inquiryId):null;
  if(q?.consultId&&!s.consults.some(c=>c.id===p.id))fail('이미 작성된 신청서가 있습니다. 중복 등록하지 않습니다.');
  const existing=s.consults.find(c=>c.id===p.id);
  const c={...existing,id:id(p.id),name:text(p.name,100),phone,cls:text(p.course,60),date:existing?.date||today(),goal:text(p.goal),experience:text(p.experience),memo:text(p.notes),v2Completed:true,applicationVersion:2,confirmed:true,_inquiryId:q?.id||existing?._inquiryId||'',confirmedDates:existing?.confirmedDates||(q?.visitDate?[{date:q.visitDate,time:q.visitTime,duration:q.duration||30}]:[])};
  if(existing)Object.assign(existing,c);else s.consults.unshift(c);if(q)q.consultId=c.id;break;
 }
 case 'student.create':{
  id(p.id);const phone=formatPhone(p.phone);if(!text(p.name))fail('고객 이름을 입력해 주세요.');
  if(s.students.some(x=>x.id===p.id||String(x.ph||x.phone||'').replace(/\D/g,'')===phone.replace(/\D/g,'')))fail('같은 연락처의 고객이 있습니다. 기존 고객을 선택해 주세요.');
  s.students.push({id:p.id,name:text(p.name,100),ph:phone,cls:text(p.course||'hob',60),status:'수강중',schedType:'flex',days:[],times:{},st:today(),fee:0});break;
 }
 case 'schedule.once':{
  const row=find(s.students,p.studentId),slot=slotInput(p);if(row.status!=='수강중')fail('수강중 고객만 일정을 등록할 수 있습니다.');if(row.st&&slot.date<row.st)fail('수강 시작일 이전에는 일정을 등록할 수 없습니다.');
  const mon=monday(slot.date),slots=studentWeek(row,s,mon);slots.push({...slot,kind:'one-off'});putOverride(s,row,mon,slots);break;
 }
 case 'schedule.fixed':{
  const row=find(s.students,p.studentId);if(row.status!=='수강중')fail('수강중 고객만 고정 일정을 등록할 수 있습니다.');dateValue(p.start);dateValue(p.end);minutes(p.time);const len=duration(p.duration);
  if(p.start>p.end||(+dateValue(p.end)-dateValue(p.start))/DAY>731)fail('고정 일정 기간은 시작일 이후, 2년 이내로 선택해 주세요.');
  if(row.st&&p.start<row.st)fail('수강 시작일 이전에는 고정 일정을 등록할 수 없습니다.');
  if(!Array.isArray(p.days)||!p.days.length||new Set(p.days).size!==p.days.length||p.days.some(d=>!DAYS.includes(d)))fail('반복 요일을 정확히 선택해 주세요.');
  if(minutes(p.time)+len>1440)fail('일정은 같은 날짜 안에서 끝나야 합니다.');
  if(!row.v2PreviousSchedule)row.v2PreviousSchedule={schedType:row.schedType,days:copy(row.days||[]),times:copy(row.times||{}),duration:row.duration||50};
  const rules=row.v2FixedRules||[];if(rules.some(r=>r.start>p.start))fail('이후 고정 일정이 이미 있습니다. 기간을 확인해 주세요.');
  row.v2FixedRules=rules.filter(r=>r.start<p.start).map(r=>({...r,end:!r.end||r.end>=p.start?addDays(p.start,-1):r.end}));
  row.v2FixedRules.push({start:p.start,end:p.end,slots:p.days.map(day=>({day,time:p.time,duration:len}))});
  row.schedType='fixed';row.days=copy(p.days);row.times=Object.fromEntries(p.days.map(d=>[d,p.time]));row.duration=len;break;
 }
 case 'schedule.cancel':{const e=eventFromKey(s,p.eventKey);if(e.completed||e.cancelled)fail('완료 또는 취소된 일정입니다.');removeEvent(s,e);break;}
 case 'schedule.move':{
  const e=eventFromKey(s,p.eventKey),slot=slotInput(p);if(e.completed||e.cancelled)fail('완료 또는 취소된 일정은 이동할 수 없습니다.');removeEvent(s,e);
  if(e.kind==='lesson'){const row=find(s.students,e.ownerId),mon=monday(slot.date);if(row.st&&slot.date<row.st)fail('수강 시작일 이전으로 옮길 수 없습니다.');const slots=studentWeek(row,s,mon);slots.push({...slot,kind:'move',makeupOf:e.key});putOverride(s,row,mon,slots);}
  else if(e.kind==='inquiry')Object.assign(find(s.inquiries,e.ownerId),{visitDate:slot.date,visitTime:slot.time,duration:slot.duration,v2Cancelled:false});
  else find(s.consults,e.ownerId).confirmedDates.push(slot);break;
 }
 case 'payment.add':{
  const row=find(s.students,p.studentId),amount=Number(p.amount);id(p.id);dateValue(p.date);if(!Number.isSafeInteger(amount)||amount<=0)fail('입금액은 0보다 큰 정수로 입력해 주세요.');
  if(s.payments.some(x=>x.id===p.id))fail('이미 저장한 입금 기록입니다.');s.payments.unshift({id:p.id,sid:row.id,studentId:row.id,name:row.name,amount,date:p.date,memo:text(p.memo)});break;
 }
 default:fail('지원하지 않는 작업입니다.');
 }
 assertNoNewConflicts(original,s);return s;
}
