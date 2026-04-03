'use client';

import { useState, useCallback } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import type { CoachCondition } from '@/types';
import styles from './ConditionCheck.module.css';

const CONDITIONS: {
  value: CoachCondition;
  label: string;
  desc: string;
  icon: string;
  activeClass: string;
}[] = [
  {
    value: 'good',
    label: '좋음',
    desc: '목 상태가 좋고 에너지 충분',
    icon: '[+]',
    activeClass: styles.cardGood,
  },
  {
    value: 'normal',
    label: '보통',
    desc: '평소와 비슷한 컨디션',
    icon: '[=]',
    activeClass: styles.cardNormal,
  },
  {
    value: 'tired',
    label: '피곤',
    desc: '체력이 좀 떨어진 상태',
    icon: '[-]',
    activeClass: styles.cardTired,
  },
  {
    value: 'bad',
    label: '안 좋음',
    desc: '목이 아프거나 컨디션 저하',
    icon: '[!]',
    activeClass: styles.cardBad,
  },
];

export default function ConditionCheck() {
  const { setCondition, setPhase, getNextStageId } = useCoachStore();
  const [selected, setSelected] = useState<CoachCondition | null>(null);

  const handleSelect = useCallback((value: CoachCondition) => {
    setSelected(value);
  }, []);

  const handleStart = useCallback(() => {
    if (!selected) return;
    setCondition(selected);

    // Determine the stage to start
    const nextStageId = getNextStageId();
    const store = useCoachStore.getState();
    const existingProgress = store.progress[nextStageId];
    const bpm = existingProgress?.lastBpm ?? 80;

    store.startLesson(nextStageId, bpm);
    setPhase('lesson');
  }, [selected, setCondition, setPhase, getNextStageId]);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>오늘 컨디션은?</h2>
      <p className={styles.subtitle}>컨디션에 따라 레슨 난이도가 조정됩니다.</p>

      <div className={styles.cardGroup}>
        {CONDITIONS.map((cond) => {
          const isActive = selected === cond.value;
          return (
            <button
              key={cond.value}
              type="button"
              className={`${styles.card} ${isActive ? cond.activeClass : ''}`}
              onClick={() => handleSelect(cond.value)}
            >
              <div className={styles.cardIcon}>{cond.icon}</div>
              <div className={styles.cardLabel}>{cond.label}</div>
              <div className={styles.cardDesc}>{cond.desc}</div>
            </button>
          );
        })}
      </div>

      {selected === 'bad' && (
        <div className={styles.warningBox}>
          <span className={styles.warningIcon}>&#9888;</span>
          <span className={styles.warningText}>
            무리하지 마세요. 가볍게 복습만 합니다.
            성대에 무리가 가지 않는 범위에서 짧게 연습합니다.
          </span>
        </div>
      )}

      <button
        type="button"
        className={styles.startBtn}
        onClick={handleStart}
        disabled={!selected}
      >
        레슨 시작
      </button>
    </div>
  );
}
