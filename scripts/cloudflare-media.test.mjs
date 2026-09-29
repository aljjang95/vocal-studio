import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync(new URL('../worker/index.mjs',import.meta.url),'utf8');
const state=fs.readFileSync(new URL('../worker/state.mjs',import.meta.url),'utf8');
const auth=fs.readFileSync(new URL('../worker/auth.mjs',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const transport=fs.readFileSync(new URL('../cf-transport.js',import.meta.url),'utf8');

test('private media is capped, immutable, and has no delete route',()=>{
  assert.match(worker,/20 \* 1024 \* 1024/);
  assert.match(worker,/await env\.MEDIA\.head\(key\)/);
  assert.match(worker,/media-pointer-exists/);
  assert.doesNotMatch(worker,/request\.method === 'DELETE'/);
});

test('media GET supports HEAD, ranges, 416 and same-origin storage URLs',()=>{
  for(const token of ['Accept-Ranges','Content-Range','416','HEAD','encodeURIComponent(key)'])assert.ok(worker.includes(token),token);
  assert.doesNotMatch(worker,/https?:\/\/[^'"`]*r2/i);
});
test('state uses SQLite Durable Object with CAS and idempotent request IDs',()=>{
  assert.match(state,/ctx\.storage\.sql/);
  assert.match(state,/baseRevision !== record\.revision/);
  assert.match(state,/request-id-conflict/);
  assert.match(state,/X-VS-Idempotent-Replay/);
  assert.match(state,/const merged = \{ \.\.\.record\.state, \.\.\.incoming \}/);
});

test('staged import requires verified principal-bound readback before activation',()=>{
  assert.match(state,/destination-not-empty/);
  assert.match(state,/mode: 'staged'/);
  assert.match(state,/readback\.principal !== principal/);
  assert.match(state,/verified-readback-required/);
});

test('Cloudflare Access verification uses jose issuer audience and email allowlist',()=>{
  for(const token of ['createRemoteJWKSet','jwtVerify','issuer','audience','ACCESS_ALLOWED_EMAILS'])assert.ok(auth.includes(token),token);
  assert.doesNotMatch(auth,/decodeJwt\(/);
});

test('service worker is network-only and retires old vs-v2 caches',()=>{
  assert.match(sw,/event\.respondWith\(fetch\(event\.request\)\)/);
  assert.match(sw,/key\.indexOf\('vs-v2-'\)===0/);
  assert.doesNotMatch(sw,/caches\.match\(req\)/);
});

test('data URL upload conversion is CSP-safe and only fetches same-origin media API',()=>{
  assert.match(transport,/function dataUrlBlob\(/);
  assert.match(transport,/atob\(payload\)/);
  assert.doesNotMatch(transport,/fetch\(data\)/);
  assert.match(transport,/fetch\('\/api\/media\/'/);
});
