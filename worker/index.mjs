import { authenticate, principalId } from './auth.mjs';
import { StudioState } from './state.mjs';
export { StudioState };
const PROTOCOL = 'vs-cf-1';
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const ASSETS = new Set([
  '/index.html', '/vs-sync.js', '/cf-transport.js', '/cf-migration.js',
  '/sw.js', '/manifest.json', '/icon-192.png', '/icon-512.png',
]);
const CSP = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; " +
  "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self' wss:; form-action 'self'";
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}
function secured(response) {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CSP);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function sameOrigin(request, url) { return request.headers.get('Origin') === url.origin; }
function requireProtocol(request) { return request.headers.get('X-VS-Protocol') === PROTOCOL; }
function stateStub(env) {
  const id = env.STUDIO.idFromName(String(env.STUDIO_NAMESPACE || 'vocal-studio'));
  return env.STUDIO.get(id);
}
async function callState(request, env, principal, path) {
  const headers = new Headers({ 'content-type': 'application/json', 'X-VS-Principal': principalId(principal) });
  const init = { method: request.method, headers };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.text();
  return stateStub(env).fetch(new Request(`https://studio.internal${path}`, init));
}
async function callEvents(request, env, principal) {
  const headers = new Headers(request.headers);
  headers.set('X-VS-Principal', principalId(principal));
  return stateStub(env).fetch(new Request(request, { headers }));
}
function mediaKey(pathname) {
  const encoded = pathname.slice('/api/media/'.length);
  if (!encoded) throw new Error('media-pointer-required');
  let value; try { value = decodeURIComponent(encoded); } catch { throw new Error('invalid-media-pointer'); }
  if (value.length > 512 || value.startsWith('/') || value.includes('..') || value.includes('\\') || value.includes('//') ||
      !/^[A-Za-z0-9._/-]+$/.test(value)) throw new Error('invalid-media-pointer');
  return value;
}
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function mediaSuccess(key, status = 201, replay = false) {
  return json({ ok: true, pointer: key, url: `/api/media/${encodeURIComponent(key)}` }, status,
    replay ? { 'X-VS-Idempotent-Replay': '1' } : {});
}
function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return { invalid: true };
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return { invalid: true };
    end = Math.min(end, size - 1);
  }
  return { start, end, length: end - start + 1 };
}
async function mediaResponse(request, env, url) {
  const key = mediaKey(url.pathname);
  if (request.method === 'PUT') {
    const declared = request.headers.get('Content-Length');
    if (declared !== null) {
      const length = Number(declared);
      if (!Number.isFinite(length) || length <= 0 || length > MAX_MEDIA_BYTES) return json({ error: 'media-size-invalid' }, 413);
    }
    const type = request.headers.get('Content-Type') || 'application/octet-stream';
    if (!/^(image|audio|video)\//.test(type) && type !== 'application/octet-stream') return json({ error: 'media-type-invalid' }, 415);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_MEDIA_BYTES) return json({ error: 'media-size-invalid' }, 413);
    const digest = await sha256Hex(bytes); const existing = await env.MEDIA.head(key);
    if (existing) {
      const same = existing.size === bytes.byteLength && existing.customMetadata?.sha256 === digest;
      return same ? mediaSuccess(key, 200, true) : json({ error: 'media-pointer-exists' }, 409);
    }
    const stored = await env.MEDIA.put(key, bytes, {
      onlyIf: new Headers({ 'If-None-Match': '*' }), httpMetadata: { contentType: type },
      customMetadata: { immutable: '1', sha256: digest },
    });
    if (!stored) {
      const winner = await env.MEDIA.head(key);
      const same = winner?.size === bytes.byteLength && winner?.customMetadata?.sha256 === digest;
      return same ? mediaSuccess(key, 200, true) : json({ error: 'media-pointer-exists' }, 409);
    }
    return mediaSuccess(key);
  }
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method-not-allowed' }, 405);
  const head = await env.MEDIA.head(key); if (!head) return json({ error: 'media-not-found' }, 404);
  const headers = new Headers(); head.writeHttpMetadata(headers);
  headers.set('Accept-Ranges', 'bytes'); headers.set('Cache-Control', 'private, no-store'); headers.set('ETag', head.httpEtag);
  const range = parseRange(request.headers.get('Range'), head.size);
  if (range?.invalid) { headers.set('Content-Range', `bytes */${head.size}`); return new Response(null, { status: 416, headers }); }
  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(range ? range.length : head.size));
    if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${head.size}`);
    return new Response(null, { status: range ? 206 : 200, headers });
  }
  const object = await env.MEDIA.get(key, range ? { range: { offset: range.start, length: range.length } } : undefined);
  if (!object) return json({ error: 'media-not-found' }, 404);
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${head.size}`);
  headers.set('Content-Length', String(range ? range.length : head.size));
  return new Response(object.body, { status: range ? 206 : 200, headers });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url); let principal;
    try { principal = await authenticate(request, env); }
    catch (error) { return json({ error: 'access-required' }, 401); }
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mutation && !sameOrigin(request, url)) return json({ error: 'origin-required' }, 403);
    if (url.pathname === '/api/session' && request.method === 'GET') {
      if (!requireProtocol(request)) return json({ error: 'protocol-required' }, 400);
      return json({ ok: true, protocol: PROTOCOL, principal: principalId(principal), email: principal.email });
    }
    if (url.pathname === '/api/events' && request.method === 'GET') {
      if (url.searchParams.get('protocol') !== PROTOCOL) return json({ error: 'protocol-required' }, 400);
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade-required' }, 426);
      if (!sameOrigin(request, url)) return json({ error: 'origin-required' }, 403);
      return callEvents(request, env, principal);
    }
    if (url.pathname.startsWith('/api/media/')) {
      if (request.method === 'PUT' && !requireProtocol(request)) return json({ error: 'protocol-required' }, 400);
      try { return await mediaResponse(request, env, url); }
      catch (error) { return json({ error: error?.message || 'media-error' }, 400); }
    }
    const stateRoute = new Map([
      ['/api/state', '/state'], ['/api/commit', '/commit'], ['/api/import', '/import'],
      ['/api/export', '/export'], ['/api/activate', '/activate'],
    ]).get(url.pathname);
    if (stateRoute) {
      if (!requireProtocol(request)) return json({ error: 'protocol-required' }, 400);
      return callState(request, env, principal, stateRoute);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'method-not-allowed' }, 405);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!ASSETS.has(path)) return json({ error: 'not-found' }, 404);
    const assetUrl = new URL(request.url); assetUrl.pathname = path;
    return secured(await env.ASSETS.fetch(new Request(assetUrl, request)));
  },
};
