/**
 * app.js — 엔트리포인트
 * 모든 스크립트 로드 후 초기화 실행
 */

window.__DBG={};
try{renderSidebarToday();window.__DBG.sb=1;}catch(e){window.__DBG.sbE=e.message+' | '+e.stack;}
try{render();window.__DBG.rn=1;}catch(e){window.__DBG.rnE=e.message+' | '+e.stack;}
try{initLock();window.__DBG.lk=1;}catch(e){window.__DBG.lkE=e.message;}
try{initFirebase();window.__DBG.fb=1;}catch(e){window.__DBG.fbE=e.message;}

/* 설정 UI 동기화 */
setTimeout(function(){
  if(typeof updateSchedCfgUI==='function') updateSchedCfgUI();
  var cfgBtn=ge('vs-sched-cfg-btn');
  if(cfgBtn&&page==='schedule') cfgBtn.style.display='flex';
},200);

/* 오버레이 자동 닫기 핸들러 */
initOverlayCloseHandlers();

/* Firebase 로드 후 또는 3초 후 알림 표시 */
setTimeout(function(){
  if(students.length>0) showTodayAlert();
},3000);
