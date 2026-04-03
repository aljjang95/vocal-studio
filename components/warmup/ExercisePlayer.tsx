'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WarmupRoutine } from '@/types';
import { useWarmupStore } from '@/stores/warmupStore';
import * as scheduler from '@/lib/audio/scheduler';
import { resumeAudioContext } from '@/lib/audio/audioEngine';
import styles from './ExercisePlayer.module.css';

interface ExercisePlayerProps {
  routine: WarmupRoutine;
  onComplete: (stagesCompleted: number[], elapsedSec: number) => void;
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ExercisePlayer({ routine, onComplete }: ExercisePlayerProps) {
  const { currentStageIndex, setCurrentStage, completeStage } = useWarmupStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentBpm, setCurrentBpm] = useState(() => {
    const first = routine.stages[0];
    return first ? first.suggestedBpm : 80;
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedStagesRef = useRef<number[]>([]);

  const currentStage = routine.stages[currentStageIndex];
  const totalStages = routine.stages.length;
  const isLastStage = currentStageIndex >= totalStages - 1;
  const progress = totalStages > 0 ? ((currentStageIndex) / totalStages) * 100 : 0;

  // 타이머
  useEffect(() => {
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, isPaused]);

  // BPM 변경 시 scheduler에 반영
  useEffect(() => {
    scheduler.setBpm(currentBpm);
  }, [currentBpm]);

  // 현재 단계 변경 시 BPM 세팅
  useEffect(() => {
    if (currentStage) {
      setCurrentBpm(currentStage.suggestedBpm);
    }
  }, [currentStage]);

  const startStagePlayback = useCallback((stage: typeof currentStage) => {
    if (!stage || stage.pattern.length === 0) return;

    scheduler.stop();
    scheduler.setPattern(stage.pattern);
    scheduler.setBpm(currentBpm);
    scheduler.setRootNote(60);
    scheduler.setStartKey(48);
    scheduler.setEndKey(72);
    scheduler.setTransposeDirection(1);
    scheduler.setRepeatCount(stage.repetitions);
    scheduler.setSectionRange(null, null);
    scheduler.setCallbacks({
      onComplete: () => {
        // 패턴 재생 완료 시 아무 추가 동작 없음 -- 사용자가 다음으로 넘길 수 있음
      },
    });
    scheduler.start();
  }, [currentBpm]);

  const handlePlay = useCallback(async () => {
    await resumeAudioContext();

    if (isPaused) {
      scheduler.resume();
      setIsPaused(false);
      return;
    }

    setIsPlaying(true);
    setIsPaused(false);
    if (currentStage) {
      startStagePlayback(currentStage);
    }
  }, [isPaused, currentStage, startStagePlayback]);

  const handlePause = useCallback(() => {
    scheduler.pause();
    setIsPaused(true);
  }, []);

  const handleSkip = useCallback(() => {
    scheduler.stop();

    if (currentStage) {
      completeStage(currentStage.stageId);
      if (!completedStagesRef.current.includes(currentStage.stageId)) {
        completedStagesRef.current.push(currentStage.stageId);
      }
    }

    if (isLastStage) {
      setIsPlaying(false);
      setIsPaused(false);
      onComplete(completedStagesRef.current, elapsedSec);
      return;
    }

    const nextIdx = currentStageIndex + 1;
    setCurrentStage(nextIdx);
    setIsPaused(false);

    const nextStage = routine.stages[nextIdx];
    if (nextStage && isPlaying) {
      setCurrentBpm(nextStage.suggestedBpm);
      setTimeout(() => {
        startStagePlayback(nextStage);
      }, 300);
    }
  }, [currentStage, currentStageIndex, isLastStage, isPlaying, routine.stages, elapsedSec, completeStage, setCurrentStage, onComplete, startStagePlayback]);

  const handleNext = useCallback(() => {
    handleSkip();
  }, [handleSkip]);

  // cleanup
  useEffect(() => {
    return () => {
      scheduler.stop();
    };
  }, []);

  if (!currentStage) return null;

  return (
    <div className={styles.container}>
      {/* 진행률 바 */}
      <div className={styles.progressBar}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.progressText}>{currentStageIndex + 1}/{totalStages}</span>
      </div>

      {/* 현재 단계 정보 */}
      <div className={styles.currentStage}>
        <div className={styles.stageLabel}>
          STAGE {currentStageIndex + 1}
        </div>
        <div className={styles.stageName}>{currentStage.name}</div>
        <div className={styles.pronunciation}>{currentStage.pronunciation}</div>
        <div className={styles.guideText}>{currentStage.guideText}</div>
      </div>

      {/* 메타 정보 */}
      <div className={styles.metaRow}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>반복</span>
          <span className={styles.metaValue}>{currentStage.repetitions}회</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>예상 시간</span>
          <span className={styles.metaValue}>{currentStage.durationMin}분</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>BPM 범위</span>
          <span className={styles.metaValue}>{currentStage.bpmRange[0]}-{currentStage.bpmRange[1]}</span>
        </div>
      </div>

      {/* BPM 슬라이더 */}
      <div className={styles.bpmControl}>
        <span className={styles.bpmLabel}>BPM</span>
        <input
          type="range"
          className={styles.bpmSlider}
          min={currentStage.bpmRange[0]}
          max={currentStage.bpmRange[1]}
          value={currentBpm}
          onChange={(e) => setCurrentBpm(Number(e.target.value))}
        />
        <span className={styles.bpmValue}>{currentBpm} BPM</span>
      </div>

      {/* 경과 시간 */}
      <div className={styles.timer}>
        <div className={styles.timerValue}>{formatTime(elapsedSec)}</div>
        <div className={styles.timerLabel}>경과 시간</div>
      </div>

      {/* 컨트롤 */}
      <div className={styles.controls}>
        {isPlaying && !isPaused ? (
          <button type="button" className={styles.controlBtn} onClick={handlePause}>
            일시정지
          </button>
        ) : (
          <button type="button" className={styles.playBtn} onClick={handlePlay}>
            {isPaused ? '재개' : '재생'}
          </button>
        )}
        <button type="button" className={styles.controlBtn} onClick={handleSkip}>
          건너뛰기
        </button>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={handleNext}
        >
          {isLastStage ? '완료' : '다음 단계'}
        </button>
      </div>
    </div>
  );
}
