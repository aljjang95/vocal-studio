'use client';

import { useState, useEffect } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { getConversionStatus, getStorageUrl } from '@/lib/ai-cover';
import AudioPlayer from '@/components/ai-cover/AudioPlayer';
import type { AiCoverConversion } from '@/types';
import styles from './ResultStep.module.css';

export default function ResultStep() {
  const { conversionId, reset, setStep } = useAiCoverStore();
  const [conversion, setConversion] = useState<AiCoverConversion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversionId) return;
    (async () => {
      try {
        const data = await getConversionStatus(conversionId);
        setConversion(data);
      } catch (err) {
        console.error('결과 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [conversionId]);

  if (loading) {
    return <p className={styles.loadingText}>결과를 불러오는 중...</p>;
  }

  if (!conversion || !conversion.output_path) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>변환 결과를 찾을 수 없습니다.</p>
        <button className={styles.retryBtn} onClick={reset}>
          처음부터 다시
        </button>
      </div>
    );
  }

  const outputUrl = getStorageUrl('ai-cover-outputs', conversion.output_path);
  const originalUrl = conversion.song_id
    ? getStorageUrl('ai-cover-songs', conversion.song_id)
    : null;

  const handleDownload = async (format: 'wav' | 'mp3') => {
    const url = `${outputUrl}${format === 'mp3' ? '?format=mp3' : ''}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-cover.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRestart = () => {
    setStep('convert');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>변환 결과</h2>
        <AudioPlayer
          src={outputUrl}
          compareSrc={originalUrl}
          label="원본"
          compareLabel="AI 커버"
        />
      </div>

      <div className={styles.downloadRow}>
        <button
          className={styles.downloadBtn}
          onClick={() => handleDownload('wav')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          WAV 다운로드
        </button>
        <button
          className={styles.downloadBtn}
          onClick={() => handleDownload('mp3')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          MP3 다운로드
        </button>
      </div>

      <div className={styles.navRow}>
        <button className={styles.retryBtn} onClick={handleRestart}>
          다시 변환하기
        </button>
        <button className={styles.resetBtn} onClick={reset}>
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
