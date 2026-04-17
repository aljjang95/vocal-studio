/* ============================================================
   logs.js — 레슨 기록
   buildLogs() : 레슨 기록 목록 HTML
   filterLogs() : 기록 필터링
   setLrAtt() : 출결 설정
   setLrRt() : 평점 설정
   syncLrUI() : 레슨 기록 UI 동기화
   openLessonRecord() : 레슨 기록 모달 열기
   saveLR() : 레슨 기록 저장
   deleteLog() : 기록 삭제
   editLogByIdEl() : 기록 ID로 편집 열기
   ============================================================ */

/* LOGS */
function buildLogs(filter){
  var f=filter?logs.filter(function(l){return (l.sn&&l.sn.indexOf(filter)>=0)||(l.ct&&l.ct.indexOf(filter)>=0);}):logs;
  var o='<div class="sh">';
  o+='<div class="st2">레슨 기록 <span style="font-size:16px;color:var(--tm);font-weight:400">('+logs.length+'건)</span></div>';
  o+='<input type="text" placeholder="🔍 이름·내용 검색" value="'+esc(filter||'')+'" style="background:rgba(255,255,255,.05);border:1px solid var(--b);color:var(--t);padding:8px 14px;border-radius:9px;font-size:13.5px;width:200px;outline:none;" oninput="filterLogs(this.value)">';
  o+='</div><div class="llist">';
  if(!f.length){o+='<div class="empty"><div class="ei">✎</div><div class="et">레슨 기록이 없습니다</div><div class="ed">주간 스케줄에서 레슨 블록을 클릭해 기록하세요</div></div>';}
  else f.forEach(function(l){
    var s=students.find(function(st){return st.id===l.sid;});
    var c=s?gc(s):'var(--a)';
    var c2=s?COLORS[(students.indexOf(s)+2)%COLORS.length]:'#6ea3c8';
    var attColor=l.att==='출석'?'var(--g)':l.att==='결석'?'var(--r)':'var(--bl)';
    var stars='';for(var si=0;si<parseInt(l.rt||3);si++)stars+='★';
    var avH=s&&getStudentPhoto(s)?'<img src="'+getStudentPhoto(s)+'" style="width:42px;height:42px;border-radius:50%;object-fit:cover">':'<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,'+c+','+c2+');display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#08080d;flex-shrink:0">'+esc((l.sn||'?').slice(0,1))+'</div>';
    o+='<div style="background:var(--s1);border:1px solid var(--b);border-radius:14px;padding:14px 16px;display:flex;gap:13px;align-items:flex-start;cursor:pointer;transition:border-color .14s" data-lid="'+l.id+'" onclick="editLogByIdEl(this.dataset.lid)" onmouseenter="this.style.borderColor=\'rgba(200,169,110,.22)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'">';
    /* 아바타 + 주차 */
    o+='<div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:0">';
    o+=avH;
    o+='<div style="background:var(--ag);border:1px solid rgba(200,169,110,.16);border-radius:6px;width:42px;text-align:center;padding:3px 0">';
    o+='<div style="font-family:Cormorant Garamond,serif;font-size:14px;font-weight:700;color:var(--a);line-height:1">'+l.wn+'</div>';
    o+='<div style="font-size:8px;color:var(--tm);letter-spacing:.08em">주차</div>';
    o+='</div></div>';
    /* 내용 */
    o+='<div style="flex:1;min-width:0">';
    o+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;flex-wrap:wrap">';
    o+='<span style="font-size:15px;font-weight:700;color:var(--t)">'+esc(l.sn)+'</span>';
    o+='<span style="font-size:11.5px;font-weight:700;color:'+attColor+';background:'+attColor+'18;border-radius:5px;padding:2px 7px">'+esc(l.att)+'</span>';
    o+='<span style="font-size:11px;color:var(--tm);font-family:DM Mono,monospace">'+esc(l.date)+'</span>';
    o+='<span style="font-size:11px;color:var(--a);letter-spacing:-.05em">'+stars+'</span>';
    if(l.note)o+='<span style="font-size:11px;color:var(--tm);background:rgba(255,255,255,.04);border-radius:4px;padding:1px 6px">'+esc(l.note)+'</span>';
    o+='</div>';
    if(l.ct)o+='<div style="font-size:12.5px;color:var(--ts);margin-bottom:3px;display:flex;gap:6px"><span style="color:var(--a);font-weight:600;flex-shrink:0">📝</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(l.ct)+'</span></div>';
    if(l.fb)o+='<div style="font-size:12.5px;color:var(--r);opacity:.9;margin-bottom:3px;display:flex;gap:6px"><span style="flex-shrink:0">⚠️</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(l.fb)+'</span></div>';
    if(l.hw)o+='<div style="font-size:12.5px;color:var(--g);opacity:.9;display:flex;gap:6px"><span style="flex-shrink:0">📋</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(l.hw)+'</span></div>';
    o+='</div></div>';
  });
  return o+'</div>';
}
function filterLogs(val){
  ge('content').innerHTML=buildLogs(val);
  var inp=ge('content').querySelector('input[type=text]');
  if(inp){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);}
}

/* PAYMENT */

function setLrAtt(el,val){
  ['출석','결석','보강'].forEach(function(v){
    var b=ge('lr-att-'+v);if(b)b.classList.toggle('on',v===val);
  });
  var h=ge('lr-att');if(h)h.value=val;
}
function setLrRt(val){
  for(var i=1;i<=5;i++){var b=ge('lr-rt-'+i);if(b)b.classList.toggle('on',String(i)===String(val));}
  var h=ge('lr-rt');if(h)h.value=val;
}
function syncLrUI(){
  /* 현재 hidden input 값으로 라디오 버튼 상태 동기화 */
  var att=gv('lr-att')||'출석';
  setLrAtt(null,att);
  var rt=gv('lr-rt')||'3';
  setLrRt(rt);
}

function openLessonRecord(sid,time,dateStr){
  lrSid=sid;
  var s=students.find(function(st){return st.id===sid;});if(!s)return;
  var existing=logs.find(function(l){return l.sid===sid&&l.date===dateStr;});lrLogId=existing?existing.id:null;
  var c=gc(s),c2=COLORS[(students.indexOf(s)+2)%COLORS.length];
  ge('lrTitle').textContent='레슨 기록 — '+s.name;
  ge('lrMeta').textContent=dateStr+(time?' · '+time:'');
  var av=ge('lrAv');
  if(getStudentPhoto(s)){av.innerHTML='<img src="'+getStudentPhoto(s)+'" style="width:44px;height:44px;border-radius:50%;object-fit:cover">';av.style.background='transparent';}
  else{av.style.background='linear-gradient(135deg,'+c+','+c2+')';av.style.display='flex';av.style.alignItems='center';av.style.justifyContent='center';av.style.fontSize='18px';av.style.fontWeight='700';av.style.color='#08080d';av.textContent=s.name.slice(0,1);}
  ge('lrName').textContent=s.name;
  ge('lrInfo').textContent=clsL(s.cls)+' · '+(s.gd||'')+(s.age?' · '+(function(a){var raw=String(a||'').trim();if(!raw)return '';var n=parseInt(raw)||0;var yr=raw.length<=2&&n>=0?(n>=30?1900+n:2000+n):n;var ty=new Date().getFullYear();return (yr>=1920&&yr<=ty)?'만 '+(ty-yr)+'세':'';})(s.age):'');
  var wn=logs.filter(function(l){return l.sid===sid&&new Date(l.date)<=new Date(dateStr);}).length+(existing?0:1)+getSOffset(sid);
  ge('lrWN').textContent=wn;
  ge('lr-date').value=dateStr;
  ge('lr-att').value=(existing&&existing.att)||'출석';
  ge('lr-ct').value=(existing&&existing.ct)||'';
  ge('lr-fb').value=(existing&&existing.fb)||'';
  ge('lr-hw').value=(existing&&existing.hw)||'';
  ge('lr-rt').value=(existing&&existing.rt)||'3';
  ge('lr-note').value=(existing&&existing.note)||'';
  ge('lrBtnDel').style.display=existing?'flex':'none';
  om('mLR');
  setTimeout(syncLrUI, 50);
}
function saveLR(){
  if(!lrSid)return;
  var s=students.find(function(st){return st.id===lrSid;});
  var date=gv('lr-date');
  var wn=logs.filter(function(l){return l.sid===lrSid&&new Date(l.date)<=new Date(date);}).length+(lrLogId?0:1)+getSOffset(lrSid);
  var entry={id:lrLogId||uid(),sid:lrSid,sn:s.name,date:date,ct:gv('lr-ct'),fb:gv('lr-fb'),hw:gv('lr-hw'),att:gv('lr-att'),rt:gv('lr-rt'),note:gv('lr-note'),wn:wn,createdAt:Date.now()};
  if(lrLogId){var i=logs.findIndex(function(l){return l.id===lrLogId;});logs[i]=entry;}else logs.unshift(entry);
  saveAll();cm('mLR');renderSidebarToday();toast(s.name+' 기록 저장 ✍️');render();
}
function deleteLog(){
  if(!lrLogId)return;
  vsConfirm({msg:'레슨 기록 삭제',sub:'이 기록을 삭제합니다.',okLabel:'삭제',danger:true,
    onOk:function(){
      logs=logs.filter(function(l){return l.id!==lrLogId;});
      saveAll();cm('mLR');toast('삭제됨','🗑');render();
    }
  });
}
function editLogByIdEl(lid){
  var l=logs.find(function(x){return x.id===lid;});if(!l)return;
  openLessonRecord(l.sid,'',l.date);
  ge('lr-ct').value=l.ct||'';ge('lr-fb').value=l.fb||'';ge('lr-hw').value=l.hw||'';
  ge('lr-att').value=l.att||'출석';ge('lr-rt').value=l.rt||'3';ge('lr-note').value=l.note||'';
  ge('lrTitle').textContent='레슨 기록 수정 — '+l.sn;
  ge('lrMeta').textContent=l.date;ge('lrWN').textContent=l.wn;lrLogId=lid;
  ge('lrBtnDel').style.display='flex';
  setTimeout(syncLrUI,50);
}