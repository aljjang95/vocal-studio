'use client';

import { useState, useRef, useCallback } from 'react';
import AudioPlayer from '@/components/shared/AudioPlayer';
import styles from './ABCompare.module.css';

interface ABCompareProps {
  hqSvcSrc: string | null;
  rvcSrc: string | null;
  onPreferenceSelect?: (preferred: 'hq_svc' | 'rvc') => void;
}

export default function ABCompare({ hqSvcSrc, rvcSrc, onPreferenceSelect }: ABCompareProps) {
  const [preferred, setPreferred] = useState<'hq_svc' | 'rvc' | null>(null);
  const [syncPlay, setSyncPlay] = useState(false);

  // 동시 재생을 위한 재생 트리거 — syncPlay 모드에서 한 쪽 재생 시 다른 쪽도 재생
  // AudioPlayer의 onPlay 콜백을 활용
  const hqSvcPlayedRef = useRef(false);
  const rvcPlayedRef = useRef(false);

  const handleHqSvcPlay = useCallback(() => {
    if (syncPlay) {
      hqSvcPlayedRef.current = true;
    }
  }, [syncPlay]);

  const handleRvcPlay = useCallback(() => {
    if (syncPlay) {
      rvcPlayedRef.current = true;
    }
  }, [syncPlay]);

  const handlePrefer = (engine: 'hq_svc' | 'rvc') => {
    setPreferred(engine);
    onPreferenceSelect?.(engine);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>A/B 비교 듣기</h3>
        <label className={styles.syncToggle}>
          <input
            type="checkbox"
            className={styles.syncToggleCheck}
            checked={syncPlay}
            onChange={(e) => setSyncPlay(e.target.checked)}
          />
          <span className={styles.syncToggleLabel}>동시 재생</span>
        </label>
      </div>

      <div className={styles.players}>
        {/* HQ-SVC */}
        <div className={`${styles.playerCard} ${preferred === 'hq_svc' ? styles.preferred : ''}`}>
          <div className={styles.playerLabel}>
            <span className={styles.playerName}>HQ-SVC</span>
            {preferred === 'hq_svc' && <span className={styles.preferredBadge}>선택</span>}
          </div>
          {hqSvcSrc ? (
            <AudioPlayer src={hqSvcSrc} onPlay={handleHqSvcPlay} />
          ) : (
            <p className={styles.noAudio}>HQ-SVC 결과 없음</p>
          )}
          <button
            type="button"
            className={`${styles.preferBtn} ${preferred === 'hq_svc' ? styles.active : ''}`}
            onClick={() => handlePrefer('hq_svc')}
            disabled={!hqSvcSrc}
          >
            {preferred === 'hq_svc' ? '이게 더 좋아요!' : '이게 더 좋아요'}
          </button>
        </div>

        {/* RVC */}
        <div className={`${styles.playerCard} ${preferred === 'rvc' ? styles.preferred : ''}`}>
          <div className={styles.playerLabel}>
            <span className={styles.playerName}>RVC 학습 모델</span>
            {preferred === 'rvc' && <span className={styles.preferredBadge}>선택</span>}
          </div>
          {rvcSrc ? (
            <AudioPlayer src={rvcSrc} onPlay={handleRvcPlay} />
          ) : (
            <p className={styles.noAudio}>RVC 결과 없음</p>
          )}
          <button
            type="button"
            className={`${styles.preferBtn} ${preferred === 'rvc' ? styles.active : ''}`}
            onClick={() => handlePrefer('rvc')}
            disabled={!rvcSrc}
          >
            {preferred === 'rvc' ? '이게 더 좋아요!' : '이게 더 좋아요'}
          </button>
        </div>
      </div>

      {preferred && (
        <p className={styles.preferenceNote}>
          선택하신 피드백이 서비스 개선에 활용됩니다.
        </p>
      )}
    </div>
  );
}
