/* ═══════════════════════════════════════════════════════
   holidays.js — 공휴일 API 및 유틸리티
   - KR_HOLIDAYS: 내장 한국 공휴일 데이터 (2025~2028)
   - loadHolidaysFromGoogle(): 구글 캘린더 API로 공휴일 로드
   - loadHolidaysForView(): 현재 뷰 기준 공휴일 로드
   - isHoliday() / getHolidayName() / isMonday()
   - isOffDay() / getOffLabel(): 휴무일 판단
   ═══════════════════════════════════════════════════════ */

/* ── 내장 한국 공휴일 데이터 ── */
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

/* ── 구글 캘린더 공휴일 로드 캐시 ── */
var _holidayLoaded = {};

/* ── 구글 캘린더 API로 특정 연도 공휴일 로드 ── */
function loadHolidaysFromGoogle(year, cb){
  if(_holidayLoaded[year]){if(cb)cb();return;}
  /* 구글 캘린더 공개 한국 공휴일 - API 키 불필요 */
  var calId='ko.south_korea%23holiday%40group.v.calendar.google.com';
  var timeMin=encodeURIComponent(year+'-01-01T00:00:00Z');
  var timeMax=encodeURIComponent(year+'-12-31T23:59:59Z');
  var url='https://www.googleapis.com/calendar/v3/calendars/'+calId+'/events'
    +'?key=AIzaSyBNlYH01_9Hc5S1J9vuFmu2nUqBZJNAXxs'
    +'&timeMin='+timeMin+'&timeMax='+timeMax
    +'&singleEvents=true&maxResults=50';
  fetch(url)
    .then(function(r){return r.json();})
    .then(function(data){
      var items=data&&data.items;
      if(items&&items.length){
        items.forEach(function(item){
          var ds=item.start&&(item.start.date||item.start.dateTime);
          if(ds) KR_HOLIDAYS[ds.slice(0,10)]=1;
        });
      }
      _holidayLoaded[year]=true;
      if(cb)cb();
    })
    .catch(function(e){
      console.warn('구글 캘린더 공휴일 로드 실패, 내장 데이터 사용:',e);
      _holidayLoaded[year]=true;
      if(cb)cb();
    });
}

/* ── 현재 뷰 기준으로 필요한 연도 공휴일 로드 ── */
function loadHolidaysForView(cb){
  var mon=getViewMon();
  var years=[mon.getFullYear()];
  var nextMon=addDays(mon,35);
  if(nextMon.getFullYear()!==years[0]) years.push(nextMon.getFullYear());
  var done=0;
  years.forEach(function(y){
    loadHolidaysFromGoogle(y,function(){
      done++;
      if(done===years.length&&cb)cb();
    });
  });
}

/* ── 공휴일 여부 판단 ── */
function isHoliday(dateStr){
  if(!dateStr) return false;
  if(KR_HOLIDAYS[dateStr]) return true;
  if(_cfg.customHolidays && _cfg.customHolidays.indexOf(dateStr)>=0) return true;
  return false;
}

/* ── 공휴일 이름 반환 ── */
function getHolidayName(dateStr){
  if(!dateStr) return '';
  if(KR_HOLIDAYS[dateStr] && typeof KR_HOLIDAYS[dateStr]==='string') return KR_HOLIDAYS[dateStr];
  return '공휴일';
}

/* ── 월요일 여부 판단 ── */
function isMonday(dateStr){
  if(!dateStr) return false;
  return new Date(dateStr).getDay()===1;
}

/* ── 휴무일(공휴일 또는 월요일 휴무) 여부 판단 ── */
function isOffDay(dateStr){
  if(!dateStr) return false;
  if(_cfg.monOff && isMonday(dateStr)) return true;
  if(isHoliday(dateStr)) return true;
  return false;
}

/* ── 휴무일 라벨 반환 ── */
function getOffLabel(dateStr){
  if(isHoliday(dateStr)) return getHolidayName(dateStr);
  if(_cfg.monOff && isMonday(dateStr)) return '휴무';
  return '';
}
