# Phase 13 Design System Extension — 아바타 육성 + 소셜

기존 Deep Forest 디자인 시스템을 확장하여 Phase 13 신규 페이지를 설계.
기존 토큰(globals.css)을 그대로 사용하며, 신규 토큰은 최소한만 추가.

## 디자인 원칙

1. **기존 시스템 일관성**: --bg-base, --accent, --text-primary 등 기존 CSS 변수 재사용
2. **AI 클리셰 금지**: 네온 글로우, 사이버펑크, 보라 그라디언트, 뻔한 AI 미학 절대 금지
3. **자연스러운 프리미엄**: Deep Forest 톤 유지 — 어두운 배경 위 절제된 그린 액센트
4. **공유 가능한 정체성**: DNA 카드는 Spotify Wrapped처럼 대담하고 개인적인 느낌
5. **기능적 미니멀**: 데이터는 시각적으로, UI는 깔끔하게

## 신규 CSS 변수 (globals.css 추가분)

```css
/* ── Phase 13: DNA Card ── */
--dna-star:      #A8D4B8;           /* 별자리 꼭짓점 색상 */
--dna-line:      rgba(168,212,184,0.4); /* 별자리 연결선 */
--dna-fill:      rgba(91,140,110,0.15); /* 별자리 내부 채우기 */
--dna-bg:        #060A08;           /* 카드 배경 (base보다 더 깊은) */

/* ── Phase 13: Rank/Badge ── */
--rank-gold:     #D4A857;           /* 1위 (과도한 금색 금지, 머스타드 톤) */
--rank-silver:   #8A9A90;           /* 2위 (기존 text-secondary 활용) */
--rank-bronze:   #A0785A;           /* 3위 (따뜻한 브론즈) */

/* ── Phase 13: Vote ── */
--vote-active:   var(--accent-bright); /* 투표한 상태 */
--vote-inactive: var(--text-muted);    /* 미투표 */
```

## F1: 음색 DNA 카드

### 레이아웃
```
┌─────────────────────────────────┐
│  DNA 카드 (고정 비율 3:4)        │
│  ┌──────────────────────────┐   │
│  │  [별자리 Canvas]          │   │
│  │   오각형 레이더 차트       │   │
│  │   꼭짓점: 별 아이콘 + 라벨 │   │
│  │   내부: 반투명 채우기      │   │
│  └──────────────────────────┘   │
│  사용자명                       │
│  음역대: G2 ~ E5 | 음색 유형    │
│  ────────────────────────────   │
│  [공유] [다시 분석]              │
└─────────────────────────────────┘
```

### 별자리 Canvas 스타일
- **배경**: --dna-bg (#060A08) — 밤하늘 느낌이지만 과도한 우주 연출 금지
- **별 (꼭짓점)**: 원(r=4px) + shadowBlur(8px, --dna-star) — 은은한 글로우만
- **연결선**: --dna-line, lineWidth 1.5px, 직선 연결
- **내부 면적**: --dna-fill, 반투명 그린
- **라벨**: --text-secondary, font-size 11px, 각 꼭짓점 바깥에 배치
- **5축**: 후두 / 혀뿌리 / 턱 / 성구전환 / 음색안정
- **점수 표시**: 각 축 0~100, 꼭짓점 근처에 작은 숫자

### 공유 카드 (PNG 생성용)
- 크기: 1080x1350px (Instagram 권장 비율)
- 상단 1/3: 별자리 시각화
- 중간: 사용자 이름 + 음색 유형 (큰 서체, Crimson Pro)
- 하단: 5축 수치 바 + HLB 로고 워터마크
- 배경: --dna-bg + 미세한 grain texture (body::after와 동일)

## F2: 아바타 + 의상 시스템

### 아바타 표시 영역
```
┌────────────────────────────────────┐
│  [아바타 프리뷰]                    │
│  ┌────────────┐  ┌──────────────┐  │
│  │  base.png  │  │  장착 정보    │  │
│  │  + layers  │  │  모자: OO     │  │
│  │  (300x400) │  │  상의: OO     │  │
│  │            │  │  하의: OO     │  │
│  └────────────┘  │  액세서리: OO │  │
│                  └──────────────┘  │
│  [아바타 변경]  [상점]              │
└────────────────────────────────────┘
```

### 아바타 디스플레이
- 컨테이너: 고정 비율 (3:4), max-width 280px
- base 이미지: object-fit: cover, border-radius: var(--radius-lg)
- 레이어 합성: position absolute, z-index 순서 (base=1, bottom=2, top=3, hat=4, accessory=5)
- 배경: --bg-elevated, 미세한 border (--border-subtle)
- 그림자: 없음 (flat design 유지)

### 아이템 상점
```
[카테고리 탭: 전체 | 모자 | 상의 | 하의 | 액세서리 | 이펙트]
┌────┐ ┌────┐ ┌────┐ ┌────┐
│ 🧢 │ │ 👕 │ │ ✨ │ │ 🎭 │
│아이템│ │아이템│ │아이템│ │아이템│
│1,000│ │500 │ │2,000│ │1,500│
│ [구매]│ │[구매]│ │[시즌]│ │[구매]│
└────┘ └────┘ └────┘ └────┘
```

- 그리드: 4열 (데스크톱), 2열 (모바일)
- 아이템 카드: --bg-raised, border --border-subtle, radius var(--radius-md)
- 시즌 한정: 좌상단에 작은 뱃지 (--rank-gold 배경, "한정" 텍스트)
- 가격: --text-primary, font-weight 600
- 구매 버튼: 기존 btn-primary 스타일 축소판
- 장착 중 표시: 체크마크 오버레이 (--accent-bright)

## F3: 커뮤니티 피드

### 피드 레이아웃
```
[탭: 최신 | 인기 | 배틀]
┌─────────────────────────────────┐
│  ┌──┐  username · 2시간 전      │
│  │🎤│  곡: [노래 제목] - 아티스트 │
│  └──┘                           │
│  ┌──────────────────────────┐   │
│  │  ▶ ━━━━━━━━━━━━━━  2:34  │   │
│  └──────────────────────────┘   │
│  설명 텍스트...                  │
│  ♥ 42  ▶ 128         [투표]     │
└─────────────────────────────────┘
```

### 피드 카드 스타일
- 카드: --bg-raised, border-bottom 1px --border-subtle (카드 간 구분)
- 카드 간격: 0px (연속형 피드, 별도 카드 분리 없음)
- 프로필 영역: 아바타 미니(36px 원형) + 이름(--text-primary, 600) + 시간(--text-muted, fs-xs)
- 오디오 플레이어: 커스텀 progress bar, --accent 색상, 높이 4px, rounded
- 재생 버튼: 원형 40px, --accent 배경, 삼각형 아이콘 #fff
- 투표 버튼: ♥ 아이콘, 미투표=--vote-inactive, 투표완료=--vote-active + scale 애니메이션
- 투표 수: --text-secondary, fs-sm
- 재생 수: --text-muted, fs-xs

### 탭 스타일
- 밑줄형 탭 (underline indicator)
- 활성 탭: --text-primary + 하단 2px --accent 라인
- 비활성 탭: --text-muted
- 전환 애니메이션: indicator slide 0.3s ease-out-expo

### 배틀 카드 (특수)
```
┌─────────────────────────────────┐
│  [유저A 아바타]  VS  [유저B 아바타] │
│  곡: [노래 제목]                 │
│  ┌──────┐     ┌──────┐         │
│  │ ▶ A  │     │ ▶ B  │         │
│  └──────┘     └──────┘         │
│  [A에 투표]    [B에 투표]         │
│  ━━━━━━━━ 58% ━━━━ 42%         │
└─────────────────────────────────┘
```
- VS 텍스트: --text-muted, font-size 0.75rem, 수직 중앙
- 투표 비율 바: 좌측 --accent, 우측 --text-muted, 높이 6px, rounded
- 투표 완료 시: 선택한 쪽 강조 (--accent-bright border)

## F4: 주간 오디션

### 오디션 배너
```
┌─────────────────────────────────┐
│  이번 주 오디션                   │
│  "사랑은 늘 도망가" — 임영웅      │
│  마감까지: 3일 14:22:08          │
│  참가자 47명 | 총 투표 312        │
│  [참가하기]                      │
└─────────────────────────────────┘
```

- 배너: --bg-elevated, border --border-default, radius var(--radius-lg)
- 제목: "이번 주 오디션" — section-kicker 스타일 (uppercase, accent, 작은 bar)
- 곡 정보: Crimson Pro (--font-display), --fs-h2, --text-primary
- 카운트다운: monospace (--font-mono), --accent-bright, fs-h3
- 통계: --text-secondary, fs-sm
- 참가 버튼: btn-primary (기존)

### 리더보드
```
┌─────────────────────────────────┐
│  👑 1위  username    ♥ 89       │
│  ───────────────────────────── │
│  🥈 2위  username    ♥ 67       │
│  🥉 3위  username    ♥ 45       │
│  ───────────────────────────── │
│  4.  username        ♥ 32       │
│  5.  username        ♥ 28       │
└─────────────────────────────────┘
```

- TOP 3: 강조 행 (--bg-elevated + 좌측 3px border)
  - 1위: border-left --rank-gold
  - 2위: border-left --rank-silver
  - 3위: border-left --rank-bronze
- 왕관/메달: 텍스트 이모지 아님, lucide-react Crown 아이콘 + color
- 나머지: 기본 행 스타일
- 투표 수: 우측 정렬, --text-secondary
- 내 순위 강조: --accent-muted 배경

### 오디션 타이머
- 숫자: --font-mono, --accent-bright, 큰 사이즈 (fs-h2)
- 구분자 (:) : --text-muted
- "일 시간:분:초" 형식
- 마감 24시간 이내: --error 색상으로 전환

## 공통 컴포넌트

### UserProfileCard (미니 프로필)
```
┌────────────────────────┐
│  [아바타 48px]  이름     │
│               DNA 미니  │
│               등급 뱃지  │
└────────────────────────┘
```
- 아바타: 원형 48px, border 2px --border-subtle
- 이름: --text-primary, font-weight 600, fs-body
- DNA 미니: 30px 원 안에 초소형 레이더 (Canvas, 색상만, 라벨 없음)
- 등급 뱃지: pill shape, --bg-elevated, --text-secondary, fs-xs

### AudioPlayer (공통 오디오)
- 높이: 48px
- 재생 버튼: 원형 36px, --accent, 삼각형 #fff
- Progress bar: 높이 4px, --accent track / --bg-hover 배경
- 시간: --text-muted, --font-mono, fs-xs
- Hover: progress bar 높이 6px로 확장 (transition 0.2s)

### 게시글 작성 (PostComposer)
```
┌─────────────────────────────────┐
│  [아바타] 무슨 노래를 불렀나요?    │
│  ────────────────────────────── │
│  곡 제목: [           ]         │
│  아티스트: [           ]        │
│  ────────────────────────────── │
│  [🎤 녹음] 또는 [📁 파일]        │
│  ┌──────────────────────────┐  │
│  │  ▶ ━━━━━━━━━━━━━  1:22   │  │
│  └──────────────────────────┘  │
│  [게시]                         │
└─────────────────────────────────┘
```
- 전체: --bg-raised, radius var(--radius-lg), padding 24px
- 입력: 기본 input 스타일 (border --border-default, --bg-base)
- 녹음 버튼: 원형 56px, --error 배경 (기존 recPulse 애니메이션 재사용)
- 게시 버튼: btn-primary

## 반응형 (모바일 375px)

### 전역 조정
- 컨테이너 padding: 16px
- 카드 padding: 16px (데스크톱 24px → 모바일 16px)

### 페이지별
- **DNA 카드**: 전체 너비, Canvas max-width 320px 중앙
- **아바타 에디터**: 아바타+정보 → 세로 스택, 상점 그리드 2열 유지
- **커뮤니티 피드**: 전체 너비, 탭 스크롤 없이 고정
- **오디션 배너**: padding 축소, 카운트다운 크기 축소 (fs-h3 → fs-body)
- **배틀 카드**: VS 양쪽 → 위아래 스택

## 네비게이션 통합

### 데스크톱 NavBar (기존 확장)
- 메뉴 추가: "커뮤니티" | "오디션"
- 프로필 드롭다운에: "음색 DNA" | "아바타"
- 기존 NavBar 스타일 그대로 유지

### 모바일 하단 네비게이션
- 기존 탭이 있다면 "커뮤니티" 아이콘 추가
- lucide-react: Users (커뮤니티), Trophy (오디션), Dna (DNA), User (아바타)

## 애니메이션

### DNA 카드 등장
1. 별자리 점들이 하나씩 나타남 (stagger 0.1s each, fadeIn + scale)
2. 연결선이 순차적으로 그려짐 (stroke-dasharray → dashoffset 0)
3. 내부 면적 채워짐 (opacity 0 → 0.15, 0.5s delay)

### 투표
- 하트 클릭: scale(1 → 1.3 → 1) + color transition, 0.3s
- 투표 수 증가: 숫자 slide-up 전환

### 피드 무한스크롤
- 새 카드 등장: slideIn (기존 keyframe), stagger 50ms

### 오디션 카운트다운
- 초 변경: 숫자 flip 효과 (rotateX)

## 금지 사항

- 네온 글로우, 사이버펑크 그라디언트, 보라색 배색
- 과도한 3D 효과, parallax, particle system
- AI 생성물 느낌의 대칭적 우주/별 배경
- 이모지를 아이콘 대신 사용 (lucide-react 사용)
- 인라인 #hex 색상 (CSS 변수 사용)
- 새로운 폰트 추가 (기존 Crimson Pro + Inter + Noto 유지)
