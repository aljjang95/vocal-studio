import { principalId } from './auth.mjs';

const MAX_BODY_BYTES = 16 * 1024 * 1024;
const POINTER_BYTES = 16 * 1024;
const CURSOR_BYTES = 4096;
const encoder = new TextEncoder();
const LISTS = ['students', 'logs', 'consults', 'payments', 'inquiries'];
const KNOWN_JOURNAL_FIELDS = new Set([
  'version', 'namespace', 'owner', 'revision', 'base', 'local', 'recovery',
  'ack', 'resumeConflict', 'overflowPrevious', 'deviceMedia',
]);
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
class BackupError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function fail(message, status) { throw new BackupError(message, status); }
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function scopePrefix(owner) { return 'vsC_sync_v1:' + encodeURIComponent('vocal-studio:' + owner) + ':backup:'; }
function validKey(key, owner) {
  const prefix = scopePrefix(owner);
  return typeof key === 'string' && key.startsWith(prefix) && /^[A-Za-z0-9_-]{1,128}$/.test(key.slice(prefix.length));
}
function normalState(value) {
  return record(value) && LISTS.every(field => Array.isArray(value[field])) && record(value.weekOvr) &&
    Object.values(value.weekOvr).every(record);
}
function validateJournal(text, owner) {
  if (typeof text !== 'string') fail('invalid-backup-text');
  let journal; try { journal = JSON.parse(text); } catch { fail('invalid-backup-journal'); }
  if (!record(journal) || journal.version !== 1 || journal.owner !== owner || journal.namespace !== 'vocal-studio' ||
      !Number.isSafeInteger(journal.revision) || journal.revision < 0 || !normalState(journal.base) ||
      !normalState(journal.local) || !Array.isArray(journal.recovery) ||
      (journal.deviceMedia !== undefined && !Array.isArray(journal.deviceMedia))) fail('invalid-backup-journal');
  // Validate only known fields. Persist the original text, including unknown fields and whitespace.
}
async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function readBytes(body, limit, error, status) {
  if (!body) fail(error, status);
  const reader = body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); fail(error, status); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
function decode(bytes, error, status) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail(error, status); }
}
async function requestBody(request) {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)) ||
      Number(declared) <= 0 || Number(declared) > MAX_BODY_BYTES)) fail('backup-body-too-large', 413);
  const bytes = await readBytes(request.body, MAX_BODY_BYTES, 'backup-body-too-large', 413);
  if (declared !== null && Number(declared) !== bytes.byteLength) fail('backup-body-length-mismatch');
  let value; try { value = JSON.parse(decode(bytes, 'invalid-backup-json', 400)); }
  catch (error) { if (error instanceof BackupError) throw error; fail('invalid-backup-json'); }
  if (!record(value)) fail('invalid-backup-body');
  return value;
}
async function objectText(object, limit) {
  if (!object || !Number.isSafeInteger(object.size) || object.size < 0 || object.size > limit) fail('backup-storage-corrupt', 503);
  const bytes = await readBytes(object.body, limit, 'backup-storage-corrupt', 503);
  if (bytes.byteLength !== object.size) fail('backup-storage-corrupt', 503);
  return decode(bytes, 'backup-storage-corrupt', 503);
}
async function paths(owner, key) {
  const ownerHash = await sha256(encoder.encode('vocal-studio:' + owner));
  const root = '_vs_backups/v1/' + ownerHash + '/';
  const keyHash = await sha256(encoder.encode(key));
  return { ownerHash, latestPrefix: root + 'latest/', pointerKey: root + 'latest/' + keyHash + '.json', historyPrefix: root + 'history/' + keyHash + '/' };
}
function metadataFromJournal(text, owner) {
  let journal; try { journal = JSON.parse(text); } catch { fail('invalid-backup-journal'); }
  validateJournal(text, owner);
  const unknown = Object.keys(journal).some(field => !KNOWN_JOURNAL_FIELDS.has(field));
  const overflow = Array.isArray(journal.overflowPrevious) ? journal.overflowPrevious.length : 0;
  const deviceMedia = Array.isArray(journal.deviceMedia) ? journal.deviceMedia.length : 0;
  const recoveryCount = journal.recovery.length + overflow + deviceMedia + (unknown ? 1 : 0);
  const pending = !stableEqual(journal.base, journal.local) || Object.hasOwn(journal, 'ack') ||
    journal.resumeConflict === true || deviceMedia > 0 || unknown;
  return { length: text.length, revision: journal.revision, pending, recoveryCount };
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}
function stableEqual(a, b) { return JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b)); }
function pointerMetadata(pointer, owner) {
  const coreValid = record(pointer) && pointer.version === 1 && pointer.owner === owner && pointer.namespace === 'vocal-studio' &&
    validKey(pointer.key, owner) && typeof pointer.sha256 === 'string' && /^[a-f0-9]{64}$/.test(pointer.sha256) &&
    typeof pointer.contentKey === 'string';
  const fields = ['length', 'revision', 'pending', 'recoveryCount'];
  const hasMetadata = fields.some(field => Object.hasOwn(pointer || {}, field));
  const metadataValid = Number.isSafeInteger(pointer?.length) && pointer.length >= 0 && Number.isSafeInteger(pointer?.revision) &&
    pointer.revision >= 0 && typeof pointer.pending === 'boolean' && Number.isSafeInteger(pointer.recoveryCount) && pointer.recoveryCount >= 0;
  if (!coreValid || (hasMetadata && !metadataValid)) {
    fail('backup-storage-corrupt', 503);
  }
  return { key: pointer.key, sha256: pointer.sha256, length: hasMetadata ? pointer.length : 0,
    revision: hasMetadata ? pointer.revision : 0, pending: hasMetadata ? pointer.pending : true,
    recoveryCount: hasMetadata ? pointer.recoveryCount : 0, legacy: !hasMetadata, contentKey: pointer.contentKey };
}
async function readPointerMetadata(bucket, object, owner, location) {
  let pointer; try { pointer = JSON.parse(await objectText(object, POINTER_BYTES)); }
  catch { fail('backup-storage-corrupt', 503); }
  const metadata = pointerMetadata(pointer, owner), expected = await paths(owner, metadata.key);
  if (location !== expected.pointerKey || metadata.contentKey !== expected.historyPrefix + metadata.sha256 + '.json') {
    fail('backup-storage-corrupt', 503);
  }
  const content = await bucket.head(metadata.contentKey);
  if (!content || content.customMetadata?.sha256 !== metadata.sha256) fail('backup-storage-missing', 503);
  return metadata;
}
async function readPointer(bucket, object, owner, location) {
  const metadata = await readPointerMetadata(bucket, object, owner, location);
  const content = await bucket.get(metadata.contentKey);
  if (!content) fail('backup-storage-missing', 503);
  const text = await objectText(content, MAX_BODY_BYTES);
  if (await sha256(encoder.encode(text)) !== metadata.sha256) fail('backup-storage-corrupt', 503);
  try { validateJournal(text, owner); } catch { fail('backup-storage-corrupt', 503); }
  return { key: metadata.key, text };
}
async function putBackup(request, bucket, owner) {
  const { key, text } = await requestBody(request);
  if (!validKey(key, owner)) fail('invalid-backup-key');
  validateJournal(text, owner);
  const bytes = encoder.encode(text);
  if (decode(bytes, 'invalid-backup-text', 400) !== text) fail('invalid-backup-text');
  const metadata = metadataFromJournal(text, owner), sha = await sha256(bytes), location = await paths(owner, key);
  const contentKey = location.historyPrefix + sha + '.json';
  const current = await bucket.get(location.pointerKey);
  // Validate existing evidence before replacing its pointer. Never repair or erase corruption implicitly.
  const prior = current ? await readPointerMetadata(bucket, current, owner, location.pointerKey) : null;
  await bucket.put(contentKey, bytes, {
    onlyIf: new Headers({ 'If-None-Match': '*' }),
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { immutable: '1', sha256: sha, length: String(metadata.length), revision: String(metadata.revision),
      pending: String(metadata.pending), recoveryCount: String(metadata.recoveryCount) },
  });
  // Conditional creation can lose to an identical replay; read the content body exactly once.
  const immutable = await bucket.get(contentKey);
  if (!immutable) fail('backup-storage-missing', 503);
  const saved = await objectText(immutable, MAX_BODY_BYTES);
  if (saved !== text || await sha256(encoder.encode(saved)) !== sha) fail('backup-storage-corrupt', 503);
  if (!prior || prior.sha256 !== sha) {
    const pointer = { version: 1, namespace: 'vocal-studio', owner, key, sha256: sha, contentKey, ...metadata };
    const stored = await bucket.put(location.pointerKey, JSON.stringify(pointer), {
      onlyIf: new Headers(current ? { 'If-Match': current.httpEtag } : { 'If-None-Match': '*' }),
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
    if (!stored) {
      const winner = await bucket.get(location.pointerKey);
      if (!winner) fail('backup-storage-missing', 503);
      const row = await readPointerMetadata(bucket, winner, owner, location.pointerKey);
      if (row.key !== key || row.sha256 !== sha) fail('backup-write-conflict', 409);
    }
  }
  const readback = await bucket.get(location.pointerKey);
  if (!readback) fail('backup-storage-missing', 503);
  const row = await readPointerMetadata(bucket, readback, owner, location.pointerKey);
  if (row.key !== key || row.sha256 !== sha) fail('backup-write-conflict', 409);
  return json({ key, text });
}
function cursorBytes(value) {
  const bytes = encoder.encode(value); let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodeCursorBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  let binary; try { binary = atob(padded); } catch { fail('invalid-backup-cursor'); }
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return decode(bytes, 'invalid-backup-cursor', 400);
}
async function encodeCursor(ownerHash, cursor) {
  const signature = await sha256(encoder.encode('vsC-backup-cursor-v1:' + ownerHash + ':' + cursor));
  return cursorBytes(cursor) + '.' + signature;
}
async function decodeCursor(ownerHash, token) {
  if (typeof token !== 'string' || token.length > CURSOR_BYTES || !/^[A-Za-z0-9_-]{1,2048}\.[a-f0-9]{64}$/.test(token)) {
    fail('invalid-backup-cursor');
  }
  const divider = token.lastIndexOf('.'), cursor = decodeCursorBytes(token.slice(0, divider));
  if (!cursor || cursor.length > 1024 || await encodeCursor(ownerHash, cursor) !== token) fail('invalid-backup-cursor');
  return cursor;
}
function metadataRow(metadata) {
  return { key: metadata.key, sha256: metadata.sha256, length: metadata.length, revision: metadata.revision,
    pending: metadata.pending, recoveryCount: metadata.recoveryCount };
}
async function listBackups(url, bucket, owner) {
  const prefixes = url.searchParams.getAll('prefix');
  if (prefixes.length !== 1 || prefixes[0] !== scopePrefix(owner)) fail('invalid-backup-prefix');
  const requestedKey = url.searchParams.getAll('key');
  if (requestedKey.length > 1) fail('invalid-backup-key');
  const metadataMode = url.searchParams.getAll('metadata');
  if (metadataMode.length > 1 || (metadataMode.length === 1 && metadataMode[0] !== '1')) fail('invalid-backup-metadata');
  const cursorValues = url.searchParams.getAll('cursor');
  if (cursorValues.length > 1) fail('invalid-backup-cursor');
  if (requestedKey.length) {
    const requested = requestedKey[0];
    if (!validKey(requested, owner) || cursorValues.length || metadataMode.length) fail('invalid-backup-key');
    const location = await paths(owner, requested), object = await bucket.get(location.pointerKey);
    if (!object) fail('backup-storage-missing', 503);
    const row = await readPointer(bucket, object, owner, location.pointerKey);
    return json({ rows: [{ key: row.key, text: row.text }] });
  }
  const location = await paths(owner, scopePrefix(owner));
  const { latestPrefix } = location;
  const rows = [], keys = new Set(), cursors = new Set(); let cursor;
  if (cursorValues.length) cursor = await decodeCursor(location.ownerHash, cursorValues[0]);
  do {
    const page = await bucket.list({ prefix: latestPrefix, limit: metadataMode.length ? 20 : 1000, ...(cursor ? { cursor } : {}) });
    if (!Array.isArray(page.objects) || typeof page.truncated !== 'boolean') fail('backup-storage-corrupt', 503);
    for (const entry of page.objects) {
      if (typeof entry.key !== 'string' || !entry.key.startsWith(latestPrefix) || keys.has(entry.key)) fail('backup-storage-corrupt', 503);
      keys.add(entry.key);
      const object = await bucket.get(entry.key);
      if (!object) fail('backup-storage-missing', 503);
      if (metadataMode.length) rows.push(metadataRow(await readPointerMetadata(bucket, object, owner, entry.key)));
      else rows.push(await readPointer(bucket, object, owner, entry.key));
    }
    if (metadataMode.length) {
      let nextCursor = null;
      if (page.truncated) {
        if (typeof page.cursor !== 'string' || !page.cursor) fail('backup-storage-corrupt', 503);
        nextCursor = await encodeCursor(location.ownerHash, page.cursor);
      }
      rows.sort((a, b) => a.key.localeCompare(b.key));
      return json({ rows, cursor: nextCursor });
    }
    if (!page.truncated) break;
    if (typeof page.cursor !== 'string' || !page.cursor || cursors.has(page.cursor)) fail('backup-storage-corrupt', 503);
    cursors.add(page.cursor); cursor = page.cursor;
  } while (true);
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return json({ rows });
}
// The caller supplies only the principal already verified by the existing Access allowlist.
export async function handleBackups(request, env, principal) {
  try {
    const url = new URL(request.url);
    if (request.headers.get('X-VS-Protocol') !== 'vs-cf-1') fail('protocol-required');
    const origin = request.headers.get('Origin');
    if ((request.method === 'POST' || origin !== null) && origin !== url.origin) fail('origin-required', 403);
    if (!['GET', 'POST'].includes(request.method)) fail('method-not-allowed', 405);
    if (!env.MEDIA) fail('backup-storage-unavailable', 503);
    const owner = principalId(principal);
    return request.method === 'POST' ? await putBackup(request, env.MEDIA, owner) : await listBackups(url, env.MEDIA, owner);
  } catch (error) {
    return json({ error: error instanceof BackupError ? error.message : 'backup-storage-error' }, error instanceof BackupError ? error.status : 503);
  }
}
