/**
 * cycle.js — 레슨 사이클 및 결제 주기 계산
 * 의존: 전역 students 배열, 전역 logs 배열 (store에서 관리)
 * utils.js, types.js 로드 후 사용
 */

/**
 * 레슨생의 lessonOffset 반환
 * wn(회차 번호) 계산 시 초기 오프셋 적용에 사용
 * @param {string} sid - 레슨생 ID
 * @returns {number}
 */
function getSOffset(sid) {
  var s = students.find(function(x) { return x.id === sid; });
  return (s && parseInt(s.lessonOffset)) || 0;
}

/**
 * 레슨생의 현재 결제 사이클 정보 계산
 * - 주 1회: 4회 = 1사이클
 * - 주 2회: 8회 = 1사이클
 * - 결석/연기는 실제 레슨 회차에서 제외
 * @param {Student} s - 레슨생 객체
 * @returns {CycleInfo}
 */
function getCycleInfo(s) {
  var cycleSize = s.freq === 2 ? 8 : 4;
  var actualLessons = logs.filter(function(l) {
    return l.sid === s.id && l.att !== '결석' && l.att !== '연기';
  }).length;
  var offset = parseInt(s.lessonOffset) || 0;
  var totalLessons = actualLessons + offset;
  var cycleNum = totalLessons > 0 ? Math.floor((totalLessons - 1) / cycleSize) + 1 : 1;
  var posInCycle = totalLessons > 0 ? ((totalLessons - 1) % cycleSize) + 1 : 0;
  var cycleStart = (cycleNum - 1) * cycleSize + 1;
  var cycleEnd = cycleNum * cycleSize;
  var lessonsInCycle = posInCycle;
  var remainInCycle = cycleSize - posInCycle;
  return {
    cycleSize: cycleSize,
    cycleNum: cycleNum,
    cycleStart: cycleStart,
    cycleEnd: cycleEnd,
    lessonsInCycle: lessonsInCycle,
    remainInCycle: remainInCycle,
    totalLessons: totalLessons,
    offset: offset,
    actualLessons: actualLessons
  };
}
