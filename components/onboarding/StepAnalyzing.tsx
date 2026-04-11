'use client';

import { useState, useEffect } from 'react';

const PHASES = [
  '음성 파일을 처리하고 있어요',
  '긴장도를 측정하고 있어요',
  'AI 상담 결과를 생성하고 있어요',
];

export default function StepAnalyzing() {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex((prev) => Math.min(prev + 1, PHASES.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-6 text-center animate-[fadeIn_0.5s_ease-out]">
      <div className="w-14 h-14 border-[3px] border-[var(--border)] border-t-[var(--accent)] rounded-full animate-[spin_0.8s_linear_infinite]" />
      <h3 className="font-['Inter',sans-serif] text-[1.3rem] font-bold">
        AI가 목소리를 분석하고 있어요
      </h3>
      <p className="text-[0.88rem] text-[var(--text2)] leading-relaxed">잠시만 기다려주세요.</p>
      <div className="flex flex-col gap-2 mt-2">
        {PHASES.map((label, i) => (
          <span
            key={label}
            className={`text-[0.82rem] transition-colors duration-300 ${
              i === phaseIndex
                ? 'text-[var(--accent-lt)] font-semibold'
                : i < phaseIndex
                ? 'text-[var(--success-lt)]'
                : 'text-[var(--muted)]'
            }`}
          >
            {i < phaseIndex ? '\u2713 ' : i === phaseIndex ? '\u25B6 ' : ''}{label}
          </span>
        ))}
      </div>
    </div>
  );
}
