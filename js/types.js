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
   공개 기본 레슨생 데이터 (PII 제거)
   ─────────────────────────────────────────── */

/** @type {Student[]} */
var _DEFAULT_STUDENTS = [];
