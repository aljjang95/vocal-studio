/* ═══════════════════════════════════════════════════════
   state.js — 전역 상태 관리 (Global State Management)
   - localStorage 초기 데이터 로드
   - 전역 가변 상태 변수 선언
   - 페이지 타이틀 맵
   ═══════════════════════════════════════════════════════ */

/* ── 기본 39명 레슨생 데이터 (직접 내장) ── */
var _DEFAULT_STUDENTS=[{"id":"61e2v571328b","name":"김기범","age":"1997","ph":"010-4062-8664","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["금"],"times":{"금":"13:00"},"st":"2022-05-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"6th9rmk9ubtj","name":"최시현","age":"2015","ph":"010-9115-5364","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"12:00"},"st":"2025-01-07","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"0yymg3e29to8","name":"박시형","age":"1984","ph":"010-6848-9145","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-03-08","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"4234zln4ta34","name":"박도연","age":"1985","ph":"010-4774-1299","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["목"],"times":{"목":"15:00"},"st":"2025-03-06","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"m45o76hkm6ku","name":"한영호","age":"1986","ph":"010-6342-8623","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-03-18","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"bf0pyry7wb6q","name":"구자홍","age":"1993","ph":"010-8915-9594","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-05-30","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"ufmuxhfive5s","name":"안수현","age":"1989","ph":"010-6713-5317","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-06-18","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"thojlxjackr2","name":"박준기","age":"1997","ph":"010-3209-7809","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-07-02","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"j0ncwai9l8q4","name":"서주원","age":"1998","ph":"010-3443-1489","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"dy5uc4e5yxmi","name":"서희","age":"2012","ph":"010-8517-5871","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"16:00"},"st":"2025-07-12","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"hzgb3ykz6fpo","name":"하동찬","age":"2000","ph":"010-9143-1081","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-07-17","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"fokwcfdpt2q3","name":"최희성","age":"2004","ph":"010-8287-8909","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["수"],"times":{"수":"17:00"},"st":"2025-07-19","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"5kko01fc2e97","name":"정수영","age":"1995","ph":"010-6431-5048","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-07-24","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"t7zq5xxonglu","name":"김중훈","age":"1995","ph":"010-7466-3671","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-07-29","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"0fbzeacfnvz5","name":"이영복","age":"1994","ph":"010-3242-2181","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-08-02","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"축가 고정"},{"id":"nk5q3quvyvpm","name":"장유리","age":"2000","ph":"010-2468-3916","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-08-09","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"6619fhmnedj3","name":"김영서","age":"1997","ph":"010-4379-5254","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-08-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"rp0xyfoaffad","name":"강민서","age":"1994","ph":"010-7644-4438","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-08-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"kit4vqt2mm4q","name":"최승원","age":"2010","ph":"010-6263-0614","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-09-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"s6s3bev7affl","name":"김다혜","age":"2014","ph":"010-8970-2811","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-09-13","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":""},{"id":"a1ormshknkcv","name":"정재원","age":"1988","ph":"010-2231-2591","gd":"여성","cls":"hob","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-10-03","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"축가"},{"id":"eymrquim8uno","name":"김정수","age":"2002","ph":"010-4833-7394","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-10-23","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"2ue4tbt85lgj","name":"손은선","age":"2005","ph":"010-6755-3009","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-11-05","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"737d4y07c0xz","name":"박정민","age":"1999","ph":"010-3804-4064","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-11-04","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"qxlehfm4bmtv","name":"채윤호","age":"2012","ph":"010-5439-9317","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"14:00"},"st":"2025-11-22","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"3ztjzrhc47a1","name":"이동윤","age":"2003","ph":"010-5501-1371","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-12-31","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"},{"id":"auk7khfi9njp","name":"김민수","age":"2000","ph":"010-2428-5362","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-12-15","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"음성 고정"},{"id":"6f965kpwl8kw","name":"전성만","age":"1976","ph":"010-9260-5757","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-12-26","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"pw55yrl64qv6","name":"정승연","age":"1997","ph":"010-4480-1605","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-01-09","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"},{"id":"8ilx8p28x48h","name":"김민석","age":"2009","ph":"010-8423-0207","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-01-03","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"298gpqwm5z1g","name":"김성민","age":"1976","ph":"010-9400-9300","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["수"],"times":{"수":"20:00"},"st":"2026-01-08","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"isfk42ix2ffw","name":"김민재","age":"2016","ph":"010-3394-0301","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"17:00"},"st":"2026-01-17","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"},{"id":"77rtfl54126h","name":"한성빈","age":"1997","ph":"010-7658-2422","gd":"여성","cls":"hob","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2026-01-20","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"축가"},{"id":"fvurawewry4m","name":"이세미","age":"2010","ph":"010-2354-8184","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-01-26","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"v2r7h8r15d6w","name":"한지민","age":"2007","ph":"010-4542-7734","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2026-02-05","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"imfbwpdg12lz","name":"손주환","age":"1999","ph":"010-2946-5077","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":["목"],"times":{"목":"17:00"},"st":"","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":""},{"id":"brvnokwp5ock","name":"정두현","age":"1997","ph":"010-6318-7351","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2026-02-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},{"id":"zplnhb6rtwek","name":"이천희","age":"1976","ph":"010-5571-0822","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-02-25","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},{"id":"kmvehxt5zv8l","name":"강신영","age":"1990","ph":"010-9111-9053","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":["목"],"times":{"목":"14:00"},"st":"2026-03-05","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"}];

/* ── localStorage 초기 데이터 로드 ── */
var ST={};var LG={};var WO={};var CO={};var PM={};var IQ=[];
/* localStorage가 가능하면 읽고, 아니면 기본 데이터 사용 */
try{ST=JSON.parse(localStorage.getItem('vsC_s')||'null');}catch(e){}
try{LG=JSON.parse(localStorage.getItem('vsC_l')||'[]');}catch(e){LG=[];}
try{WO=JSON.parse(localStorage.getItem('vsC_wo')||'{}');}catch(e){WO={};}
try{CO=JSON.parse(localStorage.getItem('vsC_c')||'[]');}catch(e){CO=[];}
try{PM=JSON.parse(localStorage.getItem('vsC_p')||'[]');}catch(e){PM=[];}
try{IQ=JSON.parse(localStorage.getItem('vsC_iq')||'[]');}catch(e){IQ=[];}

/* ST가 null(localStorage 없거나 비어있음) → 기본 39명 데이터로 초기화 */
if(!ST||!Array.isArray(ST)||ST.length===0){
  ST=_DEFAULT_STUDENTS.slice(); /* 복사본 사용 */
  try{localStorage.setItem('vsC_s',JSON.stringify(ST));}catch(e){} /* 저장 시도 (실패해도 무관) */
}else{
  /* localStorage에 데이터가 있으면: 기본 데이터 중 없는 사람만 추가 */
  var _existNames=ST.map(function(s){return s.name;});
  var _existPhs=ST.map(function(s){return s.ph;});
  var _added=0;
  _DEFAULT_STUDENTS.forEach(function(s){
    if(_existNames.indexOf(s.name)>=0||(_existPhs.indexOf(s.ph)>=0&&s.ph)) return;
    ST.push(s); _existNames.push(s.name); _existPhs.push(s.ph); _added++;
  });
  if(_added>0){try{localStorage.setItem('vsC_s',JSON.stringify(ST));}catch(e){}}
}

/* 디버그용 */
if(typeof window!=='undefined'){
  window._vsDebug=function(){
    console.log('weekOvr:',JSON.stringify(weekOvr));
    console.log('students:',students.map(function(s){return s.name+'/'+s.schedType+'/'+s.days;}));
    var mon=getViewMon(),wk=getWK(mon);
    console.log('wk:',wk);
    console.log('sched:',Object.keys(getWeekSched(mon)));
  };
}

/* ── 데이터 배열 별칭 ── */
var students=ST,logs=LG,weekOvr=WO,consults=CO,payments=PM,inquiries=IQ;

/* ── 학생 탭 상태 ── */
var currentStudentTab='all';
var _studentSearch='';

/* ── 상수 (뷰에서 공유) ── */
var COLORS=['#3d6b3d','#5a6b3a','#6b5a3a','#3a5a5a','#5a3a5a','#3a5a3a','#5a4a3a','#3a4a5a'];
var ALL7=['월','화','수','목','금','토','일'];
var WORK=['화','수','목','금','토'];
var JSDOW={0:'일',1:'월',2:'화',3:'수',4:'목',5:'금',6:'토'};
var HOURS=['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];
var HRS_LBL=['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];

/* ── 네비게이션 상태 ── */
var page='today',wkOfs=0;
var _ciDraftTimer=null;
var _consultTab='consult';

/* ── 페이지 타이틀 맵 ── */
var PT={dashboard:'대시보드',consult:'신규 상담',students:'레슨생 관리',logs:'레슨 기록',payment:'입금 관리',today:'오늘 스케줄',schedule:'주간 스케줄',timeline:'진도 타임라인'};

/* ── 모바일 스케줄 상태 ── */
var mobileSchedDay=(new Date().getDay()===0)?6:(new Date().getDay()-1);
var mobileSchedView='day';

/* ── 빠른 스케줄 상태 ── */
var qsDay='',qsTime='',qsDate='',qsSel={};

/* ── 학생 검색/정렬 상태 ── */
var studentSearchVal='';
var currentSortAsc=false;

/* ── 타임라인 상태 ── */
var _tlSid=null;

/* ── 레슨 기록 상태 ── */
var lrSid=null,lrLogId=null;

/* ── 학생 편집 상태 ── */
var editSid=null,pendingConvertId=null,curSType='fixed',curFreq=1;

/* ── 미디어 녹음 상태 ── */
var mediaTarget={did:'',mode:'',type:''};
var consentTarget={did:'',mode:''};

/* ── SMS 템플릿 ── */
var _smsTemplates=[
  {name:'미입금 안내',text:'안녕하세요, HLB보컬스튜디오입니다 🎤\n이번 달 레슨비 입금이 확인되지 않아 안내드립니다.\n\n▶ 우리은행 1002-046-438968 (양경렬)\n▶ 기업은행 010-8804-8903 (양경렬)\n\n수업 전날까지 입금해 주시면 감사하겠습니다 😊'},
  {name:'결석 확인',text:'안녕하세요 😊 오늘 레슨 예정이셨는데 연락이 없으셔서 확인차 문자드립니다. 혹시 오늘 수업 어렵게 되셨나요?'},
  {name:'레슨 일정 안내',text:'안녕하세요! 이번 주 레슨 일정 안내드립니다 📅\n\n일시: \n장소: HLB보컬스튜디오\n\n궁금한 점이 있으시면 편하게 연락주세요 🎵'},
  {name:'상담 일정 확인',text:'안녕하세요, HLB보컬스튜디오입니다 🎤\n방문 상담 일정 확인드립니다.\n\n일시: \n\n오시는 길이 궁금하시면 말씀해 주세요 😊'},
];
try{var _st=localStorage.getItem('vsC_smsT');if(_st)_smsTemplates=JSON.parse(_st);}catch(e){}

/* ── 뷰 강제 전환 ── */
var _forceView=null; /* null=자동, 'mobile'=강제모바일, 'pc'=강제PC */

/* ── 대시보드 잠금 상태 ── */
var _dashUnlocked=false;
var _dashUnlockTime=0;

/* ── 평가 동의 상태 ── */
var evalConsentCid='';
