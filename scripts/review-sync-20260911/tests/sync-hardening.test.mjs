import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const plan = JSON.parse(fs.readFileSync(new URL('patches/sync-hardening.json', root), 'utf8'));
const baseline = fs.readFileSync(new URL('tests/fixtures/runtime-excerpts.js', root), 'utf8');
let source = baseline;
const useBaseline = process.env.VOCAL_VARIANT === 'baseline';
if (!useBaseline) for (const p of plan.patches.slice(0, 5)) {
  assert.equal(source.split(p.old).length - 1, 1, p.id + ': exact baseline match');
  source = source.replace(p.old, p.new);
}
function env() {
  const e = { statuses: [], writes: [], scheduled: [], unsubscribeCount: 0, renderCount: 0, sidebarCount: 0, listeners: {} };
  const doc = {
    onSnapshot(...args) {
      if (typeof args[0] === 'function') { e.options = {}; [e.receive, e.error] = args; }
      else [e.options, e.receive, e.error] = args;
      return () => { e.unsubscribeCount++; };
    },
    set(payload) { e.writes.push(JSON.parse(JSON.stringify(payload))); return e.writeImpl ? e.writeImpl(payload) : Promise.resolve(); }
  };
  const db = { collection() { return { doc() { return doc; } }; } };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => 'mock-server-timestamp' };
  const ctx = {
    console: { error() {}, warn() {} }, Date, Promise,
    firebase: { auth: () => ({ currentUser: { uid: 'synthetic-admin' } }), firestore },
    window: { addEventListener(type, fn) { e.listeners[type] = fn; } },
    document: { visibilityState: 'visible', addEventListener(type, fn) { e.listeners[type] = fn; } },
    navigator: { onLine: true },
    students: [], logs: [], weekOvr: {}, consults: [], payments: [], inquiries: [], _DEFAULT_STUDENTS: [],
    _fbReady: false, _fbUnsub: null, _fbApplyingRemote: false, _skipRenderCount: 0,
    _localProtectUntil: 0, _lastFirestorePushSig: '', _lastFirestorePushAt: 0,
    _isFirebaseAdminUser: () => e.authorized !== false,
    hasAdminSession: () => e.authorized !== false,
    _disableFirestoreSync: msg => e.statuses.push(msg),
    _splitMigrationFrozen: () => !!e.frozen,
    _fs: () => db,
    _backupOrphanPhotos() {}, _stripMediaForSync: rows => JSON.parse(JSON.stringify(rows)),
    _stableForSig: value => value,
    _writeRecoverySnapshot() {}, _safeSetLS() {}, _relinkOrphanPhotos: () => 0, _injectInitialInquiries() {},
    // Non-schedule row reconciliation is outside the scope of these tests.
    _mergeByIdentity: rows => ({ list: rows.slice(), added: 0, replaced: 0 }),
    _showSyncStatus: msg => e.statuses.push(msg),
    _hasBootstrapDataForFirestore: () => true,
    renderSidebarToday() { e.sidebarCount++; },
    render() { e.renderCount++; if (e.renderThrows) throw new Error('synthetic-render-failure'); },
    setTimeout(fn) { e.scheduled.push(fn); return e.scheduled.length; },
  };
  ctx._dataSignature = () => JSON.stringify([ctx.students, ctx.logs, ctx.weekOvr, ctx.consults, ctx.payments, ctx.inquiries]);
  e.ctx = vm.createContext(ctx); e.doc = doc;
  vm.runInContext(source, e.ctx, { timeout: 1000 });
  return e;
}
const schedule = time => ({ '2026-09-07': { 'student-demo': [{ day: '화', time }] } });
const snap = (weekOvr = {}, metadata = {}, exists = true) => ({ exists, metadata, data: () => ({ students: [], logs: [], weekOvr, consults: [], payments: [], inquiries: [] }) });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('listener requests metadata changes so cache-to-server confirmation is delivered', () => {
  const e = env(); e.ctx._startFirestoreListener(); assert.equal(e.options.includeMetadataChanges, true);
});
test('a cached missing document cannot bootstrap stale local data into the server', async () => {
  const e = env(); e.ctx._startFirestoreListener(); e.receive(snap({}, { fromCache: true }, false));
  await Promise.resolve(); assert.equal(e.writes.length, 0); assert.equal(e.ctx._fbReady, false);
});
test('a cache-only existing snapshot cannot claim successful synchronization', () => {
  const e = env(); e.ctx._startFirestoreListener(); e.receive(snap(schedule('14:00'), { fromCache: true }));
  assert.equal(e.ctx._fbReady, false); assert.ok(!e.statuses.some(x => x.startsWith('✅')));
});
test('an unacknowledged local write echo cannot claim server success', () => {
  const e = env(); e.ctx._startFirestoreListener(); e.receive(snap(schedule('14:00'), { hasPendingWrites: true }));
  assert.equal(e.ctx._fbReady, false); assert.ok(!e.statuses.some(x => x.startsWith('✅')));
});
test('confirmed remote schedule changes render despite a stale local skip counter', () => {
  const e = env(); e.ctx._skipRenderCount = 2; e.ctx._startFirestoreListener();
  e.receive(snap(schedule('15:00'), { fromCache: false, hasPendingWrites: false }));
  assert.equal(e.renderCount, 1); assert.equal(e.ctx.weekOvr['2026-09-07']['student-demo'][0].time, '15:00');
});
test('an unchanged confirmed echo does not rerender', () => {
  const e = env(); e.ctx.weekOvr = schedule('15:00'); e.ctx._startFirestoreListener();
  e.receive(snap(schedule('15:00'))); assert.equal(e.renderCount, 0);
});
test('a rendering exception cannot permanently lock the remote application guard', () => {
  const e = env(); e.renderThrows = true; e.ctx._startFirestoreListener();
  try { e.receive(snap(schedule('15:00'))); } catch { /* compare the guard on the baseline as well */ }
  assert.equal(e.ctx._fbApplyingRemote, false);
});
test('a rendering exception is reported as failure, not successful sync', () => {
  const e = env(); e.renderThrows = true; e.ctx._startFirestoreListener();
  try { e.receive(snap(schedule('15:00'))); } catch {}
  assert.ok(e.statuses.some(x => x.includes('반영 실패'))); assert.ok(!e.statuses.some(x => x.startsWith('✅')));
});
test('a terminal listener error clears readiness and its stale unsubscribe handle', () => {
  const e = env(); e.ctx._startFirestoreListener(); e.receive(snap()); e.error(new Error('synthetic-permission-error'));
  assert.equal(e.ctx._fbReady, false); assert.equal(e.ctx._fbUnsub, null); assert.equal(e.unsubscribeCount, 1);
});
test('an identical payload can retry immediately after a failed write', async () => {
  const e = env(); e.writeImpl = () => e.writes.length === 1 ? Promise.reject(new Error('synthetic-offline')) : Promise.resolve();
  await e.ctx._pushToFirestore(e.doc); await e.ctx._pushToFirestore(e.doc); assert.equal(e.writes.length, 2);
});
test('duplicate suppression applies only after a successful acknowledgment', async () => {
  const e = env(); await e.ctx._pushToFirestore(e.doc); await e.ctx._pushToFirestore(e.doc); assert.equal(e.writes.length, 1);
});
test('an older acknowledgment cannot overwrite the latest save-failure indicator', async () => {
  const e = env(); const first = deferred(); const second = deferred();
  e.writeImpl = () => e.writes.length === 1 ? first.promise : second.promise;
  const p1 = e.ctx._pushToFirestore(e.doc); e.ctx.weekOvr = schedule('16:00'); const p2 = e.ctx._pushToFirestore(e.doc);
  second.reject(new Error('synthetic-latest-failure')); await p2; first.resolve(); await p1;
  assert.ok(e.statuses.at(-1).includes('저장 실패'));
});
test('a synchronous SDK serialization error is handled as a failed write', async () => {
  const e = env(); e.writeImpl = () => { throw new Error('synthetic-serialization'); };
  let thrown = false; try { await e.ctx._pushToFirestore(e.doc); } catch { thrown = true; }
  assert.equal(thrown, false); assert.ok(e.statuses.at(-1).includes('저장 실패'));
});
test('no remote write occurs without admin authorization', async () => {
  const e = env(); e.authorized = false; await e.ctx._pushToFirestore(e.doc); assert.equal(e.writes.length, 0);
});
test('no remote write occurs while migration is frozen', async () => {
  const e = env(); e.frozen = true; await e.ctx._pushToFirestore(e.doc); assert.equal(e.writes.length, 0);
});
test('network/foreground retry is event-driven and respects authorization and background state', () => {
  const e = env();
  if (!useBaseline) vm.runInContext(plan.patches.find(p => p.id === 'event-driven-listener-reconnect').new, e.ctx);
  assert.equal(typeof e.listeners.online, 'function');
  e.authorized = false; e.listeners.online(); assert.equal(e.ctx._fbUnsub, null);
  e.authorized = true; e.ctx.document.visibilityState = 'hidden'; e.listeners.visibilitychange(); assert.equal(e.ctx._fbUnsub, null);
  e.ctx.document.visibilityState = 'visible'; e.listeners.visibilitychange(); assert.equal(typeof e.ctx._fbUnsub, 'function');
});
test('weekly reset keeps exactly one write path', () => {
  const p = plan.patches.find(p => p.id === 'single-reset-writer'); const code = useBaseline ? p.old : p.new;
  let count = 0;
  vm.runInNewContext(code, { saveAll() { count++; }, _splitMigrationFrozen: () => false, _fs: () => ({ collection: () => ({ doc: () => ({ set() { count++; } }) }) }), weekOvr: {} });
  assert.equal(count, 1);
});
