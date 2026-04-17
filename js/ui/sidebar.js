/* ============================================================
   sidebar.js — 사이드바 & 모바일 탭바
   fixMobileSidebar() : 모바일 사이드바 위치 고정
   initMobileTabBar() : 탭바 초기화
   updateMobileTabBar() : 탭바 업데이트
   renderSidebarToday() : 오늘 레슨 목록 사이드바 렌더링
   sbLessonClick() : 레슨 클릭 → 기록 열기
   ============================================================ */

/* 모바일 사이드바 위치 강제 고정 */
function fixMobileSidebar(){
  if(window.innerWidth>768)return;
  var sb=document.querySelector('.sb');
  if(!sb)return;
  sb.style.cssText='position:fixed!important;top:auto!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:60px!important;max-height:60px!important;flex-direction:row!important;z-index:100!important;overflow:hidden!important;pointer-events:auto!important;border-right:none!important;border-top:1px solid rgba(255,255,255,.08)!important;background:var(--s1)!important;';
}
window.addEventListener('load',fixMobileSidebar);
window.addEventListener('resize',fixMobileSidebar);


/* ── 모바일 탭바 (JS로 동적 생성) ── */
function initMobileTabBar(){
  /* HTML에 이미 탭바가 있으므로 업데이트만 */
  updateMobileTabBar();
  var main = document.querySelector('.main');
  if(main) main.style.paddingBottom = 'calc(60px + env(safe-area-inset-bottom, 0px))';
}

function updateMobileTabBar(){
  var bar=document.getElementById('mobileTabBar');
  if(!bar) return;
  bar.querySelectorAll('.mtab-item').forEach(function(el){
    var pid=el.id.replace('mTab_','');
    el.classList.toggle('on', pid===page);
  });
}

/* 창 크기 변경 시 처리 */
window.addEventListener('resize', function(){
  updateMobileTabBar();
});

/* SIDEBAR */
(function(){
  var now=new Date();
  ge('sbTodayDate').textContent=fmtL(now);
  if(now.getDay()===1)ge('monPill').style.display='block';
})();

function renderSidebarToday(){
  var now=new Date();
  var todayDay=JSDOW[now.getDay()];
  var mon=getMon(now);
  var sched=getWeekSched(mon);
  var el=ge('sbTodayList');
  var slots=[];
  HOURS.forEach(function(h){
    var key=todayDay+'_'+h;
    (sched[key]||[]).forEach(function(x){if(!x.absent)slots.push({s:x.s,h:h});});
  });
  if(!slots.length){el.innerHTML='<div class="sb-no-lesson">오늘 레슨이 없습니다</div>';return;}
  var nowMins=now.getHours()*60+now.getMinutes();
  var html='';
  slots.forEach(function(item){
    var c=gc(item.s);
    var tl=logs.find(function(l){return l.sid===item.s.id&&l.date===toDS(now);});
    var hp=item.h.split(':');
    var slotMins=parseInt(hp[0])*60+parseInt(hp[1]||0);
    var isCurrent=Math.abs(nowMins-slotMins)<=65;
    /* 보안: 현재 시간대(±65분) 수업만 이름 표시 */
    var nameHtml=isCurrent
      ?esc(item.s.name)+'<span style="font-size:9px;background:var(--g);color:#000;border-radius:3px;padding:1px 4px;margin-left:4px;font-weight:700">NOW</span>'
      :'레슨 '+item.h;
    html+='<div class="sb-lesson-item" data-sid="'+item.s.id+'" data-h="'+item.h+'" data-date="'+toDS(now)+'" onclick="sbLessonClick(this)" style="'+(isCurrent?'background:rgba(109,200,162,.08);border-radius:8px;':'')+'">';
    html+='<span class="sb-lesson-dot" style="background:'+c+'"></span>';
    html+='<span class="sb-lesson-name">'+nameHtml+'</span>';
    html+='<span class="sb-lesson-time">'+item.h+(tl?' ✓':'')+'</span>';
    html+='</div>';
  });
  el.innerHTML=html;
}
function sbLessonClick(el){
  openLessonRecord(el.dataset.sid,el.dataset.h,el.dataset.date);
}