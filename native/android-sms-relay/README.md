# HLB 스튜디오 Android 앱

정본 [문자 계약](../../docs/sms-bridge-contract.md)과 [Android 확장 계약](../../docs/android-studio-bridge-contract.md)의 기기 API를 사용하는 독립 Java 앱입니다. minSdk 26 / targetSdk 36, 외부 라이브러리·Gradle·클라우드 SMS·AI·알림 접근 없이 설치된 Unity SDK로 빌드합니다. 패키지는 `com.tllhouse.hlbreplay`를 유지하며 소유자 화면은 한국어입니다. 아이콘은 저장소의 승인된 `icon-512.png` 원본 바이트를 그대로 복사했습니다.

## 빌드와 검증

저장소 루트 PowerShell에서 실행합니다.

```powershell
& './scripts/build-android-sms-relay.ps1'
# APK를 새로 만들지 않고 Android API 컴파일과 합성 JVM 검증만 실행
& './scripts/build-android-sms-relay.ps1' -TestsOnly
# 네이티브 확장의 실제 production Java 합성 검사, SQLite DDL 검사, 전체 Android API 컴파일
node native/android-sms-relay/tests/verify-native.mjs
```

설치된 `OpenJDK/bin/javac.exe`, `java.exe`, `jar.exe`, `keytool.exe`, SDK36 `aapt2`, `core-lambda-stubs.jar`, D8, zipalign, apksigner만 사용합니다. 다운로드나 전역 설치를 하지 않습니다. 빌드 스크립트와 versionCode 옵션은 별도 빌드 담당자가 소유하며, 메인이 최종 소스를 동결한 뒤 동일 후보의 APK/AAB·서명·버전·bundle 검사를 수용합니다. 확장 검사기는 `work/android-studio-release/native-checks/<run>/`에 검증 소스 사본, SHA-256, 실제 명령과 출력, SQLite 파일, unsigned 리소스 검사 APK 및 결과를 보존합니다. 이 APK는 설치·배포용이 아닙니다.

RSA3072 서명 키는 `work/sms-flex-bridge/private-signing/relay-release.p12`에만 둡니다. 디렉터리 내부 `.gitignore`가 모든 파일을 제외하고 빌드가 Git 추적 여부를 확인합니다. 비밀번호는 현재 Windows 계정 DPAPI 암호문으로만 저장하며 도구에 환경 변수 이름으로 전달합니다. 디렉터리 ACL을 현재 계정으로 제한합니다. 동일 키를 보존해야 앱 업데이트가 가능하며, Windows 계정/기기 변경 시 DPAPI 암호문을 그대로 복호화할 수 없습니다. 키·암호문·디렉터리 내용을 Git에 추가하지 마세요.

## 처리 범위

- **스튜디오 관리 열기**는 `https://hlb.tllhouse.com/`만 열고 **개인정보 처리방침**은 `https://vocal-studio-sms-relay.affinity-agent-studio.workers.dev/privacy`만 엽니다. 기본 브라우저가 Custom Tabs를 지원하면 해당 브라우저의 일반 세션을 사용하고, 사용할 수 없으면 일반 브라우저로 돌아갑니다. 쿠키·인증 정보를 앱으로 추출하거나 토큰을 URL에 넣지 않으며, WebView/JavaScript bridge를 사용하지 않습니다. exported MainActivity는 외부 intent의 자격 정보나 URL을 소비하지 않습니다.
- 연결 주소가 비어 있을 때만 공개 relay origin을 입력칸에 미리 표시합니다. 저장된 다른 origin은 보존하며, 미리 채운 주소로 자동 연결·자동 토큰 생성·권한 동의는 하지 않습니다. 관리/개인정보 URL은 사용자가 입력한 relay origin과 분리되어 있습니다.
- 소유자가 HTTPS relay **origin**과 별도 pair token을 입력하고 문자 읽기·수신·발송 권한을 모두 허용한 뒤 **연결 시작**을 누릅니다. token은 비밀번호 필드와 앱 private prefs에만 존재합니다. URL query/path, 인증 토큰 출력, 클립보드 복사, 자동 완성, 스크린샷, Android 백업/기기 전송은 차단합니다.
- 네트워크가 가능한 약 15분 주기 JobScheduler와 수신/발송 결과/살아 있는 앱의 SMS provider observer가 요청하는 일회성 작업을 사용합니다. 부팅/업데이트 후 등록된 작업을 복구합니다. Doze·절전·강제 종료·제조사 정책·네트워크 상태에 따라 지연될 수 있으며 정확한 시각이나 상시 실행을 보장하지 않습니다.
- `/device/pull`에서 **새로운 전화번호 해시 allowlist**를 먼저 받습니다. `+82`/`0082`를 `0`으로 정규화하고 SHA-256을 비교한 뒤에만 본문을 큐에 저장/전송합니다. 수신 시 캐시 allowlist가 없으면 provider를 다음 작업에서 읽어 복구합니다. 전송 직전에도 최신 allowlist를 다시 검사합니다.
- SMS provider 쿼리는 **연결 시작 이후** `date>=boundary AND type IN (1,2)`로 제한합니다. 전체 휴대폰 과거 문자, 연락처, 다른 앱 알림을 읽지 않습니다. 해당 시작 구간의 현재 받은 문자와 native 문자 앱의 수동 발신을 처리합니다. multipart 수신은 방송의 순서대로 합칩니다. 표준 provider의 `date_sent`와 방송 PDU 시각으로 이벤트를 식별하며, 저장된 동일 ID/payload를 재전송합니다. OEM provider의 timestamp/creator 동작은 기기 검증이 필요합니다.
- 발신 SMS provider 행의 `creator`가 이 앱의 package와 정확히 같을 때만 자동 발신으로 제외합니다. 다른 앱 또는 미확인 creator의 행은 전화번호·본문·시각이 자동 발신 journal과 같아도 보존합니다. creator가 없는 자동 발신은 이 기준만으로 구분할 수 없으며 실제 provider 동작은 기기 수용 검사 대상입니다. 받은/수동 발신 이벤트를 서버에 반영한 다음 대기 follow-up을 claim하므로 서버가 답장 여부를 다시 검사할 수 있습니다.
- 기기 HTTP는 HTTPS의 `/device/pull`, `/device/event`, `/device/claim`, `/device/ack`, `/device/call`과 `Authorization: Bearer`만 사용합니다. redirect와 오류 응답 본문 출력은 금지합니다. private SQLite는 이벤트와 발송 상태/ACK를 디스크에 동기 기록합니다. 외부 SDK, 고객/공개 달력 경로, SMS 클라우드 전송을 사용하지 않습니다.
- 발송은 로컬 `claimRequested` 영구 예약 → 서버의 한 번만 가능한 claim → 로컬 `attemptStarted` 영구 기록 → `SmsManager` 순서입니다. 기본 발신 SIM이 선택되어 있어야 합니다. 예약/기록/claim 이후 중단해도 자동 발송을 다시 시도하지 않습니다. 모든 part callback이 모여야 `sent`/`failed`; 10분 넘게 callback/claim 응답이 불명확하면 `unknown`으로 ACK만 전송합니다. 이 ACK는 modem 인계 상태이며 수신자 도착 확인이 아닙니다.
- 이벤트/ACK 네트워크 오류에는 동일 payload를 재시도합니다. 이미 취소/삭제된 claim에 대한 명확한 ACK 거절은 로컬에서 종료하며 다른 메시지 처리를 막지 않습니다. 네트워크 5xx/429는 종료하지 않습니다. 401/403은 실패한 요청의 generation이 현재 연결과 일치할 때만 token 폐기와 작업 중지로 처리합니다. 중지 후 새 token으로 다시 시작했다면 이전 요청의 오류는 새 token·allowlist·작업을 지우지 않습니다. generation 비교와 중지는 시작과 같은 lock 안에서 처리합니다.
- **연결 중지**는 token을 지우고 작업을 취소합니다. 진행 중 네트워크 응답 이후에도 현재 활성 상태를 다시 검사하므로 새 modem 호출을 막습니다. 이미 modem에 넘긴 SMS는 취소할 수 없습니다. 중지 이전 pending 이벤트/ACK는 새 연결에 섞어 전송하지 않습니다. 로컬 tombstone은 동일 outbox ID를 다시 보내지 못하게 보존합니다.

## 선택적 수신 전화 연결

Android 10(API29) 이상에서 소유자가 한국어 설명을 읽고 **수신 전화 연결에 동의하기**를 선택한 뒤 공식 `ROLE_CALL_SCREENING` 역할을 선택합니다. 이 선택은 휴대폰의 전화 식별 제공자를 변경합니다. 기본 동의는 꺼져 있으며 새 연결을 시작할 때도 다시 꺼집니다. 역할을 이미 보유하고 있어도 별도 명시적 동의가 필요합니다. 취소·역할 미지원·연락처 권한 거절은 문자와 스튜디오 관리를 막지 않습니다. 연결 끄기는 앱의 동의만 해제하며, 전화 식별 제공자 변경은 소유자가 Android 기본 앱 설정에서 선택합니다.

`StudioCallScreeningService`는 수신 통화에 응답하는 첫 단계에서 차단·거절·무음·기록 숨김·알림 숨김을 모두 false로 허용합니다. 그 이전에는 preferences, lock, 역할 검사, SQLite, 스케줄러, 네트워크를 사용하지 않습니다. API26~28에 OS가 서비스를 호출하더라도 API24의 허용 응답만 실행하고 metadata 처리는 하지 않으며 `setSilenceCall`은 API29 이상에서만 호출합니다. 발신·숨김·유효하지 않은 번호와 연결/동의 경계 이전 통화는 기록하지 않습니다. 통화 음성 및 과거 CallLog를 읽지 않습니다.

선택적 `READ_CONTACTS`는 Android가 저장된 연락처의 수신 전화를 이 서비스에 전달하도록 하는 용도입니다. 앱은 연락처 provider를 조회하거나 업로드하지 않습니다. 허용하지 않으면 Android가 저장 연락처의 전화를 전달하지 않을 수 있습니다. 권한 요청은 통화 동의와 별도의 안내·버튼을 사용합니다.

`/device/pull`의 `callIntake.enabled`와 `includeUnknown`은 실제 JSON boolean만 허용합니다. 누락된 구형 응답·null·문자열·숫자·잘못 저장된 call 설정은 통화를 비활성화하며 기존 SMS 처리는 유지합니다. 기본은 unknown 미포함입니다. 현재 연결 generation, 지역 동의/역할, 서버 설정, 최신 전화번호 해시를 모두 확인합니다.

SQLite v2는 기존 SMS 테이블을 유지하고 별도 `calls` 테이블을 추가합니다. ID·정규화 번호·원래 수신 시각·incoming 방향·generation·동의 epoch·boundary를 보존하며 중복 callback은 payload를 덮어쓰지 않습니다. 네트워크 재시도에서 동일 `{id,phone,receivedAt,direction:'incoming'}`만 `/device/call`로 전송합니다. 전송 직전 현재 generation/동의/역할/설정/allowlist를 다시 검사합니다. 관찰된 역할/동의/설정 해제는 epoch를 바꾸어 이전 큐를 재활성화하지 않습니다. 오래된 연결의401/403은 새로운 token이나 작업을 중지하지 않습니다. 일시적인 네트워크 오류와 job 취소는 재시도 payload를 보존합니다. 통화 이벤트는 SMS 이벤트·reply·claim·예약 경로로 전달하지 않습니다.

이미 네트워크로 전송된 요청은 로컬에서 취소할 수 없으므로 서버도 인증·설정을 transaction 안에서 다시 확인해야 합니다. OS가 역할 변경을 앱에 보여 주는 시점, 실제 SQLite 영속성 및 process death는 기기 검사 대상입니다.

공식 근거: [CallScreeningService](https://developer.android.com/reference/android/telecom/CallScreeningService), 2026-10-04 확인. 공식 문서는 user-selected role, 수신 응답 5초 제한, 연락처 권한 조건, tel/번호 표시 조건을 명시합니다. 이 구현의 API 컴파일은 전화 수신·역할 UI·브라우저 로그인 유지의 물리 기기 증거가 아닙니다.

## 검증 경계와 실제 기기 게이트

`RelayCoreTest`는 실제 production `RelayPolicy`/`SendCoordinator`/`RelayConfig`를 JVM에서 실행합니다. 기존 55개 privacy/multipart/crash 순서 검사를 유지하며, 메모리 SharedPreferences와 scheduler double 및 held thread로 이전 401/403과 새 연결의 경쟁 조건을 추가 검증합니다. `NativeCallTest`는 production call 정책·설정·서비스·forwarder·RelayEngine·ManagementLauncher를 합성 Android/transport/storage 표면에서 실행합니다. I/O가 허용 응답보다 먼저 실행되면 실패하고 API26에서 API29 silence 메서드를 호출해도 실패합니다. 동의/역할 철회, 오래된 generation401, strict booleans/구형 pull, 정확한 API body, retry payload와 고정 URL/fallback을 확인합니다. 별도 Node SQLite 검사는 production DDL의 추가 migration, 중복 불변성, reopen과 generation/boundary를 실행합니다. host double은 APK에 포함하지 않습니다. provider 쿼리의 시작 경계와 반복 수동 문자 사례는 `node --test scripts/sms-manager.test.mjs`의 in-memory SQLite 및 source guard로 확인합니다. 실제 Android SQLite fsync, process death, JobScheduler, permission UI, broadcast PDU, native provider observer, SIM/modem은 이 검사의 대상이 아닙니다.

이 확장 작업에서는 설치·기기 제어·고객 SMS/통화 테스트를 하지 않았습니다. Android READ_SMS/RECEIVE_SMS는 hard-restricted 권한이므로 설치 경로/installer allowlist에 따라 일반 권한 대화상자만으로 허용되지 않을 수 있습니다. 실제 소유자 설치 경로에서 문자 권한, 기본 발신 SIM, 표준 multipart SMS/수동 답장, 통화 역할·연락처 동의 취소/허용, 알려진/미등록/숨김 번호, 브라우저 로그인 유지, offline/reboot/process death/절전/stop/revoke를 부모의 기기 수용 검사에서 확인해야 합니다. 제한 우회나 default SMS 앱 역할 강제 변경은 구현하지 않습니다.

Google/Samsung **RCS 채팅 및 MMS는 지원 대상으로 포함되지 않습니다**. RCS가 표준 SMS 저장소/방송에 나타나는지, Samsung provider의 표준 column과 PDU 시각이 일치하는지, Samsung 절전 상태의 실제 실행 지연은 실제 기기에서 미검증입니다. 임의 알림 수집으로 대체하지 않습니다. 백엔드와 웹 UI의 통합 수용 및 APK 배포 자산 연결은 부모 담당입니다.
