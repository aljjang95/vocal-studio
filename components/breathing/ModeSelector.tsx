'use client';

import { useBreathingStore } from '@/stores/breathingStore';
import type { BreathMode } from '@/types';
import styles from './ModeSelector.module.css';

interface ModeOption {
  mode: BreathMode;
  title: string;
  icon: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyLabel: string;
  time: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'long',
    title: '롱 브레스',
    icon: 'LB',
    description: '한 호흡을 최대한 길게 유지하여 폐활량과 호흡 지구력을 키웁니다.',
    difficulty: 'easy',
    difficultyLabel: '초급',
    time: '1~3분',
  },
  {
    mode: 'rhythm',
    title: '리듬 브레스',
    icon: 'RB',
    description: '들숨-유지-날숨 패턴을 따라 호흡의 안정성과 제어력을 훈련합니다.',
    difficulty: 'medium',
    difficultyLabel: '중급',
    time: '3~5분',
  },
  {
    mode: 'phrase',
    title: '프레이즈 호흡',
    icon: 'PB',
    description: '목표 시간 동안 호흡을 유지하며 실전 프레이즈 길이에 맞춰 연습합니다.',
    difficulty: 'hard',
    difficultyLabel: '고급',
    time: '2~5분',
  },
];

const DIFFICULTY_CLASS: Record<string, string> = {
  easy: styles.badgeEasy,
  medium: styles.badgeMedium,
  hard: styles.badgeHard,
};

export default function ModeSelector() {
  const mode = useBreathingStore((s) => s.mode);
  const isActive = useBreathingStore((s) => s.isActive);
  const setMode = useBreathingStore((s) => s.setMode);

  const handleSelect = (m: BreathMode) => {
    if (isActive) return;
    setMode(m);
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>훈련 모드</h2>
      <div className={styles.cards}>
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            type="button"
            className={`${styles.card} ${mode === opt.mode ? styles.cardActive : ''}`}
            onClick={() => handleSelect(opt.mode)}
            disabled={isActive}
            aria-pressed={mode === opt.mode}
          >
            <div className={styles.cardIcon}>{opt.icon}</div>
            <div className={styles.cardTitle}>{opt.title}</div>
            <div className={styles.cardDesc}>{opt.description}</div>
            <div className={styles.cardMeta}>
              <span className={`${styles.badge} ${DIFFICULTY_CLASS[opt.difficulty]}`}>
                {opt.difficultyLabel}
              </span>
              <span className={styles.time}>{opt.time}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
