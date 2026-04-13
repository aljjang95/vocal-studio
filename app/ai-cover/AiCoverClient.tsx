'use client';

import { useAiCoverStore } from '@/stores/aiCoverStore';
import StepIndicator from './components/StepIndicator';
import UsageCounter from './components/UsageCounter';
import RecordStep from './components/RecordStep';
import ModelStep from './components/ModelStep';
import ConvertStep from './components/ConvertStep';
import ResultStep from './components/ResultStep';

interface AiCoverClientProps {
  userId: string;
}

export default function AiCoverClient({ userId }: AiCoverClientProps) {
  const { currentStep } = useAiCoverStore();

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8 max-sm:px-3 max-sm:py-4">
      <h1 className="text-[1.75rem] font-bold text-[var(--text-primary)] mb-1 max-sm:text-[1.4rem]">AI 커버</h1>
      <p className="text-[var(--text-secondary)] text-[0.95rem] mb-8">내 목소리로 좋아하는 노래를 불러보세요</p>

      <StepIndicator currentStep={currentStep} />
      <UsageCounter />

      <div className="mt-6">
        {currentStep === 'record' && <RecordStep userId={userId} />}
        {currentStep === 'model' && <ModelStep />}
        {currentStep === 'convert' && <ConvertStep />}
        {currentStep === 'result' && <ResultStep />}
      </div>
    </div>
  );
}
