/**
 * types.js — 상수 및 타입 정의
 * 전역 상수, 설정 객체, 기본 데이터, JSDoc 타입 정의 모음
 * 다른 모든 모듈보다 먼저 로드되어야 함
 */

/* ───────────────────────────────────────────
   JSDoc 타입 정의
   ─────────────────────────────────────────── */

/**
 * @typedef {Object} Student
 * @property {string} id - 고유 ID (uid())
 * @property {string} name - 이름
 * @property {string} age - 출생연도 (문자열)
 * @property {string} ph - 전화번호
 * @property {string} gd - 성별
 * @property {string} cls - 수업 유형 ('pro'|'hob'|'chuk'|'voice')
 * @property {string} status - 상태 ('수강중'|'휴강'|'중단')
 * @property {string} schedType - 스케줄 유형 ('fixed'|'flex')
 * @property {string[]} days - 수업 요일 배열
 * @property {Object.<string,string>} times - 요일별 수업 시간
 * @property {string} st - 수업 시작일 (YYYY-MM-DD)
 * @property {number} freq - 주당 수업 횟수 (1|2)
 * @property {number} deferrals - 현재 연기 횟수
 * @property {number} maxDeferrals - 최대 연기 가능 횟수
 * @property {number} createdAt - 생성 타임스탬프
 * @property {string} memo - 메모
 * @property {number} [fee] - 수강료
 * @property {number} [lessonOffset] - 레슨 회차 오프셋
 * @property {string} [photo] - 사진 데이터 (base64)
 * @property {string} [_photoKey] - localStorage 사진 키
 */

/**
 * @typedef {Object} Log
 * @property {string} id - 고유 ID
 * @property {string} sid - 레슨생 ID
 * @property {string} sn - 레슨생 이름
 * @property {string} date - 레슨 날짜 (YYYY-MM-DD)
 * @property {string} att - 출결 상태 ('출석'|'결석'|'취소'|'연기')
 * @property {string} ct - 수업 내용
 * @property {string} fb - 피드백
 * @property {string} hw - 과제
 * @property {string} rt - 평가 점수 (문자열)
 * @property {string} note - 비고
 * @property {number} wn - 회차 번호
 * @property {number} createdAt - 생성 타임스탬프
 */

/**
 * @typedef {Object} Payment
 * @property {string} id - 고유 ID
 * @property {string} sid - 레슨생 ID
 * @property {string} sname - 레슨생 이름
 * @property {number} wn - 회차
 * @property {number} cycleNum - 결제 사이클 번호
 * @property {number} amount - 결제 금액
 * @property {string} date - 결제 날짜 (YYYY-MM-DD)
 * @property {boolean} paid - 결제 완료 여부
 * @property {string} note - 비고
 */

/**
 * @typedef {Object} Consult
 * @property {string} id - 고유 ID
 * @property {string} name - 상담자 이름
 * @property {string} phone - 전화번호
 * @property {string} age - 출생연도
 * @property {string} job - 직업
 * @property {string} ref - 유입 경로
 * @property {string} why - 보컬 배우려는 이유
 * @property {string} goalS - 단기 목표
 * @property {string} goalL - 장기 목표
 * @property {string} voice - 보이스 유형
 * @property {string} exp - 경험
 * @property {string} memo - 메모
 * @property {string} status - 상담 상태
 * @property {boolean} [converted] - 수강 전환 여부
 * @property {Array} [confirmedDates] - 확정 상담 일정
 */

/**
 * @typedef {Object} Inquiry
 * @property {string} id - 고유 ID
 * @property {string} name - 문의자 이름
 * @property {string} phone - 전화번호
 * @property {string} msg - 문의 내용
 * @property {string} date - 문의 날짜
 * @property {string} status - 처리 상태
 */

/**
 * @typedef {Object.<string, Object.<string, Array>>} WeekOverride
 * 주간 스케줄 오버라이드 맵
 * key: 주차 키 (YYYY-Www), value: { [studentId]: SlotArray }
 */

/**
 * @typedef {Object} Config
 * @property {boolean} monOff - 월요일 휴무 여부
 * @property {string[]} customHolidays - 사용자 정의 공휴일 날짜 배열
 * @property {boolean} sunCollapsed - 일요일 접힘 여부
 * @property {boolean} monCollapsed - 월요일 접힘 여부
 * @property {boolean} sunHidden - 일요일 숨김 여부
 * @property {boolean} monHidden - 월요일 숨김 여부
 */

/**
 * @typedef {Object} CycleInfo
 * @property {number} cycleSize - 사이클 크기 (4 또는 8)
 * @property {number} cycleNum - 현재 사이클 번호
 * @property {number} cycleStart - 사이클 시작 회차
 * @property {number} cycleEnd - 사이클 종료 회차
 * @property {number} lessonsInCycle - 사이클 내 완료 회수
 * @property {number} remainInCycle - 사이클 내 남은 회수
 * @property {number} totalLessons - 전체 레슨 회수
 * @property {number} offset - 레슨 오프셋
 * @property {number} actualLessons - 실제 출석/취소 회수
 */

/* ───────────────────────────────────────────
   기본 상수
   ─────────────────────────────────────────── */

/** 레슨생 색상 팔레트 */
var COLORS = ['#3d6b3d','#5a6b3a','#6b5a3a','#3a5a5a','#5a3a5a','#3a5a3a','#5a4a3a','#3a4a5a'];

/** 요일 전체 (월~일) */
var ALL7 = ['월','화','수','목','금','토','일'];

/** 평일 수업 가능 요일 */
var WORK = ['화','수','목','금','토'];

/** JS getDay() → 한국어 요일 매핑 */
var JSDOW = {0:'일', 1:'월', 2:'화', 3:'수', 4:'목', 5:'금', 6:'토'};

/**
 * 수업 가능 시간 슬롯
 * (HRS_LBL과 동일 내용 — 중복 제거하여 HOURS로 통일)
 */
var HOURS = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'];

/* ───────────────────────────────────────────
   수강료 테이블
   ─────────────────────────────────────────── */

/**
 * 수강료 테이블 — cls(수업유형) × freq(주당횟수) → 금액(원)
 * @type {Object.<string, Object.<number, number>>}
 */
var FEE_TABLE = {
  pro:   {1: 350000, 2: 600000},
  hob:   {1: 250000, 2: 450000},
  chuk:  {1: 350000, 2: 600000},
  voice: {1: 350000, 2: 600000}
};

/* ───────────────────────────────────────────
   한국 공휴일 (2025-2028 내장 데이터)
   구글 캘린더 API로 추가 로드 후 병합됨
   ─────────────────────────────────────────── */

/**
 * @type {Object.<string, string|number>}
 */
var KR_HOLIDAYS = {
  /* 2025 */
  '2025-01-01':'신정','2025-01-28':'설날연휴','2025-01-29':'설날','2025-01-30':'설날연휴',
  '2025-03-01':'삼일절','2025-05-05':'어린이날','2025-05-06':'대체공휴일','2025-06-06':'현충일',
  '2025-08-15':'광복절','2025-10-03':'개천절','2025-10-05':'추석연휴','2025-10-06':'추석',
  '2025-10-07':'추석연휴','2025-10-08':'대체공휴일','2025-10-09':'한글날','2025-12-25':'성탄절',
  /* 2026 */
  '2026-01-01':'신정','2026-01-28':'설날연휴','2026-01-29':'설날','2026-01-30':'설날연휴',
  '2026-03-01':'삼일절','2026-03-02':'대체공휴일','2026-05-05':'어린이날','2026-06-06':'현충일',
  '2026-08-17':'대체공휴일(광복절)','2026-09-24':'추석연휴','2026-09-25':'추석','2026-09-26':'추석연휴',
  '2026-10-03':'개천절','2026-10-09':'한글날','2026-12-25':'성탄절',
  /* 2027 */
  '2027-01-01':'신정','2027-02-06':'설날연휴','2027-02-07':'설날','2027-02-08':'설날연휴','2027-02-09':'대체공휴일',
  '2027-03-01':'삼일절','2027-05-05':'어린이날','2027-05-13':'부처님오신날','2027-06-06':'현충일','2027-06-07':'대체공휴일',
  '2027-08-15':'광복절','2027-08-16':'대체공휴일','2027-09-14':'추석연휴','2027-09-15':'추석','2027-09-16':'추석연휴',
  '2027-10-03':'개천절','2027-10-04':'대체공휴일','2027-10-09':'한글날','2027-12-25':'성탄절','2027-12-27':'대체공휴일',
  /* 2028 */
  '2028-01-01':'신정','2028-01-26':'설날연휴','2028-01-27':'설날','2028-01-28':'설날연휴',
  '2028-03-01':'삼일절','2028-05-02':'대체공휴일','2028-05-05':'어린이날','2028-06-06':'현충일',
  '2028-08-15':'광복절','2028-10-01':'추석연휴','2028-10-02':'추석','2028-10-03':'추석연휴/개천절',
  '2028-10-09':'한글날','2028-12-25':'성탄절'
};

/* ───────────────────────────────────────────
   39명 기본 레슨생 데이터 (직접 내장)
   ─────────────────────────────────────────── */

/** @type {Student[]} */
var _DEFAULT_STUDENTS = [
  {"id":"61e2v571328b","name":"김기범","age":"1997","ph":"010-4062-8664","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["금"],"times":{"금":"13:00"},"st":"2022-05-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"6th9rmk9ubtj","name":"최시현","age":"2015","ph":"010-9115-5364","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"12:00"},"st":"2025-01-07","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"0yymg3e29to8","name":"박시형","age":"1984","ph":"010-6848-9145","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-03-08","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"4234zln4ta34","name":"박도연","age":"1985","ph":"010-4774-1299","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["목"],"times":{"목":"15:00"},"st":"2025-03-06","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"m45o76hkm6ku","name":"한영호","age":"1986","ph":"010-6342-8623","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-03-18","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"bf0pyry7wb6q","name":"구자홍","age":"1993","ph":"010-8915-9594","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-05-30","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"ufmuxhfive5s","name":"안수현","age":"1989","ph":"010-6713-5317","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-06-18","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"thojlxjackr2","name":"박준기","age":"1997","ph":"010-3209-7809","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-07-02","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"j0ncwai9l8q4","name":"서주원","age":"1998","ph":"010-3443-1489","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"dy5uc4e5yxmi","name":"서희","age":"2012","ph":"010-8517-5871","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"16:00"},"st":"2025-07-12","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"hzgb3ykz6fpo","name":"하동찬","age":"2000","ph":"010-9143-1081","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-07-17","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"fokwcfdpt2q3","name":"최희성","age":"2004","ph":"010-8287-8909","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["수"],"times":{"수":"17:00"},"st":"2025-07-19","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"5kko01fc2e97","name":"정수영","age":"1995","ph":"010-6431-5048","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-07-24","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"t7zq5xxonglu","name":"김중훈","age":"1995","ph":"010-7466-3671","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-07-29","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"0fbzeacfnvz5","name":"이영복","age":"1994","ph":"010-3242-2181","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-08-02","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"축가 고정"},
  {"id":"nk5q3quvyvpm","name":"장유리","age":"2000","ph":"010-2468-3916","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-08-09","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"6619fhmnedj3","name":"김영서","age":"1997","ph":"010-4379-5254","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-08-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"rp0xyfoaffad","name":"강민서","age":"1994","ph":"010-7644-4438","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-08-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"kit4vqt2mm4q","name":"최승원","age":"2010","ph":"010-6263-0614","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-09-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"s6s3bev7affl","name":"김다혜","age":"2014","ph":"010-8970-2811","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-09-13","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":""},
  {"id":"a1ormshknkcv","name":"정재원","age":"1988","ph":"010-2231-2591","gd":"여성","cls":"hob","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-10-03","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"축가"},
  {"id":"eymrquim8uno","name":"김정수","age":"2002","ph":"010-4833-7394","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-10-23","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"2ue4tbt85lgj","name":"손은선","age":"2005","ph":"010-6755-3009","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-11-05","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"737d4y07c0xz","name":"박정민","age":"1999","ph":"010-3804-4064","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-11-04","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"qxlehfm4bmtv","name":"채윤호","age":"2012","ph":"010-5439-9317","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"14:00"},"st":"2025-11-22","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"3ztjzrhc47a1","name":"이동윤","age":"2003","ph":"010-5501-1371","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-12-31","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"},
  {"id":"auk7khfi9njp","name":"김민수","age":"2000","ph":"010-2428-5362","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2025-12-15","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"음성 고정"},
  {"id":"6f965kpwl8kw","name":"전성만","age":"1976","ph":"010-9260-5757","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2025-12-26","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"pw55yrl64qv6","name":"정승연","age":"1997","ph":"010-4480-1605","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-01-09","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"},
  {"id":"8ilx8p28x48h","name":"김민석","age":"2009","ph":"010-8423-0207","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-01-03","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"298gpqwm5z1g","name":"김성민","age":"1976","ph":"010-9400-9300","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":["수"],"times":{"수":"20:00"},"st":"2026-01-08","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"isfk42ix2ffw","name":"김민재","age":"2016","ph":"010-3394-0301","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":["토"],"times":{"토":"17:00"},"st":"2026-01-17","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"},
  {"id":"77rtfl54126h","name":"한성빈","age":"1997","ph":"010-7658-2422","gd":"여성","cls":"hob","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2026-01-20","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"축가"},
  {"id":"fvurawewry4m","name":"이세미","age":"2010","ph":"010-2354-8184","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-01-26","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"v2r7h8r15d6w","name":"한지민","age":"2007","ph":"010-4542-7734","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2026-02-05","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"imfbwpdg12lz","name":"손주환","age":"1999","ph":"010-2946-5077","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":["목"],"times":{"목":"17:00"},"st":"","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":""},
  {"id":"brvnokwp5ock","name":"정두현","age":"1997","ph":"010-6318-7351","gd":"여성","cls":"pro","status":"휴강","schedType":"flex","days":[],"times":{},"st":"2026-02-27","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성"},
  {"id":"zplnhb6rtwek","name":"이천희","age":"1976","ph":"010-5571-0822","gd":"여성","cls":"pro","status":"휴강","schedType":"fixed","days":[],"times":{},"st":"2026-02-25","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"발성 고정"},
  {"id":"kmvehxt5zv8l","name":"강신영","age":"1990","ph":"010-9111-9053","gd":"여성","cls":"hob","status":"휴강","schedType":"fixed","days":["목"],"times":{"목":"14:00"},"st":"2026-03-05","freq":1,"deferrals":0,"maxDeferrals":2,"createdAt":0,"memo":"취미 고정"}
];
