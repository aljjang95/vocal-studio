/* camera.js - 카메라 촬영 및 미디어 녹음 (extracted from vocal-studio.html lines 3671-3910) */

function prevPhoto(input,previewId,dataId){
  var file=input.files[0];if(!file)return;
  var r=new FileReader();
  r.onload=function(ev){
    /* 이미지 리사이즈 압축 (최대 800px, quality 0.72) */
    var img=new Image();
    img.onload=function(){
      var MAX=800;
      var w=img.width,h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
      var cv=document.createElement('canvas');
      cv.width=w;cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      var data=cv.toDataURL('image/jpeg',0.72);
      ge(dataId).value=data;
      ge(previewId).innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">';
      /* 사진 업로드 즉시 임시저장 */
      if(dataId==='ci-photo-data'){setTimeout(function(){if(typeof ciSaveDraft==='function')ciSaveDraft();},100);}
    };
    img.src=ev.target.result;
  };
  r.readAsDataURL(file);
}

/* WEBCAM */
var camStream=null,camTarget='s';
function openCam(target){
  camTarget=target;
  ge('camVideo').style.display='block';
  ge('camPreviewWrap').style.display='none';
  ge('camSnapBtn').style.display='flex';
  ge('camRetakeBtn').style.display='none';
  ge('camUseBtn').style.display='none';
  navigator.mediaDevices.getUserMedia({video:true}).then(function(stream){
    camStream=stream;ge('camVideo').srcObject=stream;om('mCam');
  }).catch(function(){toast('카메라 접근이 거부되었습니다','⚠️');});
}
function stopCam(){if(camStream){camStream.getTracks().forEach(function(t){t.stop();});camStream=null;}}
function snapPhoto(){
  var v=ge('camVideo');
  var c=document.createElement('canvas');
  /* 최대 800px로 리사이즈 (localStorage 용량 절약) */
  var MAX=800;
  var w=v.videoWidth,h=v.videoHeight;
  if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
  if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
  c.width=w;c.height=h;
  var ctx=c.getContext('2d');
  ctx.translate(c.width,0);ctx.scale(-1,1);
  ctx.drawImage(v,0,0,w,h);
  var data=c.toDataURL('image/jpeg',0.72);
  ge('camPreviewImg').src=data;
  ge('camPreviewWrap').style.display='block';
  ge('camVideo').style.display='none';
  ge('camSnapBtn').style.display='none';
  ge('camRetakeBtn').style.display='flex';
  ge('camUseBtn').style.display='flex';
}
function retakeCam(){
  ge('camVideo').style.display='block';
  ge('camPreviewWrap').style.display='none';
  ge('camSnapBtn').style.display='flex';
  ge('camRetakeBtn').style.display='none';
  ge('camUseBtn').style.display='none';
}
function useCamPhoto(){
  var data=ge('camPreviewImg').src;
  ge(camTarget+'-photo-data').value=data;
  var pv=ge(camTarget+'-photo-preview');
  if(pv){
    pv.innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0" onclick="openLightbox(this.src)">';
  }
  stopCam();cm('mCam');
  toast('사진이 적용되었습니다 📷');
  /* 사진 찍은 즉시 임시저장 */
  if(camTarget==='ci'){setTimeout(function(){if(typeof ciSaveDraft==='function')ciSaveDraft();},100);}
}

/* RECORDING */
var mediaRecorder=null,recChunks=[],recTimer=null,recSec=0;
var recDid='',recMode='',recType='before',recBlob=null;

function openRecording(did,mode,type){
  recDid=did;recMode=mode;recType=type;recBlob=null;recChunks=[];
  ge('recStatus').textContent='녹음 버튼을 눌러 시작하세요';
  ge('recTimerDisp').textContent='00:00';
  ge('recStartBtn').style.display='flex';
  ge('recStopBtn').style.display='none';
  ge('recPreview').style.display='none';
  ge('recSaveBtn').style.display='none';
  ge('recLabel').value='';
  om('mRec');
}
function startRec(){
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    recChunks=[];recSec=0;
    /* iOS Safari: audio/mp4, Chrome: audio/webm;codecs=opus */
    var mimeType='';
    var types=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'];
    for(var i=0;i<types.length;i++){
      if(MediaRecorder.isTypeSupported(types[i])){mimeType=types[i];break;}
    }
    mediaRecorder=mimeType?new MediaRecorder(stream,{mimeType:mimeType}):new MediaRecorder(stream);
    var usedMime=mediaRecorder.mimeType||mimeType||'audio/webm';
    mediaRecorder.ondataavailable=function(ev){if(ev.data.size>0)recChunks.push(ev.data);};
    mediaRecorder.onstop=function(){
      recBlob=new Blob(recChunks,{type:usedMime});
      /* iOS blob URL 재생 불안정 → base64 data URL 사용 */
      var fr=new FileReader();
      fr.onload=function(e){
        ge('recAudio').src=e.target.result;
        ge('recAudio').load();
        ge('recPreview').style.display='block';
        ge('recSaveBtn').style.display='flex';
        ge('recStatus').textContent='녹음 완료! 미리 듣고 저장하세요.';
      };
      fr.readAsDataURL(recBlob);
      stream.getTracks().forEach(function(t){t.stop();});
    };
    mediaRecorder.start();
    clearInterval(recTimer);
    recTimer=setInterval(function(){
      recSec++;
      var mm=String(Math.floor(recSec/60)).padStart(2,'0');
      var ss=String(recSec%60).padStart(2,'0');
      ge('recTimerDisp').textContent=mm+':'+ss;
    },1000);
    ge('recStartBtn').style.display='none';
    ge('recStopBtn').style.display='flex';
    ge('recStatus').textContent='🔴 녹음 중...';
  }).catch(function(){toast('마이크 접근이 거부되었습니다','⚠️');});
}
function stopRec(){
  if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop();
  clearInterval(recTimer);
  ge('recStopBtn').style.display='none';
}
function cancelRec(){
  clearInterval(recTimer);
  if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop();
  cm('mRec');
}
function saveRec(){
  if(!recBlob)return;
  var label=gv('recLabel')||toDS(new Date());
  var safeLabel=label.replace(/[^a-zA-Z0-9_-]/g,'_');
  /* mimeType에 맞는 확장자 자동 결정 */
  var ext=recBlob.type.indexOf('mp4')>=0?'.m4a':recBlob.type.indexOf('ogg')>=0?'.ogg':'.webm';

  /* ── 동의 녹음 ── */
  if(recMode==='consent'){
    /* 파일 다운로드 먼저 */
    downloadBlob(recBlob, safeLabel+'_consent'+ext);
    var r0=new FileReader();
    r0.onload=function(ev){
      var did=consentTarget.did, cmode=consentTarget.mode;
      var consentKey='vsM_consent_'+uid();
      var entry={id:uid(),date:toDS(new Date()),data:ev.target.result,_mediaKey:consentKey};
      mediaSave(consentKey,ev.target.result);
      if(cmode==='consult'){var c0=consults.find(function(x){return x.id===did;});if(!c0)return;c0.consentRec=entry;}
      else{var s0=students.find(function(x){return x.id===did;});if(!s0)return;s0.consentRec=entry;}
      saveAll();cancelRec();toast('동의 녹음 저장 + 파일 다운로드 ✓');
      if(window._afterConsentCb){var cb=window._afterConsentCb;window._afterConsentCb=null;cb();return;}
      var d0=cmode==='consult'?consults.find(function(x){return x.id===did;}):students.find(function(x){return x.id===did;});
      if(d0)openProfile(d0,cmode);
    };
    r0.readAsDataURL(recBlob);
    return;
  }

  /* ── 신청서 폼 인라인 녹음 ── */
  if(recMode==='consult-form'){
    var r1=new FileReader();
    r1.onload=function(ev){
      var ciAd=ge('ci-audio-data');
      if(ciAd)ciAd.value=ev.target.result;
      if(ge('ci-audio-type'))ge('ci-audio-type').value='audio';
      var ciAl=ge('ci-audio-label');
      if(ciAl)ciAl.textContent=label+' (녹음)';
      var ciAe=ge('ci-audio-el');
      if(ciAe)ciAe.src=ev.target.result;
      var ciAp=ge('ci-audio-player');
      if(ciAp)ciAp.style.display='block';
      toast('녹음 완료 — 저장됩니다 🎙');
    };
    r1.readAsDataURL(recBlob);
    downloadBlob(recBlob, safeLabel+ext);
    cancelRec();
    return;
  }

  /* ── 일반 미디어 녹음 (학생/상담 Before/After) ── */
  var r2=new FileReader();
  r2.onload=function(ev){
    var entryId=uid();
    var mediaKey='vsM_'+entryId;
    var entry={id:entryId,type:recType,mediaType:'audio',label:label,date:toDS(new Date()),data:ev.target.result,_mediaKey:mediaKey};
    /* IndexedDB에 저장 (새로고침 후에도 재생 가능) */
    mediaSave(mediaKey,ev.target.result);
    var saved=false;
    if(recMode==='consult'){
      var c1=consults.find(function(x){return x.id===recDid;});
      if(c1){if(!c1.audios)c1.audios=[];c1.audios.push(entry);saved=true;}
    } else {
      var s1=students.find(function(x){return x.id===recDid;});
      if(s1){if(!s1.audios)s1.audios=[];s1.audios.push(entry);saved=true;}
    }
    downloadBlob(recBlob, safeLabel+ext);
    if(saved){
      saveAll();cancelRec();toast('녹음 저장 완료! 🎙');
      var d1=recMode==='consult'?consults.find(function(x){return x.id===recDid;}):students.find(function(x){return x.id===recDid;});
      if(d1){
        openProfile(d1,recMode);
        setTimeout(function(){
          var mediaIdx=recMode==='consult'?3:2;
          var tabs=document.querySelectorAll('#mProfile .tab');
          if(tabs[mediaIdx])tabs[mediaIdx].click();
        },200);
      }
    } else {
      cancelRec();toast('파일 다운로드 완료 🎙');
    }
  };
  r2.readAsDataURL(recBlob);
}
function downloadBlob(blob,filename){
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
}
function downloadData(dataUrl,filename){
  var a=document.createElement('a');
  a.href=dataUrl;a.download=filename;
  document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);},500);
}
