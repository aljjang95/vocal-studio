'use client';

import type { CoachingFeedback, EvaluationResult } from '@/types';

interface FeedbackPanelProps {
  evaluation: EvaluationResult | null;
  coaching: CoachingFeedback | null;
  isLoading: boolean;
}

export default function FeedbackPanel({ evaluation, coaching, isLoading }: FeedbackPanelProps) {
  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border)]">
        <div className="h-4 bg-[var(--bg-hover)] rounded w-3/4 mb-2" />
        <div className="h-4 bg-[var(--bg-hover)] rounded w-1/2" />
      </div>
    );
  }
  if (!evaluation) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-elevated)]/50 border border-[var(--border)]">
        <div className={`text-[1.875rem] font-bold ${evaluation.passed ? 'text-[var(--success)]' : 'text-[var(--streak-gold)]'}`}>
          {evaluation.score}
        </div>
        <div className="flex-1">
          <div className="text-sm text-[var(--text-secondary)]">피치 정확도 {evaluation.pitchAccuracy}%</div>
          <div className="text-sm text-[var(--text-secondary)]">톤 안정성 {evaluation.toneStability.toFixed(0)}%</div>
          {evaluation.passed && <div className="text-[var(--success)] text-sm font-medium mt-1">통과!</div>}
        </div>
      </div>
      {evaluation.tensionDetected && evaluation.tension && (
        <div className="p-3 rounded-lg bg-[var(--error-muted)] border border-[var(--error)]/30">
          <div className="text-sm font-medium text-[var(--error)] mb-2">긴장 감지</div>
          <p className="text-[var(--text-primary)] text-sm m-0">{evaluation.tension.detail}</p>
          <div className="mt-2 flex flex-col gap-1">
            {evaluation.tension.laryngeal > 40 && (
              <div className="text-xs text-[var(--error)]">후두: {evaluation.tension.laryngeal.toFixed(0)}%</div>
            )}
            {evaluation.tension.tongue_root > 40 && (
              <div className="text-xs text-[var(--error)]">혀뿌리: {evaluation.tension.tongue_root.toFixed(0)}%</div>
            )}
            {evaluation.tension.jaw > 40 && (
              <div className="text-xs text-[var(--error)]">턱: {evaluation.tension.jaw.toFixed(0)}%</div>
            )}
            {evaluation.tension.register_break > 40 && (
              <div className="text-xs text-[var(--error)]">성구전환: {evaluation.tension.register_break.toFixed(0)}%</div>
            )}
          </div>
        </div>
      )}
      {coaching && (
        <div className="p-4 rounded-xl bg-[var(--accent-muted)] border border-[var(--accent)]/30">
          <div className="text-sm font-medium text-[var(--accent-light)] mb-2">AI 코치</div>
          <p className="text-[var(--text-primary)] text-sm m-0">{coaching.feedback}</p>
          {coaching.nextExercise && <p className="text-[var(--accent-light)] text-sm mt-2 mb-0">💡 {coaching.nextExercise}</p>}
          {coaching.encouragement && <p className="text-[var(--success)] text-sm mt-1 mb-0">{coaching.encouragement}</p>}
          {coaching.references && coaching.references.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--accent)]/20">
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5">참고 영상</div>
              <div className="flex flex-col gap-1">
                {coaching.references.map((ref, i) => (
                  <a
                    key={`${ref.videoId}-${ref.timestamp}`}
                    href={`https://youtube.com/watch?v=${ref.videoId}&t=${Math.floor(ref.timestamp)}s`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--accent-light)] hover:underline"
                  >
                    선생님 시범 #{i + 1} ({Math.floor(ref.timestamp / 60)}:{String(Math.floor(ref.timestamp % 60)).padStart(2, '0')})
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
