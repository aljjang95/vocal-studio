'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  StageProgress,
  StageStatus,
  UserTier,
  EvaluationResult,
} from '@/types';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';

interface JourneyState {
  userTier: UserTier;
  progress: Record<number, StageProgress>;
  setUserTier: (tier: UserTier) => void;
  getStageStatus: (stageId: number) => StageStatus;
  canAccessStage: (stageId: number) => boolean;
  submitEvaluation: (stageId: number, result: EvaluationResult) => void;
  teacherApprove: (stageId: number) => void;
  getNextAvailableStage: () => number | null;
}

function canAccessTier(userTier: UserTier, minTier: UserTier): boolean {
  const tierOrder: UserTier[] = ['free', 'hobby', 'pro', 'teacher'];
  return tierOrder.indexOf(userTier) >= tierOrder.indexOf(minTier);
}

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({
      userTier: 'free' as UserTier,
      progress: {},

      setUserTier: (tier) => set({ userTier: tier }),

      getStageStatus: (stageId) => {
        const stage = hlbCurriculum.find((s) => s.id === stageId);
        if (!stage) return 'locked';
        const { userTier, progress } = get();
        if (!canAccessTier(userTier, stage.minTier)) return 'locked';
        if (stageId === 1) return progress[stageId]?.status ?? 'available';
        const prev = progress[stageId - 1];
        if (!prev || prev.status !== 'passed') return 'locked';
        return progress[stageId]?.status ?? 'available';
      },

      canAccessStage: (stageId) => {
        const status = get().getStageStatus(stageId);
        return status !== 'locked';
      },

      submitEvaluation: (stageId, result) => {
        set((state) => {
          const prev = state.progress[stageId] ?? {
            stageId,
            status: 'in_progress' as StageStatus,
            bestScore: 0,
            attempts: 0,
            passedAt: null,
            lastFeedback: null,
            teacherApproved: false,
          };
          return {
            progress: {
              ...state.progress,
              [stageId]: {
                ...prev,
                bestScore: Math.max(prev.bestScore, result.score),
                attempts: prev.attempts + 1,
                lastFeedback: result.feedback,
                status: result.passed ? 'passed' : 'in_progress',
                passedAt: result.passed ? new Date().toISOString() : prev.passedAt,
              },
            },
          };
        });
      },

      teacherApprove: (stageId) => {
        set((state) => {
          const prev = state.progress[stageId];
          if (!prev) return state;
          return {
            progress: {
              ...state.progress,
              [stageId]: { ...prev, teacherApproved: true },
            },
          };
        });
      },

      getNextAvailableStage: () => {
        for (const stage of hlbCurriculum) {
          const status = get().getStageStatus(stage.id);
          if (status === 'available' || status === 'in_progress') return stage.id;
        }
        return null;
      },
    }),
    {
      name: 'vocalmind-journey',
      partialize: (state) => ({
        userTier: state.userTier,
        progress: state.progress,
      }),
    },
  ),
);
