import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSnapshot } from '../worker/schedule-core.generated.mjs';
import { rankScheduleOptions, assertScheduleIntervalAvailable } from '../worker/schedule-options.mjs';

const DATE = '2026-10-07', NOW = Date.parse('2026-10-04T00:00:00Z');
const WINDOW = { date: DATE, startTime: '12:00', endTime: '20:00', limit: 12 };
const flex = (id, extra = {}) => ({ id, name: `PRIVATE_${id}`, status: '수강중', schedType: 'flex', ...extra });
const fixed = (id, time, extra = {}) => flex(id, { schedType: 'fixed', days: ['수'], times: { 수: time }, ...extra });
const stateOf = (students = [], extra = {}) => ({ students, consults: [], inquiries: [], weekOvr: {}, ...extra });
const rank = (state, options = {}, now = NOW) => rankScheduleOptions(state, { ...WINDOW, ...options }, now);
const times = result => result.options.map(option => option.time);
const code = (value, status) => error => error instanceof Error && error.code === value && error.message === value && error.status === status;
const confirm = (state, time, studentId = 'new', date = DATE, now = NOW) => assertScheduleIntervalAvailable(state, { date, time, studentId }, now);
function override(state, entries) {
  state.weekOvr[scheduleSnapshot(state, DATE).weekKey] = entries;
  return state;
}
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

test('real Wednesday 13:00 and 18:00 lessons rank 14:00/17:00 ahead of middle 15:00 and exclude 30-minute overlaps', () => {
  const state = stateOf([fixed('early', '13:00'), fixed('late', '18:00')]);
  const snapshot = scheduleSnapshot(state, DATE);
  assert.deepEqual(Object.keys(snapshot.slotsByKey).sort(), ['수_13:00', '수_18:00']);
  const result = rank(state);
  assert.deepEqual(times(result).slice(0, 2), ['14:00', '17:00']);
  for (const attached of ['12:00', '14:00', '17:00', '19:00']) assert.ok(times(result).indexOf(attached) < times(result).indexOf('15:00'));
  for (const blocked of ['12:30', '13:00', '13:30', '17:30', '18:00', '18:30']) assert.ok(!times(result).includes(blocked), blocked);
  assert.deepEqual(result.warnings, []);
});

test('exact valid preference remains first; collision/out-of-window preferences never invent availability', () => {
  const state = stateOf([fixed('early', '13:00'), fixed('late', '18:00')]);
  assert.equal(rank(state, { preferredTime: '15:00' }).options[0].time, '15:00');
  assert.equal(rank(state, { preferredTime: '15:00', limit: 1 }).options[0].reason, '요청한 시간이 가능해요.');
  for (const preferredTime of ['15:15', '15:10']) {
    assert.equal(rank(state, { preferredTime, limit: 1 }).options[0].time, preferredTime);
    assert.deepEqual(confirm({ ...state, students: [...state.students, flex('new')] }, preferredTime), { date: DATE, time: preferredTime });
  }
  for (const preferredTime of ['13:30', '11:00', '19:30']) {
    const result = rank(state, { preferredTime });
    assert.ok(!times(result).includes(preferredTime));
    assert.equal(result.warnings.length, 1);
  }
});

test('touching both neighbors wins before touching one and scoring uses occupied union, not group member count', () => {
  const state = stateOf([fixed('a', '13:00'), fixed('b', '15:00'), fixed('c', '18:00')]);
  assert.equal(rank(state).options[0].time, '14:00');
  const grouped = structuredClone(state);
  for (const student of grouped.students) Object.assign(student, { sharedSlot: true, lessonType: 'group', groupId: student.id });
  grouped.students.push({ ...grouped.students[0], id: 'a2', groupId: 'a' }, { ...grouped.students[0], id: 'a3', groupId: 'a' });
  assert.deepEqual(rank(grouped), rank(state));
});

test('owner window bounds fit the whole lesson, round starts onto 30-minute grid and end at most 24:00', () => {
  assert.deepEqual(times(rank(stateOf(), { startTime: '13:10', endTime: '15:10' })), ['13:30', '14:00']);
  assert.deepEqual(times(rank(stateOf(), { startTime: '22:00', endTime: '24:00' })), ['22:00', '22:30', '23:00']);
  assert.deepEqual(times(rank(stateOf(), { startTime: '23:00', endTime: '24:00' })), ['23:00']);
  assert.deepEqual(times(rank(stateOf(), { startTime: '15:00', endTime: '16:00' })), ['15:00']);
  assert.deepEqual(rank(stateOf(), { startTime: '15:01', endTime: '16:01' }).options, []);
  assert.throws(() => rank(stateOf(), { startTime: '15:00', endTime: '15:59' }), code('schedule-invalid-window', 400));
  assert.throws(() => rank(stateOf(), { startTime: '18:00', endTime: '17:00' }), code('schedule-invalid-window', 400));
  assert.throws(() => rank(stateOf(), { startTime: '24:00', endTime: '24:00' }), code('schedule-invalid-time', 400));
});

test('ranking uses conservative 60 minutes for standard 50-minute lessons, pro lessons and consultations', () => {
  for (const cls of ['standard', 'pro']) {
    const state = stateOf([fixed('peer', '13:00', { cls, durationMinutes: 50 })]);
    assert.ok(!times(rank(state)).includes('13:30'));
    assert.ok(times(rank(state)).includes('14:00'));
  }
  const state = stateOf([flex('new')], { consults: [{ id: 'consult', name: 'PRIVATE_CONSULT', confirmedDates: [{ date: DATE, time: '13:30' }] }] });
  assert.equal(scheduleSnapshot(state, DATE).slotsByKey['수_13:30'][0].type, 'consult-sched');
  for (const time of ['13:00', '13:30', '14:00']) assert.throws(() => confirm(state, time), code('schedule-interval-conflict', 409));
  assert.deepEqual(confirm(state, '12:30'), { date: DATE, time: '12:30' });
  assert.deepEqual(confirm(state, '14:30'), { date: DATE, time: '14:30' });
});

test('confirmed flex and converted linked consultation dates override recurring weekdays in the real engine', () => {
  const consult = { id: 'converted', converted: true, confirmedDates: [{ date: DATE, time: '16:30' }] };
  const state = stateOf([fixed('linked', '13:00', { consultData: { id: 'converted' }, confirmedDates: [{ date: DATE, time: '12:00' }] }),
    flex('flex', { confirmedDates: [{ date: DATE, time: '18:00' }] }), flex('new')], { consults: [consult] });
  assert.deepEqual(Object.keys(scheduleSnapshot(state, DATE).slotsByKey).sort(), ['수_16:30', '수_18:00']);
  assert.ok(times(rank(state)).includes('13:00'));
  for (const time of ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30']) assert.throws(() => confirm(state, time), code('schedule-interval-conflict', 409));
});

test('week overrides win, cancellation/absence/tentative entries never block, including malformed inactive times', () => {
  const state = override(stateOf([fixed('cancel', '13:00'), fixed('absent', '14:00'), fixed('tentative', '15:00'), flex('new')]), {
    cancel: [{ day: '수', time: ['13:00'], overrideType: 'cancel' }],
    absent: [{ day: '수', time: null, absent: true }],
    tentative: [{ day: '수', time: ['15:00'], tentative: true }],
  });
  for (const time of ['13:00', '14:00', '15:00']) assert.deepEqual(confirm(state, time), { date: DATE, time });
  assert.deepEqual(times(rank(state)), times(rank(stateOf())));
  state.weekOvr[scheduleSnapshot(state, DATE).weekKey].cancel = [{ day: '수', time: '17:00' }];
  assert.ok(times(rank(state)).includes('13:00'));
  assert.throws(() => confirm(state, '16:30'), code('schedule-interval-conflict', 409));
});

test('tentative inquiry visits and held consultations do not block', () => {
  const state = stateOf([flex('new')], {
    inquiries: [{ id: 'inquiry', name: 'PRIVATE_INQUIRY', visitDate: DATE, visitTime: ['14:00'] }],
    consults: [{ id: 'hold', hold: true, firstDate: DATE, firstTime: ['15:00'] }],
  });
  assert.ok(Object.values(scheduleSnapshot(state, DATE).slotsByKey).flat().some(slot => slot.tentative));
  for (const time of ['13:00', '14:00', '15:00', '16:00']) assert.deepEqual(confirm(state, time), { date: DATE, time });
});

test('confirmed-date flags follow the original engine active occupancy, while weekly cancellation stays free', () => {
  for (const flag of [{ absent: true }, { overrideType: 'cancel' }, { kind: 'cancel' }, { tentative: true }]) {
    for (const kind of ['student', 'consult', 'linked']) {
      const dates = [{ date: DATE, time: '15:00', ...flag }];
      const state = stateOf([flex('new')]);
      if (kind === 'student') state.students.push(fixed('peer', '13:00', { confirmedDates: dates }));
      if (kind === 'consult') state.consults.push({ id: 'peer', name: 'PRIVATE_peer', confirmedDates: dates });
      if (kind === 'linked') {
        state.students.push(fixed('peer', '13:00', { consultData: { id: 'linked' } }));
        state.consults.push({ id: 'linked', converted: true, confirmedDates: dates });
      }
      const before = structuredClone(state), original = scheduleSnapshot(state, DATE);
      const actual = original.slotsByKey['수_15:00'][0];
      assert.equal(actual.absent, false); assert.equal(actual.overrideType, ''); assert.ok(!actual.tentative);
      assert.equal(original.slotsByKey['수_13:00'], undefined);
      deepFreeze(state);
      for (const time of ['14:30', '15:00', '15:30']) {
        assert.ok(!times(rank(state)).includes(time), `${kind}/${JSON.stringify(flag)}/${time}`);
        assert.throws(() => confirm(state, time), code('schedule-interval-conflict', 409));
      }
      assert.deepEqual(confirm(state, '16:00'), { date: DATE, time: '16:00' });
      assert.deepEqual(state, before); assert.deepEqual(scheduleSnapshot(state, DATE), original);
    }
  }
  const canceled = override(stateOf([fixed('peer', '15:00'), flex('new')]), {
    peer: [{ day: '수', time: '15:00', absent: true, overrideType: 'cancel' }],
  });
  assert.equal(scheduleSnapshot(canceled, DATE).slotsByKey['수_15:00'][0].absent, true);
  assert.ok(times(rank(canceled)).includes('15:00'));
  assert.deepEqual(confirm(canceled, '15:00'), { date: DATE, time: '15:00' });
});

test('ranking excludes self intervals while confirmation only shares exact same-group keys with different students', () => {
  const state = stateOf([fixed('peer', '13:00', { groupId: 'shared', lessonType: 'group' }),
    flex('new', { groupId: 'shared', lessonType: 'group' })]);
  assert.deepEqual(confirm(state, '13:00'), { date: DATE, time: '13:00' });
  assert.ok(!times(rank(state)).includes('13:00'));
  assert.throws(() => confirm(state, '13:30'), code('schedule-interval-conflict', 409));
  assert.throws(() => confirm(state, '13:00', 'peer'), code('schedule-interval-conflict', 409));
  state.students[1].groupId = 'different';
  assert.throws(() => confirm(state, '13:00'), code('schedule-interval-conflict', 409));
  delete state.students[1].groupId; state.students[1].schedType = 'fixed'; state.students[1].days = ['수']; state.students[1].times = { 수: '15:00' };
  assert.throws(() => confirm(state, '15:30'), code('schedule-interval-conflict', 409));
});

test('group metadata in consultData uses engine identity; multiple peers require every overlapping slot to be compatible', () => {
  const state = stateOf([fixed('peer', '13:00', { consultData: { lessonType: 'group', groupId: 'shared' } }),
    flex('new', { consultData: { lessonType: 'group', groupId: 'shared' } })]);
  assert.deepEqual(confirm(state, '13:00'), { date: DATE, time: '13:00' });
  state.students.push(fixed('solo', '13:30'));
  assert.throws(() => confirm(state, '13:00'), code('schedule-interval-conflict', 409));
});

test('confirmation alone reads canonical single-array legacy intervals while preserving ordinary/group compatibility and stored data', () => {
  const peer = flex('peer', { groupId: 'g', sharedSlot: true });
  const target = flex('new', { groupId: 'g', sharedSlot: true });
  const legacy = { day: '수', time: ['15:00'], absent: false, source: 'legacy-sms', arbitrary: { retain: true } };
  const state = override(stateOf([peer, target]), { peer: [legacy] });
  const before = structuredClone(state), slot = scheduleSnapshot(state, DATE).slotsByKey['수_15:00'][0];
  assert.deepEqual(slot.time, ['15:00']); assert.equal(slot.groupId, 'g'); assert.equal(slot.sharedSlot, true);
  deepFreeze(state);
  assert.deepEqual(confirm(state, '15:00'), { date: DATE, time: '15:00' });
  assert.deepEqual(rank(state).options, []);
  assert.throws(() => confirm(state, ['15:00']), code('schedule-invalid-time', 400));
  assert.throws(() => confirm(state, '15:00', 'peer'), code('schedule-interval-conflict', 409));
  assert.deepEqual(state, before);
  assert.deepEqual(scheduleSnapshot(state, DATE).slotsByKey['수_15:00'][0].time, ['15:00']);

  for (const groupId of ['other', undefined]) {
    const different = structuredClone(before); different.students[1].groupId = groupId;
    assert.throws(() => confirm(different, '15:00'), code('schedule-interval-conflict', 409));
    assert.throws(() => confirm(different, '15:30'), code('schedule-interval-conflict', 409));
    assert.deepEqual(confirm(different, '17:00'), { date: DATE, time: '17:00' });
    assert.deepEqual(different.weekOvr, before.weekOvr);
  }
  for (const time of ['14:30', '15:30']) assert.throws(() => confirm(state, time), code('schedule-interval-conflict', 409));
  assert.deepEqual(confirm(state, '17:00'), { date: DATE, time: '17:00' });
  for (const bad of [['15:00', '15:30'], [['15:00']], ['15:00 '], [], null]) {
    const malformed = structuredClone(before); malformed.weekOvr[scheduleSnapshot(malformed, DATE).weekKey].peer[0].time = bad;
    assert.throws(() => confirm(malformed, '15:00'), code('schedule-unknown-occupancy', 409));
  }
  const otherMalformed = structuredClone(before);
  otherMalformed.students.push(fixed('other-malformed', ['18:00', '18:30']));
  assert.throws(() => confirm(otherMalformed, '15:00'), code('schedule-unknown-occupancy', 409));
});

test('pre-existing unrelated exact-key or 30-minute conflicts remain compatible when new candidate is free', () => {
  const state = stateOf([fixed('old-a', '13:00'), fixed('old-b', '13:00'), fixed('old-c', '13:30'), flex('new')]);
  assert.equal(scheduleSnapshot(state, DATE).conflicts.length, 1);
  assert.deepEqual(confirm(state, '16:00'), { date: DATE, time: '16:00' });
  assert.ok(times(rank(state)).includes('16:00'));
  assert.throws(() => confirm(state, '14:00'), code('schedule-interval-conflict', 409));
});

test('ranking holds every inherited array; confirmation only reads a computable canonical single-string array', () => {
  for (const bad of [undefined, null, '', ['13:00'], ['13:00', '15:00'], [], 13, {}, '1:00', '25:00', '13:60', '24:00', '23:30']) {
    for (const kind of ['fixed', 'confirmed', 'override', 'consult']) {
      let state = stateOf([flex('new')]);
      if (kind === 'fixed') state.students.push(fixed('bad', bad));
      if (kind === 'confirmed') state.students.push(flex('bad', { confirmedDates: [{ date: DATE, time: bad }] }));
      if (kind === 'override') { state.students.push(flex('bad')); override(state, { bad: [{ day: '수', time: bad }] }); }
      if (kind === 'consult') state.consults.push({ id: 'bad', firstDate: DATE, firstTime: bad });
      const result = rank(state);
      assert.deepEqual(result.options, [], `${kind}/${JSON.stringify(bad)}`);
      assert.equal(result.warnings.length, 1);
      if (Array.isArray(bad) && bad.length === 1 && bad[0] === '13:00') {
        assert.deepEqual(confirm(state, '20:00'), { date: DATE, time: '20:00' });
        assert.throws(() => confirm(state, '13:30'), code('schedule-interval-conflict', 409));
      } else assert.throws(() => confirm(state, '20:00'), code('schedule-unknown-occupancy', 409));
    }
  }
});

test('malformed inherited active date/override shape fails closed without leaking source details', () => {
  for (const extra of [
    { confirmedDates: [{ date: '2026-02-30', time: '13:00' }] },
    { confirmedDates: [{ date: [DATE], time: '13:00' }] },
    { confirmedDates: [{ time: '13:00' }] }, { confirmedDates: 'unknown' },
    { schedType: 'fixed', days: ['unknown'], times: { unknown: '13:00' } },
    { schedType: 'fixed', days: ['수'], times: {}, st: '2026-99-99' },
  ]) {
    const state = stateOf([flex('PRIVATE_BAD', extra), flex('new')]);
    assert.deepEqual(rank(state).options, []);
    assert.throws(() => confirm(state, '20:00'), code('schedule-unknown-occupancy', 409));
    assert.ok(!JSON.stringify(rank(state)).includes('PRIVATE_BAD'));
  }
  const state = stateOf([flex('bad'), flex('new')]);
  const wk = scheduleSnapshot(state, DATE).weekKey;
  for (const entries of [null, {}, '13:00', [null], [{ day: ['수'], time: '13:00' }]]) {
    state.weekOvr[wk] = { bad: entries };
    assert.deepEqual(rank(state).options, []);
  }
});

test('off-week, canceled, inactive and overridden legacy schedules do not cause false blocking', () => {
  const state = stateOf([fixed('inactive', ['13:00'], { status: '종료' }), fixed('other-day', ['14:00'], { days: ['월'], times: { 월: ['14:00'] } }),
    fixed('off-week', ['15:00'], { intervalWeeks: 2, st: '2026-09-28' }), flex('new')]);
  assert.equal(scheduleSnapshot(state, DATE).slotsByKey['수_15:00'], undefined);
  assert.deepEqual(confirm(state, '15:00'), { date: DATE, time: '15:00' });
  const masked = override(stateOf([fixed('masked', ['13:00']), flex('new')]), { masked: [] });
  assert.deepEqual(confirm(masked, '13:00'), { date: DATE, time: '13:00' });
});

test('strict strings, real leap dates, finite working-year bounds and bounded integer limits reject coercion', () => {
  for (const date of [[DATE], null, 20261007, '2026-2-03', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-10-00', '0000-01-01', '1999-12-31', '2100-01-01', '9999-01-01', '2026-10-07T00:00:00Z', '2026-10-07 ']) {
    assert.throws(() => rank(stateOf(), { date }), code('schedule-invalid-date', 400));
  }
  for (const time of [['15:00'], null, 15, '', '15:0', '3:00', '15:60', '25:00', '15:00 ', '15:00:00']) {
    assert.throws(() => rank(stateOf(), { startTime: time }), code('schedule-invalid-time', 400));
    assert.throws(() => rank(stateOf(), { preferredTime: time }), code('schedule-invalid-time', 400));
    assert.throws(() => confirm(stateOf([flex('new')]), time), code('schedule-invalid-time', 400));
  }
  for (const limit of [0, -1, 13, 1.1, NaN, Infinity, '6', [6], null]) assert.throws(() => rank(stateOf(), { limit }), code('schedule-invalid-limit', 400));
  assert.equal(rankScheduleOptions(stateOf(), { date: DATE, startTime: '12:00', endTime: '20:00' }, NOW).options.length, 6);
  for (const date of ['2000-02-29', '2028-02-29', '2099-12-31']) assert.equal(rank(stateOf(), { date }, Date.parse('1999-01-01T00:00:00Z')).options.length, 12);
  assert.equal(rank(stateOf(), { preferredTime: '15:15' }).options[0].time, '15:15');
});

test('Asia/Seoul future starts, seconds and midnight boundaries are deterministic independent of host timezone', () => {
  const at = Date.parse(`${DATE}T13:30:00+09:00`), state = stateOf([flex('new')]);
  assert.deepEqual(times(rank(state, { startTime: '13:00', endTime: '15:00' }, at)), ['14:00']);
  assert.deepEqual(confirm(state, '13:30', 'new', DATE, at - 1), { date: DATE, time: '13:30' });
  assert.throws(() => confirm(state, '13:30', 'new', DATE, at), code('schedule-past-slot', 409));
  assert.throws(() => rank(state, {}, Date.parse('2026-10-08T00:00:00+09:00')), code('schedule-past-slot', 409));
  const today = '2026-10-08', midnight = Date.parse(`${today}T00:00:00+09:00`);
  assert.equal(rank(state, { date: today, startTime: '00:00', endTime: '02:00' }, midnight).options[0].time, '00:30');
  for (const now of [undefined, null, [NOW], String(NOW), new Date(NOW), NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER]) assert.throws(() => rankScheduleOptions(state, WINDOW, now), code('schedule-invalid-now', 400));
});

test('bad request/state shapes and ineligible students produce status/code errors, never record payloads', () => {
  for (const request of [null, [], 'date', { ...WINDOW, studentId: 'leak' }]) assert.throws(() => rankScheduleOptions(stateOf(), request, NOW), code('schedule-invalid-input', 400));
  for (const state of [null, [], {}, { students: {} }, { students: [], consults: {} }, { students: [], weekOvr: [] }]) assert.throws(() => rank(state), code('schedule-invalid-state', 400));
  for (const studentId of [null, ['new'], '', 1]) assert.throws(() => confirm(stateOf([flex('new')]), '15:00', studentId), code('schedule-invalid-student', 400));
  for (const state of [stateOf(), stateOf([flex('new', { status: '종료' })]), stateOf([flex('new', { st: '2026-10-08' })])]) assert.throws(() => confirm(state, '15:00'), code('schedule-ineligible-student', 409));
});

test('real evolving batch-state integration blocks new 30-minute overlap before commit', () => {
  const original = stateOf([flex('first'), flex('second')]), draft = structuredClone(original);
  const wk = scheduleSnapshot(draft, DATE).weekKey;
  assert.deepEqual(confirm(draft, '13:00', 'first'), { date: DATE, time: '13:00' });
  draft.weekOvr[wk] = { first: [{ day: '수', time: '13:00', source: 'sms-confirmed' }] };
  assert.throws(() => confirm(draft, '13:30', 'second'), code('schedule-interval-conflict', 409));
  assert.deepEqual(confirm(draft, '14:00', 'second'), { date: DATE, time: '14:00' });
  assert.deepEqual(original.weekOvr, {});
});

test('fixed/biweekly/confirmed/overrides use actual year-boundary persisted week keys', () => {
  const state = stateOf([fixed('year', '13:00', { days: ['금'], times: { 금: '13:00' }, st: '2026-12-29', intervalWeeks: 2 }), flex('new')]);
  const date = '2027-01-01', wk = scheduleSnapshot(state, date).weekKey;
  assert.match(wk, /^2026-W/);
  assert.throws(() => confirm(state, '13:30', 'new', date), code('schedule-interval-conflict', 409));
  assert.deepEqual(confirm(state, '13:30', 'new', '2027-01-08'), { date: '2027-01-08', time: '13:30' });
  state.weekOvr[wk] = { year: [{ day: '금', time: '17:00' }] };
  assert.deepEqual(confirm(state, '13:30', 'new', date), { date, time: '13:30' });
  assert.throws(() => confirm(state, '16:30', 'new', date), code('schedule-interval-conflict', 409));
});

test('effective confirmed dates elsewhere in the same week suppress recurring target-day defaults', () => {
  const state = stateOf([fixed('confirmed', '13:00', { confirmedDates: [{ date: '2026-10-06', time: '15:00' }] }), flex('new')]);
  assert.equal(scheduleSnapshot(state, DATE).slotsByKey['수_13:00'], undefined);
  assert.deepEqual(confirm(state, '13:00'), { date: DATE, time: '13:00' });
});

test('legacy non-grid valid starts still occupy their actual 60-minute intervals', () => {
  const state = stateOf([fixed('legacy', '13:15'), flex('new')]);
  for (const time of ['12:30', '13:00', '13:30', '14:00']) assert.throws(() => confirm(state, time), code('schedule-interval-conflict', 409));
  assert.deepEqual(confirm(state, '14:30'), { date: DATE, time: '14:30' });
});

test('minute-exact preferences and confirmations preserve every requested minute at interval/window boundaries', () => {
  const state = stateOf([fixed('peer', '13:00'), flex('new')]);
  assert.throws(() => confirm(state, '12:01'), code('schedule-interval-conflict', 409));
  assert.throws(() => confirm(state, '13:59'), code('schedule-interval-conflict', 409));
  assert.deepEqual(confirm(state, '14:00'), { date: DATE, time: '14:00' });
  assert.deepEqual(confirm(state, '15:15'), { date: DATE, time: '15:15' });
  const result = rank(state, { startTime: '15:00', endTime: '16:00', preferredTime: '15:15' });
  assert.deepEqual(times(result), ['15:00']);
  assert.equal(result.warnings.length, 1);
  assert.throws(() => confirm(state, '23:01'), code('schedule-invalid-time', 400));
  assert.throws(() => rank(state, { preferredTime: '23:01' }), code('schedule-invalid-time', 400));
});

test('inherited late-night lesson overflow never yields falsely free next-day midnight options', () => {
  const state = stateOf([flex('new')], { consults: [{ id: 'late', firstDate: '2026-10-06', firstTime: '23:30' }] });
  assert.deepEqual(rank(state, { startTime: '00:00', endTime: '02:00' }).options, []);
  assert.throws(() => confirm(state, '00:15'), code('schedule-unknown-occupancy', 409));
  assert.deepEqual(confirm(state, '01:00'), { date: DATE, time: '01:00' });
  state.consults[0].firstTime = '23:00';
  assert.deepEqual(confirm(state, '00:00'), { date: DATE, time: '00:00' });
  state.consults[0].firstTime = ['23:30'];
  assert.throws(() => confirm(state, '00:15'), code('schedule-unknown-occupancy', 409));
  state.consults[0].hold = true;
  assert.deepEqual(confirm(state, '00:15'), { date: DATE, time: '00:15' });
});

test('deterministic tie ordering, no student names, deep frozen input and unchanged snapshots on success/failure', () => {
  const state = override(stateOf([fixed('alpha', '13:00'), flex('new')], { inquiries: [{ id: 'q', name: 'PRIVATE_q', visitDate: DATE, visitTime: '15:00' }] }), { alpha: [{ day: '수', time: '13:00' }] });
  const before = structuredClone(state), beforeSnapshot = scheduleSnapshot(state, DATE);
  deepFreeze(state);
  const result = rank(state);
  assert.deepEqual(rank(state), result);
  assert.deepEqual(confirm(state, '17:00'), { date: DATE, time: '17:00' });
  assert.throws(() => confirm(state, '13:30'), code('schedule-interval-conflict', 409));
  assert.deepEqual(state, before);
  assert.deepEqual(scheduleSnapshot(state, DATE), beforeSnapshot);
  assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
  assert.ok(result.options.every(option => Object.keys(option).sort().join(',') === 'date,reason,time'));
  assert.deepEqual(times(rank(stateOf(), { startTime: '12:00', endTime: '16:00' })), ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00']);
});
