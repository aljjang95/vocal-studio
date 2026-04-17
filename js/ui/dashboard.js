/* ============================================================
   dashboard.js — 대시보드 & 비밀번호 관리
   buildDashboard() : 대시보드 HTML 생성
   askDashboardPw() : 비밀번호 입력 모달
   confirmDashPw() : 비밀번호 확인
   showDashboard() : 대시보드 표시
   changePassword() : 비밀번호 변경 모달
   checkPwMatch() : 비밀번호 일치 검사
   savePassword() : 비밀번호 저장
   initLock() : 잠금 초기화
   fmtPhone() : 전화번호 포맷
   ============================================================ */

/* ── 비밀번호 잠금 ── */

/* ── 대시보드 비밀번호 체크 ── */
var _dashUnlocked=false;
var _dashUnlockTime=0;
function askDashboardPw(){
  if(_dashUnlocked && (Date.now()-_dashUnlockTime)<5*60*1000){
    showDashboard();
    return;
  }
  var existing=document.getElementById('mDashPw');
  if(existing)existing.remove();
  var m=document.createElement('div');
  m.id='mDashPw';m.className='ov open';
  m.innerHTML='<div class="modal" style="max-width:320px">'
    +'<div class="mh" style="justify-content:center;padding-bottom:0;border-bottom:none">'
    +'<div style="text-align:center">'
    +'<div style="font-size:40px;margin-bottom:8px">📊</div>'
    +'<div class="mt">대시보드</div>'
    +'<div style="font-size:12.5px;color:var(--tm);margin-top:4px;font-weight:400">수입·학생 현황은 비밀번호로 보호됩니다</div>'
    +'</div>'
    +'</div>'
    +'<div class="mb" style="padding-top:20px">'
    +'<input type="password" id="dashPwInput" placeholder="비밀번호 입력" style="width:100%;text-align:center;font-size:18px;letter-spacing:.25em;padding:13px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--b);color:var(--t);outline:none;transition:border-color .15s" onkeydown="if(event.key===\'Enter\')confirmDashPw()" onfocus="this.style.borderColor=\'rgba(200,169,110,.5)\'" onblur="this.style.borderColor=\'rgba(255,255,255,.07)\'">'
    +'<div id="dashPwError" style="color:var(--r);font-size:12px;min-height:16px;margin-top:8px;text-align:center"></div>'
    +'<div style="font-size:11px;color:var(--tm);text-align:center;margin-top:6px">초기 비밀번호: <span style="font-family:DM Mono,monospace;color:var(--a)">0000</span></div>'
    +'</div>'
    +'<div class="mf" style="justify-content:center;gap:10px">'
    +'<button class="btn bg2" style="min-width:90px" onclick="document.getElementById(\'mDashPw\').remove()">취소</button>'
    +'<button class="btn bp" style="min-width:90px" onclick="confirmDashPw()">확인 →</button>'
    +'</div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
  setTimeout(function(){var inp=document.getElementById('dashPwInput');if(inp)inp.focus();},120);
}
function confirmDashPw(){
  var inp=document.getElementById('dashPwInput');
  var val=inp?inp.value:'';
  var pw=localStorage.getItem('vsC_pw')||'0000';
  if(val===pw){
    _dashUnlocked=true;
    _dashUnlockTime=Date.now();
    var m=document.getElementById('mDashPw');if(m)m.remove();
    showDashboard();
  } else {
    var err=document.getElementById('dashPwError');
    if(err)err.textContent='비밀번호가 틀렸습니다 ❌';
    if(inp){inp.value='';inp.focus();}
  }
}
function showDashboard(){
  var navItems=document.querySelectorAll('.ni');
  navItems.forEach(function(n){n.classList.toggle('on',n.dataset.p==='dashboard');});
  page='dashboard';
  ge('ta').innerHTML='<button class="btn bg2 bsm" onclick="changePassword()" style="gap:6px">🔑 비밀번호 변경</button>';
  ge('content').innerHTML=buildDashboard();
}

/* ── 실행취소 스택 ── */
var _undoStack=[];
var _redoStack=[];
var _undoMaxSize=20;
function pushUndo(){
  _undoStack.push({
    weekOvr: JSON.parse(JSON.stringify(weekOvr)),
    students: JSON.parse(JSON.stringify(students)),
    logs: JSON.parse(JSON.stringify(logs)),
  });
  if(_undoStack.length>_undoMaxSize)_undoStack.shift();
  _redoStack=[];
}
function undoAction(){
  if(!_undoStack.length){toast('더 이상 되돌릴 수 없습니다','⚠️');return;}
  /* 현재 상태를 redo 스택에 저장 */
  _redoStack.push({
    weekOvr:JSON.parse(JSON.stringify(weekOvr)),
    students:JSON.parse(JSON.stringify(students)),
    logs:JSON.parse(JSON.stringify(logs)),
  });
  var prev=_undoStack.pop();
  weekOvr=prev.weekOvr;
  students=prev.students;
  logs=prev.logs;
  saveAll();renderSidebarToday();render();
  toast('↩️ 이전 (남은 '+_undoStack.length+'개)');
}
function redoAction(){
  if(!_redoStack.length){toast('앞으로 되돌릴 내용이 없습니다','⚠️');return;}
  _undoStack.push({
    weekOvr:JSON.parse(JSON.stringify(weekOvr)),
    students:JSON.parse(JSON.stringify(students)),
    logs:JSON.parse(JSON.stringify(logs)),
  });
  var next=_redoStack.pop();
  weekOvr=next.weekOvr;
  students=next.students;
  logs=next.logs;
  saveAll();renderSidebarToday();render();
  toast('↪️ 앞으로 (남은 '+_redoStack.length+'개)');
}
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){
    e.preventDefault();undoAction();
  } else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){
    e.preventDefault();redoAction();
  }
});
function initLock(){
  /* 비밀번호 초기값만 설정 — 앱 시작 시 잠금 화면 절대 표시 안 함 */
  if(!localStorage.getItem('vsC_pw'))localStorage.setItem('vsC_pw','0000');
}


function changePassword(){
  /* 기존 모달 제거 후 새로 생성 */
  var ex=document.getElementById('mSetPw');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mSetPw';m.className='ov open';
  m.innerHTML=
    '<div class="modal" style="max-width:380px">'
    +'<div class="mh">'
    +'<div><div class="mt">🔑 비밀번호 변경</div>'
    +'<div style="font-size:12px;color:var(--tm);margin-top:2px">대시보드 잠금 비밀번호</div></div>'
    +'<div class="mc" onclick="document.getElementById(\'mSetPw\').remove()">&#x2715;</div>'
    +'</div>'
    +'<div class="mb">'
    +'<div style="background:var(--ag);border:1px solid var(--b);border-radius:9px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:var(--a)">💡 초기 비밀번호는 <b>0000</b>입니다. 숫자·문자 조합 4자리 이상으로 변경하세요.</div>'
    +'<div class="f1" style="margin-bottom:12px"><label>현재 비밀번호</label><input type="password" id="pw-current" placeholder="현재 비밀번호 입력" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pw-new\').focus()"></div>'
    +'<div class="f1" style="margin-bottom:12px"><label>새 비밀번호</label><input type="password" id="pw-new" placeholder="새 비밀번호 (4자리 이상)" autocomplete="new-password" oninput="checkPwMatch()" onkeydown="if(event.key===\'Enter\')document.getElementById(\'pw-confirm\').focus()"></div>'
    +'<div class="f1" style="margin-bottom:8px"><label>새 비밀번호 확인</label><input type="password" id="pw-confirm" placeholder="새 비밀번호 다시 입력" autocomplete="new-password" oninput="checkPwMatch()" onkeydown="if(event.key===\'Enter\')savePassword()"></div>'
    +'<div id="pw-match-msg" style="font-size:12px;min-height:18px;margin-bottom:4px"></div>'
    +'</div>'
    +'<div class="mf">'
    +'<button class="btn bg2" onclick="document.getElementById(\'mSetPw\').remove()">취소</button>'
    +'<button class="btn bp" onclick="savePassword()">🔑 변경 저장</button>'
    +'</div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
  setTimeout(function(){var el=document.getElementById('pw-current');if(el)el.focus();},120);
}

function checkPwMatch(){
  var nw=document.getElementById('pw-new');
  var cf=document.getElementById('pw-confirm');
  var msg=document.getElementById('pw-match-msg');
  if(!nw||!cf||!msg)return;
  if(!cf.value){msg.textContent='';return;}
  if(nw.value===cf.value){
    msg.style.color='var(--g)';msg.textContent='✓ 비밀번호가 일치합니다';
  } else {
    msg.style.color='var(--r)';msg.textContent='✗ 비밀번호가 일치하지 않습니다';
  }
}

function savePassword(){
  var cur=(document.getElementById('pw-current')||{value:''}).value;
  var nw=(document.getElementById('pw-new')||{value:''}).value;
  var cf=(document.getElementById('pw-confirm')||{value:''}).value;
  var saved=localStorage.getItem('vsC_pw')||'0000';
  if(cur!==saved){
    toast('현재 비밀번호가 틀렸습니다','⚠️');
    var ci=document.getElementById('pw-current');if(ci){ci.value='';ci.focus();}
    return;
  }
  if(!nw||nw.length<4){toast('비밀번호는 4자리 이상이어야 합니다','⚠️');return;}
  if(nw!==cf){toast('새 비밀번호가 일치하지 않습니다','⚠️');return;}
  localStorage.setItem('vsC_pw',nw);
  var m=document.getElementById('mSetPw');if(m)m.remove();
  toast('비밀번호가 변경되었습니다 🔑');
}
function fmtPhone(el){
  var v=el.value.replace(/[^0-9]/g,'');
  /* 010 자동 추가: 0 없이 시작하면 앞에 붙이기 */
  if(v.length>0&&v[0]!=='0'){
    if(v[0]==='1')v='0'+v;       /* 1로 시작 → 0 붙임 */
    else v='010'+v;               /* 그 외 → 010 붙임 */
  }
  v=v.slice(0,11);
  if(v.length<=3)el.value=v;
  else if(v.length<=7)el.value=v.slice(0,3)+'-'+v.slice(3);
  else el.value=v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7);
}

/* ── 대시보드 HTML 생성 ── */
/* ── 대시보드 ── */
function buildDashboard(){
  var now=new Date();
  var active=students.filter(function(s){return s.status==='수강중';});
  var thisMonth=now.toISOString().slice(0,7);
  var todayStr=toDS(now);
  var todayDay=JSDOW[now.getDay()];
  /* 이번 달 레슨 수 */
  var monthLogs=logs.filter(function(l){return (l.date||'').startsWith(thisMonth);});
  /* 이번 달 수입 */
  var monthPay=payments.filter(function(p){return p.paid&&(p.date||'').startsWith(thisMonth);});
  var monthIncome=monthPay.reduce(function(a,b){return a+(b.amount||0);},0);
  /* 미입금 */
  var unpaid=active.filter(function(s){
    var ci=getCycleInfo(s);
    var paid=payments.filter(function(p){return p.sid===s.id&&p.cycleNum===ci.cycleNum&&p.paid;}).reduce(function(a,b){return a+(b.amount||0);},0);
    return (s.fee||0)>0&&paid<(s.fee||0);
  });
  /* 오늘 레슨 */
  var mon=getMon(now);var sched=getWeekSched(mon);
  var todaySlots=[];
  HOURS.forEach(function(h){(sched[todayDay+'_'+h]||[]).forEach(function(x){if(!x.absent)todaySlots.push({s:x.s,h:h});});});
  /* 이번 달 신규 상담 */
  var newConsults=consults.filter(function(c){return (c.date||'').startsWith(thisMonth);});
  /* 전환율 */
  var converted=consults.filter(function(c){return c.converted;}).length;
  var convRate=consults.length?Math.round(converted/consults.length*100):0;
  var o='<div style="max-width:1100px;margin:0 auto">';
  /* 헤더 */
  o+='<div style="margin-bottom:22px"><div style="font-family:Cormorant Garamond,serif;font-size:24px;font-weight:900;color:var(--t)">안녕하세요 👋</div>';
  o+='<div style="font-size:13.5px;color:var(--tm);margin-top:4px">'+now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일 ('+['일','월','화','수','목','금','토'][now.getDay()]+') · 수강중 '+active.length+'명</div></div>';
  /* 핵심 지표 카드 */
  o+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:22px" class="dash-grid">';
  function statCard(icon,label,val,color,sub){
    return '<div style="background:var(--s1);border:1px solid var(--b);border-radius:14px;padding:18px 18px 16px;position:relative;overflow:hidden">'
      +'<div style="position:absolute;top:0;left:0;right:0;height:2px;background:'+color+';opacity:.5"></div>'
      +'<div style="font-size:22px;margin-bottom:10px;line-height:1">'+icon+'</div>'
      +'<div style="font-size:26px;font-weight:900;color:'+(color||'var(--t)')+';font-family:Cormorant Garamond,serif;line-height:1;margin-bottom:5px">'+val+'</div>'
      +'<div style="font-size:11px;color:var(--tm);font-weight:500;letter-spacing:.02em">'+label+'</div>'
      +(sub?'<div style="font-size:11px;color:var(--ts);margin-top:3px">'+sub+'</div>':'')
      +'</div>';
  }
  o+=statCard('🎓','수강중 학생',active.length+'명','var(--a)','전체 '+students.length+'명');
  o+=statCard('📅','오늘 레슨',todaySlots.length+'건','var(--g)','');
  o+=statCard('📝','이번 달 레슨',monthLogs.length+'회','var(--bl)','');
  o+=statCard('💰','이번 달 수입',monthIncome?won(monthIncome):'—','var(--a)','');
  o+=statCard('⚠️','미입금',unpaid.length+'명','var(--r)','');
  o+=statCard('📋','신규 상담',newConsults.length+'건','var(--pu)','전환율 '+convRate+'%');
  o+='</div>';
  /* 2열 레이아웃 */
  o+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';
  /* 오늘 레슨 목록 */
  o+='<div class="card"><div class="ch"><span class="ct">📅 오늘 레슨</span><span style="font-size:12.5px;color:var(--tm)">'+todaySlots.length+'건</span></div>';
  if(!todaySlots.length){o+='<div style="text-align:center;padding:24px;color:var(--tm);font-size:13px">오늘 예정된 레슨이 없습니다</div>';}
  else todaySlots.forEach(function(item){
    var c=gc(item.s);
    var tl=logs.find(function(l){return l.sid===item.s.id&&l.date===todayStr;});
    o+='<div style="display:flex;align-items:center;gap:12px;padding:11px 18px;border-top:1px solid var(--b);cursor:pointer" data-sid="'+item.s.id+'" data-h="'+item.h+'" data-date="'+todayStr+'" onclick="openLessonRecord(this.dataset.sid,this.dataset.h,this.dataset.date)">';
    o+='<span style="font-size:13px;font-weight:700;font-family:DM Mono,monospace;color:var(--a);width:46px">'+item.h+'</span>';
    var av=getStudentPhoto(item.s)?'<img src="'+getStudentPhoto(item.s)+'" style="width:34px;height:34px;border-radius:50%;object-fit:cover">':'<div style="width:34px;height:34px;border-radius:50%;background:'+c+'33;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:'+c+'">'+esc(item.s.name.slice(0,1))+'</div>';
    o+=av;
    o+='<div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(item.s.name)+'</div><div style="font-size:12px;color:var(--tm)">'+clsL(item.s.cls)+' · '+clsD(item.s.cls)+'</div></div>';
    o+=tl?'<span class="bdg bg-g" style="font-size:11px">✓ 기록완료</span>':'<span class="bdg bg-a" style="font-size:11px">미기록</span>';
    o+='</div>';
  });
  o+='</div>';
  /* 미입금 목록 */
  o+='<div class="card">';
  o+='<div class="ch" style="cursor:pointer" onclick="var b=document.getElementById(\'dash-unpaid-body\');var ic=document.getElementById(\'dash-unpaid-ic\');if(b){var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';ic.textContent=open?\'▶\':\'▼\';}">';
  o+='<span class="ct">⚠️ 미입금 현황</span>';
  o+='<div style="display:flex;align-items:center;gap:8px"><span class="bdg bg-r" style="font-size:12px">'+unpaid.length+'명</span><span id="dash-unpaid-ic" style="font-size:11px;color:var(--tm)">▼</span></div>';
  o+='</div>';
  o+='<div id="dash-unpaid-body">';
  if(!unpaid.length){o+='<div style="text-align:center;padding:24px;color:var(--g);font-size:13px">✓ 미입금 없음</div>';}
  else unpaid.forEach(function(s){
    var ci=getCycleInfo(s);
    o+='<div style="display:flex;align-items:center;gap:12px;padding:11px 18px;border-top:1px solid var(--b);cursor:pointer" onclick="goPayment()">';
    var av=getStudentPhoto(s)?'<img src="'+getStudentPhoto(s)+'" style="width:34px;height:34px;border-radius:50%;object-fit:cover">':'<div style="width:34px;height:34px;border-radius:50%;background:'+gc(s)+'33;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:'+gc(s)+'">'+esc(s.name.slice(0,1))+'</div>';
    o+=av;
    o+='<div style="flex:1"><div style="font-size:14px;font-weight:600">'+esc(s.name)+'</div><div style="font-size:12px;color:var(--tm)">사이클 '+ci.cycleNum+' · '+won(s.fee||0)+'</div></div>';
    o+='<button class="btn bd bsm" data-sid="'+s.id+'" onclick="event.stopPropagation();addPayForStudent(this.dataset.sid)">입금등록</button>';
    o+='</div>';
  });
  o+='</div>';
  o+='</div>';
  /* 최근 레슨 기록 */
    o+='</div>';
  o+='<div class="card" style="margin-bottom:16px">';
  o+='<div class="ch" style="cursor:pointer" onclick="var b=document.getElementById(\'dash-logs-body\');var ic=document.getElementById(\'dash-logs-ic\');if(b){var open=b.style.display!==\'none\';b.style.display=open?\'none\':\'block\';ic.textContent=open?\'▶\':\'▼\';}">';
  o+='<span class="ct">📝 최근 레슨 기록</span>';
  o+='<div style="display:flex;align-items:center;gap:8px"><button class="btn bg2 bsm" onclick="event.stopPropagation();go(\'logs\')">전체보기</button><span id="dash-logs-ic" style="font-size:11px;color:var(--tm)">▼</span></div>';
  o+='</div>';
  o+='<div id="dash-logs-body">';
  var recentLogs=logs.slice(0,6);
  if(!recentLogs.length){o+='<div style="text-align:center;padding:24px;color:var(--tm);font-size:13px">레슨 기록이 없습니다</div>';}
  else{
    o+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0">';
    recentLogs.forEach(function(l){
      var s=students.find(function(st){return st.id===l.sid;});
      var c=s?gc(s):'var(--a)';
      o+='<div style="padding:12px 18px;border-right:1px solid var(--b);border-bottom:1px solid var(--b);cursor:pointer" data-lid="'+esc(l.id)+'" onclick="editLogByIdEl(this.dataset.lid)">';
      o+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">';
      o+='<span class="cp" style="background:'+c+'"></span>';
      o+='<span style="font-size:13.5px;font-weight:600">'+esc(l.sn)+'</span>';
      o+='<span style="font-size:11px;color:var(--tm);margin-left:auto">'+esc(l.date)+'</span>';
      o+='</div>';
      if(l.ct)o+='<div style="font-size:12.5px;color:var(--ts);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📝 '+esc(l.ct)+'</div>';
      if(l.fb)o+='<div style="font-size:12.5px;color:var(--r);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">⚠️ '+esc(l.fb)+'</div>';
      o+='</div>';
    });
    o+='</div>';
  }
  o+='</div>';
  /* 빠른 메뉴 */
    o+='</div>';
  o+='<div class="card" style="margin-bottom:16px"><div class="ch"><span class="ct">⚡ 빠른 메뉴</span></div>';
  o+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;padding:14px">';
  [
    {icon:'📋',label:'신규 상담',action:"showConsultForm()",color:'rgba(164,110,200,.1)',tc:'var(--pu)'},
    {icon:'♬', label:'레슨생 추가',action:"openSModal()",color:'var(--ag)',tc:'var(--a)'},
    {icon:'📅',label:'오늘 스케줄',action:"go('today')",color:'rgba(109,200,162,.1)',tc:'var(--g)'},
    {icon:'💰',label:'입금 관리',action:"go('payment')",color:'rgba(200,169,110,.08)',tc:'var(--a)'},
    {icon:'🔄',label:'변동 배정',action:"openFlexWeek()",color:'rgba(110,163,200,.1)',tc:'var(--bl)'},
    {icon:'📊',label:'주간 스케줄',action:"go('schedule')",color:'rgba(255,255,255,.04)',tc:'var(--ts)'}
  ].forEach(function(m){
    o+='<button onclick="'+m.action+'" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:76px;background:'+m.color+';border:1px solid rgba(255,255,255,.07);border-radius:11px;cursor:pointer;transition:all .14s;font-family:DM Sans,sans-serif;color:'+m.tc+';font-size:12.5px;font-weight:600" onmouseenter="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 20px rgba(0,0,0,.3)\'" onmouseleave="this.style.transform=\'\';this.style.boxShadow=\'\'">';
    o+='<span style="font-size:22px">'+m.icon+'</span>'+esc(m.label)+'</button>';
  });
  o+='</div></div>';
  o+='</div>';
  return o;
}