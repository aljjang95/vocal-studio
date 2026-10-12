import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';
import { handleBackups } from '../worker/backups.mjs';
import { principalId } from '../worker/auth.mjs';

const ORIGIN = 'http://127.0.0.1:8798';
const MAX = 16 * 1024 * 1024;
const A = { sub: 'qa-local-principal', email: 'qa@local.invalid' };
const B = { sub: 'qa-other-principal', email: 'other@local.invalid' };
const encoder = new TextEncoder();
async function digest(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}
const prefix = principal => 'vsC_sync_v1:' + encodeURIComponent('vocal-studio:' + principalId(principal)) + ':backup:';
const key = (instance = 'tab-1', principal = A) => prefix(principal) + instance;
const state = () => ({ students: [], logs: [], consults: [], payments: [], inquiries: [], weekOvr: {} });
function journal(principal = A, extra = {}) {
  return JSON.stringify({ version: 1, namespace: 'vocal-studio', owner: principalId(principal), revision: 3,
    base: state(), local: state(), recovery: [], ...extra });
}
function request(method, body, query = '', headers = {}, urlOrigin = ORIGIN) {
  return new Request(urlOrigin + '/api/backups' + query, {
    method, headers: { Origin: ORIGIN, 'X-VS-Protocol': 'vs-cf-1', 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) }),
  });
}
function fakeR2(pageSize = 1000) {
  const objects = new Map(), calls = []; let version = 0;
  const f = { objects, calls, hidden: new Set(), failPut: false,
    async get(location) {
      calls.push(['get', location]);
      if (f.hidden.has(location)) return null;
      const value = objects.get(location); if (!value) return null;
      const bytes = value.bytes.slice();
      return { key: location, size: bytes.byteLength, etag: value.etag, httpEtag: '"' + value.etag + '"',
        customMetadata: value.customMetadata, body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) };
    },
    async head(location) {
      calls.push(['head', location]);
      if (f.hidden.has(location)) return null;
      const value = objects.get(location); if (!value) return null;
      return { key: location, size: value.bytes.byteLength, etag: value.etag, httpEtag: '"' + value.etag + '"', customMetadata: value.customMetadata };
    },
    async put(location, input, options = {}) {
      calls.push(['put', location, options]); if (f.failPut) throw Error('private-provider-detail');
      const current = objects.get(location), condition = options.onlyIf;
      if (condition?.get('If-None-Match') === '*' && current) return null;
      if (condition?.has('If-Match') && condition.get('If-Match') !== (current && '"' + current.etag + '"')) return null;
      const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input).slice();
      const value = { bytes, etag: String(++version), customMetadata: options.customMetadata || {} };
      objects.set(location, value); return { key: location, size: bytes.byteLength, etag: value.etag };
    },
    async list(options) {
      calls.push(['list', options]);
      const matches = [...objects.keys()].filter(location => location.startsWith(options.prefix)).sort();
      const offset = options.cursor ? Number(options.cursor) : 0;
      const page = matches.slice(offset, offset + Math.min(options.limit, pageSize));
      const truncated = offset + page.length < matches.length;
      return { objects: page.map(location => ({ key: location })), truncated,
        ...(truncated ? { cursor: String(offset + page.length) } : {}) };
    },
  };
  return f;
}
function fixture(pageSize) {
  const bucket = fakeR2(pageSize), env = { ENVIRONMENT: 'local-test', MEDIA: bucket };
  return { bucket, env,
    post: (text = journal(), instance = 'tab-1') => worker.fetch(request('POST', { key: key(instance), text }), env),
    list: () => worker.fetch(request('GET', undefined, '?prefix=' + encodeURIComponent(prefix(A))), env),
    listMetadata: query => worker.fetch(request('GET', undefined, query), env),
    listKey: requested => worker.fetch(request('GET', undefined, '?prefix=' + encodeURIComponent(prefix(A)) + '&key=' + encodeURIComponent(requested)), env),
  };
}
function storedText(value) { return new TextDecoder().decode(value.bytes); }
function pointerEntries(bucket) { return [...bucket.objects].filter(([location]) => location.includes('/latest/')); }
function contentEntries(bucket) { return [...bucket.objects].filter(([location]) => location.includes('/history/')); }
async function error(response, status, code) {
  assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: code });
}

test('POST/GET preserve exact journal bytes, Unicode, whitespace, ACK and unknown metadata', async () => {
  const f = fixture();
  const text = ' \n' + journal(A, { recovery: [state()], ack: { future: ['보컬 🎵', { '__proto__': null }] },
    unknownMetadata: { revision: 'not-normalized', nesting: { keep: true } } }) + '\n';
  const response = await f.post(text); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { key: key(), text });
  assert.deepEqual(await (await f.list()).json(), { rows: [{ key: key(), text }] });
  assert.equal(pointerEntries(f.bucket).length, 1); assert.equal(contentEntries(f.bucket).length, 1);
  assert.equal(storedText(contentEntries(f.bucket)[0][1]), text);
  assert.ok([...f.bucket.objects.keys()].every(location => /^_vs_backups\/v1\/[a-f0-9]{64}\//.test(location)));
  assert.ok(f.bucket.calls.filter(([op, location]) => op === 'put' && location.includes('/history/'))
    .every(([, , options]) => options.onlyIf.get('If-None-Match') === '*'));
});

test('exact replay is idempotent and later content retains every immutable historical snapshot', async () => {
  const f = fixture(), first = journal();
  assert.equal((await f.post(first)).status, 200);
  const oldHistory = contentEntries(f.bucket)[0], oldPointerVersion = pointerEntries(f.bucket)[0][1].etag;
  assert.equal((await f.post(first)).status, 200); assert.equal(f.bucket.objects.size, 2);
  assert.equal(pointerEntries(f.bucket)[0][1].etag, oldPointerVersion);
  const second = journal(A, { revision: 4, recovery: [state()], future: 'preserve' });
  assert.deepEqual(await (await f.post(second)).json(), { key: key(), text: second });
  assert.equal(contentEntries(f.bucket).length, 2);
  assert.equal(f.bucket.objects.get(oldHistory[0]), oldHistory[1]);
  assert.deepEqual(await (await f.list()).json(), { rows: [{ key: key(), text: second }] });
});

test('separate principals have disjoint R2 partitions and listing never reads another owner', async () => {
  const f = fixture(), otherText = journal(B);
  assert.equal((await handleBackups(request('POST', { key: key('tab-1', B), text: otherText }), f.env, B)).status, 200);
  const otherObjects = new Set(f.bucket.objects.keys()); assert.equal((await f.post()).status, 200);
  f.bucket.calls.length = 0;
  assert.deepEqual(await (await f.list()).json(), { rows: [{ key: key(), text: journal() }] });
  assert.ok(f.bucket.calls.filter(([op]) => op === 'get').every(([, location]) => !otherObjects.has(location)));
  await error(await f.post(otherText), 400, 'invalid-backup-journal');
  await error(await worker.fetch(request('POST', { key: key('tab-1', B), text: journal() }), f.env), 400, 'invalid-backup-key');
});

test('GET prefix must exactly match authenticated owner, with no broad or duplicate prefix', async () => {
  const f = fixture();
  for (const value of ['', 'vsC_sync_v1:', prefix(B), prefix(A) + 'tab-1', prefix(A).slice(0, -1)]) {
    await error(await worker.fetch(request('GET', undefined, '?prefix=' + encodeURIComponent(value)), f.env), 400, 'invalid-backup-prefix');
  }
  for (const query of ['', '?prefix=' + encodeURIComponent(prefix(A)) + '&prefix=' + encodeURIComponent(prefix(A))]) {
    await error(await worker.fetch(request('GET', undefined, query), f.env), 400, 'invalid-backup-prefix');
  }
  assert.equal(f.bucket.calls.length, 0);
});

test('instance suffix is bounded and excludes paths, encoded paths, punctuation and other owner scopes', async () => {
  const f = fixture();
  for (const instance of ['', 'a'.repeat(129), '../x', 'x/y', 'x\\y', '%2F', 'tab:other', '한글', 'tab.1']) {
    await error(await f.post(journal(), instance), 400, 'invalid-backup-key');
  }
  assert.equal(f.bucket.calls.length, 0);
  assert.equal((await f.post(journal(), 'a'.repeat(128))).status, 200);
});

test('journal known fields are validated without accepting foreign ownership or invalid normal shapes', async () => {
  const f = fixture();
  for (const change of [{ version: 2 }, { owner: principalId(B) }, { namespace: 'other' }, { revision: -1 },
    { revision: '3' }, { revision: 0.5 }, { revision: Number.MAX_SAFE_INTEGER + 1 }, { base: [] }, { local: null },
    { base: { ...state(), students: {} } }, { local: { ...state(), logs: null } },
    { base: { ...state(), weekOvr: [] } }, { base: { ...state(), weekOvr: { week: [] } } }, { recovery: {} }]) {
    await error(await f.post(journal(A, change)), 400, 'invalid-backup-journal');
  }
  for (const text of ['{', 'null', '[]', '{}', undefined]) {
    await error(await f.post(text === undefined ? null : text), 400, text === undefined ? 'invalid-backup-text' : 'invalid-backup-journal');
  }
  assert.equal(f.bucket.calls.length, 0);
});

test('existing Access, protocol and origin checks precede storage, and only GET/POST are allowed', async () => {
  const f = fixture(), query = '?prefix=' + encodeURIComponent(prefix(A));
  for (const method of ['GET', 'POST']) {
    const body = method === 'POST' ? { key: key(), text: journal() } : undefined;
    await error(await worker.fetch(request(method, body, query, { 'X-VS-Protocol': '' }), f.env), 400, 'protocol-required');
    await error(await worker.fetch(request(method, body, query, { Origin: 'https://foreign.test' }), f.env), 403, 'origin-required');
    await error(await worker.fetch(request(method, body, query, {}, 'https://hlb.tllhouse.com'), f.env), 401, 'access-required');
  }
  const noOriginPost = request('POST', { key: key(), text: journal() }); noOriginPost.headers.delete('Origin');
  await error(await worker.fetch(noOriginPost, f.env), 403, 'origin-required');
  for (const method of ['PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
    await error(await worker.fetch(request(method), f.env), 405, 'method-not-allowed');
  }
  assert.equal(f.bucket.calls.length, 0);
  // Same-origin browser GETs normally omit Origin; the custom protocol header is still mandatory.
  const get = request('GET', undefined, query); get.headers.delete('Origin');
  assert.deepEqual(await (await worker.fetch(get, f.env)).json(), { rows: [] });
});

test('media routes cannot read, HEAD or overwrite internal backup objects', async () => {
  const f = fixture(); await f.post(); f.bucket.calls.length = 0;
  for (const location of f.bucket.objects.keys()) {
    for (const method of ['GET', 'HEAD', 'PUT']) {
      const response = await worker.fetch(new Request(ORIGIN + '/api/media/' + encodeURIComponent(location), {
        method, headers: { Origin: ORIGIN, 'X-VS-Protocol': 'vs-cf-1' }, ...(method === 'PUT' ? { body: 'bad' } : {}),
      }), f.env);
      await error(response, 400, 'invalid-media-pointer');
    }
  }
  assert.equal(f.bucket.calls.length, 0);
});

test('cloud adapter asset is allowlisted behind authentication', async () => {
  const f = fixture(); f.env.ASSETS = { async fetch(req) { assert.equal(new URL(req.url).pathname, '/vs-cloud-backup.js'); return new Response('adapter'); } };
  const response = await worker.fetch(new Request(ORIGIN + '/vs-cloud-backup.js'), f.env);
  assert.equal(response.status, 200); assert.equal(await response.text(), 'adapter');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  await error(await worker.fetch(new Request('https://hlb.tllhouse.com/vs-cloud-backup.js'), f.env), 401, 'access-required');
});

test('declared length is bounded, integer and checked against actual UTF-8 byte length', async () => {
  const f = fixture(), body = JSON.stringify({ key: key(), text: journal(A, { future: '한글 🎵' }) });
  for (const length of ['-1', '1.5', 'wat', '0', String(MAX + 1), '9007199254740992']) {
    await error(await worker.fetch(request('POST', body, '', { 'Content-Length': length }), f.env), 413, 'backup-body-too-large');
  }
  await error(await worker.fetch(request('POST', body, '', { 'Content-Length': String(body.length) }), f.env), 400, 'backup-body-length-mismatch');
  assert.equal(f.bucket.calls.length, 0);
  assert.equal((await worker.fetch(request('POST', body, '', { 'Content-Length': String(encoder.encode(body).length) }), f.env)).status, 200);
});

test('actual stream limit applies even without length or with lying length, cancels before writes', async () => {
  for (const declared of [undefined, '10']) {
    const f = fixture(); let cancelled = false, pulls = 0;
    const stream = new ReadableStream({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
    const req = new Request(ORIGIN + '/api/backups', { method: 'POST', duplex: 'half', body: stream,
      headers: { Origin: ORIGIN, 'X-VS-Protocol': 'vs-cf-1', ...(declared ? { 'Content-Length': declared } : {}) } });
    await error(await worker.fetch(req, f.env), 413, 'backup-body-too-large');
    assert.equal(cancelled, true); assert.equal(pulls, 17); assert.equal(f.bucket.calls.length, 0);
  }
});

test('16 MiB exact request boundary is accepted; invalid UTF-8 and malformed JSON fail before writes', async () => {
  const f = fixture();
  const data = { key: key(), text: journal(), padding: '' }, overhead = encoder.encode(JSON.stringify(data)).length;
  data.padding = 'x'.repeat(MAX - overhead);
  assert.equal(encoder.encode(JSON.stringify(data)).length, MAX);
  assert.equal((await worker.fetch(request('POST', data, '', { 'Content-Length': String(MAX) }), f.env)).status, 200);
  for (const body of ['[]', '{', new Uint8Array([0xff])]) {
    await error(await worker.fetch(request('POST', body), f.env), 400, body === '[]' ? 'invalid-backup-body' : 'invalid-backup-json');
  }
});

test('GET iterates every page and excludes historical bodies from result rows', async () => {
  const f = fixture(1);
  for (const instance of ['tab-3', 'tab-1', 'tab-2']) assert.equal((await f.post(journal(), instance)).status, 200);
  await f.post(journal(A, { revision: 4 }), 'tab-1'); f.bucket.calls.length = 0;
  assert.deepEqual(await (await f.list()).json(), { rows: [
    { key: key('tab-1'), text: journal(A, { revision: 4 }) }, { key: key('tab-2'), text: journal() }, { key: key('tab-3'), text: journal() },
  ] });
  assert.equal(f.bucket.calls.filter(([op]) => op === 'list').length, 3);
  assert.ok(f.bucket.calls.filter(([op]) => op === 'list').every(([, options]) => options.prefix.includes('/latest/')));
});

test('missing pointer or content fails closed with no partial GET rows and no implicit repair', async () => {
  for (const missing of ['pointer', 'content']) {
    const f = fixture(); await f.post(); await f.post(journal(), 'tab-2');
    const pointerEntry = pointerEntries(f.bucket)[0], pointer = JSON.parse(storedText(pointerEntry[1]));
    f.bucket.hidden.add(missing === 'pointer' ? pointerEntry[0] : pointer.contentKey);
    f.bucket.calls.length = 0; await error(await f.list(), 503, 'backup-storage-missing');
    assert.ok(f.bucket.calls.every(([op]) => op !== 'put')); assert.equal(f.bucket.objects.size, 4);
  }
});

test('corrupt content, pointer owner/key/hash/path/JSON and journal shape fail closed', async () => {
  for (const fault of ['content', 'owner', 'key', 'hash', 'path', 'json', 'shape']) {
    const f = fixture(); await f.post();
    const [location, stored] = pointerEntries(f.bucket)[0], pointer = JSON.parse(storedText(stored));
    if (fault === 'content') f.bucket.objects.get(pointer.contentKey).bytes = encoder.encode(journal(A, { revision: 9 }));
    else {
      if (fault === 'owner') pointer.owner = principalId(B);
      if (fault === 'key') pointer.key = key('foreign');
      if (fault === 'hash') pointer.sha256 = 'a'.repeat(64);
      if (fault === 'path') pointer.contentKey = '_vs_backups/v1/foreign/history/secret';
      if (fault === 'shape') pointer.version = 2;
      stored.bytes = encoder.encode(fault === 'json' ? '{' : JSON.stringify(pointer));
    }
    const snapshot = [...f.bucket.objects].map(([name, item]) => [name, storedText(item)]);
    f.bucket.calls.length = 0;
    await error(await f.list(), 503, 'backup-storage-corrupt');
    if (fault === 'content') {
      // POST validates the existing pointer through R2 HEAD metadata; the new body is
      // read back once and can replace the stale pointer while GET still fails closed.
      assert.equal((await f.post(journal(A, { revision: 4 }))).status, 200);
      assert.notDeepEqual([...f.bucket.objects].map(([name, item]) => [name, storedText(item)]), snapshot);
    } else {
      await error(await f.post(journal(A, { revision: 4 })), 503, 'backup-storage-corrupt');
      assert.ok(f.bucket.calls.every(([op]) => op !== 'put'));
      assert.deepEqual([...f.bucket.objects].map(([name, item]) => [name, storedText(item)]), snapshot);
    }
    if (fault === 'path') assert.ok(f.bucket.calls.every(([op, name]) => op !== 'get' || name !== pointer.contentKey));
    assert.ok(f.bucket.objects.has(location));
  }
});

test('immutable put success is insufficient without exact content and pointer readback', async () => {
  for (const fault of ['content-missing', 'content-corrupt', 'pointer-missing', 'pointer-changed']) {
    const f = fixture(), originalPut = f.bucket.put;
    f.bucket.put = async (location, input, options) => {
      const result = await originalPut(location, input, options);
      if (location.includes('/history/') && fault === 'content-missing') f.bucket.hidden.add(location);
      if (location.includes('/history/') && fault === 'content-corrupt') f.bucket.objects.get(location).bytes = encoder.encode('different');
      if (location.includes('/latest/') && fault === 'pointer-missing') f.bucket.hidden.add(location);
      if (location.includes('/latest/') && fault === 'pointer-changed') f.bucket.objects.get(location).bytes = encoder.encode('{}');
      return result;
    };
    await error(await f.post(), 503, fault.endsWith('missing') ? 'backup-storage-missing' : 'backup-storage-corrupt');
  }
});

test('concurrent identical replay succeeds, distinct same-instance writes conflict without overwriting history', { timeout: 10000 }, async () => {
  const same = fixture();
  const replay = await Promise.all(Array.from({ length: 5 }, () => same.post()));
  assert.ok(replay.every(response => response.status === 200)); assert.equal(same.bucket.objects.size, 2);
  const distinct = fixture();
  const originalGet = distinct.bucket.get, initialReads = [];
  let release;
  const baselineBarrier = new Promise(resolve => { release = resolve; });
  distinct.bucket.get = async location => {
    // Capture both missing-pointer reads before either request can create the pointer.
    // Promise.all alone permits admissible serial writes under another scheduler.
    const snapshot = await originalGet(location);
    if (location.includes('/latest/') && initialReads.length < 2) {
      assert.equal(snapshot, null);
      initialReads.push(location);
      if (initialReads.length === 2) release();
      await baselineBarrier;
    }
    return snapshot;
  };
  const results = await Promise.all([distinct.post(), distinct.post(journal(A, { revision: 4 }))]);
  assert.equal(initialReads.length, 2);
  assert.equal(initialReads[0], initialReads[1], 'both requests must use the same initial CAS baseline');
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
  assert.equal(contentEntries(distinct.bucket).length, 2); assert.equal(pointerEntries(distinct.bucket).length, 1);
  const winner = await results.find(response => response.status === 200).json();
  assert.deepEqual(await (await distinct.list()).json(), { rows: [winner] });
});

test('pagination without progress and provider errors fail closed without disclosing details', async () => {
  const f = fixture(); await f.post();
  f.bucket.list = async () => ({ objects: [], truncated: true, cursor: 'same' });
  await error(await f.list(), 503, 'backup-storage-corrupt');
  f.bucket.failPut = true; await error(await f.post(journal(A, { revision: 4 })), 503, 'backup-storage-error');
  await error(await worker.fetch(request('POST', { key: key(), text: journal() }), { ENVIRONMENT: 'local-test' }), 503, 'backup-storage-unavailable');
});

test('metadata mode returns bounded pages, opaque owner-bound cursors, and never reads journal bodies', async () => {
  const f = fixture(1);
  for (const instance of ['tab-1', 'tab-2', 'tab-3']) assert.equal((await f.post(journal(), instance)).status, 200);
  const query = '?prefix=' + encodeURIComponent(prefix(A)) + '&metadata=1';
  f.bucket.calls.length = 0;
  const first = await f.listMetadata(query), firstBody = await first.json();
  assert.equal(first.status, 200); assert.equal(firstBody.rows.length, 1); assert.equal(typeof firstBody.cursor, 'string');
  assert.ok(firstBody.cursor.length <= 4096); assert.match(firstBody.cursor, /^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
  assert.equal(f.bucket.calls.find(([op]) => op === 'list')[1].limit, 20);
  assert.ok(f.bucket.calls.some(([op, location]) => op === 'get' && location.includes('/latest/')));
  assert.ok(f.bucket.calls.some(([op, location]) => op === 'head' && location.includes('/history/')));
  assert.ok(f.bucket.calls.every(([op, location]) => op !== 'get' || !location.includes('/history/')));
  const second = await f.listMetadata(query + '&cursor=' + encodeURIComponent(firstBody.cursor)), secondBody = await second.json();
  assert.equal(second.status, 200); assert.equal(secondBody.rows.length, 1); assert.equal(typeof secondBody.cursor, 'string');
  const third = await f.listMetadata(query + '&cursor=' + encodeURIComponent(secondBody.cursor)), thirdBody = await third.json();
  assert.equal(third.status, 200); assert.equal(thirdBody.rows.length, 1); assert.equal(thirdBody.cursor, null);
  assert.deepEqual([...firstBody.rows, ...secondBody.rows, ...thirdBody.rows].map(row => row.key).sort(),
    [key('tab-1'), key('tab-2'), key('tab-3')].sort());
  const before = f.bucket.calls.length;
  await error(await f.listMetadata(query + '&cursor=' + encodeURIComponent(firstBody.cursor.slice(0, -1) + '0')), 400, 'invalid-backup-cursor');
  assert.equal(f.bucket.calls.length, before);
});

test('metadata fields expose UTF-16 length, stable pending state, recovery and device-media protection', async () => {
  const f = fixture();
  const clean = journal(A, { revision: 7 });
  assert.equal((await f.post(clean, 'clean')).status, 200);
  const pending = journal(A, {
    revision: 8, local: { ...state(), students: [{ id: 'changed' }] }, ack: { sent: true }, resumeConflict: true,
    recovery: [state(), state()], overflowPrevious: [journal()], deviceMedia: [{ key: 'photo-1' }, { key: 'audio-1' }],
    unknownFutureField: { keep: true },
  });
  assert.equal((await f.post(pending, 'pending')).status, 200);
  const rows = (await (await f.listMetadata('?prefix=' + encodeURIComponent(prefix(A)) + '&metadata=1')).json()).rows;
  const cleanRow = rows.find(row => row.key === key('clean')), pendingRow = rows.find(row => row.key === key('pending'));
  assert.deepEqual(cleanRow, { key: key('clean'), sha256: await digest(clean), length: clean.length, revision: 7, pending: false, recoveryCount: 0 });
  assert.deepEqual(pendingRow, { key: key('pending'), sha256: await digest(pending), length: pending.length, revision: 8, pending: true, recoveryCount: 6 });
});

test('exact key GET retains full readback while requiring the exact owned prefix and excludes other keys', async () => {
  const f = fixture(), first = journal(), second = journal(A, { revision: 4 });
  await f.post(first, 'first'); await f.post(second, 'second');
  const response = await f.listKey(key('second'));
  assert.deepEqual(await response.json(), { rows: [{ key: key('second'), text: second }] });
  await error(await worker.fetch(request('GET', undefined, '?prefix=' + encodeURIComponent(prefix(A)) + '&key=' + encodeURIComponent(key('second', B)), {}, ORIGIN), f.env), 400, 'invalid-backup-key');
  await error(await worker.fetch(request('GET', undefined, '?key=' + encodeURIComponent(key('second'))), f.env), 400, 'invalid-backup-prefix');
  await error(await worker.fetch(request('GET', undefined, '?prefix=' + encodeURIComponent(prefix(A)) + '&key=' + encodeURIComponent(key('second')) + '&metadata=1'), f.env), 400, 'invalid-backup-key');
});

test('legacy pointers remain readable in full mode and metadata mode returns a conservative complete shape without journal reads', async () => {
  const f = fixture(), text = journal(); await f.post(text, 'legacy');
  const entry = pointerEntries(f.bucket).find(([location]) => location.includes('/latest/'));
  const pointer = JSON.parse(storedText(entry[1]));
  delete pointer.length; delete pointer.revision; delete pointer.pending; delete pointer.recoveryCount;
  entry[1].bytes = encoder.encode(JSON.stringify(pointer)); f.bucket.calls.length = 0;
  const metadata = await f.listMetadata('?prefix=' + encodeURIComponent(prefix(A)) + '&metadata=1');
  const row = (await metadata.json()).rows.find(value => value.key === key('legacy'));
  assert.deepEqual(row, { key: key('legacy'), sha256: pointer.sha256, length: 0, revision: 0, pending: true, recoveryCount: 0 });
  assert.ok(f.bucket.calls.every(([op, location]) => op !== 'get' || !location.includes('/history/')));
  assert.deepEqual(await (await f.listKey(key('legacy'))).json(), { rows: [{ key: key('legacy'), text }] });
});
