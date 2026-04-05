'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { startConversion, getConversionStatus } from '@/lib/ai-cover';
import FileDropZone from '@/components/ai-cover/FileDropZone';
import styles from './ConvertStep.module.css';

const STATUS_LABEL: Record<string, string> = {
  pending: '대기 중...',
  separating: '보컬 분리 중...',
  converting: '음성 변환 중...',
  mixing: '믹싱 중...',
  completed: '변환 완료!',
  failed: '변환 실패',
};

export default function ConvertStep() {
  const { selectedModel, setStep, conversionId, setConversionId } =
    useAiCoverStore();
  const [songFile, setSongFile] = useState<File | null>(null);
  const [pitchShift, setPitchShift] = useState(0);
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 폴링: 변환 상태 확인
  useEffect(() => {
    if (!conversionId) return;
    if (status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const data = await getConversionStatus(conversionId);
        setStatus(data.status);
        if (data.status === 'failed') {
          setError(data.error_message ?? '변환 중 오류 발생');
        }
      } catch (err) {
        console.error('상태 조회 실패:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [conversionId, status]);

  const handleConvert = useCallback(async () => {
    if (!songFile || !selectedModel) return;
    setConverting(true);
    setError(null);
    setStatus('pending');
    try {
      const { conversionId: id } = await startConversion(
        songFile,
        selectedModel.id,
        pitchShift,
      );
      setConversionId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '변환 요청 실패');
      setStatus(null);
    } finally {
      setConverting(false);
    }
  }, [songFile, selectedModel, pitchShift, setConversionId]);

  const progressPct = (() => {
    switch (status) {
      case 'pending': return 10;
      case 'separating': return 30;
      case 'converting': return 60;
      case 'mixing': return 85;
      case 'completed': return 100;
      default: return 0;
    }
  })();

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>선택된 모델</h2>
        <p className={styles.modelName}>{selectedModel?.name ?? '모델 미선택'}</p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>노래 업로드</h2>
        <p className={styles.cardDesc}>변환하고 싶은 노래 파일을 업로드하세요.</p>
        <FileDropZone
          onFileSelected={(file) => setSongFile(file)}
          disabled={converting || status === 'completed'}
        />
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>피치 조정</h2>
        <div className={styles.sliderRow}>
          <span className={styles.sliderLabel}>-24</span>
          <input
            type="range"
            min={-24}
            max={24}
            step={1}
            value={pitchShift}
            onChange={(e) => setPitchShift(Number(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.sliderLabel}>+24</span>
        </div>
        <p className={styles.pitchValue}>
          {pitchShift > 0 ? `+${pitchShift}` : pitchShift} 반음
        </p>
      </div>

      {/* 진행 상태 */}
      {status && (
        <div className={styles.card}>
          <p className={styles.statusText}>{STATUS_LABEL[status] ?? status}</p>
          <div className={styles.progressBg}>
            <div
              className={`${styles.progressFill} ${status === 'failed' ? styles.progressFailed : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {status === 'completed' ? (
        <button className={styles.nextBtn} onClick={() => setStep('result')}>
          결과 확인
        </button>
      ) : (
        <div className={styles.navRow}>
          <button className={styles.backBtn} onClick={() => setStep('model')}>
            이전
          </button>
          <button
            className={styles.nextBtn}
            onClick={handleConvert}
            disabled={!songFile || !selectedModel || converting || !!conversionId}
          >
            {converting ? '변환 요청 중...' : '변환 시작'}
          </button>
        </div>
      )}
    </div>
  );
}
