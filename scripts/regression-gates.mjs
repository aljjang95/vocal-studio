import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (p) => fs.readFileSync(p, 'utf8');
const fail = (msg) => { throw new Error(msg); };
const assert = (cond, msg) => { if (!cond) fail(msg); };
const has = (text, needle, label = needle) => assert(text.includes(needle), `Missing ${label}`);
const notHas = (text, needle, label = needle) => assert(!text.includes(needle), `Unexpected ${label}`);

const index = read('index.html');
const sw = read('sw.js');
const firebase = JSON.parse(read('firebase.json'));
const docs = read('docs/OPERATIONS.md');

const scripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
assert(scripts.length >= 1, 'index.html must contain inline runtime scripts');
scripts.forEach((code, i) => {
  try { new Function(code); }
  catch (err) { fail(`Inline script ${i + 1} failed to parse: ${err.message}`); }
});

assert(firebase.hosting && firebase.hosting.public === '.', 'firebase.json must define hosting.public="."');
const ignore = new Set(firebase.hosting.ignore || []);
[
  'tmp/**', 'scripts/**', 'docs/**', 'js/**', '.gjc/**', '**/.*',
  'gjc-session-*.html', 'vocal-studio.html', 'vocal-studi.html',
  'firestore.rules', 'storage.rules'
].forEach((pattern) => assert(ignore.has(pattern), `firebase hosting ignore missing ${pattern}`));

for (const legacy of ['vocal-studio.html', 'vocal-studi.html', 'gjc-session-2026-06-18T07-40-22-369Z_019ed9ac-83e1-7000-ac17-5d0ff48ca429.html']) {
  const html = read(legacy);
  has(html, "location.replace('./index.html'+location.search+location.hash)", `${legacy} redirect`);
  has(html, 'noindex,nofollow', `${legacy} noindex`);
  notHas(html, 'firebasejs/9.23.0', `${legacy} Firebase SDK`);
  notHas(html, 'var ST=', `${legacy} stale app state bootstrap`);
}

notHas(index, 'signInAnonymously', 'anonymous Firebase auth');
has(index, "var VS_ADMIN_UIDS=", 'admin UID allowlist');
assert(/function autoFillPastAttendance\(\)\{\s*return 0;\s*\}/.test(index), 'autoFillPastAttendance must remain a no-write stub');
has(index, 'collectMissingAttendanceProposals', 'attendance proposal collector');
has(index, 'confirmAttendanceProposal', 'attendance proposal confirmation');
has(index, 'attendanceProposalKey', 'attendance proposal stable key');
has(index, '확정된 항목은 즉시 빠지고', 'attendance proposal immediate-resolution copy');
has(index, 'hideAttendanceProposal', 'attendance proposal hide control');
has(index, 'markAttendanceProposalResolved', 'attendance proposal manual edit resolution');
has(index, 'lesson-record-saved', 'lesson record save resolves proposal');
has(index, '_applyAttendanceProposalBatch', 'attendance proposal one-tap batch apply');
has(index, "if(att==='출석')", 'attendance proposal 출석 batch one-tap');
has(index, "var CYCLE_POLICY_VERSION='cycle-v1-2026-06-18'", 'canonical cycle policy version');
has(index, 'function buildSplitMigrationPlan', 'split migration dry-run builder');
has(index, 'window.vsSplitMigration', 'split migration runtime API');
has(index, "var MEDIA_POLICY_VERSION='media-v1-2026-06-18'", 'media policy version');
has(index, 'window.vsMediaRecovery', 'media recovery runtime API');
has(index, "var SCHEDULE_ENGINE_VERSION='schedule-v2-2026-06-18'", 'schedule engine version');
has(index, 'window.vsScheduleEngine', 'schedule engine runtime API');
has(index, 'attendanceByMember', 'group per-member attendance metadata');
has(index, 'createScheduleResetSnapshot', 'schedule reset snapshot');
has(index, '_scheduleConflictToast', 'schedule conflict gate');
has(index, 'setConsultHold', 'consult hold workflow');
has(index, "consultTab==='hold'", 'consult hold tab');
has(index, "기본 화면에서는 미배정/수강중/배정 문구를 숨기고 '배치' 버튼에서만 펼침", 'mobile schedule labels collapsed');
has(index, 'runAdminVerificationProbe', 'admin live verification panel');
has(index, 'topAdminVerifyBtn', 'top admin verification button');
has(index, 'function hasAdminSession', 'admin dashboard auth bypass');
has(index, '📌 임시저장', 'consult draft wording');
notHas(index, '보류 저장', 'old consult draft wording');
has(index, 'buildMobileScheduleSummary', 'mobile schedule compact summary');
has(index, 'mobile-schedule-compact-actions', 'mobile schedule compact action trigger');
has(index, "주간 배치 컨트롤 — 기본 화면에서는 '미배정/수강중/배정' 문구를 숨기고 버튼 하나로 접음", 'mobile week collapsed action trigger');
has(index, 'position:relative;z-index:1;padding:4px 8px;gap:4px;margin-bottom:6px', 'non-overlapping mobile view switch');
has(index, 'function renderScheduleContent', 'mobile schedule rerender reattaches handlers');
has(index, 'function mCellClick', 'mobile schedule inline cell tap handler');
has(index, 'onclick="mCellClick(this,event)"', 'mobile schedule cells inline tap fallback');
has(index, 'function buildStudentLifeTimeline', 'student profile full life timeline');
has(index, '성장 일대기 · 전체', 'student profile all-record life copy');
has(index, '이전 기록 전체', 'today card all previous records copy');
notHas(index, '이전 레슨 기록 (최근 5개)', 'old capped previous-record comment');
has(index, "var _todayPrivacy='all'", 'today schedule default shows full count');
has(index, "if(page==='schedule')return;", 'today alert does not cover schedule grid');
assert(!/function ciSetFreq\([\s\S]*?v===2/.test(index), 'ciSetFreq must not reference undefined v');

has(sw, "const VERSION = 'vs-v2-2026-06-20-schedule-count-visibility'", 'service worker schedule count visibility cache version');
has(index, 'topSyncStatus', 'visible top sync status');
for (const procedure of [
  'Firebase auth and rules release gate',
  'Split migration procedure',
  'Media recovery procedure',
  'Regression gates'
]) has(docs, procedure, `operations docs section ${procedure}`);

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  inlineScripts: scripts.length,
  indexSha256: crypto.createHash('sha256').update(index).digest('hex'),
  enforcedHostingIgnore: [...ignore].sort(),
  invariantCount: 60
};
console.log(JSON.stringify(summary, null, 2));
