'use client';

import { useWarmupStore } from '@/stores/warmupStore';
import styles from './RoutineHistory.module.css';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return iso;
  }
}

function getWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 월요일 시작
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function RoutineHistory() {
  const records = useWarmupStore((s) => s.records);

  // 완료된 기록만 (completedAt이 비어있지 않은 것)
  const completedRecords = records
    .filter((r) => r.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);

  // 이번 주 워밍업 횟수
  const weekStart = getWeekStart();
  const thisWeekCount = completedRecords.filter((r) => {
    try {
      return new Date(r.completedAt) >= weekStart;
    } catch {
      return false;
    }
  }).length;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>워밍업 기록</h3>

      <div className={styles.weekSummary}>
        이번 주 워밍업 <span className={styles.weekCount}>{thisWeekCount}회</span> 완료
      </div>

      {completedRecords.length === 0 ? (
        <div className={styles.empty}>
          아직 완료한 워밍업이 없습니다.
        </div>
      ) : (
        <div className={styles.recordList}>
          {completedRecords.map((record, idx) => (
            <div key={`${record.routineId}-${idx}`} className={styles.recordItem}>
              <span className={styles.recordDate}>
                {formatDate(record.completedAt)}
              </span>
              <span className={styles.recordStages}>
                {record.stagesCompleted.length}단계 완료
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
