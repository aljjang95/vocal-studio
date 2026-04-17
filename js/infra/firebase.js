/* ═══════════════════════════════════════════════════════
   firebase.js — Firebase 초기화 및 Firestore 실시간 동기화
   - firebaseConfig: Firebase 앱 설정
   - initFirebase(): 앱 초기화 + Firestore 실시간 리스너
   - _pushToFirestore(): 전체 데이터 Firestore에 업로드
   - _showSyncStatus(): 동기화 상태 UI 표시
   - saveAll 오버라이드: localStorage + Firestore 동시 저장
   ═══════════════════════════════════════════════════════ */

/* ── Firebase 동기화 상태 변수 ── */
var _fbReady=false, _fbSyncing=false, _fbUnsub=null, _skipRenderCount=0;

/* ── Firebase 앱 설정 ── */
var firebaseConfig={
  apiKey:"AIzaSyBhVoh01SUIjL9syfQcxh7CR0_Nl0gTUCY",
  authDomain:"hlbvocalstudio-72481.firebaseapp.com",
  projectId:"hlbvocalstudio-72481",
  storageBucket:"hlbvocalstudio-72481.firebasestorage.app",
  messagingSenderId:"131827810958",
  appId:"1:131827810958:web:0794a34a29dc2070ee7fdf"
};

/* ── Firebase 초기화 + Firestore 실시간 리스너 ── */
function initFirebase(){
  if(typeof firebase==='undefined'){
    setTimeout(initFirebase,500);return;
  }
  if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  var db=firebase.firestore();
  var docRef=db.collection('studio').doc('data');

  /* 실시간 리스너 — Firestore 변경 시 즉시 반영 */
  _fbUnsub=docRef.onSnapshot(function(snap){
    if(!snap.exists){
      /* 첫 실행: localStorage 데이터를 Firestore로 업로드 */
      _pushToFirestore(docRef);
      return;
    }
    var d=snap.data();
    /* 원격 변경사항을 메모리 + localStorage에 반영 */
    try{
      var _fbStudents=d.students||[];
      /* 기본 39명 중 Firebase에 없는 사람 병합 */
      var _fbNames=_fbStudents.map(function(s){return s.name;});
      var _fbPhs=_fbStudents.map(function(s){return s.ph;});
      _DEFAULT_STUDENTS.forEach(function(s){
        if(_fbNames.indexOf(s.name)>=0||(_fbPhs.indexOf(s.ph)>=0&&s.ph)) return;
        _fbStudents.push(s);
        _fbNames.push(s.name);
        _fbPhs.push(s.ph);
      });
      students=_fbStudents;
      localStorage.setItem('vsC_s',JSON.stringify(students));
    }catch(e){}
    try{logs=d.logs||[];localStorage.setItem('vsC_l',JSON.stringify(logs));}catch(e){}
    /* weekOvr: 첫 로드 시에만 Firebase에서 가져옴 */
    try{if(!_fbReady){weekOvr=d.weekOvr||{};localStorage.setItem('vsC_wo',JSON.stringify(weekOvr));}}catch(e){}
    try{consults=d.consults||[];localStorage.setItem('vsC_c',JSON.stringify(consults));}catch(e){}
    try{payments=d.payments||[];localStorage.setItem('vsC_p',JSON.stringify(payments));}catch(e){}
    try{if(d.inquiries&&d.inquiries.length>0){inquiries=d.inquiries;localStorage.setItem('vsC_iq',JSON.stringify(inquiries));}}catch(e){}
    _fbReady=true;
    _injectInitialInquiries(); /* 문의자 초기 데이터 주입 */
    /* UI 갱신 */
    renderSidebarToday();
    if(typeof render==='function'&&_skipRenderCount<=0){
      render();
    }
    if(_skipRenderCount>0) _skipRenderCount--;
    _showSyncStatus('✅ 동기화됨');
  },function(err){
    console.error('Firestore 리스너 오류',err);
    _showSyncStatus('⚠️ 오프라인');
  });
}

/* ── Firestore에 전체 데이터 업로드 ── */
function _pushToFirestore(docRef){
  if(!docRef) return;
  var db=firebase.firestore();
  docRef=docRef||db.collection('studio').doc('data');
  return docRef.set({
    students:students,
    logs:logs,
    weekOvr:weekOvr,
    consults:consults,
    payments:payments,
    inquiries:inquiries,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(){_showSyncStatus('✅ 동기화됨');})
    .catch(function(e){console.error('Firestore 저장 오류',e);_showSyncStatus('⚠️ 저장 실패');});
}

/* ── 동기화 상태 UI 표시 ── */
function _showSyncStatus(msg){
  var el=document.getElementById('syncStatus');
  if(!el)return;
  el.textContent=msg;
  clearTimeout(el._t);
  if(msg==='✅ 동기화됨') el._t=setTimeout(function(){el.textContent='';},3000);
}

/* ── saveAll 오버라이드 — localStorage + Firestore 동시 저장 ── */
var _saveAllOrig=saveAll;
saveAll=function(){
  _saveAllOrig();
  /* Firestore에도 저장 */
  if(typeof firebase!=='undefined'&&firebase.apps&&firebase.apps.length){
    var db=firebase.firestore();
    _showSyncStatus('🔄 저장 중...');
    _pushToFirestore(db.collection('studio').doc('data'));
  }
};
