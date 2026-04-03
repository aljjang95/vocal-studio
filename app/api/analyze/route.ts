import { NextResponse } from 'next/server';
import { ApiError } from '@/types';

// ── Phase 1: 미구현 엔드포인트 ────────────────────────────────
// 이 엔드포인트는 Phase 2(Supabase Auth + Web Audio API) 연동 전까지
// 모든 요청에 501 Not Implemented를 반환합니다.
//
// ⚠️ Phase 2 구현 체크리스트 (이 주석을 지우기 전에 모두 완료할 것):
//   □ lib/supabase/server.ts의 createClient() 연결 확인
//   □ getUser()로 세션 토큰 검증 (body.userId 절대 신뢰 금지)
//   □ analysis_results 테이블 스키마 마이그레이션 완료
//   □ RLS 정책: "자신의 행만 INSERT 가능" 설정 확인
//   □ Web Audio API pitchfinder 연동 완료
//
// Phase 2 구현 예시:
//   import { createClient } from '@/lib/supabase/server';
//   const supabase = createClient();
//   const { data: { user }, error } = await supabase.auth.getUser();
//   if (error || !user) return NextResponse.json({ error: '인증이 필요합니다.', code: 'UNAUTHORIZED' }, { status: 401 });
//   const userId = user.id; // ← body.userId 절대 신뢰 금지, 반드시 이 값 사용

export async function POST(): Promise<NextResponse<ApiError>> {
  return NextResponse.json(
    {
      error: '음성 분석 기능은 준비 중입니다.',
      code: 'NOT_IMPLEMENTED',
    },
    { status: 501 }
  );
}
