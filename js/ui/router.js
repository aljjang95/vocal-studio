/* ============================================================
   router.js — 페이지 라우터 & 렌더러
   go(p) : 페이지 전환
   render() : 현재 page 기준으로 컨텐츠 렌더링
   ============================================================ */

/* NAV */
var page='today',wkOfs=0;
var _ciDraftTimer=null;
var _consultTab='consult';
var PT={dashboard:'대시보드',consult:'신규 상담',students:'레슨생 관리',logs:'레슨 기록',payment:'입금 관리',today:'오늘 스케줄',schedule:'주간 스케줄',timeline:'진도 타임라인'};
function go(p){
  page=p;wkOfs=0;
  // 스케줄 설정 버튼 표시/숨김
  setTimeout(function(){
    var cfgBtn=ge('vs-sched-cfg-btn');
    var cfgPanel=ge('vs-sched-cfg');
    if(cfgBtn){
      cfgBtn.style.display=(p==='schedule')?'flex':'none';
      if(p!=='schedule'&&cfgPanel)cfgPanel.classList.remove('open');
    }
    updateSchedCfgUI();
    // 스케줄 탭 진입 시 파티클 burst
    if(p==='schedule'){
      var container=document.getElementById('vs-particles');
      if(container){
        var month=new Date().getMonth()+1;
        var season=month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
        for(var bi=0;bi<6;bi++){
          (function(bi){setTimeout(function(){if(typeof makeParticle==='function')makeParticle(season);},bi*80);})(bi);
        }
      }
    }
  },50);
  if(p==='consult') _consultTab='consult';
  /* 모바일 스케줄 선택 요일 오늘로 리셋 */
  if(p==='schedule'){
    mobileSchedDay=(new Date().getDay()===0)?6:(new Date().getDay()-1);
    mobileSchedView='day';
  }
  document.querySelectorAll('.ni[data-p]').forEach(function(n){n.classList.toggle('on',n.dataset.p===p);});
  if(ge('pt'))ge('pt').textContent=PT[p]||'';
  /* 페이드 전환 */
  var c=ge('content');
  if(c){c.classList.add('fade');setTimeout(function(){c.classList.remove('fade');render();},120);}
  else render();
  /* 모바일 탭바 업데이트 */
  setTimeout(function(){updateMobileTabBar();},0);
}
function render(){
  if(page==='eval') return; /* 평가지 페이지는 render로 덮어쓰지 않음 */
  /* 새로고침 후 eval 복원 - Firebase 로드 완료 후에만 */
  if(_fbReady&&!window._skipEvalRestore){
    try{
      var _evalCid=localStorage.getItem('vsC_evalCid');
      if(_evalCid&&consults.find(function(x){return x.id===_evalCid;})){
        localStorage.removeItem('vsC_evalCid');
        showEvalPage(_evalCid);
        return;
      }
    }catch(e){}
  }
  window._skipEvalRestore=false;
  if(page==='dashboard'){
    /* 대시보드는 비밀번호 확인 후 진입 */
    askDashboardPw();
    return;
  } else if(page==='schedule'){
    var wkBtn=wkOfs?'<button class="btn bg2 bsm" onclick="wkOfs=0;render()">이번 주</button>':'';
    var _activeSt=students.filter(function(s){return s.status==='수강중';});
    var _flexSt=_activeSt.filter(function(s){return s.schedType==='flex';});
    var _fixedSt=_activeSt.filter(function(s){return s.schedType==='fixed';});
    var _curWk=getWK(getViewMon());
    /* 변동: weekOvr에 배정 없으면 미배정 */
    var _unassignedFlex=_flexSt.filter(function(s){return !weekOvr[_curWk]||!weekOvr[_curWk][s.id]||weekOvr[_curWk][s.id].length===0;});
    /* 고정: schedDays가 비어있으면 미배정 */
    /* 고정: s.days 없고 이번 주 weekOvr에도 없으면 미배정 */
    var _unassignedFixed=_fixedSt.filter(function(s){
      var hasDays=s.days&&s.days.length>0;
      var hasWkOvr=weekOvr[_curWk]&&weekOvr[_curWk][s.id]&&weekOvr[_curWk][s.id].length>0;
      return !hasDays&&!hasWkOvr;
    });
    var _unassigned=_unassignedFlex.concat(_unassignedFixed);
    var _infoTxt='수강중 '+_activeSt.length+'명';
    if(_unassigned.length)_infoTxt+=' | <span style="color:var(--r);font-weight:700">⚠️ 미배정 '+_unassigned.length+'명: '+_unassigned.map(function(s){return esc(s.name);}).join(', ')+'</span>';
    if(!ge('ta')) return;
    var _monTgl='<button class="btn bsm" style="'+((_cfg.monCollapsed)?'background:var(--a);color:#08080d;':'background:rgba(255,255,255,.06);color:var(--ts);border:1px solid var(--b);')+'" onclick="toggleMonCollapse()" title="월요일 접기/펼치기">월'+((_cfg.monCollapsed)?'▶':'◀')+'</button>';
    var _sunTgl='<button class="btn bsm" style="'+((_cfg.sunCollapsed)?'background:var(--a);color:#08080d;':'background:rgba(255,255,255,.06);color:var(--ts);border:1px solid var(--b);')+'" onclick="toggleSunCollapse()" title="일요일 접기/펼치기">일'+((_cfg.sunCollapsed)?'▶':'◀')+'</button>';
    ge('ta').innerHTML='<div class="wn-bar"><div class="wn-btn" onclick="wkOfs--;render()">&#8249;</div><div class="wn-lbl" id="wkLbl">&#x22EF;</div><div class="wn-btn" onclick="wkOfs++;render()">&#8250;</div>'+wkBtn+'</div>'
      +'<span style="font-size:12.5px;color:var(--tm);white-space:nowrap">'+_infoTxt+'</span>'
      +(isMobile()?'':_monTgl+_sunTgl+'<button class="btn bm" onclick="openFlexWeek()">🔄 변동 배정</button><button class="btn bg2" onclick="openWE()">📋 주간 수정</button><button class="btn bg2" onclick="openSMSParser()">📩 문자 파싱</button><button class="btn bg2" onclick="resetWeekOvr()" style="background:rgba(200,114,114,.08);color:var(--r);border:1px solid rgba(200,114,114,.18)">🔄 초기화</button>');
    /* 공휴일 API 로드 후 렌더링 */
    loadHolidaysForView(function(){
      ge('content').innerHTML=isMobile()?buildMobileSchedule():buildSchedule();
      if(isMobile()){setTimeout(function(){attachMobileEvents();},50);}
    });
  } else if(page==='students'){
    if(!ge('ta')||!ge('content')) return;
    ge('ta').innerHTML='<button class="btn bp" onclick="openSModal()" style="gap:8px"><span style="font-size:16px;line-height:1">＋</span> 레슨생 추가</button>';
    ge('content').innerHTML=buildStudents(_studentSearch||'',currentStudentTab||'all');
    /* 포커스 복원 */
    var _si=ge('studentSearch');
    if(_si&&_studentSearch){_si.focus();_si.setSelectionRange(_studentSearch.length,_studentSearch.length);}
  } else if(page==='logs'){
    ge('ta').innerHTML='';
    ge('content').innerHTML=buildLogs('');
  } else if(page==='payment'){
    ge('ta').innerHTML='';
    ge('content').innerHTML=buildPayment();
  } else if(page==='timeline'){
    ge('ta').innerHTML='';
    ge('content').innerHTML=buildTimeline();
  } else if(page==='today'){
    ge('ta').innerHTML='';
    ge('content').innerHTML=buildTodaySchedule();
  } else if(page==='consult'){
    if(!ge('ta')||!ge('content')) return;
    ge('ta').innerHTML='';
    /* 상담 탭 = 상담신청자 + 문의자 탭 */
    var consultTab=_consultTab||'consult';
    var tabHtml='<div style="display:flex;gap:6px;margin-bottom:14px;align-items:center">';
    tabHtml+='<button class="btn bsm '+(consultTab!=='inquiry'?'bp':'')+'" onclick="setConsultTab(\'consult\')">📋 상담신청자</button>';
    tabHtml+='<button class="btn bsm '+(consultTab==='inquiry'?'bp':'')+'" onclick="setConsultTab(\'inquiry\')">❓ 문의자</button>';
    tabHtml+='<button class="btn bsm bp" style="margin-left:auto" onclick="showConsultForm()">＋ 신규 상담 작성</button>';
    var _lp=null;try{_lp=JSON.parse(localStorage.getItem('vsC_pending')||'null');}catch(e){}
    if(_lp&&_lp.name)tabHtml+='<button class="btn bsm bm" onclick="loadPendingConsult()" title="보류: '+esc(_lp.name)+'">↩ '+esc(_lp.name)+'</button>';
    tabHtml+='</div>';
    if(consultTab==='inquiry'){
      ge('content').innerHTML=tabHtml+buildInquiryList();
    } else {
      ge('content').innerHTML=tabHtml+buildConsultList();
    }
  }
  renderSidebarToday();
}