/**
 * alert.js — 오늘 알림 배너 + 데이터 초기화
 */
function showTodayAlert(){
  var now=new Date(),todayStr=toDS(now);
  /* 오늘 이미 닫았으면 표시 안 함 */
  try{
    var dismissed=localStorage.getItem('vsC_alertDismissed');
    if(dismissed===todayStr)return;
  }catch(e){}

  var todayDay=JSDOW[now.getDay()];
  var alerts=[];

  /* 미입금 레슨생 */
  var unpaidS=students.filter(function(s){
    if(s.status!=='수강중'||!(s.fee>0))return false;
    var ci=getCycleInfo(s);
    var paid=payments.filter(function(p){return p.sid===s.id&&p.cycleNum===ci.cycleNum&&p.paid;}).reduce(function(a,b){return a+(b.amount||0);},0);
    return paid<(s.fee||0);
  });
  if(unpaidS.length)alerts.push({icon:'💰',color:'var(--r)',text:'미입금 '+unpaidS.length+'명: '+unpaidS.slice(0,3).map(function(s){return esc(s.name);}).join(', ')+(unpaidS.length>3?' 외 '+(unpaidS.length-3)+'명':''),action:"go('payment')"});

  /* 오늘 레슨 중 기록 없는 것 */
  var mon=getMon(now);var sched=getWeekSched(mon);
  var nowMins=now.getHours()*60+now.getMinutes();
  var unlogged=[];
  HOURS.forEach(function(h){
    var hp=h.split(':');var slotMins=parseInt(hp[0])*60+parseInt(hp[1]||0);
    if(slotMins<nowMins-30){
      (sched[todayDay+'_'+h]||[]).forEach(function(x){
        if(!x.absent&&!logs.find(function(l){return l.sid===x.s.id&&l.date===todayStr;})){
          unlogged.push(x.s.name);
        }
      });
    }
  });
  if(unlogged.length)alerts.push({icon:'✍️',color:'var(--a)',text:'레슨 기록 미작성 '+unlogged.length+'건: '+unlogged.slice(0,3).join(', ')+(unlogged.length>3?' 외 '+(unlogged.length-3)+'건':''),action:"go('today')"});

  if(!alerts.length)return;

  var ex=document.getElementById('mTodayAlert');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mTodayAlert';m.className='ov open';
  var html='<div class="modal" style="max-width:380px">'
    +'<div class="mh"><div><div class="mt">🔔 오늘의 알림</div><div style="font-size:12px;color:var(--tm);margin-top:2px">확인이 필요한 항목이 있습니다</div></div>'
    +'<div class="mc" onclick="document.getElementById(\'mTodayAlert\').remove()">&#x2715;</div></div>'
    +'<div class="mb" style="display:flex;flex-direction:column;gap:8px">';
  alerts.forEach(function(a){
    html+='<div style="background:rgba(255,255,255,.03);border:1px solid var(--b);border-radius:10px;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;cursor:pointer;transition:border-color .13s" onmouseenter="this.style.borderColor=\'rgba(200,169,110,.22)\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,.07)\'" onclick="document.getElementById(\'mTodayAlert\').remove();'+a.action+'">'
      +'<span style="font-size:20px;flex-shrink:0">'+a.icon+'</span>'
      +'<div style="flex:1;font-size:13px;color:var(--ts);line-height:1.5">'+a.text+'</div>'
      +'<span style="font-size:12px;color:var(--tm);flex-shrink:0;margin-top:2px">→</span>'
      +'</div>';
  });
  html+='</div>'
    +'<div class="mf" style="justify-content:space-between">'
    +'<button class="btn bg2 bsm" onclick="(function(){try{localStorage.setItem(\'vsC_alertDismissed\',\''+todayStr+'\');}catch(e){}document.getElementById(\'mTodayAlert\').remove();toast(\'오늘 하루 알림 닫힘\')})()">오늘 하루 닫기</button>'
    +'<button class="btn bp" style="min-width:80px;justify-content:center" onclick="document.getElementById(\'mTodayAlert\').remove()">확인</button>'
    +'</div></div>';
  m.innerHTML=html;
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
}
/* Firebase 로드 후 또는 3초 후 알림 표시 */
setTimeout(function(){
  if(students.length>0)showTodayAlert();
},3000);