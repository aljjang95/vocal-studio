# HLB 스튜디오 공개 개인정보 안내

기준일: 2026-10-04. 기준 체크아웃 HEAD: `93da7d3f45b07c26db400b734b4c219a090121da`.

## 통합 인터페이스

- 고정 공개 URL: `https://vocal-studio-sms-relay.affinity-agent-studio.workers.dev/privacy`
- 모듈: `worker/studio-privacy.mjs`
- exports: `STUDIO_PRIVACY_PATH` (`/privacy`), `STUDIO_PRIVACY_HTML` (고정 한국어 HTML), `studioPrivacyResponse(method)` (릴레이에서 GET/HEAD만 호출).
- 기존 공개 릴레이 `worker/sms-relay.mjs`에만 연결했다. 네이티브 담당자는 위 고정 URL을 사용한다. URL에 토큰·사용자 정보·쿼리를 붙이지 않는다.
- GET/HEAD만 인증 없이 제공한다. HEAD는 GET과 같은 응답 헤더, 빈 본문이다. 쿼리(빈 `?` 포함), 하위 경로, 다른 메서드는 404다. 기기 경로의 기존 인증과 백엔드 권한 판정은 유지한다.
- 본문은 요청·환경·사용자 입력을 보간하지 않는다. 외부 리소스, 스크립트, 폼이 없으며 CSP는 스크립트·base·프레임을 차단한다. 공개 캐시는 300초 후 재검증하며 링크 이동에는 referrer를 보내지 않는다. CORS 허용 범위를 추가하지 않는다.

## 안내 범위와 근거

현재 후보의 RelayConfig/RelayStore, AndroidManifest, StudioCallScreeningService/CallConsent와 `worker/sms.mjs`의 기기·전화 설정 경계를 읽고 작성했다. 다른 담당자가 변경 중인 원본 파일은 수정하지 않았다.

안내는 앱 전용 연결 토큰/백업 제외, 연결 이후 해시 허용 목록의 일반 SMS, RCS/MMS 제외, 역할·로컬 동의·서버 설정이 모두 필요한 선택적 전화 접수, 등록 번호 기본값과 명시적 includeUnknown, Android 전화 전달을 위한 선택적 READ_CONTACTS 및 연락처 미조회/미업로드를 포함한다. 통화 음성/내역·접근성/알림 읽기·광고/분석을 사용한다고 주장하지 않는다.

HTTPS/Cloudflare 서버 처리, 기기 비공개 SQLite, 이동통신사를 통한 허용된 월요일/화요일 문자와 분 단위 발송 보장 불가, 운영자 관리 보관 기간, 연결 중단/폐기와 서버 삭제의 구분, 이미 통신사에 전달된 문자 취소 불가, 앱 삭제 시 로컬 데이터 제거, 비공개 일정과 운영자 최종 확정을 명시한다. 개인정보 문의는 기존 운영자 이메일 `aljjang95@gmail.com` 및 관리 사이트 `https://hlb.tllhouse.com/`로 연결한다. 30일 자동 삭제나 Google 심사·기기 승인·실제 배포 성공을 주장하지 않는다.

## 합성 검증과 인계

전용 명령: `node --test scripts/studio-privacy.test.mjs`

기존 릴레이 회귀 명령: `node --test scripts/sms-bridge.test.mjs`

실제 실행 명령: `node --test scripts/studio-privacy.test.mjs scripts/sms-bridge.test.mjs`. Node v24.21.0에서 exit 0, 29/29 PASS (개인정보 5개 + 기존 SMS 24개), 실패/건너뜀 0. 이는 합성 서버 검사 결과이며 실제 배포·기기 수용 결과가 아니다.

전용 테스트는 실제 Worker fetch에 합성 Request와 서비스 스텁을 전달하여 공개 GET/HEAD, 쿼리/메서드 차단, 인증 경계, 백엔드 거부 보존, 헤더/링크/정적 본문을 확인한다. 브라우저·프로덕션·실제 전화·SMS·비밀 키는 사용하지 않는다. 테스트 결과는 작업 응답으로 인계한다. package의 테스트 목록은 소유 범위 밖이므로 수정하지 않았으며 부모가 위 전용 명령을 통합 검사에 포함해야 한다.

남은 수용: 부모의 통합 후보에서 네이티브 고정 링크 연결, 실제 배포 URL의 접근/렌더링, 최종 네이티브·백엔드 동작과 안내의 일치 여부, 기기·공식 출시 검증. 이 문서와 합성 테스트만으로 이를 통과했다고 판단하지 않는다.
