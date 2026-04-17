/**
 * search.js — 검색 유틸리티
 * 한글 초성 검색 및 일반 문자열 매칭
 * 의존 없음 (순수 함수)
 */

/**
 * 한글 문자열에서 초성만 추출
 * 예: '김기범' → 'ㄱㄱㅂ'
 * @param {string} str
 * @returns {string}
 */
function getChosung(str) {
  var CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return Array.from(str || '').map(function(c) {
    var code = c.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return c;
    return CHO[Math.floor(code / 21 / 28)];
  }).join('');
}

/**
 * 검색어가 대상 문자열에 매칭되는지 확인
 * 일반 포함 검색 + 초성 검색 모두 지원
 * @param {string} target - 검색 대상 문자열
 * @param {string} query - 검색어
 * @returns {boolean}
 */
function matchSearch(target, query) {
  if (!query) return true;
  target = target || '';
  /* 일반 포함 검색 */
  if (target.indexOf(query) >= 0) return true;
  /* 초성 검색 */
  var tCho = getChosung(target);
  var qCho = getChosung(query);
  if (tCho.indexOf(qCho) >= 0) return true;
  return false;
}
