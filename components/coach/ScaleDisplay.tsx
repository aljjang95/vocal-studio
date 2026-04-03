'use client';

import { useCoachStore } from '@/stores/coachStore';
import { getStageById } from '@/lib/data/hlbCurriculum';
import { midiToNoteName } from '@/lib/audio/musicUtils';
import { getKeyRange } from '@/lib/coach/progressManager';
import { semitonesToInterval } from '@/lib/audio/musicUtils';
import styles from './ScaleDisplay.module.css';

export default function ScaleDisplay() {
  const {
    currentStageId,
    currentRootNote,
    currentNoteScores,
    currentPatternScores,
    condition,
  } = useCoachStore();

  const stage = getStageById(currentStageId);
  const pattern = stage?.pattern ?? [];

  if (pattern.length === 0) return null;

  const rootNoteName = midiToNoteName(currentRootNote);

  // Get key range for progress calculation
  const keyRangeSemitones = getKeyRange(condition ?? 'normal');
  const startKey = currentRootNote - (currentPatternScores.length > 0
    ? currentPatternScores.length
    : 0);
  // Approximate start key as first root note (48 is C3 default)
  const baseStartKey = 48;
  const endKey = baseStartKey + keyRangeSemitones;
  const keyProgress = endKey > baseStartKey
    ? Math.min(100, ((currentRootNote - baseStartKey) / (endKey - baseStartKey)) * 100)
    : 0;

  const startKeyName = midiToNoteName(baseStartKey);
  const endKeyName = midiToNoteName(endKey);

  // Determine which notes have been played in current pattern
  const latestNoteIndex = currentNoteScores.length > 0
    ? currentNoteScores[currentNoteScores.length - 1].noteIndex
    : -1;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.label}>스케일 진행</span>
        <span className={styles.rootNote}>{rootNoteName}</span>
      </div>

      {/* Pattern note dots */}
      <div className={styles.noteDots}>
        {pattern.map((interval, idx) => {
          const isPlayed = idx < latestNoteIndex;
          const isCurrent = idx === latestNoteIndex;
          const dotClass = isCurrent
            ? styles.noteDotCurrent
            : isPlayed
            ? styles.noteDotPlayed
            : '';

          return (
            <div
              key={idx}
              className={`${styles.noteDot} ${dotClass}`}
            >
              {semitonesToInterval(interval)}
            </div>
          );
        })}
      </div>

      {/* Key range progress */}
      <div className={styles.keyRange}>
        <div className={styles.keyRangeLabel}>
          <span>{startKeyName}</span>
          <span>{endKeyName}</span>
        </div>
        <div className={styles.keyRangeTrack}>
          <div
            className={styles.keyRangeFill}
            style={{ width: `${Math.max(0, keyProgress)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
