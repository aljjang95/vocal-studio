/* ============================================================
   consult.js — 상담 관리 & 평가지
   setConsultTab() : 상담/문의 탭 전환
   buildInquiryList() : 문의자 목록
   buildConsultList() : 상담자 목록
   delConsultFromProfile() : 프로필에서 상담 삭제
   convertFromProfile() : 상담→레슨생 전환
   calcFee() : 수강료 계산
   ciSetSched() : 스케줄 설정
   saveConsultEdit() : 상담 저장
   saveConsult() : 신규 상담 저장
   showEvalPage() : 평가지 페이지
   showConsultForm() : 신규 상담 작성 폼
   ============================================================ */

function setConsultTab(tab){
  _consultTab=tab;
  render();
}
function buildInquiryList(){
  var o='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap">';
  o+='<div style="font-size:13px;color:var(--tm)">문의자 <b style="color:var(--t)">'+inquiries.length+'</b>명</div>';
  o+='<div style="display:flex;gap:6px">';
  o+='<button class="btn bp bsm" onclick="openAddInquiry()">＋ 문의자 추가</button>';
  o+='</div></div>';
  if(!inquiries.length){
    o+='<div class="empty"><div class="ei">📞</div><div class="et">등록된 문의자가 없습니다</div><div class="ed">문의 전화가 오면 바로 저장해두세요</div></div>';
    return o;
  }
  o+='<div style="display:flex;flex-direction:column;gap:7px">';
  inquiries.forEach(function(q){
    var initial=(q.name&&q.name!==q.phone)?q.name.slice(0,1):'?';
    var hasName=q.name&&q.name!==q.phone;
    o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:11px 14px;display:flex;align-items:center;gap:12px;transition:border-color .14s;cursor:default" onmouseenter="this.style.borderColor=\'rgba(200,169,110,.22)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'">';
    /* 아바타 */
    o+='<div style="width:38px;height:38px;border-radius:50%;background:rgba(200,169,110,.1);border:1px solid var(--b);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:var(--a);flex-shrink:0">'+esc(initial)+'</div>';
    /* 정보 */
    o+='<div style="flex:1;min-width:0">';
    if(hasName)o+='<div style="font-size:14px;font-weight:700;color:var(--t);margin-bottom:1px">'+esc(q.name)+'</div>';
    o+='<div style="font-size:'+(hasName?'12':'14')+'px;font-weight:'+(hasName?'400':'700')+';color:'+(hasName?'var(--tm)':'var(--t)')+';font-family:'+(hasName?'inherit':'DM Mono,monospace')+'">'+esc(q.phone||'번호 없음')+'</div>';
    if(q.memo)o+='<div style="font-size:12px;color:var(--tm);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(q.memo)+'</div>';
    o+='</div>';
    /* 날짜 */
    if(q.date)o+='<div style="font-size:11px;color:var(--tm);flex-shrink:0;text-align:right;font-family:DM Mono,monospace">'+esc(q.date.slice(5))+'</div>';
    /* 액션 버튼 */
    o+='<div style="display:flex;gap:5px;flex-shrink:0">';
    if(q.phone)o+='<a href="sms:'+esc(q.phone)+'" class="btn bsm" style="background:rgba(109,200,162,.1);color:var(--g);border:1px solid rgba(109,200,162,.2);text-decoration:none;font-size:12px;padding:5px 10px">💬</a>';
    if(q.phone)o+='<a href="tel:'+esc(q.phone)+'" class="btn bsm" style="background:rgba(110,163,200,.1);color:var(--bl);border:1px solid rgba(110,163,200,.2);text-decoration:none;font-size:12px;padding:5px 10px">📞</a>';
    o+='<button class="btn bsm" style="background:rgba(200,80,80,.08);color:var(--r);border:1px solid rgba(200,80,80,.18);font-size:12px;padding:5px 10px" data-qid="'+q.id+'" onclick="deleteInquiry(this.dataset.qid)">✕</button>';
    o+='</div>';
    o+='</div>';
  });
  o+='</div>';
  return o;
}



function parsePhoneNumbers(text){
  /* 번호 파싱: 줄바꿈, 쉼표, 공백, 탭 구분자 모두 처리 */
  var raw=text.replace(/[,\t\n\r]+/g,' ').split(' ');
  var nums=[];
  raw.forEach(function(s){
    var cleaned=s.replace(/[^0-9]/g,'');
    if(cleaned.length>=10&&cleaned.length<=11){
      /* 포맷: 010-XXXX-XXXX */
      var fmt=cleaned.length===11?
        cleaned.slice(0,3)+'-'+cleaned.slice(3,7)+'-'+cleaned.slice(7):
        cleaned.slice(0,3)+'-'+cleaned.slice(3,7)+'-'+cleaned.slice(7);
      if(nums.indexOf(fmt)<0) nums.push(fmt);
    }
  });
  return nums;
}

function saveBulkInquiry(){
  var ta=document.getElementById('iq-bulk-text');
  if(!ta||!ta.value.trim()){toast('번호를 입력해주세요','⚠️');return;}
  var nums=parsePhoneNumbers(ta.value);
  if(!nums.length){toast('유효한 번호가 없습니다','⚠️');return;}
  /* 기존 등록된 번호 제외 */
  var existing=inquiries.map(function(q){return q.phone;});
  var newNums=nums.filter(function(n){return existing.indexOf(n)<0;});
  newNums.forEach(function(ph){
    inquiries.unshift({id:uid(),name:ph,phone:ph,memo:'',date:toDS(new Date())});
  });
  saveAll();
  var m=document.getElementById('mAddInquiry');if(m)m.remove();
  toast(newNums.length+'명 등록됨'+(nums.length-newNums.length>0?' (중복 '+(nums.length-newNums.length)+'명 제외)':''),'📞');
  if(page==='consult') render();
}
function openAddInquiry(){
  var ex=document.getElementById('mAddInquiry');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mAddInquiry';m.className='ov open';
  m.innerHTML='<div class="modal">'
    +'<div class="mh">'
    +'<div><div class="mt">📞 문의자 추가</div>'
    +'<div style="font-size:12px;color:var(--tm);margin-top:2px">나중에 레슨생으로 전환할 수 있습니다</div></div>'
    +'<div class="mc" onclick="document.getElementById(\'mAddInquiry\').remove()">&#x2715;</div>'
    +'</div>'
    +'<div class="mb">'
    /* 탭 */
    +'<div style="display:flex;gap:5px;background:rgba(255,255,255,.03);border-radius:10px;padding:4px;margin-bottom:16px">'
    +'<button id="iq-tab-one" onclick="switchIqTab(\'one\')" style="flex:1;padding:8px;border-radius:7px;border:none;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .13s;background:var(--a);color:#08080d">1명 추가</button>'
    +'<button id="iq-tab-bulk" onclick="switchIqTab(\'bulk\')" style="flex:1;padding:8px;border-radius:7px;border:none;font-family:DM Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .13s;background:transparent;color:var(--tm)">📋 일괄 등록</button>'
    +'</div>'
    /* 1명 추가 탭 */
    +'<div id="iq-one">'
    +'<div class="f1" style="margin-bottom:11px"><label>연락처 <span style="color:var(--r)">*</span></label>'
    +'<input id="iq-ph" type="tel" placeholder="010-0000-0000" style="font-size:16px;letter-spacing:.04em" oninput="fmtPhone(this)" onkeydown="if(event.key===\'Enter\')document.getElementById(\'iq-nm\').focus()"></div>'
    +'<div class="f1" style="margin-bottom:11px"><label>이름 <span style="font-size:11px;color:var(--tm);font-weight:400">(선택)</span></label>'
    +'<input id="iq-nm" placeholder="미상" onkeydown="if(event.key===\'Enter\')document.getElementById(\'iq-memo\').focus()"></div>'
    +'<div class="f1"><label>메모 <span style="font-size:11px;color:var(--tm);font-weight:400">(선택)</span></label>'
    +'<input id="iq-memo" placeholder="문의 내용, 방문 예정 등" onkeydown="if(event.key===\'Enter\')saveInquiry()"></div>'
    +'</div>'
    /* 일괄 등록 탭 */
    +'<div id="iq-bulk" style="display:none">'
    +'<div style="background:var(--ag);border:1px solid var(--b);border-radius:9px;padding:9px 13px;margin-bottom:12px;font-size:12.5px;color:var(--a)">💡 번호를 붙여넣으세요. 줄바꿈·쉼표·공백 모두 자동 인식합니다.</div>'
    +'<div class="f1" style="margin-bottom:8px"><label>번호 목록</label>'
    +'<textarea id="iq-bulk-text" rows="6" style="font-size:13px;font-family:DM Mono,monospace" placeholder="010-1234-5678&#10;01098765432, 010-1111-2222"></textarea></div>'
    +'<div id="iq-bulk-preview" style="font-size:12.5px;color:var(--tm);min-height:18px;padding:4px 0"></div>'
    +'</div>'
    +'</div>'
    +'<div class="mf" id="iq-footer">'
    +'<button class="btn bg2" onclick="document.getElementById(\'mAddInquiry\').remove()">취소</button>'
    +'<button class="btn bp" id="iq-save-btn" onclick="saveInquiry()">저장</button>'
    +'</div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
  setTimeout(function(){var el=document.getElementById('iq-ph');if(el)el.focus();},100);
  setTimeout(function(){
    var ta=document.getElementById('iq-bulk-text');
    if(ta)ta.addEventListener('input',function(){
      var nums=parsePhoneNumbers(ta.value);
      var p=document.getElementById('iq-bulk-preview');
      if(p){
        p.innerHTML=nums.length
          ?'<span style="color:var(--g);font-weight:700">✓ '+nums.length+'개 인식됨:</span> <span style="font-family:DM Mono,monospace;font-size:11.5px;color:var(--ts)">'+nums.slice(0,5).join(', ')+(nums.length>5?' ...외 '+(nums.length-5)+'개':'')+'</span>'
          :'<span style="color:var(--tm)">번호를 입력하면 자동 인식됩니다</span>';
      }
    });
  },200);
}

function switchIqTab(tab){
  var one=document.getElementById('iq-one');
  var bulk=document.getElementById('iq-bulk');
  var t1=document.getElementById('iq-tab-one');
  var t2=document.getElementById('iq-tab-bulk');
  var saveBtn=document.getElementById('iq-save-btn');
  if(!one||!bulk||!t1||!t2) return;
  var isOne=tab==='one';
  one.style.display=isOne?'':'none';
  bulk.style.display=isOne?'none':'';
  t1.style.background=isOne?'var(--a)':'transparent';
  t1.style.color=isOne?'#08080d':'var(--tm)';
  t2.style.background=isOne?'transparent':'var(--a)';
  t2.style.color=isOne?'var(--tm)':'#08080d';
  if(saveBtn)saveBtn.onclick=isOne?saveInquiry:saveBulkInquiry;
  if(saveBtn)saveBtn.textContent=isOne?'저장':'일괄 등록';
}

function saveInquiry(){
  var nm=(document.getElementById('iq-nm')||{value:''}).value.trim();
  var ph=(document.getElementById('iq-ph')||{value:''}).value.trim();
  var memo=(document.getElementById('iq-memo')||{value:''}).value.trim();
  if(!ph){toast('연락처를 입력해주세요','⚠️');return;}
  var displayName=nm||ph; /* 이름 없으면 번호로 표시 */
  inquiries.unshift({id:uid(),name:displayName,phone:ph,memo:memo,date:toDS(new Date())});
  saveAll();
  var m=document.getElementById('mAddInquiry');if(m)m.remove();
  toast('문의자 추가됨 ❓');
  if(page==='consult') render();
}

function deleteInquiry(qid){
  vsConfirm({msg:'문의자 삭제',okLabel:'삭제',danger:true,
    onOk:function(){
      inquiries=inquiries.filter(function(q){return q.id!==qid;});
      saveAll();toast('삭제됨');if(page==='consult')render();
    }
  });
}

/* ── 문의자 초기 데이터 자동 주입 (최초 1회) ── */
function _injectInitialInquiries(){
  if(localStorage.getItem('vsC_iq_injected_v2')) return; /* 이미 주입됨 */
  var initData = [{"phone": "010-4833-7394", "memo": "문의"}, {"phone": "010-3517-0987", "memo": "문의"}, {"phone": "010-9291-7146", "memo": "문의"}, {"phone": "010-7914-6111", "memo": "문의"}, {"phone": "010-5531-4695", "memo": "문의"}, {"phone": "010-8701-3474", "memo": "문의"}, {"phone": "010-8977-9215", "memo": "문의"}, {"phone": "010-5792-5168", "memo": "문의"}, {"phone": "010-3915-8221", "memo": "문의"}, {"phone": "010-4075-8990", "memo": "문의"}, {"phone": "010-4581-7302", "memo": "문의"}, {"phone": "010-9111-9053", "memo": "문의"}, {"phone": "010-2415-7302", "memo": "문의"}, {"phone": "010-4063-2945", "memo": "문의"}, {"phone": "010-3913-2708", "memo": "문의"}, {"phone": "010-5188-4486", "memo": "문의"}, {"phone": "010-7744-7770", "memo": "문의"}, {"phone": "010-4100-0804", "memo": "문의"}, {"phone": "010-2344-5305", "memo": "문의"}, {"phone": "010-3974-5810", "memo": "문의"}, {"phone": "010-3090-9659", "memo": "문의"}, {"phone": "010-7207-8858", "memo": "문의"}, {"phone": "010-7114-0660", "memo": "문의"}, {"phone": "010-9327-3735", "memo": "문의"}, {"phone": "010-8944-9999", "memo": "문의"}, {"phone": "010-4254-4422", "memo": "문의"}, {"phone": "010-8956-2064", "memo": "문의"}, {"phone": "010-9045-4291", "memo": "문의"}, {"phone": "010-7791-6224", "memo": "문의"}, {"phone": "010-3617-3910", "memo": "문의"}, {"phone": "010-4826-3062", "memo": "문의"}, {"phone": "010-7246-7930", "memo": "문의"}, {"phone": "010-9091-0880", "memo": "문의"}, {"phone": "010-6642-9539", "memo": "문의"}, {"phone": "010-4860-1820", "memo": "문의"}, {"phone": "010-7549-6765", "memo": "문의"}, {"phone": "010-6676-7425", "memo": "문의"}, {"phone": "010-7134-7688", "memo": "문의"}, {"phone": "010-7321-3936", "memo": "문의"}, {"phone": "010-9245-7787", "memo": "문의"}, {"phone": "010-4517-1488", "memo": "문의"}, {"phone": "010-5117-8586", "memo": "문의"}, {"phone": "010-3534-1922", "memo": "문의"}, {"phone": "010-2244-4823", "memo": "문의"}, {"phone": "010-4219-3688", "memo": "문의"}, {"phone": "010-7454-5245", "memo": "문의"}, {"phone": "010-2418-2533", "memo": "문의"}, {"phone": "010-9404-7496", "memo": "문의"}, {"phone": "010-3361-1896", "memo": "문의"}, {"phone": "010-5599-7272", "memo": "문의"}, {"phone": "010-4129-4786", "memo": "문의"}, {"phone": "010-4309-6665", "memo": "문의"}, {"phone": "010-2297-8600", "memo": "문의"}, {"phone": "010-7791-1606", "memo": "문의"}, {"phone": "010-3364-8561", "memo": "문의"}, {"phone": "010-8664-5520", "memo": "문의"}, {"phone": "010-7227-1444", "memo": "문의"}, {"phone": "010-7317-8404", "memo": "문의"}, {"phone": "010-5402-7858", "memo": "문의"}, {"phone": "010-6699-8714", "memo": "문의"}, {"phone": "010-2381-2750", "memo": "문의"}, {"phone": "010-5649-0357", "memo": "문의"}, {"phone": "010-7247-3032", "memo": "문의"}, {"phone": "010-5962-1001", "memo": "문의"}, {"phone": "010-9000-6616", "memo": "문의"}, {"phone": "010-5129-1830", "memo": "문의"}, {"phone": "010-2450-1811", "memo": "문의"}, {"phone": "010-4920-5225", "memo": "문의"}, {"phone": "010-8858-7392", "memo": "문의"}, {"phone": "010-3590-8823", "memo": "문의"}, {"phone": "010-9625-0424", "memo": "문의"}, {"phone": "010-2627-4176", "memo": "문의"}, {"phone": "010-9008-1015", "memo": "문의"}, {"phone": "010-2766-7183", "memo": "문의"}, {"phone": "010-2992-2875", "memo": "문의"}, {"phone": "010-6835-9317", "memo": "문의"}, {"phone": "010-3320-6006", "memo": "문의"}, {"phone": "010-7441-9035", "memo": "문의"}, {"phone": "010-2114-7987", "memo": "문의"}, {"phone": "010-8385-3514", "memo": "문의"}, {"phone": "010-3696-9605", "memo": "문의"}, {"phone": "010-2102-9501", "memo": "문의"}, {"phone": "010-3665-6858", "memo": "문의"}, {"phone": "010-9988-2576", "memo": "문의"}, {"phone": "010-3256-8220", "memo": "문의"}, {"phone": "010-3477-0131", "memo": "문의"}, {"phone": "010-3688-3474", "memo": "문의"}, {"phone": "010-9950-5636", "memo": "문의"}, {"phone": "010-4866-7997", "memo": "문의"}, {"phone": "010-7453-4114", "memo": "문의"}, {"phone": "010-6803-5987", "memo": "문의"}, {"phone": "010-4005-8451", "memo": "문의"}, {"phone": "010-3564-1141", "memo": "문의"}, {"phone": "010-7133-0354", "memo": "문의"}, {"phone": "010-6361-1256", "memo": "문의"}, {"phone": "010-2374-5550", "memo": "문의"}, {"phone": "010-2958-8602", "memo": "문의"}, {"phone": "010-5618-7865", "memo": "문의"}, {"phone": "010-5885-2008", "memo": "문의"}, {"phone": "010-7373-9185", "memo": "문의"}, {"phone": "010-9789-4770", "memo": "문의"}, {"phone": "010-6398-2402", "memo": "문의"}, {"phone": "010-9617-5002", "memo": "문의"}, {"phone": "010-6628-5531", "memo": "문의"}, {"phone": "010-2912-2532", "memo": "문의"}, {"phone": "010-9152-2274", "memo": "문의"}, {"phone": "010-6307-6868", "memo": "문의"}, {"phone": "010-6420-4272", "memo": "문의"}, {"phone": "010-5699-6262", "memo": "문의"}, {"phone": "010-7595-2022", "memo": "문의"}, {"phone": "010-9515-1601", "memo": "문의"}, {"phone": "010-2301-1341", "memo": "문의"}, {"phone": "010-4994-6877", "memo": "문의"}, {"phone": "010-4816-4678", "memo": "문의 정육점"}, {"phone": "010-3412-9751", "memo": "문의 초5"}, {"phone": "010-8970-2811", "memo": "문화원 특강 초5김다혜"}, {"phone": "010-9901-6427", "memo": "방문상담화6시"}, {"phone": "010-5553-9080", "memo": "고딩문의"}, {"phone": "010-6881-1211", "memo": "그룹문의"}, {"phone": "010-7408-7830", "memo": "그룹문의"}, {"phone": "010-3425-4326", "memo": "당근문의"}, {"phone": "010-4487-7250", "memo": "성우문의"}, {"phone": "010-6540-1104", "memo": "음치문의"}, {"phone": "010-2426-6155", "memo": "축가문의"}, {"phone": "010-5273-0419", "memo": "축가문의"}, {"phone": "010-5602-6612", "memo": "축가문의"}, {"phone": "010-9067-1444", "memo": "축가문의"}, {"phone": "010-8980-2421", "memo": "축가문의"}, {"phone": "010-9115-1058", "memo": "축가문의 수업 11월1 토 11시"}, {"phone": "010-2713-3845", "memo": "10살문의 토5시상담"}, {"phone": "010-9061-1338", "memo": "2시방문상담"}, {"phone": "010-9338-5969", "memo": "3시방문상담"}, {"phone": "010-7646-6618", "memo": "5시방문상담"}, {"phone": "010-2557-1222", "memo": "9시방문상담"}, {"phone": "010-2555-7518", "memo": "고입시문의"}, {"phone": "010-8646-5772", "memo": "세시방문상담"}, {"phone": "010-5900-9753", "memo": "중3 문의"}, {"phone": "010-9049-8057", "memo": "초등생문의"}, {"phone": "010-9402-4733", "memo": "초등생문의"}, {"phone": "010-7450-8122", "memo": "태안 문의"}, {"phone": "010-9008-1520", "memo": "22살딸문의"}, {"phone": "010-6632-3376", "memo": "2시반방문상담"}, {"phone": "010-5083-3358", "memo": "4명그룹문의"}, {"phone": "010-4522-7583", "memo": "8시 방문상담 화"}, {"phone": "010-5698-1266", "memo": "개인레슨문의현수막보고"}, {"phone": "010-9612-4133", "memo": "그룹레슨문의"}, {"phone": "010-4900-4515", "memo": "금5시방문상담"}, {"phone": "010-5409-8311", "memo": "대학생 문의"}, {"phone": "010-8355-8184", "memo": "중학생 문의"}, {"phone": "010-3643-2083", "memo": "초5여 문의"}, {"phone": "010-4126-4410", "memo": "토4시방문상담"}, {"phone": "010-8283-1547", "memo": "토4시방문상담"}, {"phone": "010-9819-8954", "memo": "화3시방문"}, {"phone": "010-6682-7774", "memo": "화9시방문상담"}, {"phone": "010-9412-7850", "memo": "그룹레슨 문의"}, {"phone": "010-5438-6627", "memo": "원포인트 문의"}, {"phone": "010-7510-2013", "memo": "초4 여 문의"}, {"phone": "010-9274-6959", "memo": "토11시방문상담"}, {"phone": "010-3251-1528", "memo": "28금1시방문상담"}, {"phone": "010-5458-0256", "memo": "중1 여학생문의"}, {"phone": "010-7399-0401", "memo": "커플그룹레슨문의"}, {"phone": "010-9293-2847", "memo": "토 5시 방문상담"}, {"phone": "010-9206-1104", "memo": "토10시 방문상담"}, {"phone": "010-9954-2688", "memo": "5시15분 방문상담"}, {"phone": "010-2008-9609", "memo": "금요일12시방문상담초6"}, {"phone": "010-6427-1117", "memo": "토 12시 방문상담"}, {"phone": "010-6674-4714", "memo": "토11시상담방문"}, {"phone": "010-8623-6183", "memo": "화요일6시 방문상담"}, {"phone": "010-2077-2168", "memo": "목요일 2시 방문상담"}, {"phone": "010-7653-9351", "memo": "수요일 6시 방문상담"}, {"phone": "010-2238-5873", "memo": "화요일 9시 방문상담"}, {"phone": "010-4796-4313", "memo": "금요일 9시 그룹문의"}, {"phone": "010-3666-5903", "memo": "녹음. 레슨 상담문의"}, {"phone": "010-8954-2208", "memo": "화요일 11시 방문상담"}, {"phone": "010-3764-5511", "memo": "9월24일 4시20분 방문상담"}];
  var existing = inquiries||[];
  var existPhones = existing.map(function(q){return q.phone;});
  var today = toDS(new Date());
  var added = 0;
  initData.forEach(function(d){
    if(existPhones.indexOf(d.phone) < 0){
      existing.unshift({id:uid(),name:d.phone,phone:d.phone,memo:d.memo||'',date:today});
      added++;
    }
  });
  inquiries = existing;
  saveAll();
  localStorage.setItem('vsC_iq_injected_v2','1');
  if(added>0){
    toast(added+'명 문의자 자동 등록됨 📞');
    /* Firebase에도 즉시 동기화 */
    try{
      var db2=firebase.firestore();
      var ref2=db2.collection('studio').doc('data');
      ref2.set({inquiries:inquiries},{merge:true});
    }catch(e){console.log('Firebase inquiry sync error:',e);}
  }
}

function buildConsultList(){
  var o='<div class="sh"><div class="st2">신규 상담 <span style="font-size:16px;color:var(--tm);font-weight:400">('+consults.length+'건)</span></div>';
  if(consults.length){
    o+='<button class="btn bm bsm" onclick="showBulkSMS()">📱 전체 문자</button>';
  }
  o+='</div>';
  if(!consults.length)return o+'<div class="empty"><div class="ei">📋</div><div class="et">상담 신청서가 없습니다</div><div class="ed">상단 버튼으로 신규 상담을 작성해보세요</div></div>';
  var pending=consults.filter(function(c){return !c.converted;});
  var converted=consults.filter(function(c){return c.converted;});

  function consultCard(c){
    var ageStr=(function(a){
      if(!a)return '';
      var raw=String(a).trim(),n=parseInt(raw)||0;
      var yr=raw.length<=2&&n>=0?(n>=30?1900+n:2000+n):n;
      var ty=new Date().getFullYear();
      return (yr>=1920&&yr<=ty)?'만 '+(ty-yr)+'세':'';
    })(c.age);
    var clsBadge=c.cls?'<span class="bdg bg-a" style="font-size:10px">'+clsL(c.cls)+'</span>':'';
    var statusBadge=c.converted
      ?'<span class="bdg bg-g" style="font-size:10.5px">✓ 등록완료</span>'
      :'<span class="bdg bg-a" style="font-size:10.5px">대기중</span>';
    var _cPhoto=getConsultPhoto(c);
    var avatarHtml=_cPhoto
      ?'<img src="'+_cPhoto+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      :'<span style="font-size:17px;font-weight:700;color:var(--a)">'+esc((c.name&&c.name.slice(0,1))||'?')+'</span>';

    var r='<div style="background:var(--s1);border:1px solid var(--b);border-radius:14px;padding:14px 16px;display:flex;align-items:flex-start;gap:13px;cursor:pointer;transition:border-color .14s;position:relative"';
    r+=' data-cid="'+c.id+'" onclick="openConsultById(this.dataset.cid)"';
    r+=' onmouseenter="this.style.borderColor=\'rgba(200,169,110,.28)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'">';

    /* 아바타 */
    r+='<div style="width:46px;height:46px;border-radius:50%;background:var(--ag);border:1px solid var(--b2);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">'+avatarHtml+'</div>';

    /* 정보 */
    r+='<div style="flex:1;min-width:0">';
    r+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px">';
    r+='<span style="font-size:15px;font-weight:700;color:var(--t)">'+esc(c.name||'이름 없음')+'</span>';
    r+=statusBadge;
    r+=clsBadge;
    r+='</div>';
    r+='<div style="font-size:12px;color:var(--tm);display:flex;gap:10px;flex-wrap:wrap">';
    if(ageStr)r+='<span>'+ageStr+'</span>';
    if(c.phone)r+='<span style="font-family:DM Mono,monospace">'+esc(c.phone)+'</span>';
    if(c.date)r+='<span>접수 '+esc(c.date)+'</span>';
    if(c.ref)r+='<span style="color:var(--ts)">유입: '+esc(c.ref)+(c.refDetail?' ('+esc(c.refDetail)+')':'')+'</span>';
    r+='</div>';
    r+='</div>';

    /* 우측 액션 */
    r+='<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;align-items:flex-end">';
    r+='<button class="btn bsm" style="font-size:11px;background:rgba(200,169,110,.1);color:var(--a);border:1px solid var(--b2)" data-cid="'+c.id+'" onclick="event.stopPropagation();showConsultForm(this.dataset.cid)">✏️ 수정</button>';
    if(c.phone){
      r+='<a href="tel:'+esc(c.phone)+'" onclick="event.stopPropagation()" class="btn bsm" style="font-size:11px;background:rgba(109,200,162,.09);color:var(--g);border:1px solid rgba(109,200,162,.18);text-decoration:none">📞</a>';
    }
    r+='</div>';
    r+='</div>';
    return r;
  }

  if(pending.length){
    o+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
    o+='<span style="font-size:10px;letter-spacing:.14em;color:var(--tm);text-transform:uppercase;font-weight:600">⏳ 대기 중</span>';
    o+='<span class="bdg bg-a" style="font-size:10px">'+pending.length+'명</span>';
    o+='</div>';
    o+='<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px">';
    pending.forEach(function(c){o+=consultCard(c);});
    o+='</div>';
  }
  if(converted.length){
    o+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
    o+='<span style="font-size:10px;letter-spacing:.14em;color:var(--g);text-transform:uppercase;font-weight:600">✓ 등록 완료</span>';
    o+='<span class="bdg bg-g" style="font-size:10px">'+converted.length+'명</span>';
    o+='</div>';
    o+='<div style="display:flex;flex-direction:column;gap:7px;opacity:.6">';
    converted.forEach(function(c){o+=consultCard(c);});
    o+='</div>';
  }
  return o;
}
function delConsultFromProfile(id){
  var c=consults.find(function(x){return x.id===id;});
  vsConfirm({
    msg:(c?esc(c.name)+' ':'')+'상담 삭제',
    sub:'상담 신청서가 삭제됩니다.',okLabel:'삭제',danger:true,
    onOk:function(){
      consults=consults.filter(function(c){return c.id!==id;});
      saveAll();cm('mProfile');toast('삭제됨','🗑');render();
    }
  });
}
function convertFromProfile(id){
  var c=consults.find(function(x){return x.id===id;});if(!c)return;
  var existing=students.find(function(s){return s.consultData&&s.consultData.id===id;});
  if(existing){
    vsConfirm({
      msg:esc(c.name)+'님 이미 등록됨',
      sub:'레슨생으로 이미 등록되어 있습니다.<br>정보를 수정하시겠습니까?',
      okLabel:'수정하기',
      onOk:function(){
        pendingConvertId=null;editSid=existing.id;
        cm('mProfile');openSModal(existing.id);
      }
    });
    return;
  }
  pendingConvertId=id;editSid=null;
  ge('mST').textContent='레슨생 등록';
  ge('s-nm').value=c.name||'';ge('s-cls').value=c.cls||'pro';ge('s-gd').value=c.gd||'여성';
  /* age 출생연도로 통일 */
  var _cAge=c.age?String(c.age).trim():'';
  var _cN=parseInt(_cAge)||0;
  var _cYr=_cAge.length<=2&&_cN>=0?(_cN>=30?1900+_cN:2000+_cN):_cN;
  ge('s-age').value=_cYr||c.age||'';
  if(ge('s-age').value) setTimeout(function(){updateAge(ge('s-age'));},50);
  ge('s-ph').value=c.phone||'';
  /* 레슨 시작일: 신청서 firstDate가 있으면 그걸 사용, 없으면 오늘 */
  var startDate=c.firstDate||toDS(new Date());
  ge('s-st').value=startDate;
  ge('s-memo').value=[c.why,c.goalS,c.goalL,c.memo].filter(Boolean).join(' / ');
  ge('s-stat').value='수강중';ge('s-fee').value='';
  setSType(c.schedPref==='flex'?'flex':'fixed');setFreq(c.freq2?2:1);
  var validDays=(c.days||[]).filter(function(d){return WORK.indexOf(d)>=0;});
  document.querySelectorAll('#s-dpick .dpb').forEach(function(b){
    b.classList.toggle('on',validDays.indexOf(b.textContent)>=0);
  });
  /* 희망 시간대 파싱해서 시간 슬롯 미리 채우기 */
  var prefilledTimes={};
  if(c.time){
    var tm=c.time.match(/(\d{1,2})[시:]/);
    if(tm){
      var hh=parseInt(tm[1]);
      var slotTime=(hh>=10&&hh<=21)?(String(hh).padStart(2,'0')+':00'):'10:00';
      validDays.forEach(function(d){prefilledTimes[d]=slotTime;});
    }
  }
  /* 임시로 prefilledTimes를 전달 */
  window._prefilledTimes=prefilledTimes;
  var pv=ge('s-photo-preview'),pd=ge('s-photo-data');
  var _cPhoto=getConsultPhoto(c)||c.photo||'';
  if(_cPhoto){pd.value=_cPhoto;pv.innerHTML='<img src="'+_cPhoto+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">';}else{pd.value='';pv.innerHTML='<div class="no-ph">📷</div>';}
  ge('sBtnDel').style.display='none';updateTimeSlots(null);om('mS');
}


/* CONSULT FORM */


function calcFee(){
  var cls=ge('calc-cls')?ge('calc-cls').value:'pro';
  var freq=ge('calc-freq')?parseInt(ge('calc-freq').value):1;
  var months=ge('calc-months')?parseInt(ge('calc-months').value):1;
  var base=FEE_TABLE[cls][freq]||0;
  var discount=0;
  var discNote='';
  if(cls==='pro'&&months>=6){discount=0.10;discNote=' (6개월 일괄 10% 할인)';}
  else if(cls==='pro'&&months>=3){discount=0.05;discNote=' (3개월 일괄 5% 할인)';}
  else if(cls==='hob'&&months>=3){discount=0.05;discNote=' (3개월 일괄 5% 할인)';}
  else if(cls==='chuk'&&months>=3){discount=0.05;discNote=' (3개월 일괄 5% 할인)';}
  else if(cls==='voice'&&months>=3){discount=0.05;discNote=' (3개월 일괄 5% 할인)';}
  var total=base*months;
  var discAmt=Math.round(total*discount);
  var final=total-discAmt;
  var el=ge('calc-result');
  if(!el)return;
  if(discount>0){
    el.innerHTML=months+'개월 기준: <span style="text-decoration:line-through;color:var(--tm);font-weight:400">'+won(total)+'</span> → <span style="color:var(--g)">'+won(final)+'</span>'+discNote+'<br><span style="font-size:12px;color:var(--tm)">월 '+won(base)+' × '+months+'개월 — 할인 '+won(discAmt)+'</span>';
  } else {
    el.innerHTML=months+'개월 기준: <span style="color:var(--a)">'+won(final)+'</span><br><span style="font-size:12px;color:var(--tm)">월 '+won(base)+' × '+months+'개월</span>';
  }
}
function ciSetSched(el,val){
  el.parentElement.querySelectorAll('.ro').forEach(function(r){r.classList.remove('on');});
  el.classList.add('on'); ge('ci-sched-pref').value=val;
}
function ciUpdateFirstLesson(){
  var d=ge('ci-first-date')?ge('ci-first-date').value:'';
  var t=ge('ci-time')?ge('ci-time').value:'';
  if(ge('ci-when'))ge('ci-when').value=d+(t?' '+t:'');
  var disp=ge('ci-first-lesson-display');
  if(!disp)return;
  if(!d){disp.style.display='none';return;}
  var dateObj=new Date(d+'T12:00:00');
  var days=['일','월','화','수','목','금','토'];
  var dayName=days[dateObj.getDay()];
  var txt='📅 첫 수업: '+d.replace(/-/g,'년 ').replace(/-/g,'월 ')+'일 ('+dayName+')';
  if(t)txt+=' '+t;
  var mon=getMon(dateObj);
  var sched=getWeekSched(mon);
  var conflict='';
  if(t&&dayName){
    var slts=sched[dayName+'_'+t]||[];
    if(slts.length){conflict='<div style="color:var(--r);font-size:12.5px;margin-top:4px">⚠️ 이 시간에 이미 '+slts.map(function(x){return x.s.name;}).join(', ')+'님 수업이 있습니다</div>';}
    else{conflict='<div style="color:var(--g);font-size:12.5px;margin-top:4px">✓ 해당 시간 수업 없음</div>';}
  }
  disp.style.display='block';
  disp.innerHTML=txt+conflict;
}
function rSel(el,hid,val){
  el.parentElement.querySelectorAll('.ro').forEach(function(o){o.classList.remove('on');});
  el.classList.add('on');
  var h=ge(hid);if(h)h.value=val;
  /* 흡연 선택 시 개비수 입력 표시 */
  if(hid==='ci-smoke'){
    var sd=ge('ci-smoke-detail');
    if(sd)sd.style.display=(val==='흡연'||val==='금연 중')?'block':'none';
    if(val==='금연 중'){var sa=ge('ci-smoke-amount');if(sa)sa.placeholder='하루 몇 개비였나요? (금연 전 흡연량)';}
    else if(val==='흡연'){var sa2=ge('ci-smoke-amount');if(sa2)sa2.placeholder='하루 몇 개비? (예: 하루 반 갑, 10개비 등)';}
  }
  /* 음주 선택 시 상세 입력 표시 */
  if(hid==='ci-drink'){
    var dd=ge('ci-drink-detail');
    if(dd)dd.style.display=(val==='가끔'||val==='자주')?'block':'none';
  }
}
function rSelRef(el,val){
  document.querySelectorAll('#ci-ref-group .ro').forEach(function(o){o.classList.remove('on');});
  el.classList.add('on');ge('ci-ref').value=val;
  var dw=ge('ci-ref-detail-wrap');var dl=ge('ci-ref-detail');
  if(val==='지인 소개'){dw.style.display='block';dl.placeholder='지인 이름을 입력해 주세요';}
  else if(val==='현수막'){dw.style.display='block';dl.placeholder='현수막을 어디서 보셨나요? (예: OO역 근처, OO아파트 단지 등)';}
  else if(val==='기타'){dw.style.display='block';dl.placeholder='경로를 직접 입력해 주세요';}
  else dw.style.display='none';
}
function ciSetFreq(el,n){
  el.parentElement.querySelectorAll('.ro').forEach(function(r){r.classList.remove('on');});
  el.classList.add('on');ge('ci-freq').value=n;
  var t2=ge('ci-time2-wrap');
  if(t2)t2.style.display=(v===2||v==='2')?'block':'none';
}
function prevAudioCI(input){
  var file=input.files[0];if(!file)return;
  ge('ci-audio-label').textContent=file.name;
  var isV=file.type.startsWith('video');ge('ci-audio-type').value=isV?'video':'audio';
  var r=new FileReader();
  r.onload=function(ev){
    ge('ci-audio-data').value=ev.target.result;
    ge('ci-audio-el').src=ev.target.result;
    ge('ci-audio-player').style.display='block';
  };
  r.readAsDataURL(file);
}
function openCIRec(){openRecording('__ci_consult__','consult-form','before');}

function saveConsultEdit(cid){
  var idx=consults.findIndex(function(x){return x.id===cid;});
  if(idx<0){toast('수정할 항목을 찾을 수 없습니다','⚠️');return;}
  var days=Array.from(document.querySelectorAll('#ci-dpick .dpb.on')).map(function(b){return b.textContent;});
  var genres=Array.from(document.querySelectorAll('.genre-ro.on')).map(function(b){return b.textContent;});
  var old=consults[idx];
  consults[idx]=Object.assign({},old,{
    name:(gv('ci-nm')||old.name).trim(),
    age:gv('ci-age')||old.age,
    phone:gv('ci-ph')||old.phone,
    gd:gv('ci-gd')||old.gd,
    job:gv('ci-job'),why:gv('ci-why'),
    genres:genres,goalS:gv('ci-goal-s'),goalL:gv('ci-goal-l'),
    cls:gv('ci-cls'),days:days,time:gv('ci-time'),
    firstDate:(ge('ci-first-date')&&ge('ci-first-date').value)||old.firstDate||'',
    freq2:gv('ci-freq')==='2',
    when:gv('ci-when'),schedPref:gv('ci-sched-pref'),
    ref:gv('ci-ref'),refDetail:(ge('ci-ref-detail')&&ge('ci-ref-detail').value)||'',
    voice:gv('ci-voice'),vdetail:gv('ci-vdetail'),
    exp:gv('ci-exp'),prevType:gv('ci-prev-type'),prev:gv('ci-prev'),
    smoke:(gv('ci-smoke')+(gv('ci-smoke-amount')?' ('+gv('ci-smoke-amount')+')':'')),drink:(gv('ci-drink')+(gv('ci-drink-amount')?' ('+gv('ci-drink-amount')+')':'')),health:gv('ci-health'),
    memo:gv('ci-memo'),
    confirmedDates:ciGetConfirmedDates()
  });
  saveAll();
  toast('상담 신청서 수정됨 ✅');
  go('consult');
}
function ciAddDateRow(date,time){
  var list=ge('ci-dates-list');if(!list)return;
  var idx=list.children.length;
  var row=document.createElement('div');
  row.className='ci-date-row';
  row.style.cssText='display:flex;align-items:center;gap:4px;background:var(--s1);border:1px solid var(--b);border-radius:8px;padding:5px 8px';
  /* 회차 */
  var lbl=document.createElement('span');
  lbl.className='ci-date-lbl';
  lbl.style.cssText='font-size:10px;font-weight:700;color:var(--a);white-space:nowrap';
  lbl.textContent=(idx+1)+'회';
  row.appendChild(lbl);
  /* hidden inputs */
  var di=document.createElement('input');di.type='hidden';di.className='ci-date-input';di.value=date||'';
  row.appendChild(di);
  var ti=document.createElement('input');ti.type='hidden';ti.className='ci-time-input';ti.value=time||'10:00';
  row.appendChild(ti);
  /* 결과 텍스트 (클릭하면 선택 팝업) */
  var dd=document.createElement('span');
  dd.style.cssText='font-size:12px;color:var(--a);font-weight:700;flex:1;cursor:pointer;padding:3px 6px;border-radius:6px;background:var(--ag);border:1px solid var(--b);min-height:24px;display:flex;align-items:center';
  dd.textContent=date?'':'📅 날짜·시간 선택';
  row.appendChild(dd);
  /* 삭제 */
  var delBtn=document.createElement('button');
  delBtn.type='button';
  delBtn.style.cssText='background:none;border:none;color:var(--r);cursor:pointer;font-size:14px;padding:0 4px;flex-shrink:0';
  delBtn.textContent='✕';
  delBtn.onclick=function(){row.remove();ciRenumberDates();};
  row.appendChild(delBtn);
  /* 표시 업데이트 */
  function updateDisplay(){
    if(di.value){
      var p=di.value.split('-');
      var dn=['일','월','화','수','목','금','토'][new Date(di.value).getDay()];
      dd.textContent=parseInt(p[1])+'/'+parseInt(p[2])+'('+dn+') '+ti.value;
      dd.style.color='var(--a)';
    } else {
      dd.textContent='📅 날짜·시간 선택';
      dd.style.color='var(--tm)';
    }
  }
  /* 클릭 → 미니 캘린더+시간 팝업 */
  dd.onclick=function(){ciOpenDatePicker(di,ti,updateDisplay);};
  if(date)setTimeout(updateDisplay,0);
  list.appendChild(row);
}
/* ── 미니 캘린더+시간 팝업 ── */
function ciOpenDatePicker(dateInput,timeInput,onDone){
  var ex=document.getElementById('ciDatePopup');if(ex)ex.remove();
  var now=new Date();
  var viewYear=dateInput.value?parseInt(dateInput.value.split('-')[0]):now.getFullYear();
  var viewMonth=dateInput.value?parseInt(dateInput.value.split('-')[1])-1:now.getMonth();
  var selDate=dateInput.value||'';
  var selTime=timeInput.value||'10:00';
  var ov=document.createElement('div');
  ov.id='ciDatePopup';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  var box=document.createElement('div');
  box.style.cssText='background:var(--s1);border:1px solid var(--b2);border-radius:14px;padding:16px;max-width:320px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.4)';
  ov.appendChild(box);
  function render(){
    var d=new Date(viewYear,viewMonth,1);
    var startDay=d.getDay();
    var daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    var mn=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    var h='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    h+='<button onclick="this.blur()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--t);padding:4px 8px" id="cdpPrev">‹</button>';
    h+='<span style="font-size:14px;font-weight:700;color:var(--t)">'+viewYear+'년 '+mn[viewMonth]+'</span>';
    h+='<button onclick="this.blur()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--t);padding:4px 8px" id="cdpNext">›</button>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;margin-bottom:8px">';
    ['일','월','화','수','목','금','토'].forEach(function(dn,i){
      h+='<div style="font-size:9px;font-weight:700;color:'+(i===0?'var(--r)':'var(--tm)')+';padding:2px">'+dn+'</div>';
    });
    for(var i=0;i<startDay;i++)h+='<div></div>';
    var todayStr=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    for(var dd=1;dd<=daysInMonth;dd++){
      var ds=viewYear+'-'+String(viewMonth+1).padStart(2,'0')+'-'+String(dd).padStart(2,'0');
      var isToday=ds===todayStr;
      var isSel=ds===selDate;
      var dow=(startDay+dd-1)%7;
      var clr=isSel?'#fff':(isToday?'var(--a)':(dow===0?'var(--r)':'var(--t)'));
      var bg=isSel?'var(--a)':(isToday?'var(--ag)':'transparent');
      h+='<div data-ds="'+ds+'" style="padding:5px 0;border-radius:6px;cursor:pointer;font-size:12px;font-weight:'+(isSel?'700':'500')+';color:'+clr+';background:'+bg+'" class="cdp-day">'+dd+'</div>';
    }
    h+='</div>';
    /* 시간 선택 — 2행 6열 버튼 */
    h+='<div style="font-size:10px;font-weight:700;color:var(--tm);margin-bottom:4px">시간</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin-bottom:10px">';
    for(var t=10;t<=21;t++){
      var ts=('0'+t).slice(-2)+':00';
      var isST=ts===selTime;
      h+='<div data-tm="'+ts+'" style="padding:4px 0;text-align:center;border-radius:5px;cursor:pointer;font-size:11px;font-weight:'+(isST?'700':'500')+';color:'+(isST?'#fff':'var(--ts)')+';background:'+(isST?'var(--a)':'var(--ag)')+';border:1px solid '+(isST?'var(--a)':'var(--b)')+'" class="cdp-tm">'+t+'시</div>';
    }
    h+='</div>';
    h+='<div style="display:flex;gap:8px;justify-content:flex-end">';
    h+='<button id="cdpCancel" style="padding:6px 14px;border-radius:7px;border:1px solid var(--b);background:var(--s2);color:var(--ts);cursor:pointer;font-size:12px;font-family:inherit">취소</button>';
    h+='<button id="cdpOk" style="padding:6px 14px;border-radius:7px;border:none;background:var(--a);color:#fff;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit">확인</button>';
    h+='</div>';
    box.innerHTML=h;
    box.querySelector('#cdpPrev').onclick=function(){viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--;}render();};
    box.querySelector('#cdpNext').onclick=function(){viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}render();};
    box.querySelectorAll('.cdp-day').forEach(function(el){el.onclick=function(){selDate=el.dataset.ds;render();};});
    box.querySelectorAll('.cdp-tm').forEach(function(el){el.onclick=function(){selTime=el.dataset.tm;render();};});
    box.querySelector('#cdpCancel').onclick=function(){ov.remove();};
    box.querySelector('#cdpOk').onclick=function(){
      dateInput.value=selDate;timeInput.value=selTime;
      ov.remove();if(onDone)onDone();
    };
  }
  render();
  document.body.appendChild(ov);
}
function ciRenumberDates(){
  var list=ge('ci-dates-list');if(!list)return;
  Array.from(list.children).forEach(function(row,i){
    var lbl=row.querySelector('.ci-date-lbl');if(lbl)lbl.textContent=(i+1)+'회차';
  });
}
function ciGetConfirmedDates(){
  var list=ge('ci-dates-list');if(!list)return [];
  var result=[];
  Array.from(list.children).forEach(function(row){
    var d=row.querySelector('.ci-date-input');
    var t=row.querySelector('.ci-time-input');
    if(d&&d.value)result.push({date:d.value,time:t?t.value:'10:00'});
  });
  return result;
}

/* ── PC/모바일 뷰 강제 전환 ── */
var _forceView=null; /* null=자동, 'mobile'=강제모바일, 'pc'=강제PC */
function toggleViewMode(){
  if(_forceView==='mobile'){
    _forceView='pc';
    document.body.classList.remove('is-mobile');
    var btn=ge('viewToggleBtn');if(btn){btn.textContent='📱 모바일';btn.title='모바일 화면으로 전환';}
    toast('🖥 PC 화면으로 전환');
  } else {
    _forceView='mobile';
    document.body.classList.add('is-mobile');
    var btn2=ge('viewToggleBtn');if(btn2){btn2.textContent='🖥 PC';btn2.title='PC 화면으로 전환';}
    toast('📱 모바일 화면으로 전환');
  }
  render();
}
/* applyMobileClass 오버라이드 - 강제 모드일 때 자동 감지 무시 */
var _origApplyMobileClass=window.applyMobileClass;
window.applyMobileClass=function(){
  if(_forceView==='mobile'){document.body.classList.add('is-mobile');return;}
  if(_forceView==='pc'){document.body.classList.remove('is-mobile');return;}
  if(window.innerWidth<=768){document.body.classList.add('is-mobile');}
  else{document.body.classList.remove('is-mobile');}
};
/* 초기 버튼 상태 업데이트 */
document.addEventListener('DOMContentLoaded',function(){
  var btn=ge('viewToggleBtn');
  if(btn){
    function _updateViewBtn(){
      var isMob=document.body.classList.contains('is-mobile');
      btn.textContent=isMob?'🖥 PC':'📱 모바일';
      btn.title=isMob?'PC 화면으로 전환':'모바일 화면으로 전환';
    }
    _updateViewBtn();
    window.addEventListener('resize',_updateViewBtn);
  }
});

function evalHandleAudio(input){
  var file=input.files[0];if(!file)return;
  var cid=input.dataset.cid;
  var c=consults.find(function(x){return x.id===cid;});if(!c)return;
  var label='Before '+toDS(new Date());
  var isV=file.type.startsWith('video');
  var r=new FileReader();
  r.onload=function(ev){
    var entryId=uid();
    var mediaKey='vsM_'+entryId;
    var entry={id:entryId,type:'before',mediaType:isV?'video':'audio',label:label,date:toDS(new Date()),data:ev.target.result,_mediaKey:mediaKey};
    mediaSave(mediaKey,ev.target.result);
    if(!c.audios)c.audios=[];
    c.audios.push(entry);
    saveAll();toast('Before 파일 저장됨 🎤');
    showEvalPage(cid);
  };
  r.readAsDataURL(file);
  input.value='';
}

function ciRestoreDraft(){
  var draft=null;
  try{draft=JSON.parse(localStorage.getItem('vsC_draft')||'null');}catch(e){}
  if(!draft)return;
  var sv=function(id,v){var el=ge(id);if(el&&v)el.value=v;};
  sv('ci-nm',draft.name);sv('ci-age',draft.age);sv('ci-ph',draft.ph);
  sv('ci-job',draft.job);sv('ci-why',draft.why);
  sv('ci-goal-s',draft.goalS);sv('ci-goal-l',draft.goalL);
  sv('ci-time',draft.time);sv('ci-when',draft.when);
  sv('ci-vdetail',draft.vdetail);sv('ci-prev',draft.prev);sv('ci-memo',draft.memo);
  if(draft.photo){
    sv('ci-photo-data',draft.photo);
    var pp=ge('ci-photo-preview');
    if(pp)pp.innerHTML='<img src="'+draft.photo+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0" onclick="openLightbox(this.src)">';
  } else if(draft._draftPhotoKey){
    try{
      var _dp=localStorage.getItem(draft._draftPhotoKey);
      if(_dp){
        sv('ci-photo-data',_dp);
        var pp2=ge('ci-photo-preview');
        if(pp2)pp2.innerHTML='<img src="'+_dp+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0" onclick="openLightbox(this.src)">';
      }
    }catch(e){}
  }
  if(draft.gd){sv('ci-gd',draft.gd);document.querySelectorAll('[onclick*="ci-gd"]').forEach(function(el){el.classList.toggle('on',el.textContent===draft.gd);});}
  if(draft.cls){sv('ci-cls',draft.cls);document.querySelectorAll('[onclick*="ci-cls"]').forEach(function(el){el.classList.toggle('on',el.getAttribute('onclick').indexOf("'"+draft.cls+"'")>=0);});}
  if(draft.schedPref){sv('ci-sched-pref',draft.schedPref);document.querySelectorAll('[data-v]').forEach(function(el){el.classList.toggle('on',el.dataset.v===draft.schedPref);});}
  if(draft.freq){sv('ci-freq',draft.freq);document.querySelectorAll('[onclick*="ciSetFreq"]').forEach(function(el){el.classList.toggle('on',el.getAttribute('onclick').indexOf(draft.freq)>=0);});}
  if(draft.ref){sv('ci-ref',draft.ref);document.querySelectorAll('#ci-ref-group .ro').forEach(function(el){if(el.dataset.val===draft.ref){el.classList.add('on');if(draft.ref==='지인 소개'||draft.ref==='기타'){var w=ge('ci-ref-detail-wrap');if(w)w.style.display='block';}}});if(draft.refDetail){sv('ci-ref-detail',draft.refDetail);}}
  if(draft.voice){sv('ci-voice',draft.voice);document.querySelectorAll('[data-hid="ci-voice"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===draft.voice);});}
  if(draft.exp){sv('ci-exp',draft.exp);document.querySelectorAll('[data-hid="ci-exp"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===draft.exp);});}
  if(draft.smoke){sv('ci-smoke',draft.smoke);document.querySelectorAll('[data-hid="ci-smoke"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===draft.smoke);});}
  if(draft.drink){sv('ci-drink',draft.drink);document.querySelectorAll('[data-hid="ci-drink"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===draft.drink);});}
  if(draft.days)draft.days.forEach(function(d){document.querySelectorAll('#ci-dpick .dpb').forEach(function(b){if(b.textContent===d)b.classList.add('on');});});
  if(draft.genres)draft.genres.forEach(function(g){document.querySelectorAll('.genre-ro').forEach(function(b){if(b.textContent===g)b.classList.add('on');});});
  if(draft.age)setTimeout(function(){ciCalcAge({value:draft.age});},100);
  /* 복원 알림 바 제거 */
  var bar=document.querySelector('[onclick="ciRestoreDraft()"]');
  if(bar)bar.closest('div[style*="sticky"]').remove();
  toast('✅ 임시저장 복원 완료');
}
function ciClearDraft(){try{var d=JSON.parse(localStorage.getItem('vsC_draft')||'{}');if(d._draftPhotoKey)localStorage.removeItem(d._draftPhotoKey);}catch(e){}localStorage.removeItem('vsC_draft');}

function ciSaveDraft(){
  try{
    var _photo=gv('ci-photo-data');
    var draft={
      name:gv('ci-nm'),age:gv('ci-age'),ph:gv('ci-ph'),job:gv('ci-job'),
      gd:gv('ci-gd'),why:gv('ci-why'),goalS:gv('ci-goal-s'),goalL:gv('ci-goal-l'),
      cls:gv('ci-cls'),time:gv('ci-time'),when:gv('ci-when'),schedPref:gv('ci-sched-pref'),
      freq:gv('ci-freq'),ref:gv('ci-ref'),
      refDetail:(ge('ci-ref-detail')&&ge('ci-ref-detail').value)||'',
      voice:gv('ci-voice'),vdetail:gv('ci-vdetail'),
      exp:gv('ci-exp'),prevType:gv('ci-prev-type'),prev:gv('ci-prev'),
      smoke:(gv('ci-smoke')+(gv('ci-smoke-amount')?' ('+gv('ci-smoke-amount')+')':'')),drink:(gv('ci-drink')+(gv('ci-drink-amount')?' ('+gv('ci-drink-amount')+')':'')),health:gv('ci-health'),
      memo:gv('ci-memo'),
      photo:'',
      _draftPhotoKey:(function(){
        if(_photo&&_photo.length>100){
          var _dk='vsC_draftPh';
          try{localStorage.setItem(_dk,_photo);}catch(e){return '';}
          return _dk;
        }
        return '';
      })(),
      days:Array.from(document.querySelectorAll('#ci-dpick .dpb.on')||[]).map(function(b){return b.textContent;}),
      genres:Array.from(document.querySelectorAll('.genre-ro.on')).map(function(b){return b.textContent;}),
      savedAt:Date.now()
    };
    localStorage.setItem('vsC_draft',JSON.stringify(draft));
    /* 임시저장 인디케이터 표시 */
    var _ind=ge('ci-draft-ind');
    if(_ind){
      _ind.textContent='임시저장됨 ✓';
      _ind.style.opacity='1';
      setTimeout(function(){if(_ind)_ind.style.opacity='0';},2000);
    }
  }catch(e){}
}
function ciStartAutoSave(){
  /* 폼 내 모든 input/textarea/select 변경 시 3초 후 자동저장 */
  var content=ge('content');
  if(!content)return;
  content.addEventListener('input',function(){
    clearTimeout(_ciDraftTimer);
    _ciDraftTimer=setTimeout(function(){
      if(page==='consult'&&ge('ci-nm'))ciSaveDraft();
    },1500);
  });
  content.addEventListener('change',function(){
    if(page==='consult'&&ge('ci-nm'))ciSaveDraft();
  });
}

function saveConsult(){
  var name=(gv('ci-nm')).trim();if(!name){toast('성함을 입력해주세요','⚠️');return;}
  var days=Array.from(document.querySelectorAll('#ci-dpick .dpb.on')||[]).map(function(b){return b.textContent;});
  var genres=Array.from(document.querySelectorAll('.genre-ro.on')||[]).map(function(b){return b.textContent;});
  var audioData=gv('ci-audio-data'),audioType=gv('ci-audio-type');
  var photoData=gv('ci-photo-data');
  var photoKey='';
  /* 사진은 항상 별도 localStorage 키에 저장 */
  if(photoData&&photoData.length>100){
    photoKey='vsP_'+uid();
    try{localStorage.setItem(photoKey,photoData);}catch(e){photoKey='';toast('사진 용량이 커서 저장이 제한됩니다','⚠️');}
  }
  var data={
    id:uid(),name:name,photo:'',_photoKey:photoKey||'',
    birthYear:gv('ci-age'),age:gv('ci-age')||'' ,gd:gv('ci-gd'),phone:gv('ci-ph'),job:gv('ci-job'),
    ref:gv('ci-ref'),refDetail:(ge('ci-ref-detail')&&ge('ci-ref-detail').value)||'',
    why:gv('ci-why'),genres:genres,goalS:gv('ci-goal-s'),goalL:gv('ci-goal-l'),
    cls:gv('ci-cls'),days:days,time:gv('ci-time'),firstDate:(ge('ci-first-date')&&ge('ci-first-date').value)||'',when:gv('ci-when'),
    schedFixed:gv('ci-sched-fixed'),schedFlex:gv('ci-sched-flex'),flexDays:Array.from(document.querySelectorAll('#ci-flex-dpick .dpb.on')||[]).map(function(b){return b.textContent;}),flexFreq2:gv('ci-flex-freq')==='2',schedTime2:gv('ci-time2'),firstTime:gv('ci-first-time'),schedPref:gv('ci-sched-pref'),freq2:gv('ci-freq')==='2',
    voice:gv('ci-voice'),vdetail:gv('ci-vdetail'),
    exp:gv('ci-exp'),prevType:gv('ci-prev-type'),prev:gv('ci-prev'),
    smoke:(gv('ci-smoke')+(gv('ci-smoke-amount')?' ('+gv('ci-smoke-amount')+')':'')),drink:(gv('ci-drink')+(gv('ci-drink-amount')?' ('+gv('ci-drink-amount')+')':'')),health:gv('ci-health'),
    memo:gv('ci-memo'),
    prob:gv('ci-prob'),
    impr:gv('ci-impr'),
    confirmedDates:ciGetConfirmedDates(),
    audios:audioData&&audioType==='audio'?[{id:uid(),type:'before',mediaType:'audio',label:'상담 전 음성',date:toDS(new Date()),data:audioData}]:[],
    videos:audioData&&audioType==='video'?[{id:uid(),type:'before',mediaType:'video',label:'상담 전 영상',date:toDS(new Date()),data:audioData}]:[],
    date:toDS(new Date()),converted:false
  };
  consults.unshift(data);
  try{saveAll();}catch(e){toast('저장 중 오류가 발생했습니다','❌');return;}
  ciClearDraft();
  toast('상담 신청서 저장됨 📋');
  go('consult');
}


function showEvalSheet(){
  var w=window.open('','_blank','width=820,height=1100');
  if(!w||w.closed){toast('팝업이 차단되었습니다. 주소창 오른쪽 팝업 허용 클릭 후 다시 시도하세요','⚠️');return;}
  var now=new Date();
  var ds=now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일';
  w.document.write(evalHTML(ds));
  w.document.close();
  setTimeout(function(){w.print();},500);
}
function evalHTML(ds){
  var items=['음정 정확도','리듬·박자감','발성 (호흡·지지)','음색·톤','고음역 안정성','발음·딕션','음량 조절','감정 표현','음악성·곡 해석'];
  var evalRows=items.map(function(it){
    return '<tr><td style="padding:7px 8px;font-weight:600;font-size:12px;width:130px;border-bottom:1px solid #eee">'+it+'</td>'
      +'<td style="padding:7px 8px;border-bottom:1px solid #eee">'
      +'<span style="display:inline-flex;gap:5px;vertical-align:middle">'
      +'<span style="width:18px;height:18px;border-radius:50%;border:1.5px solid #bbb;display:inline-block"></span>'
      +'<span style="width:18px;height:18px;border-radius:50%;border:1.5px solid #bbb;display:inline-block"></span>'
      +'<span style="width:18px;height:18px;border-radius:50%;border:1.5px solid #bbb;display:inline-block"></span>'
      +'<span style="width:18px;height:18px;border-radius:50%;border:1.5px solid #bbb;display:inline-block"></span>'
      +'<span style="width:18px;height:18px;border-radius:50%;border:1.5px solid #bbb;display:inline-block"></span>'
      +'</span>'
      +'<span style="font-size:10px;color:#999;margin-left:6px">● 매우 우수 &nbsp;◑ 보통 &nbsp;○ 미흡</span>'
      +'</td>'
      +'<td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:11px;color:#888;width:200px">실시간 피드백: ___________________</td></tr>';
  }).join('');
  var css='*{margin:0;padding:0;box-sizing:border-box;}'
    +'body{font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:24px 32px;max-width:760px;margin:0 auto;}'
    +'h1{font-size:20px;font-weight:900;text-align:center;letter-spacing:.06em;margin-bottom:3px;}'
    +'.sub{text-align:center;font-size:11px;color:#666;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #1a1a1a;}'
    +'.sec{margin-bottom:14px;}.sec-t{font-size:12.5px;font-weight:700;background:#f0f0f0;padding:5px 10px;border-left:4px solid #333;margin-bottom:8px;}'
    +'.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}'
    +'.if{display:flex;flex-direction:column;gap:2px;}.if-l{font-size:10px;color:#888;letter-spacing:.04em;}.if-v{border-bottom:1px solid #bbb;min-height:20px;padding:1px 4px;}'
    +'table{width:100%;border-collapse:collapse;}'
    +'.comment-box{border:1px solid #ccc;border-radius:4px;min-height:56px;padding:6px;font-size:12px;color:#999;}'
    +'.notice{font-size:11.5px;line-height:1.85;}'
    +'.sign-area{display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;gap:16px;}'
    +'.sign-box{text-align:center;flex:1;}.sign-line{border-bottom:1.5px solid #333;height:36px;margin-bottom:4px;}.sign-lbl{font-size:10.5px;color:#555;}'
    +'@page{margin:14mm 16mm;}'
    +'@media print{.no-print{display:none!important;}}';
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>보컬 평가지</title><style>'+css+'</style></head><body>'
    +'<h1>Vocal Studio 보컬 평가지</h1><div class="sub">접수일: '+ds+'</div>'
    +'<div class="sec"><div class="sec-t">기본 정보</div><div class="info-grid">'
    +'<div class="if"><div class="if-l">성함</div><div class="if-v"></div></div>'
    +'<div class="if"><div class="if-l">나이 / 성별</div><div class="if-v"></div></div>'
    +'<div class="if"><div class="if-l">연락처</div><div class="if-v"></div></div>'
    +'<div class="if"><div class="if-l">희망 반 / 횟수</div><div class="if-v"></div></div>'
    +'</div></div>'
    +'<div class="sec"><div class="sec-t">보컬 기초 평가</div><table>'+evalRows+'</table></div>'
    +'<div class="sec"><div class="sec-t">트레이너 코멘트 &amp; 실시간 피드백</div>'
    +'<div contenteditable="true" class="comment-box" id="commentBox">여기에 코멘트를 입력하세요...</div></div>'
    +'<div style="page-break-before:always;padding-top:20px">'
    +'<h1 style="font-size:18px;margin-bottom:12px">개인 레슨 유의사항</h1>'
    +'<div class="notice">'
    +'1. 레슨 시작 5분 전까지 입실 부탁드립니다.<br>'
    +'2. 결석·지각 시 24시간 전 사전 연락 바랍니다 (미연락 결석은 해당 회차 소멸).<br>'
    +'3. 레슨비는 사이클 첫 수업 전까지 납부해 주세요 (주1회: 4회 / 주2회: 8회 기준).<br>'
    +'4. 음주 상태 레슨 불가, 수업 전 흡연·자극적 음식 자제 부탁드립니다.<br>'
    +'5. 성대 이상(통증·출혈·목 쉼 등) 발생 시 즉시 트레이너에게 알려주세요.<br>'
    +'6. 수업 영상·녹음은 개인 연습 목적으로만 사용 가능합니다.<br>'
    +'7. 개인 정보는 수업 운영 외 목적으로 사용하지 않습니다.'
    +'</div>'
    +'<div style="margin-top:16px;padding:10px 14px;background:#fafafa;border:1px solid #ddd;border-radius:4px;font-size:12px;color:#555">'
    +'💡 동의 음성 녹음 안내: 아래 서명란에 서명 후, 구두로 "위 유의사항에 동의합니다"를 말씀해 주시면 됩니다.'
    +'</div>'
    +'<div class="sign-area">'
    +'<div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">트레이너 서명</div></div>'
    +'<div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">수강생 서명 (위 유의사항에 동의합니다)</div></div>'
    +'<div style="text-align:right;font-size:11px;color:#777;flex:0.7">년&nbsp;&nbsp; 월&nbsp;&nbsp; 일</div>'
    +'</div></div>'
    +'<div class="no-print" style="text-align:center;margin-top:20px">'
    +'<button onclick="window.print()" style="padding:10px 28px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit">🖨️ 인쇄 / PDF 저장</button>'
    +'</div>'
    +'</body></html>';
}

function saveAndGoEval(){
  /* 신청서 저장 후 평가지 2페이지로 이동 */
  var name=(gv('ci-nm')).trim();
  if(!name){toast('먼저 성함을 입력해주세요','⚠️');return;}
  /* 신청서 임시 저장 */
  var days=Array.from(document.querySelectorAll('#ci-dpick .dpb.on')||[]).map(function(b){return b.textContent;});
  var genres=Array.from(document.querySelectorAll('.genre-ro.on')||[]).map(function(b){return b.textContent;});
  var audioData=gv('ci-audio-data'),audioType=gv('ci-audio-type');
  var photoData=gv('ci-photo-data');
  var photoKey='';
  if(photoData&&photoData.length>100){
    photoKey='vsP_'+uid();
    try{localStorage.setItem(photoKey,photoData);}catch(e){photoKey='';}
  }
  var cid=uid();
  var tempData={
    id:cid,name:name,photo:'',_photoKey:photoKey||'',
    birthYear:gv('ci-age'),age:gv('ci-age')||'' ,gd:gv('ci-gd'),phone:gv('ci-ph'),job:gv('ci-job'),
    ref:gv('ci-ref'),refDetail:(ge('ci-ref-detail')&&ge('ci-ref-detail').value)||'',
    why:gv('ci-why'),genres:genres,goalS:gv('ci-goal-s'),goalL:gv('ci-goal-l'),
    cls:gv('ci-cls'),days:days,time:gv('ci-time'),
    firstDate:(ge('ci-first-date')&&ge('ci-first-date').value)||'',
    when:gv('ci-when'),schedFixed:gv('ci-sched-fixed'),schedFlex:gv('ci-sched-flex'),flexDays:Array.from(document.querySelectorAll('#ci-flex-dpick .dpb.on')||[]).map(function(b){return b.textContent;}),flexFreq2:gv('ci-flex-freq')==='2',schedTime2:gv('ci-time2'),firstTime:gv('ci-first-time'),schedPref:gv('ci-sched-pref'),freq2:gv('ci-freq')==='2',
    voice:gv('ci-voice'),vdetail:gv('ci-vdetail'),
    exp:gv('ci-exp'),prevType:gv('ci-prev-type'),prev:gv('ci-prev'),
    smoke:(gv('ci-smoke')+(gv('ci-smoke-amount')?' ('+gv('ci-smoke-amount')+')':'')),drink:(gv('ci-drink')+(gv('ci-drink-amount')?' ('+gv('ci-drink-amount')+')':'')),health:gv('ci-health'),
    memo:gv('ci-memo'),prob:'',impr:'',
    confirmedDates:ciGetConfirmedDates(),
    audios:audioData&&audioType==='audio'?[{id:uid(),type:'before',mediaType:'audio',label:'상담 전 음성',date:toDS(new Date()),data:audioData}]:[],
    videos:audioData&&audioType==='video'?[{id:uid(),type:'before',mediaType:'video',label:'상담 전 영상',date:toDS(new Date()),data:audioData}]:[],
    date:toDS(new Date()),converted:false
  };
  /* 기존 신청서 있으면 업데이트, 없으면 추가 */
  var existIdx=consults.findIndex(function(c){return c.name===name&&c.date===toDS(new Date());});
  if(existIdx>=0){tempData.id=consults[existIdx].id;consults[existIdx]=tempData;}
  else consults.unshift(tempData);
  saveAll();
  /* 평가지 먼저 표시 */
  showEvalPage(tempData.id);
  /* Firebase 동기화는 2초 후 - 화면 덮어쓰기 완전 방지 */
  _skipRenderCount=99;
  setTimeout(function(){
    if(typeof _pushToFirestore==='function'&&_fbReady){
      try{_pushToFirestore(window._fbDocRef);}catch(e){}
    }
    /* 2초 후 카운터 해제 */
    setTimeout(function(){_skipRenderCount=0;},2000);
  },500);
}


function showEvalPage(cid){
  var c=consults.find(function(x){return x.id===cid;});
  if(!c)return;
  try{localStorage.setItem('vsC_evalCid',cid);}catch(e){}
  page='eval';

  var beforeAudios=(c.audios||[]).filter(function(a){return a.type==='before';});

  var o='<div style="max-width:780px;margin:0 auto;padding-bottom:30px">';

  /* ── 헤더 ── */
  o+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">';
  o+='<div>';
  o+='<div style="font-size:10px;letter-spacing:.18em;color:var(--a);text-transform:uppercase;font-weight:600;margin-bottom:5px">TRAINER EVALUATION</div>';
  o+='<div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:900;color:var(--t)">'+esc(c.name)+'<span style="font-size:14px;color:var(--tm);font-weight:400;margin-left:10px;font-family:DM Sans,sans-serif">평가지</span></div>';
  o+='<div style="font-size:12px;color:var(--tm);margin-top:3px">접수 '+esc(c.date||'')+'</div>';
  o+='</div>';
  o+='<div style="display:flex;gap:8px;flex-wrap:wrap">';
  o+='<button class="btn bg2 bsm" onclick="goConsult()">← 목록</button>';
  o+='<button class="btn bp bsm" data-cid="'+cid+'" onclick="printEvalSheet(this.dataset.cid)">🖨️ 인쇄</button>';
  o+='</div></div>';

  /* ── Before 녹음 ── */
  o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:14px;overflow:hidden;margin-bottom:14px">';
  o+='<div style="padding:14px 18px;border-bottom:1px solid var(--b);display:flex;align-items:center;gap:10px">';
  o+='<span style="font-size:16px">🎤</span>';
  o+='<div>';
  o+='<div style="font-size:14px;font-weight:700;color:var(--t)">수강생 Before 녹음</div>';
  if(beforeAudios.length){
    o+='<div style="font-size:11.5px;color:var(--g);margin-top:1px">✓ '+beforeAudios.length+'건 녹음됨</div>';
  } else {
    o+='<div style="font-size:12px;color:var(--tm);margin-top:1px">현재 음성을 녹음하거나 파일을 업로드하세요</div>';
  }
  o+='</div></div>';
  o+='<div style="padding:14px 18px">';
  if(beforeAudios.length){
    beforeAudios.forEach(function(a){
      var isSaved=(a.data==='[saved]'||!a.data);
      var hasKey=!!(a._mediaKey);
      var pid='eval_player_'+a.id;
      o+='<div style="background:rgba(255,255,255,.03);border:1px solid var(--b);border-radius:9px;padding:10px 14px;margin-bottom:8px">';
      o+='<div style="font-size:11.5px;font-weight:600;color:var(--a);margin-bottom:6px">'+esc(a.label||a.date)+'</div>';
      if(!isSaved){
        o+='<audio controls src="'+a.data+'" style="width:100%;height:36px"></audio>';
      } else if(hasKey){
        o+='<div id="'+pid+'" style="text-align:center;padding:6px;color:var(--tm);font-size:12px">🎙 불러오는 중...</div>';
        setTimeout((function(_pid,_key){return function(){
          mediaLoad(_key,function(data){
            var el=document.getElementById(_pid);
            if(!el)return;
            if(data){el.innerHTML='<audio controls src="'+data+'" style="width:100%;height:36px"></audio>';}
            else{el.innerHTML='<div style="color:var(--tm);font-size:12px">🎙 Downloads 폴더에서 확인하세요</div>';}
          });
        };})(pid,a._mediaKey),100);
      } else {
        o+='<div style="text-align:center;padding:6px;color:var(--tm);font-size:12px">🎙 Downloads 폴더에서 확인하세요</div>';
      }
      o+='</div>';
    });
  } else {
    o+='<div style="text-align:center;padding:16px 0;color:var(--tm);font-size:13px">아직 녹음이 없습니다</div>';
  }
  o+='<div style="display:flex;gap:8px;margin-top:10px">';
  o+='<button class="btn bg2" style="flex:1;justify-content:center" onclick="document.getElementById(\'eval-audio-input\').click()">📁 파일 업로드</button>';
  o+='<button class="btn bm" style="flex:1;justify-content:center" data-cid="'+cid+'" onclick="openRecording(this.dataset.cid,\'consult\',\'before\')">🎙 지금 녹음</button>';
  o+='</div>';
  o+='<input type="file" id="eval-audio-input" accept="audio/*,video/*" style="display:none" data-cid="'+cid+'" onchange="evalHandleAudio(this)">';
  o+='</div></div>';

  /* ── 트레이너 평가 ── */
  o+='<div style="background:var(--s1);border:1px solid rgba(200,169,110,.25);border-top:3px solid var(--a);border-radius:14px;overflow:hidden;margin-bottom:14px">';
  o+='<div style="padding:14px 18px;border-bottom:1px solid var(--b);display:flex;align-items:center;justify-content:space-between">';
  o+='<div style="display:flex;align-items:center;gap:10px">';
  o+='<span style="font-size:16px">✍️</span>';
  o+='<div style="font-size:14px;font-weight:700;color:var(--a)">트레이너 평가</div>';
  o+='</div>';
  o+='<button class="btn bp bsm" data-cid="'+cid+'" onclick="saveEvalMemo(this.dataset.cid)">💾 저장</button>';
  o+='</div>';
  o+='<div style="padding:16px 18px">';
  o+='<div class="f1" style="margin-bottom:14px"><label>평가 곡</label>';
  o+='<input type="text" id="eval-song" placeholder="예) IU - 밤편지" value="'+esc(c.song||'')+'"></div>';
  o+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  o+='<div class="f1"><label>발견된 문제점</label>';
  o+='<textarea id="eval-prob" rows="10" placeholder="고음역 흉성 / 음정 불안정 / 복식호흡 미숙 / 구강 공명 부족 / 발음 부정확 / 리듬감 불안정 / 호흡 얕고 짧음">'+esc(c.prob||'')+'</textarea></div>';
  o+='<div class="f1"><label>개선 방향 &amp; 레슨 계획</label>';
  o+='<textarea id="eval-impr" rows="10" placeholder="1단계: 복식호흡 기초 4주 / 2단계: 두성 연결 훈련 / 음정 — 계이름 & 피아노 매칭 / 딕션 교정 / 고음역 점진적 확장">'+esc(c.impr||'')+'</textarea></div>';
  o+='</div></div></div>';

  /* ── 운영 규정 (접을 수 있는 형태) ── */
  o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:14px;overflow:hidden;margin-bottom:14px">';
  o+='<div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="var b=document.getElementById(\'eval-rules-body\');var ic=document.getElementById(\'eval-rules-ic\');b.style.display=b.style.display===\'none\'?\'block\':\'none\';ic.textContent=b.style.display===\'none\'?\'▶\':\'▼\'">';
  o+='<div style="display:flex;align-items:center;gap:10px"><span style="font-size:16px">📄</span><div style="font-size:14px;font-weight:700;color:var(--t)">개인 레슨 운영 규정 <span style="font-size:12px;color:var(--tm);font-weight:400">(클릭하여 펼치기)</span></div></div>';
  o+='<span id="eval-rules-ic" style="color:var(--tm);font-size:13px">▶</span>';
  o+='</div>';
  o+='<div id="eval-rules-body" style="display:none;padding:0 18px 16px">';
  o+='<div style="font-size:12px;color:var(--tm);line-height:1.6;margin-bottom:10px;font-style:italic">본 운영 방침은 최상의 수업 몰입도와 체계적인 발성 교정을 위해 설계되었습니다. 효율적인 수업 진행을 위해 아래 내용을 숙지하고 엄격히 준수해 주시기 바랍니다.</div>';
  o+='<div style="display:flex;gap:10px;margin-bottom:10px">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--a);min-width:22px;flex-shrink:0">1.</span>';
  o+='<div><div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:3px">레슨 시간 준수</div>';
  o+='<div style="font-size:13px;color:var(--ts);line-height:1.65">정시 시작 및 종료를 원칙으로 합니다. 개인 사정으로 인한 지각 시에도 종료 시간은 동일합니다. (다만, 이전 수강생의 피드백이 길어져 발생하는 수 분 내외의 수업 지연은 최상의 레슨 퀄리티를 위해 제가 직접 조율하는 부분이니 양해 부탁드립니다.) 🕒</div></div></div>';
  o+='<div style="display:flex;gap:10px;margin-bottom:10px">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--a);min-width:22px;flex-shrink:0">2.</span>';
  o+='<div><div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:3px">당일 변경 및 취소 (사유 불문 1회 차감)</div>';
  o+='<div style="font-size:13px;color:var(--ts);line-height:1.65">예약된 시간은 오직 한 분을 위해 비워둔 기회비용입니다. 갑작스러운 개인 사정, 건강 문제 등 어떠한 사유를 막론하고 당일 취소는 선생님의 준비 시간과 타 수강생의 기회를 박탈하는 행위이므로 예외 없이 차감됩니다.</div></div></div>';
  o+='<div style="display:flex;gap:10px;margin-bottom:10px">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--a);min-width:22px;flex-shrink:0">3.</span>';
  o+='<div><div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:3px">레슨 이월 및 연기</div>';
  o+='<div style="font-size:13px;color:var(--ts);line-height:1.65">4회 수업 중 1회만 가능합니다. (발성은 근육의 습관을 형성하는 과정입니다. 수업 간격이 불규칙해지면 신체 감각이 퇴보하여 결국 지난 학습 내용을 반복하게 됩니다. 지체 없는 성장을 위한 최소한의 훈련 루틴임을 이해해 주시기 바랍니다.)</div></div></div>';
  o+='<div style="display:flex;gap:10px;margin-bottom:10px">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--a);min-width:22px;flex-shrink:0">4.</span>';
  o+='<div><div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:3px">실력 변화를 위한 연습과 질문</div>';
  o+='<div style="font-size:13px;color:var(--ts);line-height:1.65">수업에서 배운 감각을 내 것으로 만드는 유일한 방법은 연습입니다. (개인 연습을 하시면서 잘 안되는 부분이나 궁금한 점을 꼭 체크해 오세요. 스스로 고민하고 질문을 던질 때 이해도가 높아지며, 그만큼 수업의 깊이와 실력 향상 속도도 눈에 띄게 빨라집니다.)</div></div></div>';
  o+='<div style="display:flex;gap:10px;margin-bottom:10px">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--a);min-width:22px;flex-shrink:0">5.</span>';
  o+='<div><div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:3px">수강료 납부 및 예약 확정</div>';
  o+='<div style="font-size:13px;color:var(--ts);line-height:1.65">입금 확인은 수업 참여에 대한 상호 간의 가장 기본적인 약속입니다. 수업 전날까지 입금 완료 시 예약이 최종 확정되며, 미입금 시 해당 시간대는 예약 대기자에게 우선권이 부여되어 일정이 자동 취소됩니다.</div></div></div>';
  o+='<div style="display:flex;gap:10px;margin-bottom:10px">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--a);min-width:22px;flex-shrink:0">6.</span>';
  o+='<div><div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:3px">중도 퇴실 및 환불 정책</div>';
  o+='<div style="font-size:13px;color:var(--ts);line-height:1.65">2회차 수업 참여 시점부터는 잔여 회차에 대한 반환이 진행되지 않습니다. (1회 수업 후 적성이나 변심에 의한 환불은 가능하나, 2회차부터는 핵심 커리큘럼과 노하우가 본격적으로 전달되는 단계입니다. 교육 콘텐츠의 가치를 보호하고 책임감 있는 학습 분위기를 유지하기 위한 기준이니 신중하게 결정해 주시기 바랍니다.)</div></div></div>';
  o+='<div style="display:flex;gap:10px;margin-bottom:10px">';
  o+='<span style="font-size:13px;font-weight:700;color:var(--a);min-width:22px;flex-shrink:0">7.</span>';
  o+='<div><div style="font-size:13px;font-weight:700;color:var(--t);margin-bottom:3px">개인 준비물 (생수 / 녹음기 / 필기도구)</div>';
  o+='<div style="font-size:13px;color:var(--ts);line-height:1.65">수분 공급은 성대 부상을 방지하는 필수 요건이며, 녹음과 기록은 휘발되는 감각을 객관화하여 학습 효과를 극대화하는 가장 강력한 도구입니다. 최상의 수업을 위해 반드시 지참해 주세요.</div></div></div>';
  o+='<div style="margin-top:12px;padding:10px 14px;background:rgba(200,169,110,.06);border-left:3px solid var(--a);border-radius:0 6px 6px 0;font-size:12px;color:var(--tm);font-style:italic;line-height:1.6">"모든 규정은 오로지 귀하의 실력 향상에만 초점을 맞추고 있습니다. 프로페셔널한 자세로 수업에 임해주시길 기대합니다."</div>';
  o+='</div></div>';

  /* ── 동의 녹음 ── */
  var savedConsent=c.consentRec;
  o+='<div style="background:var(--s1);border:1px solid rgba(200,114,114,.2);border-radius:14px;padding:14px 18px;margin-bottom:14px">';
  o+='<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">';
  o+='<div style="display:flex;align-items:center;gap:10px">';
  o+='<span style="font-size:16px">🎙</span>';
  o+='<div><div style="font-size:14px;font-weight:700;color:var(--r)">동의 녹음</div>';
  if(savedConsent){
    o+='<div style="font-size:11.5px;color:var(--g);margin-top:1px">✓ '+esc(savedConsent.date)+' 녹음됨</div>';
  } else {
    o+='<div style="font-size:12px;color:var(--tm);margin-top:1px">"위 유의사항에 동의합니다" 녹음</div>';
  }
  o+='</div></div>';
  o+='<button class="btn bsm" style="background:rgba(200,114,114,.1);color:var(--r);border:1px solid rgba(200,114,114,.2)" data-cid="'+cid+'" onclick="startConsentRecForEval(this.dataset.cid)">'+(savedConsent?'🔄 재녹음':'🔴 녹음 시작')+'</button>';
  o+='</div>';
  if(savedConsent){
    o+='<audio controls src="'+savedConsent.data+'" style="width:100%;height:36px;margin-top:10px"></audio>';
  }
  o+='</div>';
  o+='</div>';

  page='eval';
  ge('content').innerHTML=o;
  if(ge('pt'))ge('pt').textContent='트레이너 평가지';
  requestAnimationFrame(function(){
    var ct=ge('content');if(ct)ct.scrollTop=0;
    window.scrollTo({top:0,left:0,behavior:'instant'});
    requestAnimationFrame(function(){
      var ct2=ge('content');if(ct2)ct2.scrollTop=0;
      window.scrollTo({top:0,left:0,behavior:'instant'});
    });
  });
}

function saveEvalMemo(cid){
  var c=consults.find(function(x){return x.id===cid;});if(!c)return;
  c.song=ge('eval-song')?ge('eval-song').value:'';
  c.prob=ge('eval-prob')?ge('eval-prob').value:'';
  c.impr=ge('eval-impr')?ge('eval-impr').value:'';
  saveAll();toast('평가 저장됨 💾');
}

var evalConsentCid='';
function startConsentRecForEval(cid){
  evalConsentCid=cid;
  consentTarget={did:cid,mode:'consult'};
  recDid=cid;recMode='consent';recType='consent';recBlob=null;recChunks=[];
  ge('recStatus').textContent='녹음 버튼을 눌러 시작하세요';
  ge('recTimerDisp').textContent='00:00';
  ge('recStartBtn').style.display='flex';
  ge('recStopBtn').style.display='none';
  ge('recPreview').style.display='none';
  ge('recSaveBtn').style.display='none';
  ge('recLabel').value='동의 음성';
  /* saveRec consent 완료 후 evalPage 다시 열기 */
  window._afterConsentCb=function(){showEvalPage(cid);};
  om('mRec');
}

function printEvalSheet(cid){
  /* 출력 전 화면 값 자동 저장 */
  if(ge('eval-prob')||ge('eval-impr')){
    if(ge('eval-song')){var ec=consults.find(function(x){return x.id===cid;});if(ec){ec.song=ge('eval-song').value||'';}}
    var ec2=consults.find(function(x){return x.id===cid;});
    if(ec2){
      if(ge('eval-prob'))ec2.prob=ge('eval-prob').value||'';
      if(ge('eval-impr'))ec2.impr=ge('eval-impr').value||'';
      saveAll();
    }
  }
  var c=consults.find(function(x){return x.id===cid;});if(!c)return;
  var prob=c.prob||'';
  var impr=c.impr||'';
  var isGroup=(c.cls==='그룹'||c.cls==='group');
  var consentDate=c.consentRec?c.consentRec.date:'';
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
    '.sec-t{font-size:11.5px;font-weight:700;background:#1a1a1a;color:#fff;padding:5px 14px;letter-spacing:.04em;}'+
    '.sec-body{padding:8px 12px;}'+
    '.two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:7px 10px;}'+
    '.box{border:1px solid #ddd;border-radius:4px;padding:8px;min-height:80px;font-size:10.5px;line-height:1.5;background:#fafafa;word-break:break-word;}'+
    '.box-label{font-size:10.5px;font-weight:600;color:#444;margin-bottom:5px;letter-spacing:.03em;border-bottom:1px solid #eee;padding-bottom:3px;}'+
    '.notice-intro{padding:7px 14px 5px;font-size:10.5px;color:#555;line-height:1.6;border-bottom:1px solid #eee;font-style:italic;}'+
    '.notice-wrap{padding:4px 10px 5px;}'+
    '.sec-body .notice-item{display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #f0f0f0;}'+
    '.sec-body .notice-item:last-child{border-bottom:none;}'+
    '.notice-item{display:flex;gap:6px;padding:3px 0;border-bottom:1px solid #f0f0f0;}'+
    '.notice-item:last-child{border-bottom:none;}'+
    '.notice-num{font-weight:700;min-width:18px;flex-shrink:0;font-size:11px;}'+
    '.notice-body{font-size:10.5px;line-height:1.5;color:#222;}'+
    '.notice-body strong{font-weight:700;font-size:11px;}'+
    '.motto{margin:8px 12px 4px;padding:8px 12px;background:#f9f6f0;border-left:3px solid #c8a96e;font-size:11px;line-height:1.6;color:#444;font-style:italic;}'+
    '.account-box{margin:6px 12px 10px;background:#fffdf5;border:1px solid #d4a840;border-radius:5px;padding:8px 12px;}'+
    '.account-title{font-size:10.5px;font-weight:700;color:#8a6820;margin-bottom:5px;}'+
    '.account-row{font-size:11.5px;font-weight:600;color:#1a1a1a;margin-bottom:3px;}'+
    '.sign-area{display:flex;align-items:flex-end;gap:12px;margin-top:8px;padding-top:7px;border-top:2px solid #1a1a1a;}'+
    '.sign-box{flex:1;text-align:center;}'+
    '.sign-line{border-bottom:1px solid #888;margin-bottom:4px;height:32px;}'+
    '.sign-lbl{font-size:10px;color:#555;}'+
    '@media print{@page{size:A4;margin:8mm 12mm;}body{padding:0;}button{display:none!important;}}';

  w.document.write('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>레슨 평가지</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>'+css+'</style></head><body>');
  w.document.write('<h1>HLB보컬스튜디오</h1>');
  w.document.write('<div class="studioname">원장 양경렬 &nbsp;·&nbsp; ☎ 010-8804-8903</div>');
  w.document.write('<div class="sub">수강생: <strong>'+esc(c.name)+'</strong>&nbsp;&nbsp;|&nbsp;&nbsp;레슨 유의사항 &amp; 트레이너 초기 평가&nbsp;&nbsp;|&nbsp;&nbsp;'+ds+'</div>');

  /* ── 트레이너 초기 평가 ── */
  w.document.write('<div class="sec"><div class="sec-t">트레이너 초기 평가</div><div class="two-col">');
  w.document.write('<div><div class="box-label">발견된 문제점</div><div class="box">'+((prob||'').split('\n').join('<br>')||'<span style="color:#bbb">—</span>')+'</div></div>');
  w.document.write('<div><div class="box-label">개선 방향 &amp; 레슨 계획</div><div class="box">'+((impr||'').split('\n').join('<br>')||'<span style="color:#bbb">—</span>')+'</div></div>');
  w.document.write('</div></div>');

  /* ── 유의사항 ── */
  if(isGroup){
    w.document.write('<div class="sec"><div class="sec-t">📋 그룹 레슨 유의사항</div><div class="sec-body">');
    var groupNotices=[
      ['시간 준수','레슨은 정시에 시작하며 정시에 끝납니다. 늦게 오셔도 정시에 종료되니 시간을 꼭 지켜주세요.'],
      ['스케줄 변경','그룹 레슨 특성상 당일 스케줄 변경은 불가합니다. 불참 시 해당 회차는 소진됩니다.'],
      ['보강 정책','보강은 그룹 정원 여유가 있을 때만 가능하며, 보강 횟수는 월 1회로 제한됩니다.'],
      ['연습 권장','그룹 수업의 효율을 위해 개인 연습을 권장합니다. 발성 커리큘럼 복습을 꾸준히 해주세요.'],
      ['수강료 납부','레슨 시작 하루 전까지 미납 시 수업이 취소될 수 있습니다.'],
      ['환불 규정','전체 수업의 ½ 이상 수강 시 환불 불가 / ½ 미만 시 남은 횟수 환불 (행정비 차감).'],
      ['개인 물 지참','수업 중 마실 물은 개인 지참 필수입니다.']
    ];
    groupNotices.forEach(function(n,i){
      w.document.write('<div class="notice-item"><span class="notice-num">'+(i+1)+'.</span><div class="notice-body"><strong>'+n[0]+'</strong><br>'+n[1]+'</div></div>');
    });
    w.document.write('</div></div>');
  } else {
    w.document.write('<div class="sec"><div class="sec-t">개인 레슨 운영 규정 (필독)</div><div class="notice-intro">본 운영 방침은 최상의 수업 몰입도와 체계적인 발성 교정을 위해 설계되었습니다. 효율적인 수업 진행을 위해 아래 내용을 숙지하고 엄격히 준수해 주시기 바랍니다.</div><div class="notice-wrap">');
    var soloNotices=[
      ['레슨 시간 준수','정시 시작 및 종료를 원칙으로 합니다. 개인 사정으로 인한 지각 시에도 종료 시간은 동일합니다. (다만, 이전 수강생의 피드백이 길어져 발생하는 수 분 내외의 수업 지연은 최상의 레슨 퀄리티를 위해 제가 직접 조율하는 부분이니 양해 부탁드립니다.)'],
      ['당일 변경 및 취소 (사유 불문 1회 차감)','예약된 시간은 오직 한 분을 위해 비워둔 기회비용입니다. 갑작스러운 개인 사정, 건강 문제 등 어떠한 사유를 막론하고 당일 취소는 선생님의 준비 시간과 타 수강생의 기회를 박탈하는 행위이므로 예외 없이 차감됩니다.'],
      ['레슨 이월 및 연기','4회 수업 중 1회만 가능합니다. (발성은 근육의 습관을 형성하는 과정입니다. 수업 간격이 불규칙해지면 신체 감각이 퇴보하여 결국 지난 학습 내용을 반복하게 됩니다. 지체 없는 성장을 위한 최소한의 훈련 루틴임을 이해해 주시기 바랍니다.)'],
      ['실력 변화를 위한 연습과 질문','수업에서 배운 감각을 내 것으로 만드는 유일한 방법은 연습입니다. (개인 연습을 하시면서 잘 안되는 부분이나 궁금한 점을 꼭 체크해 오세요. 스스로 고민하고 질문을 던질 때 이해도가 높아지며, 그만큼 수업의 깊이와 실력 향상 속도도 눈에 띄게 빨라집니다. 더 정교한 피드백을 주고받을 수 있도록 본인의 실력에 맞는 연습을 꾸준히 소화해 주시기 바랍니다.)'],
      ['수강료 납부 및 예약 확정','입금 확인은 수업 참여에 대한 상호 간의 가장 기본적인 약속입니다. 수업 전날까지 입금 완료 시 예약이 최종 확정되며, 미입금 시 해당 시간대는 예약 대기자에게 우선권이 부여되어 일정이 자동 취소됩니다.'],
      ['중도 퇴실 및 환불 정책','2회차 수업 참여 시점부터는 잔여 회차에 대한 반환이 진행되지 않습니다. (1회 수업 후 적성이나 변심에 의한 환불은 가능하나, 2회차부터는 핵심 커리큘럼과 노하우가 본격적으로 전달되는 단계입니다. 교육 콘텐츠의 가치를 보호하고 책임감 있는 학습 분위기를 유지하기 위한 기준이니 신중하게 결정해 주시기 바랍니다.)'],
      ['개인 준비물 (생수 / 녹음기 / 필기도구)','수분 공급은 성대 부상을 방지하는 필수 요건이며, 녹음과 기록은 휘발되는 감각을 객관화하여 학습 효과를 극대화하는 가장 강력한 도구입니다. 최상의 수업을 위해 반드시 지참해 주세요.']
    ];
    soloNotices.forEach(function(n,i){
      w.document.write('<div class="notice-item"><span class="notice-num">'+(i+1)+'.</span><div class="notice-body"><strong>'+n[0]+'</strong><br>'+n[1]+'</div></div>');
    });
    /* 입금 계좌 */
    w.document.write('<div class="account-box">');
    w.document.write('<div class="account-title">입금 계좌</div>');
    w.document.write('<div class="account-row">우리은행 &nbsp; 1002-046-438968 &nbsp; (양경렬)</div>');
    w.document.write('<div class="account-row">기업은행 &nbsp; 010-8804-8903 &nbsp; (양경렬)</div>');
    w.document.write('<div style="font-size:11px;color:#888;margin-top:4px">카카오톡 오픈채팅: HLB보컬스튜디오</div>');
    w.document.write('</div>');
    w.document.write('</div></div>');
  }

  /* ── 좌우명 ── */
  if(!isGroup){
    w.document.write('<div style="margin:0 0 8px;padding:7px 12px;background:#f9f6f0;border-left:3px solid #c8a96e;font-size:10.5px;line-height:1.5;color:#555;font-style:italic">"모든 규정은 오로지 귀하의 실력 향상에만 초점을 맞추고 있습니다. 프로페셔널한 자세로 수업에 임해주시길 기대합니다."</div>');
  }
  /* ── 서명 ── */
  w.document.write('<div class="sign-area">');
  w.document.write('<div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">트레이너 서명</div></div>');
  w.document.write('<div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">위 유의사항에 동의합니다 — 수강생 서명</div></div>');
  w.document.write('<div style="text-align:right;font-size:11px;color:#888;flex:0.6">년&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;일</div>');
  w.document.write('</div>');

  if(consentDate)w.document.write('<div style="margin-top:10px;font-size:11px;color:#888;text-align:right">동의 녹음일: '+consentDate+'</div>');
  w.document.write('<div style="text-align:center;margin-top:18px"><button onclick="window.print()" style="padding:8px 24px;background:#1a1a1a;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer">🖨️ 인쇄</button></div>');
  w.document.write('</body></html>');
  w.document.close();
}


function go_page_today(){go('today');}
function go_page_schedule(){go('schedule');}
function go_page_payment(){go('payment');}
function go_page_logs(){go('logs');}
function go_page_students(){go('students');}
function go_page_consult(){go('consult');}
function go_page_dashboard(){go('dashboard');}
function go_page_timeline(){go('timeline');}
function goConsult(){
  try{localStorage.removeItem('vsC_evalCid');}catch(e){}
  window._skipEvalRestore=true;
  page='consult';_consultTab='consult';go('consult');
}
function goPayment(){go('payment');}

function ciCalcAge(el){
  var raw=el.value.trim();
  if(raw===''){var d2=document.getElementById('ci-age-display');if(d2)d2.textContent='';return;}
  var n=parseInt(raw);
  if(isNaN(n)){var d2b=document.getElementById('ci-age-display');if(d2b)d2b.textContent='';return;}
  var yr=n;
  if(raw.length<=2) yr=n>=30?1900+n:2000+n;
  var thisYear=new Date().getFullYear();
  if(yr<1920||yr>thisYear){var d3=document.getElementById('ci-age-display');if(d3)d3.textContent='';return;}
  var age=thisYear-yr;
  var d=document.getElementById('ci-age-display');
  if(d)d.textContent='만 '+age+'세 ('+yr+'년생)';
}

function showConsultForm(cid){
  var DAYS=['월','화','수','목','금','토','일'];
  var editC=cid?consults.find(function(x){return x.id===cid;}):null; /* 수정 모드 */
  var REFS=['지인 소개','인스타그램','네이버 검색','유튜브','현수막','블로그','전단지','카카오맵','기타'];
  var GENRES=['팝','R&B','발라드','뮤지컬','CCM','트로트','재즈','장르 무관'];
  var VOICES=['없음','성대결절','역류성 식도염','성대폴립','성대마비','성대부종','기타'];
  var EXPS=['없음 (처음)','6개월 미만','6개월~1년','1~3년','3년 이상'];
  var PREVT=['개인','그룹','온라인','독학'];
  function ro(opts,hid){
    return opts.map(function(v){return '<div class="ro" data-hid="'+hid+'" data-val="'+esc(v)+'" onclick="rSel(this,\''+hid+'\',\''+esc(v)+'\')">'+esc(v)+'</div>';}).join('');
  }
  var o='<div style="max-width:780px;margin:0 auto;padding-bottom:30px">';

  /* ── 헤더 ── */
  o+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">';
  o+='<div>';
  o+='<div style="font-size:10px;letter-spacing:.18em;color:var(--a);text-transform:uppercase;font-weight:600;margin-bottom:5px">'+(cid?'EDIT CONSULTATION':'NEW CONSULTATION')+'</div>';
  o+='<div style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:900;color:var(--t)">'+(cid?'상담 신청서 수정':'신규 상담 신청서')+'</div>';
  o+='</div>';
  o+='<div style="display:flex;align-items:center;gap:10px">';
  o+='<span id="ci-draft-ind" style="font-size:11px;color:var(--season-accent,var(--a));font-weight:600;opacity:0;transition:opacity .5s;letter-spacing:.04em">임시저장됨 ✓</span>';
  o+='<button class="btn bg2 bsm" onclick="go(\'consult\')">← 목록으로</button>';
  o+='</div>';
  o+='</div>';

  /* 섹션 공통 헬퍼 */
  function cs(icon,title,content){
    return '<div style="background:var(--s1);border:1px solid var(--b);border-radius:14px;overflow:hidden;margin-bottom:12px">'
      +'<div style="padding:13px 18px;border-bottom:1px solid var(--b);display:flex;align-items:center;gap:9px">'
      +'<span style="font-size:15px">'+icon+'</span>'
      +'<div style="font-size:14px;font-weight:700;color:var(--t)">'+title+'</div>'
      +'</div>'
      +'<div style="padding:16px 18px">'+content+'</div>'
      +'</div>';
  }

  /* ── 기본 정보 ── */
  var basicContent='';
  basicContent+='<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">';
  basicContent+='<div style="display:flex;flex-direction:column;align-items:center;gap:8px">';
  basicContent+='<div class="photo-preview" id="ci-photo-preview" style="width:100px;height:100px;border-radius:12px;cursor:pointer" onclick="ge(\'ci-file-input\').click()"><div class="no-ph">📷</div></div>';
  basicContent+='<input type="hidden" id="ci-photo-data">';
  basicContent+='<div style="display:flex;gap:5px"><button class="btn bg2 bsm" style="font-size:11px" onclick="openCam(\'ci\')">📷 촬영</button><button class="btn bg2 bsm" style="font-size:11px" onclick="ge(\'ci-file-input\').click()">📁 업로드</button></div>';
  basicContent+='<input type="file" id="ci-file-input" accept="image/*" style="display:none" onchange="prevPhoto(this,\'ci-photo-preview\',\'ci-photo-data\')"></div>';
  basicContent+='<div style="flex:1;min-width:240px"><div class="fg3" style="margin-bottom:12px">';
  basicContent+='<div class="f1"><label>성함 *</label><input type="text" id="ci-nm" placeholder="홍길동"></div>';
  basicContent+='<div class="f1"><label>출생연도</label><input type="number" id="ci-age" placeholder="1995" min="1940" max="2020" oninput="ciCalcAge(this)"><div id="ci-age-display" style="font-size:12px;color:var(--a);margin-top:3px"></div></div>';
  basicContent+='<div class="f1"><label>직업</label><input type="text" id="ci-job" placeholder="직장인, 학생 등"></div>';
  basicContent+='<div class="f1"><label>성별</label><div class="radio-g"><div class="ro on" onclick="rSel(this,\'ci-gd\',\'여성\')">여성</div><div class="ro" onclick="rSel(this,\'ci-gd\',\'남성\')">남성</div></div><input type="hidden" id="ci-gd" value="여성"></div>';
  basicContent+='<div class="f1"><label>휴대폰</label><input type="tel" id="ci-ph" placeholder="010-0000-0000" oninput="fmtPhone(this)"></div>';
  basicContent+='</div></div></div>';
  o+=cs('👤','기본 정보',basicContent);

  /* ── 유입 경로 ── */
  var refContent='';
  refContent+='<div class="radio-g" id="ci-ref-group">'+REFS.map(function(r){return '<div class="ro" data-val="'+esc(r)+'" onclick="rSelRef(this,\''+esc(r)+'\')">'+esc(r)+'</div>';}).join('')+'</div>';
  refContent+='<input type="hidden" id="ci-ref" value=""><div id="ci-ref-detail-wrap" style="display:none;margin-top:10px"><input type="text" id="ci-ref-detail" placeholder="지인 이름 / 기타 경로 입력"></div>';
  o+=cs('📍','유입 경로',refContent);

  /* ── 목표 & 동기 ── */
  var goalContent='';
  goalContent+='<div class="fg" style="margin-bottom:0">';
  goalContent+='<div class="f1 full"><label>배우러 오게 된 계기</label><textarea id="ci-why" rows="3" placeholder="취미 즐기기 / 자신감 향상 / 음정·발성 교정 / SNS 콘텐츠 / 무대 준비 / 직업적 필요"></textarea></div>';
  goalContent+='<div class="f1"><label>단기 목표 (3개월)</label><input type="text" id="ci-goal-s" placeholder="고음 안정 / 복식호흡 / 곡 1곡 완성 / 음정 안정화"></div>';
  goalContent+='<div class="f1"><label>장기 목표</label><input type="text" id="ci-goal-l" placeholder="버스킹 / 오디션 / 유튜브 커버 / 진학 준비 / 평생 취미"></div>';
  goalContent+='<div class="f1 full"><label>목표 장르 (복수 선택)</label><div class="radio-g">'+GENRES.map(function(g){return '<div class="ro genre-ro" onclick="this.classList.toggle(\'on\')">'+esc(g)+'</div>';}).join('')+'</div></div>';
  goalContent+='</div>';
  o+=cs('🎵','레슨 목표 & 동기',goalContent);
  /* ── 레슨비 안내 ── */
  var feeContent='';
  feeContent+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
  var feeCards=[
    {cls:'pro',color:'var(--a)',bg:'rgba(200,169,110,.1)',border:'rgba(200,169,110,.2)',icon:'🎤',name:'발성전문반 (1시간)',
     desc:'개인의 습관화로 고착된 잘못된 발성 문제를 단계별 커리큘럼으로 교정하여, 건강한 목소리와 안정된 발성으로 가창 실력 향상을 목표로 하는 클래스. (기본기 → 응용)<br><span style="font-size:11px;color:var(--tm)">기본 50분 레슨, 당일 수강생 컨디션·진도에 따라 최대 10분 추가 피드백 제공.</span>',
     p1:'35만원',p2:'60만원',disc:'3개월 일괄등록 → <b>5% 할인</b><br>6개월 일괄등록 → <b>10% 할인</b> <span style="color:var(--tm)">(최대 절감)</span>'},
    {cls:'hob',color:'var(--bl)',bg:'rgba(110,163,200,.1)',border:'rgba(110,163,200,.2)',icon:'🎵',name:'취미반 (50분)',
     desc:'발성전문반의 커리큘럼을 50분으로 압축하여, 디테일한 설명보다 실기 위주의 레슨으로 진행합니다. 부담 없이 노래를 즐기고 싶은 분을 위한 클래스.',
     p1:'25만원',p2:'45만원',disc:'3개월 일괄등록 → <b>5% 할인</b>'},
    {cls:'chuk',color:'var(--g)',bg:'rgba(109,200,162,.1)',border:'rgba(109,200,162,.2)',icon:'🎶',name:'축가반 (50분)',
     desc:'',p1:'35만원',p2:'60만원',disc:'3개월 일괄등록 → <b>5% 할인</b>'},
    {cls:'voice',color:'var(--pu)',bg:'rgba(164,110,200,.1)',border:'rgba(164,110,200,.2)',icon:'🎙',name:'음성교정반 (50분)',
     desc:'',p1:'35만원',p2:'60만원',disc:'3개월 일괄등록 → <b>5% 할인</b>'}
  ];
  feeCards.forEach(function(fc){
    feeContent+='<div style="background:'+fc.bg+';border:1px solid '+fc.border+';border-radius:10px;padding:14px">';
    /* 발성전문반은 제목 옆에 시간 구조 표시 */
    if(fc.cls==='pro'){
      feeContent+='<div style="font-size:12.5px;font-weight:700;color:'+fc.color+';margin-bottom:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+fc.icon+' '+esc(fc.name)+'<span style="font-size:10.5px;font-weight:600;background:rgba(200,169,110,.15);color:var(--a);border-radius:4px;padding:2px 7px">기본 50분 + 최대 10분 추가</span></div>';
    } else {
      feeContent+='<div style="font-size:12.5px;font-weight:700;color:'+fc.color+';margin-bottom:5px">'+fc.icon+' '+esc(fc.name)+'</div>';
    }
    if(fc.desc)feeContent+='<div style="font-size:12px;color:var(--ts);line-height:1.7;margin-bottom:9px">'+fc.desc+'</div>';
    feeContent+='<div style="font-size:13.5px;color:var(--ts);line-height:1.9">주 1회: <b style="color:'+fc.color+'">'+fc.p1+'</b>/월 &nbsp; 주 2회: <b style="color:'+fc.color+'">'+fc.p2+'</b>/월</div>';
    feeContent+='<div style="margin-top:8px;padding:7px 10px;background:rgba(109,200,162,.1);border-radius:7px;font-size:12px;color:var(--g);line-height:1.7">✨ '+fc.disc+'</div>';
    feeContent+='</div>';
  });
  feeContent+='</div>';
  feeContent+='<div style="background:rgba(255,255,255,.03);border:1px solid var(--b);border-radius:10px;padding:14px;margin-bottom:10px">';
  feeContent+='<div style="font-size:12px;font-weight:600;color:var(--ts);margin-bottom:10px">📊 등록 기간별 금액 계산</div>';
  feeContent+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
  feeContent+='<select id="calc-cls" onchange="calcFee()" style="font-size:13px;padding:7px 10px;flex:1;min-width:120px"><option value="pro">발성전문반</option><option value="hob">취미반</option><option value="chuk">축가반</option><option value="voice">음성교정반</option></select>';
  feeContent+='<select id="calc-freq" onchange="calcFee()" style="font-size:13px;padding:7px 10px;flex:1;min-width:80px"><option value="1">주 1회</option><option value="2">주 2회</option></select>';
  feeContent+='<select id="calc-months" onchange="calcFee()" style="font-size:13px;padding:7px 10px;flex:1;min-width:100px"><option value="1">1개월</option><option value="2">2개월</option><option value="3">3개월 ✨5%↓</option><option value="6">6개월 ✨10%↓</option><option value="12">12개월</option></select>';
  feeContent+='</div>';
  feeContent+='<div id="calc-result" style="font-size:14px;color:var(--a);font-weight:600;min-height:36px;padding:4px 0"></div>';
  feeContent+='</div>';
  feeContent+='<div style="background:rgba(200,114,114,.05);border:1px solid rgba(200,114,114,.15);border-radius:9px;padding:12px 14px">';
  feeContent+='<div style="font-size:11.5px;font-weight:700;color:var(--r);margin-bottom:7px">📋 환불 정책</div>';
  feeContent+='<div style="font-size:12px;color:var(--ts);line-height:1.9">';
  feeContent+='· 수강 시작 전 전액 환불<br>· 1회차 이하: 결제금액 — 실수강료 환불<br>· 2회차 이상: 잔여 수업 정가 기준 차감 후 환불';
  feeContent+='</div></div>';
  o+=cs('💰','레슨비 안내',feeContent);

  /* ── 레슨 일정 ── */
  var schedContent='';

  /* ── STEP 1: 희망 반 ── */
  schedContent+='<div style="margin-bottom:12px">';
  schedContent+='<div style="font-size:10px;font-weight:700;color:var(--tm);letter-spacing:.1em;margin-bottom:6px">STEP 1 — 희망 반</div>';
  schedContent+='<div class="radio-g"><div class="ro" style="min-width:120px" onclick="rSel(this,\'ci-cls\',\'pro\')">발성전문반 (1시간)</div><div class="ro" style="min-width:100px" onclick="rSel(this,\'ci-cls\',\'hob\')">취미반 (50분)</div><div class="ro" style="min-width:100px" onclick="rSel(this,\'ci-cls\',\'chuk\')">축가반 (50분)</div><div class="ro" style="min-width:110px" onclick="rSel(this,\'ci-cls\',\'voice\')">음성교정반 (50분)</div></div>';
  schedContent+='<input type="hidden" id="ci-cls" value="">';
  schedContent+='</div>';

  /* ── 시간 옵션 ── */
  var timeOpts='<option value="">선택</option>';for(var th=10;th<=21;th++)timeOpts+='<option value="'+('0'+th).slice(-2)+':00">'+('0'+th).slice(-2)+':00</option>';

  /* ── STEP 2: 수업 방식 ── */
  schedContent+='<div style="margin-bottom:12px">';
  schedContent+='<div style="font-size:10px;font-weight:700;color:var(--tm);letter-spacing:.1em;margin-bottom:6px">STEP 2 — 수업 방식</div>';
  schedContent+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';

  /* 좌: 고정 */
  schedContent+='<div style="border:1.5px solid var(--b);border-radius:10px;overflow:hidden" id="ci-sched-box-fixed">';
  schedContent+='<div style="background:var(--season-hover,var(--ag));padding:8px 10px;border-bottom:1px solid var(--b);cursor:pointer" onclick="ciSchedMode(\'fixed\')">';
  schedContent+='<div style="display:flex;align-items:center;justify-content:space-between">';
  schedContent+='<div style="display:flex;align-items:center;gap:4px"><span>📌</span><span style="font-size:12px;font-weight:700;color:var(--t)">고정</span></div>';
  schedContent+='<div style="display:flex;gap:3px"><div class="ro on" id="ci-fix-freq-1" onclick="event.stopPropagation();ciFixFreq(1)" style="padding:2px 7px;font-size:9px">주1</div><div class="ro" id="ci-fix-freq-2" onclick="event.stopPropagation();ciFixFreq(2)" style="padding:2px 7px;font-size:9px">주2</div></div>';
  schedContent+='</div></div>';
  schedContent+='<div style="padding:8px 10px">';
  /* 요일 선택 */
  schedContent+='<div class="dpick" id="ci-dpick" style="gap:3px;margin-bottom:6px">'+DAYS.map(function(d){return '<div class="dpb" onclick="this.classList.toggle(\'on\');ciShowDayTime()" style="font-size:11px;padding:4px 6px">'+d+'</div>';}).join('')+'</div>';
  /* 선택된 요일별 시간 표시 영역 */
  schedContent+='<div id="ci-day-times" style="font-size:11px;color:var(--ts);line-height:1.6"></div>';
  schedContent+='<select id="ci-time" style="font-size:11px;width:100%;padding:5px 7px;border:1px solid var(--b);border-radius:6px;background:var(--s1);color:var(--t);margin-top:4px">'+timeOpts+'</select>';
  schedContent+='<div id="ci-time2-wrap" style="display:none;margin-top:4px"><select id="ci-time2" style="font-size:11px;width:100%;padding:5px 7px;border:1px solid var(--b);border-radius:6px;background:var(--s1);color:var(--t)">'+timeOpts+'</select></div>';
  schedContent+='<input type="hidden" id="ci-freq" value="1">';
  schedContent+='</div></div>';

  /* 우: 변동 */
  schedContent+='<div style="border:1.5px solid var(--b);border-radius:10px;overflow:hidden" id="ci-sched-box-flex">';
  schedContent+='<div style="background:var(--season-hover,var(--ag));padding:8px 10px;border-bottom:1px solid var(--b);cursor:pointer" onclick="ciSchedMode(\'flex\')">';
  schedContent+='<div style="display:flex;align-items:center;justify-content:space-between">';
  schedContent+='<div style="display:flex;align-items:center;gap:4px"><span>🔄</span><span style="font-size:12px;font-weight:700;color:var(--t)">변동</span></div>';
  schedContent+='<div style="display:flex;gap:3px"><div class="ro on" id="ci-flex-freq-1" onclick="event.stopPropagation();ciFlexFreq(1)" style="padding:2px 7px;font-size:9px">주1</div><div class="ro" id="ci-flex-freq-2" onclick="event.stopPropagation();ciFlexFreq(2)" style="padding:2px 7px;font-size:9px">주2</div><input type="hidden" id="ci-flex-freq" value="1"></div>';
  schedContent+='</div></div>';
  schedContent+='<div style="padding:8px 10px">';
  schedContent+='<div class="dpick" id="ci-flex-dpick" style="gap:3px;margin-bottom:6px">'+DAYS.map(function(d){return '<div class="dpb" onclick="this.classList.toggle(\'on\')" style="font-size:11px;padding:4px 6px">'+d+'</div>';}).join('')+'</div>';
  schedContent+='<textarea id="ci-sched-flex" rows="2" style="font-size:11px;width:100%;resize:none;padding:5px 7px;border:1px solid var(--b);border-radius:6px;background:var(--s1);color:var(--t);box-sizing:border-box" placeholder="메모 (예: 화~금 오후 가능)"></textarea>';
  schedContent+='</div></div>';

  schedContent+='</div>';
  schedContent+='<input type="hidden" id="ci-sched-pref" value="fixed">';
  schedContent+='<input type="hidden" id="ci-sched-fixed" value="">';
  schedContent+='<input type="hidden" id="ci-when" value="">';
  schedContent+='</div>';

  /* ── STEP 3: 확정 일정 ── */
  schedContent+='<div style="background:var(--ag);border:1px solid var(--b2);border-radius:10px;padding:10px 12px">';
  schedContent+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">';
  schedContent+='<span style="font-size:10px;font-weight:700;color:var(--tm);letter-spacing:.1em">STEP 3</span>';
  schedContent+='<span style="font-size:12px;font-weight:700;color:var(--season-accent,var(--a))">📅 확정 일정</span>';
  schedContent+='<span style="font-size:10px;color:var(--tm)">→ 스케줄 자동 반영</span>';
  schedContent+='</div>';
  schedContent+='<div id="ci-dates-list" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px"></div>';
  schedContent+='<button class="btn bm bsm" onclick="ciAddDateRow()" style="width:100%;justify-content:center;padding:6px;font-size:11px">＋ 날짜 추가</button>';
  schedContent+='</div>';

  o+=cs('🗓','레슨 일정',schedContent);



  /* ── 음성 & 건강 ── */
  var healthContent='';
  healthContent+='<div class="fg" style="margin-bottom:0">';
  healthContent+='<div class="f1 full"><label>음성 질환 경험</label><div class="radio-g">'+ro(VOICES,'ci-voice')+'</div><input type="hidden" id="ci-voice" value=""></div>';
  healthContent+='<div class="f1 full"><label>음성 질환 상세</label><textarea id="ci-vdetail" placeholder="증상, 치료 여부 등"></textarea></div>';
  healthContent+='<div class="f1 full"><label>레슨 경험</label><div class="radio-g">'+ro(EXPS,'ci-exp')+'</div><input type="hidden" id="ci-exp" value=""></div>';
  healthContent+='<div class="f1"><label>이전 레슨 형태</label><div class="radio-g">'+ro(PREVT,'ci-prev-type')+'</div><input type="hidden" id="ci-prev-type" value=""></div>';
  healthContent+='<div class="f1"><label>이전 레슨 기관</label><input type="text" id="ci-prev" placeholder="OO 보컬학원 1년 등"></div>';
  healthContent+='<div class="f1"><label>흡연</label><div class="radio-g">'+ro(['비흡연','흡연','금연 중'],'ci-smoke')+'</div><input type="hidden" id="ci-smoke" value=""><div id="ci-smoke-detail" style="display:none;margin-top:7px"><input type="text" id="ci-smoke-amount" placeholder="하루 몇 개비? (예: 하루 반 갑, 10개비 등)" style="font-size:13px"></div></div>';
  healthContent+='<div class="f1"><label>음주</label><div class="radio-g">'+ro(['안 함','가끔','자주'],'ci-drink')+'</div><input type="hidden" id="ci-drink" value=""><div id="ci-drink-detail" style="display:none;margin-top:7px"><input type="text" id="ci-drink-amount" placeholder="주 몇 회? (예: 주 1~2회, 주말 가끔 등)" style="font-size:13px"></div></div>';
  healthContent+='<div class="f1 full"><label>기타 건강 특이사항</label><input type="text" id="ci-health" placeholder="비염, 천식 등"></div>';
  healthContent+='</div>';
  o+=cs('🏥','음성 & 건강',healthContent);

  o+='<input type="hidden" id="ci-audio-data"><input type="hidden" id="ci-audio-type" value="audio">';

  /* ── 추가 메모 ── */
  var memoContent='<div class="f1"><label>트레이너에게 알리고 싶은 내용</label><textarea id="ci-memo" rows="3" placeholder="컨디션, 특이사항, 질문 등"></textarea></div>';
  o+=cs('📝','추가 메모',memoContent);

  /* ── 저장 버튼 ── */
  o+='<div style="display:flex;gap:10px;justify-content:flex-end;padding:4px 0 6px">';
  o+='<button class="btn bg2" style="min-width:80px" onclick="go(\'consult\')">취소</button>';
  o+='<button class="btn bp" style="padding:11px 28px;font-size:15px" onclick="saveConsult()">💾 저장</button>';
  o+='<button class="btn bg2" style="padding:11px 18px" onclick="saveConsultPending()">📌 보류 저장</button>';
  o+='<button class="btn bm" style="padding:11px 24px;font-size:15px" onclick="saveAndGoEval()">📋 저장 후 평가지 →</button>';
  o+='</div></div>';
  ge('content').innerHTML=o;
  setTimeout(calcFee, 50);
  /* 신규 작성 모드: 임시저장 복원 확인 */
  if(!cid){
    var _draft=null;
    try{_draft=JSON.parse(localStorage.getItem('vsC_draft')||'null');}catch(e){}
    if(_draft&&_draft.name){
      var _ago=Math.round((Date.now()-(_draft.savedAt||0))/60000);
      var _agoTxt=_ago<60?_ago+'분 전':Math.round(_ago/60)+'시간 전';
      /* 복원 알림 바 삽입 */
      var _bar=document.createElement('div');
      _bar.style.cssText='position:sticky;top:0;z-index:99;background:rgba(200,169,110,.15);border:1px solid rgba(200,169,110,.35);border-radius:10px;padding:10px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;';
      _bar.innerHTML='<span style="font-size:13px;color:var(--a);font-weight:600">⚡ '+_agoTxt+' 작성하던 내용이 있습니다. 복원할까요?</span>'
        +'<div style="display:flex;gap:6px">'
        +'<button class="btn bp bsm" onclick="ciRestoreDraft()">복원</button>'
        +'<button class="btn bd bsm" onclick="ciClearDraft();this.parentElement.parentElement.remove()">삭제</button>'
        +'</div>';
      var _content=ge('content');
      if(_content)_content.insertBefore(_bar,_content.firstChild);
    }
  }
  /* 자동저장 시작 */
  if(!cid) setTimeout(ciStartAutoSave,200);
  /* 수정 모드: 기존 데이터 채우기 */
  if(cid){
    var editC=consults.find(function(x){return x.id===cid;});
    if(editC){
      var ec=editC;
      var setV=function(id,v){var el=ge(id);if(el&&v!==undefined&&v!==null)el.value=v;};
      setV('ci-nm',ec.name);setV('ci-age',ec.age);setV('ci-ph',ec.phone);
      setV('ci-job',ec.job);setV('ci-why',ec.why);
      setV('ci-vdetail',ec.vdetail);setV('ci-prev',ec.prev);setV('ci-memo',ec.memo);
      setV('ci-goal-s',ec.goalS);setV('ci-goal-l',ec.goalL);
      setV('ci-time',ec.time);setV('ci-when',ec.when);
      /* 성별 라디오 시각 반영 */
      if(ec.gd){
        ge('ci-gd').value=ec.gd;
        document.querySelectorAll('[onclick*="ci-gd"]').forEach(function(el){el.classList.toggle('on',el.textContent===ec.gd);});
      }
      /* 반 선택 시각 반영 */
      if(ec.cls){
        ge('ci-cls').value=ec.cls;
        document.querySelectorAll('[onclick*="ci-cls"]').forEach(function(el){el.classList.toggle('on',el.getAttribute('onclick').indexOf("'"+ec.cls+"'")>=0);});
      }
      /* 스케줄 희망 */
      if(ec.schedPref){
        ge('ci-sched-pref').value=ec.schedPref;
        document.querySelectorAll('[data-v]').forEach(function(el){el.classList.toggle('on',el.dataset.v===ec.schedPref);});
      }
      /* 레슨 횟수 */
      if(ec.freq2){
        ge('ci-freq').value='2';
        document.querySelectorAll('[onclick*="ciSetFreq"]').forEach(function(el){el.classList.toggle('on',el.getAttribute('onclick').indexOf('2')>=0);});
      }
      /* 희망 시간 select 동기화 */
      if(ec.time){var tsel=ge('ci-time-sel');if(tsel)tsel.value=ec.time;}
      /* 첫 수업 날짜 */
      if(ec.firstDate){var fdate=ge('ci-first-date');if(fdate)fdate.value=ec.firstDate;}
      /* 요일 선택 */
      if(ec.days)ec.days.forEach(function(d){
        document.querySelectorAll('#ci-dpick .dpb').forEach(function(b){if(b.textContent===d)b.classList.add('on');});
      });
      /* 장르 */
      if(ec.genres)ec.genres.forEach(function(g){
        document.querySelectorAll('.genre-ro').forEach(function(b){if(b.textContent===g)b.classList.add('on');});
      });
      /* 음성질환 */
      if(ec.voice){ge('ci-voice').value=ec.voice;document.querySelectorAll('[data-hid="ci-voice"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===ec.voice);});}
      /* 레슨경험 */
      if(ec.exp){ge('ci-exp').value=ec.exp;document.querySelectorAll('[data-hid="ci-exp"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===ec.exp);});}
      /* 이전레슨형태 */
      if(ec.prevType){ge('ci-prev-type').value=ec.prevType;document.querySelectorAll('[data-hid="ci-prev-type"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===ec.prevType);});}
      /* 흡연/음주 */
      if(ec.smoke){ge('ci-smoke').value=ec.smoke;document.querySelectorAll('[data-hid="ci-smoke"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===ec.smoke);});}
      if(ec.drink){ge('ci-drink').value=ec.drink;document.querySelectorAll('[data-hid="ci-drink"]').forEach(function(el){el.classList.toggle('on',el.dataset.val===ec.drink);});}
      /* 유입경로 */
      if(ec.ref){ge('ci-ref').value=ec.ref;document.querySelectorAll('#ci-ref-group .ro').forEach(function(el){if(el.dataset.val===ec.ref){el.classList.add('on');if(ec.ref==='지인 소개'||ec.ref==='기타'){var w=ge('ci-ref-detail-wrap');if(w)w.style.display='block';}}});if(ec.refDetail){var rd=ge('ci-ref-detail');if(rd)rd.value=ec.refDetail;}}
      /* 확정 날짜 목록 */
      if(ec.confirmedDates&&ec.confirmedDates.length){ec.confirmedDates.forEach(function(entry){ciAddDateRow(entry.date,entry.time);});}
      if(ec.age)setTimeout(function(){ciCalcAge({value:ec.age});},100);
      /* 저장 버튼 → 수정 저장 */
      setTimeout(function(){
        var savBtn=document.querySelector('[onclick="saveConsult()"]');
        if(savBtn){savBtn.textContent='💾 수정 저장';savBtn.onclick=function(){saveConsultEdit(cid);};}
        var evalBtn=document.querySelector('[onclick="saveAndGoEval()"]');
        if(evalBtn)evalBtn.style.display='none';
        /* 모바일: 상단 고정 저장 버튼 */
        if(typeof isMobile==='function'&&isMobile()){
          var fixedBar=document.createElement('div');
          fixedBar.id='ci-fixed-save';
          fixedBar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:rgba(16,16,26,.97);backdrop-filter:blur(12px);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(200,169,110,.25);';
          fixedBar.innerHTML='<span style="font-size:14px;font-weight:700;color:var(--a)">✏️ 상담 수정</span>'
            +'<div style="display:flex;gap:8px">'
            +'<button class="btn bg2 bsm" onclick="go(\'consult\')">← 취소</button>'
            +'<button class="btn bp" style="padding:8px 18px;font-size:13.5px" onclick="saveConsultEdit(\''+cid+'\')">💾 저장</button>'
            +'</div>';
          document.body.appendChild(fixedBar);
          /* content 상단 여백 추가 */
          var cont=ge('content');if(cont)cont.style.paddingTop='60px';
        }
      },50);
    }
  }
}

