'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { getSessions } from '@/lib/storage/songDB';
import type { SessionScore } from '@/types';
import PitchTimeline from './PitchTimeline';
import styles from './SessionResult.module.css';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getScoreGrade(score: number): { label: string; className: string } {
  if (score >= 90) return { label: 'S', className: styles.gradeS };
  if (score >= 80) return { label: 'A', className: styles.gradeA };
  if (score >= 70) return { label: 'B', className: styles.gradeB };
  if (score >= 60) return { label: 'C', className: styles.gradeC };
  return { label: 'D', className: styles.gradeD };
}

export default function SessionResult() {
  const { currentSession, showResult, setShowResult, setMode, currentAnalysis } = usePracticeStore();
  const [previousBest, setPreviousBest] = useState<SessionScore | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showTimeline, setShowTimeline] = useState(false);
  const animRef = useRef<number>(0);

  // Load previous best
  useEffect(() => {
    if (!currentSession) return;

    async function loadPrevious() {
      if (!currentSession) return;
      try {
        const sessions = await getSessions(currentSession.songId);
        // Find best session excluding current
        const others = sessions.filter((s) => s.id !== currentSession.id);
        if (others.length > 0) {
          const best = others.reduce((a, b) => (a.overallScore > b.overallScore ? a : b));
          setPreviousBest(best);
        } else {
          setPreviousBest(null);
        }
      } catch {
        setPreviousBest(null);
      }
    }

    loadPrevious();
  }, [currentSession]);

  // Animate score counter
  useEffect(() => {
    if (!showResult || !currentSession) {
      setAnimatedScore(0);
      return;
    }

    const target = currentSession.overallScore;
    const startTime = performance.now();
    const animDuration = 1200;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / animDuration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(target * eased));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    // Small delay before starting animation
    const timer = setTimeout(() => {
      animRef.current = requestAnimationFrame(animate);
    }, 300);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animRef.current);
    };
  }, [showResult, currentSession]);

  const handleClose = useCallback(() => {
    setShowResult(false);
  }, [setShowResult]);

  const handleRetry = useCallback(() => {
    setShowResult(false);
    // Stay in play mode, user can click start again
  }, [setShowResult]);

  const handlePractice = useCallback(() => {
    setShowResult(false);
    setMode('practice');
  }, [setShowResult, setMode]);

  if (!showResult || !currentSession) return null;

  const grade = getScoreGrade(currentSession.overallScore);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - animatedScore / 100);

  const scoreDiff = previousBest
    ? currentSession.overallScore - previousBest.overallScore
    : null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="닫기">
          &#10005;
        </button>

        <div className={styles.title}>연주 결과</div>

        {/* Score gauge */}
        <div className={styles.gaugeSection}>
          <div className={styles.gauge}>
            <svg viewBox="0 0 120 120" className={styles.gaugeSvg}>
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="8"
              />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 60 60)"
                className={styles.gaugeProgress}
              />
            </svg>
            <div className={styles.gaugeCenter}>
              <div className={styles.scoreNumber}>{animatedScore}</div>
              <div className={`${styles.gradeLabel} ${grade.className}`}>{grade.label}</div>
            </div>
          </div>
        </div>

        {/* Category scores */}
        <div className={styles.categories}>
          <div className={styles.categoryItem}>
            <span className={styles.categoryLabel}>음정 정확도</span>
            <div className={styles.categoryBar}>
              <div
                className={styles.categoryFill}
                style={{ width: `${currentSession.overallScore}%` }}
              />
            </div>
            <span className={styles.categoryValue}>{currentSession.overallScore}</span>
          </div>
        </div>

        {/* Comparison with previous */}
        {previousBest && scoreDiff !== null && (
          <div className={styles.comparison}>
            <span className={styles.comparisonLabel}>이전 최고 기록 대비</span>
            <span className={`${styles.comparisonDiff} ${
              scoreDiff > 0 ? styles.diffUp : scoreDiff < 0 ? styles.diffDown : styles.diffSame
            }`}>
              {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff === 0 ? '동일' : `${scoreDiff}`}
            </span>
            <span className={styles.comparisonPrev}>
              (이전: {previousBest.overallScore}점)
            </span>
          </div>
        )}

        {/* Song + duration info */}
        <div className={styles.meta}>
          <span>소요 시간: {formatDuration(currentSession.duration)}</span>
          {currentSession.keyShift !== 0 && (
            <span>
              키: {currentSession.keyShift > 0 ? '+' : ''}{currentSession.keyShift}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.retryBtn} onClick={handleRetry}>
            다시 부르기
          </button>
          <button className={styles.practiceBtn} onClick={handlePractice}>
            연습하기
          </button>
        </div>

        {/* Detail analysis toggle */}
        <button
          className={styles.detailBtn}
          onClick={() => setShowTimeline((prev) => !prev)}
        >
          {showTimeline ? '상세 분석 닫기' : '상세 분석 보기'}
        </button>

        {/* PitchTimeline */}
        {showTimeline && currentSession && (
          <div className={styles.timelineWrap}>
            <PitchTimeline session={currentSession} analysis={currentAnalysis} />
          </div>
        )}
      </div>
    </div>
  );
}
