import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HandOutcome } from '../engine/historyTypes.js';
import { updateHandOutcome } from '../db/historyDb.js';

let _nextId = 0;
function generateId(): string {
  return `${Date.now()}-${++_nextId}-${Math.random().toString(36).slice(2, 8)}`;
}

interface PendingOutcome {
  handId: string;
  betAmount: number;
  seatIndex: number;
  seatNumber: number;
  handIndex: number;
  label: string;
  trueCount: number;
}

interface TCBracketRecord {
  w: number;
  l: number;
  p: number;
}

interface TCBrackets {
  negative: TCBracketRecord; // TC <= 0
  low: TCBracketRecord;     // TC 1–1.9
  mid: TCBracketRecord;     // TC 2–3.9
  high: TCBracketRecord;    // TC 4+
}

interface SessionState {
  bankroll: number;
  startingBankroll: number;
  minBet: number;
  maxBet: number;
  unitSize: number;
  kellyFraction: number;
  handsPlayed: number;
  shoesPlayed: number;
  sessionStartTime: number | null;

  currentSessionId: string | null;
  awaitingOutcomes: PendingOutcome[];
  activeOutcomeIndex: number;

  handsWon: number;
  handsLost: number;
  handsPushed: number;
  blackjacks: number;
  deviationsTaken: number;
  tcBrackets: TCBrackets;
  shoePeakTCs: number[];

  setBankroll: (amount: number) => void;
  setStartingBankroll: (amount: number) => void;
  setBettingLimits: (min: number, max: number) => void;
  setUnitSize: (size: number) => void;
  setKellyFraction: (fraction: number) => void;
  incrementHands: () => void;
  incrementShoes: () => void;
  startSession: () => void;
  resetSession: () => void;
  setAwaitingOutcomes: (outcomes: PendingOutcome[]) => void;
  clearAwaitingOutcome: () => void;
  recordOutcome: (outcome: HandOutcome) => void;
  incrementDeviations: () => void;
  recordShoePeakTC: (peakTC: number) => void;

  readonly awaitingOutcome: boolean;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      bankroll: 0,
      startingBankroll: 0,
      minBet: 5,
      maxBet: 100,
      unitSize: 5,
      kellyFraction: 0.25,
      handsPlayed: 0,
      shoesPlayed: 0,
      sessionStartTime: null,

      currentSessionId: null,
      awaitingOutcomes: [],
      activeOutcomeIndex: 0,

      handsWon: 0,
      handsLost: 0,
      handsPushed: 0,
      blackjacks: 0,
      deviationsTaken: 0,
      tcBrackets: {
        negative: { w: 0, l: 0, p: 0 },
        low: { w: 0, l: 0, p: 0 },
        mid: { w: 0, l: 0, p: 0 },
        high: { w: 0, l: 0, p: 0 },
      },
      shoePeakTCs: [],

      get awaitingOutcome(): boolean {
        const state = get();
        return state.awaitingOutcomes.length > 0 && state.activeOutcomeIndex < state.awaitingOutcomes.length;
      },

      setBankroll: (amount) => set({ bankroll: amount }),
      setStartingBankroll: (amount) => set({ startingBankroll: amount, bankroll: amount }),
      setBettingLimits: (min, max) => set({ minBet: min, maxBet: max }),
      setUnitSize: (size) => set({ unitSize: size }),
      setKellyFraction: (fraction) => set({ kellyFraction: fraction }),
      incrementHands: () => set((state) => ({ handsPlayed: state.handsPlayed + 1 })),
      incrementShoes: () => set((state) => ({ shoesPlayed: state.shoesPlayed + 1 })),
      startSession: () =>
        set((state) => ({
          sessionStartTime: state.sessionStartTime ?? Date.now(),
          currentSessionId: state.currentSessionId ?? generateId(),
        })),
      resetSession: () =>
        set((state) => ({
          handsPlayed: 0,
          shoesPlayed: 0,
          sessionStartTime: null,
          bankroll: state.startingBankroll,
          currentSessionId: null,
          awaitingOutcomes: [],
          activeOutcomeIndex: 0,
          handsWon: 0,
          handsLost: 0,
          handsPushed: 0,
          blackjacks: 0,
          deviationsTaken: 0,
          tcBrackets: {
            negative: { w: 0, l: 0, p: 0 },
            low: { w: 0, l: 0, p: 0 },
            mid: { w: 0, l: 0, p: 0 },
            high: { w: 0, l: 0, p: 0 },
          },
          shoePeakTCs: [],
        })),

      setAwaitingOutcomes: (outcomes) =>
        set({ awaitingOutcomes: outcomes, activeOutcomeIndex: 0 }),

      clearAwaitingOutcome: () =>
        set({ awaitingOutcomes: [], activeOutcomeIndex: 0 }),

      recordOutcome: (outcome: HandOutcome) => {
        const state = get();
        if (state.awaitingOutcomes.length === 0 || state.activeOutcomeIndex >= state.awaitingOutcomes.length) return;

        const current = state.awaitingOutcomes[state.activeOutcomeIndex];
        const bet = current.betAmount;
        let netResult: number;
        const counterUpdates: Partial<SessionState> = {};

        switch (outcome) {
          case 'win':
            netResult = bet;
            counterUpdates.handsWon = state.handsWon + 1;
            break;
          case 'loss':
            netResult = -bet;
            counterUpdates.handsLost = state.handsLost + 1;
            break;
          case 'push':
            netResult = 0;
            counterUpdates.handsPushed = state.handsPushed + 1;
            break;
          case 'blackjack':
            netResult = bet * 1.5;
            counterUpdates.blackjacks = state.blackjacks + 1;
            counterUpdates.handsWon = state.handsWon + 1;
            break;
          case 'surrender':
            netResult = -bet * 0.5;
            counterUpdates.handsLost = state.handsLost + 1;
            break;
          case 'even_money':
            netResult = bet;
            counterUpdates.handsWon = state.handsWon + 1;
            break;
        }

        // Bucket TC for bracket stats
        const tc = current.trueCount;
        const bracketKey: keyof TCBrackets =
          tc <= 0 ? 'negative' : tc < 2 ? 'low' : tc < 4 ? 'mid' : 'high';
        const tcField: 'w' | 'l' | 'p' =
          outcome === 'push' ? 'p'
            : (outcome === 'loss' || outcome === 'surrender') ? 'l'
            : 'w';
        const updatedBrackets = { ...state.tcBrackets };
        updatedBrackets[bracketKey] = {
          ...updatedBrackets[bracketKey],
          [tcField]: updatedBrackets[bracketKey][tcField] + 1,
        };

        const nextIndex = state.activeOutcomeIndex + 1;
        const allDone = nextIndex >= state.awaitingOutcomes.length;

        set({
          bankroll: state.bankroll + netResult,
          activeOutcomeIndex: nextIndex,
          ...(allDone ? { awaitingOutcomes: [] as PendingOutcome[], activeOutcomeIndex: 0 } : {}),
          ...counterUpdates,
          tcBrackets: updatedBrackets,
        });

        // Update hand record in IndexedDB (fire-and-forget)
        updateHandOutcome(current.handId, outcome, bet, netResult).catch(console.error);
      },

      incrementDeviations: () =>
        set((state) => ({ deviationsTaken: state.deviationsTaken + 1 })),

      recordShoePeakTC: (peakTC: number) =>
        set((state) => ({ shoePeakTCs: [...state.shoePeakTCs, peakTC] })),
    }),
    {
      name: 'card-counter-session',
      version: 5,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          persisted = {
            ...persisted,
            awaitingOutcomes: [],
            activeOutcomeIndex: 0,
          };
        }
        if (version < 4) {
          persisted = {
            ...persisted,
            tcBrackets: {
              negative: { w: 0, l: 0, p: 0 },
              low: { w: 0, l: 0, p: 0 },
              mid: { w: 0, l: 0, p: 0 },
              high: { w: 0, l: 0, p: 0 },
            },
          };
        }
        if (version < 5) {
          persisted = { ...persisted, shoePeakTCs: [] };
        }
        return persisted;
      },
      partialize: (state) => ({
        bankroll: state.bankroll,
        startingBankroll: state.startingBankroll,
        minBet: state.minBet,
        maxBet: state.maxBet,
        unitSize: state.unitSize,
        kellyFraction: state.kellyFraction,
        handsPlayed: state.handsPlayed,
        shoesPlayed: state.shoesPlayed,
        sessionStartTime: state.sessionStartTime,
        currentSessionId: state.currentSessionId,
        handsWon: state.handsWon,
        handsLost: state.handsLost,
        handsPushed: state.handsPushed,
        blackjacks: state.blackjacks,
        deviationsTaken: state.deviationsTaken,
        tcBrackets: state.tcBrackets,
        shoePeakTCs: state.shoePeakTCs,
      }),
    },
  ),
);
