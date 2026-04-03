'use client';

import { WarmupRoutine } from '@/types';
import styles from './RoutineView.module.css';

interface RoutineViewProps {
  routine: WarmupRoutine;
  onStart: () => void;
  onRegenerate: () => void;
}

export default function RoutineView({ routine, onStart, onRegenerate }: RoutineViewProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>워밍업 루틴</h2>
        <span className={styles.totalTime}>{routine.totalMinutes}분</span>
      </div>

      {/* AI 코멘트 */}
      <div className={styles.aiComment}>
        <div className={styles.aiLabel}>AI 코치 코멘트</div>
        {routine.aiComment}
      </div>

      {/* 단계 목록 */}
      <div className={styles.stageList}>
        {routine.stages.map((stage, idx) => (
          <div key={`${stage.stageId}-${idx}`} className={styles.stageItem}>
            <div className={styles.stageNum}>{idx + 1}</div>
            <div className={styles.stageInfo}>
              <div className={styles.stageName}>{stage.name}</div>
              <div className={styles.stageMeta}>
                <span className={styles.stageBadge}>{stage.pronunciation}</span>
                <span className={styles.stageBadge}>BPM {stage.suggestedBpm}</span>
                <span className={styles.stageBadge}>{stage.repetitions}회 반복</span>
              </div>
            </div>
            <div className={styles.stageDuration}>{stage.durationMin}분</div>
          </div>
        ))}
      </div>

      {/* 버튼 */}
      <div className={styles.actions}>
        <button type="button" className={styles.startBtn} onClick={onStart}>
          루틴 시작
        </button>
        <button type="button" className={styles.regenBtn} onClick={onRegenerate}>
          다시 생성
        </button>
      </div>
    </div>
  );
}
