'use client';

import { SelfEvalScores } from '@/types';
import styles from './BarChart.module.css';

const LABELS: Record<keyof SelfEvalScores, string> = {
  pitch: '음정',
  breath: '호흡',
  power: '성량',
  tone: '음색',
  technique: '테크닉',
};

const COLORS: Record<keyof SelfEvalScores, string> = {
  pitch: 'var(--accent)',
  breath: 'var(--success)',
  power: 'var(--accent2)',
  tone: 'var(--error)',
  technique: 'var(--accent-lt)',
};

interface BarChartProps {
  scores: SelfEvalScores;
}

export default function BarChart({ scores }: BarChartProps) {
  const keys = Object.keys(LABELS) as (keyof SelfEvalScores)[];

  return (
    <div className={styles.chart}>
      {keys.map((key) => (
        <div key={key} className={styles.row}>
          <span className={styles.label}>{LABELS[key]}</span>
          <div className={styles.track}>
            <div
              className={styles.bar}
              style={{
                width: `${scores[key]}%`,
                background: `linear-gradient(90deg, ${COLORS[key]}, ${COLORS[key]}88)`,
              }}
            />
          </div>
          <span className={styles.value}>{scores[key]}</span>
        </div>
      ))}
    </div>
  );
}
