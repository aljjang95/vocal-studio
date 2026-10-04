import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { StudioState } from '../worker/state.mjs';
import relay from '../worker/sms-relay.mjs';
import { smsHash } from '../worker/sms.mjs';

// Real StudioState, real SQL constraints/rollback, synthetic owner/device only.
const monday = Date.parse('2026-10-05T10:00:00+09:00'), tuesday = Date.parse('2026-10-06T14:00:00+09:00');
const student = (id = 's1', extra = {}) => ({ id, name: '정본 ' + id, ph: '01000001111', status: '수강중', schedType: 'flex', st: '2026-01-01', ...extra });
const ok = async response => { assert.equal(response.status, 200, JSON.stringify(await response.clone().json())); return response.json(); };
async function fixture(t, data = {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const control = { now: monday - 3600000, fail: '', beforeTransaction: null, broadcasts: [] }; t.mock.method(Date, 'now', () => control.now);
  let tail = Promise.resolve();
  const ctx = { storage: {
    sql: { exec(query, ...params) {
      if (control.fail && query.startsWith(control.fail)) { control.fail = ''; throw Error('synthetic storage failure'); }
      const rows = db.prepare(query).all(...params); return { toArray: () => rows };
    } },
    transactionSync(fn) {
      if (control.beforeTransaction) { const hook = control.beforeTransaction; control.beforeTransaction = null; hook(); }
      db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; }
    }, async getAlarm() { return null; }, async setAlarm() {},
  }, blockConcurrencyWhile(fn) { const result = tail.then(fn); tail = result.catch(() => {}); return result; },
  getWebSockets() { return [{ send(message) { control.broadcasts.push(JSON.parse(message)); } }]; } };
  const env = { ENVIRONMENT: 'local-test', SMS_RELAY_ORIGIN: 'http://127.0.0.1:8837' }, state = new StudioState(ctx, env);
  const api = (path, body, principal = 'synthetic-owner') => state.fetch(new Request('https://studio.internal/sms/' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'X-VS-Principal': principal }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  const initialize = await state.fetch(new Request('https://studio.internal/import', { method: 'POST', body: JSON.stringify({ state: {
    students: [student()], consults: [], inquiries: [], weekOvr: {}, future: { retain: 'owned-data' }, ...data,
  } }) })); assert.equal(initialize.status, 201);
  const exp = await state.fetch(new Request('https://studio.internal/export', { headers: { 'X-VS-Principal': 'synthetic-owner' } }));
  assert.equal((await state.fetch(new Request('https://studio.internal/activate', { method: 'POST', headers: { 'X-VS-Principal': 'synthetic-owner' }, body: JSON.stringify({ hash: (await exp.json()).hash }) }))).status, 200);
  let paired = await ok(await api('pair', { relayOrigin: env.SMS_RELAY_ORIGIN }));
  const device = (path, body, token = paired.token) => state.fetch(new Request('https://studio.internal/sms-device/' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  let seq = 0;
  return { state, ctx, env, db, api, device, control, overview: async () => ok(await api('overview')),
    get token() { return paired.token; }, get deviceId() { return paired.deviceId; },
    call: extra => device('call', { id: 'call-' + (++seq), phone: '01000001111', receivedAt: control.now, direction: 'incoming', ...extra }),
    enable: async (includeUnknown = false) => ok(await api('call-settings', { enabled: true, includeUnknown })),
    async rotate() { paired = await ok(await api('pair', { relayOrigin: env.SMS_RELAY_ORIGIN })); return paired; },
    count: () => db.prepare('SELECT count(*) AS n FROM sms_calls').get().n,
  };
}

// Response helpers await a fetch promise as well as a direct Response.
const response = ok;
const good = async pending => response(await pending);

test('independent strict call consent defaults, corruption fails closed, reminder schema unchanged', async t => {
  const f = await fixture(t), before = f.state.getKV('sms.settings');
  assert.deepEqual((await good(f.api('overview'))).callSettings, { enabled: false, includeUnknown: false });
  for (const body of [[], null, {}, { enabled: true }, { enabled: 1, includeUnknown: false }, { enabled: false, includeUnknown: 'true' }, { enabled: true, includeUnknown: false, extra: true }]) {
    assert.equal((await f.api('call-settings', body)).status, 400);
  }
  assert.equal((await f.call()).status, 409); assert.equal(f.count(), 0);
  await good(f.api('call-settings', { enabled: true, includeUnknown: false })); assert.deepEqual(f.state.getKV('sms.settings'), before);
  for (const invalid of [[], {}, { enabled: true, includeUnknown: 'true' }, { enabled: true, includeUnknown: true, extra: true }]) {
    f.state.setKV('sms.callSettings', invalid);
    assert.deepEqual((await good(f.device('pull'))).callIntake, { enabled: false, includeUnknown: false });
    assert.equal((await f.call()).status, 409);
  }
  f.db.prepare("UPDATE kv SET value='{' WHERE key='sms.callSettings'").run();
  assert.deepEqual((await good(f.api('overview'))).callSettings, { enabled: false, includeUnknown: false });
  assert.equal((await f.call()).status, 409);
  f.db.prepare("UPDATE kv SET value='{' WHERE key='sms.settings'").run();
  await good(f.api('revoke', {})); assert.equal((await f.call()).status, 401);
  assert.deepEqual(f.state.getKV('sms.callSettings'), { enabled: false, includeUnknown: false });
});

test('exact call field/type/clock boundary, normalized phone, unknown requires explicit consent', async t => {
  const f = await fixture(t); await good(f.api('call-settings', { enabled: true, includeUnknown: false }));
  for (const extra of [{ id: null }, { id: ' bad' }, { phone: 100 }, { phone: 'private' }, { phone: 'x01000001111' }, { receivedAt: '2026-10-05T00:00:00Z' },
    { receivedAt: String(f.control.now) }, { receivedAt: f.control.now + 1 }, { receivedAt: 1.2 }, { receivedAt: null }, { receivedAt: 0 },
    { direction: 'outgoing' }, { direction: 'received' }, { text: 'no call audio or body' }, { unexpected: true }]) assert.equal((await f.call(extra)).status, 400, JSON.stringify(extra));
  assert.equal((await f.call({ receivedAt: f.control.now - 1 })).status, 409);
  assert.equal((await f.call({ phone: '01000009999' })).status, 409);
  const accepted = await good(f.call({ phone: '+82 (0)10 0000 1111' }));
  const calls = (await good(f.api('overview'))).calls; assert.equal(calls.length, 1); assert.equal(calls[0].id, accepted.callId); assert.equal(calls[0].phone, '01000001111');
  await good(f.api('call-settings', { enabled: true, includeUnknown: true }));
  await good(f.call({ phone: '01000009999' }));
  assert.equal((await good(f.api('overview'))).calls.find(c => c.phone === '01000009999').matchStatus, 'unknown');
});

test('durable per device/event idempotency, conflicting payload409, transaction rollback and restart', async t => {
  const f = await fixture(t); await good(f.api('call-settings', { enabled: true, includeUnknown: true }));
  const payload = { id: 'stable', phone: '01000001111', receivedAt: f.control.now, direction: 'incoming' };
  const first = await good(f.device('call', payload)); assert.equal(first.duplicate, false);
  const repeats = await Promise.all(Array.from({ length: 5 }, () => good(f.device('call', payload))));
  for (const item of repeats) { assert.equal(item.duplicate, true); assert.equal(item.callId, first.callId); }
  for (const extra of [{ phone: '+821000001111' }, { phone: '01000009999' }, { receivedAt: f.control.now + 1000 }]) {
    f.control.now += 1000; assert.equal((await f.device('call', { ...payload, ...extra })).status, 409);
  }
  assert.equal(f.count(), 1);
  f.control.fail = 'INSERT INTO kv'; assert.equal((await f.call()).status, 503); assert.equal(f.count(), 1);
  await good(f.call()); assert.equal(f.count(), 2);
  const restarted = new StudioState(f.ctx, f.env);
  const readback = await good(restarted.fetch(new Request('https://studio.internal/sms/overview', { headers: { 'X-VS-Principal': 'synthetic-owner' } })));
  assert.equal(readback.calls.length, 2); assert.ok(readback.calls.some(c => c.id === first.callId));
  const oldToken = f.token; f.control.now += 1000; await f.rotate();
  assert.equal((await f.device('call', payload, oldToken)).status, 401);
  await good(f.api('call-settings', { enabled: true, includeUnknown: false }));
  await good(f.device('call', { ...payload, receivedAt: f.control.now })); assert.equal(f.count(), 3);
});

test('current canonical student/consult/inquiry identities unify explicit links only, latest200', async t => {
  const f = await fixture(t, { students: [student('s1', { consultData: { id: 'c1' } }), student('s2', { ph: '01000002222' })],
    consults: [{ id: 'c1', phone: '01000001111', name: 'old alias' }, { id: 'c2', phone: '01000002222', name: '정본 s2' }, { id: 'c3', phone: '01000003333', name: '<img src=x>' }],
    inquiries: [{ id: 'q1', phone: '01000001111', convertedStudentId: 's1', name: 'inquiry alias' }, { id: 'q4', phone: '01000004444', name: '문의자' }] });
  await good(f.api('call-settings', { enabled: true, includeUnknown: true }));
  for (const phone of ['01000001111', '01000002222', '01000003333', '01000004444', '01000005555']) await good(f.call({ phone }));
  let rows = (await good(f.api('overview'))).calls;
  assert.deepEqual(rows.find(c => c.phone === '01000001111').name, '정본 s1'); assert.equal(rows.find(c => c.phone === '01000001111').matchStatus, 'matched');
  assert.equal(rows.find(c => c.phone === '01000002222').matchStatus, 'ambiguous'); assert.equal(rows.find(c => c.phone === '01000002222').name, '');
  assert.equal(rows.find(c => c.phone === '01000003333').matchStatus, 'known-contact'); assert.equal(rows.find(c => c.phone === '01000004444').name, '문의자');
  assert.equal(rows.find(c => c.phone === '01000005555').matchStatus, 'unknown');
  const r = f.state.record(); r.state.students[0].name = 'new canonical'; f.state.setKV('record', r);
  assert.equal((await good(f.api('overview'))).calls.find(c => c.phone === '01000001111').name, 'new canonical');
  r.state.inquiries[0].studentId = 's2'; f.state.setKV('record', r);
  assert.equal((await good(f.api('overview'))).calls.find(c => c.phone === '01000001111').matchStatus, 'ambiguous');
  for (let i = 0; i < 201; i++) { f.control.now++; await good(f.call({ id: 'recent-' + i })); }
  rows = (await good(f.api('overview'))).calls; assert.equal(rows.length, 200); assert.equal(rows[0].receivedAt, f.control.now);
  assert.equal(rows.at(-1).receivedAt, f.control.now - 199);
});

test('late authentication, settings and canonical allowlist changes rechecked before any call mutation', async t => {
  const f = await fixture(t); await good(f.api('call-settings', { enabled: true, includeUnknown: false }));
  const original = crypto.subtle.digest.bind(crypto.subtle);
  let hook = null;
  t.mock.method(crypto.subtle, 'digest', async (algorithm, bytes) => {
    const result = await original(algorithm, bytes);
    if (hook && new TextDecoder().decode(bytes).startsWith('[')) { const run = hook; hook = null; run(); }
    return result;
  });
  for (const scenario of ['disabled', 'allowlist', 'revoked', 'rotated']) {
    const device = f.state.getKV('sms.device'), record = f.state.record();
    f.state.setKV('sms.callSettings', { enabled: true, includeUnknown: false });
    hook = () => {
      if (scenario === 'disabled') f.state.setKV('sms.callSettings', { enabled: false, includeUnknown: false });
      if (scenario === 'allowlist') f.state.setKV('record', { ...record, state: { ...record.state, students: [] } });
      if (scenario === 'revoked') f.state.setKV('sms.device', null);
      if (scenario === 'rotated') f.state.setKV('sms.device', { ...device, id: 'new', tokenHash: 'changed' });
    };
    assert.equal((await f.call()).status, ['revoked', 'rotated'].includes(scenario) ? 401 : 409);
    assert.equal(f.count(), 0); assert.deepEqual(f.state.getKV('sms.device'), scenario === 'revoked' ? null : scenario === 'rotated' ? { ...device, id: 'new', tokenHash: 'changed' } : device);
    f.state.setKV('sms.device', device); f.state.setKV('record', record);
  }
  // Simulate a revoke during streamed body reading; no stale heartbeat may resurrect it.
  let release, entered; const ready = new Promise(resolve => { entered = resolve; });
  const stream = new ReadableStream({ async start(controller) { entered(); await new Promise(resolve => { release = resolve; }); controller.enqueue(new TextEncoder().encode(JSON.stringify({ id:'slow', phone:'01000001111', receivedAt:f.control.now, direction:'incoming' }))); controller.close(); } });
  const pending = f.state.fetch(new Request('https://studio.internal/sms-device/call', { method:'POST', headers:{Authorization:'Bearer ' + f.token}, body:stream, duplex:'half' }));
  await ready; await new Promise(resolve => setImmediate(resolve)); f.state.setKV('sms.device', null); release();
  assert.equal((await pending).status, 401); assert.equal(f.state.getKV('sms.device'), null); assert.equal(f.count(), 0);
});

test('strict reciprocal inquiry-consult-student identity chain unifies current person, broken/duplicate/conflicting IDs hold',async t=>{
  const initial={students:[student('s1',{consultData:{id:'c1'}})],consults:[{id:'c1',phone:'01000001111',name:'consult alias',_inquiryId:'q1'}],
    inquiries:[{id:'q1',phone:'01000001111',name:'inquiry alias',consultId:'c1'}]};
  const f=await fixture(t,initial);await f.enable();await good(f.call());const original=structuredClone(f.state.record());
  const matched=(await f.overview()).calls[0];assert.equal(matched.matchStatus,'matched');assert.equal(matched.studentId,'s1');assert.equal(matched.name,'정본 s1');
  for(const mutate of [s=>delete s.inquiries[0].consultId,s=>delete s.consults[0]._inquiryId,s=>s.inquiries[0].consultId='missing',s=>s.consults[0]._inquiryId='missing',
    s=>s.inquiries.push({...s.inquiries[0],id:'q2'}),s=>s.inquiries.push({...s.inquiries[0]}),s=>s.consults.push({...s.consults[0]}),
    s=>s.students.push(student('s2',{consultData:{id:'c1'}})),s=>s.inquiries[0].studentId='missing',s=>{s.students.push(student('s2'));s.inquiries[0].studentId='s2';},
    s=>s.inquiries[0].consultId=1,s=>s.consults[0]._inquiryId=[]]) {
    const r=structuredClone(original);mutate(r.state);f.state.setKV('record',r);const held=(await f.overview()).calls[0];assert.equal(held.matchStatus,'ambiguous');assert.equal(held.name,'');assert.equal(held.studentId,null);
  }
  f.state.setKV('record',original);const again=(await f.overview()).calls[0];assert.equal(again.name,'정본 s1');assert.deepEqual(f.state.record(),original);
});

test('call never replies/suppresses Tuesday/books schedule; owner dismiss is idempotent and isolated', async t => {
  const f = await fixture(t); await good(f.api('call-settings', { enabled: true, includeUnknown: false }));
  const cfg = (await good(f.api('overview'))).settings; await good(f.api('settings', { ...cfg, enabled: true }));
  const before = structuredClone(f.state.record()), call = await good(f.call());
  assert.deepEqual(f.state.record(), before); assert.equal(f.db.prepare('SELECT count(*) AS n FROM sms_messages').get().n, 0);
  f.control.now = tuesday; const pull = await good(f.device('pull')); assert.equal(pull.messages.length, 1);
  assert.equal((await good(f.api('overview'))).unassigned[0].replied, false);
  const settings = f.state.getKV('sms.settings'), queue = f.db.prepare('SELECT * FROM sms_outbox').all();
  for (let i = 0; i < 2; i++) await good(f.api('call-dismiss', { callId:call.callId }));
  assert.equal((await good(f.api('overview'))).calls[0].status, 'acknowledged');
  assert.deepEqual(f.state.record(), before); assert.deepEqual(f.state.getKV('sms.settings'), settings); assert.deepEqual(f.db.prepare('SELECT * FROM sms_outbox').all(), queue);
  assert.equal((await f.api('call-dismiss', { callId:'absent' })).status, 404);
  assert.equal((await f.api('call-dismiss', { callId:call.callId, name:'invented' })).status, 400);
});

test('owner-selected inquiry uses manual schema, strict explicit name, CAS rollback, durable replay and no booking', async t => {
  const f = await fixture(t); await good(f.api('call-settings', { enabled: true, includeUnknown: true }));
  const call = await good(f.call({ phone:'01000009999' })), before = structuredClone(f.state.record());
  const body = { callId:call.callId, baseRevision:0, name:'  Owner chosen name  ', memo:'  owner memo  ' };
  for (const extra of [{ name:'' }, { name:null }, { name:'a'.repeat(81) }, { memo:1 }, { memo:'a'.repeat(501) }, { studentId:'s1' }]) assert.equal((await f.api('call-inquiry', { ...body, ...extra })).status, 400);
  assert.equal((await f.api('call-inquiry', { ...body, baseRevision:1 })).status, 409); assert.deepEqual(f.state.record(), before);
  f.control.fail = 'UPDATE sms_calls'; assert.equal((await f.api('call-inquiry', body)).status, 503); assert.deepEqual(f.state.record(), before); assert.equal(f.state.getKV('sms.callInquiry.' + call.callId), null);
  const receipt = await good(f.api('call-inquiry', body)); assert.equal(receipt.revision, 1);
  const r = f.state.record(); assert.deepEqual(r.state.inquiries[0], { id:receipt.inquiryId, name:'Owner chosen name', phone:'01000009999', memo:'owner memo', visitDate:'', visitTime:'', date:'2026-10-05' });
  assert.deepEqual(r.state.weekOvr, before.state.weekOvr); assert.deepEqual(r.state.future, before.state.future);
  assert.equal((await good(f.api('overview'))).calls[0].status, 'acknowledged');
  const restarted = new StudioState(f.ctx, f.env), replay = await good(restarted.fetch(new Request('https://studio.internal/sms/call-inquiry', { method:'POST', headers:{'X-VS-Principal':'synthetic-owner'}, body:JSON.stringify(body) })));
  assert.equal(replay.duplicate, true); assert.equal(replay.inquiryId, receipt.inquiryId); assert.equal(restarted.record().state.inquiries.length, 1);
  assert.equal((await f.api('call-inquiry', { ...body, name:'different' })).status, 409);
  const known = await good(f.call()); assert.equal((await f.api('call-inquiry', { ...body, callId:known.callId, baseRevision:1 })).status, 409);
});

test('call inquiry CAS is rechecked within transaction; stale allowlist and malformed state fail closed', async t => {
  const f = await fixture(t); await good(f.api('call-settings', { enabled:true, includeUnknown:true }));
  const call = await good(f.call({ phone:'01000009999' }));
  f.control.beforeTransaction = () => { const r = f.state.record(); f.state.setKV('record', { ...r, revision:1 }); };
  assert.equal((await f.api('call-inquiry', { callId:call.callId, baseRevision:0, name:'entered', memo:'' })).status, 409);
  assert.equal(f.state.record().state.inquiries.length, 0);
  for (const field of ['students','consults','inquiries']) {
    const r = f.state.record(); f.state.setKV('record', { ...r, state:{ ...r.state, [field]:{} } });
    assert.equal((await f.call()).status, 409); assert.equal(f.count(), 1); f.state.setKV('record', r);
  }
});

test('relay exposes only bounded device metadata; owner endpoints require principal and stay private', async t => {
  const f = await fixture(t); await good(f.api('call-settings', { enabled:true, includeUnknown:false }));
  const env = { SMS_STUDIO:{ async deviceRequest({ path, method, token, body }) { const r = await f.device(path.slice(8), method === 'GET' ? undefined : body, token); return {status:r.status, body:await r.json()}; } } };
  const request = (path, init = {}) => relay.fetch(new Request('http://localhost' + path, { headers:{Authorization:'Bearer ' + f.token}, ...init }), env);
  const pull = await good(request('/device/pull')); assert.deepEqual(pull.callIntake, {enabled:true,includeUnknown:false});
  assert.deepEqual(pull.allowedPhoneHashes, [await smsHash('01000001111')]); assert.ok(!JSON.stringify(pull).includes('정본'));
  for (const path of ['call-settings','call-dismiss','call-inquiry','options']) {
    assert.equal((await request('/sms/' + path, {method:'POST',body:'{}'})).status, 404);
    assert.equal((await f.api(path, {}, '')).status, 401);
  }
  for (const path of ['/device/call?x=1','/device/overview']) assert.equal((await request(path, {method:'POST',body:'{}'})).status, 404);
  assert.equal((await request('/device/call')).status, 404); assert.equal((await request('/device/call', {method:'POST',headers:{},body:'{}'})).status, 401);
  assert.equal((await request('/device/call', {method:'POST',body:'x'.repeat(16385)})).status, 413);
  assert.equal((await request('/device/call', {method:'POST',body:'{'})).status, 400);
  const call = await good(request('/device/call', {method:'POST',body:JSON.stringify({id:'relay',phone:'01000001111',receivedAt:f.control.now,direction:'incoming'})}));
  assert.deepEqual(Object.keys(call).sort(), ['callId','duplicate','ok']); assert.equal(f.count(), 1);
});
