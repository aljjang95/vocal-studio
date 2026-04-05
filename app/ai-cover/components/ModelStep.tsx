'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { getModels, startTraining } from '@/lib/ai-cover';
import { createClient } from '@/lib/supabase/client';
import type { VoiceModel } from '@/types';
import styles from './ModelStep.module.css';

export default function ModelStep() {
  const { setStep, selectModel, selectedModelId } = useAiCoverStore();
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [modelName, setModelName] = useState('');
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const data = await getModels();
      setModels(data);
    } catch (err) {
      console.error('모델 목록 로딩 실패:', err);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 녹음 파일 목록 불러오기
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.storage
        .from('ai-cover-models')
        .list(user.id, { sortBy: { column: 'created_at', order: 'desc' } });
      if (data) {
        setRecordings(
          data.filter((f) => f.name.endsWith('.wav')).map((f) => `${user.id}/${f.name}`),
        );
      }
    })();
  }, []);

  // 폴링: 학습 중인 모델 상태
  useEffect(() => {
    const trainingModels = models.filter((m) => m.status === 'training' || m.status === 'pending');
    if (trainingModels.length === 0) return;

    const interval = setInterval(loadModels, 5000);
    return () => clearInterval(interval);
  }, [models, loadModels]);

  const togglePath = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const handleTrain = async () => {
    if (!modelName.trim() || selectedPaths.length === 0) return;
    setTraining(true);
    setError(null);
    try {
      await startTraining(selectedPaths, modelName.trim());
      setModelName('');
      setSelectedPaths([]);
      await loadModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : '학습 요청 실패');
    } finally {
      setTraining(false);
    }
  };

  const handleSelectModel = (model: VoiceModel) => {
    selectModel(model);
  };

  const statusLabel: Record<string, string> = {
    pending: '대기 중',
    training: '학습 중...',
    completed: '완료',
    failed: '실패',
  };

  return (
    <div className={styles.container}>
      {/* 새 모델 학습 */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>새 모델 만들기</h2>

        {recordings.length > 0 && (
          <div className={styles.checkboxList}>
            {recordings.map((path) => (
              <label key={path} className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={selectedPaths.includes(path)}
                  onChange={() => togglePath(path)}
                />
                <span>{path.split('/').pop()}</span>
              </label>
            ))}
          </div>
        )}

        <input
          className={styles.input}
          placeholder="모델 이름 (예: 내 목소리 v1)"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
        />

        <button
          className={styles.trainBtn}
          onClick={handleTrain}
          disabled={training || !modelName.trim() || selectedPaths.length === 0}
        >
          {training ? '학습 요청 중...' : '모델 만들기'}
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </div>

      {/* 기존 모델 목록 */}
      {models.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>내 모델</h2>
          <ul className={styles.modelList}>
            {models.map((model) => (
              <li
                key={model.id}
                className={`${styles.modelItem} ${selectedModelId === model.id ? styles.modelItemSelected : ''}`}
              >
                <div className={styles.modelInfo}>
                  <span className={styles.modelName}>{model.name}</span>
                  <span
                    className={`${styles.modelStatus} ${model.status === 'completed' ? styles.statusDone : model.status === 'failed' ? styles.statusFail : ''}`}
                  >
                    {statusLabel[model.status] ?? model.status}
                  </span>
                </div>
                {model.status === 'completed' && (
                  <button
                    className={styles.selectBtn}
                    onClick={() => handleSelectModel(model)}
                  >
                    {selectedModelId === model.id ? '선택됨' : '이 모델 사용'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.navRow}>
        <button className={styles.backBtn} onClick={() => setStep('record')}>
          이전
        </button>
        <button
          className={styles.nextBtn}
          onClick={() => setStep('convert')}
          disabled={!selectedModelId}
        >
          다음: 변환
        </button>
      </div>
    </div>
  );
}
