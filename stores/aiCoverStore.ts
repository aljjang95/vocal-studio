import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VoiceModel, AiCoverStep } from '@/types';

interface AiCoverState {
  currentStep: AiCoverStep;
  selectedModelId: string | null;
  selectedModel: VoiceModel | null;
  conversionId: string | null;
  monthlyUsage: number;
  monthlyLimit: number;

  setStep: (step: AiCoverStep) => void;
  selectModel: (model: VoiceModel) => void;
  setConversionId: (id: string | null) => void;
  setMonthlyUsage: (count: number) => void;
  reset: () => void;
}

export const useAiCoverStore = create<AiCoverState>()(
  persist(
    (set) => ({
      currentStep: 'record',
      selectedModelId: null,
      selectedModel: null,
      conversionId: null,
      monthlyUsage: 0,
      monthlyLimit: 20,

      setStep: (step) => set({ currentStep: step }),
      selectModel: (model) => set({ selectedModelId: model.id, selectedModel: model }),
      setConversionId: (id) => set({ conversionId: id }),
      setMonthlyUsage: (count) => set({ monthlyUsage: count }),
      reset: () => set({
        currentStep: 'record',
        selectedModelId: null,
        selectedModel: null,
        conversionId: null,
      }),
    }),
    {
      name: 'ai-cover-store',
      partialize: (state) => ({
        selectedModelId: state.selectedModelId,
      }),
    }
  )
);
