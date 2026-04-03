'use client';

import { useCoachingStore } from '@/stores/coachingStore';
import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { getLessonById, CURRICULUM } from '@/lib/curriculum';
import styles from './SessionInfo.module.css';

export default function SessionInfo() {
  const { currentLessonId, completedLessons } = useCoachingStore();
  const { result } = useDiagnosisStore();

  const lessonInfo = getLessonById(currentLessonId);
  const totalLessons = CURRICULUM.reduce((a, c) => a + c.lessons.length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.length / totalLessons) * 100) : 0;

  return (
    <aside className={styles.info}>
      <div className={styles.infoSection}>
        <h4 className={styles.infoTitle}>현재 레슨</h4>
        {lessonInfo ? (
          <>
            <div className={styles.lessonCard}>
              <span className={styles.lessonIcon}>{lessonInfo.category.icon}</span>
              <div>
                <div className={styles.lessonName}>{lessonInfo.lesson.title}</div>
                <div className={styles.lessonMeta}>{lessonInfo.lesson.durationMin}분 소요</div>
              </div>
            </div>
            <p className={styles.lessonDesc}>{lessonInfo.lesson.description}</p>
          </>
        ) : (
          <p className={styles.emptyText}>레슨을 선택해주세요</p>
        )}
      </div>

      <div className={styles.infoSection}>
        <h4 className={styles.infoTitle}>전체 진행률</h4>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <div className={styles.progressLabel}>
          <span>{completedLessons.length}/{totalLessons} 레슨 완료</span>
          <span className={styles.progressPct}>{progressPct}%</span>
        </div>
      </div>

      {result && (
        <div className={styles.infoSection}>
          <h4 className={styles.infoTitle}>진단 결과 요약</h4>
          <div className={styles.diagCard}>
            <div className={styles.diagScore}>
              <span className={styles.diagNum}>{result.overallScore}</span>
              <span className={styles.diagLabel}>종합 점수</span>
            </div>
            <div className={styles.diagDetails}>
              {result.strengths.slice(0, 2).map((s, i) => (
                <div key={i} className={styles.diagItem}>
                  <span className={styles.diagDot} style={{ background: 'var(--teal)' }} />
                  {s}
                </div>
              ))}
              {result.weaknesses.slice(0, 1).map((w, i) => (
                <div key={i} className={styles.diagItem}>
                  <span className={styles.diagDot} style={{ background: 'var(--rose)' }} />
                  {w}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
