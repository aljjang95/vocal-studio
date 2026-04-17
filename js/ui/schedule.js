/* ============================================================
   schedule.js — 주간/모바일 스케줄
   getViewMon() : 현재 보기 월요일
   getWeekSched(mon) : 주간 스케줄 조회
   isMobile() : 모바일 감지
   mSR() : 모바일 스케줄 재렌더
   attachMobileEvents() : 모바일 이벤트 연결
   openQuickSlot() : 빠른 슬롯 배정
   useDeferral / cancelDeferral / resetDeferral : 연기 관리
   openBulkSchedule → saveBulkSchedule : 일괄 스케줄
   openSMSParser → registerParsedSchedule : 문자 파싱
   buildMobileWeekView() : 모바일 주간 뷰 (최종본)
   buildMobileSchedule() : 모바일 일/주간 스케줄
   buildSchedule() : 데스크탑 스케줄
   removeSlotFromMenu ... saveWE : 슬롯/셀/주간수정 액션
   ============================================================ */

/* SCHEDULE */
function getViewMon(){var m=getMon(new Date());m.setDate(m.getDate()+wkOfs*7);return m;}

var mobileSchedDay=(new Date().getDay()===0)?6:(new Date().getDay()-1);
var mobileSchedView='day';
function isMobile(){return window.innerWidth<=768;}
function mSR(){var c=ge('content');if(c){c.innerHTML=buildMobileSchedule();c.scrollTop=0;setTimeout(function(){attachMobileEvents();},50);}}
function attachMobileEvents(){
  document.querySelectorAll('[data-cell]').forEach(function(el){
    el.addEventListener('click',function(e){
      e.stopPropagation();
      if(el.dataset.offday==='1'){
        var lbl=getOffLabel(el.dataset.date);
        var day=el.dataset.day,time=el.dataset.time,date=el.dataset.date;
        vsConfirm({
          msg:lbl+' 날 레슨 배정',
          sub:'휴무일이지만 이 날 레슨을 배정하시겠습니까?',
          okLabel:'배정',
          onOk:function(){cellClick(day,time,date);}
        });
        return;
      }
      cellClick(el.dataset.day,el.dataset.time,el.dataset.date);
    });
  });
  document.querySelectorAll('[data-daysel]').forEach(function(el){
    el.addEventListener('click',function(e){
      e.stopPropagation();
      mSelDay(parseInt(el.dataset.daysel));
    });
  });
}

function openQuickSlot(){
  /* 현재 선택된 요일로 빠른 배정 */
  var mon=getViewMon();
  var d=ALL7[mobileSchedDay];
  var dd=addDays(mon,mobileSchedDay);
  var ddStr=toDS(dd);
  /* 가장 가까운 정시 */
  var now=new Date();
  var h=now.getHours();
  if(h<10)h=10;if(h>21)h=21;
  var timeStr=(h<10?'0':'')+h+':00';
  /* HRS_LBL에 있는 시간으로 보정 */
  if(HRS_LBL.indexOf(timeStr)<0) timeStr=HRS_LBL[0];
  cellClick(d,timeStr,ddStr);
}

function useDeferral(sid){
  var s=students.find(function(x){return x.id===sid;});
  if(!s) return;
  var max=s.maxDeferrals||2;
  var used=s.deferrals||0;
  if(used>=max){toast('이번 사이클 연기 횟수를 모두 사용했습니다 ❌');return;}
  vsConfirm({
    msg:'연기 1회 사용',
    sub:esc(s.name)+' · 현재 '+used+'/'+max+'회 사용',
    okLabel:'사용',
    onOk:function(){
      s.deferrals=(s.deferrals||0)+1;
      saveAll();toast('연기 사용: '+s.name+' ('+s.deferrals+'/'+max+'회)');
      if(page==='students')render();
    }
  });
}

function cancelDeferral(sid){
  var s=students.find(function(x){return x.id===sid;});
  if(!s||!(s.deferrals>0)) return;
  vsConfirm({
    msg:'연기 1회 취소',
    sub:esc(s.name)+' · '+s.deferrals+'회 → '+(s.deferrals-1)+'회',
    okLabel:'취소',
    onOk:function(){
      s.deferrals=Math.max(0,(s.deferrals||0)-1);
      saveAll();toast('연기 취소: '+s.name+' ('+s.deferrals+'/'+((s.maxDeferrals)||2)+'회)');
      if(page==='students')render();
    }
  });
}

function resetDeferral(sid){
  var s=students.find(function(x){return x.id===sid;});
  if(!s) return;
  vsConfirm({
    msg:'연기 횟수 초기화',
    sub:esc(s.name)+' · 0회로 리셋됩니다',
    okLabel:'초기화',danger:true,
    onOk:function(){
      s.deferrals=0;
      saveAll();toast('연기 초기화: '+s.name);
      if(page==='students')render();
    }
  });
}

/* ── 문의자 관리 ── */


/* ── 변동 스케줄 한달치 일정 등록 ── */

function openBulkSchedule(sid){
  var s=students.find(function(x){return x.id===sid;});
  if(!s) return;
  var m=document.createElement('div');
  m.id='mBulkSched';m.className='ov open';
  var now=new Date();

  function buildCal(year,month){
    var daysInMonth=new Date(year,month+1,0).getDate();
    var firstDay=new Date(year,month,1).getDay();
    var mn=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var todayStr=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    var h='<div style="font-size:12px;font-weight:700;color:var(--a);margin-bottom:4px;text-align:center">'+year+'년 '+mn[month]+'</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
    ['일','월','화','수','목','금','토'].forEach(function(d,i){
      h+='<div style="font-size:9px;text-align:center;color:'+(i===0?'var(--r)':'var(--tm)')+';padding:2px;font-weight:600">'+d+'</div>';
    });
    for(var pad=0;pad<firstDay;pad++) h+='<div></div>';
    for(var dd=1;dd<=daysInMonth;dd++){
      var ds=year+'-'+String(month+1).padStart(2,'0')+'-'+String(dd).padStart(2,'0');
      var dow=(firstDay+dd-1)%7;
      var isToday=ds===todayStr;
      var color=dow===0?'var(--r)':dow===6?'#6ea3c8':'var(--t)';
      var bg=isToday?'var(--ag)':'transparent';
      h+='<div class="bulk-date" data-date="'+ds+'" onclick="toggleBulkDate(this)" style="text-align:center;padding:4px 1px;border-radius:5px;cursor:pointer;font-size:11px;color:'+color+';background:'+bg+';font-weight:'+(isToday?'700':'400')+'">'+dd+'</div>';
    }
    h+='</div>';
    return h;
  }

  var yr=now.getFullYear(),mo=now.getMonth();
  var yr2=mo===11?yr+1:yr,mo2=mo===11?0:mo+1;

  var html='<div class="modal wide"><div class="mh"><div class="mt">📅 '+esc(s.name)+' 일정 등록</div><div class="mc" onclick="document.getElementById(\'mBulkSched\').remove()">&#x2715;</div></div><div class="mb">';
  html+='<div style="font-size:12px;color:var(--tm);margin-bottom:8px">날짜를 선택하고 시간을 설정하세요</div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
  html+='<div>'+buildCal(yr,mo)+'</div>';
  html+='<div>'+buildCal(yr2,mo2)+'</div>';
  html+='</div>';
  html+='<input type="hidden" id="bulk-time" value="10:00">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
  html+='<div style="font-size:11px;color:var(--tm)">날짜 탭 → 시간 설정 → 저장</div>';
  html+='<button class="btn bsm" style="font-size:11px;background:rgba(200,80,80,.1);color:var(--r)" onclick="clearAllBulkDates()">전체 취소</button>';
  html+='</div>';
  html+='<div id="bulk-selected-list" style="max-height:180px;overflow-y:auto;margin-bottom:8px"></div>';
  html+='<div id="bulk-preview" style="font-size:12px;color:var(--tm);min-height:20px;margin-bottom:12px"></div>';
  html+='<div style="display:flex;gap:8px;justify-content:flex-end">';
  html+='<button class="btn bg2" onclick="document.getElementById(\'mBulkSched\').remove()">취소</button>';
  html+='<button class="btn bp" data-sid="'+sid+'" onclick="saveBulkSchedule(this.dataset.sid)">💾 일정 저장</button>';
  html+='</div></div></div>';
  m.innerHTML=html;
  document.body.appendChild(m);
  window._bulkSelections={};
}



function cancelBulkDate(date){
  var el=document.querySelector('.bulk-date[data-date="'+date+'"]');
  if(el) toggleBulkDate(el);
}
function clearAllBulkDates(){
  document.querySelectorAll('.bulk-date.sel').forEach(function(el){
    el.classList.remove('sel');
    el.style.background='';
    el.style.fontWeight='';
  });
  window._bulkSelections={};
  var list=document.getElementById('bulk-selected-list');
  if(list) list.innerHTML='';
  updateBulkPreview();
}
function toggleBulkDate(el){
  var date=el.dataset.date;
  if(el.classList.contains('sel')){
    el.classList.remove('sel');
    el.style.background='';
    el.style.fontWeight='';
    delete window._bulkSelections[date];
    var row=document.getElementById('brow-'+date);
    if(row) row.remove();
  } else {
    el.classList.add('sel');
    el.style.background='rgba(200,169,110,.3)';
    el.style.fontWeight='700';
    var defT=document.getElementById('bulk-time');
    var defTime=defT?defT.value:'10:00';
    window._bulkSelections[date]=defTime;
    /* 선택 목록에 행 추가 */
    var list=document.getElementById('bulk-selected-list');
    if(list){
      var row=document.createElement('div');
      row.id='brow-'+date;
      row.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 8px;background:rgba(200,169,110,.06);border-radius:6px;margin-bottom:4px;';
      /* 날짜 표시 */
      var d=parseDateLocal(date);
      var DAYS=['일','월','화','수','목','금','토'];
      var dateLabel=d.getMonth()+1+'월 '+d.getDate()+'일 ('+DAYS[d.getDay()]+')';
      row.innerHTML='<span style="font-size:12px;color:var(--a);flex:1;font-weight:700">'+dateLabel+'</span>'+
        '<select id="bt-'+date+'" data-date="'+date+'" style="font-size:13px;background:var(--s2);color:var(--t);border:1px solid rgba(200,169,110,.3);border-radius:6px;padding:4px 8px;margin-right:6px">'+
        ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'].map(function(t){
          return '<option value="'+t+'"'+(t===defTime?' selected':'')+'>'+t+'</option>';
        }).join('')+
        '</select>'+
        '<button style="background:rgba(200,80,80,.15);border:1px solid rgba(200,80,80,.3);color:var(--r);cursor:pointer;font-size:12px;border-radius:5px;padding:3px 8px;white-space:nowrap" data-date="'+date+'" onclick="cancelBulkDate(this.dataset.date)">✕ 취소</button>';
      row.querySelector('select').onchange=function(){
        window._bulkSelections[this.dataset.date]=this.value;
        updateBulkPreview();
      };
      list.appendChild(row);
    }
  }
  updateBulkPreview();
}

function applyBulkTime(){
  var t=document.getElementById('bulk-time');
  if(!t) return;
  var time=t.value;
  document.querySelectorAll('.bulk-date.sel').forEach(function(el){
    window._bulkSelections[el.dataset.date]=time;
    var tw=document.getElementById('bt-'+el.dataset.date);
    if(tw) tw.value=time;
  });
  updateBulkPreview();
  toast('전체 '+Object.keys(window._bulkSelections).length+'개 날짜에 '+time+' 적용');
}

function updateBulkPreview(){
  var sel=document.querySelectorAll('.bulk-date.sel');
  var p=document.getElementById('bulk-preview');
  if(!p) return;
  if(!sel.length){p.textContent='날짜를 선택하세요';return;}
  var list=[];
  sel.forEach(function(el){
    var t=window._bulkSelections[el.dataset.date]||'시간미설정';
    list.push(el.dataset.date+' '+t);
  });
  p.innerHTML='<span style="color:var(--a);font-weight:600">'+list.length+'개 선택됨:</span> '+list.slice(0,5).join(', ')+(list.length>5?'... 외 '+(list.length-5)+'개':'');
}

function saveBulkSchedule(sid){
  var sel=document.querySelectorAll('.bulk-date.sel');
  if(!sel.length){toast('날짜를 선택해주세요','⚠️');return;}
  var s=students.find(function(x){return x.id===sid;});
  var t=document.getElementById('bulk-time');
  var defTime=t?t.value:'10:00';
  var added=0;
  pushUndo();
  sel.forEach(function(el){
    var ds=el.dataset.date;
    var time=window._bulkSelections[ds]||defTime;
    var d=parseDateLocal(ds);
    var dow=d.getDay();
    var JSDOW2={0:'일',1:'월',2:'화',3:'수',4:'목',5:'금',6:'토'};
    var dayStr=JSDOW2[dow];
    var mon=getMon(d);
    var wk=getWK(mon);
    if(!weekOvr[wk]) weekOvr[wk]={};
    /* 기존 슬롯 가져오기 (고정학생은 기본 스케줄 포함) */
    var base;
    if(sid in (weekOvr[wk]||{})){
      base=(weekOvr[wk][sid]||[]).slice();
    } else if(s&&s.schedType==='fixed'&&s.days&&s.days.length){
      base=s.days.map(function(dd){return{day:dd,time:(s.times&&s.times[dd])||'10:00',absent:false};});
    } else {
      base=[];
    }
    /* 중복 제거 후 추가 */
    var exists=base.some(function(x){return x.day===dayStr&&x.time===time;});
    if(!exists){
      base.push({day:dayStr,time:time,absent:false});
      added++;
    }
    weekOvr[wk][sid]=base;
  });
  saveAll();
  document.getElementById('mBulkSched').remove();
  toast(added+'개 일정 저장됨 📅');
  renderSidebarToday();
  if(page==='schedule'){ge('content').innerHTML=isMobile()?buildMobileSchedule():buildSchedule();}
  else render();
}


function parseDateLocal(ds){
  /* "YYYY-MM-DD" 문자열을 로컬 타임존 기준 Date로 파싱 */
  var p=ds.split('-');
  return new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2]));
}
/* ── 문자 파싱 → 스케줄 자동 등록 ── */
function openSMSParser(){
  var ex=document.getElementById('mSMSParser');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mSMSParser';m.className='ov open';
  m.innerHTML='<div class="modal">'
    +'<div class="mh"><div><div class="mt">📩 문자 일정 파싱</div><div style="font-size:12px;color:var(--tm);margin-top:2px">문자를 붙여넣으면 날짜·시간 자동 인식</div></div>'
    +'<div class="mc" onclick="document.getElementById(\'mSMSParser\').remove()">&#x2715;</div></div>'
    +'<div class="mb">'
    +'<div style="background:var(--ag);border:1px solid var(--b);border-radius:9px;padding:10px 13px;margin-bottom:13px;font-size:12.5px;color:var(--a)">'
    +'💡 예) "선생님 다음주 화요일 3시에 레슨 될까요?" → 자동으로 날짜·시간 추출 후 스케줄 등록</div>'
    +'<div class="f1" style="margin-bottom:12px"><label>문자 내용 붙여넣기</label>'
    +'<textarea id="sms-parse-input" rows="5" placeholder="문자 전체를 붙여넣으세요&#10;&#10;예)&#10;선생님 다음주 화요일 3시에 레슨 될까요?&#10;목요일 오후 2시 변경 부탁드려요"></textarea></div>'
    +'<div id="sms-parse-result" style="min-height:20px"></div>'
    +'</div>'
    +'<div class="mf">'
    +'<button class="btn bg2" onclick="document.getElementById(\'mSMSParser\').remove()">닫기</button>'
    +'<button class="btn bm" onclick="parseSMSText()">🔍 분석하기</button>'
    +'</div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
  setTimeout(function(){var el=document.getElementById('sms-parse-input');if(el)el.focus();},100);
}

function parseSMSText(){
  var text=document.getElementById('sms-parse-input').value.trim();
  if(!text){toast('문자 내용을 입력해주세요','⚠️');return;}
  var result=extractDateTimeFromText(text);
  var box=document.getElementById('sms-parse-result');
  if(!box) return;
  if(!result.day&&!result.date){
    box.innerHTML='<div style="background:rgba(200,114,114,.08);border:1px solid rgba(200,114,114,.2);border-radius:9px;padding:10px 14px;font-size:13px;color:var(--r)">⚠️ 날짜·시간을 인식하지 못했습니다<br><span style="font-size:12px;color:var(--tm);margin-top:4px;display:block">예) "화요일 3시", "다음주 목요일 오후 2시"</span></div>';
    return;
  }
  var timeStr=result.time||'10:00';
  var dayStr=result.day?result.day+'요일':'';
  var dateStr=result.date||'';
  box.innerHTML='<div style="background:rgba(109,200,162,.07);border:1px solid rgba(109,200,162,.2);border-radius:9px;padding:12px 14px;margin-bottom:12px">'
    +'<div style="font-size:12px;font-weight:700;color:var(--g);margin-bottom:8px">✅ 인식 결과</div>'
    +'<div style="display:flex;gap:16px;font-size:13px;color:var(--t);flex-wrap:wrap">'
    +(dateStr?'<span>📅 <b>'+dateStr+'</b></span>':'')
    +(dayStr?'<span>📌 <b>'+dayStr+'</b></span>':'')
    +'<span>⏰ <b>'+timeStr+'</b></span>'
    +'</div></div>'
    +'<div class="f1" style="margin-bottom:10px"><label>레슨생 선택</label>'
    +'<select id="sms-parse-sid" style="font-size:14px">'
    +'<option value="">레슨생을 선택하세요</option>'
    +students.filter(function(s){return s.status==='수강중';}).map(function(s){
      return '<option value="'+s.id+'">'+esc(s.name)+'</option>';
    }).join('')
    +'</select></div>'
    +'<button class="btn bp" style="width:100%;justify-content:center;padding:12px;font-size:14px" onclick="registerParsedSchedule(\''+dayStr+'\',\''+timeStr+'\',\''+dateStr+'\')">📅 스케줄 등록</button>';
}

function extractDateTimeFromText(text){
  var result={day:null,time:null,date:null};
  var now=new Date();
  
  /* 요일 파싱 */
  var dayMap={'월':1,'화':2,'수':3,'목':4,'금':5,'토':6,'일':0};
  var dayNames=['일','월','화','수','목','금','토'];
  
  for(var d in dayMap){
    if(text.indexOf(d+'요일')>=0||text.indexOf(d+'욜')>=0){
      result.day=d;
      /* 다음주 여부 */
      var isNext=text.indexOf('다음주')>=0||text.indexOf('다음 주')>=0||text.indexOf('다음달')>=0;
      var targetDay=dayMap[d];
      var today=now.getDay();
      var diff=targetDay-today;
      if(diff<=0||isNext) diff+=7;
      if(isNext&&diff<7) diff+=7;
      var targetDate=new Date(now);
      targetDate.setDate(now.getDate()+diff);
      result.date=(targetDate.getMonth()+1)+'월 '+targetDate.getDate()+'일';
      break;
    }
  }
  
  /* 날짜 파싱 (3/5, 3월5일) */
  var dateMatch=text.match(/(\d{1,2})[월\/][\s]?(\d{1,2})[일]?/);
  if(dateMatch){
    result.date=dateMatch[1]+'월 '+dateMatch[2]+'일';
    var d2=new Date(now.getFullYear(),parseInt(dateMatch[1])-1,parseInt(dateMatch[2]));
    result.day=dayNames[d2.getDay()];
  }
  
  /* 시간 파싱 */
  var hour=null;
  var pmMatch=text.match(/오후\s*(\d{1,2})시?/);
  var amMatch=text.match(/오전\s*(\d{1,2})시?/);
  var timeMatch=text.match(/(\d{1,2})시\s*(\d{0,2})분?/);
  var colonMatch=text.match(/(\d{1,2}):(\d{2})/);
  
  if(pmMatch){
    hour=parseInt(pmMatch[1]);
    if(hour<12) hour+=12;
  } else if(amMatch){
    hour=parseInt(amMatch[1]);
    if(hour===12) hour=0;
  } else if(timeMatch){
    hour=parseInt(timeMatch[1]);
    /* 애매한 경우 오후로 가정 (10시 이하) */
    if(hour<10) hour+=12;
  } else if(colonMatch){
    hour=parseInt(colonMatch[1]);
  }
  
  if(hour!==null){
    var min=0;
    if(timeMatch&&timeMatch[2]) min=parseInt(timeMatch[2])||0;
    if(colonMatch) min=parseInt(colonMatch[2])||0;
    result.time=String(hour).padStart(2,'0')+':'+String(min).padStart(2,'0');
  }
  
  return result;
}


function registerParsedSchedule(dayStr,timeStr,dateStr){
  var sidEl=document.getElementById('sms-parse-sid');
  if(!sidEl||!sidEl.value){toast('레슨생을 선택해주세요','⚠️');return;}
  var sid=sidEl.value;
  var s=students.find(function(x){return x.id===sid;});
  if(!s) return;
  
  /* 날짜 계산 */
  var day=dayStr.replace('요일','');
  var dayMap2={'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};
  var targetDayNum=dayMap2[day];
  var now=new Date();
  var diff=(targetDayNum-now.getDay()+7)%7||7;
  var targetDate=new Date(now);
  targetDate.setDate(now.getDate()+diff);
  
  var mon=getMonday(targetDate);
  var wk=getWK(mon);
  if(!weekOvr[wk]) weekOvr[wk]={};
  if(!weekOvr[wk][sid]) weekOvr[wk][sid]=[];
  
  var exists=weekOvr[wk][sid].some(function(x){return x.day===day&&x.time===timeStr;});
  if(!exists){
    weekOvr[wk][sid].push({day:day,time:timeStr,absent:false});
    saveAll();
    toast(s.name+' '+dayStr+' '+timeStr+' 등록 완료 ✅');
    document.getElementById('mSMSParser').remove();
    if(page==='schedule') render();
  } else {
    toast('이미 등록된 일정입니다','⚠️');
  }
}
function calcAgeStr(s){
  var raw=s&&s.age?String(s.age).trim():'';
  if(!raw) return '';
  var n=parseInt(raw)||0;
  var yr=raw.length<=2&&n>=0?(n>=30?1900+n:2000+n):n;
  var ty=new Date().getFullYear();
  return (yr>=1920&&yr<=ty)?'만 '+(ty-yr)+'세':'';
}
function mSchedDay(){mobileSchedView='day';render();}
function mSchedWeek(){mobileSchedView='week';render();}
function mWkPrev(){wkOfs--;mobileSchedDay=(new Date().getDay()===0)?6:(new Date().getDay()-1);loadHolidaysForView(function(){mSR();});}
function mWkNext(){wkOfs++;mobileSchedDay=(new Date().getDay()===0)?6:(new Date().getDay()-1);loadHolidaysForView(function(){mSR();});}
function mSelDay(i){mobileSchedDay=i;mSR();}





function buildMobileWeekView(mon,sched,todayStr,isThis,flexS,unassignedFlex){
  var now=new Date();
  var o='';

  /* 전체 래퍼 — 뷰전환탭(42)+페이지헤더(40)+하단탭(60)+safe(34) = 176 */
  o+='<div class="mwv-wrap" style="display:flex;flex-direction:column;height:calc(100vh - 176px - env(safe-area-inset-bottom,0px) - env(safe-area-inset-top,0px));min-height:0">';

  /* 상단 바: 년월 + 버튼 한 줄 */
  o+='<div style="display:flex;align-items:center;padding:1px 6px;flex-shrink:0;gap:3px">';
  o+='<span style="font-size:10px;font-weight:700;color:var(--a)">'+(function(m){var s=m.getMonth()+1,e=addDays(m,6).getMonth()+1;return s+'월';})(mon)+'</span>';
  if(unassignedFlex.length>0) o+='<span style="font-size:8px;color:var(--r)">⚠'+unassignedFlex.length+'</span>';
  o+='<span style="flex:1"></span>';
  if(flexS.length&&isThis) o+='<button class="btn bm bsm" style="padding:1px 5px;font-size:8px" onclick="openFlexWeek()">변동</button>';
  o+='<button class="btn bg2 bsm" style="padding:1px 5px;font-size:8px" onclick="openWE()">수정</button>';
  o+='<button class="btn bg2 bsm" style="padding:1px 5px;font-size:8px" onclick="undoAction()">↩</button>';
  o+='</div>';

  /* 헤더 + 시간 그리드를 하나의 flex column으로 */
  o+='<div style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden">';

  /* 요일 헤더 행 */
  o+='<div style="display:grid;grid-template-columns:20px repeat(7,1fr);flex-shrink:0">';
  o+='<div style="background:var(--s1);border-bottom:1px solid var(--b2)"></div>';
  ALL7.forEach(function(d,i){
    var dd=addDays(mon,i);
    var ddStr=toDS(dd);
    var isToday=(ddStr===todayStr);
    var isHol=isHoliday(ddStr);
    var numColor=isToday?'#fff':(isHol?'var(--r)':'var(--ts)');
    var numBg=isToday?'var(--a)':(isHol?'rgba(200,80,80,.18)':'transparent');
    var dayColor=isHol?'var(--r)':(d==='\uc77c'?'var(--r)':'var(--tm)');
    o+='<div style="border-bottom:1px solid var(--b2);border-left:1px solid var(--b);text-align:center;padding:0;background:'+(isHol?'rgba(200,80,80,.06)':'var(--s1)')+'">';
    o+='<div style="font-size:7px;color:'+dayColor+';font-weight:700;line-height:1.1">'+d+'</div>';
    o+='<div style="width:14px;height:14px;border-radius:50%;background:'+numBg+';display:inline-flex;align-items:center;justify-content:center">';
    o+='<span style="font-size:8px;font-weight:700;color:'+numColor+'">'+dd.getDate()+'</span></div>';
    o+='</div>';
  });
  o+='</div>';

  /* 시간 그리드 — 1fr 균등분배로 12행 꽉 채움 */
  o+='<div class="mwv" style="flex:1;min-height:0;display:grid;grid-template-columns:20px repeat(7,1fr);grid-template-rows:repeat('+HRS_LBL.length+',1fr);overflow-y:auto;overflow-x:hidden">';

  var nowH2=now.getHours(),nowMin2=now.getMinutes();
  var nowTotalMin2=nowH2*60+nowMin2;
  HRS_LBL.forEach(function(h){
    var hNum2=parseInt(h);
    var isNowRow2=isThis&&(nowTotalMin2>=hNum2*60&&nowTotalMin2<hNum2*60+60);
    /* 시간 레이블 */
    o+='<div style="font-size:7px;font-family:DM Mono,monospace;color:'+(isNowRow2?'var(--a)':'var(--tm)')+';font-weight:'+(isNowRow2?'700':'400')+';text-align:right;padding:0 1px;border-top:1px solid var(--b);border-right:1.5px solid '+(isNowRow2?'var(--a)':'var(--b2)')+';display:flex;align-items:flex-start;justify-content:flex-end">'+hNum2+'</div>';
    ALL7.forEach(function(d,i){
      var dd=addDays(mon,i);
      var ddStr=toDS(dd);
      var isOff2=isOffDay(ddStr);
      var isHol2=isHoliday(ddStr);
      var isToday2=(ddStr===todayStr);
      var slots=sched[d+'_'+h]||[];
      var bgColor=isHol2?'rgba(200,80,80,.04)':(isToday2?'rgba(200,169,110,.04)':'transparent');
      o+='<div data-cell="1" data-offday="'+(isOff2?'1':'0')+'" data-day="'+d+'" data-time="'+h+'" data-date="'+ddStr+'" style="border-top:1px solid var(--b);border-left:1px solid var(--b);background:'+bgColor+';cursor:pointer;overflow:hidden;display:flex;flex-wrap:wrap;align-content:start;gap:1px;padding:1px">';
      slots.forEach(function(x){
        var c=gc(x.s);
        var _ph=getStudentPhoto(x.s)||x.s.photo;
        /* 사각형 사진 + 이름 아래 */
        o+='<div class="lb '+x.type+(x.absent?' absent-block':'')+'" style="display:flex;flex-direction:column;align-items:center;color:'+c+';border:none;background:none;padding:0;min-height:0;border-radius:0;box-shadow:none;margin:0;gap:0;cursor:pointer;width:100%;overflow:hidden"';
        o+=' data-sid="'+x.s.id+'" data-time="'+x.time+'" data-date="'+ddStr+'"';
        o+=' onclick="event.stopPropagation();lbClick(this)" oncontextmenu="event.preventDefault();event.stopPropagation();lbRightClick(this)">';
        if(_ph){
          o+='<img src="'+_ph+'" style="width:22px;height:22px;border-radius:3px;object-fit:cover;display:block" onerror="this.outerHTML=\'<div style=\\\'width:22px;height:22px;border-radius:3px;background:'+c+'22;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:'+c+'\\\'>'+esc(x.s.name.slice(0,1))+'</div>\'">';
        } else {
          o+='<div style="width:22px;height:22px;border-radius:3px;background:'+c+'22;border:1px solid '+c+'44;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:'+c+'">'+esc(x.s.name.slice(0,1))+'</div>';
        }
        o+='<div style="font-size:7px;font-weight:600;color:'+c+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center;line-height:1.1">'+esc(x.s.name)+'</div>';
        o+='</div>';
      });
      o+='</div>';
    });
  });

  o+='</div>'; /* mwv grid */
  o+='</div>'; /* flex column */
  o+='</div>'; /* 100vh wrap */

  /* FAB */
  o+='<div style="position:fixed;bottom:calc(70px + env(safe-area-inset-bottom,0px));right:14px;z-index:9000">';
  o+='<button onclick="openQuickSlot()" style="width:44px;height:44px;border-radius:50%;background:var(--a);border:none;color:#08080d;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(200,169,110,.4);font-weight:700">＋</button>';
  o+='</div>';

  return o;
}


function buildMobileSchedule(){
  var mon=getViewMon(),now=new Date(),todayStr=toDS(now),isThis=wkOfs===0;
  var sched=getWeekSched(mon);
  var flexS=students.filter(function(s){return s.status==='수강중'&&s.schedType==='flex';});
  var _wkKey=getWK(mon);
  var _fixedUnassigned=students.filter(function(s){
    if(s.status!=='수강중'||s.schedType!=='fixed') return false;
    var hasDays=s.days&&s.days.length>0;
    var hasWkOvr=weekOvr[_wkKey]&&weekOvr[_wkKey][s.id]&&weekOvr[_wkKey][s.id].length>0;
    return !hasDays&&!hasWkOvr;
  });
  var unassignedFlex=flexS.filter(function(s){
    var wk2=getWK(mon);
    return !weekOvr[wk2]||!weekOvr[wk2][s.id]||weekOvr[wk2][s.id].length===0;
  }).concat(_fixedUnassigned);
  var d=ALL7[mobileSchedDay];
  var dd=addDays(mon,mobileSchedDay);
  var ddStr=toDS(dd);
  var isToday=(ddStr===todayStr);

  /* 뷰 전환 탭 */
  var vDay=(mobileSchedView==='day');
  var o='';
  o+='<div style="display:flex;background:var(--s1);border-bottom:1px solid var(--b);position:sticky;top:0;z-index:20;padding:4px 8px;gap:4px">';
  o+='<div onclick="mSchedDay()" style="flex:1;padding:8px;text-align:center;font-size:13px;font-weight:700;cursor:pointer;border-radius:8px;transition:all .14s;'+(vDay?'background:var(--season-accent,var(--a));color:#fff;':'color:var(--ts);')+'">📅 일별</div>';
  o+='<div onclick="mSchedWeek()" style="flex:1;padding:8px;text-align:center;font-size:13px;font-weight:700;cursor:pointer;border-radius:8px;transition:all .14s;'+(!vDay?'background:var(--season-accent,var(--a));color:#fff;':'color:var(--ts);')+'">📊 주간</div>';
  o+='</div>';

  /* 주간 보기 모드 */
  if(mobileSchedView==='week'){
    o+=buildMobileWeekView(mon,sched,todayStr,isThis,flexS,unassignedFlex);
    return o;
  }

  /* 주 네비게이션 */
  o+='<div style="background:var(--s1);border-bottom:1px solid var(--b);padding:8px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px">';
  o+='<button class="wn-btn" onclick="mWkPrev()">&#8249;</button>';
  o+='<span style="font-size:12.5px;font-weight:600;color:'+(isThis?'var(--a)':'var(--t)')+';font-family:DM Mono,monospace" id="wkLbl">'+mon.getFullYear()+'년 '+(mon.getMonth()+1)+'월 '+mon.getDate()+'일 주'+(isThis?' (이번 주)':'')+'</span>';
  o+='<button class="wn-btn" onclick="mWkNext()">&#8250;</button>';
  o+='</div>';

  /* 요일 탭 */
  o+='<div style="display:flex;background:var(--s1);border-bottom:1px solid var(--b);box-shadow:0 2px 8px rgba(0,0,0,.06);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;position:sticky;top:0;z-index:29;padding:6px 6px 0">';
  ALL7.forEach(function(day,i){
    var dayDd=addDays(mon,i);
    var dayStr=toDS(dayDd);
    var isT=(dayStr===todayStr);
    var isSel=(i===mobileSchedDay);
    var isSun=(day==='일');
    var hasSched=HRS_LBL.some(function(h){return (sched[day+'_'+h]||[]).length>0;});
    var slotCnt=HRS_LBL.reduce(function(acc,h){return acc+(sched[day+'_'+h]||[]).length;},0);
    var numColor=isSel?'#fff':(isT?'var(--season-accent,var(--a))':'var(--ts)');
    var dayColor=isSun?'var(--r)':(isSel?'#fff':'var(--tm)');
    var numBg=isSel?'var(--season-accent,var(--a))':(isT?'var(--ag2)':'transparent');
    o+='<div data-daysel="'+i+'" style="flex:1;min-width:42px;padding:0 2px 8px;text-align:center;cursor:pointer;border-bottom:3px solid '+(isSel?'var(--season-accent,var(--a))':'transparent')+';transition:all .13s;-webkit-tap-highlight-color:rgba(200,169,110,.2)">';
    o+='<div style="font-size:10px;font-weight:700;color:'+dayColor+';margin-bottom:3px">'+day+'</div>';
    o+='<div style="width:34px;height:34px;border-radius:50%;background:'+numBg+';display:flex;align-items:center;justify-content:center;margin:0 auto 3px">';
    o+='<span style="font-size:13px;font-weight:700;color:'+numColor+'">'+dayDd.getDate()+'</span></div>';
    /* 레슨 수 도트 */
    o+='<div style="height:5px;display:flex;align-items:center;justify-content:center;gap:2px">';
    if(slotCnt>0){
      var maxDots=Math.min(slotCnt,4);
      for(var di=0;di<maxDots;di++){
        o+='<div style="width:4px;height:4px;border-radius:50%;background:'+(isSel?'rgba(255,255,255,.7)':'var(--season-accent,var(--a))')+'"></div>';
      }
    }
    o+='</div>';
    o+='</div>';
  });
  o+='</div>';

  /* 날짜 헤더 */
  o+='<div style="padding:12px 16px 6px;display:flex;align-items:center;justify-content:space-between">';
  var todayBadge=isToday?'<span style="font-size:11px;background:var(--season-accent,var(--a));color:#fff;border-radius:5px;padding:2px 7px;font-weight:700;margin-left:6px">오늘</span>':'';
  var offBadge=isOffDay(ddStr)
    ?'<span style="font-size:11px;background:'+(isHoliday(ddStr)?'rgba(200,114,114,.15)':'rgba(255,255,255,.08)')+';color:'+(isHoliday(ddStr)?'var(--r)':'var(--tm)')+';border-radius:5px;padding:2px 7px;font-weight:600;margin-left:6px">'+getOffLabel(ddStr)+'</span>'
    :'';
  o+='<span style="font-size:15px;font-weight:700;color:'+(isToday?'var(--a)':'var(--t)')+'">'+d+'요일'+todayBadge+offBadge+'</span>';
  if(flexS.length&&isThis){o+='<button class="btn bsm bm" onclick="openFlexWeek()">🔄 변동 배정</button>';}
  o+='</div>';

  /* 미배정 경고 */
  if(unassignedFlex.length>0){
    o+='<div style="margin:0 14px 8px;background:rgba(200,114,114,.08);border-left:3px solid var(--r);padding:8px 12px;font-size:12px;color:var(--r);border-radius:0 6px 6px 0">⚠️ 미배정: '+unassignedFlex.map(function(s){return esc(s.name);}).join(', ')+'</div>';
  }

  /* 시간대별 목록 */
  var hasAnyToday=false;
  o+='<div style="padding:0 14px 80px">';
  HRS_LBL.forEach(function(h){
    var slots=sched[d+'_'+h]||[];
    if(slots.length===0){
      var mIsOff=isOffDay(ddStr);
      o+='<div data-cell="1" data-offday="'+(mIsOff?'1':'0')+'" data-day="'+d+'" data-time="'+h+'" data-date="'+ddStr+'" style="display:flex;align-items:stretch;min-height:52px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;-webkit-tap-highlight-color:rgba(200,169,110,.15);background:'+(mIsOff?'rgba(255,255,255,.02)':'transparent')+'">';
      o+='<div style="width:46px;flex-shrink:0;padding-top:6px;font-size:11px;font-family:\'DM Mono\',monospace;color:var(--tm);text-align:right;padding-right:10px;pointer-events:none">'+h+'</div>';
      o+='<div style="flex:1;border-left:1px solid rgba(255,255,255,.06);padding:6px 0 6px 10px;display:flex;align-items:center;pointer-events:none"><span style="font-size:24px;color:var(--a);opacity:.4;font-weight:300">+</span></div>';
      o+='</div>';
    } else {
      hasAnyToday=true;
      o+='<div style="display:flex;align-items:flex-start;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">';
      o+='<div style="width:50px;flex-shrink:0;padding-top:14px;font-size:12px;font-family:\'DM Mono\',monospace;color:var(--tm);text-align:right;padding-right:10px">'+h+'</div>';
      o+='<div style="flex:1;border-left:1px solid rgba(255,255,255,.06);padding:4px 0 4px 10px;display:flex;flex-direction:column;gap:6px">';
      slots.forEach(function(x){
        var c=gc(x.s);
        var avHtml=(getStudentPhoto(x.s)||x.s.photo)
          ?'<img src="'+(getStudentPhoto(x.s)||x.s.photo)+'" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid '+c+'88">'
          :'<div style="width:48px;height:48px;border-radius:50%;background:'+c+'44;border:2px solid '+c+'88;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:'+c+';flex-shrink:0">'+esc(x.s.name.slice(0,1))+'</div>';
        o+='<div class="lb '+x.type+(x.absent?' absent-block':'')+'" style="color:'+c+';border-color:'+c+'55;background:'+c+'18;padding:12px 14px;min-height:62px;border-radius:12px;display:flex;align-items:center;gap:10px"';
        o+=' data-sid="'+x.s.id+'" data-time="'+x.time+'" data-date="'+ddStr+'"';
        o+=' onclick="event.stopPropagation();lbClick(this)" oncontextmenu="event.preventDefault();event.stopPropagation();lbRightClick(this)">';
        o+=avHtml;
        o+='<div style="flex:1"><div style="font-size:14px;font-weight:700;color:'+c+'">'+esc(x.s.name)+(calcAgeStr(x.s)?' <span style="font-size:10px;font-weight:400;opacity:.7">'+calcAgeStr(x.s)+'</span>':'')+'</div>';
        o+='<div style="font-size:11px;color:'+c+'99;margin-top:2px">'+(x.s.age?(function(a){var raw=String(a||'').trim();if(!raw)return '';var n=parseInt(raw)||0;var yr=raw.length<=2&&n>=0?(n>=30?1900+n:2000+n):n;var ty=new Date().getFullYear();return (yr>=1920&&yr<=ty)?'만 '+(ty-yr)+'세':'';})(x.s.age)+'  · ':'')+esc(x.s.ph||'')+'</div>';
        o+='<div style="font-size:10px;margin-top:3px;opacity:.7">'+(x.type==='flex-sched'?'🔄 변동':'📌 고정')+'</div></div>';
        o+='<div style="font-size:13px;color:'+c+';font-weight:700;font-family:\'DM Mono\',monospace;background:'+c+'22;padding:3px 8px;border-radius:6px">'+x.time+'</div>';
        o+='</div>';
      });
      o+='</div></div>';
    }
  });
  if(!hasAnyToday){
    o+='<div style="text-align:center;padding:40px 20px;color:var(--tm)">';
    o+='<div style="font-size:36px;margin-bottom:10px;opacity:.3">📅</div>';
    o+='<div style="font-size:14px;font-weight:600;color:var(--ts)">레슨 없음</div>';
    o+='<div style="font-size:12px;margin-top:4px">시간대를 탭해서 배정하세요</div></div>';
  }
  o+='</div>';

  /* FAB 버튼 */
  o+='<div style="position:fixed;bottom:calc(80px + env(safe-area-inset-bottom,0px));right:16px;display:flex;flex-direction:column;gap:8px;z-index:9000">';
  o+='<button onclick="openQuickSlot()" style="width:52px;height:52px;border-radius:50%;background:var(--season-accent,var(--a));border:none;color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px var(--season-glow,rgba(200,169,110,.35));font-weight:700">＋</button>';
  if(flexS.length&&isThis){
    o+='<button onclick="openFlexWeek()" style="width:44px;height:44px;border-radius:50%;background:rgba(110,163,200,.2);border:1px solid var(--bl);color:var(--bl);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">🔄</button>';
  }
  if(isThis){
    o+='<button onclick="undoAction()" style="width:40px;height:40px;border-radius:50%;background:var(--ag);border:1px solid var(--b);color:var(--ts);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">↩️</button>';
  }
  o+='</div>';
  return o;
}


function buildSchedule(){
  var mon=getViewMon(),now=new Date(),todayStr=toDS(now),isThis=wkOfs===0;
  var sched=getWeekSched(mon);
  var flexS=students.filter(function(s){return s.status==='수강중'&&s.schedType==='flex';});
  var activeCnt=students.filter(function(s){return s.status==='수강중';}).length;
  /* 미배정 변동 학생 경고 */
  var unassignedFlex=flexS.filter(function(s){var wk2=getWK(mon);return !weekOvr[wk2]||!weekOvr[wk2][s.id]||weekOvr[wk2][s.id].length===0;});
  setTimeout(function(){var el=ge('wkLbl');if(el)el.textContent=fmtS(mon)+' ~ '+fmtS(addDays(mon,6));},0);

  /* 변동 학생이 있을 때만 배너 표시 */
  var unassignedBanner=(flexS.length>0&&unassignedFlex.length>0)
    ?'<div style="background:rgba(200,114,114,.08);border-left:3px solid var(--r);padding:9px 16px;font-size:13px;color:var(--r)">⚠️ 미배정: '+unassignedFlex.map(function(s){return esc(s.name);}).join(', ')+'</div>'
    :'';
  var o='<div class="card">'+unassignedBanner+'<div class="ch"><span class="ct">📅 '+mon.getFullYear()+'년 '+(isThis?'이번 주 ':'')+'스케줄 <span style="font-size:13px;color:var(--tm);font-weight:400;margin-left:6px">'+fmtS(mon)+' ~ '+fmtS(addDays(mon,6))+'</span></span>';
  o+='<span style="font-size:12.5px;color:var(--a);font-weight:600">수강중 '+activeCnt+'명</span></div>';
  if(flexS.length&&isThis){
    var fnames=flexS.map(function(s){return esc(s.name);}).join(', ');
    o+='<div style="padding:10px 22px;background:rgba(110,163,200,.08);border-bottom:1px solid var(--b);display:flex;align-items:center;justify-content:space-between"><span style="font-size:13px;color:var(--bl)">🔄 변동: '+fnames+'</span><button class="btn bsm" style="background:rgba(110,163,200,.14);color:var(--bl);border:1px solid rgba(110,163,200,.22)" onclick="openFlexWeek()">이번 주 배정</button><div style="display:flex;gap:4px;margin-left:6px"><button class="btn bg2 bsm" onclick="undoAction()" title="Ctrl+Z">↩️</button><button class="btn bg2 bsm" onclick="redoAction()" title="Ctrl+Y">↪️</button><button class="btn bg2 bsm" onclick="resetWeekOvr()" style="background:rgba(200,114,114,.1);color:var(--r)">초기화</button></div></div>';
  }
    var _sunW=_cfg.sunCollapsed?'28px':'1fr';
  var _monW=_cfg.monCollapsed?'28px':'1fr';
  o+='<div class="sg-scroll"><div class="sg" style="grid-template-columns:66px '+_monW+' 1fr 1fr 1fr 1fr 1fr '+_sunW+'">';
  o+='<div class="sg-hd" style="border-right:2px solid var(--b2)"></div>';
  ALL7.forEach(function(d,i){
    var dd=addDays(mon,i);var isToday=toDS(dd)===todayStr;var isSun=d==='일';var isMon=d==='월';
    var ddStr2=toDS(dd);var isOff=isOffDay(ddStr2);var isHol=isHoliday(ddStr2);var offLbl=getOffLabel(ddStr2);
    var dayColor=isToday?'var(--season-accent,var(--a))':(isHol?'var(--r)':isSun?'var(--r)':'var(--ts)');
    var _isSunC=isSun&&_cfg.sunCollapsed;
    var _isMonC=isMon&&_cfg.monCollapsed;
    var _isSunH=isSun&&_cfg.sunHidden;
    var _isMonH=isMon&&_cfg.monHidden;
    o+='<div class="sg-hd'+(isToday?' td':'')+(isSun?' sun':'')+(isOff?' off-day':'')+(isSun&&_cfg.sunHidden?' vs-hide-sun':'')+(isMon&&_cfg.monHidden?' vs-hide-mon':'')+'" style="'+(_isSunC||_isMonC?'writing-mode:vertical-rl;text-orientation:mixed;padding:8px 3px;cursor:pointer;':'')+'"';
    if(isSun)o+=' onclick="toggleSunCollapse()" title="일요일 접기/펼치기"';
    else if(isMon)o+=' onclick="toggleMonCollapse()" title="월요일 접기/펼치기"';
    o+='>';
    if(_isSunC||_isMonC){
      o+='<div style="font-size:11px;font-weight:700;color:var(--tm)">'+d+'</div>';
    } else {
      o+='<div class="dn" style="color:'+dayColor+'">'+d+'요일</div>';
      o+='<div class="dd" style="color:'+(isHol?'var(--r)':'')+'">'+fmtS(dd)+'</div>';
      if(isOff)o+='<div style="font-size:9px;color:'+(isHol?'var(--r)':'var(--tm)')+';margin-top:2px;font-weight:600">'+offLbl+'</div>';
    }
    o+='</div>';
  });
  var nowH=now.getHours(),nowMin=now.getMinutes();
  var nowTotalMin=nowH*60+nowMin;
  HRS_LBL.forEach(function(h){
    var hNum=parseInt(h);
    var hTotalMin=hNum*60;
    var isNowRow=isThis&&(nowTotalMin>=hTotalMin&&nowTotalMin<hTotalMin+60);
    var nowPct=isNowRow?Math.round((nowTotalMin-hTotalMin)/60*100):0;
    o+='<div class="sg-tm" style="'+(isNowRow?'color:var(--a);font-weight:700;border-right-color:var(--a);':'')+'">'+h+'</div>';
    ALL7.forEach(function(d,i){
      var dd=addDays(mon,i);var isToday=toDS(dd)===todayStr;var isSun=d==='일';var isMon=d==='월';
      var ddStr=toDS(dd);
      var isOff2=isOffDay(ddStr);
      var _collapsed=(isSun&&_cfg.sunCollapsed)||(isMon&&_cfg.monCollapsed);
      var _hidden=(isSun&&_cfg.sunHidden)||(isMon&&_cfg.monHidden);
      var _cellBg=isNowRow?(isToday?'rgba(200,169,110,.07)':'rgba(200,169,110,.03)'):'';
      var _nowLineHtml='';
      if(isNowRow&&isToday&&!_collapsed){
        _nowLineHtml='<div style="position:absolute;left:0;right:0;top:'+nowPct+'%;height:2px;background:var(--a);z-index:3;pointer-events:none"><div style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:var(--a)"></div></div>';
      }
      o+='<div class="sg-cell'+(isToday?' td-col':'')+(isSun?' sun-col':'')+(isMon?' mon-col':'')+(isOff2?' off-col':'')+(isSun&&_cfg.sunHidden?' vs-hide-sun':'')+(isMon&&_cfg.monHidden?' vs-hide-mon':'')+'" data-day="'+d+'" data-h="'+h+'" data-date="'+ddStr+'" onclick="'+(isOff2?'cellClickOffDay(this)':(_collapsed?'':' cellClickEl(this)'))+'" style="position:relative;'+(_cellBg?'background:'+_cellBg+';':'')+'">'
        +_nowLineHtml+(_collapsed?'':'');
      if(!_collapsed)(sched[d+'_'+h]||[]).forEach(function(x){
        var c=gc(x.s);
        var sLogs=logs.filter(function(l){return l.sid===x.s.id;});
        var attCnt=sLogs.filter(function(l){return l.att==='출석';}).length;
        var attRate=sLogs.length?Math.round(attCnt/sLogs.length*100):null;
        var lastLog=sLogs[0];
        var avHtml=(getStudentPhoto(x.s)||x.s.photo)
          ?'<img src="'+(getStudentPhoto(x.s)||x.s.photo)+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid '+c+'99;cursor:zoom-in" onclick="event.stopPropagation();openLightbox(this.src)">'
          :'<div style="width:36px;height:36px;border-radius:50%;background:'+c+'44;border:1.5px solid '+c+'88;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:'+c+';flex-shrink:0">'+esc(x.s.name.slice(0,1))+'</div>';
        o+='<div class="lb '+x.type+(x.absent?' absent-block':'')+'" style="color:'+c+';border-color:'+c+'55;background:'+c+'1a;gap:7px;padding:7px 9px;min-height:0;border-radius:9px"';
        o+=' data-sid="'+x.s.id+'" data-time="'+x.time+'" data-date="'+ddStr+'"';
        o+=' onclick="event.stopPropagation();lbClick(this)" oncontextmenu="event.preventDefault();event.stopPropagation();lbRightClick(this)"';
        o+='>';
        o+=avHtml;
        o+='<div class="li" style="min-width:0;flex:1">';
        /* 이름 + 반 */
        o+='<div style="display:flex;align-items:center;gap:4px;flex-wrap:nowrap">';
        o+='<span class="ln" style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(x.s.name)+'</span>';
        o+='<span style="font-size:10px;opacity:.65;flex-shrink:0">'+clsL(x.s.cls||'pro')+'</span>';
        o+='</div>';
        /* 연락처 */
        if(x.s.ph)o+='<div style="font-size:11px;color:'+c+'99;font-family:DM Mono,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.s.ph)+'</div>';
        var _sciPC=getCycleInfo(x.s);
        o+='<div style="font-size:10.5px;color:'+c+'99;margin-top:1px"><b>'+_sciPC.totalLessons+'회차</b></div>';
        /* 스케줄 타입 */
        o+='<div class="ls" style="font-size:10px;margin-top:1px">'+(x.type==='flex-sched'?'🔄변동':'📌고정')+'</div>';
        o+='</div></div>';
      });
      var hasAny=(sched[d+'_'+h]||[]).length;
      if(!hasAny&&!_collapsed)o+='<div class="cell-add">+</div>';
      o+='</div>';
    });
  });
  o+='</div></div></div>';
  return o;
}


function removeSlotFromMenu(sid,time,dateStr){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var mon=getMon(new Date(dateStr)),wk=getWK(mon);
  var day=['일','월','화','수','목','금','토'][new Date(dateStr).getDay()];
  pushUndo();
  if(!weekOvr[wk])weekOvr[wk]={};
  if(s.schedType==='flex'){
    var slots=(weekOvr[wk][sid]||[]).filter(function(sl){return !(sl.day===day&&sl.time===time);});
    weekOvr[wk][sid]=slots;
  } else {
    var base=(sid in (weekOvr[wk]||{}))
      ?(weekOvr[wk][sid]||[]).slice()
      :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
    /* time이 일치하는 슬롯 제거, 없으면 같은 day의 슬롯 제거 */
    var exact=base.filter(function(sl){return !(sl.day===day&&sl.time===time);});
    if(exact.length===base.length){
      /* time 불일치 → day 기준으로만 제거 */
      exact=base.filter(function(sl){return sl.day!==day;});
    }
    weekOvr[wk][sid]=exact;
  }
  saveAll();renderSidebarToday();
  if(page==='schedule'){ge('content').innerHTML=isMobile()?buildMobileSchedule():buildSchedule();}
  else render();
  toast(esc(s.name)+' 슬롯 제거됨 🗑');
}

function lbRightClick(el){
  var sid=el.dataset.sid,time=el.dataset.time,date=el.dataset.date;
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var ex=document.getElementById('mLbRight');if(ex)ex.remove();
  /* 우클릭은 lbClick으로 통합 */
  lbClick(el);
}
function closeLbOpt(){var e=document.getElementById('mLbOpt');if(e)e.remove();}
function lbClick(el){
  var sid=el.dataset.sid,time=el.dataset.time,date=el.dataset.date;
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var ex=document.getElementById('mLbOpt');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mLbOpt';m.className='ov open';
  var c=gc(s);
  var av=getStudentPhoto(s)
    ?'<img src="'+getStudentPhoto(s)+'" style="width:52px;height:52px;border-radius:10px;object-fit:cover">'
    :'<div style="width:52px;height:52px;border-radius:10px;background:'+c+'22;border:1px solid '+c+'44;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:'+c+'">'+esc(s.name.slice(0,1))+'</div>';
  var JSDOW2={0:'일',1:'월',2:'화',3:'수',4:'목',5:'금',6:'토'};
  var dayStr2=JSDOW2[new Date(date).getDay()];
  var tl=logs.find(function(l){return l.sid===sid&&l.date===date;});
  var html='<div class="modal" style="max-width:310px">'
    /* 헤더 — 클릭 시 수정 모달 */
    +'<div style="padding:16px 20px 14px;border-bottom:1px solid var(--b);display:flex;align-items:center;gap:12px">'
    +av
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-size:16px;font-weight:800;color:var(--t)">'+esc(s.name)+'</div>'
    +'<div style="font-size:12px;color:var(--tm);margin-top:2px;font-family:DM Mono,monospace">'+date+' &nbsp;'+time+'</div>'
    +'</div>'
    +'<div class="mc" onclick="closeLbOpt()">&#x2715;</div>'
    +'</div>'
    /* 액션 버튼들 */
    +'<div style="padding:12px 16px;display:flex;flex-direction:column;gap:7px">'
    /* 레슨 기록 — 가장 주요 액션 */
    +'<button class="btn bp" style="justify-content:flex-start;padding:12px 14px;gap:10px;font-size:14px" data-sid="'+sid+'" data-time="'+time+'" data-date="'+date+'" onclick="closeLbOpt();openLessonRecord(this.dataset.sid,this.dataset.time,this.dataset.date)">'
    +'<span style="font-size:18px">'+(tl?'✎':'✍️')+'</span>'
    +(tl?'레슨 기록 수정':'레슨 기록 작성')
    +'</button>'
    /* 전화/문자 */
    +(s.ph
      ?'<div style="display:flex;gap:6px">'
      +'<a href="tel:'+s.ph+'" class="btn" style="flex:1;justify-content:center;padding:10px;background:rgba(109,200,162,.1);color:var(--g);border:1px solid rgba(109,200,162,.2);text-decoration:none;font-size:13px">📞 전화</a>'
      +'<a href="sms:'+s.ph+'" class="btn" style="flex:1;justify-content:center;padding:10px;background:rgba(110,163,200,.1);color:var(--bl);border:1px solid rgba(110,163,200,.2);text-decoration:none;font-size:13px">💬 문자</a>'
      +'</div>':''
    )
    /* 슬롯 추가 */
    +'<button class="btn bg2" style="justify-content:flex-start;padding:10px 14px;gap:10px;font-size:13px" data-day="'+dayStr2+'" data-time="'+time+'" data-date="'+date+'" onclick="closeLbOpt();cellClick(this.dataset.day,this.dataset.time,this.dataset.date)">➕ 이 슬롯에 다른 레슨생 추가</button>'
    /* 일정 변경 */
    +'<button class="btn bm" style="justify-content:flex-start;padding:10px 14px;gap:10px;font-size:13px" data-sid="'+sid+'" data-time="'+time+'" data-date="'+date+'" onclick="closeLbOpt();openTempReschedule(this.dataset.sid,this.dataset.time,this.dataset.date)">📅 이번 주 일정 변경</button>'
    /* 레슨생 수정 */
    +'<button class="btn bg2" style="justify-content:flex-start;padding:10px 14px;gap:10px;font-size:13px" data-sid="'+sid+'" onclick="closeLbOpt();setTimeout(function(){openSModal(\''+sid+'\')},80)">✏️ 레슨생 정보 수정</button>'
    /* 회차 수정 */
    +'<button class="btn bm" style="justify-content:flex-start;padding:10px 14px;gap:10px;font-size:13px;background:rgba(200,169,110,.08);color:var(--a);border:1px solid var(--b)" data-sid="'+sid+'" onclick="closeLbOpt();openEditLessonCount(this.dataset.sid)">✏️ 회차 수정 (현재 '+getCycleInfo(s).totalLessons+'회)</button>'
    /* 슬롯 비우기 — 위험 액션 맨 아래 */
    +'<button class="btn bd" style="justify-content:flex-start;padding:10px 14px;gap:10px;font-size:13px" data-sid="'+sid+'" data-time="'+time+'" data-date="'+date+'" onclick="closeLbOpt();removeSlotFromMenu(this.dataset.sid,this.dataset.time,this.dataset.date)">🗑 이 슬롯 비우기</button>'
    +'</div></div>';
  m.innerHTML=html;
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
}
function markAbsentFromLb(btn){
  var sid=btn.dataset.sid,time=btn.dataset.time,date=btn.dataset.date;
  var mon=getMon(new Date(date)),wk=getWK(mon);
  var dayNames=['일','월','화','수','목','금','토'];
  var day=dayNames[new Date(date).getDay()];
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  if(!weekOvr[wk])weekOvr[wk]={};
  var base=(sid in (weekOvr[wk]||{}))
    ?(weekOvr[wk][sid]||[]).slice()
    :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
  var idx=base.findIndex(function(sl){return sl.day===day&&sl.time===time;});
  if(idx>=0)base[idx].absent=true;
  else base.push({day:day,time:time,absent:true});
  weekOvr[wk][sid]=base;
  /* 레슨 기록에도 결석 추가 */
  var existLog=logs.find(function(l){return l.sid===sid&&l.date===date;});
  if(existLog){existLog.att='결석';}
  else{
    var wn=logs.filter(function(l){return l.sid===sid&&new Date(l.date)<=new Date(date);}).length+1+getSOffset(sid);
    logs.unshift({id:uid(),sid:sid,sn:s.name,date:date,ct:'',fb:'',hw:'',att:'결석',rt:'3',note:'당일 결석',wn:wn,createdAt:Date.now()});
  }
  saveAll();
  closeLbOpt();
  toast(esc(s.name)+' 결석 처리됨');
  renderSidebarToday();render();
}

function cellClickOffDay(el){
  var day=el.dataset.day,h=el.dataset.h,date=el.dataset.date;
  var lbl=getOffLabel(date);
  vsConfirm({
    msg:lbl+' 날 레슨 배정',
    sub:'휴무일이지만 이 날 레슨을 배정하시겠습니까?',
    okLabel:'배정',
    onOk:function(){cellClick(day,h,date);}
  });
}
function cellClickEl(el){cellClick(el.dataset.day,el.dataset.h,el.dataset.date);}

/* FLEX WEEK */

function openFlexWeek(){
  var mon=getViewMon(),wk=getWK(mon);
  var _fwPfx=wkOfs===0?'이번 주':wkOfs>0?('+'+wkOfs+'주 후'):(Math.abs(wkOfs)+'주 전');
  ge('flexWeekLabel').textContent=_fwPfx+' '+fmtS(mon)+' ~ '+fmtS(addDays(mon,6));
  var ov=weekOvr[wk]||{};
  var flexS=students.filter(function(s){return s.status==='수강중'&&s.schedType==='flex';});
  var assignedCnt=flexS.filter(function(s){return weekOvr[wk]&&weekOvr[wk][s.id]&&weekOvr[wk][s.id].length>0;}).length;
  var unassignedNames=flexS.filter(function(s){return !weekOvr[wk]||!weekOvr[wk][s.id]||weekOvr[wk][s.id].length===0;}).map(function(s){return s.name;});
  var statusHtml=unassignedNames.length
    ?'<div style="background:rgba(200,114,114,.08);border:1px solid rgba(200,114,114,.2);border-radius:9px;padding:11px 14px;margin-bottom:8px;font-size:13px;color:var(--r)">⚠️ 미배정: '+unassignedNames.join(', ')+'</div>'
    :'<div style="background:rgba(109,200,162,.08);border:1px solid rgba(109,200,162,.2);border-radius:9px;padding:11px 14px;margin-bottom:8px;font-size:13px;color:var(--g)">✅ 전원 배정 완료 ('+flexS.length+'명)</div>';
  var o=statusHtml+'<div style="background:rgba(110,163,200,.08);border:1px solid rgba(110,163,200,.18);border-radius:9px;padding:11px 14px;margin-bottom:14px;font-size:13.5px;color:var(--bl)">💡 변동 레슨생의 이번 주 요일과 시간을 설정하세요.</div>';
  if(!flexS.length){o+='<div style="text-align:center;padding:20px;color:var(--tm)">변동 스케줄 레슨생이 없습니다</div>';}
  else flexS.forEach(function(s){
    var c=gc(s);var existing=ov[s.id]||[];
    var sl0=existing[0]||{day:'화',time:'10:00',absent:false};
    var sl1=existing[1]||{day:'목',time:'10:00',absent:false};
    var isTwo=(s.freq===2||s.freq==='2');
    o+='<div class="week-edit-block">';
    o+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px">';
    o+='<div style="font-size:14px;font-weight:600"><span class="cp" style="background:'+c+'"></span>'+esc(s.name);
    o+='<span class="bdg bg-b" style="margin-left:6px;font-size:11px">'+(isTwo?'주 2회':'주 1회')+'</span></div></div>';
    o+='<div style="display:flex;flex-direction:column;gap:8px">';
    o+=flexSlotRow(s.id,0,sl0,'1회');
    if(isTwo)o+=flexSlotRow(s.id,1,sl1,'2회');
    o+='</div></div>';
  });
  ge('flexWeekBody').innerHTML=o;
  om('mFlexWeek');
}
function flexSlotRow(sid,idx,sl,label){
  var mon=getViewMon();
  var sched=getWeekSched(mon);
  var dOpts=ALL7.map(function(d){return '<option value="'+d+'"'+(sl.day===d?' selected':'')+'>'+d+'</option>';}).join('');
  var tOpts=HOURS.map(function(h){
    var conflicts=(sched[sl.day+'_'+h]||[]).filter(function(x){return x.s.id!==sid;});
    var lbl=conflicts.length?h+' ⚠️ '+conflicts.map(function(x){return x.s.name;}).join(','):h;
    return '<option value="'+h+'"'+(sl.time===h?' selected':'')+(conflicts.length?' style="color:#c87272"':'')+'>'+lbl+'</option>';
  }).join('');
  /* 현재 선택값 충돌 체크 */
  var curConflicts=sl.time?(sched[sl.day+'_'+sl.time]||[]).filter(function(x){return x.s.id!==sid;}).map(function(x){return x.s.name;}):[];
  var warnHtml=curConflicts.length
    ?'<div style="font-size:11.5px;color:var(--r);margin-top:4px">⚠️ 이 시간에 이미 '+curConflicts.join(', ')+'님 수업 있음</div>':'';
  var o='<div>';
  o+='<div style="display:flex;align-items:center;gap:8px">';
  o+='<span style="font-size:13px;color:var(--ts);width:32px">'+label+'</span>';
  o+='<select id="fw-d-'+sid+'-'+idx+'" data-sid="'+sid+'" data-idx="'+idx+'" style="flex:1;font-size:13px;padding:7px 10px" onchange="updateFlexConflict(this,this.dataset.sid,this.dataset.idx)">'+dOpts+'</select>';
  o+='<select id="fw-t-'+sid+'-'+idx+'" data-sid="'+sid+'" data-idx="'+idx+'" style="flex:1;font-size:13px;padding:7px 10px" onchange="updateFlexConflict(this,this.dataset.sid,this.dataset.idx)">'+tOpts+'</select>';
  o+='<label style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--ts);white-space:nowrap;text-transform:none;letter-spacing:0">';
  o+='<input type="checkbox" id="fw-a-'+sid+'-'+idx+'"'+(sl.absent?' checked':'')+' style="width:auto;padding:0"> 결석</label>';
  o+='</div>'+warnHtml+'</div>';
  return o;
}
function updateFlexConflict(el,sid,idx){
  var dEl=document.getElementById('fw-d-'+sid+'-'+idx);
  var tEl=document.getElementById('fw-t-'+sid+'-'+idx);
  if(!dEl||!tEl)return;
  var day=dEl.value,time=tEl.value;
  var mon=getViewMon();var sched=getWeekSched(mon);
  var conflicts=(sched[day+'_'+time]||[]).filter(function(x){return x.s.id!==sid;});
  var wrap=el.closest('div');
  var warn=wrap.querySelector('.fw-warn');
  if(!warn){warn=document.createElement('div');warn.className='fw-warn';warn.style.cssText='font-size:11.5px;color:var(--r);margin-top:4px';wrap.appendChild(warn);}
  warn.textContent=conflicts.length?'⚠️ 이 시간에 이미 '+conflicts.map(function(x){return x.s.name;}).join(', ')+'님 수업 있음':'';
}

function saveFlexWeek(){
  pushUndo();
  var mon=getViewMon(),wk=getWK(mon);
  if(!weekOvr[wk])weekOvr[wk]={};
  var flexS=students.filter(function(s){return s.status==='수강중'&&s.schedType==='flex';});
  flexS.forEach(function(s){
    var slots=[];
    var d0=ge('fw-d-'+s.id+'-0'),t0=ge('fw-t-'+s.id+'-0'),a0=ge('fw-a-'+s.id+'-0');
    if(d0&&t0&&d0.value&&t0.value)slots.push({day:d0.value,time:t0.value,absent:a0?a0.checked:false});
    if(s.freq===2||s.freq==='2'){
      var d1=ge('fw-d-'+s.id+'-1'),t1=ge('fw-t-'+s.id+'-1'),a1=ge('fw-a-'+s.id+'-1');
      if(d1&&t1&&d1.value&&t1.value)slots.push({day:d1.value,time:t1.value,absent:a1?a1.checked:false});
    }
    /* 항상 저장 (슬롯 없어도 빈 배열로 저장해서 '배정 없음' 명시) */
    weekOvr[wk][s.id]=slots;
  });
  saveAll();
  /* 배정 완료 상태 표시 */
  var allAssigned=flexS.every(function(s){var wkk=getWK(getViewMon());return weekOvr[wkk]&&weekOvr[wkk][s.id]&&weekOvr[wkk][s.id].length>0;});
  cm('mFlexWeek');
  toast(allAssigned?'변동 배정 완료 ✅':'변동 스케줄 저장됨 ✓');
  renderSidebarToday();render();
}

/* QUICK SLOT */
var qsDay='',qsTime='',qsDate='',qsSel={};

function cellClick(day,time,dateStr){
  var mon=getMon(new Date(dateStr));var sched=getWeekSched(mon);
  var existing=(sched[day+'_'+time]||[]).map(function(x){return x.s.id;});
  qsDay=day;qsTime=time;qsDate=dateStr;qsSel={};
  existing.forEach(function(id){qsSel[id]=true;});
  ge('qsTitle').textContent=day+'요일 '+time;
  ge('qsMeta').textContent=dateStr;
  var active=students.filter(function(s){return s.status==='수강중';});
  var o='';
  if(!active.length){o='<div style="text-align:center;padding:20px;color:var(--tm)">수강중인 레슨생이 없습니다</div>';}
  else active.forEach(function(s){
    var c=gc(s);var sel=!!qsSel[s.id];
    o+='<div class="qs-row'+(sel?' sel':'')+'" id="qsr-'+s.id+'" data-sid="'+s.id+'" onclick="tQS(this.dataset.sid)">';
    o+='<div style="width:32px;height:32px;border-radius:50%;background:'+c+'22;border:1px solid '+c+'44;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:'+c+';flex-shrink:0">'+esc(s.name.slice(0,1))+'</div>';
    o+='<div style="flex:1"><div style="font-size:13.5px;font-weight:600">'+esc(s.name)+'</div>';
    o+='<div style="font-size:12px;color:var(--tm)">'+(s.schedType==='flex'?'🔄 변동':'📌 고정')+'</div></div>';
    o+='<div class="qs-check" style="font-size:18px">'+(sel?'✓':'')+'</div></div>';
  });
  ge('qsBody').innerHTML=o;
  om('mQS');
}

function tQS(sid){
  qsSel[sid]=!qsSel[sid];
  var row=ge('qsr-'+sid);if(!row)return;
  row.classList.toggle('sel',!!qsSel[sid]);
  row.querySelector('.qs-check').textContent=qsSel[sid]?'✓':'';
}
function saveQS(){
  pushUndo();
  var mon=getMon(new Date(qsDate)),wk=getWK(mon);
  if(!weekOvr[wk])weekOvr[wk]={};
  students.filter(function(s){return s.status==='수강중';}).forEach(function(s){
    if(s.schedType==='flex'){
      /* 변동: weekOvr 기준으로 슬롯 추가/삭제 */
      var slots=(weekOvr[wk][s.id]||[]).slice();
      var inSlot=slots.findIndex(function(sl){return sl.day===qsDay&&sl.time===qsTime;});
      if(qsSel[s.id]){if(inSlot<0)slots.push({day:qsDay,time:qsTime,absent:false});else slots[inSlot].absent=false;}
      else{if(inSlot>=0)slots.splice(inSlot,1);}
      weekOvr[wk][s.id]=slots;
    } else {
      /* 고정: weekOvr 있으면 그걸 기준, 없으면 기본 스케줄 기준 */
      var base=(s.id in (weekOvr[wk]||{}))
        ?weekOvr[wk][s.id].slice()
        :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
      var inSlot2=base.findIndex(function(sl){return sl.day===qsDay&&sl.time===qsTime;});
      if(qsSel[s.id]){if(inSlot2<0)base.push({day:qsDay,time:qsTime,absent:false});else base[inSlot2].absent=false;}
      else{if(inSlot2>=0)base.splice(inSlot2,1);}
      /* 항상 저장 — removeSlotFromMenu가 정확히 동작하도록 */
      weekOvr[wk][s.id]=base;
    }
  });
  saveAll();cm('mQS');toast('슬롯 업데이트됨');renderSidebarToday();
  if(page==='schedule'){ge('content').innerHTML=isMobile()?buildMobileSchedule():buildSchedule();if(isMobile()){setTimeout(function(){attachMobileEvents();},50);}}else render();
}

/* FULL WEEK EDIT */

function openWE(){
  var mon=getViewMon(),wk=getWK(mon);
  var _wlPfx=wkOfs===0?'이번 주':wkOfs>0?('+'+wkOfs+'주 후'):(Math.abs(wkOfs)+'주 전');
  ge('weLabel').textContent=_wlPfx+' '+fmtS(mon)+' ~ '+fmtS(addDays(mon,6));
  var ov=weekOvr[wk]||{};
  var fixedS=students.filter(function(s){return s.status==='수강중'&&s.schedType!=='flex';});
  var o='<div style="background:var(--ag);border:1px solid var(--b);border-radius:9px;padding:12px 16px;margin-bottom:14px;font-size:13.5px;color:var(--a)">💡 고정 스케줄 레슨생의 이번 주 일정을 예외적으로 변경합니다.<br><span style="font-size:12px;color:var(--tm)">요일·시간을 바꾸거나 결석 처리, 슬롯 추가/삭제가 가능합니다. 다음 주부터는 원래 고정 스케줄로 돌아옵니다.</span></div>';
  if(!fixedS.length){o+='<div style="text-align:center;padding:20px;color:var(--tm)">고정 스케줄 레슨생이 없습니다</div>';}
  else fixedS.forEach(function(s){
    var c=gc(s);
    var slots=ov[s.id]!=null?ov[s.id]:(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
    var fixStr=(s.days||[]).map(function(d){return d+((s.times&&s.times[d])?' '+s.times[d]:'');}).join(', ')||'미지정';
    o+='<div class="week-edit-block">';
    o+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    o+='<div style="display:flex;align-items:center;gap:8px">';
    o+='<div style="font-size:13.5px;font-weight:700">'+esc(s.name)+'</div>';
    o+='<span style="font-size:13px;font-weight:700;padding:3px 10px;border-radius:8px;background:'+(s.schedType==='flex'?'rgba(110,163,200,.2)':'rgba(200,169,110,.2)')+';color:'+(s.schedType==='flex'?'var(--bl)':'var(--a)')+'">'+(s.schedType==='flex'?'🔄 변동':'📌 고정')+'</span>';
    o+='</div>';
    o+='<div style="font-size:12px;color:var(--tm)">고정: '+fixStr+'</div></div>';
    o+='<div id="we-sl-'+s.id+'">'+slots.map(function(sl,i){return weRow(s.id,i,sl);}).join('')+'</div>';
    o+='<button class="btn bg2 bsm" style="margin-top:7px" data-sid="'+s.id+'" onclick="addWeRow(this.dataset.sid)">+ 슬롯 추가</button></div>';
  });
  ge('weBody').innerHTML=o;om('mWE');
}
function weRow(sid,i,sl){
  var dOpts=ALL7.map(function(d){return '<option value="'+d+'"'+(sl.day===d?' selected':'')+'>'+d+'</option>';}).join('');
  var tOpts=HOURS.map(function(h){return '<option value="'+h+'"'+(sl.time===h?' selected':'')+'>'+h+'</option>';}).join('');
  return '<div id="we-r-'+sid+'-'+i+'" class="we-row"><select id="we-d-'+sid+'-'+i+'" style="width:66px;font-size:13px;padding:6px 7px">'+dOpts+'</select><select id="we-t-'+sid+'-'+i+'" style="flex:1;font-size:13px;padding:6px 7px">'+tOpts+'</select><label style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--ts);cursor:pointer;text-transform:none;letter-spacing:0;white-space:nowrap"><input type="checkbox" id="we-a-'+sid+'-'+i+'"'+(sl.absent?' checked':'')+' style="width:auto;padding:0"> 결석</label><div class="btn bd bic" style="font-size:14px" data-sid="'+sid+'" data-i="'+i+'" onclick="rmWeRow(this.dataset.sid,this.dataset.i)">×</div></div>';
}
function addWeRow(sid){
  var wrap=ge('we-sl-'+sid);if(!wrap)return;
  var i=wrap.querySelectorAll('[id^="we-r-'+sid+'"]').length;
  var div=document.createElement('div');
  div.innerHTML=weRow(sid,i,{day:'화',time:'10:00',absent:false});
  wrap.appendChild(div.firstElementChild);
}
function rmWeRow(sid,i){var el=ge('we-r-'+sid+'-'+i);if(el)el.remove();}
function saveWE(){
  pushUndo();
  var mon=getViewMon(),wk=getWK(mon);
  if(!weekOvr[wk])weekOvr[wk]={};
  students.filter(function(s){return s.status==='수강중'&&s.schedType!=='flex';}).forEach(function(s){
    var wrap=ge('we-sl-'+s.id);if(!wrap)return;
    var rows=wrap.querySelectorAll('[id^="we-r-'+s.id+'"]');var slots=[];
    rows.forEach(function(row){
      var idx=row.id.replace('we-r-'+s.id+'-','');
      var dEl=ge('we-d-'+s.id+'-'+idx),tEl=ge('we-t-'+s.id+'-'+idx),aEl=ge('we-a-'+s.id+'-'+idx);
      if(dEl&&tEl)slots.push({day:dEl.value,time:tEl.value,absent:aEl?aEl.checked:false});
    });
    weekOvr[wk][s.id]=slots;
  });
  saveAll();cm('mWE');toast('이번 주 스케줄 저장 📋');renderSidebarToday();
  if(page==='schedule'){ge('content').innerHTML=isMobile()?buildMobileSchedule():buildSchedule();if(isMobile()){setTimeout(function(){attachMobileEvents();},50);}}else render();
}

