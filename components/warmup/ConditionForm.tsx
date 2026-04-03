'use client';

import { useState, useCallback } from 'react';
import { useWarmupStore } from '@/stores/warmupStore';
import { WarmupCondition, WarmupRoutine, VoiceType } from '@/types';
import styles from './ConditionForm.module.css';

const ENERGY_OPTIONS: { value: WarmupCondition['energy']; label: string }[] = [
  { value: 'good', label: '좋음' },
  { value: 'normal', label: '보통' },
  { value: 'tired', label: '피곤함' },
  { value: 'bad', label: '안 좋음' },
];

const GOAL_OPTIONS = [
  '고음 확장',
  '음정 안정',
  '호흡 강화',
  '음색 개선',
  '테크닉 연습',
  '가볍게 풀기',
] as const;

const VOICE_OPTIONS: { value: VoiceType; label: string }[] = [
  { value: '저음', label: '저음' },
  { value: '중음', label: '중음' },
  { value: '고음', label: '고음' },
];

interface ConditionFormProps {
  onRoutineGenerated: (routine: WarmupRoutine) => void;
}

export default function ConditionForm({ onRoutineGenerated }: ConditionFormProps) {
  const { isGenerating, error, setGenerating, setError, setCondition, setRoutine } = useWarmupStore();

  const [energy, setEnergy] = useState<WarmupCondition['energy'] | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [voiceType, setVoiceType] = useState<VoiceType>('중음');

  const toggleGoal = useCallback((goal: string) => {
    setGoals((prev) => {
      if (prev.includes(goal)) {
        return prev.filter((g) => g !== goal);
      }
      if (prev.length >= 2) return prev;
      return [...prev, goal];
    });
  }, []);

  const canSubmit = energy !== null && goals.length >= 1 && !isGenerating;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !energy) return;

    const condition: WarmupCondition = { energy, goals };
    setCondition(condition);
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition, voiceType }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        if (res.status === 429) {
          throw new Error('요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
        }
        throw new Error(errBody.error ?? `서버 오류가 발생했습니다. (${res.status})`);
      }

      const routine = await res.json() as WarmupRoutine;
      setRoutine(routine);
      onRoutineGenerated(routine);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '루틴 생성에 실패했습니다.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [canSubmit, energy, goals, voiceType, setCondition, setGenerating, setError, setRoutine, onRoutineGenerated]);

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.title}>오늘의 워밍업</h2>
      <p className={styles.subtitle}>현재 컨디션에 맞는 AI 맞춤 워밍업 루틴을 생성합니다.</p>

      {/* 에너지 수준 */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>오늘 컨디션은 어떤가요?</div>
        <div className={styles.chipGroup}>
          {ENERGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.chip} ${energy === opt.value ? styles.chipActive : ''}`}
              onClick={() => setEnergy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {energy === 'bad' && (
          <div className={styles.warning}>
            <span className={styles.warningIcon}>&#9888;</span>
            <span className={styles.warningText}>
              컨디션이 좋지 않을 때는 성대에 무리가 가지 않는 가벼운 연습만 추천됩니다.
              무리하지 말고 컨디션이 회복된 후 본격적인 연습을 진행하세요.
            </span>
          </div>
        )}
      </div>

      {/* 목표 선택 */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          오늘의 목표
          <span className={styles.sectionHint}>(최대 2개 선택)</span>
        </div>
        <div className={styles.chipGroup}>
          {GOAL_OPTIONS.map((goal) => {
            const isActive = goals.includes(goal);
            const isDisabled = !isActive && goals.length >= 2;
            return (
              <button
                key={goal}
                type="button"
                className={`${styles.goalChip} ${isActive ? styles.goalChipActive : ''} ${isDisabled ? styles.goalChipDisabled : ''}`}
                onClick={() => !isDisabled && toggleGoal(goal)}
                disabled={isDisabled}
              >
                {goal}
              </button>
            );
          })}
        </div>
      </div>

      {/* 보이스 타입 */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>보이스 타입</div>
        <div className={styles.voiceGroup}>
          {VOICE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.voiceChip} ${voiceType === opt.value ? styles.voiceChipActive : ''}`}
              onClick={() => setVoiceType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* 생성 버튼 */}
      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {isGenerating ? (
          <>
            루틴 생성 중
            <span className={styles.loadingDots}>
              <span />
              <span />
              <span />
            </span>
          </>
        ) : (
          '루틴 생성'
        )}
      </button>
    </div>
  );
}
