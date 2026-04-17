/* ============================================================
   students.js — 레슨생 관리
   buildStudents() : 레슨생 목록 HTML 생성
   toggleStudentSort() : 정렬 전환
   stTab() : 탭 클릭
   switchStudentTab() : 탭 전환
   filterStudents() : 검색 필터
   openStudentById() : ID로 학생 열기
   openConsultById() : 상담 ID로 열기
   getChosung() : 초성 추출
   matchSearch() : 검색 매칭
   ============================================================ */

/* STUDENTS LIST */
var studentSearchVal='';
var currentSortAsc=false;
function buildStudents(filter, schedFilter){
  schedFilter=schedFilter||'all';
  var base=filter?students.filter(function(s){return matchSearch(s.name,filter)||(s.ph&&s.ph.indexOf(filter)>=0);}):students;
  var f=base;
  if(schedFilter==='fixed')f=base.filter(function(s){return s.schedType!=='flex'&&s.status==='수강중';});
  else if(schedFilter==='flex')f=base.filter(function(s){return s.schedType==='flex'&&s.status==='수강중';});
  else if(schedFilter==='active')f=base.filter(function(s){return s.status==='수강중';});
  else if(schedFilter==='hukang')f=base.filter(function(s){return s.status==='휴강';});
  else if(schedFilter==='done')f=base.filter(function(s){return s.status!=='수강중';});
  /* 정렬: 최신 등록 순 기본 */
  var sortAsc=currentSortAsc||false;
  f=f.slice().sort(function(a,b){
    var at=(a.createdAt||0),bt=(b.createdAt||0);
    return sortAsc?(at-bt):(bt-at);
  });
  var fixedCnt=students.filter(function(s){return s.schedType!=='flex'&&s.status==='수강중';}).length;
  var flexCnt=students.filter(function(s){return s.schedType==='flex'&&s.status==='수강중';}).length;
  var activeCnt2=students.filter(function(s){return s.status==='수강중';}).length;
  var hukangCnt=students.filter(function(s){return s.status==='휴강';}).length;
  var doneCnt=students.filter(function(s){return s.status!=='수강중';}).length;
  var o='<div style="margin-bottom:16px">';
  /* 필터 탭 */
  o+='<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:10px">';
  o+=stTab('전체 '+students.length,'all',schedFilter);
  o+=stTab('📌 고정 '+fixedCnt,'fixed',schedFilter);
  o+=stTab('🔄 변동 '+flexCnt,'flex',schedFilter);
  o+=stTab('🟢 수강중 '+activeCnt2,'active',schedFilter);
  o+=stTab('⏸ 휴강 '+hukangCnt,'hukang',schedFilter);
  o+=stTab('수료/기타 '+doneCnt,'done',schedFilter);
  o+='<button class="btn bg2 bsm" style="margin-left:auto;font-size:11.5px" onclick="toggleStudentSort()">'+(currentSortAsc?'⬆ 오래된순':'⬇ 최신순')+'</button>';
  o+='</div>';
  if(schedFilter==='flex'&&flexCnt>0){
    o+='<button class="btn bm bsm" onclick="openFlexWeek()" style="margin-bottom:10px">🔄 이번 주 변동 배정</button>';
  }
  o+='</div>';

  o+='<div class="card"><div class="ch" style="gap:10px"><span class="ct">레슨생 목록 <span style="font-size:13px;color:var(--tm);font-weight:400">('+f.length+'명)</span></span>';
  o+='<div style="position:relative;display:flex;align-items:center">';
  o+='<input id="studentSearch" type="text" placeholder="🔍 이름·초성 검색" value="'+esc(filter||'')+'" style="background:rgba(255,255,255,.05);border:1px solid var(--b);color:var(--t);padding:8px 36px 8px 13px;border-radius:9px;font-size:14px;width:200px;outline:none;" data-sf="'+schedFilter+'" oninput="filterStudents(this.value,this.dataset.sf)">';
  if(filter)o+='<button onclick="_studentSearch=\'\';filterStudents(\'\',\''+schedFilter+'\')" style="position:absolute;right:8px;background:none;border:none;color:var(--tm);cursor:pointer;font-size:15px;line-height:1;padding:0">✕</button>';
  o+='</div>';
  o+='</div>';
  if(!f.length){
    o+='<div class="empty"><div class="ei">♬</div><div class="et">'+(students.length?'해당 조건의 레슨생이 없습니다':'아직 등록된 레슨생이 없습니다')+'</div><div class="ed">'+(students.length?'다른 탭을 선택하거나 검색어를 변경해보세요':'사이드바 상단 ＋ 버튼 또는 우측 상단 버튼으로 추가하세요')+'</div></div>';
  } else if(schedFilter==='done'){
    o+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;padding:10px">';
    f.forEach(function(s){
      var c=gc(s); var sLogs=logs.filter(function(l){return l.sid===s.id;});
      var att=sLogs.filter(function(l){return l.att==='출석';}).length;
      o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:13px;padding:16px;cursor:pointer;transition:border-color .14s" data-sid="'+s.id+'" onclick="openStudentById(this.dataset.sid)" onmouseenter="this.style.borderColor=\'rgba(200,169,110,.25)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'">';
      var avH=getStudentPhoto(s)
        ?'<img src="'+getStudentPhoto(s)+'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid '+c+'44">'
        :'<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,'+c+'30,'+COLORS[(students.indexOf(s)+2)%COLORS.length]+'20);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:'+c+'">'+esc(s.name.slice(0,1))+'</div>';
      o+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">'+avH;
      o+='<div><div style="font-size:14px;font-weight:700;color:var(--t)">'+esc(s.name)+'</div>';
      o+='<span class="bdg '+(s.status==='수료'?'bg-g':'bg-a')+'" style="font-size:10px;margin-top:3px">'+esc(s.status)+'</span></div></div>';
      o+='<div style="font-size:12px;color:var(--tm);line-height:1.9;border-top:1px solid var(--b);padding-top:10px">';
      o+='<div>'+clsL(s.cls)+' · '+(s.freq===2?'주 2회':'주 1회')+'</div>';
      o+='<div>총 <b style="color:var(--a)">'+sLogs.length+'</b>회 · 출석 <b style="color:var(--g)">'+att+'</b>회</div>';
      if(s.st)o+='<div>시작 '+esc(s.st)+'</div>';
      o+='</div></div>';
    });
    o+='</div>';
  } else {
    o+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:8px;padding:10px" id="studentsGrid">';
    f.forEach(function(s){
      var c=gc(s),c2=COLORS[(students.indexOf(s)+2)%COLORS.length];
      var sLogs=logs.filter(function(l){return l.sid===s.id;});
      var att=sLogs.filter(function(l){return l.att==='출석';}).length;
      var attRate=sLogs.length?Math.round(att/sLogs.length*100):0;
      var _rawAge=s.age?String(s.age).trim():'';
      var _n=parseInt(_rawAge)||0;
      var _yr=_rawAge.length<=2&&_n>=0?(_n>=30?1900+_n:2000+_n):_n;
      var _ty=new Date().getFullYear();
      var ageStr=_yr>=1920&&_yr<=_ty?('만 '+(_ty-_yr)+'세'):'';
      var _du=s.deferrals||0,_dm=s.maxDeferrals||2;
      var _thisMonth=new Date().getFullYear()+'-'+(String(new Date().getMonth()+1).padStart(2,'0'));
      var _paid=payments.some(function(p){return p.sid===s.id&&p.date&&p.date.slice(0,7)===_thisMonth;});
      var unpaidBadge=(s.status==='수강중'&&s.fee>0&&!_paid)
        ?'<span style="font-size:10px;background:rgba(200,80,80,.15);color:var(--r);border:1px solid rgba(200,80,80,.2);border-radius:4px;padding:2px 6px;font-weight:600">미입금</span>':'';
      var schedBadge=s.schedType==='flex'
        ?'<span style="font-size:10px;background:rgba(110,163,200,.12);color:var(--bl);border-radius:4px;padding:2px 6px">🔄변동</span>'
        :'<span style="font-size:10px;background:rgba(200,169,110,.1);color:var(--a);border-radius:4px;padding:2px 6px">📌고정</span>';
      var timeStr=s.schedType==='flex'?'변동 스케줄'
        :(s.days||[]).length
          ?(s.days||[]).map(function(d){return d+'요일'+(s.times&&s.times[d]?' '+s.times[d]:'');}).join(' · ')
          :'요일 미지정';
      var statusColor=s.status==='수강중'?'bg-g':s.status==='휴강'?'bg-a':'bg-r';
      var _sPhoto=getStudentPhoto(s);
      var avPhoto=_sPhoto
        ?'<img src="'+_sPhoto+'" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block">'
        :'<div style="width:100%;height:100%;background:linear-gradient(145deg,'+c+'30,'+c2+'18);display:flex;align-items:center;justify-content:center;font-family:Cormorant Garamond,serif;font-size:28px;font-weight:900;color:'+c+';opacity:.65">'+esc(s.name.slice(0,1))+'</div>';

      o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .14s" data-sid="'+s.id+'" onmouseenter="this.style.borderColor=\'rgba(200,169,110,.25)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'">';

      /* 상단: 사진 + 기본 정보 */
      o+='<div style="display:flex;gap:0">';
      /* 사진 */
      o+='<div style="width:90px;height:90px;flex-shrink:0;cursor:pointer;overflow:hidden;border-right:1px solid var(--b)" data-sid="'+s.id+'" onclick="openStudentById(this.dataset.sid)">'+avPhoto+'</div>';
      /* 이름/뱃지 영역 */
      o+='<div style="flex:1;padding:10px 12px;min-width:0;cursor:pointer" data-sid="'+s.id+'" onclick="openStudentById(this.dataset.sid)">';
      o+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:5px">';
      o+='<span style="font-size:16px;font-weight:800;color:var(--t);letter-spacing:-.01em">'+esc(s.name)+'</span>';
      o+='<span class="bdg '+statusColor+'">'+esc(s.status)+'</span>';
      o+=schedBadge;
      if(unpaidBadge)o+=unpaidBadge;
      o+='</div>';
      /* 나이·연락처 */
      o+='<div style="font-size:11.5px;color:var(--tm);margin-bottom:4px">';
      if(ageStr)o+='<span>'+ageStr+'</span>';
      if(ageStr&&s.ph)o+='<span style="opacity:.4;margin:0 5px">·</span>';
      if(s.ph)o+='<span style="font-family:DM Mono,monospace">'+esc(s.ph)+'</span>';
      o+='</div>';
      /* 스케줄 */
      o+='<div style="font-size:11.5px;color:var(--ts);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(timeStr)+'</div>';
      o+='</div></div>';

      /* 통계 바 */
      var ci=getCycleInfo(s);
      var remainInCycle=ci.remainInCycle;
      o+='<div style="padding:8px 12px;border-top:1px solid var(--b);display:flex;gap:10px;font-size:11px;color:var(--tm);background:rgba(255,255,255,.015);flex-wrap:wrap">';
      o+='<span>레슨 <b style="color:var(--a);font-size:12px">'+sLogs.length+'</b>회</span>';
      o+='<span>출석 <b style="color:var(--g);font-size:12px">'+att+'</b>회</span>';
      o+='<span>출석률 <b style="color:var(--t);font-size:12px">'+attRate+'%</b></span>';
      o+='<span style="margin-left:auto"><span style="color:var(--a);font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px" data-sid="'+s.id+'" onclick="event.stopPropagation();openEditLessonCount(this.dataset.sid)">현재 '+ci.totalLessons+'회</span></span>';
      if(_du>0)o+='<span style="color:var(--tm)">연기 '+_du+'/'+_dm+'</span>';
      o+='</div>';

      /* 액션 버튼 영역 — 2열 레이아웃, 충분한 크기 */
      o+='<div style="padding:8px 10px;border-top:1px solid var(--b);display:grid;grid-template-columns:1fr 1fr;gap:5px">';

      /* 1행: 연락처 */
      if(s.ph){
        o+='<a href="tel:'+esc(s.ph)+'" onclick="event.stopPropagation()" class="btn bsm" style="justify-content:center;background:rgba(109,200,162,.09);color:var(--g);border:1px solid rgba(109,200,162,.18);text-decoration:none;font-size:12px">📞 전화</a>';
        o+='<a href="sms:'+esc(s.ph)+'" onclick="event.stopPropagation()" class="btn bsm" style="justify-content:center;background:rgba(110,163,200,.09);color:var(--bl);border:1px solid rgba(110,163,200,.18);text-decoration:none;font-size:12px">💬 문자</a>';
      } else {
        o+='<div style="grid-column:1/-1"></div>';
      }

      /* 2행: 주요 기능 */
      o+='<button class="btn bsm" style="justify-content:center;background:rgba(110,163,200,.09);color:var(--bl);border:1px solid rgba(110,163,200,.18);font-size:12px" data-sid="'+s.id+'" onclick="event.stopPropagation();openBulkSchedule(this.dataset.sid)">📅 일정 등록</button>';
      o+='<button class="btn bsm bp" style="justify-content:center;font-size:12px" data-sid="'+s.id+'" onclick="event.stopPropagation();openStudentById(this.dataset.sid)">상세 보기 →</button>';

      /* 3행: 수정 + 연기 */
      o+='<button class="btn bsm" style="justify-content:center;background:rgba(200,169,110,.09);color:var(--a);border:1px solid var(--b);font-size:12px" data-sid="'+s.id+'" onclick="event.stopPropagation();cm(\'mProfile\');openSModal(this.dataset.sid)">✏️ 수정</button>';
      o+='<button class="btn bsm" style="justify-content:center;background:rgba(255,255,255,.04);color:var(--ts);border:1px solid var(--b);font-size:12px" data-sid="'+s.id+'" onclick="event.stopPropagation();useDeferral(this.dataset.sid)">⏸ 연기 사용</button>';

      o+='</div></div>';
    });
    o+='</div>';
  }
  return o+'</div>';
}

function toggleStudentSort(){
  currentSortAsc=!currentSortAsc;
  var inp=document.getElementById('studentSearch');
  var sf=inp?inp.dataset.sf:'all';
  ge('content').innerHTML=buildStudents(inp?inp.value:'',sf||currentStudentTab||'all');
}
function stTab(label, val, cur){
  var on=val===cur;
  return '<button class="btn bsm" style="'+(on
    ?'background:var(--a);color:#08080d;font-weight:700;'
    :'background:rgba(255,255,255,.05);color:var(--ts);border:1px solid var(--b);'
  )+'" data-sf="'+val+'" onclick="switchStudentTab(this.dataset.sf)">'+label+'</button>';
}
function switchStudentTab(sf){currentStudentTab=sf;
  var inp=ge('studentSearch');
  var filter=inp?inp.value:'';
  ge('content').innerHTML=buildStudents(filter,sf);
  var newInp=ge('studentSearch');
  if(newInp){newInp.focus();newInp.setSelectionRange(newInp.value.length,newInp.value.length);}
}

/* ── 초성 검색 유틸 ── */
function getChosung(str){
  var CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return Array.from(str||'').map(function(c){
    var code=c.charCodeAt(0)-0xAC00;
    if(code<0||code>11171) return c;
    return CHO[Math.floor(code/21/28)];
  }).join('');
}
function matchSearch(target,query){
  if(!query) return true;
  target=target||'';
  /* 일반 포함 검색 */
  if(target.indexOf(query)>=0) return true;
  /* 초성 검색 */
  var tCho=getChosung(target);
  var qCho=getChosung(query);
  if(tCho.indexOf(qCho)>=0) return true;
  return false;
}
/* ── 한글 IME 조합 감지 (전역 위임) ── */
window._imeComposing=false;
document.addEventListener('compositionstart',function(e){
  if(e.target&&e.target.id==='studentSearch') window._imeComposing=true;
});
document.addEventListener('compositionend',function(e){
  if(e.target&&e.target.id==='studentSearch'){
    window._imeComposing=false;
    var sf=e.target.dataset.sf||currentStudentTab||'all';
    filterStudents(e.target.value,sf);
  }
});

function filterStudents(val,sf){
  _studentSearch=val||'';
  /* 한글 IME 조합 중이면 DOM 재생성 건너뜀 */
  if(window._imeComposing) return;
  ge('content').innerHTML=buildStudents(val,sf||currentStudentTab||'all');
  var inp=ge('studentSearch');
  if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}
}
function openStudentById(sid){
  var s=students.find(function(x){return x.id===sid;});
  if(s)openProfile(s,'student');
}
function openConsultById(cid){
  var c=consults.find(function(x){return x.id===cid;});
  if(c)openProfile(c,'consult');
}



/* STUDENT MODAL */
var editSid=null,pendingConvertId=null,curSType='fixed',curFreq=1;

/* AUTO FEE */
var FEE_TABLE={pro:{1:350000,2:600000},hob:{1:250000,2:450000},chuk:{1:350000,2:600000},voice:{1:350000,2:600000}};
function autoFee(){
  var cls=gv('s-cls')||'pro';
  var freq=parseInt(gv('s-freq'))||curFreq||1;
  var fee=(FEE_TABLE[cls]&&FEE_TABLE[cls][freq])||0;
  var el=ge('s-fee');
  if(fee&&el){el.value=fee;el.style.color='var(--a)';}
}

function setFreq(n){curFreq=n;ge('s-freq-1').classList.toggle('on',n===1);ge('s-freq-2').classList.toggle('on',n===2);var hf=ge('s-freq');if(hf)hf.value=n;setTimeout(updateCyclePreview,30);}
function setSType(t){
  curSType=t;
  ge('s-stype-fixed').classList.toggle('on',t==='fixed');
  ge('s-stype-flex').classList.toggle('on',t==='flex');
  ge('s-fixed-wrap').style.display=t==='fixed'?'block':'none';
}
function openSModal(id){
  editSid=id||null;pendingConvertId=null;
  var isEdit=!!id;
  ge('mST').textContent=isEdit?'레슨생 수정':'레슨생 추가';
  /* 헤더 아바타·부제목 업데이트 */
  var s=isEdit?students.find(function(st){return st.id===id;}):null;
  var av=ge('mS-av');
  if(av){
    if(getStudentPhoto(s)){av.innerHTML='<img src="'+getStudentPhoto(s)+'" style="width:40px;height:40px;border-radius:10px;object-fit:cover">';}
    else if(s){var c=gc(s);av.innerHTML='<span style="font-size:16px;font-weight:700;color:'+c+'">'+esc(s.name.slice(0,1))+'</span>';av.style.background=c+'22';av.style.borderColor=c+'44';}
    else{av.innerHTML='♬';av.style.background='var(--ag)';av.style.borderColor='rgba(200,169,110,.2)';}
  }
  var sub=ge('mS-sub');
  if(sub)sub.textContent=isEdit?(esc(clsL(s&&s.cls||'pro'))+' · '+(s&&s.status||'')):'기본 정보를 입력해주세요';
  ge('s-nm').value=(s&&s.name)||'';ge('s-cls').value=(s&&s.cls)||'pro';
  ge('s-gd').value=(s&&s.gd)||'여성';var _sAge=s&&s.age?String(s.age).trim():'';
  var _sN=parseInt(_sAge)||0;
  var _sYr=_sAge&&_sAge.length<=2&&_sN>=0?(_sN>=30?1900+_sN:2000+_sN):_sN;
  ge('s-age').value=_sYr||_sAge||'';
  if(ge('s-age').value){var _ageEl=ge('s-age');if(_ageEl)setTimeout(function(){updateAge(_ageEl);},50);}
  ge('s-ph').value=(s&&s.ph)||'';ge('s-st').value=(s&&s.st)||toDS(new Date());
  ge('s-memo').value=(s&&s.memo)||'';ge('s-stat').value=(s&&s.status)||'수강중';
  ge('s-fee').value=(s&&s.fee&&s.fee>0)?s.fee:'';if(ge('s-fee'))ge('s-fee').removeAttribute('data-user-edited');
  /* 이전 누적 회차 */
  var offsetEl=document.getElementById('s-lesson-offset');
  if(offsetEl)offsetEl.value=(s&&s.lessonOffset>0)?s.lessonOffset:'';
  setTimeout(function(){updateCyclePreview();},50);
  setFreq(parseInt((s&&s.freq))||1);setSType((s&&s.schedType)||'fixed');
  var pv=ge('s-photo-preview'),pd=ge('s-photo-data');
  var _spEdit=getStudentPhoto(s);
  if(_spEdit){pd.value=_spEdit;pv.innerHTML='<img src="'+_spEdit+'">';}
  else{pd.value='';pv.innerHTML='<div class="no-ph">📷</div>';}
  document.querySelectorAll('#s-dpick .dpb').forEach(function(b){
    b.classList.toggle('on',(s&&s.days||[]).indexOf(b.textContent)>=0);
  });
  window._prefilledTimes={};
  ge('sBtnDel').style.display=id?'flex':'none';
  showConsultHint(null);
  setTimeout(function(){if(!id||(id&&!(s&&s.fee>0)))autoFee();},80);
  updateTimeSlots(s);om('mS');
}
function tDay(btn){btn.classList.toggle('on');updateTimeSlots(editSid?students.find(function(s){return s.id===editSid;}):null);}
function updateCyclePreview(){
  var offsetEl=document.getElementById('s-lesson-offset');
  var offset=offsetEl?parseInt(offsetEl.value)||0:0;
  var freq=curFreq||1;
  var cycleSize=freq===2?8:4;
  var freqDisp=document.getElementById('s-freq-display');
  if(freqDisp)freqDisp.textContent='주 '+freq+'회 → '+cycleSize+'회마다 입금';
  var preview=document.getElementById('s-cycle-preview');
  var previewContent=document.getElementById('s-cycle-preview-content');
  if(!preview||!previewContent)return;
  if(!offsetEl||offsetEl.value===''){preview.style.display='none';return;}
  preview.style.display='block';
  var cycleNum=offset>0?Math.floor((offset-1)/cycleSize)+1:1;
  var posInCycle=offset>0?((offset-1)%cycleSize)+1:0;
  var cycleStart=(cycleNum-1)*cycleSize+1;
  var cycleEnd=cycleNum*cycleSize;
  var remaining=cycleSize-posInCycle;
  var pct=cycleSize>0?Math.round(posInCycle/cycleSize*100):0;
  var html='<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">';
  html+='<div style="background:var(--ag);border:1px solid var(--b2);border-radius:8px;padding:6px 12px;text-align:center">';
  html+='<div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:900;color:var(--a);line-height:1">'+offset+'</div>';
  html+='<div style="font-size:9px;color:var(--tm);letter-spacing:.1em;text-transform:uppercase">현재 회차</div>';
  html+='</div>';
  html+='<div>';
  html+='<div style="font-size:13px;color:var(--ts);margin-bottom:3px"><b style="color:var(--t)">'+cycleStart+'회 ~ '+cycleEnd+'회</b> 구간 진행 중</div>';
  if(remaining>0){
    html+='<div style="font-size:12.5px;color:var(--g)">→ <b>'+remaining+'회</b> 후 다음 입금 ('+cycleEnd+'회 완료 시)</div>';
  } else if(offset>0){
    html+='<div style="font-size:12.5px;color:var(--r);font-weight:700">⚡ 구간 완료 — 레슨비 필요</div>';
  }
  html+='</div></div>';
  html+='<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--a);border-radius:3px;transition:width .3s"></div></div>';
  html+='<div style="font-size:11px;color:var(--tm);margin-top:5px">'+posInCycle+'/'+cycleSize+'회 진행</div>';
  previewContent.innerHTML=html;
}
function showConsultHint(c){
  var hint=ge('s-consult-hint');
  if(!hint)return;
  if(!c){hint.style.display='none';return;}
  var parts=[];
  if(c.days&&c.days.length)parts.push('희망 요일: '+c.days.join(', '));
  if(c.time)parts.push('희망 시간: '+c.time);
  if(c.schedPref)parts.push(c.schedPref==='flex'?'🔄 변동 희망':'📌 고정 희망');
  if(parts.length){hint.style.display='block';hint.innerHTML='<span style="font-size:11px;color:var(--tm);font-weight:600">신청서 희망</span><br>'+parts.join(' &nbsp;·&nbsp; ');}
  else hint.style.display='none';
}
function updateTimeSlots(s){
  var sel=Array.from(document.querySelectorAll('#s-dpick .dpb.on')).map(function(b){return b.textContent;});
  var wrap=ge('tsSlots');
  if(!sel.length){wrap.innerHTML='<span style="font-size:13px;color:var(--tm)">위에서 요일을 선택하면 나타납니다</span>';return;}
  var o='';
  var pft=window._prefilledTimes||{};
  /* 현재 주 스케줄로 충돌 체크 */
  var mon=getMon(new Date());
  var sched=getWeekSched(mon);
  var editingId=editSid||'__new__';
  sel.forEach(function(d){
    var cur=(s&&s.times&&s.times[d])||pft[d]||'';
    var opts=HOURS.map(function(h){
      /* 이 슬롯에 다른 레슨생이 있는지 체크 */
      var slotKey=d+'_'+h;
      var conflicts=(sched[slotKey]||[]).filter(function(x){return x.s.id!==editingId;});
      var conflict=conflicts.length>0;
      var label=conflict?(h+' ⚠️ '+conflicts.map(function(x){return x.s.name;}).join(',')+'님'):h;
      return '<option value="'+h+'"'+(cur===h?' selected':'')+(conflict?' style="color:#c87272"':'')+'>'+label+'</option>';
    }).join('');
    /* 충돌 여부 미리 체크 */
    var curConflicts=cur?(sched[d+'_'+cur]||[]).filter(function(x){return x.s.id!==editingId;}).map(function(x){return x.s.name;}):[];
    var conflictWarn=curConflicts.length?'<div style="font-size:11.5px;color:var(--r);margin-top:3px;font-weight:600">⚠️ '+d+' '+cur+' — 이미 '+curConflicts.join(', ')+'님 수업 있음</div>':'';
    o+='<div style="margin-bottom:11px"><div style="display:flex;align-items:center;gap:12px">';
    o+='<span style="font-size:14px;font-weight:600;width:22px">'+d+'</span>';
    o+='<select id="ts-'+d+'" data-day="'+d+'" style="max-width:170px" onchange="checkSlotConflict(this,this.dataset.day)">';
    o+=opts;
    o+='</select></div>'+conflictWarn+'</div>';
  });
  wrap.innerHTML=o;
}
function checkSlotConflict(el,day){
  var h=el.value;
  var mon=getMon(new Date());
  var sched=getWeekSched(mon);
  var conflicts=(sched[day+'_'+h]||[]).filter(function(x){return x.s.id!==(editSid||'__new__');});
  /* show/hide warning below select */
  var parent=el.parentElement.parentElement;
  var warn=parent.querySelector('.slot-warn');
  if(!warn){warn=document.createElement('div');warn.className='slot-warn';warn.style.cssText='font-size:11.5px;color:var(--r);margin-top:3px;font-weight:600';parent.appendChild(warn);}
  if(conflicts.length){warn.textContent='⚠️ '+day+' '+h+' — 이미 '+conflicts.map(function(x){return x.s.name;}).join(', ')+'님 수업 있음';}
  else{warn.textContent='';}
}
function saveStudent(){
  var name=(gv('s-nm')).trim();if(!name){toast('이름을 입력해주세요','⚠️');return;}
  var days=Array.from(document.querySelectorAll('#s-dpick .dpb.on')).map(function(b){return b.textContent;});
  var times={};days.forEach(function(d){var el=ge('ts-'+d);if(el)times[d]=el.value;});
  var old=editSid?students.find(function(s){return s.id===editSid;}):null;
  var data={
    id:editSid||uid(),name:name,
    photo:'',
    _photoKey:(function(){
      var _p=gv('s-photo-data');
      if(_p&&_p.length>100){
        var _k=(old&&old._photoKey)?old._photoKey:'vsC_ph_'+uid();
        try{localStorage.setItem(_k,_p);}catch(e){return '';}
        return _k;
      }
      return (old&&old._photoKey)||'';
    })(),
    cls:gv('s-cls'),gd:gv('s-gd'),age:gv('s-age'),ph:gv('s-ph'),
    st:gv('s-st'),days:days,times:times,
    schedType:curSType,freq:curFreq,
    fee:parseInt(gv('s-fee'))||0,
    lessonOffset:parseInt(gv('s-lesson-offset'))||0,
    deferrals:(old&&old.deferrals)||0,
    maxDeferrals:(old&&old.maxDeferrals)||2,
    memo:gv('s-memo'),status:gv('s-stat'),
    audios:(old&&old.audios)||[],videos:(old&&old.videos)||[],
    consultData:(old&&old.consultData)||null,
    createdAt:(old&&old.createdAt)||Date.now()
  };
  if(editSid){var i=students.findIndex(function(s){return s.id===editSid;});students[i]=data;}
  else students.push(data);
  if(pendingConvertId){
    var ci=consults.findIndex(function(c){return c.id===pendingConvertId;});
    if(ci>=0){
      consults[ci].converted=true;
      var idx=students.findIndex(function(s){return s.id===data.id;});
      if(idx>=0){
        students[idx].consultData=JSON.parse(JSON.stringify(consults[ci]));
        students[idx].audios=(students[idx].audios||[]).concat(consults[ci].audios||[]);
        students[idx].videos=(students[idx].videos||[]).concat(consults[ci].videos||[]);
      }
    }
    pendingConvertId=null;
  }
  /* 동일 번호 문의자 자동 삭제 */
  var _ph=data.ph?data.ph.replace(/[^0-9]/g,''):'';
  if(_ph){
    var _iqBefore=inquiries.length;
    inquiries=inquiries.filter(function(q){
      var qph=(q.phone||'').replace(/[^0-9]/g,'');
      return qph!==_ph;
    });
    var _removed=_iqBefore-inquiries.length;
    if(_removed>0) toast('✅ 레슨생 등록 + 문의자 '+_removed+'명 자동 삭제');
    else toast(editSid?'수정되었습니다':'레슨생이 추가되었습니다');
  } else {
    toast(editSid?'수정되었습니다':'레슨생이 추가되었습니다');
  }
  /* lessonOffset 변경 시 payments cycleNum 재계산 */
  if(data.lessonOffset>0){
    var _sid=data.id;
    var _cycleSize=data.freq===2?8:4;
    var _actualLogs=logs.filter(function(l){return l.sid===_sid&&l.att!=='결석';}).length;
    payments.filter(function(p){return p.sid===_sid;}).forEach(function(p){
      var _totalAtTime=(p.wn||0)+data.lessonOffset;
      p.cycleNum=Math.floor((_totalAtTime-1)/_cycleSize)+1;
    });
  }
  var _scrollY=editSid?window.scrollY:0;saveAll();cm('mS');renderSidebarToday();if(page==='eval')page='students';render();if(editSid&&_scrollY>0)setTimeout(function(){window.scrollTo(0,_scrollY);},50);
}
function delStudent(){
  var s=students.find(function(x){return x.id===editSid;});
  if(!s)return;
  vsConfirm({
    msg:esc(s.name)+' 삭제',
    sub:'레슨생 정보와 모든 레슨 기록이 삭제됩니다.',
    okLabel:'삭제',danger:true,
    onOk:function(){
      students=students.filter(function(x){return x.id!==editSid;});
      saveAll();cm('mS');toast('삭제됨','🗑');renderSidebarToday();render();
    }
  });
}

/* MEDIA */