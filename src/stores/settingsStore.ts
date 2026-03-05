import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameRules } from '../engine/types.js';

interface SettingsState {
  rules: GameRules;
  stealth: boolean;
  /** TC below which wong-out is suggested */
  wongOutThreshold: number;
  /** TC above which wong-in is suggested */
  wongInThreshold: number;

  setRules: (rules: Partial<GameRules>) => void;
  toggleStealth: () => void;
  setWongThresholds: (wongIn: number, wongOut: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      rules: {
        decks: 8,
        dealerStandsOnSoft17: true,
        doubleAfterSplit: false,
        lateSurrender: false,
        doubleAnyTwo: true,
      },
      stealth: false,
      wongOutThreshold: 1,
      wongInThreshold: 1,

      setRules: (partial) =>
        set((state) => ({ rules: { ...state.rules, ...partial } })),
      toggleStealth: () =>
        set((state) => ({ stealth: !state.stealth })),
      setWongThresholds: (wongIn, wongOut) =>
        set({ wongInThreshold: wongIn, wongOutThreshold: wongOut }),
    }),
    { name: 'card-counter-settings' },
  ),
);
