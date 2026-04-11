'use client';

import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import Button from '@/components/ds/Button';

export default function StepTransition() {
  const router = useRouter();
  const { result } = useOnboardingStore();

  const suggestedStage = result?.consultation.suggested_stage_id ?? 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-6 text-center animate-[fadeIn_0.5s_ease-out]">
      <h3 className="font-['Inter',sans-serif] text-[1.6rem] font-bold">
        레슨을 시작할 준비가 됐어요
      </h3>
      <p className="text-[0.9rem] text-[var(--text2)] leading-relaxed max-w-[420px]">
        분석 결과를 바탕으로 최적의 시작점을 추천합니다.
      </p>

      <div className="px-7 py-4 bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.2)] rounded-[var(--r-xs)] text-[0.88rem] text-[var(--accent-lt)]">
        <div className="text-[0.78rem] text-[var(--text2)] mb-1">추천 시작 단계</div>
        <div className="font-mono font-bold text-[1.1rem]">Stage {suggestedStage}</div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[320px]">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => router.push(`/journey/${suggestedStage}`)}
        >
          추천 단계로 시작하기
        </Button>
        <button
          type="button"
          className="bg-transparent border-none text-[var(--text2)] text-[0.85rem] font-[var(--font-sans)] cursor-pointer py-2 transition-colors duration-200 hover:text-[var(--text)]"
          onClick={() => router.push('/journey/1')}
        >
          처음부터 시작하기
        </button>
      </div>
    </div>
  );
}
