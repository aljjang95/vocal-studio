// Public, fixed disclosure. Never interpolate request, device or owner data here.
export const STUDIO_PRIVACY_PATH = '/privacy';
export const STUDIO_PRIVACY_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HLB 스튜디오 개인정보 처리 안내</title>
</head>
<body>
<main>
<h1>HLB 스튜디오 개인정보 처리 안내</h1>
<p>적용 앱: HLB 스튜디오 (com.tllhouse.hlbreplay)<br>안내 기준일: <time datetime="2026-10-04">2026년 10월 4일</time></p>
<p>HLB 스튜디오는 운영자의 수업 일정 관리와 문자 연결을 지원합니다. 아래 내용은 앱과 연결 서버의 처리 범위에 대한 안내입니다.</p>
<h2>1. 연결 키와 기기 저장</h2>
<p>운영자가 발급한 기기 연결 키(페어링 토큰)는 앱 전용 비공개 저장소에 보관하며, 요청 URL이나 로그에 기록하지 않습니다. 앱 데이터의 백업은 비활성화되어 있으며 연결 키를 백업에 포함하지 않습니다. 전송 대기 중인 문자와 전화 접수 정보는 기기의 앱 전용 비공개 SQLite에 저장됩니다.</p>
<h2>2. 문자 처리 범위</h2>
<p>문자 읽기·수신·발송 권한은 운영자가 연결한 기기에서 일정 문자와 답장을 처리하는 데 사용합니다. 연결 시작 시점을 경계로 그 이후의 일반 SMS만 처리하며, 과거 문자 내역을 가져오지 않습니다. 서버가 제공한 등록 전화번호의 해시 허용 목록과 일치하는 번호만 문자 처리 대상입니다. 해시는 대상 번호 확인에 쓰이며, 허용된 문자의 전화번호·본문·송수신 구분·시각은 일정 관리 서버로 전달됩니다. RCS 및 MMS는 처리하지 않습니다.</p>
<p>답장과 운영자가 허용한 자동 안내는 휴대폰 SMS 모뎀을 통해 외부 이동통신사로 발송됩니다. 월요일 일정 요청과 화요일 후속 안내는 운영자가 활성화한 설정에 따릅니다. 기기 연결·전원·백그라운드 실행·통신 상태에 따라 지연될 수 있어 정확한 분 단위 발송 시각을 보장하지 않습니다. 통신사의 문자 요금과 전달 정책이 적용될 수 있습니다.</p>
<h2>3. 선택적 전화 접수와 연락처 권한</h2>
<p>전화 접수는 선택 기능입니다. Android의 발신자 확인 역할을 앱에 부여하고, 앱에서 로컬 동의를 켜고, 서버의 전화 접수 설정도 활성화한 경우에만 동작합니다. 연결 및 동의 경계 이후 Android가 전달하는 수신 전화의 번호와 시각을 접수하여 서버에 전달하며, 통화를 차단하거나 녹음하지 않습니다.</p>
<p>기본 대상은 서버에 등록된 번호입니다. 미등록 번호 포함(includeUnknown)은 운영자가 명시적으로 선택한 경우에만 허용됩니다. 전화번호의 이름 연결에는 관리 서버에 이미 등록된 정보를 사용합니다.</p>
<p>선택적 READ_CONTACTS(연락처 읽기) 권한은 Android가 기기에 저장된 연락처의 전화도 앱에 전달할 수 있도록 하는 데만 사용됩니다. 앱은 연락처를 조회하거나 업로드하지 않습니다. 권한을 허용하지 않으면 Android가 저장된 연락처의 전화를 전달하지 않을 수 있습니다.</p>
<h2>4. 사용하지 않는 정보와 기능</h2>
<p>앱은 통화 음성·통화 내역을 읽거나 수집하지 않으며, 접근성 서비스나 알림 읽기 기능을 사용하지 않습니다. 광고 및 분석 추적 도구를 사용하지 않습니다.</p>
<h2>5. 서버 처리와 비공개 일정</h2>
<p>앱과 서버 사이의 전송에는 HTTPS를 사용합니다. Cloudflare는 서버 호스팅과 데이터 처리를 지원하는 처리 서비스 제공자입니다. 서버에는 허용된 문자·전화 접수 정보와 운영자가 등록한 고객·일정 정보가 저장되어 운영자 관리 기능에 사용됩니다. 고객 정보와 캘린더는 운영자의 비공개 관리 영역이며 공개 개인정보 안내 페이지에 포함되지 않습니다. 일정 제안은 최종 예약이 아니며 운영자가 최종 확정합니다.</p>
<h2>6. 보관, 연결 중단과 삭제</h2>
<p>서버 데이터의 보관 기간과 삭제는 운영자가 관리합니다. 일률적인 30일 자동 삭제를 약속하지 않습니다. 서버에 저장된 개인정보의 조회·정정·삭제 요청은 아래 운영자 연락처로 문의해 주세요.</p>
<p>앱에서 연결을 중단하거나 서버에서 연결 키를 폐기하면 이후의 연결 처리를 중단합니다. 전화 접수 동의를 끄면 이후 전화 접수 처리가 중단됩니다. 이미 이동통신사에 전달된 SMS를 취소하거나 회수할 수는 없으며, 연결 중단만으로 서버 데이터가 삭제되지는 않습니다. 앱을 제거하면 앱 전용 로컬 데이터가 삭제되지만 서버 데이터나 이동통신사·기본 문자 앱에 남은 문자는 삭제되지 않습니다.</p>
<h2>7. 운영자 문의와 개인정보 요청</h2>
<p>운영자: HLB 스튜디오<br>이메일: <a href="mailto:aljjang95@gmail.com">aljjang95@gmail.com</a><br>관리 사이트: <a href="https://hlb.tllhouse.com/">https://hlb.tllhouse.com/</a></p>
<p>개인정보 요청 시 연결 키나 문자 전체 내역을 이메일에 보내지 마세요. 운영자가 필요한 확인 절차와 처리 방법을 안내합니다.</p>
</main>
</body>
</html>`;

export function studioPrivacyResponse(method) {
  return new Response(method === 'HEAD' ? null : STUDIO_PRIVACY_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'Content-Security-Policy': "default-src 'none'; script-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    },
  });
}
