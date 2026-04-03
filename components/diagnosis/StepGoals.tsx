'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';
import styles from './DiagnosisWizard.module.css';

const GOAL_SUGGESTIONS = [
  '노래방에서 고음을 자신 있게 부르고 싶어요',
  '오디션을 준비하고 있어요',
  '밴드 보컬로 활동하고 싶어요',
  '취미로 노래 실력을 키우고 싶어요',
  '유튜브/커버 영상을 올리고 싶어요',
  '성악 기초를 다지고 싶어요',
];

export default function StepGoals() {
  const { goal, setGoal, setStep } = useDiagnosisStore();

  const canProceed = goal.trim().length >= 1;

  return (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>어떤 목표를 가지고 있나요?</h2>
      <p className={styles.stepDesc}>직접 입력하거나, 아래에서 골라보세요.</p>

      <div className={styles.formGroup}>
        <textarea
          className={styles.formTextarea}
          placeholder="목표를 자유롭게 적어주세요 (최대 200자)"
          value={goal}
          onChange={(e) => setGoal(e.target.value.slice(0, 200))}
          maxLength={200}
          rows={3}
        />
        <span className={styles.charCount}>{goal.length}/200</span>
      </div>

      <div className={styles.suggestionList}>
        {GOAL_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.suggestionChip} ${goal === s ? styles.suggestionActive : ''}`}
            onClick={() => setGoal(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={styles.stepActions}>
        <button type="button" className="btn-outline" onClick={() => setStep(1)}>
          &larr; 이전
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canProceed}
          onClick={() => setStep(3)}
        >
          다음 단계 &rarr;
        </button>
      </div>
    </div>
  );
}
