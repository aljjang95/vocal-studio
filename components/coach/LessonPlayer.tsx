'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import { getStageById } from '@/lib/data/hlbCurriculum';
import { getKeyRange } from '@/lib/coach/progressManager';
import { gradeLesson } from '@/lib/coach/pitchGrader';
import * as lessonEngine from '@/lib/coach/lessonEngine';
import ScaleDisplay from './ScaleDisplay';
import PitchMonitor from './PitchMonitor';
import styles from './LessonPlayer.module.css';

type LessonState = 'guide' | 'countdown' | 'playing' | 'timer';

export default function LessonPlayer() {
  const {
    currentStageId,
    currentBpm,
    condition,
    isPlaying,
    setPhase,
    setIsPlaying,
    completeLesson,
    currentPatternScores,
  } = useCoachStore();

  const [lessonState, setLessonState] = useState<LessonState>('guide');
  const [countdownValue, setCountdownValue] = useState(3);
  const [timerSeconds, setTimerSeconds] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stage = getStageById(currentStageId);
  const isNonVocal = stage ? stage.pattern.length === 0 : false;

  // Generate guide text based on stage
  const guideText = stage
    ? stage.scaleType === '비발성'
      ? stage.name.includes('바람')
        ? '바람만 부는 연습입니다. 소리 내지 마세요.\n주먹을 쥐고 천천히 바람을 불어보세요.'
        : '소리 없이 호흡만 연습합니다.'
      : `"${stage.pronunciation}"을(를) ${stage.scaleType} 패턴으로 발성하세요.\n피아노 소리에 맞춰 정확한 음정을 유지합니다.`
    : '';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      lessonEngine.stopLesson();
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleReady = useCallback(() => {
    setLessonState('countdown');
    setCountdownValue(3);

    countdownRef.current = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;

          // Start the actual lesson
          if (isNonVocal) {
            setLessonState('timer');
            setTimerSeconds(10);
            setIsPlaying(true);

            timerRef.current = setInterval(() => {
              setTimerSeconds((s) => {
                if (s <= 1) {
                  if (timerRef.current) clearInterval(timerRef.current);
                  timerRef.current = null;
                  // Complete non-vocal lesson with 100 score
                  completeLesson(100);
                  setPhase('judgment');
                  return 0;
                }
                return s - 1;
              });
            }, 1000);
          } else {
            setLessonState('playing');
            const keyRangeSemitones = getKeyRange(condition ?? 'normal');
            const startKey = 48; // C3

            lessonEngine.startLesson(
              currentStageId,
              currentBpm,
              startKey,
              keyRangeSemitones,
              {
                onNotePlay: () => {
                  // Store updates handled by lessonEngine callbacks
                },
                onKeyChange: () => {
                  // Store updates handled by lessonEngine callbacks
                },
                onPatternComplete: (patternScore) => {
                  useCoachStore.getState().completePattern(
                    patternScore.rootNote,
                    patternScore.noteScores
                  );
                },
                onLessonComplete: (score) => {
                  useCoachStore.getState().completeLesson(score);
                  useCoachStore.getState().setPhase('judgment');
                },
              }
            );
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isNonVocal, currentStageId, currentBpm, condition, setIsPlaying, completeLesson, setPhase]);

  const handlePause = useCallback(() => {
    // Simple stop - in production would implement pause/resume
    lessonEngine.stopLesson();
    setIsPlaying(false);

    // Calculate score from what we have so far
    const scores = lessonEngine.getCurrentPatternScores();
    const score = scores.length > 0 ? gradeLesson(scores) : 0;
    completeLesson(score);
    setPhase('judgment');
  }, [setIsPlaying, completeLesson, setPhase]);

  const handleStop = useCallback(() => {
    lessonEngine.stopLesson();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);

    const scores = lessonEngine.getCurrentPatternScores();
    const score = scores.length > 0 ? gradeLesson(scores) : 0;
    completeLesson(score);
    setPhase('judgment');
  }, [setIsPlaying, completeLesson, setPhase]);

  if (!stage) return null;

  return (
    <div className={styles.container}>
      {/* Stage header */}
      <div className={styles.stageHeader}>
        <div className={styles.blockLabel}>
          {stage.block} / Stage {currentStageId}
        </div>
        <h2 className={styles.stageTitle}>{stage.name}</h2>
        <div className={styles.pronunciation}>{stage.pronunciation}</div>
        <span className={styles.bpmBadge}>{currentBpm} BPM</span>
      </div>

      {/* Guide text (pre-start) */}
      {lessonState === 'guide' && (
        <div className={styles.guideSection}>
          <div className={styles.guideText}>{guideText}</div>
          <button
            type="button"
            className={styles.readyBtn}
            onClick={handleReady}
          >
            준비됐어요
          </button>
        </div>
      )}

      {/* Countdown */}
      {lessonState === 'countdown' && countdownValue > 0 && (
        <div className={styles.countdown}>
          <div className={styles.countdownNumber}>{countdownValue}</div>
        </div>
      )}

      {/* Playing: vocal stage */}
      {lessonState === 'playing' && (
        <div className={styles.playArea}>
          <ScaleDisplay />
          <PitchMonitor />
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.pauseBtn}
              onClick={handlePause}
            >
              일시정지
            </button>
            <button
              type="button"
              className={styles.stopBtn}
              onClick={handleStop}
            >
              중단
            </button>
          </div>
        </div>
      )}

      {/* Timer mode: non-vocal stage */}
      {lessonState === 'timer' && (
        <div className={styles.playArea}>
          <div className={styles.timerMode}>
            <div className={styles.timerGuide}>{guideText}</div>
            <div className={styles.timerCountdown}>{timerSeconds}</div>
            <div className={styles.timerLabel}>초 남음</div>
          </div>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.stopBtn}
              onClick={handleStop}
            >
              중단
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
