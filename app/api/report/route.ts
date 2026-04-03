import { NextResponse } from 'next/server';
import { ApiError } from '@/types';

// ── Phase 1: 미구현 엔드포인트 ────────────────────────────────
// 이 엔드포인트는 Phase 2(Supabase Auth + 주간 리포트 생성) 연동 전까지
// 모든 요청에 501 Not Implemented를 반환합니다.
//
// ⚠️ Phase 2 구현 체크리스트 (이 주석을 지우기 전에 모두 완료할 것):
//   □ lib/supabase/server.ts의 createClient() 연결 확인
//   □ getUser()로 세션 토큰 검증
//   □ weekly_reports 테이블 스키마 마이그레이션 완료
//   □ RLS 정책: "자신의 리포트만 SELECT/INSERT 가능" 설정 확인
//   □ AI 리포트 생성 로직 완료 (lib/anthropic.ts 사용)
//
// Phase 2 GET 구현 예시:
//   const { data: { user } } = await supabase.auth.getUser();
//   if (!user) return 401;
//   const { data } = await supabase.from('weekly_reports')
//     .select('*').eq('user_id', user.id).order('week_start', { ascending: false }).limit(1);
//
// Phase 2 POST 구현 예시:
//   AI 생성 → anthropic.messages.create() → supabase INSERT

export async function GET(): Promise<NextResponse<ApiError>> {
  return NextResponse.json(
    {
      error: '성장 리포트 기능은 준비 중입니다.',
      code: 'NOT_IMPLEMENTED',
    },
    { status: 501 }
  );
}

export async function POST(): Promise<NextResponse<ApiError>> {
  return NextResponse.json(
    {
      error: '성장 리포트 생성 기능은 준비 중입니다.',
      code: 'NOT_IMPLEMENTED',
    },
    { status: 501 }
  );
}
