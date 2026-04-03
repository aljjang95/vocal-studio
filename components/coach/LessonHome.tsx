'use client';

import { useState, useCallback, useMemo } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import { hlbCurriculum, blockNames } from '@/lib/data/hlbCurriculum';
import styles from './LessonHome.module.css';

export default function LessonHome() {
  const { progress, sessionHistory, setPhase } = useCoachStore();
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});

  const nextStageId = useCoachStore((s) => s.getNextStageId());

  const passedCount = useMemo(() => {
    return Object.values(progress).filter((p) => p.passedAt !== null).length;
  }, [progress]);

  const currentStage = hlbCurriculum.find((s) => s.id === nextStageId);

  const toggleBlock = useCallback((block: string) => {
    setOpenBlocks((prev) => ({ ...prev, [block]: !prev[block] }));
  }, []);

  const handleStartLesson = useCallback(() => {
    setPhase('condition');
  }, [setPhase]);

  const handleReviewStage = useCallback((stageId: number) => {
    const store = useCoachStore.getState();
    store.startLesson(stageId, store.progress[stageId]?.lastBpm ?? 80);
    setPhase('condition');
  }, [setPhase]);

  // Recent 7 days of practice history
  const recentHistory = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const allAttempts: Array<{
      date: string;
      stageId: number;
      stageName: string;
      score: number;
      passed: boolean;
    }> = [];

    for (const session of sessionHistory) {
      for (const attempt of session.stagesAttempted) {
        const ts = new Date(attempt.attemptedAt).getTime();
        if (ts >= sevenDaysAgo) {
          const stage = hlbCurriculum.find((s) => s.id === attempt.stageId);
          allAttempts.push({
            date: attempt.attemptedAt,
            stageId: attempt.stageId,
            stageName: stage?.name ?? `Stage ${attempt.stageId}`,
            score: attempt.score,
            passed: attempt.passed,
          });
        }
      }
    }

    return allAttempts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [sessionHistory]);

  const isFirstVisit = passedCount === 0 && sessionHistory.length === 0;

  return (
    <div className={styles.container}>
      {/* Hero section */}
      <div className={styles.hero}>
        <h1 className={styles.title}>AI 보컬 코치</h1>

        {currentStage && (
          <>
            <div className={styles.currentStage}>
              Stage {nextStageId} / 50 - {currentStage.block}
            </div>
            <div className={styles.stageName}>{currentStage.name}</div>
          </>
        )}

        {/* Progress bar */}
        <div className={styles.progressWrap}>
          <div className={styles.progressLabel}>
            <span>진도율</span>
            <span>{passedCount} / 50</span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${(passedCount / 50) * 100}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          className={styles.startBtn}
          onClick={handleStartLesson}
        >
          오늘의 레슨 시작
        </button>

        {isFirstVisit && (
          <div className={styles.firstVisit}>
            Stage 1부터 시작합니다. 편안한 소리부터 시작해볼까요?
          </div>
        )}
      </div>

      {/* Block list with collapsible stages */}
      <div className={styles.blocksSection}>
        <div className={styles.blocksTitle}>커리큘럼 진행 상황</div>
        {blockNames.map((block) => {
          const stages = hlbCurriculum.filter((s) => s.block === block);
          const passedInBlock = stages.filter(
            (s) => progress[s.id]?.passedAt
          ).length;
          const isOpen = openBlocks[block] ?? false;

          return (
            <div key={block} className={styles.blockItem}>
              <button
                type="button"
                className={styles.blockHeader}
                onClick={() => toggleBlock(block)}
              >
                <div className={styles.blockInfo}>
                  <span>{block}</span>
                  <span className={styles.blockPassCount}>
                    {passedInBlock}/{stages.length}
                  </span>
                </div>
                <span
                  className={`${styles.blockArrow} ${isOpen ? styles.blockArrowOpen : ''}`}
                >
                  &#9660;
                </span>
              </button>

              {isOpen && (
                <div className={styles.blockStages}>
                  {stages.map((stage) => {
                    const stageProgress = progress[stage.id];
                    const isPassed = !!stageProgress?.passedAt;
                    return (
                      <div
                        key={stage.id}
                        className={styles.stageRow}
                        onClick={() => isPassed ? handleReviewStage(stage.id) : undefined}
                        role={isPassed ? 'button' : undefined}
                        tabIndex={isPassed ? 0 : undefined}
                      >
                        <div className={styles.stageInfo}>
                          <div
                            className={`${styles.stageCheck} ${isPassed ? styles.stageCheckPassed : ''}`}
                          >
                            {isPassed ? '\u2713' : ''}
                          </div>
                          <span className={styles.stageRowName}>
                            {stage.id}. {stage.name}
                          </span>
                        </div>
                        {stageProgress && (
                          <span className={styles.stageScore}>
                            {stageProgress.bestScore}점
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent history */}
      <div className={styles.historySection}>
        <div className={styles.historyTitle}>최근 7일 연습 기록</div>
        {recentHistory.length === 0 ? (
          <div className={styles.historyEmpty}>
            아직 연습 기록이 없습니다.
          </div>
        ) : (
          <div className={styles.historyList}>
            {recentHistory.map((item, idx) => (
              <div key={idx} className={styles.historyItem}>
                <span className={styles.historyDate}>
                  {new Date(item.date).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className={styles.historyStage}>{item.stageName}</span>
                <span className={styles.historyScore}>{item.score}점</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
