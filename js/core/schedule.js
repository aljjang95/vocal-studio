/**
 * schedule.js — 주간 스케줄 계산 (순수 로직, DOM 없음)
 * 의존: 전역 students, weekOvr, consults 배열
 *       utils.js (getWK, addDays, toDS), types.js (HOURS, JSDOW)
 */

/**
 * 특정 주의 스케줄 맵 빌드
 * key: '{요일}_{시간}' (예: '화_14:00')
 * value: Array of { s: Student, type: string, absent: boolean, time: string }
 *
 * - fixed 레슨생: weekOvr에 해당 주 키가 있으면 그것 사용, 없으면 기본 스케줄
 * - flex 레슨생: weekOvr에서 해당 주의 배정만 사용
 * - 상담 확정 일정도 포함 (converted 제외)
 *
 * @param {Date} mon - 해당 주의 월요일 Date
 * @returns {Object.<string, Array>}
 */
function getWeekSched(mon) {
  var wk = getWK(mon);
  var ov = weekOvr[wk] || {};
  var res = {};
  var monEnd = addDays(mon, 6);
  var monStr = toDS(mon);
  var monEndStr = toDS(monEnd);

  /* 수강중인 레슨생만 처리 */
  students.filter(function(s) { return s.status === '수강중'; }).forEach(function(s) {
    /* 레슨 시작일 이후 주에만 표시 */
    if (s.st) {
      var st = new Date(s.st);
      st.setHours(0, 0, 0, 0);
      if (monEnd < st) return; /* 이번 주 마지막날보다 시작일이 늦으면 skip */
    }

    var slots;
    if (s.schedType === 'flex') {
      /* 변동 스케줄: weekOvr에 배정된 것만 */
      slots = ov[s.id] || [];
    } else {
      /* 고정 스케줄: weekOvr 키가 존재하면(빈배열 포함) 그것 사용, 없으면 기본 */
      var base = (s.days || []).map(function(d) {
        return { day: d, time: (s.times && s.times[d]) || '10:00', absent: false };
      });
      slots = (s.id in ov) ? ov[s.id] : base;
    }

    slots.forEach(function(sl) {
      if (!sl.day || !sl.time) return;
      var k = sl.day + '_' + sl.time;
      if (!res[k]) res[k] = [];
      /* 같은 학생 중복 방지 */
      var already = res[k].some(function(x) { return x.s.id === s.id; });
      if (!already) {
        res[k].push({
          s: s,
          type: s.schedType === 'flex' ? 'flex-sched' : 'fixed',
          absent: sl.absent || false,
          time: sl.time
        });
      }
    });
  });

  /* 상담 확정 일정도 스케줄에 표시 */
  var dayNames = ['일','월','화','수','목','금','토'];
  consults.forEach(function(c) {
    if (!c.confirmedDates || !c.confirmedDates.length || c.converted) return;
    c.confirmedDates.forEach(function(cd) {
      if (!cd.date || !cd.time) return;
      if (cd.date < monStr || cd.date > monEndStr) return;
      var dow = dayNames[new Date(cd.date).getDay()];
      var k = dow + '_' + cd.time;
      if (!res[k]) res[k] = [];
      var already = res[k].some(function(x) { return x.s && x.s.id === c.id; });
      if (!already) {
        /* 상담자를 학생과 같은 형태로 표시 */
        var fakeStudent = {
          id: c.id,
          name: c.name + (c.converted ? '' : ' (상담)'),
          photo: '',
          _photoKey: c._photoKey || '',
          ph: c.phone || '',
          cls: c.cls || '',
          schedType: 'fixed',
          status: '수강중',
          fee: 0
        };
        res[k].push({ s: fakeStudent, type: 'consult-sched', absent: false, time: cd.time });
      }
    });
  });

  return res;
}
