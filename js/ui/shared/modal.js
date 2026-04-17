/**
 * modal.js — 모달/오버레이/토스트/확인 다이얼로그 공용 컴포넌트
 * 기존 코드에서 innerHTML 사용 — 원본 그대로 유지 (내부 데이터만 사용, 외부 입력 없음)
 */

function openLightbox(src){
  var img=ge('lightboxImg');if(!img)return;
  img.src=src;om('mLightbox');
}

function closestOv(el){var p=el;while(p&&!p.classList.contains("ov"))p=p.parentElement;if(p)p.remove();}
function om(id){ge(id).classList.add('open');}
function cm(id){ge(id).classList.remove('open');}

function toast(msg,ic){
  ge('t-msg').textContent=msg;ge('t-ic').textContent=ic||'✓';
  var t=ge('toast');t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2800);
}

/* 인앱 확인 다이얼로그 (브라우저 confirm 대체) */
function vsConfirm(opts){
  var ex=document.getElementById('mVsConfirm');if(ex)ex.remove();
  var m=document.createElement('div');
  m.id='mVsConfirm';m.className='ov open';
  var okCls=opts.danger?'btn bd':'btn bp';
  if(opts.okClass)okCls=opts.okClass;
  var content='<div class="modal" style="max-width:320px">'
    +'<div class="mb" style="text-align:center;padding:28px 24px 20px">'
    +'<div style="font-size:36px;margin-bottom:12px">'+(opts.danger?'🗑':'❓')+'</div>'
    +'<div style="font-size:16px;font-weight:700;color:var(--t);margin-bottom:8px;line-height:1.4">'+opts.msg+'</div>'
    +(opts.sub?'<div style="font-size:13px;color:var(--tm);line-height:1.5">'+opts.sub+'</div>':'')
    +'</div>'
    +'<div style="padding:0 20px 20px;display:flex;gap:8px">'
    +'<button class="btn bg2" style="flex:1;justify-content:center" id="vsConfirmCancel">'+(opts.cancelLabel||'취소')+'</button>'
    +'<button class="'+okCls+'" style="flex:1;justify-content:center" id="vsConfirmOk">'+(opts.okLabel||'확인')+'</button>'
    +'</div></div>';
  m.insertAdjacentHTML('afterbegin', content);
  m.addEventListener('click',function(ev){if(ev.target===m)m.remove();});
  document.body.appendChild(m);
  document.getElementById('vsConfirmCancel').onclick=function(){m.remove();};
  document.getElementById('vsConfirmOk').onclick=function(){m.remove();if(opts.onOk)opts.onOk();};
  setTimeout(function(){var ok=document.getElementById('vsConfirmOk');if(ok)ok.focus();},100);
}

/* 오버레이 자동 닫기 바인딩 */
function initOverlayCloseHandlers(){
  document.querySelectorAll('.ov').forEach(function(o){
    o.addEventListener('click',function(ev){
      var noAutoClose=['mQS','mS','mLR','mFlexWeek','mWE','mTempReschedule'];
      if(ev.target===o&&o.id!=='mCam'&&noAutoClose.indexOf(o.id)<0){
        o.classList.remove('open');
      }
    });
  });
}
