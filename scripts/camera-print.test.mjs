import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=readFileSync(path.join(root,'index.html'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fn(text,name){
  const start=text.indexOf('\nfunction '+name+'(');
  assert.ok(start>=0,'production function '+name);
  const next=text.indexOf('\nfunction ',start+1);
  return text.slice(start,next<0?text.length:next);
}
function element(){
  const classes=new Set(),el={style:{},value:'',src:'',disabled:false,videoWidth:640,videoHeight:480,options:[],clicks:0,
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)},
    removeAttribute(name){delete this[name];},appendChild(option){this.options.push(option);},click(){this.clicks++;},play(){return Promise.resolve();}};
  let text='';Object.defineProperty(el,'textContent',{get:()=>text,set:v=>{text=v;el.options=[];}});
  return el;
}
function camera(options={}){
  const ids=['mCam','camVideo','camPreviewWrap','camPreviewImg','camSnapBtn','camRetakeBtn','camUseBtn','camStatus','camRetryBtn','camDevice','camDeviceWrap','s-file-input','ci-file-input','s-photo-data','ci-photo-data','s-photo-preview','ci-photo-preview'];
  const elements=Object.fromEntries(ids.map(id=>[id,element()])),pending=[],calls=[],events={},timers=[];
  const navigator={mediaDevices:{getUserMedia(constraints){calls.push(JSON.parse(JSON.stringify(constraints)));return new Promise((resolve,reject)=>pending.push({resolve,reject}));},
    enumerateDevices:async()=>options.devices||[{kind:'videoinput',deviceId:'c922',label:'c922 Pro Stream Webcam'},{kind:'videoinput',deviceId:'obs',label:'OBS Virtual Camera'}]},...options.navigator};
  const context={navigator,ge:id=>elements[id]||null,document:{permissionsPolicy:{allowsFeature:()=>options.allowed!==false},createElement(tag){
    if(tag==='canvas')return {getContext:()=>({translate(){},scale(){},drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,c3ludGhldGlj'};
    return element();}},window:{isSecureContext:options.secure!==false,addEventListener:(name,fn)=>events[name]=fn},
    om:id=>elements[id].classList.add('open'),toast(){},ciSaveDraft(){context.drafts++;},drafts:0,setTimeout:fn=>timers.push(fn)};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('/* WEBCAM */'),source.indexOf('/* RECORDING */'))+source.match(/^function cm\(id\).*$/m)[0],context);
  return {api:context,elements,pending,calls,events,timers};
}
function stream(){const track={stops:0,stop(){this.stops++;}};return {track,getTracks:()=>[track]};}
test('camera opens only on explicit action; pending modal is visible and requests video only',()=>{
  const h=camera();assert.equal(h.calls.length,0);h.api.openCam('ci');
  assert.deepEqual(h.calls,[{video:true,audio:false}]);assert.ok(h.elements.mCam.classList.contains('open'));
  assert.match(h.elements.camStatus.textContent,/権限|권한/);assert.equal(h.elements.camSnapBtn.disabled,true);
});
test('unsupported, insecure and denied document policy offer file recovery without requesting media',()=>{
  for(const options of [{secure:false},{navigator:{mediaDevices:undefined}},{allowed:false}]){
    const h=camera(options);h.api.openCam('ci');assert.equal(h.calls.length,0);assert.match(h.elements.camStatus.textContent,/사진 파일/);
    h.api.camChooseFile();assert.equal(h.elements['ci-file-input'].clicks,1);assert.equal(h.elements.mCam.classList.contains('open'),false);
  }
});
test('camera failures have visible differentiated recovery including OS, busy, missing and browser denial',async()=>{
  for(const [name,message,permission,expected] of [
    ['NotReadableError','Could not start video source','granted',/다른 카메라 앱.*가상 카메라/],
    ['NotFoundError','',null,/찾을 수 없습니다/],['NotAllowedError','Permission denied by system','denied',/운영체제/],
    ['NotAllowedError','Permission denied','denied',/브라우저에서/],['NotAllowedError','Permission denied',null,/사이트 권한과 기기/],
    ['SecurityError','',null,/보안 설정/],['AbortError','',null,/중단/],['OverconstrainedError','',null,/지원하지 않습니다/]]){
    const h=camera(permission?{navigator:{permissions:{query:async()=>({state:permission})}}}:{});h.api.openCam('ci');
    h.pending[0].reject({name,message});await tick();await tick();
    assert.match(h.elements.camStatus.textContent,expected,name);assert.equal(h.elements.camRetryBtn.style.display,'flex');
    assert.ok(h.elements.mCam.classList.contains('open'));assert.equal(h.elements.camSnapBtn.disabled,true);
  }
});
test('device list never switches silently; explicit retry requests exact device and preserves vanished selection',async()=>{
  const h=camera();h.api.openCam('ci');h.pending[0].reject({name:'NotReadableError'});await tick();
  assert.deepEqual(h.elements.camDevice.options.map(o=>o.textContent),['브라우저 기본 카메라','c922 Pro Stream Webcam','OBS Virtual Camera']);
  assert.equal(h.calls.length,1);h.api.openCam('ci','obs');assert.deepEqual(h.calls[1],{video:{deviceId:{exact:'obs'}},audio:false});
  h.pending[1].reject({name:'NotReadableError'});await tick();assert.equal(h.elements.camDevice.value,'obs');assert.equal(h.calls.length,2);
  h.api.openCam('ci','unplugged');h.pending[2].reject({name:'NotFoundError'});await tick();assert.equal(h.elements.camDevice.value,'unplugged');
  assert.ok(h.elements.camDevice.options.some(o=>o.value==='unplugged'));
});
test('close, retry, target change and pagehide stop streams including out-of-order permission grants',async()=>{
  const h=camera();h.api.openCam('ci');h.api.cm('mCam');const late=stream();h.pending[0].resolve(late);await tick();assert.equal(late.track.stops,1);
  h.api.openCam('ci');h.api.openCam('s','c922');const old=stream(),current=stream();h.pending[2].resolve(current);await tick();
  h.pending[1].resolve(old);await tick();assert.equal(old.track.stops,1);assert.equal(h.api.camStream,current);assert.equal(h.api.camTarget,'s');
  h.api.openCam('s','obs');assert.equal(current.track.stops,1);assert.equal(h.elements.camVideo.srcObject,null);
  const last=stream();h.pending[3].resolve(last);await tick();h.events.pagehide();assert.equal(last.track.stops,1);assert.equal(h.elements.camVideo.srcObject,null);
});
test('late device/permission callbacks cannot rewrite a newer camera session',async()=>{
  let list,permission;
  const h=camera({navigator:{permissions:{query:()=>new Promise(resolve=>permission=resolve)}}});
  h.api.navigator.mediaDevices.enumerateDevices=()=>new Promise(resolve=>list=resolve);
  h.api.openCam('ci');h.pending[0].reject({name:'NotAllowedError'});await tick();h.api.openCam('s');
  const status=h.elements.camStatus.textContent;permission({state:'denied'});list([{kind:'videoinput',deviceId:'old',label:'old'}]);await tick();
  assert.equal(h.elements.camStatus.textContent,status);assert.equal(h.elements.camDeviceWrap.style.display,'none');
});
test('synthetic camera success waits for dimensions, shoots/applies only correct target and saves consultation draft',async()=>{
  const h=camera();h.api.openCam('ci');h.api.snapPhoto();assert.equal(h.elements['ci-photo-data'].value,'');
  const live=stream();h.pending[0].resolve(live);await tick();assert.equal(h.elements.camSnapBtn.disabled,true);
  h.elements.camVideo.onloadedmetadata();assert.equal(h.elements.camSnapBtn.disabled,false);h.api.snapPhoto();
  h.api.useCamPhoto();assert.equal(h.elements['ci-photo-data'].value,'data:image/jpeg;base64,c3ludGhldGlj');
  assert.equal(h.elements['s-photo-data'].value,'');assert.equal(live.track.stops,1);assert.equal(h.elements.camVideo.srcObject,null);
  h.timers.forEach(fn=>fn());assert.equal(h.api.drafts,1);assert.equal(h.elements.mCam.classList.contains('open'),false);
});
test('file chooser closes and stops a running camera and leaves existing photo intact on cancel',async()=>{
  const h=camera();h.elements['ci-photo-data'].value='existing';h.api.openCam('ci');const live=stream();h.pending[0].resolve(live);await tick();
  h.api.camChooseFile();assert.equal(live.track.stops,1);assert.equal(h.elements['ci-file-input'].clicks,1);assert.equal(h.elements['ci-photo-data'].value,'existing');
});

export function printFixture(text,kind='completed',long=false,group=false,screen=null){
  const record={id:'synthetic',name:'합성 평가 수강생 < & >',song:'합성 연습곡 < & >',prob:'음정 <낮음> & 호흡\n두 번째 피드백 줄',impr:'1단계 <호흡> & 리듬\n2단계 공명 훈련',consentRec:{date:'2026-09-30'},lessonType:group?'group':'solo'};
  if(long){record.prob=Array.from({length:80},(_,i)=>`문제점 ${i+1}: 음정 <낮음> & 호흡. ${'긴 피드백을 충분히 보존합니다. '.repeat(4)}`).join('\n');record.impr=Array.from({length:60},(_,i)=>`계획 ${i+1}: ${'호흡과 공명 훈련을 반복합니다. '.repeat(4)}`).join('\n')+'\n'+ 'W'.repeat(500)+'\n끝 피드백 <완료> & 보존';}
  let html='',saves=0;
  const output={closed:false,events:[],document:{write:v=>html+=v,close(){output.events.push('close');}},focus(){output.events.push('focus');},print(){output.events.push('print');}};
  const context={Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-09-30T00:00:00Z']));}},consults:[record],students:[record],ge:id=>screen&&screen[id]!==undefined?{value:screen[id]}:null,saveAll:()=>saves++,toast(){},
    window:{open:()=>output}};
  vm.createContext(context);
  const helper=['assessmentPrintCSS','assessmentPrintControls','finishAssessmentPrint'].filter(name=>text.includes('\nfunction '+name+'(')).map(name=>fn(text,name)).join('');
  vm.runInContext(fn(text,'esc')+helper+fn(text,'printBeforeSheet')+fn(text,'evalHTML')+fn(text,'printEvalSheet')+fn(text,'showEvalSheet'),context);
  if(kind==='blank')html=context.evalHTML('2026년 9월 30일');
  else if(kind==='blank-print')context.showEvalSheet();
  else if(kind==='lesson')context.printBeforeSheet('synthetic','student');
  else context.printEvalSheet('synthetic');
  return {html,record,saves,output};
}
test('each print action closes the complete document then opens native printing once, with printer selection and retry visible',()=>{
  for(const kind of ['completed','lesson','blank-print']){
    const {html,output}=printFixture(source,kind);
    assert.deepEqual(output.events,['close','focus','print'],kind);
    assert.match(html,/실제 프린터를 선택하세요/);
    assert.match(html,/class="no-print"/);
    assert.ok(html.includes('onclick="window.print()"'));
    assert.doesNotMatch(html,/download=|createObjectURL|application\/pdf/);
  }
});
test('closed output windows are ignored and print failures preserve the output for manual retry',()=>{
  const messages=[],ctx={toast:msg=>messages.push(msg)};vm.createContext(ctx);vm.runInContext(fn(source,'finishAssessmentPrint'),ctx);
  const events=[],w={closed:true,document:{close:()=>events.push('close')},focus:()=>events.push('focus'),print:()=>events.push('print')};
  ctx.finishAssessmentPrint(w);assert.deepEqual(events,['close']);
  w.closed=false;w.print=()=>{throw Error('printing unavailable');};ctx.finishAssessmentPrint(w);
  assert.equal(messages.length,1);assert.match(messages[0],/출력 화면의 인쇄 버튼/);assert.equal(w.closed,false);
});
test('completed and lesson printable output retain full escaped multiline feedback, song and notices',()=>{
  for(const kind of ['completed','lesson'])for(const long of [false,true]){
    const {html,record}=printFixture(source,kind,long);
    for(const value of [record.prob,record.impr]){
      const escaped=value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>');assert.ok(html.includes(escaped),kind+' retains full feedback');
    }
    assert.ok(html.includes('합성 연습곡 &lt; &amp; &gt;'));assert.ok(html.includes('합성 평가 수강생 &lt; &amp; &gt;'));
    for(const title of ['레슨 시간 준수','당일 변경 및 취소','레슨 이월 및 연기','실력 변화를 위한 연습과 질문','수강료 납부 및 예약 확정','중도 퇴실 및 환불 정책','개인 준비물'])assert.ok(html.includes(title),title);
    assert.ok(html.includes('2026-09-30'));assert.ok(!html.includes('<낮음>'));assert.ok(!html.includes('fonts.googleapis.com'));
    assert.ok(html.includes('font-size:11pt!important'));assert.ok(html.includes('@page{size:A4;margin:12mm;}'));
    assert.ok(html.includes('overflow-wrap:anywhere'));assert.ok(html.includes('page-break-inside:auto'));
  }
});
test('print captures unsaved visible feedback without modifying unrelated fields; group notices retained',()=>{
  const {html,record,saves}=printFixture(source,'completed',false,false,{'eval-song':'화면의 곡 &','eval-prob':'화면 <메모>\n마지막 줄','eval-impr':'수정 계획'});
  assert.equal(saves,1);assert.equal(record.prob,'화면 <메모>\n마지막 줄');assert.equal(record.impr,'수정 계획');assert.equal(record.song,'화면의 곡 &');assert.equal(record.name,'합성 평가 수강생 < & >');
  assert.ok(html.includes('화면 &lt;메모&gt;<br>마지막 줄'));assert.ok(html.includes('화면의 곡 &amp;'));
  const group=printFixture(source,'completed',true,true).html;
  for(const title of ['그룹 레슨 유의사항','시간 준수','스케줄 변경','보강 정책','연습 권장','수강료 납부','환불 규정','개인 물 지참'])assert.ok(group.includes(title),title);
  assert.ok(!group.includes('개인 레슨 운영 규정 (필독)'));
});
test('blank form preserves all nine criteria, five marks per row and editable comment box with shared readable styling',()=>{
  const html=printFixture(source,'blank').html;
  for(const label of ['음정 정확도','리듬·박자감','발성 (호흡·지지)','음색·톤','고음역 안정성','발음·딕션','음량 조절','감정 표현','음악성·곡 해석'])assert.ok(html.includes(label),label);
  assert.equal((html.match(/border-radius:50%/g)||[]).length,45);assert.ok(html.includes('contenteditable="true"'));
  assert.ok(html.includes('font-size:11pt!important'));assert.ok(html.includes('table-layout:fixed'));
  assert.ok(html.includes('h1{font-size:17pt!important;break-after:avoid;page-break-after:avoid;}'));
  assert.ok(html.includes('.sign-lbl{word-break:keep-all;overflow-wrap:normal;}'));
});

// Same real print functions and deterministic synthetic inputs for before/after PDF inspection.
// node scripts/camera-print.test.mjs --fixtures work/camera-print/baseline-index.html work/camera-print/baseline
if(process.argv[2]==='--fixtures'){
  const input=path.resolve(process.argv[3]||path.join(root,'index.html')),out=path.resolve(process.argv[4]||path.join(root,'work/camera-print/candidate'));
  const text=readFileSync(input,'utf8');mkdirSync(out,{recursive:true});
  for(const [name,kind,long,group] of [['completed-normal','completed',false,false],['completed-long','completed',true,false],['completed-group-long','completed',true,true],['lesson-normal','lesson',false,false],['lesson-long','lesson',true,false],['blank-evaluation','blank',false,false]]){
    writeFileSync(path.join(out,name+'.html'),printFixture(text,kind,long,group).html);
  }
  console.log(JSON.stringify({syntheticOnly:true,input,out,files:6}));
}
