'use client';

import styles from './UsageCounter.module.css';

interface UsageCounterProps {
  usage: number;
  limit: number;
}

export default function UsageCounter({ usage, limit }: UsageCounterProps) {
  const pct = Math.min((usage / limit) * 100, 100);
  const isNearLimit = usage >= limit * 0.8;

  return (
    <div className={styles.container}>
      <div className={styles.textRow}>
        <span className={styles.label}>이번 달 사용량</span>
        <span className={`${styles.count} ${isNearLimit ? styles.countWarn : ''}`}>
          {usage}/{limit}곡
        </span>
      </div>
      <div className={styles.barBg}>
        <div
          className={`${styles.barFill} ${isNearLimit ? styles.barFillWarn : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
