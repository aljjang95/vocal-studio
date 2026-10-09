import { scheduleSnapshot } from './schedule-core.generated.mjs';

const DAY = 86400000, KST = 9 * 3600000, DURATION = 60, GRID = 30;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ID = /^[A-Za-z0-9_.:-]{1,160}$/;
const UNKNOWN_WARNING = '활성 일정의 날짜나 시간을 확인할 수 없어 이 날짜의 추천을 보류했어요. 기존 일정을 확인해주세요.';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const inactive = row => !!row.absent || !!row.tentative || row.kind === 'cancel' || row.overrideType === 'cancel';

function fail(code, status = 400) { throw Object.assign(new Error(code), { code, status }); }
function unknown() { fail('schedule-unknown-occupancy', 409); }
function dateMillis(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return NaN;
  const ms = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN;
}
function minutes(value, allowEnd = false) {
  if (allowEnd && value === '24:00') return 1440;
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function timeText(value) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
function fields(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('schedule-invalid-input');
}
function dayInput(date, now) {
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now + KST).getTime())) fail('schedule-invalid-now');
  const ms = dateMillis(date);
  if (!Number.isFinite(ms)) fail('schedule-invalid-date');
  if (ms + DAY - KST <= now) fail('schedule-past-slot', 409);
  return ms;
}
function startInput(time) {
  const start = minutes(time);
  if (!Number.isFinite(start) || start + DURATION > 1440) fail('schedule-invalid-time');
  return start;
}
function stateInput(state) {
  if (!object(state) || !Array.isArray(state.students) ||
      ['consults', 'inquiries'].some(key => state[key] !== undefined && !Array.isArray(state[key])) ||
      (state.weekOvr !== undefined && !object(state.weekOvr))) fail('schedule-invalid-state');
}

// The engine supplies recurrence, year/week keys, linked conversion and group identity.
// Validate effective raw sources first: its legacy defaults/coercion must not turn
// missing or array-valued active times into apparently free intervals. A private
// view also retains override precedence when every entry is canceled/tentative.
function occupiedSlots(state, date, guardMidnight = false, canonicalLegacy = false) {
  stateInput(state);
  try {
    const calendar = scheduleSnapshot({ students: [], consults: [], inquiries: [], weekOvr: {} }, date);
    const day = DAYS[new Date(date + 'T00:00:00Z').getUTCDay()], wk = calendar.weekKey;
    const rawWeek = state.weekOvr?.[wk];
    if (rawWeek !== undefined && !object(rawWeek)) unknown();
    const week = Object.assign(Object.create(null), rawWeek || {});
    const consults = state.consults || [];
    if (consults.some(row => !object(row))) unknown();

    // Confirmation may read a legacy single-string array only when the actual
    // engine placed that same array in its exact canonical day/time key. Keep
    // stored values intact and never enable this compatibility path for ranking.
    const canonicalTimes = new Map();
    if (canonicalLegacy) {
      const original = scheduleSnapshot(state, date);
      for (const [key, rows] of Object.entries(original.slotsByKey)) {
        for (const slot of rows) {
          const raw = slot.time;
          if (slot.date !== date || slot.day !== day || inactive(slot) || !Array.isArray(raw) || raw.length !== 1) continue;
          const start = minutes(raw[0]);
          if (!Number.isFinite(start) || start + DURATION > 1440 || key !== `${day}_${raw[0]}`) continue;
          if (!canonicalTimes.has(slot.s.id)) canonicalTimes.set(slot.s.id, new Set());
          canonicalTimes.get(slot.s.id).add(raw);
        }
      }
    }

    function confirmed(source) {
      if (!object(source)) unknown();
      if (source.confirmedDates !== undefined && !Array.isArray(source.confirmedDates)) unknown();
      let rows = source.confirmedDates || [];
      if (source.confirmedDates === undefined && source.firstDate) rows = [{ date: source.firstDate, time: source.firstTime || source.time }];
      const seen = new Set();
      return rows.filter(row => {
        if (!object(row)) unknown();
        // The original engine does not apply cancellation/absence/tentative
        // flags on confirmedDates. Only effective weekly overrides clear them.
        if (!Number.isFinite(dateMillis(row.date))) unknown();
        const key = `${row.date}_${row.time}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    }

    function confirmedInWeek(source) {
      const rows = confirmed(source);
      const current = rows.filter(row => row.date >= calendar.weekStart && row.date <= calendar.weekEnd);
      return { current, present: current.length > 0 };
    }

    function checkTime(row, ownerId) {
      const time = canonicalTimes.get(ownerId)?.has(row.time) ? row.time[0] : row.time;
      const start = minutes(time);
      if (!Number.isFinite(start) || start + DURATION > 1440) unknown();
      return time;
    }

    const activeStudents = state.students.filter(student => {
      if (!object(student)) unknown();
      return student.status === '수강중';
    });
    const ids = new Set();
    for (const student of activeStudents) {
      if (typeof student.id !== 'string' || !ID.test(student.id) || ids.has(student.id)) unknown();
      ids.add(student.id);
      if (own(week, student.id)) {
        if (!Array.isArray(week[student.id])) unknown();
        week[student.id] = week[student.id].filter(row => {
          if (!object(row)) unknown();
          if (inactive(row)) return false;
          if (typeof row.day !== 'string' || !DAYS.includes(row.day)) unknown();
          if (row.day !== day) return false;
          checkTime(row, student.id); return true;
        });
        continue;
      }
      const data = student.consultData;
      if (data !== undefined && data !== null && !object(data)) unknown();
      const linked = data && consults.find(row => row.id === data.id && row.converted);
      const source = linked || (student.confirmedDates !== undefined ? student : data);
      if (source) {
        const dates = confirmedInWeek(source);
        if (dates.present) {
          week[student.id] = dates.current.filter(row => row.date === date).map(row => {
            checkTime(row, student.id);
            return { day, time: row.time, source: 'consult-confirmed' };
          });
          continue;
        }
      }
      if (student.st && !Number.isFinite(dateMillis(student.st))) unknown();
      if (student.schedType === 'flex') continue;
      if (student.days !== undefined && (!Array.isArray(student.days) || student.days.some(value => typeof value !== 'string' || !DAYS.includes(value)))) unknown();
    }

    const viewConsults = consults.map(consult => {
      if (consult.converted || consult.hold) return consult;
      const rows = confirmed(consult).filter(row => row.date === date);
      rows.forEach(row => checkTime(row, consult.id));
      return { ...consult, confirmedDates: rows, firstDate: undefined };
    });
    const view = { students: activeStudents, consults: viewConsults, inquiries: state.inquiries || [], weekOvr: { [wk]: week } };
    const snapshot = scheduleSnapshot(view, date);
    const slots = Object.values(snapshot.slotsByKey).flat().filter(slot => slot.date === date && !inactive(slot))
      .map(slot => ({ ...slot, time: checkTime(slot, slot.s.id) }));
    for (const slot of slots) {
      checkTime(slot);
      // Fixed schedules default missing times to 10:00 in the legacy engine.
      // Only check an effective fixed slot, so masked overrides/off-weeks stay usable.
      if (slot.type === 'fixed' && !slot.oneOff && slot.source === 'fixed') {
        if (!object(slot.s.times) || !own(slot.s.times, day)) unknown();
        checkTime({ time: slot.s.times[day] }, slot.s.id);
      }
    }
    // Valid 60-minute lessons end by midnight. An inherited invalid late lesson
    // may spill into the first hour; never label that next-day time as free.
    if (guardMidnight) {
      const previous = new Date(Date.parse(date + 'T00:00:00Z') - DAY).toISOString().slice(0, 10);
      occupiedSlots(state, previous, false, canonicalLegacy);
    }
    return { slots, calendar, day };
  } catch (error) {
    if (error?.code === 'schedule-unknown-occupancy') throw error;
    // Do not expose inherited engine errors or private student fields.
    unknown();
  }
}

function unionIntervals(slots) {
  const intervals = slots.map(slot => ({ start: minutes(slot.time), end: minutes(slot.time) + DURATION }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const union = [];
  for (const interval of intervals) {
    const last = union.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else union.push({ ...interval });
  }
  return union;
}
const overlaps = (start, interval) => start < interval.end && start + DURATION > interval.start;

/** Pure, owner-window-only suggestions. Occupancy includes self and all groups. */
export function rankScheduleOptions(state, request, now) {
  fields(request, ['date', 'startTime', 'endTime', 'preferredTime', 'limit']);
  const { date, startTime, endTime, preferredTime, limit = 6 } = request;
  const dateAt = dayInput(date, now), first = minutes(startTime), end = minutes(endTime, true);
  if (!Number.isFinite(first) || !Number.isFinite(end)) fail('schedule-invalid-time');
  if (end - first < DURATION) fail('schedule-invalid-window');
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) fail('schedule-invalid-limit');
  const preferred = preferredTime === undefined ? undefined : startInput(preferredTime);
  let occupancy;
  const guardMidnight = Math.ceil(first / GRID) * GRID < DURATION ||
    (preferred !== undefined && preferred < DURATION && preferred >= first && preferred + DURATION <= end);
  try { occupancy = occupiedSlots(state, date, guardMidnight); }
  catch (error) {
    if (error?.code === 'schedule-unknown-occupancy') return { options: [], warnings: [UNKNOWN_WARNING] };
    throw error;
  }
  const intervals = unionIntervals(occupancy.slots), warnings = [];
  const startOfSpan = intervals[0]?.start, endOfSpan = intervals.at(-1)?.end;
  const ranked = [];
  const starts = new Set();
  for (let start = Math.ceil(first / GRID) * GRID; start + DURATION <= end; start += GRID) starts.add(start);
  if (preferred !== undefined && preferred >= first && preferred + DURATION <= end) starts.add(preferred);
  for (const start of starts) {
    if (dateAt - KST + start * 60000 <= now || intervals.some(interval => overlaps(start, interval))) continue;
    const touches = Number(intervals.some(interval => interval.end === start)) +
      Number(intervals.some(interval => interval.start === start + DURATION));
    const spanIncrease = intervals.length ? Math.max(endOfSpan, start + DURATION) - Math.min(startOfSpan, start) - (endOfSpan - startOfSpan) : DURATION;
    const idleIncrease = intervals.length ? spanIncrease - DURATION : 0;
    const exact = start === preferred;
    const reason = exact ? '요청한 시간이 가능해요.' : touches === 2 ? '앞뒤 레슨 사이에 이어지는 시간이에요.' :
      touches === 1 ? '기존 레슨에 이어지는 시간이에요.' : idleIncrease < 0 ? '레슨 사이 대기 시간을 줄이는 시간이에요.' : '입력한 가능 시간 안의 빈 시간이에요.';
    ranked.push({ date, time: timeText(start), reason, start, exact, touches, idleIncrease, spanIncrease });
  }
  if (preferred !== undefined && !ranked.some(row => row.exact)) warnings.push('요청한 시간은 입력한 가능 시간 안에서 확보할 수 없어요. 가능 시간과 기존 일정을 확인해주세요.');
  if (!ranked.length) warnings.push('입력한 가능 시간 안에 60분 레슨을 배치할 수 있는 미래 시간이 없어요.');
  ranked.sort((a, b) => Number(b.exact) - Number(a.exact) || b.touches - a.touches ||
    a.idleIncrease - b.idleIncrease || a.spanIncrease - b.spanIncrease || a.start - b.start);
  return { options: ranked.slice(0, limit).map(({ date: d, time, reason }) => ({ date: d, time, reason })), warnings };
}

/** Validate before inserting each candidate into an evolving cloned batch state. */
export function assertScheduleIntervalAvailable(state, request, now) {
  fields(request, ['date', 'time', 'studentId']);
  const { date, time, studentId } = request, dateAt = dayInput(date, now), start = startInput(time);
  if (typeof studentId !== 'string' || !ID.test(studentId)) fail('schedule-invalid-student');
  if (dateAt - KST + start * 60000 <= now) fail('schedule-past-slot', 409);
  const { slots, calendar, day } = occupiedSlots(state, date, start < DURATION, true);
  const student = state.students.find(row => row.id === studentId && row.status === '수강중');
  if (!student || (student.st && date < student.st)) fail('schedule-ineligible-student', 409);
  // Ask the engine for the candidate's actual group identity rather than copy its rules.
  const candidate = scheduleSnapshot({ students: [student], consults: [], inquiries: [],
    weekOvr: { [calendar.weekKey]: { [studentId]: [{ day, time }] } } }, date).slotsByKey[`${day}_${time}`]?.[0];
  if (!candidate) unknown();
  for (const slot of slots) {
    if (!overlaps(start, { start: minutes(slot.time), end: minutes(slot.time) + DURATION })) continue;
    const shares = slot.s.id !== studentId && slot.time === time && slot.sharedSlot && candidate.sharedSlot &&
      slot.groupId && slot.groupId === candidate.groupId;
    if (!shares) fail('schedule-interval-conflict', 409);
  }
  return { date, time };
}
