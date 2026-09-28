import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const html=read('index.html');
const ui=read('v2-ui.js');
const css=read('v2.css');
const manifest=read('manifest.json');
const build=read('scripts/build-worker.mjs');

test('V2 shell exposes premium operations workflow actions',()=>{
  assert.match(html,/id="v2OpsCenter"/);
  for(const id of ['v2CallCapture','v2ConsultIntake','v2FixedSchedule','v2FlexSchedule'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(css,/--v2-bg:/);assert.match(css,/\.v2-ops-center/);assert.match(css,/\.v2-action-card/);
});
test('phone inquiry capture persists through canonical saveAll',()=>{
  assert.match(ui,/function saveV2PhoneInquiry/);
  assert.match(ui,/callHistory/);assert.match(ui,/saveAll\(\)/);
  assert.match(ui,/visitDate/);assert.match(ui,/visitTime/);
});
test('V2 schedule actions reuse guarded fixed and flexible schedule engines',()=>{
  assert.match(ui,/openSModal\(\)/);assert.match(ui,/setSType\('fixed'\)/);
  assert.match(ui,/openFlexWeek\(\)/);assert.match(ui,/auditScheduleConflicts/);
});
test('Cloudflare cold start announces access and server hydration while pending',()=>{
  const start=html.indexOf('function initCloudflare(){');
  const end=html.indexOf('function _cfDatabase(){',start);
  const init=html.slice(start,end);
  assert.match(init,/연결 확인 중 · 변경은 이 기기에 보관됩니다/);
  assert.match(init,/인증됨 · 서버 자료 확인 중/);
  assert.match(init,/_vsSyncActions\('checking-session'\)/);
  assert.match(init,/_vsSyncActions\('checking-server'\)/);
  assert.match(html,/var checking=\['checking-session','checking-server'\]\.indexOf\(mode\)>=0/);
  const disabled=html.slice(html.indexOf('function _disableCloudflareSync'),html.indexOf('function signInAdmin'));
  assert.match(disabled,/_vsSyncActions\('auth-required'\)/);
  assert.match(html,/function _retryCloudflareSync\(\)\{\s*if\(!hasAdminSession\(\)\|\|!_vsSync\)return initCloudflare\(\);\s*return _vsSync\.retry\(\);/);
  assert.match(html,/function\(\)\{_retryCloudflareSync\(\);\}/);
  assert.match(html,/pane\.className='v2-initial-sync-state';/);
});
test('student colors are keyed by stable identity and photo pointers resolve to initials on failure',()=>{
  assert.match(html,/function studentColorIndex\(s\)/);
  assert.match(html,/Math\.imul\(hash,16777619\)/);
  assert.doesNotMatch(html,/students\.indexOf\(/);
  assert.match(html,/u\.pathname\.indexOf\('\/api\/media\/'\)===0/);
  assert.match(html,/this\.nextElementSibling\.hidden=false/);
  assert.match(html,/function personAvatarHtml\(s,size,shape,lightbox\)/);
  assert.match(html,/role="img" aria-label="'\+esc\(name\)\+'"/);
});
test('legacy Firebase portraits display from same-origin R2 while stored values stay unchanged',()=>{
  const start=html.indexOf('var LEGACY_PHOTO_BUCKETS=');
  const end=html.indexOf('/* 고정 스케줄 주N회',start);
  assert.ok(start>=0&&end>start,'photo helpers exist');
  const store=new Map([['vsC_ph_local','data:image/jpeg;base64,AAAA']]);
  const context=vm.createContext({URL,location:{origin:'https://hlb.example'},encodeURIComponent,decodeURIComponent,
    localStorage:{getItem:key=>store.get(key)||null},esc:s=>String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')});
  vm.runInContext(html.slice(start,end),context);
  const legacy='https://firebasestorage.googleapis.com/v0/b/hlbvocalstudio-72481.firebasestorage.app/o/studio%2Fphotos%2Fabc_123.jpg?alt=media&token=secret';
  assert.equal(context.getStudentPhoto({photo:legacy}),'/api/media/studio%2Fphotos%2Fabc_123.jpg');
  assert.equal(context.storedOwnerPhoto({photo:legacy}),legacy,'edit forms keep the stored reference');
  assert.equal(context.getStudentPhoto({photo:'/api/media/studio%2Fphotos%2Fx.jpg'}),'/api/media/studio%2Fphotos%2Fx.jpg');
  assert.equal(context.getStudentPhoto({photo:'data:image/png;base64,AAAA'}),'data:image/png;base64,AAAA');
  assert.equal(context.getStudentPhoto({photo:'',_photoKey:'vsC_ph_local'}),'data:image/jpeg;base64,AAAA');
  for(const blocked of ['https://evil.example/a.jpg','https://firebasestorage.googleapis.com/v0/b/other-bucket/o/studio%2Fphotos%2Fa.jpg',
    'https://firebasestorage.googleapis.com/v0/b/hlbvocalstudio-72481.firebasestorage.app/o/studio%2F..%2Fsecret','javascript:alert(1)','[saved]'])
    assert.equal(context.getStudentPhoto({photo:blocked}),'',blocked+' must fall back to initials');
  assert.match(context.photoPreviewHtml(legacy,false),/src="\/api\/media\/studio%2Fphotos%2Fabc_123\.jpg"[^>]*onerror=/);
  assert.equal(context.photoPreviewHtml('https://evil.example/a.jpg',false),'<div class="no-ph">📷</div>');
  for(const preview of ['function openSModal','function convertFromProfile','function ciRestoreDraft']){
    const at=html.indexOf(preview);if(at<0)continue;
    assert.doesNotMatch(html.slice(at,at+6000).split('\nfunction ')[0],/innerHTML='<img src="'\+_/);
  }
});
test('avatar palette carries white initials at readable contrast',()=>{
  const palette=JSON.parse(html.match(/var COLORS=(\[[^\]]+\])/)[1].replace(/'/g,'"'));
  const lum=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  for(const color of palette)assert.ok(1.05/(lum(color)+.05)>=4.5,color+' white-text contrast');
  assert.equal(new Set(palette).size,palette.length);
  assert.match(html,/color:#fff;background:'\+color\+';border:1px solid rgba\(255,255,255,\.2\)/);
});
test('schedule inquiry cards never use a phone number as the name and absent is labeled 결석',()=>{
  const start=html.indexOf('function _scheduleInquiryName(q)');
  const end=html.indexOf('function _scheduleMakeSlot',start);
  const context=vm.createContext({});
  vm.runInContext(html.slice(start,end),context);
  assert.equal(context._scheduleFakeInquiry({id:'q1',name:'010-1234-5678',phone:'010-1234-5678'}).name,'문의자 (방문)');
  assert.equal(context._scheduleFakeInquiry({id:'q2',name:'',phone:'01012345678'}).name,'문의자 (방문)');
  assert.equal(context._scheduleFakeInquiry({id:'q3',name:'김하늘',phone:'010-1'}).name,'김하늘 (방문)');
  const label=html.slice(html.indexOf('function scheduleStatusLabel(slot)'),html.indexOf('function personAvatarHtml'));
  const ctx2=vm.createContext({});vm.runInContext(label,ctx2);
  assert.equal(ctx2.scheduleStatusLabel({absent:true,overrideType:'cancel',type:'fixed-sched'}),'결석');
  assert.equal(ctx2.scheduleStatusLabel({overrideType:'cancel',type:'fixed-sched'}),'취소');
  assert.match(html,/function _scheduleFakeConsult\(c\)\{\s*return \{id:c\.id,name:[^}]*photo:c\.photo\|\|''/);
});
test('student palette stays attached to identity through sorting and filtering',()=>{
  const start=html.indexOf('function studentColorIndex(s)');
  const end=html.indexOf('function scheduleLessonKind(slot)',start);
  assert.ok(start>=0&&end>start,'identity palette functions exist');
  const context=vm.createContext({COLORS:['#100001','#200002','#300003','#400004','#500005'],Math});
  vm.runInContext(html.slice(start,end),context);
  const rows=[{id:'student-a',name:'A',createdAt:3},{id:'student-b',name:'B',createdAt:1},{id:'student-c',name:'C',createdAt:2}];
  const before=new Map(rows.map(student=>[student.id,context.gc(student)]));
  const after=rows.slice().sort((a,b)=>a.createdAt-b.createdAt).filter(student=>student.id!=='student-b');
  for(const student of after)assert.equal(context.gc(student),before.get(student.id));
});
test('today, roster, consultation and profile portraits keep initials when media fails',()=>{
  const today=html.slice(html.indexOf('function buildTodaySchedule'),html.indexOf('function buildTodayConsultCard'));
  const consult=html.slice(html.indexOf('function buildTodayConsultCard'),html.indexOf('function openSlotMenu'));
  const roster=html.slice(html.indexOf('function buildStudents'),html.indexOf('function buildLogs'));
  const profile=html.slice(html.indexOf('function openProfile'),html.indexOf('function buildConsult'));
  assert.match(today,/personAvatarHtml\(s,52,'round',false\)/);
  assert.match(consult,/personAvatarHtml\(s,52,'round',false\)/);
  assert.match(roster,/personAvatarHtml\(s,90,'square',false\)/);
  assert.match(roster,/personAvatarHtml\(s,40,'round',false\)/);
  assert.match(profile,/this\.nextElementSibling\.hidden=false/);
  assert.match(html,/var avatarHtml=personAvatarHtml\(c,44,'round',false\)/);
});
test('weekly schedule separates student, exact time, lesson kind, and status without contact details',()=>{
  const desktop=html.slice(html.indexOf('function buildSchedule(){'),html.indexOf('function removeSlotFromMenu'));
  const mobileStart=html.indexOf('function buildMobileWeekView');
  const mobile=html.slice(mobileStart,html.indexOf('function buildMobileSchedule(){',mobileStart));
  assert.match(desktop,/schedule-card-name/);assert.match(desktop,/schedule-card-time/);
  assert.match(desktop,/scheduleLessonKind\(x\)/);assert.match(desktop,/scheduleStatusLabel\(x\)/);
  assert.doesNotMatch(desktop,/x\.s\.(?:ph|phone)/);
  assert.match(mobile,/mobile-week-nav/);assert.match(mobile,/aria-label="다음 주"/);
  assert.match(mobile,/is-today/);assert.match(mobile,/mWkPrev\(\)/);assert.match(mobile,/mWkNext\(\)/);assert.match(mobile,/mWkToday\(\)/);
  assert.match(mobile,/일정 없음/);assert.match(mobile,/mSelectWeekDay/);
  assert.doesNotMatch(mobile,/repeat\(7,1fr\)|font-size:7px/);
});
test('weekly schedule and student roster hide the clipped operations launcher',()=>{
  assert.match(html,/document\.body\.setAttribute\('data-active-page',p\)/);
  assert.match(css,/body#vocalAdmin\[data-active-page="schedule"\] #pwaWorkspace,[\s\S]*?body#vocalAdmin\[data-active-page="students"\] #pwaWorkspace\{display:none!important;\}/);
});
test('V2 weekly surfaces override legacy light-season headers and retain readable schedule labels',()=>{
  assert.match(css,/body#vocalAdmin \.card \.ch\{\s*background:#101826!important/);
  assert.match(css,/body#vocalAdmin \.sg-hd\{\s*background:#101826!important/);
  assert.match(css,/body#vocalAdmin \.sg-hd\.off-day > div\[style\*="font-size:9px"\]\[style\*="color:var\(--r\)"\]\{color:#ff9eae!important/);
  assert.match(css,/body#vocalAdmin \.sg-cell\.td-col\{background:rgba\(127,134,255,\.07\)!important;?\}/);
  assert.match(css,/@media\(min-width:769px\)\{\s*body#vocalAdmin \.schedule-card-name\{font-size:13px!important/);
  assert.match(css,/body#vocalAdmin \.schedule-status\{font-size:10px!important;?\}/);
});
test('V2 assets ship in Worker static assets',()=>{
  assert.match(build,/'v2-ui\.js'/);assert.match(build,/'v2\.css'/);
  assert.match(html,/v2-ui\.js/);assert.match(html,/v2\.css/);
});
test('PWA install copy and manifest contain no mojibake placeholders',()=>{
  const area=html.slice(html.indexOf('pwaInstallBtn'),html.indexOf('</section>',html.indexOf('pwaInstallBtn')));
  assert.doesNotMatch(area,/>\?\s*\?\?/);
  assert.match(area,/앱 설치|설치/);
  assert.match(manifest,/HLB Studio V2 관리자/);
  assert.match(manifest,/고객·문의·상담·일정·결제/);
  assert.doesNotMatch(manifest,/"(?:name|short_name|description)"\s*:\s*"[^"\n]*\?\?+/);
});
