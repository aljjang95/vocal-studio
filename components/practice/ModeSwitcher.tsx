'use client';

import { useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { PracticeMode } from '@/types';
import styles from './ModeSwitcher.module.css';

export default function ModeSwitcher() {
  const { mode, setMode } = usePracticeStore();
  const [showWarning, setShowWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<PracticeMode | null>(null);

  const handleModeClick = useCallback((newMode: PracticeMode) => {
    if (newMode === mode) return;

    if (newMode === 'play') {
      setPendingMode(newMode);
      setShowWarning(true);
    } else {
      setMode(newMode);
    }
  }, [mode, setMode]);

  const confirmModeChange = useCallback(() => {
    if (pendingMode) {
      setMode(pendingMode);
    }
    setShowWarning(false);
    setPendingMode(null);
  }, [pendingMode, setMode]);

  const cancelModeChange = useCallback(() => {
    setShowWarning(false);
    setPendingMode(null);
  }, []);

  return (
    <>
      <div className={styles.switcher}>
        <button
          className={`${styles.modeBtn} ${mode === 'practice' ? styles.modeBtnActive : ''}`}
          onClick={() => handleModeClick('practice')}
        >
          <span className={styles.modeIcon}>&#9881;</span>
          <span className={styles.modeLabel}>Practice</span>
          <span className={styles.modeDesc}>구간 연습</span>
        </button>
        <button
          className={`${styles.modeBtn} ${mode === 'play' ? styles.modeBtnActive : ''}`}
          onClick={() => handleModeClick('play')}
        >
          <span className={styles.modeIcon}>&#9836;</span>
          <span className={styles.modeLabel}>Play</span>
          <span className={styles.modeDesc}>전곡 도전</span>
        </button>
      </div>

      {showWarning && (
        <div className={styles.warningOverlay} onClick={cancelModeChange}>
          <div className={styles.warningDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.warningTitle}>Play 모드 전환</div>
            <p className={styles.warningText}>
              Play 모드에서는 전곡을 처음부터 끝까지 부릅니다.<br />
              MR이 재생되면서 마이크로 녹음하고, 곡이 끝나면 채점 결과를 확인할 수 있습니다.
            </p>
            <div className={styles.warningActions}>
              <button className={styles.warningCancel} onClick={cancelModeChange}>
                취소
              </button>
              <button className={styles.warningConfirm} onClick={confirmModeChange}>
                전환하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
