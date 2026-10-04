import { scheduleSnapshot } from './schedule-core.generated.mjs';
import { rankScheduleOptions, assertScheduleIntervalAvailable } from './schedule-options.mjs';

const KST = 9 * 3600000, DAY = 86400000;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const validTime = value => typeof value === 'string' && TIME.test(value);
const ID = /^[A-Za-z0-9_.:-]{1,160}$/;
export const SMS_BODY_LIMIT = 16384;
export const DEVICE_ROUTES = Object.freeze({ '/device/pull': 'GET', '/device/event': 'POST', '/device/call': 'POST', '/device/claim': 'POST', '/device/ack': 'POST' });
export const smsJSON = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
});
function fail(error, status = 400, detail = {}) { throw Object.assign(new Error(error), { status, detail }); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function fields(body, allowed) {
  if (!object(body) || Object.keys(body).some(key => !allowed.includes(key))) fail('sms-invalid-body');
}
function text(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || (required && !value.trim())) fail('sms-invalid-text');
  return value;
}
function validId(value) { if (typeof value !== 'string' || !ID.test(value)) fail('sms-invalid-id'); return value; }
export async function smsHash(value) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s().-]+$/.test(value)) return '';
  let phone = value.replace(/[\s().-]/g, '');
  if (phone.startsWith('+82')) phone = '0' + phone.slice(3).replace(/^0/, '');
  else if (phone.startsWith('0082')) phone = '0' + phone.slice(4).replace(/^0/, '');
  return /^0\d{8,10}$/.test(phone) ? phone : '';
}
export function deviceBearer(request) {
  const match = /^Bearer (vssms_[A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization') || '');
  if (!match) fail('sms-device-auth-required', 401);
  return match[1];
}
export async function readSmsBody(request) {
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > SMS_BODY_LIMIT)) fail('sms-body-too-large', 413);
  if (!request.body) fail('sms-invalid-body');
  const reader = request.body.getReader(), chunks = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > SMS_BODY_LIMIT) { await reader.cancel(); fail('sms-body-too-large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail('sms-invalid-json'); }
}
function dateMillis(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const ms = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date ? ms : NaN;
}
function dayInfo(now) {
  const local = new Date(now + KST), date = local.toISOString().slice(0, 10), dow = local.getUTCDay();
  const monday = dateMillis(date) - ((dow + 6) % 7) * DAY;
  return { date, dow, weekStart: new Date(monday).toISOString().slice(0, 10), weekAt: monday - KST,
    dayEnd: dateMillis(date) + DAY - KST, minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}
function timestamp(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|\+09:00)$/.test(value) && Number.isFinite(dateMillis(value.slice(0, 10)))) {
    const at = Date.parse(value); if (Number.isFinite(at)) return at;
  }
  fail('sms-invalid-received-at');
}

// Suggestions are deterministic hints. Alternatives, negations and vague times never choose a slot.
export function proposeSchedule(raw, receivedAt) {
  const result = { date: '', time: '', warnings: [] }, today = dayInfo(receivedAt), s = raw.trim();
  if (/(취소|불가|안\s*(돼|되|될|됩니다|되요|가|갈|하|할|해|오|올)|못\s*(가|하|해)|않|없|말고|보류|제외|어렵|다른\s*시간|변경|아니|또는|혹은|이나|아니면|~|부터|까지)/.test(s)) {
    result.warnings.push('변경·취소·대안 표현을 직접 확인해주세요.'); return result;
  }
  const dates = [], times = []; let invalid = false;
  let rest = s.replace(/(?<!\d)(20\d{2})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/g, (_, y, m, d) => {
    dates.push(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`); return ' ';
  });
  rest = rest.replace(/(?<!\d)(\d{1,2})\s*(?:월\s*|[/.])(\d{1,2})\s*일?(?!\d)/g, (_, m, d) => {
    dates.push(`${today.date.slice(0, 4)}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`); return ' ';
  });
  rest = rest.replace(/(오늘|내일|모레|이번\s*주\s*[월화수목금토일](?:요일)?|다음\s*주\s*[월화수목금토일](?:요일)?|[월화수목금토일]요일)/g, expression => {
    const e = expression.replace(/\s/g, ''); let at;
    if (['오늘', '내일', '모레'].includes(e)) at = dateMillis(today.date) + ['오늘', '내일', '모레'].indexOf(e) * DAY;
    else if (/^(이번주|다음주)/.test(e)) at = dateMillis(today.weekStart) + ((DAYS.indexOf(e[3]) + 6) % 7 + (e.startsWith('다음주') ? 7 : 0)) * DAY;
    else { invalid = true; return ' '; }
    dates.push(new Date(at).toISOString().slice(0, 10)); return ' ';
  });
  rest = rest.replace(/(?<!\d)(?:(오전|오후|저녁|밤)\s*)?(\d{1,2}):(\d{2})(?!\d)/g, (_, period, h, m) => {
    times.push(parseTime(period, Number(h), Number(m))); return ' ';
  });
  rest = rest.replace(/(?<!\d)(?:(오전|오후|저녁|밤)\s*)?(\d{1,2})\s*시\s*(?:(반)|(\d{1,2})\s*분)?/g, (_, period, h, half, m) => {
    times.push(parseTime(period, Number(h), half ? 30 : Number(m || 0))); return ' ';
  });
  if (/(쯤|경|언제|아무|시간대|가능한|[월화수목금토일]요일|오전|오후|저녁|밤|\d)/.test(rest)) invalid = true;
  const uniqueDates = [...new Set(dates)], uniqueTimes = [...new Set(times)];
  if (invalid || uniqueDates.length !== 1 || !Number.isFinite(dateMillis(uniqueDates[0])) || uniqueTimes.length !== 1 || !TIME.test(uniqueTimes[0] || '') ||
      Date.parse(`${uniqueDates[0]}T${uniqueTimes[0]}:00+09:00`) <= receivedAt) {
    result.warnings.push('정확한 미래 날짜와 시간을 직접 지정해주세요.'); return result;
  }
  result.date = uniqueDates[0]; result.time = uniqueTimes[0];
  result.warnings.push('문자에서 읽은 제안입니다. 원문을 확인하고 확정해주세요.'); return result;
}
function parseTime(period, h, m) {
  if (!Number.isInteger(m) || m < 0 || m > 59 || h < 0 || h > 23) return '';
  if (period) { if (h < 1 || h > 12) return ''; h = h % 12 + (period === '오전' ? 0 : 12); }
  else if (h < 13) return ''; // Korean 3시 or 03:00 without AM/PM is deliberately held.
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
const DEFAULTS = Object.freeze({ enabled: false, mondayTime: '10:00', tuesdayTime: '14:00',
  mondayText: '{name}님, 안녕하세요. 이번 주 수업 가능한 날짜와 시간을 알려주시면 확인 후 안내드리겠습니다.',
  tuesdayText: '{name}님, 이번 주 수업 일정 확인차 연락드립니다. 편하실 때 가능한 날짜와 시간을 알려주세요.' });
function validateSettings(value) {
  fields(value, ['enabled', 'mondayTime', 'tuesdayTime', 'mondayText', 'tuesdayText']);
  if (typeof value.enabled !== 'boolean' || !validTime(value.mondayTime) || !validTime(value.tuesdayTime)) fail('sms-invalid-settings');
  for (const key of ['mondayText', 'tuesdayText']) {
    text(value[key], 3500); if (/\{(?!name\})[^}]*\}/.test(value[key])) fail('sms-invalid-placeholder');
  }
  return value;
}
function settings(owner) {
  const saved = owner.getKV('sms.settings');
  if (saved === null) return { ...DEFAULTS };
  try { return validateSettings(saved); }
  catch { fail('sms-stored-settings-invalid', 409); }
}
function disabledSettings(owner) {
  // Security recovery must not depend on parsing or validating old preferences.
  try { return { ...settings(owner), enabled: false }; }
  catch { return { ...DEFAULTS }; }
}
const CALL_DEFAULTS = Object.freeze({ enabled: false, includeUnknown: false });
function validateCallSettings(value) {
  fields(value, ['enabled', 'includeUnknown']);
  if (typeof value.enabled !== 'boolean' || typeof value.includeUnknown !== 'boolean') fail('sms-invalid-call-settings');
  return { enabled: value.enabled, includeUnknown: value.includeUnknown };
}
function callSettings(owner) {
  // Missing, malformed and corrupt persisted preferences never grant intake consent.
  try { return validateCallSettings(owner.getKV('sms.callSettings')); }
  catch { return { ...CALL_DEFAULTS }; }
}
function recordOf(owner) {
  const r = owner.record();
  if (!r || r.mode !== 'active' || !Number.isSafeInteger(r.revision) || r.revision < 0) fail('sms-state-not-active', 409);
  const state = r.state;
  if (!object(state) || !Array.isArray(state.students) || ['consults', 'inquiries'].some(k => state[k] !== undefined && !Array.isArray(state[k])) ||
      (state.weekOvr !== undefined && !object(state.weekOvr))) fail('sms-state-invalid', 409);
  const ids = new Set();
  for (const student of state.students) {
    if (!object(student) || typeof student.id !== 'string' || !student.id || ids.has(student.id)) fail('sms-student-schema-invalid', 409);
    ids.add(student.id);
  }
  return r;
}
function phoneOf(row) { return object(row) ? normalizePhone(row.ph || row.phone || '') : ''; }
function callMatch(state, phone) {
  const contacts = [['student', state.students], ['consult', state.consults || []], ['inquiry', state.inquiries || []]]
    .flatMap(([kind, rows]) => rows.filter(row => phoneOf(row) === phone).map(row => ({ kind, row })));
  if (!contacts.length) return { name: '', studentId: null, matchStatus: 'unknown' };
  const people = new Set();
  const consults = state.consults || [], inquiries = state.inquiries || [];
  const declared = value => value !== undefined && value !== null && value !== '';
  const unique = (rows, key, value) => {
    if (typeof value !== 'string' || !value) return null;
    const found = rows.filter(row => object(row) && row[key] === value);
    return found.length === 1 ? found[0] : null;
  };
  function inquiryStudent(row) {
    const ids = [row.convertedStudentId, row.studentId].filter(declared);
    if (!ids.length) return { student: null };
    if (ids.some(value => typeof value !== 'string') || new Set(ids).size !== 1) return null;
    const student = unique(state.students, 'id', ids[0]);
    return student && phoneOf(student) === phone ? { student } : null;
  }
  function consultPerson(row) {
    if (unique(consults, 'id', row.id) !== row) return null;
    const students = state.students.filter(s => s.consultData?.id === row.id);
    if (students.length > 1 || students.length === 1 && phoneOf(students[0]) !== phone) return null;
    let student = students[0] || null;
    const referring = inquiries.filter(q => object(q) && q.consultId === row.id);
    if (declared(row._inquiryId) || referring.length) {
      const inquiry = unique(inquiries, 'id', row._inquiryId);
      if (!inquiry || referring.length !== 1 || referring[0] !== inquiry || inquiry.consultId !== row.id ||
        consults.filter(c => object(c) && c._inquiryId === inquiry.id).length !== 1) return null;
      const direct = inquiryStudent(inquiry);
      if (!direct || student && direct.student && student.id !== direct.student.id) return null;
      student ||= direct.student;
    }
    return { key: student ? 'student:' + student.id : row, student };
  }
  let invalidLink = false;
  for (const { kind, row } of contacts) {
    if (kind === 'student') { people.add('student:' + row.id); continue; }
    let person;
    if (kind === 'consult') person = consultPerson(row);
    else if (unique(inquiries, 'id', row.id) === row) {
      const direct = inquiryStudent(row), referring = consults.filter(c => object(c) && c._inquiryId === row.id);
      if (declared(row.consultId) || referring.length) {
        const consult = unique(consults, 'id', row.consultId);
        if (consult && referring.length === 1 && referring[0] === consult && consult._inquiryId === row.id) person = consultPerson(consult);
        if (!direct || person?.student && direct.student && person.student.id !== direct.student.id) person = null;
      } else if (direct) person = { key: direct.student ? 'student:' + direct.student.id : row };
    }
    if (!person) invalidLink = true;
    else people.add(person.key);
  }
  // Only explicit IDs unify records. Same phone/name is never person-link evidence.
  if (invalidLink || people.size > 1) return { name: '', studentId: null, matchStatus: 'ambiguous' };
  const person = [...people][0], student = typeof person === 'string' && state.students.find(s => 'student:' + s.id === person);
  if (student) return { name: typeof student.name === 'string' ? student.name : '', studentId: student.id, matchStatus: 'matched' };
  const { kind } = contacts[0], row = object(person) ? person : contacts[0].row;
  return { name: typeof row.name === 'string' ? row.name : '', studentId: kind === 'student' ? row.id : null,
    matchStatus: kind === 'student' ? 'matched' : 'known-contact' };
}
function matchingStudents(state, phone) { return state.students.filter(s => phoneOf(s) === phone); }
function registeredPhones(state) {
  return [...new Set([...state.students, ...(state.consults || []), ...(state.inquiries || [])].map(phoneOf).filter(Boolean))];
}
function activeFlex(s) { return s.status === '수강중' && s.schedType === 'flex'; }
function realSlot(slot) { return !slot.absent && slot.overrideType !== 'cancel' && !slot.tentative; }
function scheduled(snapshot, id) { return Object.values(snapshot.slotsByKey).flat().some(s => s.s.id === id && realSlot(s)); }
function replied(owner, phone, info, now, studentId) {
  return owner.sql.exec("SELECT id FROM sms_messages WHERE phone=? AND student_id=? AND direction='received' AND received_at>=? AND received_at<=? LIMIT 1", phone, studentId, info.weekAt, now).toArray().length > 0;
}
function candidate(owner, state, snapshot, s, stage, info, now) {
  const phone = phoneOf(s);
  if (!activeFlex(s) || !phone || matchingStudents(state, phone).length !== 1 || scheduled(snapshot, s.id)) return null;
  if (s.st && (!Number.isFinite(dateMillis(s.st)) || s.st > snapshot.weekEnd)) return null;
  if (replied(owner, phone, info, now, s.id)) return null;
  return phone;
}
function enabledDevice(owner) {
  const device = owner.getKV('sms.device');
  if (!device?.tokenHash || !settings(owner).enabled) fail('sms-device-disabled', 409);
  return device;
}
export function initSmsTables(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS sms_calls (id TEXT PRIMARY KEY,device_id TEXT NOT NULL,event_id TEXT NOT NULL,payload_sha TEXT NOT NULL,phone TEXT NOT NULL,received_at INTEGER NOT NULL,status TEXT NOT NULL,UNIQUE(device_id,event_id))');
  sql.exec('CREATE INDEX IF NOT EXISTS sms_calls_recent ON sms_calls(received_at DESC,id DESC)');
  sql.exec('CREATE TABLE IF NOT EXISTS sms_events (device_id TEXT NOT NULL,event_id TEXT NOT NULL,payload_sha TEXT NOT NULL,content_sha TEXT NOT NULL,message_id TEXT NOT NULL,PRIMARY KEY(device_id,event_id))');
  sql.exec('CREATE INDEX IF NOT EXISTS sms_events_content ON sms_events(device_id,content_sha)');
  sql.exec('CREATE TABLE IF NOT EXISTS sms_messages (id TEXT PRIMARY KEY,phone TEXT NOT NULL,text TEXT NOT NULL,direction TEXT NOT NULL,received_at INTEGER NOT NULL,student_id TEXT,match_status TEXT NOT NULL,proposal_json TEXT NOT NULL,status TEXT NOT NULL,automation INTEGER NOT NULL DEFAULT 0)');
  sql.exec('CREATE INDEX IF NOT EXISTS sms_messages_phone ON sms_messages(phone,received_at)');
  sql.exec('CREATE TABLE IF NOT EXISTS sms_outbox (id TEXT PRIMARY KEY,device_id TEXT NOT NULL,student_id TEXT NOT NULL,phone TEXT NOT NULL,text TEXT NOT NULL,week_start TEXT NOT NULL,stage TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,claimed_at INTEGER,acked_at INTEGER,UNIQUE(week_start,stage,student_id))');
}
function cancelPending(owner, status = 'cancelled') { owner.sql.exec("UPDATE sms_outbox SET status=? WHERE status='pending'", status); }
function prepare(owner, stage, now, manual = false) {
  if (!['monday', 'tuesday'].includes(stage)) fail('sms-invalid-stage');
  const device = enabledDevice(owner), r = recordOf(owner), info = dayInfo(now), cfg = settings(owner);
  const stageDay = stage === 'monday' ? 1 : 2, [h, m] = cfg[stage + 'Time'].split(':').map(Number);
  // No later-day catchup; manual preparation is also limited to that stage's day.
  if (info.dow !== stageDay) { if (manual) fail('sms-stage-day-required', 409); return 0; }
  if (!manual && info.minute < h * 60 + m) return 0;
  const snapshot = scheduleSnapshot(r.state, info.date); let count = 0;
  owner.ctx.storage.transactionSync(() => {
    for (const s of r.state.students) {
      const phone = candidate(owner, r.state, snapshot, s, stage, info, now); if (!phone) continue;
      if (owner.sql.exec('SELECT id FROM sms_outbox WHERE week_start=? AND stage=? AND student_id=?', info.weekStart, stage, s.id).toArray().length) continue;
      const rendered = cfg[stage + 'Text'].replaceAll('{name}', String(s.name || ''));
      if (rendered.length > 4000 || !rendered.trim()) continue;
      owner.sql.exec('INSERT INTO sms_outbox(id,device_id,student_id,phone,text,week_start,stage,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        crypto.randomUUID(), device.id, s.id, phone, rendered, info.weekStart, stage, 'pending', now, info.dayEnd);
      count++;
    }
  });
  return count;
}
function recheckOutbox(owner, row, now) {
  const info = dayInfo(now), device = owner.getKV('sms.device'); let reason = '';
  if (!device?.tokenHash || !settings(owner).enabled || row.device_id !== device.id) reason = 'cancelled';
  else if (now >= row.expires_at || row.week_start !== info.weekStart) reason = 'expired';
  else {
    const r = recordOf(owner), s = r.state.students.find(s => s.id === row.student_id);
    const snapshot = scheduleSnapshot(r.state, info.date);
    if (!s || candidate(owner, r.state, snapshot, s, row.stage, info, now) !== row.phone) reason = 'suppressed';
  }
  if (reason) { owner.sql.exec("UPDATE sms_outbox SET status=? WHERE id=? AND status='pending'", reason, row.id); return false; }
  return true;
}
async function aliases(state) {
  const changes = [];
  for (const [kind, rows] of [['consult', state.consults || []], ['inquiry', state.inquiries || []]]) {
    for (const row of rows) {
      const phone = phoneOf(row); if (!phone || typeof row.id !== 'string') continue;
      const students = matchingStudents(state, phone); if (students.length !== 1) continue;
      const student = students[0], oldName = String(row.name || ''), newName = String(student.name || '').trim();
      if (!newName || oldName === newName) continue;
      const id = await smsHash(JSON.stringify([kind, row.id, phone, student.id, oldName, newName]));
      changes.push({ id, kind, oldName, newName, studentId: student.id, recordId: row.id });
    }
  }
  return changes;
}
async function overview(owner, now) {
  const r = recordOf(owner), info = dayInfo(now), snapshot = scheduleSnapshot(r.state, info.date), device = owner.getKV('sms.device');
  const messages = owner.sql.exec('SELECT * FROM sms_messages ORDER BY received_at DESC,id DESC LIMIT 300').toArray().map(row => {
    const matches = matchingStudents(r.state, row.phone), s = matches.length === 1 ? matches[0] : null;
    // A phone reassignment never rebinds an old card to a different student.
    const matched = s && s.id === row.student_id;
    return { id: row.id, phone: row.phone, text: row.text, direction: row.direction, receivedAt: row.received_at,
      studentId: matched ? s.id : null, name: matched ? s.name : '', matchStatus: matches.length > 1 ? 'ambiguous' : matched ? 'matched' : 'held',
      proposal: JSON.parse(row.proposal_json), status: row.status,
      confirmation: row.status === 'scheduled' ? owner.getKV('sms.confirmation.' + row.id) : null };
  });
  const outbox = owner.sql.exec('SELECT * FROM sms_outbox ORDER BY created_at DESC,id DESC LIMIT 300').toArray();
  for (const row of outbox) if (row.status === 'pending' && !recheckOutbox(owner, row, now)) row.status = owner.sql.exec('SELECT status FROM sms_outbox WHERE id=?', row.id).toArray()[0].status;
  return smsJSON({ ok: true, settings: settings(owner), device: { paired: !!device?.tokenHash, lastSeen: device?.lastSeen || null, relayOrigin: device?.relayOrigin || configuredOrigin(owner) },
    callSettings: callSettings(owner), calls: owner.sql.exec('SELECT * FROM sms_calls ORDER BY received_at DESC,id DESC LIMIT 200').toArray()
      .map(row => ({ id: row.id, phone: row.phone, receivedAt: row.received_at, ...callMatch(r.state, row.phone), status: row.status })),
    revision: r.revision, weekStart: info.weekStart,
    unassigned: r.state.students.filter(activeFlex).filter(s => !scheduled(snapshot, s.id)).map(s => ({ id: s.id, name: s.name, phone: phoneOf(s), replied: replied(owner, phoneOf(s), info, now, s.id), scheduled: false })),
    messages, outbox: outbox.map(row => ({ id: row.id, studentId: row.student_id, name: r.state.students.find(s => s.id === row.student_id)?.name || '',
      stage: row.stage, status: row.status, createdAt: row.created_at })), aliasChanges: (await aliases(r.state)).map(({ recordId, ...rest }) => rest) });
}
function nextRecord(r, state) {
  if (r.revision === Number.MAX_SAFE_INTEGER) fail('sms-revision-exhausted', 409);
  return { ...r, revision: r.revision + 1, state };
}
function confirm(owner, body, now) {
  fields(body, ['baseRevision', 'entries']); const r = recordOf(owner);
  if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision !== r.revision) fail('revision-conflict', 409);
  if (!Array.isArray(body.entries) || !body.entries.length || body.entries.length > 100) fail('sms-invalid-entries');
  const state = structuredClone(r.state), seenMessages = new Set(), seenSlots = new Set(), weeks = new Map(), targets = [];
  let intervalFailure = null;
  for (const entry of body.entries) {
    fields(entry, ['messageId', 'studentId', 'date', 'time']); validId(entry.messageId);
    const s = state.students.find(s => s.id === entry.studentId);
    if (!s || !activeFlex(s)) fail('sms-ineligible-student', 409);
    const row = owner.sql.exec('SELECT * FROM sms_messages WHERE id=?', entry.messageId).toArray()[0];
    const matches = matchingStudents(state, phoneOf(s));
    if (!row || row.status !== 'pending' || row.match_status !== 'matched' || row.student_id !== s.id || row.phone !== phoneOf(s) || matches.length !== 1) fail('sms-message-not-confirmable', 409);
    if (!Number.isFinite(dateMillis(entry.date)) || !validTime(entry.time) || Date.parse(`${entry.date}T${entry.time}:00+09:00`) <= now || (s.st && entry.date < s.st)) fail('sms-invalid-future-slot', 409);
    const key = JSON.stringify([s.id, entry.date, entry.time]);
    if (seenMessages.has(row.id) || seenSlots.has(key)) fail('sms-duplicate-confirmation', 409);
    seenMessages.add(row.id); seenSlots.add(key);
    const before = scheduleSnapshot(r.state, entry.date), day = DAYS[new Date(dateMillis(entry.date)).getUTCDay()], wk = before.weekKey;
    weeks.set(wk, entry.date);
    targets.push({ entry, weekKey: wk, key: `${day}_${entry.time}` });
    const original = before.slotsByKey[`${day}_${entry.time}`] || [];
    if (original.some(sl => sl.s.id === s.id)) fail('sms-existing-or-cancelled-slot', 409);
    state.weekOvr ||= {};
    if (Object.hasOwn(state.weekOvr, wk) && !object(state.weekOvr[wk])) fail('sms-invalid-overrides', 409);
    const ov = state.weekOvr[wk] ||= {};
    if (Object.hasOwn(ov, s.id) && !Array.isArray(ov[s.id])) fail('sms-invalid-overrides', 409);
    if (!Object.hasOwn(ov, s.id)) {
      // Seed from the original engine so linked confirmations, cancellations and metadata survive.
      ov[s.id] = Object.values(before.slotsByKey).flat().filter(sl => sl.s.id === s.id && sl.type !== 'consult-sched').map(sl => ({
        day: sl.day, time: sl.time, absent: sl.absent, source: sl.source, overrideType: sl.overrideType, makeupOf: sl.makeupOf,
      }));
    }
    if (!intervalFailure) {
      try { assertScheduleIntervalAvailable(state, { date: entry.date, time: entry.time, studentId: s.id }, now); }
      catch (error) {
        const start = Number(entry.time.slice(0, 2)) * 60 + Number(entry.time.slice(3));
        const names = Object.entries(scheduleSnapshot(state, entry.date).slotsByKey).flatMap(([key, slots]) => slots.filter(slot => {
          const time = validTime(slot.time) ? slot.time : Array.isArray(slot.time) && slot.time.length === 1 && validTime(slot.time[0]) && key === slot.day + '_' + slot.time[0] ? slot.time[0] : '';
          if (slot.date !== entry.date || !realSlot(slot) || !time) return false;
          const at = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
          return start < at + 60 && start + 60 > at;
        })).map(slot => String(slot.s.name || ''));
        intervalFailure = { error, entry, names: [...new Set(names)].filter(Boolean) };
      }
    }
    ov[s.id].push({ day, time: entry.time, absent: false, source: 'sms-confirmed', smsMessageId: row.id });
  }
  // Original engine owns self/group/cancel/tentative semantics, including weeks beyond the current view.
  const conflicts = []; let newConflictCount = 0;
  // The engine groups slots by this canonical string key. Legacy slot times may
  // be arrays, so raw conflict.time/date equality cannot decide whether to block.
  const conflictKey = c => JSON.stringify([c.key, [...c.studentIds].sort()]);
  for (const date of weeks.values()) {
    const before = scheduleSnapshot(r.state, date), after = scheduleSnapshot(state, date);
    const existing = new Set(before.conflicts.map(conflictKey));
    for (const conflict of after.conflicts.filter(c => !existing.has(conflictKey(c)))) {
      newConflictCount++;
      for (const { entry: e } of targets.filter(target => target.weekKey === after.weekKey && target.key === conflict.key && conflict.studentIds.includes(target.entry.studentId))) {
        const prior = conflicts.find(c => c.date === e.date && c.time === e.time && c.studentId === e.studentId);
        const otherNames = conflict.names.filter((_, i) => conflict.studentIds[i] !== e.studentId).map(String);
        if (prior) prior.otherNames = [...new Set([...prior.otherNames, ...otherNames])];
        else conflicts.push({ date: e.date, time: e.time, studentId: e.studentId, otherNames });
      }
    }
  }
  // Failure to format a new conflict never grants permission to commit it.
  if (newConflictCount) fail('sms-schedule-conflict', 409, { conflicts,
    conflict: conflicts.length ? { date: conflicts[0].date, time: conflicts[0].time, names: conflicts[0].otherNames } : null });
  if (intervalFailure) {
    const { error, entry: e, names } = intervalFailure;
    if (error.code === 'schedule-interval-conflict') fail('sms-schedule-conflict', 409, {
      conflicts: [{ date: e.date, time: e.time, studentId: e.studentId, otherNames: names }],
      conflict: names.length ? { date: e.date, time: e.time, names } : null,
    });
    fail(error.code || 'sms-schedule-unavailable', error.status || 409);
  }
  const next = nextRecord(r, state);
  owner.ctx.storage.transactionSync(() => {
    if (owner.record()?.revision !== body.baseRevision) fail('revision-conflict', 409);
    owner.setKV('record', next);
    for (const e of body.entries) {
      owner.sql.exec("UPDATE sms_messages SET status='scheduled' WHERE id=? AND status='pending'", e.messageId);
      owner.setKV('sms.confirmation.' + e.messageId, { date: e.date, time: e.time, studentId: e.studentId });
    }
  });
  owner.broadcast(next); return smsJSON({ ok: true, revision: next.revision, count: body.entries.length });
}
async function pair(owner, body, now) {
  fields(body, ['relayOrigin']); text(body.relayOrigin, 300); let origin;
  if (!configuredOrigin(owner)) fail('sms-relay-origin-unconfigured', 409);
  try { origin = new URL(body.relayOrigin); } catch { fail('sms-invalid-relay-origin'); }
  const local = owner.env.ENVIRONMENT === 'local-test' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || (!local && (origin.protocol !== 'https:' || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev$/.test(origin.hostname))) ||
      (local && !['http:', 'https:'].includes(origin.protocol))) fail('sms-invalid-relay-origin');
  if (origin.origin !== configuredOrigin(owner)) fail('sms-relay-origin-mismatch', 409);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = 'vssms_' + btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const tokenHash = await smsHash(token), id = crypto.randomUUID();
  const disabled = disabledSettings(owner);
  owner.ctx.storage.transactionSync(() => {
    cancelPending(owner);
    owner.setKV('sms.device', { id, tokenHash, pairedAt: now, lastSeen: null, relayOrigin: origin.origin });
    owner.setKV('sms.settings', disabled);
    owner.setKV('sms.callSettings', { ...CALL_DEFAULTS });
  });
  return smsJSON({ ok: true, token, deviceId: id, relayOrigin: origin.origin });
}
function configuredOrigin(owner) {
  try {
    const value = String(owner.env.SMS_RELAY_ORIGIN || '').trim(), u = new URL(value);
    const local = owner.env.ENVIRONMENT === 'local-test' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) && ['http:', 'https:'].includes(u.protocol);
    const production = u.protocol === 'https:' && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev$/.test(u.hostname) && !u.port;
    return !u.username && !u.password && !u.search && !u.hash && u.pathname === '/' && (local || production) ? u.origin : '';
  } catch { return ''; }
}
export async function handleSmsOwner(owner, request) {
  try {
    if (!request.headers.get('X-VS-Principal')) fail('sms-owner-required', 401);
    const path = new URL(request.url).pathname, now = Date.now();
    if (path === '/sms/overview' && request.method === 'GET') return await overview(owner, now);
    if (request.method !== 'POST') fail('sms-method-not-allowed', 405);
    const body = await readSmsBody(request);
    if (path === '/sms/pair') return await pair(owner, body, now);
    if (path === '/sms/revoke') {
      fields(body, []); const disabled = disabledSettings(owner);
      owner.ctx.storage.transactionSync(() => { cancelPending(owner); owner.setKV('sms.device', null); owner.setKV('sms.settings', disabled); owner.setKV('sms.callSettings', { ...CALL_DEFAULTS }); });
      return smsJSON({ ok: true });
    }
    if (path === '/sms/settings') {
      validateSettings(body);
      if (body.enabled) { recordOf(owner); if (!owner.getKV('sms.device')?.tokenHash) fail('sms-unpaired', 409); }
      owner.ctx.storage.transactionSync(() => { owner.setKV('sms.settings', body); if (!body.enabled) cancelPending(owner); });
      return smsJSON({ ok: true });
    }
    if (path === '/sms/call-settings') {
      const next = validateCallSettings(body);
      if (next.enabled) { recordOf(owner); if (!owner.getKV('sms.device')?.tokenHash) fail('sms-unpaired', 409); }
      owner.setKV('sms.callSettings', next); return smsJSON({ ok: true });
    }
    if (path === '/sms/call-dismiss') {
      fields(body, ['callId']); validId(body.callId);
      if (!owner.sql.exec('SELECT id FROM sms_calls WHERE id=?', body.callId).toArray().length) fail('sms-call-not-found', 404);
      owner.sql.exec("UPDATE sms_calls SET status='acknowledged' WHERE id=?", body.callId); return smsJSON({ ok: true });
    }
    if (path === '/sms/call-inquiry') return registerCallInquiry(owner, body, now);
    if (path === '/sms/options') {
      fields(body, ['baseRevision', 'messageId', 'studentId', 'date', 'startTime', 'endTime', 'preferredTime']);
      validId(body.messageId); validId(body.studentId);
      const r = recordOf(owner);
      if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision !== r.revision) fail('revision-conflict', 409);
      const student = r.state.students.find(s => s.id === body.studentId), row = owner.sql.exec('SELECT * FROM sms_messages WHERE id=?', body.messageId).toArray()[0];
      if (!student || !activeFlex(student) || !row || row.status !== 'pending' || row.match_status !== 'matched' || row.student_id !== student.id ||
        row.phone !== phoneOf(student) || matchingStudents(r.state, row.phone).length !== 1) fail('sms-message-not-confirmable', 409);
      if (student.st && body.date < student.st) fail('sms-invalid-future-slot', 409);
      const result = rankScheduleOptions(r.state, { date: body.date, startTime: body.startTime, endTime: body.endTime,
        ...(body.preferredTime === undefined ? {} : { preferredTime: body.preferredTime }), limit: 12 }, now);
      const original = scheduleSnapshot(r.state, body.date);
      const active = Object.values(original.slotsByKey).flat().filter(slot => slot.date === body.date && realSlot(slot));
      const candidates = result.options.filter(option => {
        const key = DAYS[new Date(dateMillis(option.date)).getUTCDay()] + '_' + option.time;
        if ((original.slotsByKey[key] || []).some(slot => slot.s.id === student.id)) return false;
        const start = Number(option.time.slice(0, 2)) * 60 + Number(option.time.slice(3));
        return !active.some(slot => {
          if (!validTime(slot.time)) return true; // No invented availability from engine coercion.
          const at = Number(slot.time.slice(0, 2)) * 60 + Number(slot.time.slice(3));
          return start < at + 60 && start + 60 > at;
        });
      });
      const options = candidates.slice(0, 6);
      const warnings = result.warnings.slice();
      if (candidates.length !== result.options.length) warnings.push('기존 일정과 겹치거나 이미 등록·취소된 본인 일정과 같은 시간은 새 일정으로 추천하지 않습니다.');
      return smsJSON({ ok: true, revision: r.revision, messageId: row.id, options, warnings });
    }
    if (path === '/sms/prepare') { fields(body, ['stage']); return smsJSON({ ok: true, count: prepare(owner, body.stage, now, true) }); }
    if (path === '/sms/confirm') return confirm(owner, body, now);
    if (path === '/sms/dismiss') {
      fields(body, ['messageId']); validId(body.messageId);
      if (!owner.sql.exec('SELECT id FROM sms_messages WHERE id=?', body.messageId).toArray().length) fail('sms-message-not-found', 404);
      owner.sql.exec("UPDATE sms_messages SET status='dismissed' WHERE id=? AND status='pending'", body.messageId); return smsJSON({ ok: true });
    }
    if (path === '/sms/alias') {
      fields(body, ['aliasId']); const r = recordOf(owner), change = (await aliases(r.state)).find(c => c.id === body.aliasId);
      if (!change) fail('sms-alias-stale-or-ambiguous', 409);
      const state = structuredClone(r.state), rows = state[change.kind === 'consult' ? 'consults' : 'inquiries'];
      const matches = rows.filter(row => row.id === change.recordId); if (matches.length !== 1) fail('sms-alias-ambiguous', 409);
      matches[0].name = change.newName;
      const next = nextRecord(r, state);
      owner.ctx.storage.transactionSync(() => { if (owner.record()?.revision !== r.revision) fail('revision-conflict', 409); owner.setKV('record', next); });
      owner.broadcast(next); return smsJSON({ ok: true, revision: next.revision });
    }
    fail('sms-not-found', 404);
  } catch (e) { return smsJSON({ error: e.status ? e.message : 'sms-storage-unavailable', ...(e.status ? e.detail : {}) }, e.status || 503); }
}
function registerCallInquiry(owner, body, now) {
  fields(body, ['callId', 'baseRevision', 'name', 'memo']); validId(body.callId);
  text(body.name, 80); text(body.memo, 500, false);
  if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0) fail('revision-conflict', 409);
  const payload = JSON.stringify([body.name, body.memo]), receiptKey = 'sms.callInquiry.' + body.callId;
  const prior = owner.getKV(receiptKey);
  if (prior) {
    if (prior.payload !== payload) fail('sms-call-inquiry-conflict', 409);
    return smsJSON({ ok: true, revision: prior.revision, inquiryId: prior.inquiryId, duplicate: true });
  }
  const r = recordOf(owner);
  if (r.revision !== body.baseRevision) fail('revision-conflict', 409);
  const call = owner.sql.exec('SELECT * FROM sms_calls WHERE id=?', body.callId).toArray()[0];
  if (!call) fail('sms-call-not-found', 404);
  if (registeredPhones(r.state).includes(call.phone)) fail('sms-call-contact-exists', 409);
  const state = structuredClone(r.state), inquiryId = 'call_' + call.id;
  if ((state.inquiries || []).some(row => row?.id === inquiryId)) fail('sms-call-inquiry-conflict', 409);
  // Same schema as the host's manual saveInquiry. Name is supplied explicitly by the owner.
  const inquiry = { id: inquiryId, name: body.name.trim(), phone: call.phone, memo: body.memo.trim(),
    visitDate: '', visitTime: '', date: dayInfo(now).date };
  state.inquiries = [inquiry, ...(state.inquiries || [])];
  const next = nextRecord(r, state);
  owner.ctx.storage.transactionSync(() => {
    if (owner.record()?.revision !== body.baseRevision) fail('revision-conflict', 409);
    owner.setKV('record', next);
    owner.setKV(receiptKey, { payload, revision: next.revision, inquiryId });
    owner.sql.exec("UPDATE sms_calls SET status='acknowledged' WHERE id=?", body.callId);
  });
  owner.broadcast(next); return smsJSON({ ok: true, revision: next.revision, inquiryId, duplicate: false });
}
function currentDevice(owner, device) {
  const current = owner.getKV('sms.device');
  if (!current?.tokenHash || current.id !== device.id || current.tokenHash !== device.tokenHash) fail('sms-device-auth-required', 401);
  return current;
}
async function callEvent(owner, device, body, now) {
  fields(body, ['id', 'phone', 'receivedAt', 'direction']); validId(body.id);
  const phone = normalizePhone(body.phone), at = body.receivedAt;
  if (!phone || typeof at !== 'number' || !Number.isSafeInteger(at) || at <= 0 || at > now || body.direction !== 'incoming') fail('sms-invalid-call');
  const payload = await smsHash(JSON.stringify([body.id, body.phone, at, body.direction]));
  let duplicate = false, id;
  owner.ctx.storage.transactionSync(() => {
    const current = currentDevice(owner, device), cfg = callSettings(owner), r = recordOf(owner);
    if (!cfg.enabled) fail('sms-call-disabled', 409);
    if (at < current.pairedAt) fail('sms-historical-call', 409);
    const known = registeredPhones(r.state).includes(phone);
    if (!known && cfg.includeUnknown !== true) fail('sms-call-phone-denied', 409);
    const prior = owner.sql.exec('SELECT * FROM sms_calls WHERE device_id=? AND event_id=?', current.id, body.id).toArray()[0];
    if (prior) {
      if (prior.payload_sha !== payload) fail('sms-call-id-conflict', 409);
      duplicate = true; id = prior.id;
    } else {
      id = crypto.randomUUID();
      owner.sql.exec('INSERT INTO sms_calls(id,device_id,event_id,payload_sha,phone,received_at,status) VALUES(?,?,?,?,?,?,?)',
        id, current.id, body.id, payload, phone, at, 'pending');
    }
    owner.setKV('sms.device', { ...current, lastSeen: now });
  });
  return smsJSON({ ok: true, callId: id, duplicate });
}
async function event(owner, device, body, now) {
  fields(body, ['id', 'phone', 'text', 'receivedAt', 'direction']); validId(body.id); text(body.text, 4000);
  const phone = normalizePhone(body.phone), at = timestamp(body.receivedAt);
  if (!phone || !['received', 'sent'].includes(body.direction) || at > now) fail('sms-invalid-event');
  const payload = await smsHash(JSON.stringify([body.id, body.phone, body.text, body.receivedAt, body.direction]));
  const receipt = owner.sql.exec('SELECT * FROM sms_events WHERE device_id=? AND event_id=?', device.id, body.id).toArray()[0];
  if (receipt) {
    if (receipt.payload_sha !== payload) fail('sms-event-id-conflict', 409);
    return smsJSON({ ok: true, matched: owner.sql.exec('SELECT match_status FROM sms_messages WHERE id=?', receipt.message_id).toArray()[0]?.match_status === 'matched', duplicate: true });
  }
  // The pairing boundary forbids historical imports, including after a token rotation.
  if (at < device.pairedAt) fail('sms-historical-event', 409);
  const r = recordOf(owner);
  if (!registeredPhones(r.state).includes(phone)) return smsJSON({ ok: true, matched: false, duplicate: false });
  const content = await smsHash(JSON.stringify([phone, body.text, at, body.direction]));
  const duplicate = owner.sql.exec('SELECT message_id FROM sms_events WHERE device_id=? AND content_sha=? LIMIT 1', device.id, content).toArray()[0];
  const students = matchingStudents(r.state, phone), s = students.length === 1 ? students[0] : null;
  const id = duplicate?.message_id || crypto.randomUUID();
  const automation = body.direction === 'sent' && owner.sql.exec("SELECT id FROM sms_outbox WHERE device_id=? AND phone=? AND text=? AND claimed_at>=? AND claimed_at<=? AND status IN ('claimed','sent','unknown') LIMIT 1",
    device.id, phone, body.text, at - 10 * 60000, at + 300000).toArray().length ? 1 : 0;
  owner.ctx.storage.transactionSync(() => {
    owner.sql.exec('INSERT INTO sms_events(device_id,event_id,payload_sha,content_sha,message_id) VALUES(?,?,?,?,?)', device.id, body.id, payload, content, id);
    if (!duplicate) owner.sql.exec('INSERT INTO sms_messages(id,phone,text,direction,received_at,student_id,match_status,proposal_json,status,automation) VALUES(?,?,?,?,?,?,?,?,?,?)',
      id, phone, body.text, body.direction, at, s?.id || null, students.length > 1 ? 'ambiguous' : s ? 'matched' : 'held',
      JSON.stringify(proposeSchedule(body.text, at)), 'pending', automation);
  });
  return smsJSON({ ok: true, matched: !!s, duplicate: !!duplicate });
}
export async function handleSmsDevice(owner, request) {
  try {
    const url = new URL(request.url), path = url.pathname.replace(/^\/sms-device\//, '/device/');
    if (!Object.hasOwn(DEVICE_ROUTES, path) || request.method !== DEVICE_ROUTES[path] || url.search) fail('sms-device-route-denied', 404);
    const token = deviceBearer(request), device = owner.getKV('sms.device');
    if (!device?.tokenHash || await smsHash(token) !== device.tokenHash) fail('sms-device-auth-required', 401);
    currentDevice(owner, device);
    const now = Date.now(), body = request.method === 'POST' ? await readSmsBody(request) : null;
    const current = currentDevice(owner, device);
    if (path === '/device/call') return await callEvent(owner, device, body, now);
    owner.setKV('sms.device', { ...current, lastSeen: now });
    if (path === '/device/event') return await event(owner, device, body, now);
    if (path === '/device/pull') {
      recordOf(owner);
      owner.sql.exec("UPDATE sms_outbox SET status='expired' WHERE status='pending' AND expires_at<=?", now);
      if (settings(owner).enabled) {
        const info = dayInfo(now); if (info.dow === 1 || info.dow === 2) prepare(owner, info.dow === 1 ? 'monday' : 'tuesday', now);
      } else cancelPending(owner);
      const rows = owner.sql.exec("SELECT * FROM sms_outbox WHERE status='pending' AND device_id=? ORDER BY created_at,id LIMIT 100", device.id).toArray();
      const messages = rows.filter(row => recheckOutbox(owner, row, now)).map(row => ({ id: row.id, phone: row.phone, text: row.text }));
      const allowedPhoneHashes = await Promise.all(registeredPhones(recordOf(owner).state).map(smsHash));
      currentDevice(owner, device);
      return smsJSON({ ok: true, deviceId: device.id, allowedPhoneHashes, messages, callIntake: callSettings(owner), serverTime: now });
    }
    fields(body, path === '/device/claim' ? ['id'] : ['id', 'status', 'error']); validId(body.id);
    const row = owner.sql.exec('SELECT * FROM sms_outbox WHERE id=? AND device_id=?', body.id, device.id).toArray()[0];
    if (!row) fail('sms-outbox-not-found', 404);
    if (path === '/device/claim') {
      if (row.status !== 'pending') fail('sms-outbox-not-pending', 409);
      let eligible;
      owner.ctx.storage.transactionSync(() => { eligible = recheckOutbox(owner, row, now); if (eligible) owner.sql.exec("UPDATE sms_outbox SET status='claimed',claimed_at=? WHERE id=? AND status='pending'", now, row.id); });
      if (!eligible) fail('sms-outbox-suppressed', 409);
      return smsJSON({ ok: true, message: { id: row.id, phone: row.phone, text: row.text } });
    }
    if (!['sent', 'failed', 'unknown'].includes(body.status)) fail('sms-invalid-ack');
    if (body.error !== undefined) text(body.error, 160, false); // Never persist modem errors containing contacts/secrets.
    if (row.status === body.status) return smsJSON({ ok: true });
    if (row.status !== 'claimed') fail('sms-ack-conflict', 409);
    owner.sql.exec("UPDATE sms_outbox SET status=?,acked_at=? WHERE id=? AND status='claimed'", body.status, now, row.id);
    return smsJSON({ ok: true });
  } catch (e) { return smsJSON({ error: e.status ? e.message : 'sms-storage-unavailable' }, e.status || 503); }
}
