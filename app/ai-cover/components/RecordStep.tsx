'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { uploadRecording } from '@/lib/ai-cover';
import { createClient } from '@/lib/supabase/client';
import AudioRecorder from '@/components/ai-cover/AudioRecorder';
import FileDropZone from '@/components/ai-cover/FileDropZone';
import styles from './RecordStep.module.css';

interface RecordStepProps {
  userId: string;
}

interface Recording {
  name: string;
  path: string;
  created_at: string | null;
}

export default function RecordStep({ userId }: RecordStepProps) {
  const { setStep } = useAiCoverStore();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from('ai-cover-models')
      .list(userId, { sortBy: { column: 'created_at', order: 'desc' } });
    if (data) {
      setRecordings(
        data
          .filter((f) => f.name.endsWith('.wav'))
          .map((f) => ({
            name: f.name,
            path: `${userId}/${f.name}`,
            created_at: f.created_at,
          })),
      );
    }
  }, [userId]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const handleRecordingComplete = useCallback(
    async (blob: Blob) => {
      setUploading(true);
      setError(null);
      try {
        const fileName = `recording_${Date.now()}.wav`;
        await uploadRecording(blob, fileName);
        await loadRecordings();
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드 실패');
      } finally {
        setUploading(false);
      }
    },
    [loadRecordings],
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        await uploadRecording(file, file.name);
        await loadRecordings();
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드 실패');
      } finally {
        setUploading(false);
      }
    },
    [loadRecordings],
  );

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>음성 녹음</h2>
        <p className={styles.cardDesc}>
          모델 학습에 사용할 목소리를 녹음하세요. 최소 30초 이상 권장합니다.
        </p>
        <AudioRecorder onRecordingComplete={handleRecordingComplete} />
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>파일 업로드</h2>
        <p className={styles.cardDesc}>이미 녹음된 파일이 있다면 업로드하세요.</p>
        <FileDropZone onFileSelected={handleFileSelected} disabled={uploading} />
      </div>

      {uploading && <p className={styles.status}>업로드 중...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {recordings.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>녹음 목록</h2>
          <ul className={styles.recordingList}>
            {recordings.map((r) => (
              <li key={r.path} className={styles.recordingItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                <span className={styles.recordingName}>{r.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        className={styles.nextBtn}
        onClick={() => setStep('model')}
        disabled={recordings.length === 0}
      >
        다음: 모델 생성
      </button>
    </div>
  );
}
