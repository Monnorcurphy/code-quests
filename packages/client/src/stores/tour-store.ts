import { create } from 'zustand';

export interface TourState {
  active: boolean;
  step: number;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTour: () => void;
  goToStep: (step: number) => void;
}

const TOTAL_STEPS = 12;

export const useTourStore = create<TourState>((set) => ({
  active: false,
  step: 1,
  totalSteps: TOTAL_STEPS,
  startTour: () => set({ active: true, step: 1 }),
  nextStep: () =>
    set((s) => ({ step: Math.min(s.step + 1, TOTAL_STEPS) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  exitTour: () => set({ active: false }),
  goToStep: (step) => set({ step }),
}));
