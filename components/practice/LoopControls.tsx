'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import styles from './LoopControls.module.css';

const MIN_LOOP_DURATION = 0.5;

function timeToSeconds(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

function secondsToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  disabled: boolean;
}

export default function LoopControls({ disabled }: Props) {
  const {
    loopStart,
    loopEnd,
    currentTime,
    setLoop,
    clearLoop,
  } = usePracticeStore();

  const [isEnabled, setIsEnabled] = useState(loopStart !== null && loopEnd !== null);
  const [startInput, setStartInput] = useState(loopStart !== null ? secondsToTime(loopStart) : '0:00');
  const [endInput, setEndInput] = useState(loopEnd !== null ? secondsToTime(loopEnd) : '0:00');
  const [repeatCount, setRepeatCount] = useState(0);

  // Sync inputs when loop changes externally
  useEffect(() => {
    if (loopStart !== null) setStartInput(secondsToTime(loopStart));
    if (loopEnd !== null) setEndInput(secondsToTime(loopEnd));
    setIsEnabled(loopStart !== null && loopEnd !== null);
  }, [loopStart, loopEnd]);

  // Count repeats
  useEffect(() => {
    if (loopStart !== null && loopEnd !== null && currentTime <= loopStart + 0.1) {
      setRepeatCount((prev) => prev + 1);
    }
  }, [currentTime, loopStart, loopEnd]);

  const applyLoop = useCallback((startSec: number, endSec: number) => {
    // Ensure minimum duration
    if (endSec - startSec < MIN_LOOP_DURATION) {
      endSec = startSec + MIN_LOOP_DURATION;
    }
    // Ensure start < end
    if (startSec >= endSec) {
      const temp = startSec;
      startSec = endSec;
      endSec = temp;
    }
    setLoop(startSec, endSec);
    setRepeatCount(0);
  }, [setLoop]);

  const handleToggle = useCallback(() => {
    if (isEnabled) {
      clearLoop();
      setIsEnabled(false);
    } else {
      const start = timeToSeconds(startInput);
      const end = timeToSeconds(endInput);
      if (start !== null && end !== null && end > start) {
        applyLoop(start, end);
        setIsEnabled(true);
      }
    }
  }, [isEnabled, startInput, endInput, clearLoop, applyLoop]);

  const handleSetStart = useCallback(() => {
    const sec = Math.floor(currentTime);
    setStartInput(secondsToTime(sec));
    if (isEnabled) {
      const end = timeToSeconds(endInput);
      if (end !== null && end > sec) {
        applyLoop(sec, end);
      }
    }
  }, [currentTime, isEnabled, endInput, applyLoop]);

  const handleSetEnd = useCallback(() => {
    const sec = Math.floor(currentTime);
    setEndInput(secondsToTime(sec));
    if (isEnabled) {
      const start = timeToSeconds(startInput);
      if (start !== null && sec > start) {
        applyLoop(start, sec);
      }
    }
  }, [currentTime, isEnabled, startInput, applyLoop]);

  const handleStartBlur = useCallback(() => {
    if (!isEnabled) return;
    const start = timeToSeconds(startInput);
    const end = timeToSeconds(endInput);
    if (start !== null && end !== null && end > start) {
      applyLoop(start, end);
    }
  }, [isEnabled, startInput, endInput, applyLoop]);

  const handleEndBlur = useCallback(() => {
    if (!isEnabled) return;
    const start = timeToSeconds(startInput);
    const end = timeToSeconds(endInput);
    if (start !== null && end !== null && end > start) {
      applyLoop(start, end);
    }
  }, [isEnabled, startInput, endInput, applyLoop]);

  const handleClear = useCallback(() => {
    clearLoop();
    setIsEnabled(false);
    setStartInput('0:00');
    setEndInput('0:00');
    setRepeatCount(0);
  }, [clearLoop]);

  return (
    <div className={`${styles.loop} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>구간 반복</span>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>{isEnabled ? 'ON' : 'OFF'}</span>
          <button
            className={`${styles.toggle} ${isEnabled ? styles.toggleActive : ''}`}
            onClick={handleToggle}
            aria-label="구간 반복 토글"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      </div>

      <div className={styles.controls}>
        <button className={styles.setBtn} onClick={handleSetStart}>
          시작점
        </button>
        <input
          className={styles.timeInput}
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          onBlur={handleStartBlur}
          placeholder="0:00"
        />
        <span className={styles.separator}>~</span>
        <input
          className={styles.timeInput}
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          onBlur={handleEndBlur}
          placeholder="0:00"
        />
        <button className={styles.setBtn} onClick={handleSetEnd}>
          끝점
        </button>
        <button className={styles.clearBtn} onClick={handleClear}>
          초기화
        </button>
      </div>

      {isEnabled && loopStart !== null && loopEnd !== null && (
        <div className={styles.repeatInfo}>
          구간: {secondsToTime(loopStart)} ~ {secondsToTime(loopEnd)} | 반복 횟수: {repeatCount}
        </div>
      )}
    </div>
  );
}
