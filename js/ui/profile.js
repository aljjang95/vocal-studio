/* ============================================================
   profile.js — 학생/상담 프로필 & 미디어
   mediaTarget : 미디어 업로드 타깃 (전역)
   openMediaUpload() : 미디어 업로드 열기
   handleMediaUpload() : 미디어 업로드 처리
   deleteMedia() : 미디어 삭제
   buildMediaPanel() : 미디어 패널 HTML
   saveBeforeMemo() : Before 메모 저장
   consentTarget : 동의 녹음 타깃 (전역)
   openRecordConsent() : 동의 녹음 모달
   printBeforeSheet() : Before 시트 인쇄
   pRow() : 프로필 행 생성
   fv() : 필드 값 반환
   switchTab() : 탭 전환
   openProfile() : 프로필 모달 열기
   ============================================================ */

/* MEDIA */
var mediaTarget={did:'',mode:'',type:''};
function openMediaUpload(did,mode,type){mediaTarget={did:did,mode:mode,type:type};ge('media-upload-input').click();}
function handleMediaUpload(input){
  var file=input.files[0];if(!file)return;
  var isV=file.type.startsWith('video');
  /* prompt 대신 모달로 레이블 입력 */
  var ex=document.getElementById('mMediaLabel');if(ex)ex.remove();
  var defLabel=toDS(new Date());
  var m=document.createElement('div');
  m.id='mMediaLabel';m.className='ov open';
  m.innerHTML='<div class="modal" style="max-width:360px">'
    +'<div class="mh"><div class="mt">'+(isV?'🎥':'🎙')+(isV?' 영상':' 음성')+' 파일 설명</div><div class="mc" onclick="document.getElementById(\'mMediaLabel\').remove()">&#x2715;</div></div>'
    +'<div class="mb"><div class="f1"><label>파일 설명</label>'
    +'<input type="text" id="mediaLabelInput" placeholder="예: 1주차 before" value="'+defLabel+'" style="font-size:15px">'
    +'</div></div>'
    +'<div class="mf"><button class="btn bg2" onclick="document.getElementById(\'mMediaLabel\').remove()">취소</button>'
    +'<button class="btn bp" id="mediaLabelOk">저장</button></div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
  setTimeout(function(){var el=document.getElementById('mediaLabelInput');if(el){el.focus();el.select();}},100);
  document.getElementById('mediaLabelOk').onclick=function(){
    var label=(document.getElementById('mediaLabelInput')||{value:defLabel}).value.trim()||defLabel;
    m.remove();
    var r=new FileReader();
    r.onload=function(ev){
      var did=mediaTarget.did,mode=mediaTarget.mode,type=mediaTarget.type;
      var entryId=uid();
      var mediaKey='vsM_'+entryId;
      var entry={id:entryId,type:type,mediaType:isV?'video':'audio',label:label,date:toDS(new Date()),data:ev.target.result,_mediaKey:mediaKey};
      /* IndexedDB에 저장 */
      mediaSave(mediaKey,ev.target.result);
      if(mode==='consult'){
        var c=consults.find(function(x){return x.id===did;});
        if(!c)return;if(!c.audios)c.audios=[];if(!c.videos)c.videos=[];
        if(isV)c.videos.push(entry);else c.audios.push(entry);
      } else {
        var s=students.find(function(x){return x.id===did;});
        if(!s)return;if(!s.audios)s.audios=[];if(!s.videos)s.videos=[];
        if(isV)s.videos.push(entry);else s.audios.push(entry);
      }
      saveAll();toast('저장됨 '+(isV?'🎥':'🎙'));
      var d2=mode==='consult'?consults.find(function(x){return x.id===did;}):students.find(function(x){return x.id===did;});
      if(d2){
        openProfile(d2,mode);
        setTimeout(function(){
          var mediaIdx=mode==='consult'?3:2;
          var tabs=document.querySelectorAll('#mProfile .tab');
          if(tabs[mediaIdx])tabs[mediaIdx].click();
        },200);
      }
    };
    r.readAsDataURL(file);
    input.value='';
  };
}
function deleteMedia(did,mode,mid){
  vsConfirm({
    msg:'파일 삭제',sub:'이 미디어 파일을 삭제합니다.',okLabel:'삭제',danger:true,
    onOk:function(){
      /* IndexedDB에서도 삭제 */
      var _findMedia=function(arr){return (arr||[]).find(function(a){return a.id===mid;});};
      if(mode==='consult'){
        var c=consults.find(function(x){return x.id===did;});if(!c)return;
        var _m=_findMedia(c.audios)||_findMedia(c.videos);
        if(_m&&_m._mediaKey)mediaDelete(_m._mediaKey);
        c.audios=(c.audios||[]).filter(function(a){return a.id!==mid;});c.videos=(c.videos||[]).filter(function(v){return v.id!==mid;});
      } else {
        var s=students.find(function(x){return x.id===did;});if(!s)return;
        var _m2=_findMedia(s.audios)||_findMedia(s.videos);
        if(_m2&&_m2._mediaKey)mediaDelete(_m2._mediaKey);
        s.audios=(s.audios||[]).filter(function(a){return a.id!==mid;});s.videos=(s.videos||[]).filter(function(v){return v.id!==mid;});
      }
      saveAll();toast('삭제됨','🗑');
      var d=mode==='consult'?consults.find(function(x){return x.id===did;}):students.find(function(x){return x.id===did;});
      openProfile(d,mode);
    }
  });
}
function buildMediaPanel(data,mode){
  var did=data.id;
  var audios=data.audios||[],videos=data.videos||[];
  var before=audios.filter(function(a){return a.type==='before';}).concat(videos.filter(function(v){return v.type==='before';}));
  var after=audios.filter(function(a){return a.type==='after';}).concat(videos.filter(function(v){return v.type==='after';}));
  /* 저장된 메모 불러오기 */
  var savedMemo=(data.beforeMemo)||'';
  var savedConsent=(data.consentRec)||null;
  function mItem(m){
    var isV=m.mediaType==='video';
    var isSaved=(m.data==='[saved]'||!m.data);
    var hasMediaKey=!!(m._mediaKey);
    var playerId='player_'+m.id;
    var o='<div class="ba-item"><div class="ba-item-hd">';
    o+='<span style="font-size:12.5px;font-weight:600">'+esc(m.label||m.date)+'</span>';
    o+='<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:var(--tm)">'+esc(m.date)+'</span>';
    o+='<div class="btn bd bic bsm" style="font-size:12px" data-did="'+did+'" data-mode="'+mode+'" data-mid="'+m.id+'" onclick="deleteMedia(this.dataset.did,this.dataset.mode,this.dataset.mid)">×</div></div></div>';
    if(!isSaved){
      /* 메모리에 데이터 있음 → 바로 재생 */
      o+='<div class="ba-item-body">'+(isV?'<video controls src="'+m.data+'"></video>':'<audio controls src="'+m.data+'"></audio>')+'</div>';
    } else if(hasMediaKey){
      /* IndexedDB에서 로드 */
      o+='<div class="ba-item-body" id="'+playerId+'" style="text-align:center;padding:8px;color:var(--tm);font-size:12px">'+(isV?'🎥':'🎙')+' 불러오는 중...</div>';
      setTimeout(function(){
        mediaLoad(m._mediaKey,function(data){
          var el=document.getElementById(playerId);
          if(!el)return;
          if(data){
            el.innerHTML=isV?'<video controls src="'+data+'" style="width:100%;max-height:200px"></video>':'<audio controls src="'+data+'" style="width:100%"></audio>';
          } else {
            el.innerHTML='<div style="padding:8px;color:var(--tm);font-size:12px">'+(isV?'🎥':'🎙')+' Downloads 폴더에서 확인하세요</div>';
          }
        });
      },100);
    } else {
      o+='<div class="ba-item-body" style="text-align:center;padding:12px;color:var(--tm);font-size:12px">'+(isV?'🎥':'🎙')+' Downloads 폴더에서 확인하세요</div>';
    }
    o+='</div>';
    return o;
  }
  var o='';

  /* ── Before 섹션 ── */
  o+='<div class="ba-col bc" style="border-radius:12px;overflow:hidden;margin-bottom:14px">';
  o+='<div class="ba-col-hd"><div class="ba-col-title">🎤 Before 음성 파일</div>';
  o+='<div style="display:flex;gap:6px">';
  o+='<button class="btn bsm" style="background:rgba(110,163,200,.14);color:var(--bl);border:1px solid rgba(110,163,200,.22)" data-did="'+did+'" data-mode="'+mode+'" data-type="before" onclick="openRecording(this.dataset.did,this.dataset.mode,this.dataset.type)">🎙 녹음</button>';
  o+='<button class="btn bsm" style="background:rgba(110,163,200,.14);color:var(--bl);border:1px solid rgba(110,163,200,.22)" data-did="'+did+'" data-mode="'+mode+'" data-type="before" onclick="openMediaUpload(this.dataset.did,this.dataset.mode,this.dataset.type)">📁 업로드</button>';
  o+='</div></div>';
  o+='<div class="ba-items">'+(before.length?before.map(mItem).join(''):'<div class="ba-empty">파일 없음</div>')+'</div>';
  o+='</div>';

  /* ── 문제점 & 개선 방향 메모 ── */
  o+='<div style="background:rgba(255,255,255,.04);border:1px solid rgba(200,169,110,.25);border-radius:12px;padding:16px 18px;margin-bottom:14px">';
  o+='<div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:var(--a);text-transform:uppercase;margin-bottom:10px">📝 트레이너 평가 메모</div>';
  o+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
  o+='<div><div style="font-size:10.5px;letter-spacing:.08em;color:var(--tm);text-transform:uppercase;margin-bottom:5px">발견된 문제점</div>';
  o+='<textarea id="memo-prob-'+did+'" rows="3" placeholder="예) 고음에서 흉성이 올라옴 / 음정이 불안정 / 호흡이 짧음..." style="width:100%;font-size:13.5px;resize:vertical">'+esc(savedMemo.split('||')[0]||'')+'</textarea></div>';
  o+='<div><div style="font-size:10.5px;letter-spacing:.08em;color:var(--tm);text-transform:uppercase;margin-bottom:5px">개선 방향</div>';
  o+='<textarea id="memo-impr-'+did+'" rows="3" placeholder="예) 두성 발성 연습 필요 / 복식호흡 기초부터 / 음정 교정 집중..." style="width:100%;font-size:13.5px;resize:vertical">'+esc(savedMemo.split('||')[1]||'')+'</textarea></div>';
  o+='</div>';
  o+='<button class="btn bm bsm" data-did="'+did+'" data-mode="'+mode+'" onclick="saveBeforeMemo(this.dataset.did,this.dataset.mode)">💾 메모 저장</button>';
  o+='</div>';

  /* ── 개인 레슨 유의사항 ── */
  o+='<div style="background:rgba(255,255,255,.03);border:1px solid var(--b);border-radius:12px;padding:16px 18px;margin-bottom:14px">';
  o+='<div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:var(--ts);text-transform:uppercase;margin-bottom:10px">⚠️ 개인 레슨 유의사항</div>';
  o+='<div style="font-size:12px;color:var(--ts);line-height:1.85">';
  o+='<div style="font-size:11px;color:var(--tm);font-style:italic;margin-bottom:8px">본 운영 방침은 최상의 수업 몰입도와 체계적인 발성 교정을 위해 설계되었습니다. 효율적인 수업 진행을 위해 아래 내용을 숙지하고 엄격히 준수해 주시기 바랍니다.</div>';
  o+='1. 레슨 시간 준수: 정시 시작 및 종료를 원칙으로 합니다. 개인 사정으로 인한 지각 시에도 종료 시간은 동일합니다. (다만, 이전 수강생의 피드백이 길어져 발생하는 수 분 내외의 수업 지연은 최상의 레슨 퀄리티를 위해 제가 직접 조율하는 부분이니 양해 부탁드립니다.)<br>2. 당일 변경 및 취소 (사유 불문 1회 차감): 예약된 시간은 오직 한 분을 위해 비워둔 기회비용입니다. 갑작스러운 개인 사정, 건강 문제 등 어떠한 사유를 막론하고 당일 취소는 선생님의 준비 시간과 타 수강생의 기회를 박탈하는 행위이므로 예외 없이 차감됩니다.<br>3. 레슨 이월 및 연기: 4회 수업 중 1회만 가능합니다. (발성은 근육의 습관을 형성하는 과정입니다. 수업 간격이 불규칙해지면 신체 감각이 퇴보하여 결국 지난 학습 내용을 반복하게 됩니다. 지체 없는 성장을 위한 최소한의 훈련 루틴임을 이해해 주시기 바랍니다.)<br>4. 실력 변화를 위한 연습과 질문: 수업에서 배운 감각을 내 것으로 만드는 유일한 방법은 연습입니다. (개인 연습을 하시면서 잘 안되는 부분이나 궁금한 점을 꼭 체크해 오세요. 스스로 고민하고 질문을 던질 때 이해도가 높아지며, 그만큼 수업의 깊이와 실력 향상 속도도 눈에 띄게 빨라집니다.)<br>5. 수강료 납부 및 예약 확정: 입금 확인은 수업 참여에 대한 상호 간의 가장 기본적인 약속입니다. 수업 전날까지 입금 완료 시 예약이 최종 확정되며, 미입금 시 해당 시간대는 예약 대기자에게 우선권이 부여되어 일정이 자동 취소됩니다.<br>6. 중도 퇴실 및 환불 정책: 2회차 수업 참여 시점부터는 잔여 회차에 대한 반환이 진행되지 않습니다. (1회 수업 후 적성이나 변심에 의한 환불은 가능하나, 2회차부터는 핵심 커리큘럼과 노하우가 본격적으로 전달되는 단계입니다. 교육 콘텐츠의 가치를 보호하고 책임감 있는 학습 분위기를 유지하기 위한 기준이니 신중하게 결정해 주시기 바랍니다.)<br>7. 개인 준비물 (생수 / 녹음기 / 필기도구): 수분 공급은 성대 부상을 방지하는 필수 요건이며, 녹음과 기록은 휘발되는 감각을 객관화하여 학습 효과를 극대화하는 가장 강력한 도구입니다. 최상의 수업을 위해 반드시 지참해 주세요.<br>';
  o+='<div style="margin-top:10px;padding:8px 12px;background:rgba(200,169,110,.06);border-left:3px solid var(--a);font-size:11.5px;color:var(--tm);font-style:italic">"모든 규정은 오로지 귀하의 실력 향상에만 초점을 맞추고 있습니다. 프로페셔널한 자세로 수업에 임해주시길 기대합니다."</div>';
  o+='</div>';
  o+='</div>';

  /* ── 동의 음성 녹음 ── */
  o+='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(200,114,114,.06);border:1px solid rgba(200,114,114,.18);border-radius:8px;padding:11px 15px;margin-bottom:14px">';
  o+='<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--r);white-space:nowrap">🎙 동의 녹음</span>';
  if(savedConsent){
    o+='<audio controls src="'+savedConsent.data+'" style="flex:1;min-width:0;height:32px"></audio>';
    o+='<span style="font-size:11px;color:var(--g);white-space:nowrap">✓ '+esc(savedConsent.date)+'</span>';
  } else {
    o+='<span style="font-size:12.5px;color:var(--ts)">"위 유의사항에 동의합니다" 녹음</span>';
  }
  o+='</div>';
  o+='<button class="btn bred bsm" style="flex-shrink:0" data-did="'+did+'" data-mode="'+mode+'" onclick="openRecordConsent(this.dataset.did,this.dataset.mode)">'+(savedConsent?'🔄 재녹음':'🔴 녹음')+'</button>';
  o+='</div>';

  /* ── 출력 버튼 ── */
  o+='<div style="display:flex;justify-content:flex-end;margin-bottom:14px">';
  o+='<button class="btn bp" data-did="'+did+'" data-mode="'+mode+'" onclick="printBeforeSheet(this.dataset.did,this.dataset.mode)">🖨️ 유의사항 & 평가 출력</button>';
  o+='</div>';

  /* ── After 섹션 ── */
  o+='<div class="ba-col ac" style="border-radius:12px;overflow:hidden">';
  o+='<div class="ba-col-hd"><div class="ba-col-title">🌟 After 음성 파일</div>';
  o+='<div style="display:flex;gap:6px">';
  o+='<button class="btn bsm" style="background:rgba(109,200,162,.14);color:var(--g);border:1px solid rgba(109,200,162,.22)" data-did="'+did+'" data-mode="'+mode+'" data-type="after" onclick="openRecording(this.dataset.did,this.dataset.mode,this.dataset.type)">🎙 녹음</button>';
  o+='<button class="btn bsm" style="background:rgba(109,200,162,.14);color:var(--g);border:1px solid rgba(109,200,162,.22)" data-did="'+did+'" data-mode="'+mode+'" data-type="after" onclick="openMediaUpload(this.dataset.did,this.dataset.mode,this.dataset.type)">📁 업로드</button>';
  o+='</div></div>';
  o+='<div class="ba-items">'+(after.length?after.map(mItem).join(''):'<div class="ba-empty">파일 없음</div>')+'</div>';
  o+='</div>';

  o+='<div style="margin-top:10px;font-size:12px;color:var(--tm)">💡 음성(mp3,m4a) · 영상(mp4,mov) 업로드 또는 브라우저 내 녹음</div>';
  return o;
}

/* Before 메모 저장 */
function saveBeforeMemo(did,mode){
  var prob=ge('memo-prob-'+did)?ge('memo-prob-'+did).value:'';
  var impr=ge('memo-impr-'+did)?ge('memo-impr-'+did).value:'';
  var memo=prob+'||'+impr;
  if(mode==='consult'){var c=consults.find(function(x){return x.id===did;});if(!c)return;c.beforeMemo=memo;}
  else{var s=students.find(function(x){return x.id===did;});if(!s)return;s.beforeMemo=memo;}
  saveAll();toast('메모 저장됨 💾');
}

/* 동의 녹음 */
var consentTarget={did:'',mode:''};
function openRecordConsent(did,mode){
  consentTarget={did:did,mode:mode};
  recDid=did;recMode='consent';recType='consent';recBlob=null;recChunks=[];
  ge('recStatus').textContent='녹음 버튼을 눌러 시작하세요';
  ge('recTimerDisp').textContent='00:00';
  ge('recStartBtn').style.display='flex';
  ge('recStopBtn').style.display='none';
  ge('recPreview').style.display='none';
  ge('recSaveBtn').style.display='none';
  ge('recLabel').value='동의 음성';
  om('mRec');
}

/* saveRec override for consent mode */


/* 출력 */
function printBeforeSheet(did,mode){
  /* 출력 전 화면 값 자동 저장 */
  var data=mode==='consult'?consults.find(function(x){return x.id===did;}):students.find(function(x){return x.id===did;});
  if(!data)return;
  /* prob/impr 화면에서 읽기 */
  if(ge('eval-prob')||ge('eval-impr')){
    if(ge('eval-prob'))data.prob=ge('eval-prob').value||'';
    if(ge('eval-impr'))data.impr=ge('eval-impr').value||'';
    if(ge('eval-song'))data.song=ge('eval-song').value||'';
    saveAll();
  }
  var prob=data.prob||(data.beforeMemo||'').split('||')[0]||'';
  var impr=data.impr||(data.beforeMemo||'').split('||')[1]||'';
  var isGroup=(data.cls==='그룹'||data.cls==='group');
  var consentDate=data.consentRec?data.consentRec.date:'';
  var now=new Date();
  var ds=now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일';
  var w=window.open('','_blank','width=820,height=1200');
  if(!w||w.closed){toast('팝업이 차단되었습니다. 주소창 오른쪽 팝업 허용 클릭 후 다시 시도하세요','⚠️');return;}

  var css=
    /* 폰트는 <link> 태그로 로드 */''+ 
    '*{margin:0;padding:0;box-sizing:border-box;}'+
    'body{font-family:"Noto Serif KR","Malgun Gothic",serif;font-size:11.5px;color:#1a1a1a;background:#fff;padding:10px 22px;max-width:750px;margin:0 auto;font-weight:400;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact;}'+
    'h1{font-size:18px;font-weight:700;text-align:center;letter-spacing:.06em;margin-bottom:2px;}'+
    '.studioname{text-align:center;font-size:12px;color:#333;font-weight:500;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #1a1a1a;}'+
    '.sub{text-align:center;font-size:10.5px;color:#555;margin-bottom:8px;background:#f7f7f7;padding:5px;border-radius:4px;}'+
    '.sec{margin-bottom:7px;border:1px solid #ccc;border-radius:5px;overflow:hidden;}'+
    '.sec-t{font-size:11px;font-weight:700;background:#1a1a1a;color:#fff;padding:5px 14px;letter-spacing:.05em;}'+
    '.two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:7px 10px;}'+
    '.box{border:1px solid #ddd;border-radius:4px;padding:8px;min-height:80px;font-size:10.5px;line-height:1.5;background:#fafafa;word-break:break-word;}'+
    '.box-label{font-size:10.5px;font-weight:600;color:#444;margin-bottom:5px;letter-spacing:.03em;border-bottom:1px solid #eee;padding-bottom:3px;}'+
    '.notice-intro{padding:7px 14px 5px;font-size:10.5px;color:#555;line-height:1.6;border-bottom:1px solid #eee;font-style:italic;}'+
    '.notice-wrap{padding:4px 10px 5px;}'+
    '.notice-item{display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #f0f0f0;}'+
    '.notice-item:last-child{border-bottom:none;}'+
    '.notice-num{font-weight:700;min-width:18px;flex-shrink:0;font-size:11px;color:#1a1a1a;}'+
    '.notice-body{font-size:10.5px;line-height:1.5;color:#222;}'+
    '.notice-body strong{font-weight:700;color:#1a1a1a;font-size:11px;}'+
    '.motto{margin:8px 12px 4px;padding:8px 12px;background:#f9f6f0;border-left:3px solid #c8a96e;font-size:11px;line-height:1.6;color:#444;font-style:italic;}'+
    '.account-box{margin:6px 12px 10px;background:#fffdf5;border:1px solid #d4a840;border-radius:5px;padding:8px 12px;}'+
    '.account-title{font-size:10.5px;font-weight:700;color:#8a6820;margin-bottom:5px;}'+
    '.account-row{font-size:11.5px;font-weight:600;color:#1a1a1a;margin-bottom:3px;}'+
    '.sign-area{display:flex;align-items:flex-end;gap:12px;margin-top:8px;padding-top:7px;border-top:2px solid #1a1a1a;}'+
    '.sign-box{flex:1;text-align:center;}'+
    '.sign-line{border-bottom:1px solid #888;margin-bottom:4px;height:30px;}'+
    '.sign-lbl{font-size:10px;color:#555;}'+
    '@media print{@page{size:A4;margin:8mm 12mm;}body{padding:0;}button{display:none!important;}}';

  w.document.write('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>레슨 평가지</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>'+css+'</style></head><body>');
  w.document.write('<h1>HLB보컬스튜디오</h1>');
  w.document.write('<div class="studioname">원장 양경렬 &nbsp;·&nbsp; ☎ 010-8804-8903</div>');
  w.document.write('<div class="sub">수강생: <strong>'+esc(data.name)+'</strong>&nbsp;&nbsp;|&nbsp;&nbsp;레슨 유의사항 &amp; 트레이너 초기 평가&nbsp;&nbsp;|&nbsp;&nbsp;'+ds+'</div>');

  /* ── 트레이너 초기 평가 ── */
  w.document.write('<div class="sec"><div class="sec-t">트레이너 초기 평가</div><div class="two-col">');
  w.document.write('<div><div class="box-label">발견된 문제점</div><div class="box">'+((prob||'').split('\n').join('<br>')||'<span style="color:#bbb">—</span>')+'</div></div>');
  w.document.write('<div><div class="box-label">개선 방향 &amp; 레슨 계획</div><div class="box">'+((impr||'').split('\n').join('<br>')||'<span style="color:#bbb">—</span>')+'</div></div>');
  w.document.write('</div></div>');

  /* ── 유의사항 ── */
  w.document.write('<div class="sec"><div class="sec-t">개인 레슨 운영 규정 (필독)</div><div class="notice-intro">본 운영 방침은 최상의 수업 몰입도와 체계적인 발성 교정을 위해 설계되었습니다. 효율적인 수업 진행을 위해 아래 내용을 숙지하고 엄격히 준수해 주시기 바랍니다.</div><div class="notice-wrap">');
    var notices=[
      ['레슨 시간 준수','정시 시작 및 종료를 원칙으로 합니다. 개인 사정으로 인한 지각 시에도 종료 시간은 동일합니다. (다만, 이전 수강생의 피드백이 길어져 발생하는 수 분 내외의 수업 지연은 최상의 레슨 퀄리티를 위해 제가 직접 조율하는 부분이니 양해 부탁드립니다.)'],
      ['당일 변경 및 취소 (사유 불문 1회 차감)','예약된 시간은 오직 한 분을 위해 비워둔 기회비용입니다. 갑작스러운 개인 사정, 건강 문제 등 어떠한 사유를 막론하고 당일 취소는 선생님의 준비 시간과 타 수강생의 기회를 박탈하는 행위이므로 예외 없이 차감됩니다.'],
      ['레슨 이월 및 연기','4회 수업 중 1회만 가능합니다. (발성은 근육의 습관을 형성하는 과정입니다. 수업 간격이 불규칙해지면 신체 감각이 퇴보하여 결국 지난 학습 내용을 반복하게 됩니다. 지체 없는 성장을 위한 최소한의 훈련 루틴임을 이해해 주시기 바랍니다.)'],
      ['실력 변화를 위한 연습과 질문','수업에서 배운 감각을 내 것으로 만드는 유일한 방법은 연습입니다. (개인 연습을 하시면서 잘 안되는 부분이나 궁금한 점을 꼭 체크해 오세요. 스스로 고민하고 질문을 던질 때 이해도가 높아지며, 그만큼 수업의 깊이와 실력 향상 속도도 눈에 띄게 빨라집니다. 더 정교한 피드백을 주고받을 수 있도록 본인의 실력에 맞는 연습을 꾸준히 소화해 주시기 바랍니다.)'],
      ['수강료 납부 및 예약 확정','입금 확인은 수업 참여에 대한 상호 간의 가장 기본적인 약속입니다. 수업 전날까지 입금 완료 시 예약이 최종 확정되며, 미입금 시 해당 시간대는 예약 대기자에게 우선권이 부여되어 일정이 자동 취소됩니다.'],
      ['중도 퇴실 및 환불 정책','2회차 수업 참여 시점부터는 잔여 회차에 대한 반환이 진행되지 않습니다. (1회 수업 후 적성이나 변심에 의한 환불은 가능하나, 2회차부터는 핵심 커리큘럼과 노하우가 본격적으로 전달되는 단계입니다. 교육 콘텐츠의 가치를 보호하고 책임감 있는 학습 분위기를 유지하기 위한 기준이니 신중하게 결정해 주시기 바랍니다.)'],
      ['개인 준비물 (생수 / 녹음기 / 필기도구)','수분 공급은 성대 부상을 방지하는 필수 요건이며, 녹음과 기록은 휘발되는 감각을 객관화하여 학습 효과를 극대화하는 가장 강력한 도구입니다. 최상의 수업을 위해 반드시 지참해 주세요.']
    ];
  notices.forEach(function(n,i){
    w.document.write('<div class="notice-item"><span class="notice-num">'+(i+1)+'.</span><div class="notice-body"><strong>'+n[0]+'</strong> '+n[1]+'</div></div>');
  });
  w.document.write('</div>');
  w.document.write('<div class="motto">&#8220;모든 규정은 오로지 귀하의 실력 향상에만 초점을 맞추고 있습니다. 프로페셔널한 자세로 수업에 임해주시길 기대합니다.&#8221;</div>');

  /* ── 입금 계좌 ── */
  w.document.write('<div class="account-box">');
  w.document.write('<div class="account-title">입금 계좌</div>');
  w.document.write('<div class="account-row">우리은행 &nbsp; 1002-046-438968 &nbsp; (양경렬)</div>');
  w.document.write('<div class="account-row">기업은행 &nbsp; 010-8804-8903 &nbsp; (양경렬)</div>');
  w.document.write('<div style="font-size:10px;color:#888;margin-top:2px">카카오톡 오픈채팅: HLB보컬스튜디오</div>');
  w.document.write('</div>');
  w.document.write('</div>');

  /* ── 좌우명 ── */
  if(!isGroup){
    w.document.write('<div style="margin:0 0 8px;padding:7px 12px;background:#f9f6f0;border-left:3px solid #c8a96e;font-size:10.5px;line-height:1.5;color:#555;font-style:italic">"모든 규정은 오로지 귀하의 실력 향상에만 초점을 맞추고 있습니다. 프로페셔널한 자세로 수업에 임해주시길 기대합니다."</div>');
  }
  /* ── 서명 ── */
  w.document.write('<div class="sign-area">');
  w.document.write('<div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">트레이너 서명</div></div>');
  w.document.write('<div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">위 유의사항에 동의합니다 — 수강생 서명</div></div>');
  w.document.write('<div style="text-align:right;font-size:10px;color:#888;flex:0.6">년&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;일</div>');
  w.document.write('</div>');

  if(consentDate)w.document.write('<div style="margin:6px 12px 0;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:10.5px;color:#555;background:#f8f8f8">동의 녹음 완료일: <strong>'+consentDate+'</strong></div>');
  w.document.write('<div style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:7px 20px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">🖨️ 인쇄</button></div>');
  w.document.write('</body></html>');
  w.document.close();
}

/* PROFILE */
/* PROFILE */
function pRow(label,val){
  if(!val&&val!=='0')return'';
  return '<div class="pil-row"><span class="pil-label">'+esc(label)+'</span><span class="pil-value">'+esc(val)+'</span></div>';
}
function fv(label,val,cls){
  var em=!val;
  return '<div class="fi'+(cls?' '+cls:'')+'">'+'<div class="fi-label">'+esc(label)+'</div>'+'<div class="fi-value'+(cls&&cls.indexOf('long')>=0?' long':'')+(em?' muted':'')+'">'+esc(em?'—':val)+'</div></div>';
}
function switchTab(el,idx){
  el.parentElement.querySelectorAll('.tab').forEach(function(t){t.classList.remove('on');});
  el.classList.add('on');
  el.closest('.profile-right').querySelectorAll('.tab-pane').forEach(function(p,i){p.classList.toggle('on',i===idx);});
}
function openProfile(data,mode){
  if(!data)return;
  var isC=mode==='consult';
  var s=isC?null:data;
  var color=s?gc(s):'#c8a96e';
  var color2=s?COLORS[(students.indexOf(s)+2)%COLORS.length]:'#6ea3c8';
  var name=data.name||'이름 없음';
  var photo=isC?(getConsultPhoto(data)||data.photo||''):(getStudentPhoto(data)||data.photo||'');
  var sLogs=isC?[]:logs.filter(function(l){return l.sid===data.id;});
  var attCnt=sLogs.filter(function(l){return l.att==='출석';}).length;

  /* 헤더 제목 업데이트 */
  ge('profileTitle').textContent=isC?'상담 신청서':'레슨생 프로필';
  var sub=ge('profileSubtitle');
  if(sub)sub.textContent=isC?('접수 '+esc(data.date||'')):(esc(clsL(data.cls||''))+' · '+(data.status||''));

  var left='<div class="profile-photo" style="background:'+(photo?'#000':'linear-gradient(160deg,'+color+'18,'+color2+'18)')+'">';
  left+=photo?'<img src="'+photo+'" style="cursor:zoom-in" onclick="openLightbox(this.src)">':'<div class="no-photo" style="color:'+color+'">'+esc(name.slice(0,1))+'</div>';
  left+='<div class="profile-photo-overlay" style="background:linear-gradient(0deg,var(--s1) 0%,rgba(255,255,255,.0) 65%)"><div><div class="profile-name-big" style="color:var(--t)">'+esc(name)+'</div>';
  if(isC)left+='<div style="font-size:11.5px;color:rgba(255,255,255,.45);margin-top:3px">접수 '+esc(data.date||'')+'</div>';
  left+='</div></div></div>';
  left+='<div class="profile-info-list">';
  left+=pRow('성별',data.gd||data.gender||'');
  left+=pRow('나이',data.age?(function(a){var raw=String(a||'').trim();if(!raw)return '';var n=parseInt(raw)||0;var yr=raw.length<=2&&n>=0?(n>=30?1900+n:2000+n):n;var ty=new Date().getFullYear();return (yr>=1920&&yr<=ty)?'만 '+(ty-yr)+'세':'';})(data.age):'');
  left+=pRow('연락처',data.phone||data.ph||'');
  if(isC){
    left+=pRow('희망 반',data.cls?clsL(data.cls):'');
    left+=pRow('희망 요일',(data.days||[]).join(', '));
    left+=pRow('희망 시간대',data.time||'');
    left+=pRow('시작 시기',data.when||'');
  } else {
    left+='<div class="pil-row"><span class="pil-label">반</span><span class="pil-value"><span class="bdg '+(data.cls==='pro'?'bg-a':'bg-g')+'">'+clsL(data.cls)+'</span></span></div>';
    left+=pRow('스케줄',data.schedType==='flex'?'🔄 변동':(data.days||[]).map(function(d){return d+' '+((data.times&&data.times[d])||'');}).join(' / '));
    left+='<div class="pil-row"><span class="pil-label">레슨 횟수</span><span class="pil-value">'+(data.freq===2?'주 2회':'주 1회')+'</span></div>';
    left+=pRow('레슨 시작일',data.st||'');
    left+='<div class="pil-row"><span class="pil-label">상태</span><span class="pil-value"><span class="bdg '+(data.status==='수강중'?'bg-g':data.status==='휴강'?'bg-a':'bg-r')+'">'+esc(data.status)+'</span></span></div>';
    /* 통계 요약 */
    left+='<div style="margin:8px 0;padding:10px 12px;background:var(--ag);border-radius:9px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center">';
    left+='<div><div style="font-size:16px;font-weight:800;color:var(--a);font-family:Cormorant Garamond,serif">'+sLogs.length+'</div><div style="font-size:10px;color:var(--tm)">레슨</div></div>';
    left+='<div><div style="font-size:16px;font-weight:800;color:var(--g);font-family:Cormorant Garamond,serif">'+attCnt+'</div><div style="font-size:10px;color:var(--tm)">출석</div></div>';
    left+='<div><div style="font-size:16px;font-weight:800;color:var(--t);font-family:Cormorant Garamond,serif">'+(sLogs.length?Math.round(attCnt/sLogs.length*100)+'%':'—')+'</div><div style="font-size:10px;color:var(--tm)">출석률</div></div>';
    left+='</div>';
    var pci=getCycleInfo(data);
    var pRemain=pci.remainInCycle;
    left+='<div style="margin:0 0 8px;padding:8px 12px;background:rgba(255,255,255,.03);border:1px solid var(--b);border-radius:8px;font-size:12px;color:var(--ts)">';
    left+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">';
    left+='<span>현재 <b style="color:var(--a);font-size:15px;font-family:Cormorant Garamond,serif">'+pci.totalLessons+'</b>회차</span>';
    left+='<span style="color:var(--tm)">'+pci.cycleStart+'~'+pci.cycleEnd+'회 구간</span>';
    left+='</div>';
    left+='<div style="margin-top:4px;height:4px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+Math.round(pci.lessonsInCycle/pci.cycleSize*100)+'%;background:var(--a);border-radius:3px"></div></div>';
    if(pRemain>0){
      left+='<div style="margin-top:5px;color:var(--g)">→ <b>'+pRemain+'회</b> 후 다음 입금</div>';
    } else {
      left+='<div style="margin-top:5px;color:var(--r);font-weight:700">⚡ 레슨비 입금 필요</div>';
    }
    if(pci.offset>0)left+='<div style="font-size:11px;color:var(--tm);margin-top:2px">이전 +'+pci.offset+'회 포함</div>';
    left+='</div>';
    if(data.fee)left+=pRow('월 레슨비',won(data.fee));
  }
  left+='</div>';
  left+='<div class="profile-actions">';
  if(isC){
    left+='<button class="btn bp" style="width:100%;justify-content:center" data-cid="'+data.id+'" onclick="cm(\'mProfile\');convertFromProfile(this.dataset.cid)">→ 레슨생으로 등록</button>';
    left+='<button class="btn bg2" style="width:100%;justify-content:center" data-cid="'+data.id+'" onclick="cm(\'mProfile\');showConsultForm(this.dataset.cid)">✏️ 신청서 수정</button>';
    left+='<button class="btn bd" style="width:100%;justify-content:center" data-cid="'+data.id+'" onclick="delConsultFromProfile(this.dataset.cid)">🗑 삭제</button>';
  } else {
    if(data.ph){
      left+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">';
      left+='<a href="tel:'+esc(data.ph)+'" class="btn bsm" style="justify-content:center;background:rgba(109,200,162,.1);color:var(--g);border:1px solid rgba(109,200,162,.2);text-decoration:none;font-size:12px">📞 전화</a>';
      left+='<a href="sms:'+esc(data.ph)+'" class="btn bsm" style="justify-content:center;background:rgba(110,163,200,.1);color:var(--bl);border:1px solid rgba(110,163,200,.2);text-decoration:none;font-size:12px">💬 문자</a>';
      left+='</div>';
    }
    left+='<button class="btn bp" style="width:100%;justify-content:center" data-sid="'+data.id+'" onclick="cm(\'mProfile\');openSModal(this.dataset.sid)">✏️ 수정 / 삭제</button>';
  }
  left+='</div>';

  var tabs='',panes='';
  if(isC){
    tabs='<div class="tab on" onclick="switchTab(this,0)">신청 정보</div><div class="tab" onclick="switchTab(this,1)">유입 &amp; 목표</div><div class="tab" onclick="switchTab(this,2)">음성 &amp; 건강</div><div class="tab" onclick="switchTab(this,3)">미디어</div>';
    panes+='<div class="tab-pane on"><div class="fs"><div class="fs-title">기본 정보</div><div class="fs-grid">'+fv('성함',name)+fv('나이',data.age?(function(a){var raw=String(a||'').trim();if(!raw)return '';var n=parseInt(raw)||0;var yr=raw.length<=2&&n>=0?(n>=30?1900+n:2000+n):n;var ty=new Date().getFullYear();return (yr>=1920&&yr<=ty)?'만 '+(ty-yr)+'세':'';})(data.age):'')+fv('성별',data.gd||'')+fv('직업',data.job||'')+fv('연락처',data.phone||'')+fv('희망 반',data.cls?clsL(data.cls):'')+fv('스케줄 희망',(data.schedPref==='flex'?'🔄 변동 희망':'📌 고정 희망')+(data.time?' — '+data.time:''))+'</div></div><div class="fs"><div class="fs-title">레슨 일정</div><div class="fs-grid">'+fv('희망 요일',(data.days||[]).join(', '))+fv('레슨 횟수',data.freq2?'주 2회':'주 1회')+fv('시작 시기',data.when||'')+'</div></div></div>';
    var refStr=esc(data.ref||'')+(data.refDetail?' — '+esc(data.refDetail):'');
    var genreStr=Array.isArray(data.genres)?data.genres.join(', '):(data.genre||'');
    panes+='<div class="tab-pane"><div class="fs"><div class="fs-title">유입 경로</div><div class="fs-grid">'+fv('경로',refStr)+'</div></div><div class="fs"><div class="fs-title">목표 &amp; 동기</div><div class="fs-grid">'+fv('배우러 오게 된 계기',data.why||'','full long')+fv('목표 장르',genreStr)+fv('단기 목표',data.goalS||'')+fv('장기 목표',data.goalL||'')+'</div></div>'+(data.memo?'<div class="fs"><div class="fs-title">추가 메모</div><div class="fs-grid">'+fv('메모',data.memo,'full long')+'</div></div>':'')+(data.prob||data.impr?'<div class="fs" style="border-color:rgba(200,169,110,.2)"><div class="fs-title" style="color:var(--a)">🔒 트레이너 평가 메모</div><div class="fs-grid">'+fv('문제점',data.prob||'')+fv('개선 방향',data.impr||'')+'</div></div>':'')+'</div>';
    panes+='<div class="tab-pane"><div class="fs"><div class="fs-title">음성 질환 &amp; 건강</div><div class="fs-grid">'+fv('음성 질환',data.voice||'')+fv('음성 질환 상세',data.vdetail||'')+fv('흡연',data.smoke||'')+fv('음주',data.drink||'')+fv('건강 특이사항',data.health||'')+'</div></div><div class="fs"><div class="fs-title">레슨 경험</div><div class="fs-grid">'+fv('경험',data.exp||'')+fv('이전 형태',data.prevType||'')+fv('이전 기관',data.prev||'')+'</div></div></div>';
    panes+='<div class="tab-pane">'+buildMediaPanel(data,'consult')+'</div>';
  } else {
    var hasCD=!!(data.consultData);
    tabs='<div class="tab on" onclick="switchTab(this,0)">레슨 개요</div><div class="tab" onclick="switchTab(this,1)">레슨 기록</div><div class="tab" onclick="switchTab(this,2)">미디어</div>';
    if(hasCD)tabs+='<div class="tab" onclick="switchTab(this,3)">상담 신청서</div>';
    var sc=data.schedType==='flex'?'🔄 변동 스케줄':(data.days||[]).map(function(d){return d+' '+((data.times&&data.times[d])||'');}).join(' / ');
    panes+='<div class="tab-pane on"><div class="fs"><div class="fs-title">출석 통계</div><div class="fs-grid" style="grid-template-columns:1fr 1fr 1fr">';
    [{l:'총 레슨',v:sLogs.length+'회',col:'var(--a)'},{l:'출석',v:attCnt+'회',col:'var(--g)'},{l:'출석률',v:sLogs.length?Math.round(attCnt/sLogs.length*100)+'%':'—',col:'var(--t)'}].forEach(function(x){
      panes+='<div class="fi"><div class="fi-label">'+esc(x.l)+'</div><div class="fi-value" style="font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:700;padding:11px 12px;color:'+x.col+'">'+esc(x.v)+'</div></div>';
    });
    panes+='</div></div><div class="fs"><div class="fs-title">레슨 정보</div><div class="fs-grid">'+fv('반',clsL(data.cls)+' · '+clsD(data.cls))+fv('스케줄',sc)+fv('레슨 횟수',data.freq===2?'주 2회':'주 1회')+fv('레슨 시작일',data.st||'')+fv('연락처',data.ph||'')+(data.fee?fv('월 레슨비',won(data.fee)):'')+fv('상태',data.status||'')+(data.memo?fv('메모',data.memo,'full'):'')+'</div></div></div>';
    var wkCards=sLogs.length?'<div class="wk-grid">':'';
    sLogs.forEach(function(l){
      var rt=parseInt(l.rt||3);
      var stars='<span style="color:var(--a);letter-spacing:-.05em;font-size:12px">';
      for(var si=0;si<rt;si++)stars+='★';stars+='</span>';
      var attColor=l.att==='출석'?'var(--g)':l.att==='결석'?'var(--r)':'var(--bl)';
      wkCards+='<div class="wk-card" data-lid="'+l.id+'" onclick="editLogByIdEl(this.dataset.lid);cm(\'mProfile\')" onmouseenter="this.style.borderColor=\'rgba(200,169,110,.3)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'">';
      wkCards+='<div class="wk-card-hd"><div class="wk-badge"><div class="wk-badge-n">'+l.wn+'</div><div class="wk-badge-l">회차</div></div>';
      wkCards+='<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--t)">'+esc(l.date)+'</div>';
      wkCards+='<div style="display:flex;gap:6px;align-items:center;margin-top:4px">';
      wkCards+='<span style="font-size:11px;font-weight:700;color:'+attColor+';background:'+attColor+'18;border-radius:4px;padding:1px 6px">'+esc(l.att)+'</span>';
      wkCards+=stars;
      wkCards+='</div></div></div>';
      wkCards+='<div class="wk-card-body">';
      if(l.ct)wkCards+='<div class="wk-row"><div class="wk-lbl" style="color:var(--a)">📝 진도</div><div class="wk-val">'+esc(l.ct)+'</div></div>';
      if(l.fb)wkCards+='<div class="wk-row"><div class="wk-lbl" style="color:var(--r)">⚠️ 피드백</div><div class="wk-val" style="color:var(--r);opacity:.85">'+esc(l.fb)+'</div></div>';
      if(l.hw)wkCards+='<div class="wk-row"><div class="wk-lbl" style="color:var(--g)">📋 과제</div><div class="wk-val" style="color:var(--g)">'+esc(l.hw)+'</div></div>';
      if(!l.ct&&!l.fb&&!l.hw)wkCards+='<div style="color:var(--tm);font-size:12.5px;font-style:italic">내용 없음 — 클릭해서 추가</div>';
      wkCards+='</div>';
      if(l.note)wkCards+='<div class="wk-card-ft"><span style="font-size:11.5px;color:var(--tm)">'+esc(l.note)+'</span></div>';
      wkCards+='</div>';
    });
    if(sLogs.length)wkCards+='</div>'; else wkCards='<div class="empty"><div class="ei">✎</div><div class="et">레슨 기록이 없습니다</div><div class="ed" style="margin-top:12px"><button class="btn bp" onclick="openLessonRecord(\''+esc(data.id)+'\',null,null)">+ 레슨 기록 추가</button></div></div>';
    panes+='<div class="tab-pane">'+wkCards+'</div>';
    panes+='<div class="tab-pane">'+buildMediaPanel(data,'student')+'</div>';
    if(hasCD){
      var cd=data.consultData;
      var cdRef=esc(cd.ref||'')+(cd.refDetail?' — '+esc(cd.refDetail):'');
      var cdGenre=Array.isArray(cd.genres)?cd.genres.join(', '):(cd.genre||'');
      panes+='<div class="tab-pane"><div class="fs"><div class="fs-title">신청서 기본 정보</div><div class="fs-grid">'+fv('직업',cd.job||'')+fv('유입 경로',cdRef)+'</div></div><div class="fs"><div class="fs-title">목표 &amp; 동기</div><div class="fs-grid">'+fv('배우러 오게 된 계기',cd.why||'','full long')+fv('목표 장르',cdGenre)+fv('단기 목표',cd.goalS||'')+fv('장기 목표',cd.goalL||'')+'</div></div><div class="fs"><div class="fs-title">음성 &amp; 건강</div><div class="fs-grid">'+fv('음성 질환',cd.voice||'')+fv('상세',cd.vdetail||'')+fv('레슨 경험',cd.exp||'')+fv('이전 형태',cd.prevType||'')+fv('이전 기관',cd.prev||'')+fv('흡연',cd.smoke||'')+fv('음주',cd.drink||'')+'</div></div>'+(cd.memo?'<div class="fs"><div class="fs-title">추가 메모</div><div class="fs-grid">'+fv('메모',cd.memo,'full long')+'</div></div>':'')+'<div style="font-size:12px;color:var(--tm);margin-top:8px">상담 접수일: '+esc(cd.date||'')+'</div></div>';
    }
  }
  ge('profileBody').innerHTML='<div class="profile-wrap" style="margin-top:17px"><div class="profile-left">'+left+'</div><div class="profile-right"><div class="tab-bar">'+tabs+'</div><div class="tab-content">'+panes+'</div></div></div>';
  ge('profileFooter').innerHTML='<button class="btn bg2" onclick="cm(\'mProfile\')">닫기</button>';
  om('mProfile');
}

/* CONSULT LIST */

/* ── 전체 문자 메시지 ── */