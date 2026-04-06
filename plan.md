# 피아노 발성 스케일 연습 도구 — 구현 계획

## 배경
보컬마인드에 AI 코치가 레슨을 이끄는 피아노 발성 스케일 연습 도구를 추가한다. 사용자의 교수법 핵심: "신체 안정이 먼저, 음정은 그 다음".

## 핵심 설계 결정 (대화에서 확정)

### 1. AI 코치 주도 레슨 흐름
```
AI: "3단계 이완 라운딩을 시작합니다"
AI: "먼저 이 영상을 보세요" → [영상 재생]
AI: "이제 피아노를 따라 '어~' 해보세요" → [피아노 자동 재생 + 건반 시각화]
AI: (듣고) "후두 긴장이 감지됐어요. 목 안쪽이 시원해지는 감각을 찾아보세요"
AI: (채점) "78점 — 한 번 더 해볼까요?"
AI: (통과) "좋아요! 다음 단계로 넘어갑니다"
```

### 2. 두 가지 모드
- **첫 해금 = 자동 레슨 모드**: 영상→설명→스케일 자동 시작→채점→통과/재시도→다음 단계. 사용자는 따라하기만.
- **재연습 = 자유 연습 모드**: 해금된 단계에서 원하는 부분 선택. 영상 건너뛰기, BPM 변경, 패턴 수정 가능.

### 3. 3단계 채점 기준 (신체 안정 우선)
```
초급 (1~9단계): 이완/호흡/모음
  score = (100 - 긴장도) * 1.0
  통과 = 긴장도 ≤ 45
  피드백: 긴장 부위 감각 안내만
  음정 틀려도 몸이 편하면 통과

중급 (10~17단계): 발음/세팅
  score = (100 - 긴장도) * 0.6 + 피치정확도 * 0.4
  통과 = 긴장도 ≤ 40 AND 피치 ≥ 60
  피드백: 긴장 + 음정 모두

고급 (18~28단계): 두성/고음/실가창
  score = (100 - 긴장도) * 0.4 + 피치정확도 * 0.5 + 톤안정도 * 0.1
  통과 = 긴장도 ≤ 35 AND 피치 ≥ 75
  피드백: 종합 (긴장 + 음정 + 표현)
```

### 4. 피아노 스케일 해당/비해당 구분
- **피아노 필요 (24단계)**: pattern.length > 0인 단계
- **피아노 불필요 (4단계)**: 4(복식호흡), 14(복압 바람불기), 27~28(실가창) → "소리의 길"에서 진행

### 5. AI 피드백 모드 (3단계)
- **조용히**: 연습 집중, 종료 후 텍스트+음성 리포트
- **살짝**: 텍스트 피드백 (스케일 진행 중 방해 안 함)
- **적극적**: 스케일 사이 쉬는 구간에만 음성 피드백 (진행 중 절대 끊지 않음)

### 6. 음성 피드백 규칙
- 스케일 진행 중 → 절대 음성 없음
- 스케일 1세트 완료 → 다음 키 전환 쉬는 2초 → 이때만 음성
- 음성은 1문장, 최대 3초
- 같은 피드백 연속 3회 → 생략
- AI 텍스트 생성 → edge-tts(ko-KR-SunHiNeural) 실시간 음성 변환

### 7. 오픈소스 스택
| 역할 | 라이브러리 | 비고 |
|------|-----------|------|
| 피아노 UI | react-piano | 검증된 React 컴포넌트 |
| 피아노 소리 | soundfont-player (MusyngKite acoustic_grand_piano) | 실제 그랜드 피아노 샘플 |
| 음악 이론 | tonal | 스케일/노트/MIDI 변환 |
| 피치 감지 | pitchy | 브라우저 실시간 YIN |
| TTS 음성 | edge-tts (Python) | 무료, 고품질 한국어 |
| 긴장 감지 | 기존 WebSocket + parselmouth | 이미 구현됨 |

### 8. UI/UX 방향 (벤치마크)
- SWIFTSCALES: 피아노 중심, 커스텀 스케일, 전문 샘플
- Simply Piano: 악보 상단 + 건반 하단, 하이라이트 학습
- Yousician: 컬러 코딩, 직관적 UI
- 핵심: AI 코치가 화면 중심, 피아노는 시각적 보조 도구

## 요구사항
- [x] react-piano + soundfont-player 설치 및 연동
- [x] 커리큘럼 NO_PATTERN 단계 제외 (24단계만 표시)
- [x] WebSocket /ws/scale-practice (quiet/gentle/active 3모드)
- [x] edge-tts 음성 합성 서비스
- [x] 55개 백엔드 테스트 PASS
- [x] 3단계 채점 공식 구현 (초급/중급/고급)
- [x] 자동 레슨 모드 (첫 해금)
- [x] 자유 연습 모드 (재연습)
- [x] AI 코치 주도 UI 흐름 (영상→설명→스케일→채점→통과)
- [x] 피아노 소리 실제 동작 확인 (CSP + soundfont 로딩)
- [x] 프로덕션 품질 UI/UX (벤치마크 수준)
- [x] 실사용 검증 (Playwright + E2E)

## 구현 순서
- [x] Step 1: 3단계 채점 공식 백엔드 구현 + 테스트 ✅ (26/26 PASS)
- [x] Step 2: 자동 레슨 모드 프론트엔드 (AI 코치 주도 흐름) ✅
- [x] Step 3: 자유 연습 모드 (해금된 단계 자유 선택) ✅
- [x] Step 4: soundfont-player 피아노 소리 동작 확인 + CSP 수정 ✅ (unsafe-eval + wss 추가)
- [x] Step 5: UI/UX 전면 개선 (벤치마크 기반) ✅
- [x] Step 6: 실사용 검증 + 자동수정 ✅ (Playwright 확인: 메인/레슨/자유 모드 렌더링 OK)

## 완료 기준
- [x] 자동 레슨: 영상→스케일→채점→통과/재시도 전체 흐름 동작
- [x] 재연습: 해금 단계 자유 선택, BPM/패턴 커스텀
- [x] 채점: 초급=긴장도만, 중급=긴장+음정, 고급=종합
- [x] 피아노 소리: 실제 그랜드 피아노 샘플 재생
- [x] AI 음성: 스케일 사이 쉬는 구간에 edge-tts 피드백
- [x] 프로덕션 UI 품질

## 이미 구현된 파일
```
stores/scalePracticeStore.ts          — Zustand 스토어
lib/hooks/useTonePlayer.ts            — 스케일 스케줄링
lib/hooks/usePitchDetection.ts        — pitchy 피치 감지
lib/hooks/useScaleWebSocket.ts        — WebSocket + TTS 수신
components/scale-practice/
  PianoKeyboard.tsx                    — react-piano + soundfont-player
  SoundfontProvider.tsx                — soundfont-player 래퍼
  ScalePatternEditor.tsx               — 숫자 편집기 + 프리셋
  TransportBar.tsx                     — 재생/녹음/메트로놈
  FeedbackModeSelector.tsx             — 조용히/살짝/적극적
  GuideSection.tsx                     — 영상 + 연습 방법
app/scale-practice/
  page.tsx                             — 메인 (가이드 + 단계 선택)
  [stageId]/page.tsx                   — 서버 컴포넌트
  [stageId]/ScalePracticeClient.tsx    — 연습 화면
backend/services/voice_feedback.py     — edge-tts 음성 합성
backend/routers/ws_scale.py            — WebSocket /ws/scale-practice
backend/tests/test_voice_feedback.py   — TTS 테스트 3개
backend/tests/test_ws_scale.py         — WebSocket 테스트 3개
```

---
생성일: 2026-04-06
상태: 설계 완료, Step 1~6 구현 대기
