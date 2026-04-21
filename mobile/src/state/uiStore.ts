import { create } from 'zustand';

interface UIState {
  personalWorkIndex: number;
  setPersonalWorkIndex: (i: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  personalWorkIndex: 0,
  setPersonalWorkIndex: (i) => set({ personalWorkIndex: i }),
}));
