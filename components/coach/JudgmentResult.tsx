'use client';

import { useEffect, useState, useCallback } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import { getStageById } from '@/lib/data/hlbCurriculum';
import { judgeLesson, shouldLowerBpm, calculateNewBpm, shouldEndSession } from '@/lib/coach/progressManager';
import { getCurrentPatternScores } from '@/lib/coach/lessonEngine';
import type { CoachFeedback } from '@/types';
import styles from './JudgmentResult.module.css';

function extractPitchStats(patternScores: { noteScores: { cents: number; score: number; noteIndex: number }[] }[]) {
  let totalCents = 0;
  let totalNotes = 0;
  let goodNotes = 0;
  let worstCents = 0;
  let worstIndex = 0;

  for (const ps of patternScores) {
    for (const ns of ps.noteScores) {
      if (!isFinite(ns.cents)) continue;
      totalCents += Math.abs(ns.cents);
      totalNotes++;
      if (ns.score >= 80) goodNotes++;
      if (Math.abs(ns.cents) > worstCents) {
        worstCents = Math.abs(ns.cents);
        worstIndex = ns.noteIndex;
      }
    }
  }

  return {
    avgCents: totalNotes > 0 ? Math.round(totalCents / totalNotes) : 0,
    worstNoteIndex: worstIndex,
    worstNoteCents: Math.round(worstCents),
    totalNotes,
    goodNotes,
  };
}

export default function JudgmentResult() {
  const {
    currentStageId,
    currentBpm,
    lastScore,
    failStreak,
    condition,
    lastFeedback,
    setFeedback,
    passStage,
    failStage,
    lowerBpm,
    setPhase,
    currentPatternScores,
  } = useCoachStore();

  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [defaultFeedback] = useState<CoachFeedback>(() => {
    if (lastScore >= 80) {
      return {
        feedback: '전반적으로 좋은 음정 정확도를 보여주고 있어요.',
        suggestion: '이 느낌을 기억하고 다음 단계에서도 유지해보세요.',
        encouragement: '잘하고 있어요!',
        shouldLowerBpm: false,
      };
    }
    return {
      feedback: '음정 정확도를 높여보세요.',
      suggestion: '천천히 한 음씩 정확하게 내는 연습부터 시작해보세요.',
      encouragement: '연습하는 것 자체가 성장이에요.',
      shouldLowerBpm: lastScore < 40,
    };
  });

  const stage = getStageById(currentStageId);
  const isNonVocal = stage ? stage.pattern.length === 0 : false;
  const { passed } = judgeLesson(lastScore);
  const shouldEnd = shouldEndSession(failStreak + (passed ? 0 : 1));

  // Process pass/fail on mount
  useEffect(() => {
    if (passed) {
      passStage(currentStageId, lastScore, currentBpm);
    } else {
      failStage();
      const newFailStreak = failStreak + 1;
      if (shouldLowerBpm(newFailStreak) && stage) {
        lowerBpm(stage.bpmRange[0]);
      }
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch AI feedback (only for vocal stages that didn't pass perfectly)
  useEffect(() => {
    if (isNonVocal || lastFeedback) return;

    const fetchFeedback = async () => {
      setIsLoadingFeedback(true);
      try {
        const patternScores = currentPatternScores.length > 0
          ? currentPatternScores
          : getCurrentPatternScores();
        const pitchStats = extractPitchStats(patternScores);

        const guideText = stage?.scaleType === '비발성'
          ? '바람만 부는 연습입니다.'
          : `"${stage?.pronunciation}"을(를) ${stage?.scaleType} 패턴으로 발성하세요.`;

        const res = await fetch('/api/coach-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stageId: currentStageId,
            stageName: stage?.name ?? '',
            pronunciation: stage?.pronunciation ?? '',
            guideText,
            score: lastScore,
            condition: condition ?? 'normal',
            failStreak: passed ? 0 : failStreak + 1,
            pitchStats,
          }),
        });

        if (res.ok) {
          const data = await res.json() as CoachFeedback;
          setFeedback(data);
        }
      } catch {
        // Use default feedback on error
      } finally {
        setIsLoadingFeedback(false);
      }
    };

    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const feedback = lastFeedback ?? defaultFeedback;

  const handleNextStage = useCallback(() => {
    const store = useCoachStore.getState();
    const nextId = store.getNextStageId();
    const nextStage = getStageById(nextId);
    const bpm = nextStage?.bpmRange[0] ?? 80;
    store.startLesson(nextId, bpm);
    setPhase('lesson');
  }, [setPhase]);

  const handleRetry = useCallback(() => {
    const store = useCoachStore.getState();
    store.startLesson(currentStageId, store.currentBpm);
    setPhase('lesson');
  }, [currentStageId, setPhase]);

  const handleGoHome = useCallback(() => {
    setPhase('summary');
  }, [setPhase]);

  return (
    <div className={styles.container}>
      {/* Pass/Fail banner */}
      <div className={styles.resultBanner}>
        {passed ? (
          <div className={styles.passText}>합격!</div>
        ) : (
          <div className={styles.failText}>아쉽지만 다시 도전!</div>
        )}
      </div>

      {/* Score */}
      <div className={styles.scoreSection}>
        <div className={`${styles.scoreNumber} ${passed ? styles.scorePass : styles.scoreFail}`}>
          {lastScore}
        </div>
        <div className={styles.scoreLabel}>점</div>
      </div>

      {/* Feedback */}
      {!isNonVocal && (
        <div className={styles.feedbackSection}>
          {isLoadingFeedback && !lastFeedback ? (
            <>
              <div className={styles.feedbackItem}>
                <div className={styles.feedbackLabel}>피드백</div>
                <div className={styles.feedbackText}>{defaultFeedback.feedback}</div>
              </div>
              <div className={styles.loadingFeedback}>
                AI 분석 중
                <span className={styles.loadingDots}>
                  <span /><span /><span />
                </span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.feedbackItem}>
                <div className={styles.feedbackLabel}>피드백</div>
                <div className={styles.feedbackText}>{feedback.feedback}</div>
              </div>
              <div className={styles.feedbackItem}>
                <div className={styles.feedbackLabel}>개선 조언</div>
                <div className={styles.feedbackText}>{feedback.suggestion}</div>
              </div>
              <div className={styles.feedbackItem}>
                <div className={styles.feedbackLabel}>격려</div>
                <div className={styles.feedbackText}>{feedback.encouragement}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 5 consecutive fail warning */}
      {shouldEnd && !passed && (
        <div className={styles.streakWarning}>
          오늘은 충분히 연습했어요. 내일 다시 도전하면 분명 나아질 거예요.
          충분한 휴식이 실력 향상의 비결입니다.
        </div>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {passed ? (
          <>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleNextStage}
            >
              다음 단계로
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleGoHome}
            >
              오늘은 여기까지
            </button>
          </>
        ) : shouldEnd ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleGoHome}
          >
            레슨 홈으로
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleRetry}
            >
              다시 도전
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleGoHome}
            >
              오늘은 여기까지
            </button>
          </>
        )}
      </div>
    </div>
  );
}
