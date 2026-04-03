'use client';

import { useMemo, useCallback } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import { getStageById } from '@/lib/data/hlbCurriculum';
import styles from './SessionSummary.module.css';

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

export default function SessionSummary() {
  const {
    sessionStartTime,
    lastScore,
    currentPatternScores,
    currentStageId,
    condition,
    failStreak,
    progress,
    setPhase,
    resetSession,
    sessionHistory,
  } = useCoachStore();

  const summary = useMemo(() => {
    const now = Date.now();
    const elapsed = sessionStartTime ? now - sessionStartTime : 0;

    // Count stages attempted and passed in this session
    // Look at the most recent session's data
    const latestSession = sessionHistory.length > 0
      ? sessionHistory[sessionHistory.length - 1]
      : null;

    const stagesAttempted = latestSession
      ? latestSession.stagesAttempted.length
      : 1;
    const stagesPassed = latestSession
      ? latestSession.stagesAttempted.filter((a) => a.passed).length
      : (lastScore >= 80 ? 1 : 0);
    const avgScore = latestSession && latestSession.stagesAttempted.length > 0
      ? Math.round(
          latestSession.stagesAttempted.reduce((s, a) => s + a.score, 0) /
            latestSession.stagesAttempted.length
        )
      : lastScore;

    return {
      duration: formatDuration(elapsed),
      stagesAttempted,
      stagesPassed,
      avgScore,
    };
  }, [sessionStartTime, lastScore, sessionHistory]);

  const currentStage = getStageById(currentStageId);

  // Generate a simple encouragement
  const comment = useMemo(() => {
    if (summary.stagesPassed > 0) {
      return `오늘 ${summary.stagesPassed}개의 단계를 합격했어요! 꾸준한 연습이 실력을 만듭니다. 내일도 같은 시간에 연습해보세요.`;
    }
    if (failStreak >= 5) {
      return '오늘은 여기까지입니다. 충분히 노력했어요. 내일 다시 도전하면 분명 더 나은 결과가 있을 거예요.';
    }
    return '오늘 연습한 것만으로도 성장하고 있어요. 내일 다시 도전해보세요!';
  }, [summary.stagesPassed, failStreak]);

  const handleGoHome = useCallback(() => {
    // Save session to history
    const store = useCoachStore.getState();
    const session = {
      id: `session-${Date.now()}`,
      startedAt: store.sessionStartTime
        ? new Date(store.sessionStartTime).toISOString()
        : new Date().toISOString(),
      condition: store.condition ?? 'normal' as const,
      stagesAttempted: [{
        stageId: store.currentStageId,
        score: store.lastScore,
        bpm: store.currentBpm,
        condition: store.condition ?? 'normal' as const,
        attemptedAt: new Date().toISOString(),
        passed: store.lastScore >= 80,
      }],
      totalDurationSec: store.sessionStartTime
        ? Math.floor((Date.now() - store.sessionStartTime) / 1000)
        : 0,
    };

    // Add to session history
    useCoachStore.setState((s) => ({
      sessionHistory: [...s.sessionHistory, session],
    }));

    resetSession();
    setPhase('home');
  }, [resetSession, setPhase]);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>오늘의 레슨 요약</h2>
      <p className={styles.subtitle}>수고하셨습니다.</p>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{summary.duration}</span>
          <span className={styles.statLabel}>연습 시간</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{summary.stagesAttempted}</span>
          <span className={styles.statLabel}>진행 단계</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{summary.stagesPassed}</span>
          <span className={styles.statLabel}>합격 수</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{summary.avgScore}</span>
          <span className={styles.statLabel}>평균 점수</span>
        </div>
      </div>

      <div className={styles.commentSection}>
        <div className={styles.commentText}>{comment}</div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleGoHome}
        >
          레슨 홈으로
        </button>
      </div>
    </div>
  );
}
