import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { StudioState } from '../worker/state.mjs';
import worker from '../worker/index.mjs';
import relay from '../worker/sms-relay.mjs';
import { normalizePhone, proposeSchedule, smsHash } from '../worker/sms.mjs';
import { scheduleSnapshot } from '../worker/schedule-core.generated.mjs';

const at = value => Date.parse(value + '+09:00');
const monday = at('2026-10-05T10:00:00'), tuesday = at('2026-10-06T14:00:00');
const student = (id = 's1', extra = {}) => ({ id, name: '정식 이름 ' + id, ph: '01000001111', status: '수강중', schedType: 'flex', st: '2026-01-01', ...extra });
function fixture(t, data = {}, env = {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const control = { now: monday - 3600000, fail: '', failKey: '', alarm: null, broadcasts: [] }; let tail = Promise.resolve();
  t.mock.method(Date, 'now', () => control.now);
  const ctx = { storage: {
    sql: { exec(query, ...params) {
      if (control.fail && query.startsWith(control.fail)) { control.fail = ''; throw Error('injected-failure'); }
      if (control.failKey && query.startsWith('INSERT INTO kv') && params[0] === control.failKey) { control.failKey = ''; throw Error('injected-kv-failure'); }
      const rows = db.prepare(query).all(...params); return { toArray: () => rows };
    } },
    transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    async getAlarm() { return control.alarm; }, async setAlarm(value) { control.alarm = value; },
  }, blockConcurrencyWhile(fn) { const result = tail.then(fn); tail = result.catch(() => {}); return result; },
  getWebSockets() { return [{ send(message) { control.broadcasts.push(JSON.parse(message)); } }]; } };
  const config = { ENVIRONMENT: 'local-test', SMS_RELAY_ORIGIN: 'http://127.0.0.1:8837', ...env };
  const state = new StudioState(ctx, config); let token = '', deviceId = '', seq = 0;
  const api = (path, body, principal = 'synthetic-owner') => state.fetch(new Request('https://studio.internal' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'X-VS-Principal': principal }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  const device = (path, body, bearer = token) => state.fetch(new Request('https://studio.internal/sms-device/' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + bearer }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  const overview = async () => (await api('/sms/overview')).json();
  const read = () => state.record();
  const event = async (extra = {}) => device('event', { id: 'event-' + (++seq), phone: '01000001111', text: '이번 주 수요일 오후 3시 가능합니다', direction: 'received', receivedAt: control.now, ...extra });
  return { db, ctx, state, config, control, api, device, overview, read, event, get token() { return token; }, get deviceId() { return deviceId; },
    async activate() {
      const imported = await api('/import', { state: { students: [student()], consults: [], inquiries: [], weekOvr: {}, future: { retain: 'customer-unknown' }, ...data } });
      assert.equal(imported.status, 201, JSON.stringify(await imported.clone().json()));
      const exp = await (await api('/export')).json(); assert.equal((await api('/activate', { hash: exp.hash })).status, 200); control.broadcasts.length = 0;
    },
    async pair(enabled = true) {
      const response = await api('/sms/pair', { relayOrigin: config.SMS_RELAY_ORIGIN }); assert.equal(response.status, 200);
      const paired = await response.json(); token = paired.token; deviceId = paired.deviceId;
      if (enabled) assert.equal((await api('/sms/settings', { ...(await overview()).settings, enabled: true })).status, 200);
      return paired;
    },
    async commit(stateChanges) { const r = read(); return api('/commit', { requestId: crypto.randomUUID(), baseRevision: r.revision, state: { ...r.state, ...stateChanges } }); },
  };
}
const responseOK = async response => { assert.equal(response.status, 200, JSON.stringify(await response.clone().json())); return response.json(); };
const pendingCard = async f => (await f.overview()).messages.find(m => m.status === 'pending');
const entry = (messageId, extra = {}) => ({ messageId, studentId: 's1', date: '2026-10-07', time: '15:00', ...extra });

test('owner schedule window ranks adjacency and exact minute request, remains a read with guarded manual confirmation', async t => {
  const peer = student('peer', { ph:'01000002222', schedType:'fixed', days:['수'], times:{수:'16:00'} });
  const f = fixture(t,{students:[student(),peer]});await f.activate();await f.pair(false);await responseOK(await f.event());
  const card=await pendingCard(f), before=structuredClone(f.read());
  const query={baseRevision:0,messageId:card.id,studentId:'s1',date:'2026-10-07',startTime:'12:00',endTime:'20:00'};
  const options=await responseOK(await f.api('/sms/options',query));assert.equal(options.options[0].time,'15:00');assert.equal(options.options.length,6);
  const exact=await responseOK(await f.api('/sms/options',{...query,preferredTime:'14:15'}));assert.equal(exact.options[0].time,'14:15');
  assert.deepEqual(f.read(),before);assert.equal((await pendingCard(f)).status,'pending');assert.equal(f.control.broadcasts.length,0);
  const overlap=await responseOK(await f.api('/sms/options',{...query,preferredTime:'15:30'}));assert.ok(overlap.warnings.length);assert.ok(!overlap.options.some(o=>o.time==='15:30'||o.time==='16:00'));
  for(const extra of [{date:'2026-02-30'},{startTime:['12:00']},{endTime:'12:30'},{preferredTime:1500},{limit:1}]) assert.equal((await f.api('/sms/options',{...query,...extra})).status,400);
  assert.equal((await f.api('/sms/options',{...query,baseRevision:1})).status,409);assert.equal((await f.api('/sms/options',{...query,studentId:'peer'})).status,409);
  const denied=await f.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id,{time:'15:30'})]});assert.equal(denied.status,409);
  assert.deepEqual((await denied.json()).conflict,{date:'2026-10-07',time:'15:30',names:['정식 이름 peer']});assert.deepEqual(f.read(),before);
  await responseOK(await f.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id,{time:'14:15'})]}));assert.equal(f.read().revision,1);
  assert.equal((await f.overview()).messages[0].confirmation.time,'14:15');assert.equal((await f.api('/sms/options',{...query,baseRevision:1})).status,409);
});

test('interval confirmation detects offset batch overlap atomically, unknown active legacy data gives no options or mutation', async t => {
  const f=fixture(t,{students:[student(),student('s2',{ph:'01000002222'})]});await f.activate();await f.pair(false);await f.event();await f.event({phone:'01000002222'});
  const cards=(await f.overview()).messages,before=structuredClone(f.read());
  const response=await f.api('/sms/confirm',{baseRevision:0,entries:[entry(cards.find(c=>c.studentId==='s1').id),entry(cards.find(c=>c.studentId==='s2').id,{studentId:'s2',time:'15:30'})]});
  assert.equal(response.status,409);assert.equal((await response.json()).error,'sms-schedule-conflict');assert.deepEqual(f.read(),before);
  const g=fixture(t,{students:[student(),student('legacy',{ph:'01000003333',schedType:'fixed',days:['수'],times:{수:['15:00','16:00']}})]});await g.activate();await g.pair(false);await g.event();
  const card=await pendingCard(g),original=structuredClone(g.read()),query={baseRevision:0,messageId:card.id,studentId:'s1',date:'2026-10-07',startTime:'12:00',endTime:'20:00'};
  const ranked=await responseOK(await g.api('/sms/options',query));assert.deepEqual(ranked.options,[]);assert.ok(ranked.warnings.length);
  assert.equal((await g.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id,{time:'18:00'})]})).status,409);assert.deepEqual(g.read(),original);
});

test('same-revision recommendations honor original self/canceled keys and actual confirmed-date occupancy',async t=>{
  const date='2026-10-07',wk=scheduleSnapshot({students:[],weekOvr:{}},date).weekKey;
  for(const variant of ['confirmed-kind-cancel','confirmed-absent','confirmed-override-cancel','week-cancel','self-active']) {
    const cancelled=variant==='confirmed-kind-cancel'?{kind:'cancel'}:variant==='confirmed-absent'?{absent:true}:{overrideType:'cancel'};
    const data=variant.startsWith('confirmed')?{students:[student('s1',{confirmedDates:[{date,time:'15:00',...cancelled}]})]}:
      {weekOvr:{[wk]:{s1:[{day:'수',time:'15:00',...(variant==='week-cancel'?{absent:true,overrideType:'cancel'}:{})}]}}};
    const f=fixture(t,data);await f.activate();await f.pair(false);await f.event();const card=await pendingCard(f),before=structuredClone(f.read());
    const ranked=await responseOK(await f.api('/sms/options',{baseRevision:0,messageId:card.id,studentId:'s1',date,startTime:'13:00',endTime:'19:00',preferredTime:'15:00'}));
    assert.ok(!ranked.options.some(option=>option.time==='15:00'),variant);assert.deepEqual(f.read(),before);
    assert.equal((await f.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id)]})).status,409,variant);assert.deepEqual(f.read(),before);
    // Every offered option must be confirmable against this exact unchanged revision.
    for(const option of ranked.options){f.control.failKey='record';const result=await f.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id,{time:option.time})]});
      assert.equal(result.status,503,variant+' offered '+option.time+' must reach transactional write');assert.equal(f.control.failKey,'');assert.deepEqual(f.read(),before);}
  }
});

test('strict Korean phone normalization and cautious deterministic Korean proposals', () => {
  for (const phone of ['010-0000-1111', '+82 10 0000 1111', '0082-10-0000-1111', '+82 (0)10 0000 1111']) assert.equal(normalizePhone(phone), '01000001111');
  for (const phone of ['x01000001111', '01000001111/01000002222', '82 10 0000 1111', '12345', null]) assert.equal(normalizePhone(phone), '');
  const time = at('2026-10-05T09:00:00');
  const p = proposeSchedule('다음 주 화요일 오후 2시 반 가능합니다', time);
  assert.equal(p.date, '2026-10-13'); assert.equal(p.time, '14:30');
  assert.equal(proposeSchedule('10월 7일 15:30 가능합니다', time).time, '15:30');
  for (const s of ['수요일 3시', '이번주 수요일 오후3시 또는 오후4시', '10월 7일 오후3시 안돼요', '오늘 오후3시 취소', '내일 저녁', '10월32일 오후3시', '이번주 월요일 오전8시', '내일 오후3시쯤', '내일 오후3시부터 오후4시까지', '내일 오후3시 안 갈게요', '내일 오후3시 말고', '내일 오후3시 30']) {
    assert.deepEqual([proposeSchedule(s, time).date, proposeSchedule(s, time).time], ['', ''], s);
  }
});
test('owner Access/protocol/same-origin and internal/public path boundaries', async t => {
  const f = fixture(t); await f.activate();
  const production = { ...f.config, ENVIRONMENT: 'production', STUDIO: { idFromName: x => x, get: () => ({ fetch: () => { throw Error('must not reach state'); } }) } };
  for (const path of ['/api/sms/overview', '/device/pull', '/sms-device/pull']) assert.equal((await worker.fetch(new Request('https://studio.example' + path), production)).status, 401);
  const local = { ...f.config, STUDIO: { idFromName: x => x, get: () => f.state } };
  assert.equal((await worker.fetch(new Request('http://localhost/api/sms/overview'), local)).status, 400);
  assert.equal((await worker.fetch(new Request('http://localhost/api/sms/pair', { method: 'POST', headers: { 'X-VS-Protocol': 'vs-cf-1', Origin: 'https://evil.example' }, body: '{}' }), local)).status, 403);
  assert.equal((await worker.fetch(new Request('http://localhost/device/pull', { headers: { 'X-VS-Protocol': 'vs-cf-1' } }), local)).status, 404);
  assert.equal((await f.api('/sms/overview', undefined, '')).status, 401);
  assert.equal((await worker.fetch(new Request('http://localhost/api/sms/overview', { headers: { 'X-VS-Protocol': 'vs-cf-1' } }), local)).status, 200);
});
test('disabled defaults, configured-origin pairing, hash-only storage and token rotation/revocation', async t => {
  const f = fixture(t); await f.activate(); const initial = await f.overview();
  assert.equal(initial.settings.enabled, false); assert.equal(initial.settings.mondayTime, '10:00'); assert.equal(initial.settings.tuesdayTime, '14:00'); assert.equal(initial.device.paired, false); assert.equal(initial.device.relayOrigin, f.config.SMS_RELAY_ORIGIN);
  assert.equal((await f.api('/sms/prepare', { stage: 'monday' })).status, 409);
  for (const origin of ['http://relay.workers.dev', 'https://evil.example', 'http://localhost:8837', 'http://127.0.0.1:8837/path']) assert.notEqual((await f.api('/sms/pair', { relayOrigin: origin })).status, 200);
  const first = await f.pair(false);
  assert.equal(f.state.getKV('sms.device').tokenHash, await smsHash(first.token));
  assert.ok(!JSON.stringify(f.db.prepare('SELECT * FROM kv').all()).includes(first.token));
  assert.equal((await f.device('pull', undefined, 'bad')).status, 401);
  await f.pair(); assert.equal((await f.device('pull', undefined, first.token)).status, 401);
  f.control.now = monday; await responseOK(await f.device('pull'));
  assert.equal((await f.overview()).outbox.length, 1);
  await responseOK(await f.api('/sms/revoke', {}));
  assert.equal((await f.device('pull')).status, 401); assert.equal((await f.overview()).outbox[0].status, 'cancelled'); assert.equal((await f.overview()).settings.enabled, false);
  const unconfigured = fixture(t, {}, { SMS_RELAY_ORIGIN: '' }); await unconfigured.activate();
  assert.equal((await unconfigured.api('/sms/pair', { relayOrigin: 'http://127.0.0.1:8837' })).status, 409);
});
test('relay and DO both bound method/path/auth/body; relay never proxies owner data', async t => {
  const f = fixture(t); await f.activate(); await f.pair(false); let calls = 0;
  const env = { SMS_STUDIO: { async deviceRequest({ path, method, token, body }) { calls++; const r = await f.device(path.slice(8), method === 'GET' ? undefined : body, token); return { status: r.status, body: await r.json() }; } } };
  const r = (path, init = {}) => relay.fetch(new Request('http://localhost' + path, { headers: { Authorization: 'Bearer ' + f.token }, ...init }), env);
  for (const path of ['/api/sms/overview', '/device/pull?x=1', '/device/export']) assert.equal((await r(path)).status, 404);
  assert.equal((await r('/device/pull', { method: 'POST', body: '{}' })).status, 404);
  assert.equal((await r('/device/pull', { headers: {} })).status, 401); assert.equal(calls, 0);
  const pull = await responseOK(await r('/device/pull')); assert.deepEqual(pull.messages, []); assert.deepEqual(pull.allowedPhoneHashes, [await smsHash('01000001111')]);
  assert.deepEqual(Object.keys(pull).sort(), ['allowedPhoneHashes', 'callIntake', 'deviceId', 'messages', 'ok', 'serverTime']);
  assert.deepEqual(pull.callIntake, {enabled:false,includeUnknown:false});
  for (const send of [body => r('/device/event', { method: 'POST', body }), body => f.state.fetch(new Request('https://studio.internal/sms-device/event', { method: 'POST', headers: { Authorization: 'Bearer ' + f.token }, body }))]) {
    assert.equal((await send('x'.repeat(16385))).status, 413); assert.equal((await send('{')).status, 400);
  }
  assert.equal((await f.event({ text: '가'.repeat(4001) })).status, 400);
  assert.equal((await f.device('pull?x=1')).status, 404);
});
test('events exact-match canonical name, preserve sent direction, drop unknowns, hold duplicate students and do not mutate aliases', async t => {
  const f = fixture(t, { students: [student(), student('s2', { ph: '01000002222' }), student('s3', { ph: '+82 10 0000 2222' })],
    consults: [{ id: 'c1', phone: '01000001111', name: '상담 별명', memo: 'preserve' }] });
  await f.activate(); await f.pair(false); const before = structuredClone(f.read());
  assert.deepEqual(await responseOK(await f.event({ phone: '01000009999', text: 'unknown private text' })), { ok: true, matched: false, duplicate: false });
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM sms_messages').get().n, 0); assert.equal(f.db.prepare('SELECT count(*) AS n FROM sms_events').get().n, 0);
  await responseOK(await f.event({ phone: '+82 10 0000 1111', direction: 'sent', text: '제가 확인하겠습니다' }));
  await responseOK(await f.event({ phone: '01000002222' }));
  const overview = await f.overview(); assert.equal(overview.messages.find(m => m.phone === '01000001111').name, '정식 이름 s1');
  assert.equal(overview.messages.find(m => m.phone === '01000001111').direction, 'sent');
  assert.equal(overview.messages.find(m => m.phone === '01000002222').matchStatus, 'ambiguous');
  assert.equal(overview.messages.find(m => m.phone === '01000002222').studentId, null); assert.equal(overview.aliasChanges.length, 1);
  assert.deepEqual(f.read(), before); assert.equal(f.control.broadcasts.length, 0);
});
test('parallel event replay, content duplicate under another id, changed payload rejected; future/history denied', async t => {
  const f = fixture(t); await f.activate(); await f.pair(false);
  const input = { id: 'duplicate-1', phone: '01000001111', text: '내일 오후3시', receivedAt: f.control.now, direction: 'received' };
  const outputs = await Promise.all(Array.from({ length: 8 }, () => f.device('event', input).then(responseOK)));
  assert.equal(outputs.filter(o => !o.duplicate).length, 1);
  assert.equal((await responseOK(await f.device('event', { ...input, id: 'duplicate-2', phone: '+82 10 0000 1111' }))).duplicate, true);
  assert.equal((await f.device('event', { ...input, text: 'changed' })).status, 409);
  assert.equal((await f.device('event', { ...input, phone: '+82 10 0000 1111' })).status, 409);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM sms_messages').get().n, 1);
  for (const value of [f.control.now + 1, f.control.now - 1, 'not-a-date', -1]) assert.notEqual((await f.event({ receivedAt: value })).status, 200);
  f.control.now += 7 * 86400000;
  assert.equal((await f.event({ receivedAt: '2026-10-05T24:00:00+09:00' })).status, 400);
  assert.equal((await responseOK(await f.device('event', input))).duplicate, true);
});
test('Monday pre-request received reply suppresses creation; owner sent message does not; duplicate phones never send', async t => {
  const f = fixture(t, { students: [student(), student('s2', { ph: '01000002222' }), student('s3', { ph: '01000003333' }), student('s4', { ph: '01000003333' }), student('inactive', { ph: '01000004444', status: '휴강' }), student('fixed', { ph: '01000005555', schedType: 'fixed' })] });
  await f.activate(); await f.pair();
  await responseOK(await f.event()); await responseOK(await f.event({ phone: '01000002222', direction: 'sent' }));
  f.control.now = monday - 1; assert.deepEqual((await responseOK(await f.device('pull'))).messages, []);
  f.control.now = monday;
  const pull = await responseOK(await f.device('pull')); assert.equal(pull.messages.length, 1); assert.equal(pull.messages[0].phone, '01000002222');
  const overview = await f.overview(); assert.equal(overview.unassigned.find(s => s.id === 's1').replied, true); assert.equal(overview.unassigned.find(s => s.id === 's2').replied, false);
  assert.equal((await responseOK(await f.api('/sms/prepare', { stage: 'monday' }))).count, 0);
});
test('same-stage concurrent pulls/prepare idempotent, claim exactly once, ACK replay safe and no failed/unknown retries', async t => {
  const f = fixture(t); await f.activate(); await f.pair(); f.control.now = monday;
  await Promise.all(Array.from({ length: 8 }, (_, i) => i % 2 ? f.device('pull') : f.api('/sms/prepare', { stage: 'monday' })));
  assert.equal((await f.overview()).outbox.length, 1);
  const id = (await responseOK(await f.device('pull'))).messages[0].id;
  const claims = await Promise.all(Array.from({ length: 8 }, () => f.device('claim', { id })));
  assert.equal(claims.filter(r => r.status === 200).length, 1); assert.equal(claims.filter(r => r.status === 409).length, 7);
  assert.deepEqual((await responseOK(await f.device('pull'))).messages, []);
  await responseOK(await f.device('ack', { id, status: 'unknown', error: 'synthetic' }));
  await responseOK(await f.device('ack', { id, status: 'unknown' })); assert.equal((await f.device('ack', { id, status: 'sent' })).status, 409);
  assert.deepEqual((await responseOK(await f.device('pull'))).messages, []); assert.equal(f.control.alarm, null);
  assert.equal((await f.overview()).outbox[0].status, 'unknown');
});
test('both stages recheck received reply at claim, and Tue owner sent request never counts as reply', async t => {
  const f = fixture(t); await f.activate(); await f.pair(); f.control.now = monday;
  const mon = (await responseOK(await f.device('pull'))).messages[0];
  await responseOK(await f.event({ direction: 'sent', text: mon.text }));
  await responseOK(await f.device('claim', { id: mon.id })); await responseOK(await f.device('ack', { id: mon.id, status: 'sent' }));
  f.control.now = tuesday; const tue = (await responseOK(await f.device('pull'))).messages[0]; assert.ok(tue);
  await responseOK(await f.event({ text: '수요일 가능합니다' }));
  assert.equal((await f.device('claim', { id: tue.id })).status, 409); assert.equal((await f.overview()).outbox.find(m => m.id === tue.id).status, 'suppressed');
  assert.equal((await f.overview()).unassigned[0].replied, true);
  const g = fixture(t); await g.activate(); await g.pair(); g.control.now = monday;
  const item = (await responseOK(await g.device('pull'))).messages[0]; await responseOK(await g.event());
  assert.equal((await g.device('claim', { id: item.id })).status, 409);
});
test('queued claim rechecks authoritative booking, roster eligibility, phone, disabled state and token scope', async t => {
  for (const mutation of ['booking', 'inactive', 'phone', 'disabled', 'token']) {
    const f = fixture(t); await f.activate(); await f.pair(); f.control.now = monday;
    const item = (await responseOK(await f.device('pull'))).messages[0], previous = f.token;
    if (mutation === 'booking') { const wk = scheduleSnapshot(f.read().state, '2026-10-05').weekKey; await f.commit({ weekOvr: { [wk]: { s1: [{ day: '수', time: '15:00', absent: false }] } } }); }
    if (mutation === 'inactive') await f.commit({ students: [student('s1', { status: '종료' })] });
    if (mutation === 'phone') await f.commit({ students: [student('s1', { ph: '01000009999' })] });
    if (mutation === 'disabled') await f.api('/sms/settings', { ...(await f.overview()).settings, enabled: false });
    if (mutation === 'token') await f.pair();
    assert.notEqual((await f.device('claim', { id: item.id }, previous)).status, 200, mutation);
  }
});
test('no later-day catchup and pending items expire at KST day end', async t => {
  const f = fixture(t); await f.activate(); await f.pair(); f.control.now = monday;
  const item = (await responseOK(await f.device('pull'))).messages[0];
  f.control.now = at('2026-10-06T00:00:00'); assert.deepEqual((await responseOK(await f.device('pull'))).messages, []);
  assert.equal((await f.overview()).outbox[0].status, 'expired');
  f.control.now = at('2026-10-07T15:00:00'); assert.deepEqual((await responseOK(await f.device('pull'))).messages, []);
  assert.equal((await f.api('/sms/prepare', { stage: 'monday' })).status, 409);
  assert.notEqual((await f.device('claim', { id: item.id })).status, 200);
});
test('atomic future confirmation preserves all customer fields, existing weekly slots and cancellation/makeup metadata; broadcasts after commit', async t => {
  const wk = scheduleSnapshot({ students: [], weekOvr: {} }, '2026-10-05').weekKey;
  const keep = { day: '목', time: '16:30', absent: true, overrideType: 'cancel', makeupOf: 'original', arbitrary: { retain: true } };
  const other = { day: '금', time: '17:00', absent: false, att: '예정', source: 'manual', future: 'slot field' };
  const f = fixture(t, { weekOvr: { [wk]: { s1: [keep, other], untouched: [{ day: '일', time: '19:00' }] } } });
  await f.activate(); await f.pair(false); await responseOK(await f.event()); const card = await pendingCard(f), before = structuredClone(f.read().state);
  const result = await responseOK(await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(card.id)] }));
  assert.equal(result.revision, 1); assert.equal(result.count, 1);
  assert.deepEqual(f.read().state.students, before.students); assert.deepEqual(f.read().state.future, before.future);
  assert.deepEqual(f.read().state.weekOvr[wk].s1.slice(0, 2), [keep, other]); assert.deepEqual(f.read().state.weekOvr[wk].untouched, before.weekOvr[wk].untouched);
  assert.equal(scheduleSnapshot(f.read().state, '2026-10-07').slotsByKey['수_15:00'][0].s.id, 's1');
  assert.equal((await f.overview()).messages[0].status, 'scheduled'); assert.deepEqual(f.control.broadcasts.map(e => e.revision), [1]);
  assert.equal((await f.api('/sms/confirm', { baseRevision: 1, entries: [entry(card.id)] })).status, 409);
});
test('seed override from original linked converted consult engine without losing existing confirmation', async t => {
  const linked = { id: 'c1', name: '정식 이름 s1', converted: true, confirmedDates: [{ date: '2026-10-08', time: '16:30' }], memo: 'retain' };
  const f = fixture(t, { students: [student('s1', { consultData: { id: 'c1', privateField: 'keep' } })], consults: [linked] });
  await f.activate(); await f.pair(false); await f.event(); const card = await pendingCard(f);
  await responseOK(await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(card.id)] }));
  const snapshot = scheduleSnapshot(f.read().state, '2026-10-07'); assert.ok(snapshot.slotsByKey['목_16:30']); assert.ok(snapshot.slotsByKey['수_15:00']);
  assert.deepEqual(f.read().state.consults, [linked]); assert.equal(f.read().state.students[0].consultData.privateField, 'keep');
});
test('future fixed/biweekly/consult conflicts checked by original engine and whole batch rolls back', async t => {
  for (const blocker of ['fixed', 'biweekly', 'consult']) {
    const fixed = student('peer', { ph: '01000002222', schedType: 'fixed', days: ['수'], times: { 수: '15:00' }, st: '2026-11-01', ...(blocker === 'biweekly' ? { intervalWeeks: 2, st: '2026-11-02' } : {}) });
    const f = fixture(t, { students: blocker === 'consult' ? [student()] : [student(), fixed], consults: blocker === 'consult' ? [{ id: 'peer', name: '상담 예약', firstDate: '2026-11-04', firstTime: '15:00' }] : [] });
    await f.activate(); await f.pair(false); await f.event(); await f.event({ text: '다음 일정 카드' });
    const cards = (await f.overview()).messages, before = structuredClone(f.read());
    const response = await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(cards[0].id), entry(cards[1].id, { date: '2026-11-04' })] });
    assert.equal(response.status, 409, blocker);
    assert.deepEqual((await response.json()).conflicts, [{ date: '2026-11-04', time: '15:00', studentId: 's1', otherNames: [blocker === 'consult' ? '상담 예약 (상담)' : '정식 이름 peer'] }]);
    assert.deepEqual(f.read(), before); assert.ok((await f.overview()).messages.every(m => m.status === 'pending')); assert.equal(f.control.broadcasts.length, 0);
  }
});
test('original engine before/after comparison permits unrelated existing conflict and returns new batch counterparts only', async t => {
  const fixed = (id, ph) => student(id, { ph, schedType: 'fixed', days: ['목'], times: { 목: '15:00' } });
  const f = fixture(t, { students: [student(), student('s2', { ph: '01000002222' }), fixed('old1', '01000003333'), fixed('old2', '01000004444')] });
  await f.activate(); await f.pair(false); await f.event(); const first = await pendingCard(f);
  assert.equal(scheduleSnapshot(f.read().state, '2026-10-07').conflicts.length, 1);
  await responseOK(await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(first.id)] }));
  await f.event({ phone: '01000002222' }); const second = await pendingCard(f);
  const response = await f.api('/sms/confirm', { baseRevision: 1, entries: [entry(second.id, { studentId: 's2' })] });
  assert.equal(response.status, 409);
  assert.deepEqual((await response.json()).conflicts, [{ date: '2026-10-07', time: '15:00', studentId: 's2', otherNames: ['정식 이름 s1'] }]);
  assert.equal(f.read().revision, 1);
});
test('legacy peer array time uses the engine canonical slot key and blocks strict-string confirmation atomically', async t => {
  const wk = scheduleSnapshot({ students: [], weekOvr: {} }, '2026-10-05').weekKey;
  const legacy = { day: '수', time: ['15:00'], absent: false, source: 'legacy-sms', arbitrary: { retain: true } };
  const f = fixture(t, { students: [student('peer', { ph: '01000002222' }), student()], weekOvr: { [wk]: { peer: [legacy] } } });
  await f.activate(); await f.pair(false); await f.event(); const card = await pendingCard(f), before = structuredClone(f.read());
  const probe = structuredClone(before.state); probe.weekOvr[wk].s1 = [{ day: '수', time: '15:00', absent: false }];
  const originalEngineConflict = scheduleSnapshot(probe, '2026-10-07').conflicts[0];
  assert.equal(originalEngineConflict.key, '수_15:00'); assert.deepEqual(originalEngineConflict.time, ['15:00']);
  const response = await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(card.id)] });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'sms-schedule-conflict',
    conflicts: [{ date: '2026-10-07', time: '15:00', studentId: 's1', otherNames: ['정식 이름 peer'] }],
    conflict: { date: '2026-10-07', time: '15:00', names: ['정식 이름 peer'] } });
  assert.deepEqual(f.read(), before); assert.equal((await pendingCard(f)).status, 'pending');
  assert.equal(f.state.getKV('sms.confirmation.' + card.id), null); assert.equal(f.control.broadcasts.length, 0);
  const ranked=await responseOK(await f.api('/sms/options',{baseRevision:0,messageId:card.id,studentId:'s1',date:'2026-10-07',startTime:'12:00',endTime:'20:00'}));
  assert.deepEqual(ranked.options,[]);assert.ok(ranked.warnings.length);
  assert.deepEqual(f.read(),before);
  const interval=await f.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id,{time:'15:30'})]});assert.equal(interval.status,409);
  assert.deepEqual((await interval.json()).conflict,{date:'2026-10-07',time:'15:30',names:['정식 이름 peer']});assert.deepEqual(f.read(),before);
  await responseOK(await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(card.id, { time: '17:00' })] }));
  assert.deepEqual(f.read().state.weekOvr[wk].peer, [legacy]);
});
test('same group shared slot allowed; self duplicate/cancelled target and batch collision rejected', async t => {
  const f = fixture(t, { students: [student('s1', { groupId: 'group-1', sharedSlot: true }), student('s2', { ph: '01000002222', groupId: 'group-1', sharedSlot: true })] });
  await f.activate(); await f.pair(false); await f.event(); await f.event({ phone: '01000002222' });
  const cards = (await f.overview()).messages;
  await responseOK(await f.api('/sms/confirm', { baseRevision: 0, entries: cards.map(c => entry(c.id, { studentId: c.studentId })) }));
  assert.equal(scheduleSnapshot(f.read().state, '2026-10-07').conflicts.length, 0);
  await f.event({ text: '중복 일정' }); assert.equal((await f.api('/sms/confirm', { baseRevision: 1, entries: [entry((await pendingCard(f)).id)] })).status, 409);
  const wk = scheduleSnapshot({ students: [], weekOvr: {} }, '2026-10-05').weekKey;
  const g = fixture(t, { weekOvr: { [wk]: { s1: [{ day: '수', time: '15:00', absent: true, overrideType: 'cancel' }] } } });
  await g.activate(); await g.pair(false); await g.event(); assert.equal((await g.api('/sms/confirm', { baseRevision: 0, entries: [entry((await pendingCard(g)).id)] })).status, 409);
  assert.equal(g.read().revision, 0);
});

test('legacy singleton override retains canonical shared-group confirmation without broad array acceptance',async t=>{
  const wk=scheduleSnapshot({students:[],weekOvr:{}},'2026-10-05').weekKey,legacy={day:'수',time:['15:00'],absent:false,source:'legacy',metadata:{retain:true}};
  const f=fixture(t,{students:[student('s1',{groupId:'shared',sharedSlot:true}),student('peer',{ph:'01000002222',groupId:'shared',sharedSlot:true})],weekOvr:{[wk]:{peer:[legacy]}}});
  await f.activate();await f.pair(false);await f.event();const card=await pendingCard(f);
  const options=await responseOK(await f.api('/sms/options',{baseRevision:0,messageId:card.id,studentId:'s1',date:'2026-10-07',startTime:'12:00',endTime:'20:00'}));
  assert.deepEqual(options.options,[]);assert.ok(options.warnings.length);
  assert.equal((await f.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id,{time:['15:00']})]})).status,409);
  await responseOK(await f.api('/sms/confirm',{baseRevision:0,entries:[entry(card.id)]}));
  assert.deepEqual(f.read().state.weekOvr[wk].peer,[legacy]);assert.equal(scheduleSnapshot(f.read().state,'2026-10-07').conflicts.length,0);
});
test('CAS concurrency winner only, dismiss cannot schedule, malformed/past/inactive/ambiguous input fail closed', async t => {
  const f = fixture(t); await f.activate(); await f.pair(false); await f.event(); const card = await pendingCard(f);
  const base = { baseRevision: 0, entries: [entry(card.id)] };
  for (const extra of [{ date: '2026-02-30' }, { date: '2026-10-01' }, { time: '25:00' }, { studentId: 'unknown' }]) assert.equal((await f.api('/sms/confirm', { ...base, entries: [entry(card.id, extra)] })).status, 409);
  assert.equal((await f.api('/sms/confirm', { ...base, entries: [entry(card.id), entry(card.id)] })).status, 409);
  const results = await Promise.all(Array.from({ length: 5 }, () => f.api('/sms/confirm', base)));
  assert.equal(results.filter(r => r.status === 200).length, 1); assert.equal(results.filter(r => r.status === 409).length, 4); assert.equal(f.read().revision, 1);
  await f.event({ text: '취소 요청 문자' }); const pending = await pendingCard(f); await responseOK(await f.api('/sms/dismiss', { messageId: pending.id }));
  assert.equal((await f.api('/sms/confirm', { baseRevision: 1, entries: [entry(pending.id, { date: '2026-10-09' })] })).status, 409); assert.equal(f.read().revision, 1);
});
test('confirmation SQL failure rolls back canonical record and message scheduling without broadcast', async t => {
  const f = fixture(t); await f.activate(); await f.pair(false); await f.event(); const card = await pendingCard(f);
  const before = structuredClone(f.read()); f.control.fail = 'UPDATE sms_messages SET';
  assert.equal((await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(card.id)] })).status, 503);
  assert.deepEqual(f.read(), before); assert.equal((await f.overview()).messages[0].status, 'pending'); assert.equal(f.control.broadcasts.length, 0);
  await responseOK(await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(card.id)] }));
});
test('owner-edited accepted date/time persists separately from original proposal across DO recreation, atomically', async t => {
  const f = fixture(t); await f.activate(); await f.pair(false); await f.event({ text: '이번주 수요일 오후4시 가능합니다' });
  const card = await pendingCard(f); assert.equal(card.proposal.time, '16:00'); assert.equal(card.confirmation, null);
  const accepted = { date: '2026-10-09', time: '17:00', studentId: 's1' }, body = { baseRevision: 0, entries: [entry(card.id, accepted)] };
  f.control.failKey = 'sms.confirmation.' + card.id;
  assert.equal((await f.api('/sms/confirm', body)).status, 503);
  assert.equal(f.read().revision, 0); assert.equal((await pendingCard(f)).confirmation, null); assert.equal(f.control.broadcasts.length, 0);
  assert.equal(f.state.getKV('sms.confirmation.' + card.id), null);
  await responseOK(await f.api('/sms/confirm', body));
  const restarted = new StudioState(f.ctx, f.config);
  const readback = await responseOK(await restarted.fetch(new Request('https://studio.internal/sms/overview', { headers: { 'X-VS-Principal': 'synthetic-owner' } })));
  const confirmed = readback.messages.find(m => m.id === card.id);
  assert.equal(confirmed.status, 'scheduled'); assert.deepEqual(confirmed.confirmation, accepted);
  assert.deepEqual(confirmed.proposal, card.proposal); assert.ok(scheduleSnapshot(f.read().state, accepted.date).slotsByKey['금_17:00']);
  assert.deepEqual(f.control.broadcasts.map(e => e.revision), [1]);
});
test('array/non-string times cannot bypass confirmation identity or corrupt settings', async t => {
  const f = fixture(t); await f.activate(); await f.pair(); await f.event(); await f.event({ text: '별도 문자 카드' });
  const cards = (await f.overview()).messages, before = structuredClone(f.read()), settings = (await f.overview()).settings;
  for (const malformed of [['15:00'], { value: '15:00' }, 1500, true, null]) {
    assert.equal((await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(cards[0].id), entry(cards[1].id, { time: malformed })] })).status, 409);
    assert.deepEqual(f.read(), before);
  }
  assert.equal((await f.api('/sms/confirm', { baseRevision: 0, entries: [entry(cards[0].id), entry(cards[1].id)] })).status, 409);
  for (const field of ['mondayTime', 'tuesdayTime']) {
    for (const malformed of [['10:00'], { value: '10:00' }, 1000, true, null]) {
      assert.equal((await f.api('/sms/settings', { ...settings, [field]: malformed })).status, 400);
      assert.deepEqual(f.state.getKV('sms.settings'), settings);
    }
  }
  assert.ok((await f.overview()).messages.every(m => m.status === 'pending')); assert.equal(f.control.broadcasts.length, 0);
});
test('corrupt persisted settings fail closed for overview, preparation, pull and claim; owner can repair', async t => {
  const f = fixture(t); await f.activate(); await f.pair(); const settings = (await f.overview()).settings;
  f.control.now = monday; const item = (await responseOK(await f.device('pull'))).messages[0];
  for (const malformed of [{ ...settings, enabled: 'false' }, { ...settings, mondayTime: ['10:00'] }, { ...settings, tuesdayTime: ['14:00'] },
    { ...settings, mondayText: [] }, { enabled: true }, [], 'false', { ...settings, extra: 'unsafe' }]) {
    f.state.setKV('sms.settings', malformed);
    for (const result of [await f.api('/sms/overview'), await f.api('/sms/prepare', { stage: 'monday' }), await f.device('pull'), await f.device('claim', { id: item.id })]) {
      assert.equal(result.status, 409); assert.equal((await result.json()).error, 'sms-stored-settings-invalid');
    }
    assert.equal(f.db.prepare('SELECT status FROM sms_outbox WHERE id=?').get(item.id).status, 'pending');
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM sms_outbox').get().n, 1);
  }
  await responseOK(await f.api('/sms/settings', { ...settings, enabled: false }));
  assert.equal((await f.overview()).settings.enabled, false); assert.deepEqual((await responseOK(await f.device('pull'))).messages, []);
});
test('corrupt settings cannot prevent token revocation or rotation; pending work cancels and repaired defaults stay disabled', async t => {
  for (const action of ['revoke', 'pair']) {
    const f = fixture(t); await f.activate(); await f.pair(); f.control.now = monday;
    const pending = (await responseOK(await f.device('pull'))).messages[0], oldToken = f.token, oldDeviceId = f.deviceId;
    f.state.setKV('sms.settings', { ...(await f.overview()).settings, enabled: 'false' });
    assert.equal((await f.device('pull')).status, 409);
    // Ingress is allowed even with reminders disabled; this proves the old bearer is live before recovery.
    await responseOK(await f.event({ id: 'before-recovery', direction: 'sent' }));
    if (action === 'revoke') await responseOK(await f.api('/sms/revoke', {}));
    else { const rotated = await f.pair(false); assert.notEqual(rotated.token, oldToken); assert.notEqual(rotated.deviceId, oldDeviceId); }
    for (const response of [await f.device('pull', undefined, oldToken), await f.device('event', { id: 'after-recovery', phone: '01000001111', text: 'should be refused', direction: 'received', receivedAt: f.control.now }, oldToken),
      await f.device('claim', { id: pending.id }, oldToken), await f.device('ack', { id: pending.id, status: 'sent' }, oldToken)]) assert.equal(response.status, 401);
    const repaired = await f.overview();
    assert.equal(repaired.settings.enabled, false); assert.equal(repaired.settings.mondayTime, '10:00'); assert.equal(repaired.settings.tuesdayTime, '14:00');
    assert.equal(repaired.outbox.find(row => row.id === pending.id).status, 'cancelled');
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM sms_messages').get().n, 1);
    assert.ok(!JSON.stringify(f.db.prepare('SELECT * FROM kv').all()).includes(oldToken));
    if (action === 'revoke') { assert.equal(repaired.device.paired, false); assert.equal(f.state.getKV('sms.device'), null); }
    else { assert.equal(repaired.device.paired, true); assert.deepEqual((await responseOK(await f.device('pull'))).messages, []); }
  }
});
test('unique canonical alias requires explicit owner click, strict stale/ambiguous check and preserves linked customer metadata', async t => {
  const original = { id: 'c1', phone: '+82 10 0000 1111', name: '별명', converted: true, confirmedDates: [{ date: '2026-10-08', time: '16:00' }], future: { keep: true } };
  const f = fixture(t, { consults: [original] }); await f.activate(); await f.pair(false); await f.event({ text: '제 진짜 이름은 다른 이름입니다' });
  const alias = (await f.overview()).aliasChanges[0]; assert.equal(alias.newName, student().name); assert.deepEqual(f.read().state.consults, [original]);
  await responseOK(await f.api('/sms/alias', { aliasId: alias.id }));
  assert.deepEqual(f.read().state.consults, [{ ...original, name: student().name }]); assert.equal(f.read().state.students[0].name, student().name); assert.equal(f.read().revision, 1);
  assert.equal((await f.api('/sms/alias', { aliasId: alias.id })).status, 409);
  const g = fixture(t, { consults: [original] }); await g.activate(); const stale = (await g.overview()).aliasChanges[0];
  await g.commit({ students: [student(), student('other', { ph: '01000001111' })] });
  assert.equal((await g.overview()).aliasChanges.length, 0); assert.equal((await g.api('/sms/alias', { aliasId: stale.id })).status, 409); assert.equal(g.read().state.consults[0].name, '별명');
});
