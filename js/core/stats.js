/**
 * stats.js — 통계 계산 순수 함수
 * DOM 접근 없음, 전역 상태를 파라미터로 받아 처리
 * 의존: utils.js (없어도 동작), types.js (타입 참조용)
 */

/**
 * 특정 레슨생의 출석률 계산
 * @param {string} studentId - 레슨생 ID
 * @param {Log[]} logs - 전체 로그 배열
 * @returns {{ total: number, attended: number, absent: number, cancelled: number, rate: number }}
 */
function calcAttendanceRate(studentId, logs) {
  var sLogs = logs.filter(function(l) { return l.sid === studentId; });
  var total = sLogs.length;
  var attended = sLogs.filter(function(l) { return l.att === '출석'; }).length;
  var absent = sLogs.filter(function(l) { return l.att === '결석'; }).length;
  var cancelled = sLogs.filter(function(l) { return l.att === '취소'; }).length;
  var rate = total > 0 ? Math.round((attended / total) * 100) : 0;
  return { total: total, attended: attended, absent: absent, cancelled: cancelled, rate: rate };
}

/**
 * 특정 연월의 입금 합계 계산
 * @param {Payment[]} payments - 전체 결제 배열
 * @param {string} yearMonth - 'YYYY-MM' 형식 (예: '2026-04')
 * @returns {number} 해당 월 총 수입 (원)
 */
function calcMonthlyIncome(payments, yearMonth) {
  return payments
    .filter(function(p) { return p.paid && (p.date || '').startsWith(yearMonth); })
    .reduce(function(acc, p) { return acc + (p.amount || 0); }, 0);
}
