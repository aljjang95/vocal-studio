/* ═══════════════════════════════════════════════════════
   state.js — 전역 상태 관리 (Global State Management)
   - localStorage 초기 데이터 로드
   - 전역 가변 상태 변수 선언
   - 페이지 타이틀 맵
   ═══════════════════════════════════════════════════════ */

/* ── 공개 기본 레슨생 데이터 (PII 제거) ── */
var _DEFAULT_STUDENTS = [];

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
  {name:'미입금 안내',text:'안녕하세요, HLB보컬스튜디오입니다 🎤\n이번 달 레슨비 입금이 확인되지 않아 안내드립니다.\n\n▶ 우리은행 [입금 계좌] (예금주)\n▶ 기업은행 [스튜디오 연락처] (예금주)\n\n수업 전날까지 입금해 주시면 감사하겠습니다 😊'},
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
