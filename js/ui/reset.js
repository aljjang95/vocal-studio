/**
 * reset.js — 데이터 초기화 (주간/전체)
 */
function resetWeekOvr(){
  var mon=getViewMon(),wk=getWK(mon);
  if(!weekOvr[wk]||Object.keys(weekOvr[wk]).length===0){
    toast('초기화할 내용이 없습니다');return;
  }
  vsConfirm({
    msg:'이번 주 스케줄 초기화',
    sub:'임시 배정·변경 내용이 모두 삭제되고<br>원래 고정 스케줄로 돌아갑니다.',
    okLabel:'초기화',danger:true,
    onOk:function(){
      delete weekOvr[wk];
      saveAll();
      try{var _db3=firebase.firestore();_db3.collection('studio').doc('data').set({weekOvr:weekOvr},{merge:true});}catch(e){}
      toast('✅ 초기화 완료');render();
    }
  });
}

function resetAllData(){
  vsConfirm({
    msg:'전체 데이터 초기화',
    sub:'⚠️ 모든 레슨생, 레슨 기록, 스케줄,<br>상담 신청서가 영구 삭제됩니다.<br><b style="color:var(--r)">되돌릴 수 없습니다.</b>',
    okLabel:'삭제',danger:true,
    onOk:function(){
      /* 2차 확인 — 텍스트 입력 모달 */
      var ex2=document.getElementById('mResetConfirm2');if(ex2)ex2.remove();
      var m2=document.createElement('div');
      m2.id='mResetConfirm2';m2.className='ov open';
      m2.innerHTML='<div class="modal" style="max-width:320px">'
        +'<div class="mb" style="padding:24px">'
        +'<div style="font-size:15px;font-weight:700;color:var(--r);margin-bottom:12px">정말 삭제하시겠습니까?</div>'
        +'<div style="font-size:13px;color:var(--tm);margin-bottom:14px">확인을 위해 <b style="color:var(--t)">초기화</b>를 입력해주세요.</div>'
        +'<input type="text" id="resetConfirmInput" placeholder="초기화" style="font-size:15px;text-align:center">'
        +'</div>'
        +'<div style="padding:0 20px 20px;display:flex;gap:8px">'
        +'<button class="btn bg2" style="flex:1;justify-content:center" onclick="document.getElementById(\'mResetConfirm2\').remove()">취소</button>'
        +'<button class="btn bd" style="flex:1;justify-content:center" onclick="(function(){var v=document.getElementById(\'resetConfirmInput\').value;if(v!==\'초기화\'){toast(\'취소되었습니다\');document.getElementById(\'mResetConfirm2\').remove();return;}document.getElementById(\'mResetConfirm2\').remove();var ks=[];for(var ki=0;ki<localStorage.length;ki++){var kk=localStorage.key(ki);if(kk&&(kk.slice(0,2)===\'vs\'||kk.slice(0,2)===\'VS\'))ks.push(kk);}ks.forEach(function(kk){localStorage.removeItem(kk);});students=[];logs=[];weekOvr={};consults=[];payments=[];toast(\'초기화 완료 🗑\');render();renderSidebarToday();})()">삭제 실행</button>'
        +'</div></div>';
      m2.addEventListener('click',function(ev){if(ev.target===m2)m2.remove();});
      document.body.appendChild(m2);
      setTimeout(function(){var el=document.getElementById('resetConfirmInput');if(el)el.focus();},100);
    }
  });
}