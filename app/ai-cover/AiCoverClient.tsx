'use client';

import { useEffect } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { getMonthlyUsage } from '@/lib/ai-cover';
import StepIndicator from './components/StepIndicator';
import UsageCounter from './components/UsageCounter';
import RecordStep from './components/RecordStep';
import ModelStep from './components/ModelStep';
import ConvertStep from './components/ConvertStep';
import ResultStep from './components/ResultStep';
import styles from './AiCoverClient.module.css';

interface AiCoverClientProps {
  userId: string;
}

export default function AiCoverClient({ userId }: AiCoverClientProps) {
  const { currentStep, monthlyUsage, monthlyLimit, setMonthlyUsage } =
    useAiCoverStore();

  useEffect(() => {
    getMonthlyUsage()
      .then(setMonthlyUsage)
      .catch(console.error);
  }, [setMonthlyUsage]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>AI 커버</h1>
      <p className={styles.subtitle}>내 목소리로 좋아하는 노래를 불러보세요</p>

      <StepIndicator currentStep={currentStep} />
      <UsageCounter usage={monthlyUsage} limit={monthlyLimit} />

      <div className={styles.stepContent}>
        {currentStep === 'record' && <RecordStep userId={userId} />}
        {currentStep === 'model' && <ModelStep />}
        {currentStep === 'convert' && <ConvertStep />}
        {currentStep === 'result' && <ResultStep />}
      </div>
    </div>
  );
}
