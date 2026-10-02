// Synthetic, isolated Workerd RPC + SQLite integration. No deployed URL or customer SMS.
// Uses esbuild/miniflare already shipped by the pinned Wrangler dependency.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scheduleSnapshot } from '../worker/schedule-core.generated.mjs';

const root = path.resolve(import.meta.dirname, '..'), at = value => Date.parse(value + '+09:00');
const start = at('2026-10-05T08:00:00'), monday = at('2026-10-05T10:00:00'), tuesday = at('2026-10-06T14:00:00');
const persist = mkdtempSync(path.join(tmpdir(), 'vs-sms-bridge-'));
const bundled = async options => (await build({ bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', write: false,
  external: ['cloudflare:workers'], ...options })).outputFiles[0].text;
const studio = await bundled({ stdin: { resolveDir: root, sourcefile: 'synthetic-sms-runtime.mjs', contents: `
import server, {StudioState as CanonicalState,SmsRelay,BookingIntake} from './worker/entry.mjs';
export {SmsRelay,BookingIntake};
export class StudioState extends CanonicalState {
  async fetch(r){if(new URL(r.url).pathname==='/__synthetic_settings')return this.ctx.blockConcurrencyWhile(async()=>{this.setKV('sms.settings',await r.json());return Response.json({ok:true});});return super.fetch(r);}
}
let now=${start}; Date.now=()=>now;
export default {async fetch(r,env){if(new URL(r.url).pathname==='/__synthetic_clock'){now=Number(await r.text());return Response.json({ok:true});}return server.fetch(r,env);}};
` } });
const relay = await bundled({ entryPoints: [path.join(root, 'worker/sms-relay.mjs')] });
const options = { ...convertV4MiniflareOptions({ cf: false, workers: [
  { name: 'relay', modules: true, script: relay, compatibilityDate: '2026-09-14', serviceBindings: { SMS_STUDIO: { name: 'studio', entrypoint: 'SmsRelay' } } },
  { name: 'studio', modules: true, script: studio, compatibilityDate: '2026-09-14', durableObjects: { STUDIO: { className: 'StudioState', useSQLite: true } },
    bindings: { ENVIRONMENT: 'local-test', STUDIO_NAMESPACE: 'synthetic-sms-only', SMS_RELAY_ORIGIN: 'http://127.0.0.1:8837',
      BOOKING_NOTIFICATIONS_ENABLED: 'false' },
    serviceBindings: { ASSETS: async () => new Response('synthetic asset') },
    outboundService: () => { throw Error('external network forbidden in synthetic SMS checks'); },
  },
] }), resourcePersistencePath: persist, unsafeDevRegistryPath: path.join(persist, 'registry') };
let mf = new Miniflare(options), token = '', clock = start;
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const owner = async (route, body, headers = {}) => (await mf.getWorker('studio')).fetch('http://localhost' + route, {
  method: body === undefined ? 'GET' : 'POST', headers: { 'X-VS-Protocol': 'vs-cf-1', Origin: 'http://localhost', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const device = async (route, body, bearer = token) => mf.dispatchFetch('https://relay.invalid/device/' + route, {
  method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + bearer }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const clockTo = async value => { clock = value; const r = await (await mf.getWorker('studio')).fetch('http://localhost/__synthetic_clock', { method: 'POST', body: String(value) }); assert.equal(r.status, 200); };
const ok = async response => { assert.equal(response.status, 200, 'unexpected synthetic status ' + response.status); return response.json(); };
const event = (id, phone, text, direction = 'received') => device('event', { id, phone, text, direction, receivedAt: clock });
try {
  await mf.ready;
  const state = { students: [
    { id: 'peer', name: '합성 고정', ph: '01000003333', status: '수강중', schedType: 'fixed', days: ['수'], times: { 수: '15:00' }, st: '2026-11-01' },
    { id: 's1', name: '합성 학생1', ph: '01000001111', status: '수강중', schedType: 'flex' },
    { id: 's2', name: '합성 학생2', ph: '01000002222', status: '수강중', schedType: 'flex' },
  ], consults: [{ id: 'c1', name: '합성 별명', phone: '01000001111', hold: true, future: { retain: true } }], inquiries: [], weekOvr: {}, future: { keep: true } };
  const futureWeek = scheduleSnapshot(state, '2026-11-04').weekKey;
  state.weekOvr[futureWeek] = { peer: [{ day: '수', time: ['15:00'], absent: false, source: 'synthetic-legacy', retain: true }] };
  const ns = await mf.getDurableObjectNamespace('STUDIO', 'studio'), stub = ns.get(ns.idFromName('synthetic-sms-only'));
  const direct = (route, body) => stub.fetch('https://state.internal' + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-VS-Principal': 'synthetic-owner' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  check('isolated stage', (await direct('/import', { state })).status === 201);
  const exported = await (await direct('/export')).json(); check('isolated activation', (await direct('/activate', { hash: exported.hash })).status === 200);
  const initial = await ok(await owner('/api/sms/overview')); check('first setup origin and disabled default', initial.device.relayOrigin === 'http://127.0.0.1:8837' && !initial.settings.enabled);
  check('no unauthorized relay phone data', (await device('pull', undefined, 'bad')).status === 401);
  check('public relay has no owner routes', (await mf.dispatchFetch('https://relay.invalid/api/sms/overview')).status === 404);
  const paired = await ok(await owner('/api/sms/pair', { relayOrigin: initial.device.relayOrigin })); token = paired.token;
  check('real named service RPC pull', (await ok(await device('pull'))).allowedPhoneHashes.length === 3);
  await ok(await owner('/api/sms/settings', { ...initial.settings, enabled: true }));
  await clockTo(monday);
  const pulls = await Promise.all(Array.from({ length: 5 }, () => device('pull').then(ok)));
  check('durable automatic due preparation idempotent', pulls.every(p => p.messages.length === 2) && (await ok(await owner('/api/sms/overview'))).outbox.length === 2);
  const first = pulls[0].messages.find(m => m.phone === '01000001111'), second = pulls[0].messages.find(m => m.phone === '01000002222');
  await ok(await event('owner-sent-request', second.phone, second.text, 'sent'));
  const claims = await Promise.all(Array.from({ length: 5 }, () => device('claim', { id: first.id })));
  check('real Workerd one-time concurrent claim', claims.filter(r => r.status === 200).length === 1 && claims.filter(r => r.status === 409).length === 4);
  await ok(await device('ack', { id: first.id, status: 'unknown' })); await ok(await device('ack', { id: first.id, status: 'unknown' }));
  const events = await Promise.all(Array.from({ length: 5 }, () => event('student-reply-1', first.phone, '이번 주 수요일 오후3시 가능합니다').then(ok)));
  check('real Workerd duplicate ingress one card', events.filter(e => !e.duplicate).length === 1);
  check('changed event payload fails', (await event('student-reply-1', first.phone, 'changed')).status === 409);
  const pre = await ok(await owner('/api/sms/overview'));
  const card = pre.messages.find(m => m.direction === 'received'); check('canonical name and owner alias proposal', card.name === '합성 학생1' && pre.aliasChanges.length === 1);
  const conflict = await owner('/api/sms/confirm', { baseRevision: pre.revision, entries: [{ messageId: card.id, studentId: 's1', date: '2026-11-04', time: '15:00' }] });
  const conflictBody = await conflict.json();
  check('future legacy-array original-engine conflict blocked with canonical details', conflict.status === 409 && conflictBody.conflict.date === '2026-11-04' && conflictBody.conflict.time === '15:00' && conflictBody.conflict.names[0] === '합성 고정' && (await ok(await owner('/api/state'))).revision === 0);
  const confirmations = await Promise.all(Array.from({ length: 4 }, () => owner('/api/sms/confirm', { baseRevision: 0, entries: [{ messageId: card.id, studentId: 's1', date: '2026-10-07', time: '15:00' }] })));
  check('real Workerd atomic CAS winner', confirmations.filter(r => r.status === 200).length === 1 && confirmations.filter(r => r.status === 409).length === 3);
  const saved = await ok(await owner('/api/state'));
  check('canonical original-engine result and fields preserved', saved.revision === 1 && saved.state.future.keep && scheduleSnapshot(saved.state, '2026-10-07').slotsByKey['수_15:00'][0].s.id === 's1');
  await ok(await owner('/api/sms/alias', { aliasId: pre.aliasChanges[0].id }));
  check('explicit owner alias commit', (await ok(await owner('/api/state'))).state.consults[0].name === '합성 학생1');
  await clockTo(tuesday);
  const tue = await ok(await device('pull')); check('Tuesday suppresses student reply/booking and ignores owner sent', tue.messages.length === 1 && tue.messages[0].phone === second.phone);
  await ok(await event('student-reply-2', second.phone, '아직 시간을 정하지 못했습니다'));
  check('Tuesday claim rechecks newly arrived student reply', (await device('claim', { id: tue.messages[0].id })).status === 409);
  await mf.dispose(); mf = new Miniflare(options); await mf.ready; await clockTo(tuesday);
  const afterRestart = await ok(await owner('/api/sms/overview'));
  check('SQLite runtime restart keeps revision and uncertain ACK', afterRestart.revision === 2 && afterRestart.outbox.find(o => o.id === first.id).status === 'unknown');
  check('SQLite runtime restart retains exact accepted confirmation separate from proposal', JSON.stringify(afterRestart.messages.find(m => m.id === card.id).confirmation) === JSON.stringify({ date: '2026-10-07', time: '15:00', studentId: 's1' }));
  check('restart never replays claimed/ACKed or suppressed reminders', (await ok(await device('pull'))).messages.length === 0);
  const corruptPreferences = async body => {
    const current = await mf.getDurableObjectNamespace('STUDIO', 'studio'), currentStub = current.get(current.idFromName('synthetic-sms-only'));
    await ok(await currentStub.fetch('https://state.internal/__synthetic_settings', { method: 'POST', body: JSON.stringify(body) }));
  };
  await corruptPreferences({ ...afterRestart.settings, enabled: 'false' });
  check('corrupt preferences fail closed through real RPC', (await device('pull')).status === 409);
  const oldToken = token, rotated = await ok(await owner('/api/sms/pair', { relayOrigin: afterRestart.device.relayOrigin })); token = rotated.token;
  check('rotation with corrupt preferences revokes old bearer', token !== oldToken && (await device('pull', undefined, oldToken)).status === 401);
  check('rotated pairing stays disabled with valid defaults', !(await ok(await owner('/api/sms/overview'))).settings.enabled && (await ok(await device('pull'))).messages.length === 0);
  await corruptPreferences({ ...afterRestart.settings, mondayTime: ['10:00'] });
  await ok(await owner('/api/sms/revoke', {})); check('revoke succeeds despite corrupt preferences', !(await ok(await owner('/api/sms/overview'))).device.paired);
  check('revoked bearer blocked through real RPC', (await device('pull')).status === 401 && (await event('after-revocation', first.phone, 'synthetic refused event')).status === 401);
  console.log(JSON.stringify({ ok: true, runtime: 'isolated Workerd + SQLite + named service RPC', checks, persistence: persist, externalNetwork: false, physicalPhone: false }, null, 2));
} finally { await mf.dispose(); }
