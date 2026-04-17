/* ============================================================
   today.js — 오늘 스케줄 페이지
   buildTodaySchedule() : 오늘 스케줄 HTML 생성
   markTodayStatus() : 결석/당일취소 처리
   openSlotMenu() : 슬롯 메뉴 열기
   markSlotAbsent() : 결석 처리
   saveQuickMemo() : 빠른 메모 저장
   cancelSlotOnly() : 슬롯만 취소
   cancelSlot() : 슬롯 취소 (기록 포함)
   openTempReschedule() : 임시 변경 모달
   saveTempReschedule() : 임시 변경 저장
   openNextWeekReschedule() : 다음 주 변경
   removeTempSlot() : 임시 슬롯 삭제
   ============================================================ */

/* ── 오늘 스케줄 페이지 ── */

function markTodayStatus(sid,h,wk,status){
  var s=students.find(function(x){return x.id===sid;});
  if(!s)return;
  var isAbsent=status==='absent';
  vsConfirm({
    msg:esc(s.name)+' '+(isAbsent?'결석 처리':'당일 취소'),
    sub:isAbsent?'레슨 기록에 결석으로 저장됩니다.':'이번 주 스케줄에서 슬롯이 제거됩니다.',
    okLabel:isAbsent?'결석 처리':'취소 처리',
    danger:true,
    onOk:function(){
      if(isAbsent){
        var todayStr=toDS(new Date());
        var existing=logs.find(function(l){return l.sid===sid&&l.date===todayStr;});
        var wn=logs.filter(function(l){return l.sid===sid&&new Date(l.date)<=new Date(todayStr);}).length+(existing?0:1)+getSOffset(sid);
        if(existing){existing.att='결석';}
        else{logs.unshift({id:uid(),sid:sid,sn:s.name,date:todayStr,att:'결석',ct:'',fb:'',hw:'',rt:'3',note:'당일 결석',wn:wn,createdAt:Date.now()});}
        /* 결석 = 연기 차감 (회차 차감 없음) */
        if(!s.deferrals)s.deferrals=0;
        s.deferrals++;
        saveAll();toast(esc(s.name)+' 결석 처리 (연기 차감) 😴');render();
      } else {
        /* 당일취소 = 레슨 회차 차감 → logs에 '취소' 기록 */
        if(!weekOvr[wk])weekOvr[wk]={};
        var todayDay=JSDOW[new Date().getDay()];
        var base=(weekOvr[wk][sid]&&weekOvr[wk][sid].length>0)
          ?weekOvr[wk][sid].slice()
          :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
        base=base.filter(function(sl){return !(sl.day===todayDay&&sl.time===h);});
        weekOvr[wk][sid]=base;
        /* 레슨 기록에 '취소' 추가 (회차 차감) */
        var todayStr2=toDS(new Date());
        var existing2=logs.find(function(l){return l.sid===sid&&l.date===todayStr2;});
        var wn2=logs.filter(function(l){return l.sid===sid&&new Date(l.date)<=new Date(todayStr2);}).length+(existing2?0:1)+getSOffset(sid);
        if(!existing2){
          logs.unshift({id:uid(),sid:sid,sn:s.name,date:todayStr2,att:'취소',ct:'',fb:'',hw:'',rt:'3',note:'당일 취소',wn:wn2,createdAt:Date.now()});
        }
        saveAll();toast(esc(s.name)+' 당일 취소 (회차 차감) ❌');render();
      }
    }
  });
}
function buildTodaySchedule(){
  var now=new Date();
  var todayDay=JSDOW[now.getDay()];
  var mon=getMon(now);
  var sched=getWeekSched(mon);
  var todayStr=toDS(now);
  var nowMins=now.getHours()*60+now.getMinutes();

  /* 오늘 전체 슬롯 수집 */
  var allSlots=[];
  HOURS.forEach(function(h){
    var key=todayDay+'_'+h;
    (sched[key]||[]).forEach(function(x){
      if(!x.absent) allSlots.push({s:x.s,h:h,type:x.type});
    });
  });

  /* 현재 시간 기준 정렬: 현재 수업 → 다가오는 수업 → 지난 수업 */
  allSlots.sort(function(a,b){
    var aM=parseInt(a.h)*60;var bM=parseInt(b.h)*60;
    return aM-bM;
  });

  var dayNames=['일','월','화','수','목','금','토'];
  var nowHH=String(now.getHours()).padStart(2,'0');
  var nowMM=String(now.getMinutes()).padStart(2,'0');
  var o='<div style="max-width:680px;margin:0 auto">';
  /* 헤더 카드 — 세련된 투톤 */
  var isHoliday=typeof isHoliday==='function'&&isHoliday(todayStr);
  o+='<div style="background:linear-gradient(135deg,rgba(200,169,110,.1) 0%,rgba(16,16,26,0) 60%);border:1px solid var(--b2);border-radius:18px;padding:22px 24px;margin-bottom:20px;position:relative;overflow:hidden">';
  o+='<div style="position:absolute;top:-20px;right:-20px;width:120px;height:120px;border-radius:50%;background:rgba(200,169,110,.04);pointer-events:none"></div>';
  o+='<div style="display:flex;align-items:flex-start;justify-content:space-between">';
  o+='<div>';
  o+='<div style="font-size:10px;letter-spacing:.22em;color:var(--a);text-transform:uppercase;font-weight:600;margin-bottom:8px">TODAY</div>';
  o+='<div style="font-family:\'Cormorant Garamond\',serif;font-size:30px;font-weight:900;color:var(--t);line-height:1;margin-bottom:6px">';
  o+=(now.getMonth()+1)+'월 '+now.getDate()+'일';
  o+='<span style="font-size:17px;font-weight:600;color:var(--a);margin-left:10px">'+dayNames[now.getDay()]+'요일</span>';
  o+='</div>';
  o+='<div style="font-size:12.5px;color:var(--tm);font-family:\'DM Mono\',monospace">현재 시각 '+nowHH+':'+nowMM+'</div>';
  o+='</div>';
  o+='<div style="text-align:right">';
  o+='<div style="font-family:\'Cormorant Garamond\',serif;font-size:44px;font-weight:900;color:'+(allSlots.length?'var(--a)':'var(--tm)')+';line-height:1">'+allSlots.length+'</div>';
  o+='<div style="font-size:10.5px;letter-spacing:.12em;color:var(--tm);text-transform:uppercase;margin-top:3px">레슨 예정</div>';
  o+='</div>';
  o+='</div>';
  o+='</div>';

  /* 통화 매뉴얼 + 초기화 버튼 */
  o+='<div style="display:flex;gap:8px;margin-bottom:14px">';
  o+='<button onclick="om(\'mManual\')" style="flex:1;background:var(--season-hover,var(--ag));border:1px solid var(--b2);border-radius:10px;padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--season-accent,var(--a));font-family:inherit">';
  o+='<span style="font-size:15px">📞</span>';
  o+='<span>통화 매뉴얼</span>';
  o+='</button>';
  o+='<button onclick="resetAllData()" style="background:rgba(200,114,114,.08);border:1px solid rgba(200,114,114,.18);border-radius:10px;padding:10px 14px;cursor:pointer;font-size:12px;font-weight:600;color:var(--r);font-family:inherit;white-space:nowrap">🗑 초기화</button>';
  o+='</div>';

  if(!allSlots.length){
    o+='<div class="empty"><div class="ei">⏰</div><div class="et">오늘 예정된 레슨이 없습니다</div></div>';
    o+='</div>';return o;
  }

  allSlots.forEach(function(item){
    var s=item.s;var c=gc(s);
    var hp=item.h.split(':');
    var slotMins=parseInt(hp[0])*60+parseInt(hp[1]||0);
    var diff=slotMins-nowMins;
    var isCurrent=Math.abs(diff)<=65;
    var isPast=diff<-65;
    var tl=logs.find(function(l){return l.sid===s.id&&l.date===todayStr;});
    var wn=logs.filter(function(l){return l.sid===s.id&&new Date(l.date)<=new Date(todayStr);}).length+(tl?0:1)+getSOffset(s.id);

    /* 카드 */
    var borderCol=isCurrent?'var(--g)':isPast?'var(--b)':'var(--b2)';
    var bgCol=isCurrent?'rgba(109,200,162,.08)':isPast?'var(--ag)':'var(--s2)';
    o+='<div style="background:'+bgCol+';border:1.5px solid '+borderCol+';border-radius:14px;padding:18px 22px;margin-bottom:12px;transition:all .15s">';
    o+='<div style="display:flex;align-items:center;gap:16px;margin-bottom:'+(isCurrent?'16':'0')+'px">';

    /* 사진 */
    var avStyle='width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,'+c+','+COLORS[(students.indexOf(s)+2)%COLORS.length]+');display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#08080d;flex-shrink:0;overflow:hidden';
    o+='<div style="'+avStyle+'">'+(getStudentPhoto(s)?'<img src="'+getStudentPhoto(s)+'" style="width:100%;height:100%;object-fit:cover">':esc(s.name.slice(0,1)))+'</div>';

    o+='<div style="flex:1">';
    o+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">';
    o+='<span style="font-size:17px;font-weight:700">'+esc(s.name)+'</span>';
    if(isCurrent)o+='<span style="font-size:11px;background:var(--g);color:#000;border-radius:4px;padding:2px 8px;font-weight:700">수업 중</span>';
    else if(isPast)o+='<span class="bdg bg-r" style="font-size:11px">'+(tl?'✓ 기록완료':'미기록')+'</span>';
    else if(diff<=120)o+='<span class="bdg bg-b" style="font-size:11px">'+diff+'분 후</span>';
    else if(diff<=480)o+='<span class="bdg bg-b" style="font-size:11px">'+Math.round(diff/60)+'시간 후</span>';/* 480분(8시간) 이상은 표시 안 함 */
    o+='</div>';
    o+='<div style="font-size:12.5px;color:var(--tm)">'+item.h+' &nbsp;·&nbsp; '+clsL(s.cls)+' '+clsD(s.cls)+' &nbsp;·&nbsp; 제 '+wn+'회차';
    var ci2=getCycleInfo(s);
    var remCi=ci2.remainInCycle;
    o+=' &nbsp;<span style="color:var(--a);font-size:11px;font-weight:600">'+ci2.totalLessons+'회차</span>';
    o+='</div>';
    o+='</div>';

    /* 레슨 기록 + 상태 버튼 */
    o+='<button class="btn '+(tl?'bg2':'bp')+' bsm" style="flex-shrink:0" data-sid="'+s.id+'" data-h="'+item.h+'" data-date="'+todayStr+'" onclick="openLessonRecord(this.dataset.sid,this.dataset.h,this.dataset.date)">';
    o+=tl?'✎ 기록':'+ 기록';
    o+='</button>';
    o+='</div>';

    /* 결석/취소/변경 버튼 행 */
    var mon2=getMon(new Date(todayStr));var wk2=getWK(mon2);var todayDay2=JSDOW[new Date().getDay()];
    o+='<div style="display:flex;gap:5px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);flex-wrap:wrap">';
    o+='<button class="btn bsm" style="flex:1;justify-content:center;background:rgba(200,114,114,.09);color:var(--r);border:1px solid rgba(200,114,114,.18);font-size:11px" data-sid="'+s.id+'" data-h="'+item.h+'" data-wk="'+wk2+'" data-status="absent" onclick="markTodayStatus(this.dataset.sid,this.dataset.h,this.dataset.wk,this.dataset.status)">😴 결석</button>';
    o+='<button class="btn bsm" style="flex:1;justify-content:center;background:rgba(255,255,255,.04);color:var(--tm);border:1px solid var(--b);font-size:11px" data-sid="'+s.id+'" data-h="'+item.h+'" data-wk="'+wk2+'" data-status="cancel" onclick="markTodayStatus(this.dataset.sid,this.dataset.h,this.dataset.wk,this.dataset.status)">❌ 취소</button>';
    o+='<button class="btn bsm" style="flex:1;justify-content:center;background:rgba(200,169,110,.08);color:var(--a);border:1px solid var(--b);font-size:11px" data-sid="'+s.id+'" data-h="'+item.h+'" data-date="'+todayStr+'" onclick="openTempReschedule(this.dataset.sid,this.dataset.h,this.dataset.date)">📅 이번 주</button>';
    o+='<button class="btn bsm" style="flex:1;justify-content:center;background:rgba(110,163,200,.08);color:var(--bl);border:1px solid rgba(110,163,200,.18);font-size:11px" data-sid="'+s.id+'" data-h="'+item.h+'" onclick="openNextWeekReschedule(this.dataset.sid,this.dataset.h)">✏️ 스케줄 수정</button>';
    o+='</div>';

    /* 퀵 기록 + 이전 레슨 기록 (모든 슬롯) */
    o+='<div style="border-top:1px solid rgba(255,255,255,.08);padding-top:12px;margin-top:12px">';
    if(tl){
      /* 기록 있으면 내용 표시 */
      o+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
      if(tl.ct)o+='<div><div style="font-size:10px;letter-spacing:.1em;color:var(--tm);text-transform:uppercase;margin-bottom:3px">📝 진도</div><div style="font-size:13.5px;color:var(--ts)">'+esc(tl.ct)+'</div></div>';
      if(tl.fb)o+='<div><div style="font-size:10px;letter-spacing:.1em;color:var(--r);text-transform:uppercase;margin-bottom:3px">⚠️ 피드백</div><div style="font-size:13.5px;color:var(--ts)">'+esc(tl.fb)+'</div></div>';
      if(tl.hw)o+='<div><div style="font-size:10px;letter-spacing:.1em;color:var(--g);text-transform:uppercase;margin-bottom:3px">📋 과제</div><div style="font-size:13.5px;color:var(--ts)">'+esc(tl.hw)+'</div></div>';
      o+='</div>';
    }
    /* 퀵 메모 입력 영역 */
    var qid='qm_'+s.id+'_'+item.h;
    o+='<div style="display:flex;gap:6px;align-items:center">';
    o+='<input id="'+qid+'" type="text" placeholder="⚡ 진도 한 줄 메모..." value="'+esc((tl&&tl.ct)||'')+'" style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--t);padding:7px 11px;border-radius:8px;font-size:13px;font-family:DM Sans,sans-serif;outline:none" onkeydown="if(event.key===\'Enter\'){event.preventDefault();saveQuickMemo(\''+s.id+'\',\''+item.h+'\',\''+todayStr+'\',document.getElementById(\''+qid+'\').value)}">';
    o+='<button class="btn bp bsm" data-sid="'+s.id+'" data-h="'+item.h+'" data-date="'+todayStr+'" data-qid="'+qid+'" onclick="saveQuickMemo(this.dataset.sid,this.dataset.h,this.dataset.date,document.getElementById(this.dataset.qid).value)">저장</button>';
    o+='</div>';

    /* 이전 레슨 기록 (최근 5개) */
    var _prevLogs=logs.filter(function(l){return l.sid===s.id&&l.date!==todayStr;}).sort(function(a,b){return (b.date||'').localeCompare(a.date||'');}).slice(0,5);
    if(_prevLogs.length){
      var _histId='hist_'+s.id;
      o+='<div style="margin-top:10px">';
      o+='<button onclick="(function(){var el=document.getElementById(\''+_histId+'\');el.style.display=el.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.hst-arrow\').textContent=el.style.display===\'none\'?\'▼\':\'▲\';}).call(this)" style="background:none;border:none;color:var(--a);font-size:12px;font-weight:600;cursor:pointer;padding:0;font-family:inherit;display:flex;align-items:center;gap:5px">';
      o+='<span class="hst-arrow">▼</span> 이전 기록 (최근 '+_prevLogs.length+'건)';
      o+='</button>';
      o+='<div id="'+_histId+'" style="display:none;margin-top:8px;max-height:240px;overflow-y:auto;border:1px solid var(--b);border-radius:10px;background:rgba(255,255,255,.02)">';
      _prevLogs.forEach(function(pl,pi){
        var _border=pi>0?'border-top:1px solid var(--b);':'';
        o+='<div style="padding:10px 14px;'+_border+'cursor:pointer" onclick="editLogByIdEl(\''+pl.id+'\')">';
        o+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
        o+='<span style="font-size:12px;font-weight:700;color:var(--a);font-family:DM Mono,monospace">'+esc(pl.date)+'</span>';
        o+='<span style="font-size:10.5px;color:var(--tm)">제'+pl.wn+'회</span>';
        var _attCol=pl.att==='출석'?'var(--g)':pl.att==='결석'?'var(--r)':'var(--tm)';
        o+='<span style="font-size:10px;background:'+_attCol+'22;color:'+_attCol+';border-radius:3px;padding:1px 5px;font-weight:600">'+esc(pl.att||'출석')+'</span>';
        o+='</div>';
        if(pl.ct)o+='<div style="font-size:12.5px;color:var(--ts);margin-bottom:2px">📝 '+esc(pl.ct)+'</div>';
        if(pl.fb)o+='<div style="font-size:12px;color:var(--r);margin-bottom:2px">⚠️ '+esc(pl.fb)+'</div>';
        if(pl.hw)o+='<div style="font-size:12px;color:var(--g)">📋 '+esc(pl.hw)+'</div>';
        if(!pl.ct&&!pl.fb&&!pl.hw)o+='<div style="font-size:12px;color:var(--tm);font-style:italic">기록 없음</div>';
        o+='</div>';
      });
      o+='</div></div>';
    }
    o+='</div>';
    o+='</div>';
  });
  o+='</div>';
  return o;
}

/* ── 고정 스케줄 임시 변경 (이번 주만) ── */

function openSlotMenu(el){
  var sid=el.dataset.sid, h=el.dataset.time, dateStr=el.dataset.date;
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var mon=getMon(new Date(dateStr)),wk=getWK(mon);
  var day=['일','월','화','수','목','금','토'][new Date(dateStr).getDay()];
  var existing=document.getElementById('mSlotMenu');if(existing)existing.remove();
  var m=document.createElement('div');m.id='mSlotMenu';m.className='ov open';
  var c=gc(s);
  var html='<div class="modal" style="max-width:340px"><div class="mh">';
  html+='<div><div class="mt">'+esc(s.name)+' — '+day+' '+h+'</div>';
  html+='<div style="font-size:12px;color:var(--tm);margin-top:2px">'+(s.schedType==='flex'?'🔄 변동':'📌 고정')+'</div></div>';
  html+='<div class="mc" onclick="document.getElementById(\'mSlotMenu\').remove()">&#x2715;</div></div>';
  html+='<div class="mb" style="display:flex;flex-direction:column;gap:12px">';
  html+='<button class="btn bm" style="justify-content:center" onclick="document.getElementById(\'mSlotMenu\').remove();openTempReschedule(\''+sid+'\',\''+h+'\',\''+dateStr+'\')">📅 이번 주 일정 변경</button>';
  html+='<button class="btn bd" style="justify-content:center;padding:12px" data-sid="'+sid+'" data-time="'+h+'" data-date="'+dateStr+'" onclick="document.getElementById(\'mSlotMenu\').remove();removeSlotFromMenu(this.dataset.sid,this.dataset.time,this.dataset.date)">🗑 이 슬롯 비우기</button>';
  html+='</div></div>';
  m.innerHTML=html;
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
}
function markSlotAbsent(sid,h,dateStr,wk){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  /* 레슨 기록 결석으로 저장 */
  var existing=logs.find(function(l){return l.sid===sid&&l.date===dateStr;});
  var wn=logs.filter(function(l){return l.sid===sid&&new Date(l.date)<=new Date(dateStr);}).length+(existing?0:1)+getSOffset(sid);
  if(existing){existing.att='결석';}
  else{logs.unshift({id:uid(),sid:sid,sn:s.name,date:dateStr,att:'결석',ct:'',fb:'',hw:'',rt:'3',note:'결석',wn:wn,createdAt:Date.now()});}
  /* weekOvr에 absent 표시 */
  var day=['일','월','화','수','목','금','토'][new Date(dateStr).getDay()];
  if(!weekOvr[wk])weekOvr[wk]={};
  var base=(sid in (weekOvr[wk]||{}))
    ?(weekOvr[wk][sid]||[]).slice()
    :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
  var idx=base.findIndex(function(sl){return sl.day===day&&sl.time===h;});
  if(idx>=0)base[idx].absent=true;
  weekOvr[wk][sid]=base;
  saveAll();toast(esc(s.name)+' 결석 처리됨 😴');render();
}

function saveQuickMemo(sid,h,dateStr,memo){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var existing=logs.find(function(l){return l.sid===sid&&l.date===dateStr;});
  var wn=logs.filter(function(l){return l.sid===sid&&new Date(l.date)<=new Date(dateStr);}).length+(existing?0:1)+getSOffset(sid);
  if(existing){
    existing.ct=memo||existing.ct||'';
  } else {
    logs.unshift({id:uid(),sid:sid,sn:s.name,date:dateStr,att:'출석',ct:memo||'',fb:'',hw:'',rt:'3',note:'',wn:wn,createdAt:Date.now()});
  }
  saveAll();renderSidebarToday();
  toast(esc(s.name)+' 메모 저장 ⚡');
  /* 오늘 스케줄 페이지면 재렌더 */
  if(page==='today'){ge('content').innerHTML=buildTodaySchedule();}
}

function cancelSlotOnly(sid,day,h,wk){
  pushUndo();
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  if(!weekOvr[wk])weekOvr[wk]={};
  var base;
  if(s.schedType==='flex'){
    /* 변동: weekOvr에서 직접 제거 */
    base=(weekOvr[wk][sid]||[]).slice();
    base=base.filter(function(sl){return !(sl.day===day&&sl.time===h);});
    weekOvr[wk][sid]=base;
  } else {
    /* 고정: 기본 슬롯 기준으로 해당 슬롯만 제거 */
    base=(sid in (weekOvr[wk]||{}))
      ?(weekOvr[wk][sid]||[]).slice()
      :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
    base=base.filter(function(sl){return !(sl.day===day&&sl.time===h);});
    weekOvr[wk][sid]=base;
  }
  saveAll();toast(esc(s.name)+' 슬롯 삭제됨 🗑');render();
}
function cancelSlot(sid,day,h,wk){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  vsConfirm({
    msg:esc(s.name)+' 당일 취소',
    sub:'이번 주 슬롯이 제거되고 결석으로 기록됩니다.',
    okLabel:'취소 처리',danger:true,
    onOk:function(){
      if(!weekOvr[wk])weekOvr[wk]={};
      var base=(sid in (weekOvr[wk]||{}))
        ?(weekOvr[wk][sid]||[]).slice()
        :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
      base=base.filter(function(sl){return !(sl.day===day&&sl.time===h);});
      weekOvr[wk][sid]=(base.length===0&&s.schedType!=='flex')?[]:base;
      var dateStr=toDS(new Date());
      var existing=logs.find(function(l){return l.sid===sid&&l.date===dateStr;});
      if(!existing){
        var wn=logs.filter(function(l){return l.sid===sid;}).length+1+getSOffset(sid);
        logs.unshift({id:uid(),sid:sid,sn:s.name,date:dateStr,att:'결석',ct:'',fb:'',hw:'',rt:'3',note:'당일 취소 (횟수 차감)',wn:wn,createdAt:Date.now()});
      }
      saveAll();toast(esc(s.name)+' 당일 취소 — 1회 차감됨');render();
    }
  });
}
function openTempReschedule(sid,currentTime,dateStr){
  var s=students.find(function(x){return x.id===sid;});
  if(!s)return;
  var mon=getMon(new Date(dateStr)),wk=getWK(mon);
  var day=['일','월','화','수','목','금','토'][new Date(dateStr).getDay()];
  var existing=document.getElementById('mTempReschedule');
  if(existing)existing.remove();
  var m=document.createElement('div');
  m.id='mTempReschedule';m.className='ov open';
  var c=gc(s);
  var dOpts=(['월','화','수','목','금','토','일']).map(function(d){return '<option value="'+d+'"'+(d===day?' selected':'')+'>'+d+'요일</option>';}).join('');
  var tOpts=(['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']).map(function(h){return '<option value="'+h+'"'+(h===currentTime?' selected':'')+'>'+h+'</option>';}).join('');
  var av=getStudentPhoto(s)
    ?'<img src="'+getStudentPhoto(s)+'" style="width:40px;height:40px;border-radius:8px;object-fit:cover">'
    :'<div style="width:40px;height:40px;border-radius:8px;background:'+c+'22;border:1px solid '+c+'44;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:'+c+'">'+esc(s.name.slice(0,1))+'</div>';
  var html='<div class="modal" style="max-width:360px">'
    +'<div class="mh">'
    +'<div style="display:flex;align-items:center;gap:10px">'+av
    +'<div><div class="mt" style="font-size:16px">'+esc(s.name)+'</div>'
    +'<div style="font-size:12px;color:var(--tm);margin-top:1px">이번 주만 임시 변경</div>'
    +'</div></div>'
    +'<div class="mc" onclick="document.getElementById(\'mTempReschedule\').remove()">&#x2715;</div></div>'
    +'<div class="mb">'
    +'<div style="background:var(--ag);border:1px solid var(--b);border-radius:9px;padding:10px 13px;margin-bottom:14px;font-size:12.5px;color:var(--a)">💡 다음 주부터는 원래 고정 스케줄로 복원됩니다</div>'
    /* 현재 → 변경 시각 표시 */
    +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 12px;background:rgba(255,255,255,.03);border-radius:9px;font-size:13px">'
    +'<span style="color:var(--tm)">현재</span>'
    +'<span style="font-weight:700;color:var(--t);font-family:DM Mono,monospace">'+day+'요일 '+currentTime+'</span>'
    +'<span style="color:var(--tm)">→</span>'
    +'<span style="color:var(--a);font-size:12px">변경할 일정 선택</span>'
    +'</div>'
    +'<div class="fg" style="margin-bottom:12px">'
    +'<div class="f1"><label>변경 요일</label><select id="tr-day" style="font-size:14px">'+dOpts+'</select></div>'
    +'<div class="f1"><label>변경 시간</label><select id="tr-time" style="font-size:14px">'+tOpts+'</select></div>'
    +'</div>'
    +'<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 12px;background:rgba(200,114,114,.06);border:1px solid rgba(200,114,114,.15);border-radius:9px;text-transform:none;letter-spacing:0;font-size:13.5px;color:var(--ts)">'
    +'<input type="checkbox" id="tr-absent" style="width:16px;height:16px;padding:0;accent-color:var(--r)"> 결석 처리 (레슨 기록에 결석으로 저장)</label>'
    +'</div>'
    +'<div class="mf">'
    +'<button class="btn bd" style="margin-right:auto" data-sid="'+sid+'" data-day="'+day+'" data-time="'+currentTime+'" data-wk="'+wk+'" onclick="removeTempSlot(this)">🗑 슬롯 삭제</button>'
    +'<button class="btn bg2" onclick="document.getElementById(\'mTempReschedule\').remove()">취소</button>'
    +'<button class="btn bp" data-sid="'+sid+'" data-oldday="'+day+'" data-oldtime="'+currentTime+'" data-wk="'+wk+'" onclick="saveTempReschedule(this)">✓ 적용</button>'
    +'</div></div>';
  m.innerHTML=html;
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
}
function saveTempReschedule(btn){
  pushUndo();
  var sid=btn.dataset.sid,oldDay=btn.dataset.oldday,oldTime=btn.dataset.oldtime,wk=btn.dataset.wk;
  var newDay=document.getElementById('tr-day').value;
  var newTime=document.getElementById('tr-time').value;
  var absent=document.getElementById('tr-absent')&&document.getElementById('tr-absent').checked;
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  if(!weekOvr[wk])weekOvr[wk]={};
  /* 현재 고정 기반 슬롯 가져오기 */
  var base=(sid in (weekOvr[wk]||{}))
    ?(weekOvr[wk][sid]||[]).slice()
    :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
  /* 기존 슬롯 제거 */
  base=base.filter(function(sl){return !(sl.day===oldDay&&sl.time===oldTime);});
  /* 새 슬롯 추가 */
  base.push({day:newDay,time:newTime,absent:absent});
  weekOvr[wk][sid]=base;
  saveAll();
  document.getElementById('mTempReschedule').remove();
  var lbOpt=document.getElementById('mLbOpt');if(lbOpt)lbOpt.remove();
  renderSidebarToday();
  toast(esc(s.name)+' 이번 주 '+newDay+' '+newTime+'으로 변경됨 ✓');
  /* 반드시 스케줄 페이지 기준으로 다시 그림 */
  if(page==='schedule'){ge('content').innerHTML=isMobile()?buildMobileSchedule():buildSchedule();}
  else render();
}
/* ── 다음 주 스케줄 변경 → 레슨생 수정 모달 열기 ── */
function openNextWeekReschedule(sid,currentTime){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  openSModal(sid);
  toast(esc(s.name)+' 스케줄을 수정하세요 — 요일/시간 변경 후 저장하면 주간 스케줄에 반영됩니다 📅');
}
function removeTempSlot(btn){
  pushUndo();
  var sid=btn.dataset.sid,day=btn.dataset.day,time=btn.dataset.time,wk=btn.dataset.wk;
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  if(!weekOvr[wk])weekOvr[wk]={};
  var base=(sid in (weekOvr[wk]||{}))
    ?(weekOvr[wk][sid]||[]).slice()
    :(s.days||[]).map(function(d){return{day:d,time:(s.times&&s.times[d])||'10:00',absent:false};});
  base=base.filter(function(sl){return !(sl.day===day&&sl.time===time);});
  /* 고정학생: 빈 배열이면 weekOvr 키 삭제 → 기본 스케줄로 복원 */
  weekOvr[wk][sid]=base; /* 빈 배열도 저장 */
  saveAll();
  document.getElementById('mTempReschedule').remove();
  var lbOpt=document.getElementById('mLbOpt');if(lbOpt)lbOpt.remove();
  toast(esc(s.name)+' 슬롯 삭제됨 🗑');
  renderSidebarToday();
  if(page==='schedule'){ge('content').innerHTML=isMobile()?buildMobileSchedule():buildSchedule();}
  else render();
}