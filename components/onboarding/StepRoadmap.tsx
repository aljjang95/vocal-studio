'use client';

import { useRef } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import Button from '@/components/ds/Button';

export default function StepRoadmap() {
  const { result, isPlayingTts, setPlayingTts, setStep } = useOnboardingStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!result) return null;
  const { consultation } = result;

  const playTts = async () => {
    setPlayingTts(true);
    try {
      const res = await fetch('/api/onboarding-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: consultation.summary }),
      });
      if (!res.ok) throw new Error('TTS 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingTts(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlayingTts(false);
        audioRef.current = null;
      };
      audio.play();
    } catch {
      setPlayingTts(false);
    }
  };

  const stopTts = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingTts(false);
  };

  return (
    <div className="animate-[slideIn_0.4s_ease-out]">
      <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold mb-2">맞춤 로드맵</h3>
      <p className="text-[0.9rem] text-[var(--text2)] mb-7 leading-relaxed">AI가 추천하는 학습 순서입니다.</p>

      <ol className="list-none p-0 m-0 mb-7 flex flex-col gap-3">
        {consultation.roadmap.map((item, i) => (
          <li key={i} className="flex items-start gap-3.5 p-4 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r-xs)]">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] font-mono text-[0.78rem] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-[0.88rem] text-[var(--text2)] leading-normal">{item}</span>
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3 px-5 py-4 bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.2)] rounded-[var(--r-xs)] mb-7">
        <span className="text-[0.82rem] text-[var(--text2)]">추천 시작 단계:</span>
        <span className="font-mono text-[0.88rem] font-bold text-[var(--accent-lt)]">Stage {consultation.suggested_stage_id}</span>
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)] text-[var(--text2)] text-[0.85rem] font-[var(--font-sans)] cursor-pointer transition-all duration-200 mb-7 hover:enabled:border-[var(--border2)] hover:enabled:text-[var(--text)] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={isPlayingTts ? stopTts : playTts}
        disabled={false}
      >
        {isPlayingTts ? '\u23F9 재생 중지' : '\u25B6 상담 요약 듣기'}
      </button>

      <div className="flex justify-end mt-8">
        <Button variant="primary" size="lg" onClick={() => setStep(4)}>
          첫 레슨 시작하기
        </Button>
      </div>
    </div>
  );
}
