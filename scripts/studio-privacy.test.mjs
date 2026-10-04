import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import relay from '../worker/sms-relay.mjs';
import { DEVICE_ROUTES } from '../worker/sms.mjs';
import { STUDIO_PRIVACY_HTML, STUDIO_PRIVACY_PATH } from '../worker/studio-privacy.mjs';

const origin = 'https://relay.example';
const token = 'vssms_' + 'a'.repeat(43);
const request = (path, method = 'GET', headers = {}) => new Request(origin + path, {
  method, headers, ...(['POST', 'PUT', 'PATCH'].includes(method) ? { body: '{}' } : {}),
});
const forbiddenBackend = { SMS_STUDIO: { deviceRequest() { assert.fail('public or denied route reached backend'); } } };

test('exact public GET and HEAD work without authentication or a backend', async () => {
  assert.equal(STUDIO_PRIVACY_PATH, '/privacy');
  for (const env of [{}, forbiddenBackend]) {
    const get = await relay.fetch(request('/privacy'), env);
    const head = await relay.fetch(request('/privacy', 'HEAD'), env);
    assert.equal(get.status, 200);
    assert.equal(head.status, 200);
    assert.equal(await get.text(), STUDIO_PRIVACY_HTML);
    assert.equal(await head.text(), '');
    assert.deepEqual([...head.headers], [...get.headers]);
    assert.equal(get.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(get.headers.get('cache-control'), 'public, max-age=300, must-revalidate');
    assert.equal(get.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(get.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(get.headers.get('x-frame-options'), 'DENY');
    const csp = get.headers.get('content-security-policy');
    for (const directive of ["default-src 'none'", "script-src 'none'", "base-uri 'none'", "frame-src 'none'", "frame-ancestors 'none'", "form-action 'none'"]) assert.ok(csp.includes(directive));
    assert.equal(get.headers.has('access-control-allow-origin'), false);
    assert.equal(get.headers.has('set-cookie'), false);
  }
});

test('queries, path variants and unsupported methods stay denied', async () => {
  for (const path of ['/privacy?token=synthetic', '/privacy?', '/privacy?x=', '/privacy/', '/Privacy', '/%70rivacy', '/privacy/child', '/', '/sms/overview', '/device/unknown']) {
    for (const method of ['GET', 'HEAD']) assert.equal((await relay.fetch(request(path, method), forbiddenBackend)).status, 404, path);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal((await relay.fetch(request('/privacy', method), forbiddenBackend)).status, 404, method);
});

test('device routes retain strict auth, methods, query limits and backend forwarding', async () => {
  for (const [path, method] of Object.entries(DEVICE_ROUTES)) {
    assert.equal((await relay.fetch(request(path, method), forbiddenBackend)).status, 401, path);
    assert.equal((await relay.fetch(request(path, method, { Authorization: 'Bearer invalid' }), forbiddenBackend)).status, 401);
    assert.equal((await relay.fetch(request(path + '?x=1', method, { Authorization: 'Bearer ' + token }), forbiddenBackend)).status, 404);
    assert.equal((await relay.fetch(request(path, method === 'GET' ? 'POST' : 'GET', { Authorization: 'Bearer ' + token }), forbiddenBackend)).status, 404);
    assert.equal((await relay.fetch(request(path, method, { Authorization: 'Bearer ' + token }), {})).status, 503);
    const calls = [];
    const env = { SMS_STUDIO: { async deviceRequest(input) { calls.push(input); return { status: 401, body: { error: 'sms-device-auth-required' } }; } } };
    const result = await relay.fetch(request(path, method, { Authorization: 'Bearer ' + token }), env);
    assert.equal(result.status, 401); // Backend authority still rejects a syntactically valid token.
    assert.deepEqual(calls, [{ path, method, token, body: method === 'POST' ? {} : null }]);
    assert.equal(result.headers.has('access-control-allow-origin'), false);
  }
});

test('request headers cannot affect disclosure, links or security policy', async () => {
  const plain = await relay.fetch(request('/privacy'), {});
  const hostile = await relay.fetch(request('/privacy', 'GET', { Authorization: 'Bearer synthetic-secret', Origin: 'https://attacker.example', 'X-VS-Principal': '<script>alert(1)</script>' }), {});
  assert.equal(await hostile.text(), await plain.text());
  assert.deepEqual([...hostile.headers], [...plain.headers]);
});

test('fixed Korean template covers data, consent, retention and operator boundaries', async () => {
  const html = STUDIO_PRIVACY_HTML;
  for (const content of ['lang="ko"', 'HLB 스튜디오', 'com.tllhouse.hlbreplay', '2026-10-04', '페어링 토큰', '요청 URL이나 로그에 기록하지 않습니다', '백업에 포함하지 않습니다', '비공개 SQLite', '해시 허용 목록', '과거 문자 내역을 가져오지 않습니다', 'RCS 및 MMS는 처리하지 않습니다', '발신자 확인 역할', '로컬 동의', '서버의 전화 접수 설정', 'includeUnknown', 'READ_CONTACTS', '연락처를 조회하거나 업로드하지 않습니다', '통화 음성·통화 내역', '접근성 서비스', '알림 읽기', '광고 및 분석', 'HTTPS', 'Cloudflare', '외부 이동통신사', '월요일', '화요일', '정확한 분 단위', '30일 자동 삭제를 약속하지 않습니다', '서버 데이터가 삭제되지는 않습니다', '앱을 제거하면', '운영자가 최종 확정']) assert.ok(html.includes(content), content);
  assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]), ['mailto:aljjang95@gmail.com', 'https://hlb.tllhouse.com/']);
  assert.doesNotMatch(html, /<(?:script|iframe|form|img|base)\b|\bon\w+\s*=|\$\{|Google.*승인/i);
  const source = await readFile(new URL('../worker/studio-privacy.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\$\{/); // Static template: no request or user-data interpolation.
});
