'use client';

import { create } from 'zustand';

interface BillingState {
  yearly: boolean;
  toggle: () => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  yearly: false,
  toggle: () => set((state) => ({ yearly: !state.yearly })),
}));
