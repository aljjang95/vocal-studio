import fs from 'node:fs';
import crypto from 'node:crypto';

const read=p=>fs.readFileSync(p,'utf8');
const checks=[];
function ok(condition,label){if(!condition)throw new Error(label);checks.push(label);}
function has(text,needle,label=needle){ok(text.includes(needle),'missing '+label);}
function lacks(text,needle,label=needle){ok(!text.includes(needle),'unexpected '+label);}

const index=read('index.html');
const sw=read('sw.js');
const transport=read('cf-transport.js');
const migration=read('cf-migration.js');
const sync=read('vs-sync.js');
const worker=read('worker/index.mjs');
const auth=read('worker/auth.mjs');
const state=read('worker/state.mjs');
const prod=JSON.parse(read('wrangler.jsonc'));
const local=JSON.parse(read('wrangler.local.jsonc'));
const pkg=JSON.parse(read('package.json'));
const lock=read('scripts/deploy-locked.mjs');
const inline=[...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).filter(Boolean);
ok(inline.length>0,'inline runtime scripts exist');
for(const [i,code] of inline.entries()){
  try{new Function(code);checks.push('inline script '+(i+1)+' parses');}
  catch(error){throw new Error('inline script '+(i+1)+' parse: '+error.message);}
}

lacks(index,'gstatic.com/firebasejs','legacy SDK URL');
lacks(index,'firebase.initializeApp','legacy initialize');
lacks(index,'firebase.firestore()','legacy database call');
lacks(index,'firebase.auth()','legacy auth call');
lacks(index,'firebase.storage()','legacy storage call');
lacks(index,'firebaseConfig','legacy config');
lacks(index,'cdn.jsdelivr.net/npm/fullcalendar','FullCalendar CDN');
lacks(index,'www.googleapis.com/calendar/v3','Google Calendar API');
has(index,'./cf-transport.js','Cloudflare transport script');
has(index,'./cf-migration.js','readback helper script');
has(index,'function initCloudflare()','Cloudflare session bootstrap');
has(index,'function _cfLocalOwnerKey()','principal owner marker');
has(index,'resumeData:function(owner){return _cfLoadLocalResume(owner);}','owner-bound durable resume');
has(index,'function _cfMediaPendingCount()','pending media counter');
has(index,"mode==='synced'&&mediaPending===0",'synced media retry visibility');
has(index,"_vsSync.retry();_cfDrainMedia();",'online state and media retry');
has(transport,'function dataUrlBlob(','CSP-safe data URL decode');
lacks(transport,'fetch(data)','data URL network fetch');
has(migration,'verifyReadback','private export readback compare');
ok(prod.name==='vocal-studio','production Worker name fixed');
ok(prod.main==='worker/index.mjs','production Worker entry fixed');
ok(prod.assets&&prod.assets.binding==='ASSETS','ASSETS binding');
ok(prod.assets.run_worker_first===true,'Worker auth runs before assets');
ok(prod.assets.html_handling==='none','asset HTML redirect handling disabled');
ok(prod.durable_objects.bindings.some(x=>x.name==='STUDIO'&&x.class_name==='StudioState'),'SQLite DO binding');
ok(prod.r2_buckets.some(x=>x.binding==='MEDIA'&&x.bucket_name==='vocal-studio-media'),'private R2 binding');
ok(prod.vars.STUDIO_NAMESPACE==='vocal-studio','fixed studio namespace');
ok(prod.vars.DEPLOYMENT_ENABLED==='false','production deployment locked');
ok(local.vars.DEPLOYMENT_ENABLED==='false','local deployment flag locked');
ok(pkg.scripts.deploy==='node scripts/deploy-locked.mjs','deploy script uses lock');
has(lock,'production deployment locked','deploy lock throws');
has(auth,'createRemoteJWKSet','official Access JWK verifier');
has(auth,'jwtVerify','Access JWT verification');
has(auth,'issuer','Access issuer validation');
has(auth,'audience','Access audience validation');
has(auth,'ACCESS_ALLOWED_EMAILS','Access email allowlist');
has(worker,"const PROTOCOL = 'vs-cf-1'",'protocol version');
has(worker,"request.headers.get('Origin') === url.origin",'exact origin mutation gate');
has(worker,'await authenticate(request, env)','authentication before routing');
has(worker,"const MAX_MEDIA_BYTES = 20 * 1024 * 1024",'20 MiB media cap');
has(worker,'media-pointer-exists','immutable media pointers');
lacks(worker,"request.method === 'DELETE'",'media delete endpoint');
lacks(worker,'fetch(url)','arbitrary URL proxy');
has(state,'ctx.storage.sql','SQLite storage');
has(state,'destination-not-empty','empty-only import gate');
has(state,"mode: 'staged'",'staged import mode');
has(state,'verified-readback-required','activation readback gate');
has(state,'readback.principal !== principal','principal-bound readback');
has(state,'body.baseRevision !== record.revision','CAS revision gate');
has(state,'request-id-conflict','request ID payload conflict');
has(state,'X-VS-Idempotent-Replay','idempotent replay receipt');
has(state,'const merged = { ...record.state, ...incoming }','unknown root preservation');
has(sync,'resumeFromDurable','durable startup path');
has(sync,'saved.recovery.push(clone(saved.local))','old journal copied to recovery');
has(sync,'saved.local=startup;saved.resumeConflict=true','durable local wins conflict');
has(sync,'this.state.resumeConflict','conflict blocks flush');

const assetBlock=(worker.match(/const ASSETS = new Set\(\[([\s\S]*?)\]\);/)||[])[1]||'';
const assetPaths=[...assetBlock.matchAll(/'([^']+)'/g)].map(m=>m[1]);
ok(assetPaths.length===10&&new Set(assetPaths).size===10,'exactly ten public asset paths');
has(sw,"key.indexOf('vs-v2-')===0",'old service worker cache retirement');
has(sw,'event.respondWith(fetch(event.request))','network-only service worker');
lacks(sw,'caches.match(','service worker cache reads');

ok(/function autoFillPastAttendance\(\)\{\s*return 0;\s*\}/.test(index),'past attendance remains no-write');
for(const token of [
  'collectMissingAttendanceProposals','confirmAttendanceProposal','attendanceProposalKey',
  'hideAttendanceProposal','markAttendanceProposalResolved','lesson-record-saved',
  '_applyAttendanceProposalBatch',"var CYCLE_POLICY_VERSION='cycle-v1-2026-06-18'",
  'window.vsMediaRecovery',"var SCHEDULE_ENGINE_VERSION='schedule-v2-2026-06-18'",
  'window.vsScheduleEngine','attendanceByMember','createScheduleResetSnapshot',
  '_scheduleConflictToast','setConsultHold',"consultTab==='hold'",
  'buildMobileScheduleSummary','function renderScheduleContent','function mCellClick',
  'onclick="mCellClick(this,event)"','function buildStudentLifeTimeline',
  '성장 일대기 · 전체','이전 기록 전체',"var _todayPrivacy='all'"
]) has(index,token,'product invariant '+token);
lacks(index,'이전 레슨 기록 (최근 5개)','old capped lesson history');
ok(!/function ciSetFreq\([\s\S]*?v===2/.test(index),'ciSetFreq undefined variable guard');
const summary={
  ok:true,
  checkedAt:new Date().toISOString(),
  invariantCount:checks.length,
  indexSha256:crypto.createHash('sha256').update(index).digest('hex'),
  publicAssets:assetPaths,
  deploymentEnabled:prod.vars.DEPLOYMENT_ENABLED,
};
console.log(JSON.stringify(summary,null,2));
