'use client';

import { useBreathingStore } from '@/stores/breathingStore';
import styles from './BreathVisualizer.module.css';

export default function BreathVisualizer() {
  const breathData = useBreathingStore((s) => s.breathData);
  const isActive = useBreathingStore((s) => s.isActive);
  const currentExhaleDuration = useBreathingStore((s) => s.currentExhaleDuration);
  const sessionBest = useBreathingStore((s) => s.sessionBest);

  const isBreathing = breathData?.isBreathing ?? false;
  const rms = breathData?.rms ?? 0;

  // Scale range: 1.0 (idle) to 1.8 (max breath)
  const scaleFactor = isActive && isBreathing
    ? 1.0 + Math.min(rms * 8, 0.8)
    : 1.0;

  const formattedTime = currentExhaleDuration.toFixed(1);

  let statusMessage = '시작 버튼을 눌러 호흡 훈련을 시작하세요';
  let statusClass = styles.statusText;
  if (isActive && isBreathing) {
    statusMessage = '호흡 감지 중...';
    statusClass = `${styles.statusText} ${styles.statusBreathing}`;
  } else if (isActive && !isBreathing) {
    statusMessage = '호흡을 시작하세요';
    statusClass = styles.statusText;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.gaugeContainer}>
        <div
          className={`${styles.outerRing} ${isActive && isBreathing ? styles.outerRingActive : ''}`}
        />
        <div
          className={`${styles.innerCircle} ${
            isActive && isBreathing ? styles.innerCircleBreathing : styles.innerCircleIdle
          }`}
          style={{ transform: `scale(${scaleFactor})` }}
        >
          <span className={styles.timerText}>{formattedTime}</span>
          <span className={styles.timerLabel}>초</span>
        </div>
      </div>

      <p className={statusClass}>{statusMessage}</p>

      {sessionBest > 0 && (
        <div className={styles.bestRecord}>
          <span>세션 최고</span>
          <span className={styles.bestValue}>{sessionBest.toFixed(1)}초</span>
        </div>
      )}
    </div>
  );
}
