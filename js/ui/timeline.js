/* ============================================================
   timeline.js — 진도 타임라인
   _tlSid : 선택된 학생 ID (전역)
   buildTimeline() : 진도 타임라인 HTML 생성
   ============================================================ */

/* ── 진도 타임라인 ── */
var _tlSid=null;
function buildTimeline(){
  var active=students.filter(function(s){return s.status==='수강중';});
  var all=students.slice();
  if(!all.length)return '<div class="empty"><div class="ei">📈</div><div class="et">등록된 레슨생이 없습니다</div></div>';

  /* 선택된 레슨생 (기본: 첫 번째 수강중) */
  var sel=_tlSid?students.find(function(x){return x.id===_tlSid;}):null;
  if(!sel)sel=active[0]||all[0];
  _tlSid=sel.id;

  var o='<div style="max-width:700px;margin:0 auto">';

  /* 레슨생 선택 바 */
  o+='<div style="display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch">';
  active.forEach(function(s){
    var isOn=s.id===_tlSid;
    o+='<button onclick="_tlSid=\''+s.id+'\';render()" style="flex-shrink:0;padding:8px 16px;border-radius:8px;border:1.5px solid '+(isOn?'var(--a)':'var(--b)')+';background:'+(isOn?'var(--a)':'var(--ag)')+';color:'+(isOn?'#08080d':'var(--ts)')+';font-size:12.5px;font-weight:'+(isOn?'700':'500')+';cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap">';
    o+='<span class="cp" style="background:'+gc(s)+';width:8px;height:8px;display:inline-block;border-radius:50%;margin-right:5px;vertical-align:middle"></span>';
    o+=esc(s.name);
    o+='</button>';
  });
  /* 휴원/중단 레슨생도 접근 가능 */
  var inactive=all.filter(function(s){return s.status!=='수강중';});
  if(inactive.length){
    o+='<span style="border-left:1px solid var(--b);margin:0 4px"></span>';
    inactive.forEach(function(s){
      var isOn=s.id===_tlSid;
      o+='<button onclick="_tlSid=\''+s.id+'\';render()" style="flex-shrink:0;padding:8px 14px;border-radius:8px;border:1px solid var(--b);background:'+(isOn?'rgba(140,140,140,.2)':'rgba(140,140,140,.05)')+';color:var(--tm);font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;opacity:.7;white-space:nowrap">';
      o+=esc(s.name)+' <span style="font-size:10px">('+esc(s.status||'')+')</span>';
      o+='</button>';
    });
  }
  o+='</div>';

  /* 선택된 레슨생 프로필 카드 */
  var c=gc(sel),c2=COLORS[(students.indexOf(sel)+2)%COLORS.length];
  var ci=getCycleInfo(sel);
  var sLogs=logs.filter(function(l){return l.sid===sel.id;}).sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});
  var attCount=sLogs.filter(function(l){return l.att==='출석';}).length;
  var absentCount=sLogs.filter(function(l){return l.att==='결석';}).length;
  var cancelCount=sLogs.filter(function(l){return l.att==='취소';}).length;
  var totalL=sLogs.length;
  var attRate=totalL>0?Math.round((attCount/totalL)*100):0;

  o+='<div style="background:linear-gradient(135deg,rgba(200,169,110,.1) 0%,rgba(16,16,26,0) 60%);border:1px solid var(--b2);border-radius:16px;padding:20px 22px;margin-bottom:20px">';
  o+='<div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">';
  /* 아바타 */
  var avStyle='width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,'+c+','+c2+');display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#08080d;flex-shrink:0;overflow:hidden';
  o+='<div style="'+avStyle+'">'+(getStudentPhoto(sel)?'<img src="'+getStudentPhoto(sel)+'" style="width:100%;height:100%;object-fit:cover">':esc(sel.name.slice(0,1)))+'</div>';
  o+='<div style="flex:1">';
  o+='<div style="font-size:19px;font-weight:700;margin-bottom:3px">'+esc(sel.name)+'</div>';
  o+='<div style="font-size:12.5px;color:var(--tm)">'+clsL(sel.cls)+' · '+(sel.freq===2?'주 2회':'주 1회')+' · 총 '+ci.totalLessons+'회차</div>';
  o+='</div>';
  o+='<div style="text-align:right">';
  o+='<div style="font-family:Cormorant Garamond,serif;font-size:36px;font-weight:900;color:'+(attRate>=80?'var(--g)':attRate>=60?'var(--a)':'var(--r)')+';line-height:1">'+attRate+'<span style="font-size:16px">%</span></div>';
  o+='<div style="font-size:10px;color:var(--tm);letter-spacing:.1em;text-transform:uppercase;margin-top:2px">출석률</div>';
  o+='</div></div>';

  /* 통계 바 */
  o+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';
  o+='<div style="text-align:center;padding:8px;background:rgba(42,138,96,.08);border-radius:8px;border:1px solid rgba(42,138,96,.15)"><div style="font-size:20px;font-weight:900;color:var(--g);font-family:Cormorant Garamond,serif">'+attCount+'</div><div style="font-size:10px;color:var(--tm);letter-spacing:.08em">출석</div></div>';
  o+='<div style="text-align:center;padding:8px;background:rgba(200,80,80,.08);border-radius:8px;border:1px solid rgba(200,80,80,.15)"><div style="font-size:20px;font-weight:900;color:var(--r);font-family:Cormorant Garamond,serif">'+absentCount+'</div><div style="font-size:10px;color:var(--tm);letter-spacing:.08em">결석</div></div>';
  o+='<div style="text-align:center;padding:8px;background:rgba(140,140,140,.08);border-radius:8px;border:1px solid rgba(140,140,140,.15)"><div style="font-size:20px;font-weight:900;color:var(--tm);font-family:Cormorant Garamond,serif">'+cancelCount+'</div><div style="font-size:10px;color:var(--tm);letter-spacing:.08em">취소</div></div>';
  o+='</div>';

  /* 출석 비율 바 */
  if(totalL>0){
    var wA=Math.round((attCount/totalL)*100);
    var wB=Math.round((absentCount/totalL)*100);
    var wC=100-wA-wB;
    o+='<div class="tl-stats-bar" style="margin-top:10px">';
    if(wA>0)o+='<div style="width:'+wA+'%;background:var(--g)"></div>';
    if(wB>0)o+='<div style="width:'+wB+'%;background:var(--r)"></div>';
    if(wC>0)o+='<div style="width:'+wC+'%;background:var(--tm)"></div>';
    o+='</div>';
  }
  o+='</div>';

  /* 타임라인 본체 */
  if(!sLogs.length){
    o+='<div class="empty"><div class="ei">📝</div><div class="et">아직 레슨 기록이 없습니다</div></div>';
    o+='</div>';return o;
  }

  /* 월별 그루핑 */
  var months={};
  sLogs.forEach(function(l){
    var ym=(l.date||'').slice(0,7);
    if(!months[ym])months[ym]=[];
    months[ym].push(l);
  });
  var monthKeys=Object.keys(months).sort(function(a,b){return b.localeCompare(a);});

  monthKeys.forEach(function(ym){
    var parts=ym.split('-');
    var mLabel=(parseInt(parts[1])||1)+'월';
    var yLabel=parts[0]||'';
    o+='<div class="tl-month-hd">'+yLabel+' '+mLabel+'</div>';
    o+='<div class="tl-line">';
    months[ym].forEach(function(l){
      var dotCls=l.att==='결석'?'absent':l.att==='취소'?'cancel':'';
      o+='<div style="position:relative">';
      o+='<div class="tl-dot '+dotCls+'"></div>';
      o+='<div class="tl-item" onclick="editLogByIdEl(\''+l.id+'\')" style="cursor:pointer">';
      /* 헤더: 날짜 + 회차 + 출결 */
      o+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      o+='<span style="font-size:13px;font-weight:700;color:var(--a);font-family:DM Mono,monospace">'+esc(l.date||'').slice(5)+'</span>';
      o+='<span style="font-size:11px;color:var(--tm);background:var(--ag);border-radius:4px;padding:1px 7px;font-weight:600">제'+l.wn+'회</span>';
      var attCol=l.att==='출석'?'var(--g)':l.att==='결석'?'var(--r)':'var(--tm)';
      o+='<span style="font-size:10.5px;background:'+attCol+'22;color:'+attCol+';border-radius:4px;padding:1px 7px;font-weight:600">'+esc(l.att||'출석')+'</span>';
      if(l.rt){var stars='';for(var ri=0;ri<5;ri++)stars+='<span style="color:'+(ri<parseInt(l.rt)?'var(--a)':'var(--b)')+'">★</span>';o+='<span style="font-size:10px;margin-left:auto">'+stars+'</span>';}
      o+='</div>';
      /* 본문 */
      if(l.ct)o+='<div style="font-size:13px;color:var(--ts);margin-bottom:3px"><span style="color:var(--tm);font-size:11px;margin-right:4px">📝</span>'+esc(l.ct)+'</div>';
      if(l.fb)o+='<div style="font-size:12.5px;color:var(--r);margin-bottom:3px"><span style="font-size:11px;margin-right:4px">⚠️</span>'+esc(l.fb)+'</div>';
      if(l.hw)o+='<div style="font-size:12.5px;color:var(--g);margin-bottom:3px"><span style="font-size:11px;margin-right:4px">📋</span>'+esc(l.hw)+'</div>';
      if(l.note)o+='<div style="font-size:12px;color:var(--tm);font-style:italic">'+esc(l.note)+'</div>';
      if(!l.ct&&!l.fb&&!l.hw&&!l.note)o+='<div style="font-size:12px;color:var(--tm);font-style:italic">기록 내용 없음</div>';
      o+='</div></div>';
    });
    o+='</div>';
  });

  o+='</div>';
  return o;
}
