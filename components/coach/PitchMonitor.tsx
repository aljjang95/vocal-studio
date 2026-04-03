'use client';

import { useCoachStore } from '@/stores/coachStore';
import { midiToNoteName } from '@/lib/audio/musicUtils';
import { getStageById } from '@/lib/data/hlbCurriculum';
import styles from './PitchMonitor.module.css';

function getCentsClass(cents: number): {
  noteClass: string;
  gaugeClass: string;
  scoreClass: string;
} {
  const absCents = Math.abs(cents);
  if (absCents <= 15) {
    return {
      noteClass: styles.noteGood,
      gaugeClass: styles.gaugeGood,
      scoreClass: styles.scoreGood,
    };
  }
  if (absCents <= 30) {
    return {
      noteClass: styles.noteOk,
      gaugeClass: styles.gaugeOk,
      scoreClass: styles.scoreOk,
    };
  }
  return {
    noteClass: styles.noteBad,
    gaugeClass: styles.gaugeBad,
    scoreClass: styles.scoreBad,
  };
}

export default function PitchMonitor() {
  const { currentStageId, currentRootNote, currentNoteScores } = useCoachStore();

  const stage = getStageById(currentStageId);
  const pattern = stage?.pattern ?? [];

  // Get the latest note score
  const latestNote = currentNoteScores.length > 0
    ? currentNoteScores[currentNoteScores.length - 1]
    : null;

  // Current expected note
  const noteIndex = latestNote?.noteIndex ?? 0;
  const expectedMidi = pattern.length > 0
    ? currentRootNote + (pattern[Math.min(noteIndex, pattern.length - 1)] ?? 0)
    : currentRootNote;
  const expectedNoteName = midiToNoteName(expectedMidi);

  // User detected note
  const userFreq = latestNote?.detectedFrequency ?? 0;
  const userCents = latestNote ? (isFinite(latestNote.cents) ? latestNote.cents : 0) : 0;
  const userScore = latestNote?.score ?? 0;

  const hasPitch = userFreq > 0;
  const userNoteName = hasPitch ? midiToNoteName(
    Math.round(12 * Math.log2(userFreq / 440) + 69)
  ) : '--';

  const classes = hasPitch ? getCentsClass(userCents) : {
    noteClass: styles.noteSilence,
    gaugeClass: '',
    scoreClass: '',
  };

  // Gauge position: map cents (-50 to +50) to 0% - 100%
  const clampedCents = Math.max(-50, Math.min(50, userCents));
  const gaugePosition = hasPitch ? 50 + (clampedCents / 50) * 50 : 50;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>피치 모니터</span>
        {hasPitch && (
          <span className={`${styles.noteScore} ${classes.scoreClass}`}>
            {userScore}점
          </span>
        )}
      </div>

      {/* Expected vs User note names */}
      <div className={styles.noteDisplay}>
        <div className={styles.expectedNote}>
          <span className={styles.expectedNoteLabel}>목표 음</span>
          <span className={styles.expectedNoteName}>{expectedNoteName}</span>
        </div>
        <div className={styles.userNote}>
          <span className={styles.userNoteLabel}>내 음</span>
          <span className={`${styles.userNoteName} ${classes.noteClass}`}>
            {userNoteName}
          </span>
        </div>
      </div>

      {/* Pitch accuracy gauge */}
      <div className={styles.gaugeWrap}>
        <div className={styles.gaugeCenterLine} />
        <div
          className={`${styles.gaugeIndicator} ${classes.gaugeClass}`}
          style={{ left: `${gaugePosition}%` }}
        />
      </div>

      {/* Cents offset */}
      <div className={styles.centsDisplay}>
        {hasPitch
          ? `${userCents > 0 ? '+' : ''}${Math.round(userCents)} cents`
          : '소리를 감지하고 있습니다...'
        }
      </div>
    </div>
  );
}
