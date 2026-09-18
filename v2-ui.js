/* HLB Studio V2 — operations UX layer. Uses the existing canonical state contract. */
(function(){
'use strict';
function el(id){return document.getElementById(id);}
function escV2(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function normPhone(v){return String(v||'').replace(/[^0-9]/g,'');}
function fmtPhoneV2(v){
  var n=normPhone(v);if(n.length===11)return n.slice(0,3)+'-'+n.slice(3,7)+'-'+n.slice(7);
  if(n.length===10)return n.slice(0,3)+'-'+n.slice(3,6)+'-'+n.slice(6);return v||'';
}
function closeV2Phone(){var m=el('mV2Phone');if(m)m.remove();}
function dayFromDate(ds){
  if(!ds)return'';var d=typeof parseDateLocal==='function'?parseDateLocal(ds):new Date(ds+'T00:00:00');
  return ['일','월','화','수','목','금','토'][d.getDay()];
}
function appointmentBlocked(date,time){
  if(!date||!time||typeof scheduleConflictDecision!=='function')return false;
  try{var d=typeof parseDateLocal==='function'?parseDateLocal(date):new Date(date+'T00:00:00');
    var mon=typeof getMon==='function'?getMon(d):d;return !!scheduleConflictDecision('__v2_inquiry__',dayFromDate(date),time,mon).blocked;
  }catch(e){return false;}
}
window.openV2PhoneCapture=function(){
  closeV2Phone();var m=document.createElement('div');m.id='mV2Phone';m.className='ov open v2-phone-modal';
  var today=typeof toDS==='function'?toDS(new Date()):new Date().toISOString().slice(0,10);
  m.innerHTML='<div class="modal"><div class="mh"><div><div class="mt">전화 문의 즉시 저장</div>'+
    '<div style="font-size:11.5px;color:var(--tm);margin-top:2px">통화 중 번호만 먼저 넣어도 서버 저장됩니다.</div></div>'+
    '<div class="mc" onclick="document.getElementById(\'mV2Phone\').remove()">&#x2715;</div></div><div class="mb">'+
    '<div class="v2-phone-hero"><strong>전화 → 문의 → 일정 → 상담 신청서</strong><p>한 번 저장한 정보가 고객·스케줄·상담으로 이어집니다.</p></div>'+
    '<div class="v2-phone-grid"><div class="f1 wide"><label>연락처 *</label><input id="v2-phone" type="tel" placeholder="010-0000-0000" inputmode="tel"></div>'+
    '<div class="f1"><label>이름</label><input id="v2-name" placeholder="미상이어도 저장 가능"></div>'+
    '<div class="f1"><label>문의 메모</label><input id="v2-memo" placeholder="예: 입시 / 축가 / 체험 문의"></div>'+
    '<div class="f1"><label>방문 상담 날짜</label><input id="v2-date" type="date" min="'+today+'"></div>'+
    '<div class="f1"><label>방문 상담 시간</label><input id="v2-time" type="time" step="1800"></div></div>'+
    '<div class="v2-mini-note">같은 번호가 다시 전화하면 중복 고객을 만들지 않고 통화 이력에 추가합니다. 방문 시간을 지정하면 즉시 주간/오늘 일정에 표시됩니다.</div>'+
    '</div><div class="mf"><button class="btn bg2" onclick="document.getElementById(\'mV2Phone\').remove()">취소</button>'+
    '<button class="btn bg2" onclick="saveV2PhoneInquiry(false)">문의만 저장</button>'+
    '<button class="btn bp" onclick="saveV2PhoneInquiry(true)">저장 후 상담 신청서</button></div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)closeV2Phone();});document.body.appendChild(m);
  setTimeout(function(){var p=el('v2-phone');if(p)p.focus();},60);
};
function saveV2PhoneInquiry(openConsult){
  var ph=fmtPhoneV2((el('v2-phone')||{}).value||''),digits=normPhone(ph);
  var nm=((el('v2-name')||{}).value||'').trim(),memo=((el('v2-memo')||{}).value||'').trim();
  var visitDate=(el('v2-date')||{}).value||'',visitTime=(el('v2-time')||{}).value||'';
  if(digits.length<9){if(typeof toast==='function')toast('전화번호를 확인해주세요','⚠️');return;}
  if((visitDate&&!visitTime)||(!visitDate&&visitTime)){if(typeof toast==='function')toast('상담 날짜와 시간을 함께 선택해주세요','⚠️');return;}
  if(appointmentBlocked(visitDate,visitTime)){if(typeof toast==='function')toast('해당 시간에 이미 확정 수업이 있습니다. 다른 시간을 선택해주세요.','⚠️');return;}
  var now=Date.now(),q=(window.inquiries||[]).find(function(x){return normPhone(x.phone)===digits&&!x.converted;});
  var call={at:now,memo:memo||'전화 문의'};
  if(q){
    q.name=nm||q.name||ph;q.phone=ph;q.memo=memo||q.memo||'';q.channel='phone';q.lastCallAt=now;
    q.callHistory=Array.isArray(q.callHistory)?q.callHistory:[];q.callHistory.unshift(call);
    if(visitDate){q.visitDate=visitDate;q.visitTime=visitTime;}
  }else{
    q={id:typeof uid==='function'?uid():('iq_'+now),name:nm||ph,phone:ph,memo:memo,channel:'phone',
      status:'문의',date:typeof toDS==='function'?toDS(new Date()):new Date().toISOString().slice(0,10),
      createdAt:now,lastCallAt:now,callHistory:[call],visitDate:visitDate,visitTime:visitTime};
    window.inquiries.unshift(q);
  }
  if(typeof saveAll==='function')saveAll();closeV2Phone();if(typeof v2UpdateOps==='function')v2UpdateOps();
  if(typeof toast==='function')toast(visitDate?'문의 저장 + 상담 일정 반영 완료':'전화 문의가 서버 저장 대기열에 반영됐습니다','📞');
  if(openConsult&&typeof inquiryToConsult==='function')inquiryToConsult(q.id);
  else if(window.page==='consult'&&typeof render==='function')render();
}
window.saveV2PhoneInquiry=saveV2PhoneInquiry;
window.openV2ScheduleMode=function(mode){
  if(mode==='fixed'){
    if(typeof openSModal==='function')openSModal();
    setTimeout(function(){if(typeof setSType==='function')setSType('fixed');},60);
    return;
  }
  var flex=(window.students||[]).filter(function(s){return s.status==='수강중'&&s.schedType==='flex';});
  if(!flex.length){
    if(typeof openSModal==='function')openSModal();
    setTimeout(function(){if(typeof setSType==='function')setSType('flex');if(typeof toast==='function')toast('변동 스케줄 고객을 먼저 등록해주세요');},60);
    return;
  }
  if(typeof go==='function')go('schedule');setTimeout(function(){if(typeof openFlexWeek==='function')openFlexWeek();},220);
};
function todaySlots(){
  if(typeof buildScheduleEngine!=='function'||typeof getMon!=='function')return 0;
  try{var e=buildScheduleEngine(getMon(new Date())),d=['일','월','화','수','목','금','토'][new Date().getDay()];
    return Object.keys(e.slotsByKey||{}).filter(function(k){return k.indexOf(d+'_')===0;})
      .reduce(function(n,k){return n+(e.slotsByKey[k]||[]).filter(function(x){return !x.absent;}).length;},0);
  }catch(err){return 0;}
}
window.v2UpdateOps=function(){
  var iq=(window.inquiries||[]).filter(function(q){return !q.consultId;}).length;
  var co=(window.consults||[]).filter(function(c){return !c.converted&&!c.hold;}).length;
  var cf=0;try{if(typeof auditScheduleConflicts==='function')cf=auditScheduleConflicts(getMon(new Date())).overbookCount||0;}catch(e){}
  var values={v2InquiryCount:iq,v2ConsultCount:co,v2TodayCount:todaySlots(),v2ConflictCount:cf};
  Object.keys(values).forEach(function(id){var n=el(id);if(n)n.textContent=String(values[id]);});
  var st=el('v2LiveText'),source=el('topSyncStatus')||el('syncStatus');
  if(st&&source){var txt=(source.textContent||'').trim();st.textContent=txt||'공용 DB 연결';}
  var warn=el('v2ConflictCard');if(warn)warn.classList.toggle('v2-has-conflict',cf>0);
};
function initV2(){
  v2UpdateOps();setInterval(v2UpdateOps,10000);
  var pwa=el('pwaInstallBtn');if(pwa&&typeof _pwaStandalone==='function'&&_pwaStandalone())pwa.style.display='none';
  document.addEventListener('visibilitychange',function(){if(!document.hidden)v2UpdateOps();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initV2);else setTimeout(initV2,0);
})();