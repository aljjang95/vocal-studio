// Extracted runtime functions, not the complete application. Synthetic tests only.
function _startFirestoreListener(){
  if(_fbUnsub)return;
  if(!_isFirebaseAdminUser(firebase.auth().currentUser)){
    _disableFirestoreSync('🔒 관리자 인증 필요 · 로컬 모드');
    return;
  }
  var db=_fs();
  var docRef=db.collection('studio').doc('data');
  try{window._fbDocRef=docRef;}catch(e){}

  /* 실시간 리스너 — Firestore 변경 시 즉시 반영 */
  _fbUnsub=docRef.onSnapshot(function(snap){
    if(!snap.exists){
      /* 원격 문서가 없을 때 기본 39명/빈 상태가 서버를 덮지 않도록 실제 로컬 데이터가 있을 때만 부트스트랩 */
      if(_hasBootstrapDataForFirestore()) _pushToFirestore(docRef);
      else _showSyncStatus('⚠️ 원격 데이터 없음');
      return;
    }
    var d=snap.data();
    var _beforeSig=_dataSignature();
    var _preferLocal=Date.now()<_localProtectUntil;
    var _needPushBack=false;
    _writeRecoverySnapshot('before-remote');
    /* 원격 변경사항을 메모리 + localStorage에 반영하되, 로컬에만 있던 신규 상담/스케줄은 보존 */
    _fbApplyingRemote=true;
    try{
      var _mStudents=_mergeByIdentity(d.students||[],students||[],'student',_preferLocal); _needPushBack=_needPushBack||_mStudents.added>0||_mStudents.replaced>0;
      var _fbStudents=_mStudents.list;
      /* 기본 39명 중 Firebase/로컬 병합 결과에 없는 사람 병합 */
      var _fbNames=_fbStudents.map(function(s){return s.name;});
      var _fbPhs=_fbStudents.map(function(s){return s.ph;});
      _DEFAULT_STUDENTS.forEach(function(s){
        if(_fbNames.indexOf(s.name)>=0||(_fbPhs.indexOf(s.ph)>=0&&s.ph)) return;
        _fbStudents.push(s);
        _fbNames.push(s.name);
        _fbPhs.push(s.ph);
      });
      students=_fbStudents;
      _safeSetLS('vsC_s',JSON.stringify(students));
    }catch(e){}
    try{var _mLogs=_mergeByIdentity(d.logs||[],logs||[],'log',_preferLocal);logs=_mLogs.list;_needPushBack=_needPushBack||_mLogs.added>0||_mLogs.replaced>0;_safeSetLS('vsC_l',JSON.stringify(logs));}catch(e){}
    try{var _mergedWO=_mergeWeekOvr(d.weekOvr||{},weekOvr||{},_preferLocal);if(JSON.stringify(_mergedWO)!==JSON.stringify(d.weekOvr||{}))_needPushBack=true;weekOvr=_mergedWO;_safeSetLS('vsC_wo',JSON.stringify(weekOvr));}catch(e){}
    try{var _mConsults=_mergeByIdentity(d.consults||[],consults||[],'consult',_preferLocal);consults=_mConsults.list;_needPushBack=_needPushBack||_mConsults.added>0||_mConsults.replaced>0;_safeSetLS('vsC_c',JSON.stringify(consults));}catch(e){}
    try{var _mPayments=_mergeByIdentity(d.payments||[],payments||[],'payment',_preferLocal);payments=_mPayments.list;_needPushBack=_needPushBack||_mPayments.added>0||_mPayments.replaced>0;_safeSetLS('vsC_p',JSON.stringify(payments));}catch(e){}
    try{var _mInq=_mergeByIdentity(d.inquiries||[],inquiries||[],'inquiry',_preferLocal);inquiries=_mInq.list;_needPushBack=_needPushBack||_mInq.added>0||_mInq.replaced>0;_safeSetLS('vsC_iq',JSON.stringify(inquiries));}catch(e){}
    _fbReady=true;
    /* 병합 결과에 사진 참조가 끊긴 행이 있으면 로컬 백업으로 다시 연결하고 즉시 보존 */
    var _relinked=_relinkOrphanPhotos();
    if(_relinked>0){
      try{_safeSetLS('vsC_s',JSON.stringify(students));}catch(e){}
      try{_safeSetLS('vsC_c',JSON.stringify(consults));}catch(e){}
      console.warn('사진 참조 복구:',_relinked,'건');
    }
    _injectInitialInquiries(); /* 문의자 초기 데이터 주입 */
    var _afterSig=_dataSignature();
    var _changed=_afterSig!==_beforeSig;
    if(_changed)_writeRecoverySnapshot('after-remote-merge');
    /* UI 갱신 — 원격 echo가 현재 상태와 같으면 다시 그리지 않아 깜빡임 방지 */
    if(_changed){
      renderSidebarToday();
      if(typeof render==='function'&&_skipRenderCount<=0){
        render();
      }
    }
    if(_skipRenderCount>0) _skipRenderCount--;
    _showSyncStatus(_needPushBack?'✅ 동기화됨 · 로컬 보호':'✅ 동기화됨');
    _fbApplyingRemote=false;
    if(_needPushBack){
      setTimeout(function(){try{if(_fbReady&&!_fbApplyingRemote)_pushToFirestore(docRef);}catch(e){}},900);
    }
  },function(err){
    console.error('Firestore 리스너 오류',err);
    _showSyncStatus('⚠️ 오프라인');
    _fbApplyingRemote=false;
  });
}

function _pushToFirestore(docRef){
  if(!_isFirebaseAdminUser(firebase.auth().currentUser)){
    _showSyncStatus('🔒 관리자 인증 필요 · 로컬 저장됨');
    return Promise.resolve();
  }
  if(_splitMigrationFrozen()){
    _showSyncStatus('🧊 마이그레이션 동결 · 원격 저장 보류');
    return Promise.resolve();
  }
  var db=_fs();
  docRef=docRef||db.collection('studio').doc('data');
  try{window._fbDocRef=docRef;}catch(e){}
  _backupOrphanPhotos(students);
  _backupOrphanPhotos(consults);
  var payload={
    students:_stripMediaForSync(students),
    logs:logs,
    weekOvr:weekOvr,
    consults:_stripMediaForSync(consults),
    payments:payments,
    inquiries:inquiries,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  var sig='';
  try{sig=JSON.stringify(_stableForSig(Object.assign({},payload,{updatedAt:'server'})));}catch(e){}
  if(sig&&sig===_lastFirestorePushSig&&Date.now()-_lastFirestorePushAt<2500){
    return Promise.resolve();
  }
  _lastFirestorePushSig=sig;
  _lastFirestorePushAt=Date.now();
  _writeRecoverySnapshot('before-firestore-push');
  return docRef.set(payload).then(function(){_showSyncStatus('✅ 동기화됨');})
    .catch(function(e){console.error('Firestore 저장 오류',e);_showSyncStatus('⚠️ 저장 실패');});
}

function _mergeWeekOvr(remote,local,preferLocal){
  var out=Object.assign({},preferLocal?(remote||{}):(local||{}));
  Object.keys((preferLocal?local:remote)||{}).forEach(function(wk){
    out[wk]=Object.assign({},out[wk]||{},(preferLocal?local:remote)[wk]||{});
  });
  return out;
}
