/* ============================================================
   sms.js — 문자 발송 & 템플릿
   showBulkSMS() : 단체 문자 발송 모달
   smsSwitchTab() : 탭 전환
   smsCopyNums() : 번호 복사
   smsOpenApp() : 문자 앱 열기
   _smsTemplates : 템플릿 목록 (전역)
   saveSmsTemplates() : 템플릿 저장
   openSmsTemplates() : 템플릿 모달 열기
   applySmsTemplate() : 템플릿 적용
   deleteSmsTemplate() : 템플릿 삭제
   addSmsTemplateFromCurrent() : 현재 문자로 템플릿 추가
   copySMSContent() : 문자 내용 복사
   ============================================================ */

function showBulkSMS(){
  var phones=consults.filter(function(c){return c.phone&&!c.converted;}).map(function(c){return{name:c.name||c.phone,phone:c.phone};});
  var studs=students.filter(function(s){return s.ph&&s.status==='수강중';}).map(function(s){return{name:s.name,phone:s.ph};});
  var inqs=inquiries.filter(function(q){return q.phone;}).map(function(q){return{name:q.name||q.phone,phone:q.phone};});
  window._smsData={phones:phones,studs:studs,inqs:inqs};
  var ex=document.getElementById('mSMS');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mSMS';m.className='ov open';
  var html='<div class="modal wide">'
    +'<div class="mh"><div><div class="mt">📱 문자 발송</div>'
    +'<div style="font-size:12px;color:var(--tm);margin-top:2px">수신자를 선택하고 문자앱으로 발송합니다</div></div>'
    +'<div class="mc" onclick="document.getElementById(\'mSMS\').remove()">&#x2715;</div></div>'
    +'<div class="mb">'
    /* 탭 */
    +'<div style="display:flex;gap:6px;margin-bottom:14px;background:rgba(255,255,255,.03);border-radius:10px;padding:4px">';
  [
    {i:0,label:'상담신청자',cnt:phones.length,icon:'📋'},
    {i:1,label:'수강생',cnt:studs.length,icon:'🎵'},
    {i:2,label:'문의자',cnt:inqs.length,icon:'❓'}
  ].forEach(function(t){
    html+='<button id="sms-t'+t.i+'" onclick="smsSwitchTab('+t.i+')" style="flex:1;padding:8px 10px;border-radius:8px;border:none;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .14s;'+(t.i===0?'background:var(--a);color:#08080d;':'background:transparent;color:var(--tm);')+'">'
      +t.icon+' '+esc(t.label)+' <span style="opacity:.7">('+t.cnt+')</span></button>';
  });
  html+='</div>'
    /* 수신자 목록 */
    +'<div id="sms-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--b);border-radius:10px;margin-bottom:14px"></div>'
    /* 메시지 */
    +'<div class="f1" style="margin-bottom:10px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
    +'<label style="margin-bottom:0">메시지 내용</label>'
    +'<button class="btn bsm bg2" style="font-size:11.5px" onclick="openSmsTemplates()">📝 템플릿</button>'
    +'</div>'
    +'<textarea id="sms-body" rows="4" placeholder="내용을 입력하거나 템플릿을 불러오세요..."></textarea></div>'
    /* 버튼 */
    +'<div style="display:flex;gap:8px">'
    +'<button class="btn bg2" style="flex:1;justify-content:center" onclick="smsCopyNums()">📋 번호 복사</button>'
    +'<button class="btn bp" style="flex:1;justify-content:center" onclick="smsOpenApp()">📱 문자앱 열기</button>'
    +'</div>'
    +'</div></div>';
  m.innerHTML=html;
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
  smsSwitchTab(0);
}

function smsSwitchTab(idx){
  [0,1,2].forEach(function(i){
    var el=document.getElementById('sms-t'+i);
    if(el){
      el.style.background=i===idx?'var(--a)':'transparent';
      el.style.color=i===idx?'#08080d':'var(--tm)';
    }
  });
  var d=window._smsData;
  var list=[d.phones,d.studs,d.inqs][idx]||[];
  window._smsCurList=list;
  var box=document.getElementById('sms-list');
  if(!box) return;
  if(!list.length){
    box.innerHTML='<div style="text-align:center;padding:20px;color:var(--tm);font-size:13px">해당하는 연락처가 없습니다</div>';
    return;
  }
  box.innerHTML='<div style="padding:6px">'+list.map(function(p){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;transition:background .12s" onmouseenter="this.style.background=\'rgba(255,255,255,.04)\'" onmouseleave="this.style.background=\'\'">'
      +'<div style="width:32px;height:32px;border-radius:50%;background:var(--ag);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--a);flex-shrink:0">'+esc((p.name||'?').slice(0,1))+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:600;color:var(--t)">'+esc(p.name)+'</div>'
      +'<div style="font-size:11.5px;color:var(--tm);font-family:DM Mono,monospace">'+esc(p.phone)+'</div></div>'
      +'<a href="sms:'+esc(p.phone)+'" style="font-size:11.5px;background:rgba(109,200,162,.1);color:var(--g);border:1px solid rgba(109,200,162,.2);border-radius:6px;padding:4px 10px;text-decoration:none;white-space:nowrap;font-family:DM Sans,sans-serif;font-weight:600">문자</a>'
      +'</div>';
  }).join('')+'</div>';
}

function smsCopyNums(){
  var list=window._smsCurList||[];
  if(!list.length){toast('수신자가 없습니다','⚠️');return;}
  var nums=list.map(function(p){return p.phone;}).join(', ');
  if(navigator.clipboard){
    navigator.clipboard.writeText(nums).then(function(){toast(list.length+'명 번호 복사됨 📋');});
  } else {
    toast('직접 선택 후 복사해 주세요','⚠️');
  }
}

function smsOpenApp(){
  var list=window._smsCurList||[];
  if(!list.length){toast('수신자가 없습니다','⚠️');return;}
  var body=document.getElementById('sms-body');
  var msg=body?body.value.trim():'';
  var nums=list.map(function(p){return p.phone;}).join(';');
  var uri='sms:'+nums+(msg?'?body='+encodeURIComponent(msg):'');
  window.location.href=uri;
}

/* ── 문자 템플릿 저장/불러오기 ── */
var _smsTemplates=[
  {name:'미입금 안내',text:'안녕하세요, HLB보컬스튜디오입니다 🎤\n이번 달 레슨비 입금이 확인되지 않아 안내드립니다.\n\n▶ 우리은행 1002-046-438968 (양경렬)\n▶ 기업은행 010-8804-8903 (양경렬)\n\n수업 전날까지 입금해 주시면 감사하겠습니다 😊'},
  {name:'결석 확인',text:'안녕하세요 😊 오늘 레슨 예정이셨는데 연락이 없으셔서 확인차 문자드립니다. 혹시 오늘 수업 어렵게 되셨나요?'},
  {name:'레슨 일정 안내',text:'안녕하세요! 이번 주 레슨 일정 안내드립니다 📅\n\n일시: \n장소: HLB보컬스튜디오\n\n궁금한 점이 있으시면 편하게 연락주세요 🎵'},
  {name:'상담 일정 확인',text:'안녕하세요, HLB보컬스튜디오입니다 🎤\n방문 상담 일정 확인드립니다.\n\n일시: \n\n오시는 길이 궁금하시면 말씀해 주세요 😊'},
];
try{var _st=localStorage.getItem('vsC_smsT');if(_st)_smsTemplates=JSON.parse(_st);}catch(e){}
function saveSmsTemplates(){try{localStorage.setItem('vsC_smsT',JSON.stringify(_smsTemplates));}catch(e){}}

function openSmsTemplates(){
  var ex=document.getElementById('mSmsTemplates');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mSmsTemplates';m.className='ov open';
  var listHtml=_smsTemplates.map(function(t,i){
    return '<div style="background:var(--s1);border:1px solid var(--b);border-radius:10px;padding:11px 14px;margin-bottom:8px;cursor:pointer;transition:border-color .13s" onmouseenter="this.style.borderColor=\'rgba(200,169,110,.25)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
      +'<div style="font-size:13.5px;font-weight:700;color:var(--a)">'+esc(t.name)+'</div>'
      +'<div style="display:flex;gap:5px">'
      +'<button class="btn bsm bp" style="font-size:11.5px;padding:3px 10px" data-idx="'+i+'" onclick="applySmsTemplate('+i+')">사용</button>'
      +'<button class="btn bsm bd" style="font-size:11.5px;padding:3px 8px" data-idx="'+i+'" onclick="deleteSmsTemplate('+i+')">✕</button>'
      +'</div></div>'
      +'<div style="font-size:12px;color:var(--tm);white-space:pre-wrap;line-height:1.6;max-height:60px;overflow:hidden">'+esc(t.text)+'</div>'
      +'</div>';
  }).join('');
  m.innerHTML='<div class="modal">'
    +'<div class="mh"><div><div class="mt">📝 문자 템플릿</div><div style="font-size:12px;color:var(--tm);margin-top:2px">자주 쓰는 문자를 저장해두세요</div></div><div class="mc" onclick="document.getElementById(\'mSmsTemplates\').remove()">&#x2715;</div></div>'
    +'<div class="mb" style="max-height:60vh;overflow-y:auto">'
    +(listHtml||'<div style="text-align:center;padding:20px;color:var(--tm)">저장된 템플릿이 없습니다</div>')
    +'</div>'
    +'<div class="mf" style="flex-wrap:wrap;gap:8px">'
    +'<button class="btn bm bsm" style="flex:1;justify-content:center" onclick="addSmsTemplateFromCurrent()">+ 현재 입력 저장</button>'
    +'<button class="btn bg2" onclick="document.getElementById(\'mSmsTemplates\').remove()">닫기</button>'
    +'</div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
}

function applySmsTemplate(idx){
  var t=_smsTemplates[idx];if(!t)return;
  var body=document.getElementById('sms-body');
  if(body)body.value=t.text;
  var m=document.getElementById('mSmsTemplates');if(m)m.remove();
  toast('템플릿 적용됨 📝');
}
function deleteSmsTemplate(idx){
  _smsTemplates.splice(idx,1);
  saveSmsTemplates();
  openSmsTemplates();/* 다시 열기 */
  toast('삭제됨','🗑');
}
function addSmsTemplateFromCurrent(){
  var body=document.getElementById('sms-body');
  var text=body?body.value.trim():'';
  if(!text){toast('먼저 메시지를 입력해주세요','⚠️');return;}
  var name='템플릿 '+(_smsTemplates.length+1);
  /* 이름 입력 모달 */
  var ex2=document.getElementById('mSmsTemplateName');if(ex2)ex2.remove();
  var m2=document.createElement('div');
  m2.id='mSmsTemplateName';m2.className='ov open';
  m2.innerHTML='<div class="modal" style="max-width:320px">'
    +'<div class="mb" style="padding:24px">'
    +'<div style="font-size:15px;font-weight:700;color:var(--t);margin-bottom:12px">템플릿 이름</div>'
    +'<div class="f1"><input type="text" id="smsTemplateNameInput" placeholder="예: 미입금 안내" value="'+esc(name)+'"></div>'
    +'</div>'
    +'<div class="mf">'
    +'<button class="btn bg2" onclick="document.getElementById(\'mSmsTemplateName\').remove()">취소</button>'
    +'<button class="btn bp" onclick="(function(){var nm=document.getElementById(\'smsTemplateNameInput\').value.trim()||\'템플릿\';_smsTemplates.unshift({name:nm,text:\''+text.replace(/'/g,"\\'").replace(/\n/g,'\\n')+'\'});saveSmsTemplates();document.getElementById(\'mSmsTemplateName\').remove();openSmsTemplates();toast(\'템플릿 저장됨 📝\');})()">저장</button>'
    +'</div></div>';
  m2.addEventListener('click',function(ev){if(ev.target===m2)m2.remove();});
  document.body.appendChild(m2);
  setTimeout(function(){var el=document.getElementById('smsTemplateNameInput');if(el){el.focus();el.select();}},100);
}


function copySMSContent(){
  var phones=(document.getElementById('sms-phones')&&document.getElementById('sms-phones').value)||'';
  var body=(document.getElementById('sms-body')&&document.getElementById('sms-body').value)||'';
  var full='[수신자] '+phones+'\n\n[내용]\n'+body;
  if(navigator.clipboard){navigator.clipboard.writeText(full).then(function(){toast('클립보드에 복사됨 📋');}).catch(function(){toast('직접 선택 후 복사해 주세요','⚠️');});}
  else{toast('직접 선택 후 복사해 주세요','⚠️');}
}
