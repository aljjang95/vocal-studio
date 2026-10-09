// Generated from index.html by build-schedule-core.mjs. Do not hand edit.
export function scheduleSnapshot(state,date){
var students=state.students||[],consults=state.consults||[],inquiries=state.inquiries||[],weekOvr=state.weekOvr||{};
var ALL7=['월','화','수','목','금','토','일'];
function parseDateLocal(s){return new Date(s+'T00:00:00');}
function toDS(d){var y=d.getFullYear(),m=d.getMonth()+1,dd=d.getDate();return y+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd;}
function getMon(d){var x=new Date(d);var dw=x.getDay();x.setDate(x.getDate()-(dw===0?6:dw-1));x.setHours(0,0,0,0);return x;}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
function getWK(m){var y=m.getFullYear();var s=new Date(y,0,1);var w=Math.ceil(((m-s)/864e5+s.getDay()+1)/7);return y+'-W'+(w<10?'0':'')+w;}
function getViewMon(){return getMon(parseDateLocal(date));}
function consultDateEntries(c){
  var list=(c&&Array.isArray(c.confirmedDates))?c.confirmedDates.slice():[];
  /* An explicit empty list means cleared; only legacy records omit the list. */
  if(c&&!Array.isArray(c.confirmedDates)&&c.firstDate){
    list.push({date:c.firstDate,time:c.firstTime||c.time||'10:00'});
  }
  var seen={};
  return list.filter(function(cd){
    var key=(cd&&cd.date||'')+'_'+(cd&&cd.time||'');
    if(!cd||!cd.date||seen[key])return false;
    seen[key]=true;return true;
  });
}
var SCHEDULE_ENGINE_VERSION='schedule-v2-2026-06-18';
function _scheduleClean(v){return (v==null?'':String(v)).trim();}
function _scheduleMemberId(owner,m,idx){
  var raw=(m&&(m.memberId||m.id||m.sid||m.phone||m.name))||'';
  raw=_scheduleClean(raw);
  if(raw)return raw.replace(/[^0-9A-Za-z가-힣_-]+/g,'_').replace(/^_+|_+$/g,'')||('m'+idx);
  return ((owner&&owner.id)||'group')+'__m'+idx;
}
function scheduleIsGroup(obj){
  var cd=obj&&obj.consultData;
  return !!(obj&&(obj.lessonType==='group'||obj.sharedSlot||obj.groupId||(Array.isArray(obj.groupMembers)&&obj.groupMembers.length>1)||
    (cd&&(cd.lessonType==='group'||cd.sharedSlot||cd.groupId||(Array.isArray(cd.groupMembers)&&cd.groupMembers.length>1)))));
}
function scheduleGroupId(obj){
  if(!obj)return '';
  var cd=obj.consultData||{};
  return obj.groupId||obj.scheduleGroupId||cd.groupId||cd.scheduleGroupId||(scheduleIsGroup(obj)?('grp_'+obj.id):'');
}
function scheduleMembersOf(obj){
  if(!obj)return [];
  var src=(obj.consultData&&obj.consultData.lessonType==='group'&&!Array.isArray(obj.groupMembers))?obj.consultData:obj;
  var arr=Array.isArray(src.groupMembers)?src.groupMembers.slice():[];
  var firstName=_scheduleClean(obj.name||src.name);
  if(firstName.indexOf('/')>=0)firstName=_scheduleClean(firstName.split('/')[0]);
  var primary={memberId:(src.primaryMemberId||src.primaryPayerId||obj.id),id:(src.primaryMemberId||src.primaryPayerId||obj.id),sid:obj.id,name:firstName,phone:obj.ph||obj.phone||src.phone||'',gd:obj.gd||src.gd||'',age:obj.age||src.age||'',job:obj.job||src.job||'',primary:true,payer:true};
  if(!arr.length||!arr.some(function(m){return _scheduleClean(m&&m.name)===firstName||_scheduleClean(m&&m.id)===_scheduleClean(obj.id);})){
    arr.unshift(primary);
  }
  var seen={},out=[];
  arr.forEach(function(m,idx){
    m=m||{};
    var nm=_scheduleClean(m.name||(idx===0?firstName:''));
    var id=_scheduleMemberId(obj,m,idx+1);
    if(seen[id])return;
    seen[id]=true;
    out.push({memberId:id,id:id,sid:m.sid||m.studentId||(idx===0?obj.id:''),name:nm||('멤버 '+(idx+1)),phone:m.phone||m.ph||'',gd:m.gd||'',age:m.age||'',job:m.job||'',primary:idx===0,payer:idx===0});
  });
  return out;
}
function schedulePrimaryPayerId(obj){
  var cd=obj&&obj.consultData||{};
  var members=scheduleMembersOf(obj);
  return (obj&&(obj.primaryPayerId||obj.groupPrimaryPayerId))||cd.primaryPayerId||cd.groupPrimaryPayerId||(members[0]&&members[0].memberId)||(obj&&obj.id)||'';
}
function normalizeScheduleGroupEnrollment(obj,source){
  obj=obj||{};source=source||obj.consultData||{};
  var merged=Object.assign({},source,obj);
  var members=scheduleMembersOf(merged);
  var isGroup=scheduleIsGroup(merged)||members.length>1;
  var groupId=merged.groupId||merged.scheduleGroupId||(isGroup?('grp_'+(obj.id||source.id||uid())):'');
  return {lessonType:isGroup?'group':'solo',groupId:groupId,primaryPayerId:schedulePrimaryPayerId(merged),sharedSlot:isGroup,groupMembers:isGroup?members.map(function(m){return {memberId:m.memberId,id:m.id,sid:m.sid,name:m.name,phone:m.phone,gd:m.gd,age:m.age,job:m.job,primary:!!m.primary,payer:!!m.payer};}):[]};
}
function _scheduleSlotId(kind,id,date,time,idx){return [kind,id,date,time,idx||0].join('__').replace(/\s+/g,'_');}
function _scheduleWeekDate(mon,day){
  var idx=ALL7.indexOf(day);
  return idx>=0?toDS(addDays(mon,idx)):'';
}
function _scheduleStudentSlots(s,wk,ov){
  if(s.id in ov)return ov[s.id]||[];
  return _scheduleStudentBaseSlots(s,wk);
}
function _scheduleStudentConfirmedDates(s){
  var linked=s.consultData&&consults.find(function(c){return c.id===s.consultData.id&&c.converted;});
  if(linked)return consultDateEntries(linked);
  if(Array.isArray(s.confirmedDates))return consultDateEntries({confirmedDates:s.confirmedDates});
  return s.consultData?consultDateEntries(s.consultData):[];
}
function _scheduleStudentBaseSlots(s,wk){
  var mon=_scheduleMondayForWeekKey(wk);
  if(!mon)return [];
  var start=toDS(mon),end=toDS(addDays(mon,6));
  var confirmed=_scheduleStudentConfirmedDates(s).filter(function(cd){return cd.date>=start&&cd.date<=end;});
  if(confirmed.length)return confirmed.map(function(cd){
    return {day:['일','월','화','수','목','금','토'][parseDateLocal(cd.date).getDay()],time:cd.time||'10:00',absent:false,source:'consult-confirmed'};
  });
  if(s.schedType==='flex')return [];
  if(s.intervalWeeks===2){
    var anchor=s.st?getMon(parseDateLocal(s.st)):null;
    if(!anchor)return [];
    var utcWeek=function(d){return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/604800000;};
    var elapsed=Math.round(utcWeek(mon)-utcWeek(anchor));
    if(elapsed<0||elapsed%2!==0)return [];
  }
  return (s.days||[]).filter(function(d){return !s.st||_scheduleWeekDate(mon,d)>=s.st;}).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false,source:'fixed'};});
}
function _scheduleMondayForWeekKey(wk){
  /* getWK is the persisted override key; find its Monday near the requested view. */
  var y=parseInt(String(wk).slice(0,4),10),w=parseInt(String(wk).split('-W')[1],10);
  if(!y||!w)return null;
  var d=new Date(y,0,1);
  d=getMon(d);
  for(var i=0;i<55;i++){if(getWK(d)===wk)return d;d=addDays(d,7);}
  return null;
}
function _scheduleFakeConsult(c){
  return {id:c.id,name:c.name+(c.converted?'':' (상담)'),photo:c.photo||'',_photoKey:c._photoKey||'',ph:c.phone||'',phone:c.phone||'',cls:c.cls||'',schedType:'fixed',status:'수강중',fee:0,lessonType:c.lessonType||'solo',groupMembers:Array.isArray(c.groupMembers)?c.groupMembers:[],groupId:c.groupId||'',primaryPayerId:c.primaryPayerId||''};
}
/* A phone inquiry saved without a name stores the phone number as its name. Schedules show a neutral
   label instead, so contact numbers never appear on schedule cards. Stored records are unchanged. */
function _scheduleInquiryName(q){
  var name=String(q&&q.name||'').trim();
  var digits=function(v){return String(v||'').replace(/\D/g,'');};
  if(!name||(digits(name).length>=7&&digits(name)===digits(q&&q.phone))||/^[\d\s()+.-]{7,}$/.test(name))return '문의자';
  return name;
}
/* 문의자 방문 예약을 스케줄에 노출하기 위한 가짜 학생(상담 전 단계) */
function _scheduleFakeInquiry(q){
  var nm=_scheduleInquiryName(q);
  return {id:q.id,_kind:'inquiry',name:nm+' (방문)',photo:'',_photoKey:'',ph:q.phone||'',phone:q.phone||'',cls:q.cls||'',schedType:'fixed',status:'수강중',fee:0,lessonType:'solo',groupMembers:[],groupId:'',primaryPayerId:''};
}
function _scheduleMakeSlot(owner,sl,meta){
  meta=meta||{};
  var date=meta.date||_scheduleWeekDate(meta.mon,sl.day);
  var groupId=scheduleGroupId(owner);
  var members=scheduleMembersOf(owner);
  var shared=scheduleIsGroup(owner);
  var slot={s:owner,type:meta.type,absent:!!sl.absent,time:sl.time,day:sl.day,date:date,slotId:_scheduleSlotId(meta.type,owner.id,date,sl.time,meta.idx),engineVersion:SCHEDULE_ENGINE_VERSION,source:meta.source||meta.type,overrideType:sl.kind||sl.overrideType||(sl.absent?'cancel':''),makeupOf:sl.makeupOf||'',oneOff:!!meta.oneOff,groupId:groupId,sharedSlot:shared,members:members,primaryPayerId:schedulePrimaryPayerId(owner),attendanceByMember:{},conflicts:[],overbooked:false};
  if(shared){
    members.forEach(function(m){slot.attendanceByMember[m.memberId]={memberId:m.memberId,name:m.name,att:sl.att||'예정'};});
  }
  return slot;
}
function _scheduleSlotsShareGroup(a,b){
  return !!(a&&b&&a.sharedSlot&&b.sharedSlot&&a.groupId&&a.groupId===b.groupId);
}
function _scheduleAnalyze(slotsByKey){
  var conflicts=[],auditEvents=[];
  Object.keys(slotsByKey).forEach(function(key){
    var active=(slotsByKey[key]||[]).filter(function(x){return !x.absent&&x.overrideType!=='cancel'&&!x.tentative;});
    for(var i=0;i<active.length;i++){
      for(var j=i+1;j<active.length;j++){
        var a=active[i],b=active[j];
        if(a.s.id===b.s.id||_scheduleSlotsShareGroup(a,b))continue;
        var ev={type:'overbook',key:key,date:a.date||b.date,day:a.day,time:a.time,slotIds:[a.slotId,b.slotId],studentIds:[a.s.id,b.s.id],names:[a.s.name,b.s.name]};
        conflicts.push(ev);auditEvents.push(Object.assign({engineVersion:SCHEDULE_ENGINE_VERSION},ev));
        a.overbooked=b.overbooked=true;
        a.conflicts.push({sid:b.s.id,name:b.s.name,slotId:b.slotId});
        b.conflicts.push({sid:a.s.id,name:a.s.name,slotId:a.slotId});
      }
    }
  });
  return {conflicts:conflicts,auditEvents:auditEvents};
}
function buildScheduleEngine(mon,opts){
  opts=opts||{};mon=mon||getViewMon();
  var wk=getWK(mon),ov=weekOvr[wk]||{},slotsByKey={},warnings=[];
  var monEnd=addDays(mon,6);
  var monStr=toDS(mon),monEndStr=toDS(monEnd);
  function addSlot(slot){
    if(!slot.day||!slot.time)return;
    var k=slot.day+'_'+slot.time;
    if(!slotsByKey[k])slotsByKey[k]=[];
    if(!slotsByKey[k].some(function(x){return x.slotId===slot.slotId;}))slotsByKey[k].push(slot);
  }
  students.filter(function(s){return s.status==='수강중';}).forEach(function(s){
    if(s.st){
      var st=parseDateLocal(s.st);st.setHours(0,0,0,0);
      var hasConfirmedBeforeStart=_scheduleStudentConfirmedDates(s).some(function(cd){return cd.date>=monStr&&cd.date<=monEndStr;});
      if(monEnd<st&&!(s.id in ov)&&!hasConfirmedBeforeStart)return;
    }
    var oneOff=s.id in ov;
    _scheduleStudentSlots(s,wk,ov).forEach(function(sl,idx){
      addSlot(_scheduleMakeSlot(s,sl,{mon:mon,idx:idx,type:s.schedType==='flex'?'flex-sched':'fixed',source:oneOff?(sl.source||'weekOvr'):(sl.source||'student-fixed'),oneOff:oneOff}));
    });
  });
  var dayNames=['일','월','화','수','목','금','토'];
  consults.forEach(function(c){
    if(c.converted||c.hold)return;
    consultDateEntries(c).forEach(function(cd,idx){
      if(!cd.date||!cd.time)return;
      if(cd.date<monStr||cd.date>monEndStr)return;
      var dow=dayNames[parseDateLocal(cd.date).getDay()];
      var fakeStudent=_scheduleFakeConsult(c);
      addSlot(_scheduleMakeSlot(fakeStudent,{day:dow,time:cd.time,absent:false},{mon:mon,date:cd.date,idx:idx,type:'consult-sched',source:'consult-confirmed'}));
    });
  });
  /* 문의자 방문 예약(아직 상담 전) → 주간/오늘 스케줄에 노출. 확정 레슨과 충돌 차단은 하지 않도록 tentative 처리. */
  inquiries.forEach(function(q){
    if(!q||!q.visitDate||!q.visitTime)return;
    if(q.consultId)return; /* 이미 상담으로 전환됨 — 상담 슬롯이 대신 표시 */
    if(consults.some(function(c){return c._inquiryId===q.id||c.id===('ci_'+q.id);}))return;
    if(q.visitDate<monStr||q.visitDate>monEndStr)return;
    var qdow=dayNames[parseDateLocal(q.visitDate).getDay()];
    var qslot=_scheduleMakeSlot(_scheduleFakeInquiry(q),{day:qdow,time:q.visitTime,absent:false},{mon:mon,date:q.visitDate,idx:0,type:'consult-sched',source:'inquiry-visit'});
    qslot.tentative=true;
    addSlot(qslot);
  });
  var analysis=_scheduleAnalyze(slotsByKey);
  return {engineVersion:SCHEDULE_ENGINE_VERSION,weekKey:wk,weekStart:monStr,weekEnd:monEndStr,slotsByKey:slotsByKey,conflicts:analysis.conflicts,auditEvents:analysis.auditEvents,warnings:warnings,counts:{slots:Object.keys(slotsByKey).reduce(function(n,k){return n+slotsByKey[k].length;},0),conflicts:analysis.conflicts.length}};
}
function getWeekSched(mon){
  return buildScheduleEngine(mon).slotsByKey;
}
/* 분(:30 등) 단위 슬롯이 시간(hour) 행 그리드에서 사라지지 않도록 시 단위로 버킷팅한다.
 * 엔진의 정확한 키(분 포함)는 충돌 판정용으로 유지하고, 화면 렌더 조회에서만 이 버킷을 쓴다.
 * 문의 방문시간(:30 등)으로 만들어진 상담 확정일정이 주간/오늘 스케줄에서 안 보이던 버그 수정. */
function _schedSlotMins(t){var p=String(t||'').split(':');return (parseInt(p[0],10)||0)*60+(parseInt(p[1],10)||0);}
function bucketSchedByHour(sched){
  var out={};
  if(!sched)return out;
  Object.keys(sched).forEach(function(key){
    var p=key.split('_');var day=p[0];var time=p[1]||'';
    var hh=parseInt(time,10);if(isNaN(hh))hh=0;
    var hourKey=day+'_'+String(hh).padStart(2,'0')+':00';
    if(!out[hourKey])out[hourKey]=[];
    (sched[key]||[]).forEach(function(s){out[hourKey].push(s);});
  });
  Object.keys(out).forEach(function(k){out[k].sort(function(a,b){return _schedSlotMins(a.time)-_schedSlotMins(b.time);});});
  return out;
}
function scheduleSlotsForDay(sched,day){
  var slots=[];
  Object.keys(sched||{}).forEach(function(key){
    if(key.slice(0,day.length+1)===day+'_')slots.push.apply(slots,sched[key]||[]);
  });
  return slots.sort(function(a,b){return _schedSlotMins(a.time)-_schedSlotMins(b.time);});
}
function scheduleDisplayHours(sched){
  var hours=HRS_LBL.slice(),seen={};
  hours.forEach(function(h){seen[h]=true;});
  Object.keys(bucketSchedByHour(sched)).forEach(function(key){
    var hour=key.split('_')[1];
    if(hour&&!seen[hour]){seen[hour]=true;hours.push(hour);}
  });
  return hours.sort(function(a,b){return _schedSlotMins(a)-_schedSlotMins(b);});
}
function scheduleSlotSummary(slots){
  var order={};ALL7.forEach(function(d,i){order[d]=i;});
  var rows=(slots||[]).filter(function(sl){return sl&&!sl.absent&&sl.overrideType!=='cancel';}).slice();
  rows.sort(function(a,b){return (order[a.day]||0)-(order[b.day]||0)||_schedSlotMins(a.time)-_schedSlotMins(b.time);});
  return rows.map(function(sl){return sl.day+' '+sl.time;}).join(' · ')||'일정 없음';
}
function studentWeekOverrideInfo(s,mon){
  if(!s)return null;
  mon=mon||getMon(new Date());
  var wk=getWK(mon),ov=weekOvr[wk]||{};
  if(!Object.prototype.hasOwnProperty.call(ov,s.id))return null;
  var base=_scheduleStudentBaseSlots(s,wk),actual=ov[s.id]||[];
  var baseText=scheduleSlotSummary(base),actualText=scheduleSlotSummary(actual);
  return {weekKey:wk,base:baseText,actual:actualText,differs:baseText!==actualText};
}
function buildWeekGlance(mon,sched){
  var total=Object.keys(sched||{}).reduce(function(n,key){return n+(sched[key]||[]).length;},0);
  var o='<section class="week-glance" aria-label="주간 일정 한눈에">';
  o+='<div class="week-glance-head"><div><strong>이번 주 한눈에</strong><span>'+esc(fmtS(mon)+' ~ '+fmtS(addDays(mon,6)))+'</span></div><b>'+total+'건</b></div>';
  o+='<div class="week-glance-grid">';
  ALL7.forEach(function(day,i){
    var date=toDS(addDays(mon,i)),slots=scheduleSlotsForDay(sched,day);
    o+='<div class="week-glance-day" data-glance-date="'+date+'" data-date="'+date+'" onclick="openQuickSlot(this.dataset.date)">';
    o+='<button type="button" class="week-glance-day-head" data-date="'+date+'" onclick="event.stopPropagation();openQuickSlot(this.dataset.date)" aria-label="'+date+' '+day+'요일 새 일정 추가"><strong>'+day+'</strong><span>'+(addDays(mon,i).getMonth()+1)+'/'+addDays(mon,i).getDate()+'</span><b>'+slots.length+'</b></button>';
    if(!slots.length)o+='<button type="button" class="week-glance-empty" data-date="'+date+'" onclick="event.stopPropagation();openQuickSlot(this.dataset.date)">＋ 일정 추가</button>';
    slots.forEach(function(slot){
      var label=scheduleStatusLabel(slot),exception=slot.oneOff&&!slot.absent;
      o+='<button type="button" class="week-glance-slot'+(exception?' is-exception':'')+'" data-day="'+day+'" data-sid="'+esc(slot.s.id)+'" data-time="'+esc(slot.time)+'" data-date="'+date+'" onclick="event.stopPropagation();lbClick(this)"';
      o+=' aria-label="'+esc(day+' '+slot.time+' '+(slot.s.name||'이름 없음')+' '+label)+'">';
      o+='<time>'+esc(slot.time)+'</time><span>'+esc(slot.s.name||'이름 없음')+'</span>';
      if(exception)o+='<i aria-label="이번 주 변경">변경</i>';
      o+='</button>';
    });
    o+='</div>';
  });
  o+='</div><div class="week-glance-note">이번 주 변경 일정은 기본 고정 요일보다 우선합니다. 날짜를 누르면 새 일정 추가, 레슨을 누르면 상세 메뉴가 열립니다.</div></section>';
  return o;
}
function auditScheduleConflicts(mon){
  var engine=buildScheduleEngine(mon);
  return {engineVersion:engine.engineVersion,weekKey:engine.weekKey,weekStart:engine.weekStart,weekEnd:engine.weekEnd,overbookCount:engine.conflicts.length,conflicts:engine.conflicts,auditEvents:engine.auditEvents};
}
function scheduleConflictDecision(sid,day,time,mon,opts){
  opts=opts||{};mon=mon||getViewMon();
  var owner=students.find(function(s){return s.id===sid;})||consults.find(function(c){return c.id===sid;})||{id:sid,name:sid,status:'수강중'};
  var probe=_scheduleMakeSlot(owner,{day:day,time:time,absent:false},{mon:mon,idx:'probe',type:'probe',source:'probe'});
  var key=day+'_'+time;
  var existing=(buildScheduleEngine(mon).slotsByKey[key]||[]).filter(function(x){return x.s.id!==sid&&!x.absent&&!x.tentative&&!_scheduleSlotsShareGroup(x,probe);});
  return {blocked:existing.length>0&&!opts.allowOverbook,conflicts:existing.map(function(x){return {sid:x.s.id,name:x.s.name,slotId:x.slotId,type:x.type};}),key:key,slot:probe};
}
function _scheduleConflictKey(c){
  return [c.key,c.date,c.time].concat((c.studentIds||[]).slice().sort()).join('|');
}
function _scheduleNewConflicts(after,before){
  if(!after||!after.conflicts)return [];
  var seen={};
  (before&&before.conflicts||[]).forEach(function(c){seen[_scheduleConflictKey(c)]=true;});
  return after.conflicts.filter(function(c){return !seen[_scheduleConflictKey(c)];});
}
function studentScheduleValidationWeeks(s){
  var weeks={};
  function add(d){var m=getMon(d);weeks[getWK(m)]=m;}
  [getMon(new Date()),typeof getViewMon==='function'?getViewMon():getMon(new Date()),s.st?getMon(parseDateLocal(s.st)):getMon(new Date())].forEach(function(m){add(m);add(addDays(m,7));add(addDays(m,14));});
  Object.keys(weekOvr).forEach(function(wk){var m=_scheduleMondayForWeekKey(wk);if(m)add(m);});
  students.forEach(function(row){_scheduleStudentConfirmedDates(row).forEach(function(cd){add(parseDateLocal(cd.date));});});
  consults.forEach(function(row){consultDateEntries(row).forEach(function(cd){add(parseDateLocal(cd.date));});});
  return weeks;
}
function _scheduleConflictToast(audit,label,beforeAudit){
  if(!audit||!audit.overbookCount)return false;
  var conflicts=beforeAudit?_scheduleNewConflicts(audit,beforeAudit):audit.conflicts;
  if(!conflicts.length)return false;
  var first=conflicts[0];
  toast((label||'스케줄')+' 충돌 차단: '+first.day+' '+first.time+' '+first.names.join(' / '),'⚠️');
  return true;
}

var mon=getMon(parseDateLocal(date));return {weekKey:getWK(mon),weekStart:toDS(mon),weekEnd:toDS(addDays(mon,6)),...buildScheduleEngine(mon)};
}
