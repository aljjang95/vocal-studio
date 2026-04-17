/* ============================================================
   payment.js — 입금 관리 & 레슨 횟수
   getSOffset() : 레슨 회차 오프셋
   getCycleInfo() : 사이클 정보
   buildPayment() : 입금 관리 HTML
   switchPayCard() : 카드 전환
   addPayForStudent() : 입금 등록
   showPayModal() : 입금 모달
   extractPayAmount() : 금액 추출
   confirmPaySave() : 입금 저장 확인
   togglePaid() : 입금 상태 전환
   deletePayment() : 입금 삭제
   mkRoundBtn() : 둥근 버튼 생성
   closeEditLC() : 레슨 수 편집 닫기
   openEditLessonCount() : 레슨 수 편집 열기
   _renderEditLCPreview() : 편집 미리보기
   previewEditLC() : 미리보기 업데이트
   saveEditLessonCount() : 레슨 수 저장
   ============================================================ */

function getSOffset(sid){
  /* 레슨생의 lessonOffset 반환 - wn 계산에 사용 */
  var s=students.find(function(x){return x.id===sid;});
  return (s&&parseInt(s.lessonOffset))||0;
}
function getCycleInfo(s){
  var cycleSize=s.freq===2?8:4;
  var actualLessons=logs.filter(function(l){return l.sid===s.id&&l.att!=='결석'&&l.att!=='연기';}).length;
  var offset=parseInt(s.lessonOffset)||0;
  var totalLessons=actualLessons+offset;
  var cycleNum=totalLessons>0?Math.floor((totalLessons-1)/cycleSize)+1:1;
  var posInCycle=totalLessons>0?((totalLessons-1)%cycleSize)+1:0;
  var cycleStart=(cycleNum-1)*cycleSize+1;
  var cycleEnd=cycleNum*cycleSize;
  var lessonsInCycle=posInCycle;
  var remainInCycle=cycleSize-posInCycle;
  return{cycleSize:cycleSize,cycleNum:cycleNum,cycleStart:cycleStart,cycleEnd:cycleEnd,lessonsInCycle:lessonsInCycle,remainInCycle:remainInCycle,totalLessons:totalLessons,offset:offset,actualLessons:actualLessons};
}


function buildPayment(){
  var active=students.filter(function(s){return s.status==='수강중';});
  var unpaidAlert=active.filter(function(s){
    if(!(s.fee>0))return false;
    var ci=getCycleInfo(s);
    var paid=payments.filter(function(p){return p.sid===s.id&&p.cycleNum===ci.cycleNum&&p.paid;}).reduce(function(a,b){return a+(b.amount||0);},0);
    return paid<(s.fee||0);
  });
  var totalIncome=payments.filter(function(p){return p.paid;}).reduce(function(a,b){return a+(b.amount||0);},0);

  var o='<div class="sh"><div class="st2">입금 관리</div>';
  o+='<div style="display:flex;gap:8px;align-items:center">';
  if(unpaidAlert.length)o+='<span class="bdg bg-r" style="font-size:12.5px">⚠️ 미입금 '+unpaidAlert.length+'명</span>';
  o+='</div></div>';

  /* 요약 카드 */
  o+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">';
  o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:14px 16px">';
  o+='<div style="font-size:10px;color:var(--tm);text-transform:uppercase;letter-spacing:.1em;font-weight:600;margin-bottom:6px">수강중</div>';
  o+='<div style="font-size:22px;font-weight:900;color:var(--a);font-family:Cormorant Garamond,serif">'+active.length+'<span style="font-size:13px;font-weight:500;color:var(--tm)"> 명</span></div>';
  o+='</div>';
  o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:14px 16px">';
  o+='<div style="font-size:10px;color:var(--tm);text-transform:uppercase;letter-spacing:.1em;font-weight:600;margin-bottom:6px">미입금</div>';
  o+='<div style="font-size:22px;font-weight:900;color:'+(unpaidAlert.length?'var(--r)':'var(--g)')+';font-family:Cormorant Garamond,serif">'+unpaidAlert.length+'<span style="font-size:13px;font-weight:500;color:var(--tm)"> 명</span></div>';
  o+='</div>';
  o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:14px 16px">';
  o+='<div style="font-size:10px;color:var(--tm);text-transform:uppercase;letter-spacing:.1em;font-weight:600;margin-bottom:6px">누적 수입</div>';
  o+='<div style="font-size:18px;font-weight:900;color:var(--g);font-family:Cormorant Garamond,serif">'+(totalIncome?won(totalIncome):'—')+'</div>';
  o+='</div></div>';

  o+='<div style="background:var(--ag);border:1px solid rgba(200,169,110,.16);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:var(--a);display:flex;align-items:center;gap:8px">';
  o+='<span style="flex-shrink:0">💡</span><span>주1회=4회마다 / 주2회=8회마다 레슨비 자동 알림. 구간 완료 후 미입금으로 표시됩니다.</span></div>';

  if(!active.length)return o+'<div class="empty"><div class="ei">💰</div><div class="et">수강중인 레슨생이 없습니다</div></div>';

  /* 미입금 우선 정렬 */
  var sorted=active.slice().sort(function(a,b){
    var ciA=getCycleInfo(a),ciB=getCycleInfo(b);
    var pA=payments.filter(function(p){return p.sid===a.id&&p.cycleNum===ciA.cycleNum&&p.paid;}).reduce(function(s,p){return s+(p.amount||0);},0);
    var pB=payments.filter(function(p){return p.sid===b.id&&p.cycleNum===ciB.cycleNum&&p.paid;}).reduce(function(s,p){return s+(p.amount||0);},0);
    var uA=(a.fee>0&&pA<a.fee)?0:1;
    var uB=(b.fee>0&&pB<b.fee)?0:1;
    return uA-uB;
  });

  /* 레슨생 네비게이션 바 (한 명씩 보기) */
  o+='<div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch">';
  sorted.forEach(function(s,idx){
    var _ci=getCycleInfo(s);
    var _pd=payments.filter(function(p){return p.sid===s.id&&p.cycleNum===_ci.cycleNum&&p.paid;}).reduce(function(a,b){return a+(b.amount||0);},0);
    var _isUnpaid=s.fee>0&&_pd<s.fee;
    o+='<button class="pay-nav-btn'+(idx===0?' on':'')+'" data-idx="'+idx+'" onclick="switchPayCard('+idx+')" style="flex-shrink:0;padding:8px 14px;border-radius:8px;border:1.5px solid '+(_isUnpaid?'var(--r)':'var(--b)')+';background:'+(_isUnpaid?'rgba(200,80,80,.08)':'var(--ag)')+';cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;color:'+(_isUnpaid?'var(--r)':'var(--ts)')+';transition:all .15s;white-space:nowrap">';
    o+='<span class="cp" style="background:'+gc(s)+';width:8px;height:8px;display:inline-block;border-radius:50%;margin-right:5px;vertical-align:middle"></span>';
    o+=esc(s.name);
    if(_isUnpaid)o+=' ⚠️';
    o+='</button>';
  });
  o+='</div>';

  sorted.forEach(function(s,idx){
    var ci=getCycleInfo(s);
    var fee=s.fee||0;
    var sp=payments.filter(function(p){return p.sid===s.id&&p.cycleNum===ci.cycleNum;});
    var paid=sp.filter(function(p){return p.paid;}).reduce(function(a,b){return a+(b.amount||0);},0);
    var paidAll=fee&&paid>=fee;
    var partial=fee&&paid>0&&paid<fee;
    var unpaid=fee&&paid===0;
    var badge=!fee
      ?'<span class="bdg bg-b">레슨비 미설정</span>'
      :paidAll?'<span class="bdg pay-ok">✓ 완납</span>'
      :partial?'<span class="bdg pay-partial">'+won(paid)+' 부분입금</span>'
      :'<span class="bdg pay-no">⚠️ 미입금</span>';
    var pct=ci.cycleSize>0?Math.round((ci.lessonsInCycle/ci.cycleSize)*100):0;
    var bar='<div style="margin-top:7px;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--a);border-radius:3px;transition:width .3s"></div></div>';

    o+='<div class="pay-card pay-card-slide" data-pay-idx="'+idx+'" style="'+(idx>0?'display:none':'')+'"><div class="pay-card-hd">';
    o+='<div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">';
    o+='<div style="font-size:15px;font-weight:600"><span class="cp" style="background:'+gc(s)+'"></span>'+esc(s.name)+'</div>';
    o+='<span class="bdg '+(s.cls==='pro'?'bg-a':'bg-g')+'">'+clsL(s.cls)+'</span>';
    o+='<span class="bdg bg-b">'+(s.freq===2?'주 2회':'주 1회')+'</span>';
    o+='</div>';
    o+='<div style="display:flex;align-items:center;gap:10px">';
    o+='<span style="font-size:13px;color:var(--tm)">레슨비: <strong style="color:var(--t)">'+(fee?won(fee):'미설정')+'</strong></span>';
    o+=badge;
    o+='</div></div>';

    /* 회차 현황 박스 */
    o+='<div style="padding:12px 18px;border-bottom:1px solid var(--b);background:rgba(255,255,255,.015)">';
    o+='<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">';
    /* 현재 총 회차 — 클릭하면 수정 가능 */
    o+='<button class="btn" data-sid="'+s.id+'" onclick="openEditLessonCount(this.dataset.sid)" style="background:var(--ag);border:1px solid rgba(200,169,110,.25);border-radius:10px;padding:10px 16px;min-width:72px;text-align:center;flex-shrink:0;cursor:pointer;transition:all .15s" onmouseenter="this.style.background=\'rgba(200,169,110,.22)\'" onmouseleave="this.style.background=\'var(--ag)\'">';
    o+='<div style="font-family:Cormorant Garamond,serif;font-size:30px;font-weight:900;color:var(--a);line-height:1">'+ci.totalLessons+'</div>';
    o+='<div style="font-size:9px;color:var(--tm);letter-spacing:.08em;text-transform:uppercase;margin-top:2px">회차 (탭하여 수정)</div>';
    o+='</button>';
    /* 구간 상세 */
    o+='<div style="flex:1;min-width:150px">';
    o+='<div style="font-size:12px;color:var(--tm);margin-bottom:4px">';
    o+='현재 구간: <span style="font-weight:700;color:var(--ts)">'+ci.cycleStart+'~'+ci.cycleEnd+'회</span>';
    if(ci.offset>0)o+=' <span style="color:var(--a);font-size:11px">(이전 +'+ci.offset+'회 포함)</span>';
    o+='</div>';
    o+=bar;
    if(ci.remainInCycle>0){
      o+='<div style="font-size:12px;color:var(--g);margin-top:5px">'+ci.lessonsInCycle+'/'+ci.cycleSize+'회 진행 · <b>'+ci.remainInCycle+'회</b> 후 다음 입금</div>';
    } else {
      o+='<div style="font-size:12px;font-weight:700;color:var(--r);margin-top:5px">⚡ 구간 완료 — 레슨비 필요</div>';
    }
    o+='</div></div></div>';

    /* 입금 내역 — 2개 초과 시 접기 */
    var _payWrapId='pw_'+esc(s.id).slice(-6);
    if(sp.length>2){
      /* 처음 2개 표시 */
      sp.slice(0,2).forEach(function(p){
        o+='<div class="pay-week-row">';
        o+='<div class="pay-wk-badge"><div class="pay-wk-n">'+(p.wn||'—')+'</div><div class="pay-wk-l">회차</div></div>';
        o+='<div style="flex:1"><div style="font-size:13.5px;font-weight:500">'+esc(p.date||'')+(p.note?' · '+esc(p.note):'')+'</div>';
        o+='<div style="font-size:11px;color:var(--tm);margin-top:1px">'+ci.cycleStart+'~'+ci.cycleEnd+'회 구간</div>';
        o+='</div>';
        o+='<div style="font-size:14px;font-weight:600;color:var(--season-accent,var(--a))">'+won(p.amount)+'</div>';
        o+='<div style="display:flex;gap:6px">';
        o+='<span class="bdg '+(p.paid?'pay-ok':'pay-no')+'" style="cursor:pointer" data-pid="'+p.id+'" onclick="togglePaid(this.dataset.pid)">'+(p.paid?'✓ 확인':'미확인')+'</span>';
        o+='<div class="btn bd bic bsm" data-pid="'+p.id+'" onclick="deletePayment(this.dataset.pid)">🗑</div>';
        o+='</div></div>';
      });
      /* 나머지 접기 */
      o+='<div id="'+_payWrapId+'_more" style="display:none">';
      sp.slice(2).forEach(function(p){
        o+='<div class="pay-week-row">';
        o+='<div class="pay-wk-badge"><div class="pay-wk-n">'+(p.wn||'—')+'</div><div class="pay-wk-l">회차</div></div>';
        o+='<div style="flex:1"><div style="font-size:13.5px;font-weight:500">'+esc(p.date||'')+(p.note?' · '+esc(p.note):'')+'</div>';
        o+='<div style="font-size:11px;color:var(--tm);margin-top:1px">'+ci.cycleStart+'~'+ci.cycleEnd+'회 구간</div>';
        o+='</div>';
        o+='<div style="font-size:14px;font-weight:600;color:var(--season-accent,var(--a))">'+won(p.amount)+'</div>';
        o+='<div style="display:flex;gap:6px">';
        o+='<span class="bdg '+(p.paid?'pay-ok':'pay-no')+'" style="cursor:pointer" data-pid="'+p.id+'" onclick="togglePaid(this.dataset.pid)">'+(p.paid?'✓ 확인':'미확인')+'</span>';
        o+='<div class="btn bd bic bsm" data-pid="'+p.id+'" onclick="deletePayment(this.dataset.pid)">🗑</div>';
        o+='</div></div>';
      });
      o+='</div>';
      o+='<div style="padding:8px 18px;border-top:1px solid var(--b)">';
      o+='<button onclick="(function(){var m=document.getElementById(\''+_payWrapId+'_more\');if(!m)return;var open=m.style.display===\'block\';m.style.display=open?\'none\':\'block\';this.textContent=open?\'▼ 이전 기록 '+(sp.length-2)+'건 더보기\':\'▲ 접기\';}).call(this)" style="background:none;border:none;color:var(--season-accent,var(--a));font-size:12px;font-weight:600;cursor:pointer;padding:0;font-family:inherit">▼ 이전 기록 '+(sp.length-2)+'건 더보기</button>';
      o+='</div>';
    } else {
      sp.forEach(function(p){
        o+='<div class="pay-week-row">';
        o+='<div class="pay-wk-badge"><div class="pay-wk-n">'+(p.wn||'—')+'</div><div class="pay-wk-l">회차</div></div>';
        o+='<div style="flex:1"><div style="font-size:13.5px;font-weight:500">'+esc(p.date||'')+(p.note?' · '+esc(p.note):'')+'</div>';
        o+='<div style="font-size:11px;color:var(--tm);margin-top:1px">'+ci.cycleStart+'~'+ci.cycleEnd+'회 구간</div>';
        o+='</div>';
        o+='<div style="font-size:14px;font-weight:600;color:var(--season-accent,var(--a))">'+won(p.amount)+'</div>';
        o+='<div style="display:flex;gap:6px">';
        o+='<span class="bdg '+(p.paid?'pay-ok':'pay-no')+'" style="cursor:pointer" data-pid="'+p.id+'" onclick="togglePaid(this.dataset.pid)">'+(p.paid?'✓ 확인':'미확인')+'</span>';
        o+='<div class="btn bd bic bsm" data-pid="'+p.id+'" onclick="deletePayment(this.dataset.pid)">🗑</div>';
        o+='</div></div>';
      });
    }    /* 입금 내역 — 중복 forEach 제거됨 */

    if(fee&&unpaid){
      o+='<div style="padding:10px 18px;background:rgba(200,114,114,.06);border-top:1px solid rgba(200,114,114,.15)">';
      o+='<div style="font-size:13px;color:var(--r);font-weight:600;margin-bottom:6px">⚠️ '+ci.cycleStart+'~'+ci.cycleEnd+'회 구간 레슨비 미입금</div>';
      o+='<button class="btn bp bsm" data-sid="'+s.id+'" onclick="addPayForStudent(this.dataset.sid)">+ 입금 등록</button>';
      o+='</div>';
    } else {
      o+='<div style="padding:10px 18px;border-top:'+(sp.length?'1px solid var(--b)':'none')+'"><button class="btn bg2 bsm" data-sid="'+s.id+'" onclick="addPayForStudent(this.dataset.sid)">+ 입금 내역 추가</button></div>';
    }
    /* 이전/다음 네비게이션 */
    o+='<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-top:1px solid var(--b)">';
    o+='<button onclick="switchPayCard('+(idx-1)+')" style="background:none;border:1px solid var(--b);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;color:var(--a);cursor:pointer;font-family:inherit;'+(idx===0?'visibility:hidden':'')+'">← 이전</button>';
    o+='<span style="font-size:12px;color:var(--tm);font-family:DM Mono,monospace">'+(idx+1)+' / '+sorted.length+'</span>';
    o+='<button onclick="switchPayCard('+(idx+1)+')" style="background:none;border:1px solid var(--b);border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;color:var(--a);cursor:pointer;font-family:inherit;'+(idx===sorted.length-1?'visibility:hidden':'')+'">다음 →</button>';
    o+='</div>';
    o+='</div>';
  });
  return o;
}
/* 입금 관리 카드 전환 */
function switchPayCard(idx){
  var cards=document.querySelectorAll('.pay-card-slide');
  if(idx<0||idx>=cards.length)return;
  cards.forEach(function(c){c.style.display='none';});
  cards[idx].style.display='';
  /* 네비 버튼 활성화 */
  var btns=document.querySelectorAll('.pay-nav-btn');
  btns.forEach(function(b,i){
    b.classList.toggle('on',i===idx);
    if(i===idx){b.style.outline='2px solid var(--a)';b.style.outlineOffset='1px';}
    else{b.style.outline='none';}
  });
  /* 선택한 버튼 스크롤 */
  if(btns[idx])btns[idx].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
}
function addPayForStudent(sid){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  showPayModal(sid);
}
function showPayModal(sid){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var wn=logs.filter(function(l){return l.sid===sid;}).length+getSOffset(sid);
  var existing=document.getElementById('mPay');
  if(existing)existing.remove();
  var m=document.createElement('div');
  m.id='mPay';m.className='ov open';
  m.innerHTML='<div class="modal"><div class="mh"><div class="mt">💰 입금 내역 추가 — '+esc(s.name)+'</div><div class="mc" onclick="closestOv(this)">&#x2715;</div></div><div class="mb">'
    +'<div style="background:rgba(110,163,200,.08);border:1px solid rgba(110,163,200,.18);border-radius:9px;padding:12px 14px;margin-bottom:14px;font-size:13px;color:var(--bl)">💡 토스·카카오 입금 알림 문자를 복사해서 붙여넣으면 금액이 자동으로 추출됩니다.</div>'
    +'<div class="fg" style="margin-bottom:12px">'
    +'<div class="f1 full"><label>문자 붙여넣기 (선택)</label><textarea id="pay-paste" rows="3" placeholder="[Web발신] [토스] 홍길동님이 200,000원을 보냈어요..." oninput="extractPayAmount(this.value)"></textarea></div>'
    +'<div class="f1"><label>입금액 (원) *</label><input type="number" id="pay-amount" placeholder="200000" value="'+(s.fee||'')+'"></div>'
    +'<div class="f1"><label>입금일</label><input type="date" id="pay-date" value="'+toDS(new Date())+'"></div>'
    +'<div class="f1 full"><label>메모</label><input type="text" id="pay-note" placeholder="카카오뱅크, 현금 등"></div>'
    +'</div></div>'
    +'<div class="mf"><button class="btn bg2" onclick="closestOv(this)">취소</button>'
    +'<button class="btn bp" data-sid="'+sid+'" data-wn="'+wn+'" onclick="confirmPaySave(this.dataset.sid,parseInt(this.dataset.wn))">저장</button></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
}
function extractPayAmount(text){
  var m=text.match(/([0-9,]+)원/);
  if(m){var amt=m[1].replace(/,/g,'');ge('pay-amount').value=amt;}
}
function confirmPaySave(sid,wn){
  var amount=parseInt(ge('pay-amount').value);
  if(!amount||isNaN(amount)){toast('금액을 입력해주세요','⚠️');return;}
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var ci=getCycleInfo(s);
  payments.push({id:uid(),sid:sid,sname:s.name,wn:wn,cycleNum:ci.cycleNum,amount:amount,date:ge('pay-date').value||toDS(new Date()),paid:true,note:ge('pay-note').value||''});
  saveAll();
  var m=document.getElementById('mPay');if(m)m.remove();
  toast('입금 내역 추가됨 💰');render();
}
function togglePaid(pid){var p=payments.find(function(x){return x.id===pid;});if(!p)return;p.paid=!p.paid;saveAll();render();}
function deletePayment(pid){
  vsConfirm({msg:'입금 내역 삭제',sub:'이 항목을 삭제합니다.',okLabel:'삭제',danger:true,
    onOk:function(){payments=payments.filter(function(p){return p.id!==pid;});saveAll();render();}
  });
}

/* ── 회차 직접 수정 ── */

function mkRoundBtn(html,bg,col){
  var b=document.createElement('button');
  b.style.cssText='width:46px;height:46px;border-radius:50%;background:'+bg+';border:1px solid rgba(255,255,255,.1);color:'+col+';font-size:24px;font-weight:300;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:rgba(200,169,110,.2);touch-action:manipulation';
  b.innerHTML=html;
  return b;
}
function closeEditLC(){var m=document.getElementById('mEditLC');if(m)m.remove();}

/* ── 회차 수정 모달 (리디자인) ── */
function openEditLessonCount(sid){
  var s=students.find(function(x){return x.id===sid;});
  if(!s)return;
  var ci=getCycleInfo(s);
  var ex=document.getElementById('mEditLC');if(ex)ex.remove();

  var m=document.createElement('div');
  m.id='mEditLC';m.className='ov open';
  var c=gc(s);

  var avHtml=getStudentPhoto(s)
    ?'<img src="'+getStudentPhoto(s)+'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid '+c+'66">'
    :'<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,'+c+'33,'+c+'11);border:2px solid '+c+'55;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:'+c+'">'+esc(s.name.slice(0,1))+'</div>';

  var wrap=document.createElement('div');
  wrap.className='modal';
  wrap.style.maxWidth='440px';

  /* ── 헤더 ── */
  var mh=document.createElement('div');mh.className='mh';
  mh.innerHTML=avHtml;
  var mhTxt=document.createElement('div');mhTxt.style.cssText='flex:1;min-width:0;margin-left:12px';
  var mhName=document.createElement('div');
  mhName.style.cssText='font-size:16px;font-weight:800;color:var(--t);font-family:Cormorant Garamond,serif';
  mhName.textContent=s.name;
  var mhSub=document.createElement('div');
  mhSub.style.cssText='font-size:11.5px;color:var(--tm);margin-top:3px';
  mhSub.textContent=(s.freq===2?'주 2회 · 8회마다 입금':'주 1회 · 4회마다 입금');
  mhTxt.appendChild(mhName);mhTxt.appendChild(mhSub);
  var mhClose=document.createElement('div');mhClose.className='mc';
  mhClose.innerHTML='&#x2715;';mhClose.addEventListener('click',closeEditLC);
  mh.appendChild(mhTxt);mh.appendChild(mhClose);

  /* ── 본문 ── */
  var mb=document.createElement('div');mb.className='mb';
  mb.style.cssText='display:flex;flex-direction:column;gap:16px';

  /* 현재 회차 요약 칩 */
  var chip=document.createElement('div');
  chip.style.cssText='background:var(--s2);border:1px solid var(--b);border-radius:10px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between';
  chip.innerHTML='<span style="font-size:12px;color:var(--tm)">현재 총 회차</span>'
    +'<span style="font-family:Cormorant Garamond,serif;font-size:22px;font-weight:900;color:var(--a)">'+ci.totalLessons+'<span style="font-size:12px;color:var(--tm);font-weight:400;font-family:DM Sans,sans-serif">회</span></span>';
  mb.appendChild(chip);

  /* ── 숫자 입력 섹션 ── */
  var numSec=document.createElement('div');
  numSec.style.cssText='display:flex;flex-direction:column;gap:8px';

  var numLbl=document.createElement('label');
  numLbl.style.cssText='font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--tm);font-weight:600';
  numLbl.textContent='새 회차 입력';
  numSec.appendChild(numLbl);

  /* +/- 행 */
  var numRow=document.createElement('div');
  numRow.style.cssText='display:flex;align-items:center;gap:10px';

  /* mkRoundBtn은 전역 선언 */
  var btnMinus=mkRoundBtn('&#x2212;','rgba(255,255,255,.06)','var(--ts)');
  var btnPlus =mkRoundBtn('&#x2B;','rgba(200,169,110,.15)','var(--a)');

  /* 숫자 입력 */
  var inp=document.createElement('input');
  inp.type='number';inp.id='elc-total';inp.min='0';inp.placeholder='0';
  inp.value=ci.totalLessons>0?ci.totalLessons:'';
  inp.style.cssText='flex:1;font-family:Cormorant Garamond,serif;font-size:36px;font-weight:900;color:var(--a);text-align:center;padding:10px 0;background:var(--s2);border:2px solid rgba(200,169,110,.3);border-radius:12px;outline:none;-moz-appearance:textfield;-webkit-appearance:none';
  inp.dataset.sid=sid;
  inp.addEventListener('input',function(){previewEditLC(this.value,this.dataset.sid);});

  btnMinus.addEventListener('click',function(){
    var v=parseInt(document.getElementById('elc-total').value)||0;
    if(v>0){document.getElementById('elc-total').value=v-1;previewEditLC(v-1,sid);}
  });
  btnPlus.addEventListener('click',function(){
    var v=parseInt(document.getElementById('elc-total').value)||0;
    document.getElementById('elc-total').value=v+1;previewEditLC(v+1,sid);
  });

  numRow.appendChild(btnMinus);numRow.appendChild(inp);numRow.appendChild(btnPlus);

  var numHint=document.createElement('div');
  numHint.style.cssText='font-size:11px;color:var(--tm);text-align:center';
  numHint.textContent='앱 기록 '+ci.actualLessons+'회 포함 총 회차';

  numSec.appendChild(numRow);numSec.appendChild(numHint);
  mb.appendChild(numSec);

  /* ── 미리보기 ── */
  var prev=document.createElement('div');prev.id='elc-preview';
  prev.style.cssText='border-radius:12px;overflow:hidden;border:1px solid var(--b)';
  _renderEditLCPreview(prev,ci.totalLessons,s.freq);
  mb.appendChild(prev);

  /* ── 푸터 ── */
  var mf=document.createElement('div');mf.className='mf';
  var btnC=document.createElement('button');btnC.className='btn bg2';btnC.textContent='취소';
  btnC.addEventListener('click',closeEditLC);
  var btnS=document.createElement('button');
  btnS.className='btn bp';btnS.style.cssText='flex:1;justify-content:center';
  btnS.innerHTML='💾 저장';btnS.dataset.sid=sid;
  btnS.addEventListener('click',function(){saveEditLessonCount(this.dataset.sid);});
  mf.appendChild(btnC);mf.appendChild(btnS);

  wrap.appendChild(mh);wrap.appendChild(mb);wrap.appendChild(mf);
  m.appendChild(wrap);
  m.addEventListener('click',function(ev){if(ev.target===m)closeEditLC();});
  document.body.appendChild(m);
  setTimeout(function(){var el=document.getElementById('elc-total');if(el){el.focus();el.select();}},120);
}


/* 미리보기 패널 렌더 */
function _renderEditLCPreview(el,total,freq){
  total=parseInt(total)||0;
  var cs=freq===2?8:4;
  var cn=total>0?Math.floor((total-1)/cs)+1:1;
  var pos=total>0?((total-1)%cs)+1:0;
  var cStart=(cn-1)*cs+1;var cEnd=cn*cs;
  var rem=cs-pos;
  var pct=cs>0?Math.round(pos/cs*100):0;
  /* 타임라인 도트 */
  var dots='';
  for(var i=1;i<=cs;i++){
    var done=i<=pos;
    var isCur=i===pos&&total>0;
    dots+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">';
    dots+='<div style="width:'+(isCur?'18px':'12px')+';height:'+(isCur?'18px':'12px')+';border-radius:50%;';
    dots+=done?'background:'+(isCur?'var(--a)':'rgba(200,169,110,.5)')+';':'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);';
    if(isCur)dots+='box-shadow:0 0 8px rgba(200,169,110,.5);';
    dots+='transition:all .2s"></div>';
    dots+='<div style="font-size:9px;color:'+(done?'var(--a)':'var(--tm)')+';">'+(cStart+i-1)+'</div>';
    dots+='</div>';
  }
  /* 선 연결 */
  var linePct=cs>1?Math.round((pos-0.5)/cs*100):0;
  el.innerHTML=
    /* 구간 헤더 */
    '<div style="padding:12px 16px;background:rgba(255,255,255,.02);border-bottom:1px solid var(--b);display:flex;justify-content:space-between;align-items:center">'
   +'<div style="font-size:11px;font-weight:700;color:var(--a);letter-spacing:.08em">'+cStart+'회 ~ '+cEnd+'회 구간</div>'
   +'<div style="font-size:11px;color:var(--tm)">'+pos+'/'+cs+' 진행</div>'
   +'</div>'
    /* 타임라인 도트 */
   +'<div style="padding:16px 16px 12px;position:relative">'
   +'<div style="position:absolute;top:24px;left:24px;right:24px;height:2px;background:rgba(255,255,255,.06);border-radius:1px">'
   +'<div style="height:100%;width:'+linePct+'%;background:rgba(200,169,110,.35);border-radius:1px;transition:width .3s"></div></div>'
   +'<div style="display:flex;position:relative;z-index:1">'+dots+'</div>'
   +'</div>'
    /* 입금 상태 바 */
   +'<div style="padding:10px 16px;border-top:1px solid var(--b);display:flex;align-items:center;justify-content:space-between">'
   +(rem>0
     ?'<div style="font-size:12.5px;color:var(--g);font-weight:600">다음 입금까지 <b>'+rem+'회</b> 남음</div>'
        +'<div style="font-size:11px;color:var(--tm)">'+cEnd+'회 완료 시</div>'
     :'<div style="font-size:12.5px;color:var(--r);font-weight:700">⚡ 구간 완료 — 입금 필요</div>'
        +'<div style="font-size:11px;color:var(--tm)">'+cEnd+'회 기준</div>'
    )
   +'</div>';
}

function previewEditLC(val,sid){
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var prev=document.getElementById('elc-preview');if(!prev)return;
  _renderEditLCPreview(prev,val,s.freq);
}
function saveEditLessonCount(sid){
  var inp=document.getElementById('elc-total');
  var total=inp?parseInt(inp.value)||0:0;
  var s=students.find(function(x){return x.id===sid;});if(!s)return;
  var actual=logs.filter(function(l){return l.sid===sid&&l.att!=='결석';}).length;
  var offset=Math.max(0,total-actual);
  s.lessonOffset=offset;
  var cs=s.freq===2?8:4;
  payments.filter(function(p){return p.sid===sid;}).forEach(function(p){
    var t=p.wn||0;
    var cn=t>0?Math.floor((t-1)/cs)+1:1;
    p.cycleNum=cn;p.cycleStart=(cn-1)*cs+1;p.cycleEnd=cn*cs;
  });
  saveAll();closeEditLC();
  var newCi=getCycleInfo(s);
  toast('✅ '+esc(s.name)+' — 총 '+newCi.totalLessons+'회차로 저장됨');
  render();
}

/* LESSON RECORD */
var lrSid=null,lrLogId=null;
/* 레슨기록 모달 라디오 헬퍼 */