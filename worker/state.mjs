const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' };
const READBACK_TTL_MS = 10 * 60 * 1000;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(stable(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cleanIncomingState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid-state');
  const state = structuredClone(input);
  delete state._vsSyncRevision;
  return state;
}

export class StudioState {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      this.sql.exec('CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, payload_sha TEXT NOT NULL, response_json TEXT NOT NULL, created_at INTEGER NOT NULL)');
    });
  }

  getKV(key) {
    const rows = this.sql.exec('SELECT value FROM kv WHERE key = ?', key).toArray();
    return rows.length ? JSON.parse(rows[0].value) : null;
  }

  setKV(key, value) {
    this.sql.exec('INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value));
  }

  record() { return this.getKV('record'); }

  async fetch(request) {
    const url = new URL(request.url);
    // Hashing yields: serialize the complete read/check/write operation.
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (request.method === 'GET' && url.pathname === '/state') return await this.getState();
        if (request.method === 'GET' && url.pathname === '/export') return await this.exportState(request);
        if (request.method === 'POST' && url.pathname === '/import') return await this.importState(request);
        if (request.method === 'POST' && url.pathname === '/activate') return await this.activate(request);
        if (request.method === 'POST' && url.pathname === '/commit') return await this.commit(request);
        return json({ error: 'not-found' }, 404);
      } catch (error) {
        return json({ error: error?.message || 'state-error' }, 400);
      }
    });
  }

  async getState() {
    const record = this.record();
    if (!record) return json({ error: 'missing-state' }, 404);
    return json({ ...record, hash: await sha256(record.state) }, 200, { 'X-VS-State-Mode': record.mode });
  }

  async importState(request) {
    if (this.record()) return json({ error: 'destination-not-empty' }, 409);
    const body = await request.json();
    const state = cleanIncomingState(body.state);
    const record = { mode: 'staged', revision: 0, state };
    this.setKV('record', record);
    this.setKV('readback', null);
    return json({ ok: true, mode: record.mode, revision: 0, hash: await sha256(state) }, 201);
  }

  async exportState(request) {
    const record = this.record();
    if (!record) return json({ error: 'missing-state' }, 404);
    const principal = request.headers.get('X-VS-Principal') || '';
    if (!principal) return json({ error: 'principal-required' }, 400);
    const hash = await sha256(record.state);
    this.setKV('readback', { principal, hash, at: Date.now(), revision: record.revision });
    return json({ ...record, hash });
  }

  async activate(request) {
    const record = this.record();
    if (!record) return json({ error: 'missing-state' }, 404);
    if (record.mode !== 'staged') return json({ error: 'not-staged', mode: record.mode }, 409);
    const principal = request.headers.get('X-VS-Principal') || '';
    const readback = this.getKV('readback');
    const hash = await sha256(record.state);
    if (!readback || readback.principal !== principal || readback.hash !== hash ||
        readback.revision !== record.revision || Date.now() - readback.at > READBACK_TTL_MS) {
      return json({ error: 'verified-readback-required' }, 409);
    }
    const body = await request.json().catch(() => ({}));
    if (body.hash && body.hash !== hash) return json({ error: 'activation-hash-mismatch' }, 409);
    const next = { ...record, mode: 'active' };
    this.setKV('record', next);
    return json({ ok: true, mode: next.mode, revision: next.revision, hash });
  }

  async commit(request) {
    const record = this.record();
    if (!record) return json({ error: 'missing-state' }, 404);
    if (record.mode !== 'active') return json({ error: 'state-not-active', mode: record.mode }, 409);
    const body = await request.json();
    if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0) throw new Error('invalid-base-revision');
    if (typeof body.requestId !== 'string' || body.requestId.length < 8 || body.requestId.length > 160) throw new Error('invalid-request-id');
    const incoming = cleanIncomingState(body.state);
    const payloadSha = await sha256({ baseRevision: body.baseRevision, requestId: body.requestId, state: incoming });
    const prior = this.sql.exec('SELECT payload_sha,response_json FROM requests WHERE id = ?', body.requestId).toArray();
    if (prior.length) {
      if (prior[0].payload_sha !== payloadSha) return json({ error: 'request-id-conflict' }, 409);
      return new Response(prior[0].response_json, { status: 200, headers: { ...JSON_HEADERS, 'X-VS-Idempotent-Replay': '1' } });
    }
    if (body.baseRevision !== record.revision) {
      return json({ error: 'revision-conflict', currentRevision: record.revision }, 409);
    }
    if (record.revision === Number.MAX_SAFE_INTEGER) return json({ error: 'revision-exhausted' }, 409);
    const merged = { ...record.state, ...incoming };
    const next = { mode: 'active', revision: record.revision + 1, state: merged };
    const response = JSON.stringify({ ok: true, mode: next.mode, revision: next.revision, state: next.state, hash: await sha256(next.state) });
    this.ctx.storage.transactionSync(() => {
      this.setKV('record', next);
      this.sql.exec('INSERT INTO requests(id,payload_sha,response_json,created_at) VALUES(?,?,?,?)', body.requestId, payloadSha, response, Date.now());
      this.sql.exec('DELETE FROM requests WHERE id IN (SELECT id FROM requests ORDER BY created_at DESC LIMIT -1 OFFSET 2048)');
    });
    return new Response(response, { status: 200, headers: JSON_HEADERS });
  }
}
