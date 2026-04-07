'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Plan = 'free' | 'subscription' | 'pro';

interface BillingState {
  plan: Plan;
  yearly: boolean;
  toggle: () => void;
  setPlan: (plan: Plan) => void;
  isPro: () => boolean;
  isSubscription: () => boolean;
  canAccessStage: (stageId: number) => boolean;
  showAds: () => boolean;
  aiCoverLimit: () => number;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      plan: 'free',
      yearly: false,
      toggle: () => set((s) => ({ yearly: !s.yearly })),
      setPlan: (plan) => set({ plan }),
      isPro: () => get().plan === 'pro',
      isSubscription: () => get().plan === 'subscription' || get().plan === 'pro',
      canAccessStage: (stageId: number) => {
        if (stageId <= 18) return true;
        return get().plan === 'pro';
      },
      showAds: () => get().plan === 'free',
      aiCoverLimit: () => {
        const p = get().plan;
        if (p === 'pro') return 5;
        if (p === 'subscription') return 3;
        return 0;
      },
    }),
    {
      name: 'hlb-billing',
      partialize: (s) => ({ plan: s.plan, yearly: s.yearly }),
    },
  ),
);
