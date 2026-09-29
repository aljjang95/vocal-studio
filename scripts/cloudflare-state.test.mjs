import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { StudioState } from '../worker/state.mjs';
import worker from '../worker/index.mjs';
function fixture(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  let tail = Promise.resolve();
  const control = { failReceipt: false };
  const ctx = { storage: {
    sql: { exec(query, ...params) {
      if (/^(BEGIN|COMMIT|ROLLBACK)/i.test(query)) throw Error('raw transactions unsupported');
      if (control.failReceipt && query.startsWith('INSERT INTO requests')) {
        control.failReceipt = false; throw Error('injected-receipt-failure');
      }
      const rows = db.prepare(query).all(...params); return { toArray: () => rows };
    } },
    transactionSync(fn) {
      db.exec('BEGIN');
      try { const result = fn(); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  }, blockConcurrencyWhile(fn) {
    const result = tail.then(fn); tail = result.catch(() => {}); return result;
  } };
  const state = new StudioState(ctx);
  const api = (path, body, principal = 'qa-A') => state.fetch(new Request('https://state.test' + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'X-VS-Principal': principal },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
  return { api, control, async activate() {
    assert.equal((await api('/import', { state: { students: [], future: { keep: true } } })).status, 201);
    const exported = await (await api('/export')).json();
    assert.equal((await api('/activate', { hash: exported.hash })).status, 200);
  } };
}
test('concurrent imports never overwrite the first staged dataset', async t => {
  const { api } = fixture(t);
  const responses = await Promise.all(['A','B'].map(name => api('/import', { state: { name } })));
  assert.deepEqual(responses.map(r => r.status).sort(), [201,409]);
});
test('concurrent CAS has exactly one winner and retains unknown root data', async t => {
  const f = fixture(t); await f.activate();
  const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => f.api('/commit', {
    baseRevision: 0, requestId: 'concurrent-' + i, state: { students: [{ id: String(i) }] },
  })));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 9);
  const result = await (await f.api('/state')).json();
  assert.equal(result.revision, 1); assert.equal(result.state.future.keep, true);
});
test('concurrent identical retries write once and replay the exact receipt', async t => {
  const f = fixture(t); await f.activate();
  const body = { baseRevision: 0, requestId: 'same-request-0001', state: { students: [] } };
  const responses = await Promise.all(Array.from({ length: 8 }, () => f.api('/commit', body)));
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(responses.filter(r => r.headers.get('X-VS-Idempotent-Replay')).length, 7);
  assert.equal(new Set(await Promise.all(responses.map(r => r.text()))).size, 1);
  assert.equal((await (await f.api('/state')).json()).revision, 1);
});
test('receipt storage failure rolls back customer state and allows safe retry', async t => {
  const f = fixture(t); await f.activate(); f.control.failReceipt = true;
  const body = { baseRevision: 0, requestId: 'rollback-request-0001', state: { students: [{ id: 'new' }] } };
  const failed = await f.api('/commit', body); assert.equal(failed.status, 400);
  const unchanged = await (await f.api('/state')).json();
  assert.equal(unchanged.revision, 0); assert.deepEqual(unchanged.state.students, []);
  assert.equal((await f.api('/commit', body)).status, 200);
});
test('staged customer state requires a readback by the activating principal', async t => {
  const { api } = fixture(t);
  await api('/import', { state: { students: [] } });
  assert.equal((await api('/activate', {})).status, 409);
  const exported = await (await api('/export')).json();
  assert.equal((await api('/activate', { hash: exported.hash }, 'qa-B')).status, 409);
  assert.equal((await api('/activate', { hash: 'wrong' })).status, 409);
  assert.equal((await api('/activate', { hash: exported.hash })).status, 200);
});
test('malformed asynchronous request bodies return structured errors', async t => {
  const f = fixture(t); await f.activate();
  const r = await f.api('/commit', { baseRevision: -1, requestId: 'bad-request-0001', state: {} });
  assert.equal(r.status, 400); assert.equal((await r.json()).error, 'invalid-base-revision');
});
test('simultaneous distinct R2 uploads cannot overwrite one immutable pointer', async () => {
  const objects = new Map(); let waiting = []; let initial = 0;
  const env = { ENVIRONMENT: 'local-test', MEDIA: {
    async head(key) {
      if (initial++ < 2) { await new Promise(resolve => { waiting.push(resolve); if (waiting.length === 2) waiting.forEach(fn => fn()); }); return null; }
      return objects.get(key) || null;
    },
    async put(key, bytes, options) {
      if (options.onlyIf?.get('If-None-Match') === '*' && objects.has(key)) return null;
      const value = { size: bytes.byteLength, customMetadata: options.customMetadata, bytes: new Uint8Array(bytes) };
      objects.set(key, value); return value;
    },
  } };
  const upload = value => worker.fetch(new Request('http://127.0.0.1:8798/api/media/qa-race.bin', {
    method: 'PUT', headers: { Origin: 'http://127.0.0.1:8798', 'X-VS-Protocol': 'vs-cf-1', 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array([value]),
  }), env);
  const results = await Promise.all([upload(1), upload(2)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201,409]);
  assert.equal(objects.get('qa-race.bin').bytes[0], results[0].status === 201 ? 1 : 2);
});
test('local-only test identity cannot authorize a public hostname', async () => {
  const response = await worker.fetch(new Request('https://studio.example/api/session', {
    headers: { 'X-VS-Protocol': 'vs-cf-1' },
  }), { ENVIRONMENT: 'local-test' });
  assert.equal(response.status, 401);
});
test('production rejects unauthenticated and forged sessions before state or assets', async () => {
  for (const headers of [{}, { 'Cf-Access-Jwt-Assertion': 'not-a-jwt' }]) {
    const response = await worker.fetch(new Request('https://studio.example/api/state', { headers }), {
      ENVIRONMENT: 'production', ACCESS_TEAM_DOMAIN: 'local.invalid', ACCESS_AUD: 'qa',
      get STUDIO() { throw Error('unauthenticated state access'); },
      get ASSETS() { throw Error('unauthenticated asset access'); },
    });
    assert.equal(response.status, 401);
  }
});
test('customer responses explicitly prohibit cache reuse', async t => {
  const f = fixture(t); await f.activate();
  for (const path of ['/state', '/export']) {
    assert.match((await f.api(path)).headers.get('cache-control'), /no-store/);
  }
});
