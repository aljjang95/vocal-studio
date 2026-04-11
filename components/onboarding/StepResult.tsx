'use client';

import { useOnboardingStore } from '@/stores/onboardingStore';
import MetricBar from '@/components/ds/MetricBar';
import Button from '@/components/ds/Button';

function scoreColor(value: number): string {
  if (value <= 30) return 'var(--success)';
  if (value <= 60) return 'var(--warning)';
  return 'var(--error)';
}

function scoreTextClass(value: number): string {
  if (value <= 30) return 'text-[var(--success)]';
  if (value <= 60) return 'text-[var(--warning)]';
  return 'text-[var(--error)]';
}

function scoreLabel(value: number): string {
  if (value <= 20) return '매우 양호';
  if (value <= 40) return '양호';
  if (value <= 60) return '보통';
  if (value <= 80) return '긴장 감지';
  return '높은 긴장';
}

export default function StepResult() {
  const { result, setStep } = useOnboardingStore();
  if (!result) return null;

  const { tension, consultation } = result;

  return (
    <div className="animate-[slideIn_0.4s_ease-out]">
      <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold mb-2">분석 결과</h3>
      <p className="text-[0.9rem] text-[var(--text2)] mb-7 leading-relaxed">AI가 목소리에서 감지한 긴장 상태입니다.</p>

      <div className="flex items-center gap-5 p-6 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r-sm)] mb-7">
        <div>
          <div className={`font-mono text-[2.4rem] max-[560px]:text-[2rem] font-bold leading-none ${scoreTextClass(tension.overall)}`}>
            {Math.round(tension.overall)}
          </div>
          <div className="text-[0.85rem] text-[var(--text2)]">종합 긴장도</div>
          <div className="text-[0.78rem] text-[var(--muted)] mt-1">{scoreLabel(tension.overall)}</div>
        </div>
      </div>

      <div className="mb-7">
        <div className="text-[0.88rem] font-semibold text-[var(--text2)] mb-4">부위별 긴장도</div>
        <MetricBar label="후두 긴장" value={tension.laryngeal} color={scoreColor(tension.laryngeal)} />
        <MetricBar label="혀뿌리 긴장" value={tension.tongue_root} color={scoreColor(tension.tongue_root)} />
        <MetricBar label="턱 긴장" value={tension.jaw} color={scoreColor(tension.jaw)} />
        <MetricBar label="성구전환" value={tension.register_break} color={scoreColor(tension.register_break)} />
      </div>

      {consultation.problems.length > 0 && (
        <div className="mb-7">
          <div className="text-[0.88rem] font-semibold text-[var(--text2)] mb-4">발견된 문제점</div>
          <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
            {consultation.problems.map((problem, i) => (
              <li key={i} className="px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)] text-[0.88rem] text-[var(--text2)] leading-normal">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end mt-8">
        <Button variant="primary" size="lg" onClick={() => setStep(3)}>
          맞춤 로드맵 보기
        </Button>
      </div>
    </div>
  );
}
