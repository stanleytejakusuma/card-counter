import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Card, HandPhase, PlayerHand, PlayerSeat, Rank } from '../engine/types.js';
import type { HandOutcome } from '../engine/historyTypes.js';
import { createCard, getCardCountValue } from '../engine/counting.js';
import { calculateHandTotal } from '../engine/hand.js';

let _nextId = 0;
function generateId(): string {
  return `${Date.now()}-${++_nextId}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyHand(fromSplit = false): PlayerHand {
  return { cards: [], doubled: false, fromSplit };
}

function createEmptySeats(seatNumbers: number[]): PlayerSeat[] {
  return seatNumbers.map((n) => ({
    seatNumber: n,
    hands: [createEmptyHand()],
    activeHandIndex: 0,
    betOverride: null,
  }));
}

interface ConfirmedSeatHand {
  id: string;
  cards: Card[];
  doubled: boolean;
  fromSplit: boolean;
}

interface LastConfirmedRound {
  dealerUpcard: Card;
  seats: {
    seatNumber: number;
    hands: ConfirmedSeatHand[];
    betOverride: number | null;
  }[];
}

export interface RoundSnapshot {
  dealerUpcard: Card;
  seats: {
    seatNumber: number;
    hands: {
      id: string;
      cards: Card[];
      doubled: boolean;
      fromSplit: boolean;
      total: number;
      outcome?: HandOutcome;
      netResult?: number;
    }[];
    betAmount: number;
  }[];
  tableCards: Card[];
  runningCount: number;
  trueCount: number;
  timestamp: number;
}

interface GameState {
  runningCount: number;
  cardsSeen: number;
  cardHistory: Card[];

  handPhase: HandPhase;
  dealerUpcard: Card | null;
  seats: PlayerSeat[];
  activeSeatIndex: number;
  playerSeatNumbers: number[];
  occupiedSeatNumbers: number[];  // other players' seats (visual only)

  isWongedOut: boolean;

  _lastCardSeatIndex: number | null;

  currentShoeId: string | null;
  shoeHandCount: number;
  lastConfirmedRound: LastConfirmedRound | null;
  tableCards: Card[];
  peakTrueCount: number;
  minTrueCount: number;

  shoeRoundHistory: RoundSnapshot[];

  inputCard: (rank: Rank) => void;
  undoLastCard: () => void;
  undoCurrentHand: () => void;
  confirmHand: () => void;
  setHandPhase: (phase: HandPhase) => void;
  toggleWong: () => void;
  newShoe: () => void;
  nextHand: () => void;
  updateTrueCountExtremes: (tc: number) => void;

  splitHand: () => void;
  doubleDown: () => void;
  setBetOverride: (seatIndex: number, amount: number | null) => void;
  setPlayerSeats: (seatNumbers: number[]) => void;
  toggleSeat: (seatNumber: number) => void;
  toggleOccupiedSeat: (seatNumber: number) => void;
  setActiveSeat: (index: number) => void;
  nextHandOrSeat: () => void;
  updateRoundOutcome: (roundIndex: number, seatIndex: number, handIndex: number, outcome: HandOutcome, netResult: number) => void;

  // Legacy compat — point to seat equivalents
  readonly numBoxes: number;
  setNumBoxes: (n: number) => void;
  setActiveBox: (index: number) => void;
  nextBox: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      runningCount: 0,
      cardsSeen: 0,
      cardHistory: [],

      handPhase: 'idle',
      dealerUpcard: null,
      seats: [{ seatNumber: 1, hands: [createEmptyHand()], activeHandIndex: 0, betOverride: null }],
      activeSeatIndex: 0,
      playerSeatNumbers: [1],
      occupiedSeatNumbers: [],
      isWongedOut: false,

      _lastCardSeatIndex: null,

      currentShoeId: null,
      shoeHandCount: 0,
      lastConfirmedRound: null,
      tableCards: [],
      peakTrueCount: 0,
      minTrueCount: 0,

      shoeRoundHistory: [],

      // Legacy compat
      get numBoxes(): number {
        return get().playerSeatNumbers.length;
      },

      inputCard: (rank: Rank) => {
        const card = createCard(rank);
        const countDelta = getCardCountValue(rank);
        const state = get();

        const updates: Partial<GameState> = {
          runningCount: state.runningCount + countDelta,
          cardsSeen: state.cardsSeen + 1,
          cardHistory: [...state.cardHistory, card],
        };

        if (!state.currentShoeId) {
          updates.currentShoeId = generateId();
        }

        if (state.handPhase === 'idle' && state.lastConfirmedRound) {
          updates.lastConfirmedRound = null;
        }

        if (state.handPhase === 'table') {
          updates.tableCards = [...state.tableCards, card];
        } else if (state.handPhase === 'idle') {
          updates.handPhase = 'player';
          updates.dealerUpcard = card;
          updates.activeSeatIndex = 0;
        } else if (state.handPhase === 'dealer') {
          updates.dealerUpcard = card;
          updates.handPhase = 'player';
          updates.activeSeatIndex = 0;
        } else if (state.handPhase === 'player') {
          const seat = state.seats[state.activeSeatIndex];
          const hand = seat.hands[seat.activeHandIndex];

          const newHand: PlayerHand = {
            ...hand,
            cards: [...hand.cards, card],
          };

          const newHands = seat.hands.map((h, j) =>
            j === seat.activeHandIndex ? newHand : h,
          );
          const newSeat: PlayerSeat = { ...seat, hands: newHands };
          const newSeats = state.seats.map((s, i) =>
            i === state.activeSeatIndex ? newSeat : s,
          );
          updates.seats = newSeats;
          updates._lastCardSeatIndex = state.activeSeatIndex;

          const allHad2Before = state.seats.every((s) => s.hands[0].cards.length >= 2);

          if (!allHad2Before) {
            // DEAL MODE — round-robin across seats
            const allHave2Now = newSeats.every((s) => s.hands[0].cards.length >= 2);
            if (allHave2Now) {
              updates.activeSeatIndex = 0; // park on first seat for play
            } else {
              updates.activeSeatIndex = (state.activeSeatIndex + 1) % state.seats.length;
            }
          } else {
            // PLAY MODE — existing double/split auto-advance
            const shouldAdvance =
              (newHand.doubled && newHand.cards.length === 3) ||
              (newHand.fromSplit && hand.cards.length === 0 && newHand.cards[0]?.rank === 'A' && newHand.cards.length === 2);

            if (shouldAdvance) {
              if (seat.activeHandIndex < newHands.length - 1) {
                const advSeat = { ...newSeat, activeHandIndex: seat.activeHandIndex + 1 };
                updates.seats = newSeats.map((s, i) =>
                  i === state.activeSeatIndex ? advSeat : s,
                );
              } else if (state.activeSeatIndex < state.seats.length - 1) {
                updates.activeSeatIndex = state.activeSeatIndex + 1;
                const nextSeat = state.seats[state.activeSeatIndex + 1];
                const resetSeat = { ...nextSeat, activeHandIndex: 0 };
                updates.seats = (updates.seats ?? newSeats).map((s, i) =>
                  i === state.activeSeatIndex + 1 ? resetSeat : s,
                );
              }
            }
          }
        }

        set(updates);
      },

      undoLastCard: () => {
        const state = get();
        if (state.cardHistory.length === 0) return;

        const lastCard = state.cardHistory[state.cardHistory.length - 1];
        const countDelta = getCardCountValue(lastCard.rank);

        const updates: Partial<GameState> = {
          runningCount: state.runningCount - countDelta,
          cardsSeen: state.cardsSeen - 1,
          cardHistory: state.cardHistory.slice(0, -1),
        };

        if (state.handPhase === 'table' && state.tableCards.length > 0) {
          updates.tableCards = state.tableCards.slice(0, -1);
        } else if (state.handPhase === 'player') {
          // If last card went to a different seat (deal-mode wrap), undo from that seat
          const undoSeatIdx = (state._lastCardSeatIndex !== null && state._lastCardSeatIndex !== state.activeSeatIndex)
            ? state._lastCardSeatIndex
            : state.activeSeatIndex;
          updates._lastCardSeatIndex = null;

          if (undoSeatIdx !== state.activeSeatIndex) {
            // Deal-mode undo: remove last card from the seat that received it, restore that seat as active
            const targetSeat = state.seats[undoSeatIdx];
            const targetHand = targetSeat.hands[targetSeat.activeHandIndex];
            if (targetHand.cards.length > 0) {
              const newHand = { ...targetHand, cards: targetHand.cards.slice(0, -1) };
              const newHands = targetSeat.hands.map((h, j) =>
                j === targetSeat.activeHandIndex ? newHand : h,
              );
              const newSeat: PlayerSeat = { ...targetSeat, hands: newHands };
              updates.seats = state.seats.map((s, i) =>
                i === undoSeatIdx ? newSeat : s,
              );
              updates.activeSeatIndex = undoSeatIdx;
            }
            set(updates);
            return;
          }

          const seat = state.seats[state.activeSeatIndex];
          const hand = seat.hands[seat.activeHandIndex];

          if (hand.cards.length > 0) {
            let newHand = { ...hand, cards: hand.cards.slice(0, -1) };

            // Un-double: if was doubled and removing the 3rd card
            if (hand.doubled && hand.cards.length === 3) {
              newHand = { ...newHand, doubled: false };
            }

            // Un-split check: active hand has 1 card, fromSplit, and it's the second split hand
            // meaning we just split and each hand got their base card
            if (newHand.cards.length === 0 && newHand.fromSplit && seat.hands.length > 1) {
              // Check if previous hand also has exactly 1 card and is fromSplit
              const prevHandIdx = seat.activeHandIndex - 1;
              if (prevHandIdx >= 0) {
                const prevHand = seat.hands[prevHandIdx];
                if (prevHand.fromSplit && prevHand.cards.length === 1) {
                  // Un-split: merge back — restore pair
                  const mergedHand: PlayerHand = {
                    cards: [prevHand.cards[0], lastCard],
                    doubled: false,
                    fromSplit: false,
                  };
                  const newHands = seat.hands.filter((_, j) => j !== seat.activeHandIndex);
                  newHands[prevHandIdx] = mergedHand;
                  const newSeat: PlayerSeat = { ...seat, hands: newHands, activeHandIndex: prevHandIdx };
                  updates.seats = state.seats.map((s, i) =>
                    i === state.activeSeatIndex ? newSeat : s,
                  );
                  set(updates);
                  return;
                }
              }
            }

            const newHands = seat.hands.map((h, j) =>
              j === seat.activeHandIndex ? newHand : h,
            );
            const newSeat: PlayerSeat = { ...seat, hands: newHands };
            updates.seats = state.seats.map((s, i) =>
              i === state.activeSeatIndex ? newSeat : s,
            );
          } else if (seat.activeHandIndex > 0) {
            // Move to previous hand in this seat
            const prevIdx = seat.activeHandIndex - 1;
            const prevHand = seat.hands[prevIdx];
            if (prevHand.cards.length > 0) {
              let newPrevHand = { ...prevHand, cards: prevHand.cards.slice(0, -1) };
              if (prevHand.doubled && prevHand.cards.length === 3) {
                newPrevHand = { ...newPrevHand, doubled: false };
              }
              const newHands = seat.hands.map((h, j) =>
                j === prevIdx ? newPrevHand : h,
              );
              const newSeat: PlayerSeat = { ...seat, hands: newHands, activeHandIndex: prevIdx };
              updates.seats = state.seats.map((s, i) =>
                i === state.activeSeatIndex ? newSeat : s,
              );
            }
          } else if (state.activeSeatIndex > 0) {
            // Move to previous seat's last hand
            const prevSeatIdx = state.activeSeatIndex - 1;
            const prevSeat = state.seats[prevSeatIdx];
            const lastHandIdx = prevSeat.hands.length - 1;
            const prevHand = prevSeat.hands[lastHandIdx];
            if (prevHand.cards.length > 0) {
              let newPrevHand = { ...prevHand, cards: prevHand.cards.slice(0, -1) };
              if (prevHand.doubled && prevHand.cards.length === 3) {
                newPrevHand = { ...newPrevHand, doubled: false };
              }
              const newHands = prevSeat.hands.map((h, j) =>
                j === lastHandIdx ? newPrevHand : h,
              );
              const newPrevSeat: PlayerSeat = { ...prevSeat, hands: newHands, activeHandIndex: lastHandIdx };
              updates.seats = state.seats.map((s, i) =>
                i === prevSeatIdx ? newPrevSeat : s,
              );
              updates.activeSeatIndex = prevSeatIdx;
            }
          } else {
            // First seat, first hand, no cards — undo dealer
            updates.dealerUpcard = null;
            updates.handPhase = 'idle';
          }
        } else if (state.handPhase === 'dealer') {
          updates.dealerUpcard = null;
          updates.handPhase = 'idle';
        }

        set(updates);
      },

      undoCurrentHand: () => {
        const state = get();
        const handCards: Card[] = [];
        if (state.dealerUpcard) handCards.push(state.dealerUpcard);
        for (const seat of state.seats) {
          for (const hand of seat.hands) {
            handCards.push(...hand.cards);
          }
        }

        if (handCards.length === 0) return;

        let rc = state.runningCount;
        for (const card of handCards) {
          rc -= getCardCountValue(card.rank);
        }

        set({
          runningCount: rc,
          cardsSeen: state.cardsSeen - handCards.length,
          cardHistory: state.cardHistory.slice(0, -handCards.length),
          handPhase: 'idle',
          dealerUpcard: null,
          seats: createEmptySeats(state.playerSeatNumbers),
          activeSeatIndex: 0,
          _lastCardSeatIndex: null,
        });
      },

      confirmHand: () => {
        const state = get();

        let lastConfirmedRound: LastConfirmedRound | null = null;
        const hasCards = state.seats.some((s) => s.hands.some((h) => h.cards.length > 0));
        if (state.dealerUpcard && hasCards) {
          lastConfirmedRound = {
            dealerUpcard: state.dealerUpcard,
            seats: state.seats.map((seat) => ({
              seatNumber: seat.seatNumber,
              hands: seat.hands
                .filter((h) => h.cards.length > 0)
                .map((h) => ({
                  id: generateId(),
                  cards: [...h.cards],
                  doubled: h.doubled,
                  fromSplit: h.fromSplit,
                })),
              betOverride: seat.betOverride,
            })),
          };
        }

        // Count total hands across all seats
        let totalHands = 0;
        for (const seat of state.seats) {
          for (const hand of seat.hands) {
            if (hand.cards.length > 0) totalHands++;
          }
        }

        // Push RoundSnapshot (outcomes pending)
        let newHistory = state.shoeRoundHistory;
        if (lastConfirmedRound && state.dealerUpcard) {
          const snapshot: RoundSnapshot = {
            dealerUpcard: state.dealerUpcard,
            seats: lastConfirmedRound.seats.map((s) => ({
              seatNumber: s.seatNumber,
              hands: s.hands.map((h) => ({
                id: h.id,
                cards: h.cards,
                doubled: h.doubled,
                fromSplit: h.fromSplit,
                total: calculateHandTotal(h.cards).total,
              })),
              betAmount: 0, // Will be set by historyRecorder
            })),
            tableCards: [],
            runningCount: state.runningCount,
            trueCount: 0, // Will be calculated by consumer
            timestamp: Date.now(),
          };
          newHistory = [...state.shoeRoundHistory, snapshot];
        }

        // Preserve betOverride across rounds
        const newSeats = state.playerSeatNumbers.map((n) => {
          const oldSeat = state.seats.find((s) => s.seatNumber === n);
          return {
            seatNumber: n,
            hands: [createEmptyHand()],
            activeHandIndex: 0,
            betOverride: oldSeat?.betOverride ?? null,
          };
        });

        set({
          handPhase: 'table',
          dealerUpcard: null,
          seats: newSeats,
          activeSeatIndex: 0,
          tableCards: [],
          lastConfirmedRound,
          shoeHandCount: state.shoeHandCount + totalHands,
          shoeRoundHistory: newHistory,
          _lastCardSeatIndex: null,
        });
      },

      nextHand: () => set((state) => ({
        handPhase: 'idle',
        tableCards: [],
        lastConfirmedRound: null,
        seats: createEmptySeats(state.playerSeatNumbers).map((s) => {
          const old = state.seats.find((os) => os.seatNumber === s.seatNumber);
          return old ? { ...s, betOverride: old.betOverride } : s;
        }),
        activeSeatIndex: 0,
        _lastCardSeatIndex: null,
      })),

      setHandPhase: (phase: HandPhase) => {
        const updates: Partial<GameState> = { handPhase: phase };
        if (phase === 'player') {
          updates.activeSeatIndex = 0;
        }
        set(updates);
      },

      toggleWong: () => set((state) => ({ isWongedOut: !state.isWongedOut })),

      newShoe: () =>
        set((state) => ({
          runningCount: 0,
          cardsSeen: 0,
          cardHistory: [],
          handPhase: 'idle',
          dealerUpcard: null,
          seats: createEmptySeats(state.playerSeatNumbers).map((s) => {
            const old = state.seats.find((os) => os.seatNumber === s.seatNumber);
            return old ? { ...s, betOverride: old.betOverride } : s;
          }),
          activeSeatIndex: 0,
          tableCards: [],
          isWongedOut: false,
          currentShoeId: generateId(),
          shoeHandCount: 0,
          lastConfirmedRound: null,
          peakTrueCount: 0,
          minTrueCount: 0,
          shoeRoundHistory: [],
          _lastCardSeatIndex: null,
        })),

      updateTrueCountExtremes: (tc: number) => {
        const state = get();
        const updates: Partial<GameState> = {};
        if (tc > state.peakTrueCount) updates.peakTrueCount = tc;
        if (tc < state.minTrueCount) updates.minTrueCount = tc;
        if (Object.keys(updates).length > 0) set(updates);
      },

      splitHand: () => {
        const state = get();
        if (state.handPhase !== 'player') return;

        const seat = state.seats[state.activeSeatIndex];
        const hand = seat.hands[seat.activeHandIndex];

        if (hand.cards.length !== 2) return;
        if (seat.hands.length >= 4) return;

        // Check if pair (same value)
        const total = calculateHandTotal(hand.cards);
        if (!total.isPair) return;

        const card0 = hand.cards[0];
        const card1 = hand.cards[1];

        const newHand0: PlayerHand = { cards: [card0], doubled: false, fromSplit: true };
        const newHand1: PlayerHand = { cards: [card1], doubled: false, fromSplit: true };

        const newHands = [...seat.hands];
        newHands.splice(seat.activeHandIndex, 1, newHand0, newHand1);

        const newSeat: PlayerSeat = { ...seat, hands: newHands, activeHandIndex: seat.activeHandIndex };
        set({
          seats: state.seats.map((s, i) =>
            i === state.activeSeatIndex ? newSeat : s,
          ),
        });
      },

      doubleDown: () => {
        const state = get();
        if (state.handPhase !== 'player') return;

        const seat = state.seats[state.activeSeatIndex];
        const hand = seat.hands[seat.activeHandIndex];

        if (hand.cards.length !== 2) return;
        if (hand.doubled) return;

        const newHand: PlayerHand = { ...hand, doubled: true };
        const newHands = seat.hands.map((h, j) =>
          j === seat.activeHandIndex ? newHand : h,
        );
        const newSeat: PlayerSeat = { ...seat, hands: newHands };
        set({
          seats: state.seats.map((s, i) =>
            i === state.activeSeatIndex ? newSeat : s,
          ),
        });
      },

      setBetOverride: (seatIndex: number, amount: number | null) => {
        const state = get();
        if (seatIndex < 0 || seatIndex >= state.seats.length) return;
        const newSeats = state.seats.map((s, i) =>
          i === seatIndex ? { ...s, betOverride: amount } : s,
        );
        set({ seats: newSeats });
      },

      setPlayerSeats: (seatNumbers: number[]) => {
        const state = get();
        if (state.handPhase !== 'idle') return;
        const clamped = seatNumbers.filter((n) => n >= 1 && n <= 7).slice(0, 4);
        if (clamped.length === 0) return;
        const sorted = [...new Set(clamped)].sort((a, b) => a - b);
        // Preserve betOverrides
        const newSeats = sorted.map((n) => {
          const old = state.seats.find((s) => s.seatNumber === n);
          return {
            seatNumber: n,
            hands: [createEmptyHand()],
            activeHandIndex: 0,
            betOverride: old?.betOverride ?? null,
          };
        });
        set({
          playerSeatNumbers: sorted,
          seats: newSeats,
          activeSeatIndex: 0,
        });
      },

      toggleSeat: (seatNumber: number) => {
        const state = get();
        if (state.handPhase !== 'idle') return;
        if (seatNumber < 1 || seatNumber > 7) return;

        let newNumbers: number[];
        if (state.playerSeatNumbers.includes(seatNumber)) {
          // Remove — but don't allow removing last seat
          if (state.playerSeatNumbers.length <= 1) return;
          newNumbers = state.playerSeatNumbers.filter((n) => n !== seatNumber);
        } else {
          // Add — max 4
          if (state.playerSeatNumbers.length >= 4) return;
          newNumbers = [...state.playerSeatNumbers, seatNumber].sort((a, b) => a - b);
        }

        const newSeats = newNumbers.map((n) => {
          const old = state.seats.find((s) => s.seatNumber === n);
          return old
            ? { ...old, hands: [createEmptyHand()], activeHandIndex: 0 }
            : { seatNumber: n, hands: [createEmptyHand()], activeHandIndex: 0, betOverride: null };
        });

        // Also remove from occupied if it was there
        set({
          playerSeatNumbers: newNumbers,
          occupiedSeatNumbers: state.occupiedSeatNumbers.filter((n) => !newNumbers.includes(n)),
          seats: newSeats,
          activeSeatIndex: 0,
        });
      },

      toggleOccupiedSeat: (seatNumber: number) => {
        const state = get();
        if (seatNumber < 1 || seatNumber > 7) return;
        // Can't mark your own seat as occupied
        if (state.playerSeatNumbers.includes(seatNumber)) return;

        if (state.occupiedSeatNumbers.includes(seatNumber)) {
          set({ occupiedSeatNumbers: state.occupiedSeatNumbers.filter((n) => n !== seatNumber) });
        } else {
          set({ occupiedSeatNumbers: [...state.occupiedSeatNumbers, seatNumber].sort((a, b) => a - b) });
        }
      },

      setActiveSeat: (index: number) => {
        const state = get();
        if (index >= 0 && index < state.seats.length) {
          set({ activeSeatIndex: index });
        }
      },

      nextHandOrSeat: () => {
        const state = get();
        const seat = state.seats[state.activeSeatIndex];

        if (seat.activeHandIndex < seat.hands.length - 1) {
          // Advance hand within seat
          const newSeat: PlayerSeat = { ...seat, activeHandIndex: seat.activeHandIndex + 1 };
          set({
            seats: state.seats.map((s, i) =>
              i === state.activeSeatIndex ? newSeat : s,
            ),
          });
        } else if (state.activeSeatIndex < state.seats.length - 1) {
          // Advance to next seat
          const nextIdx = state.activeSeatIndex + 1;
          const nextSeat = state.seats[nextIdx];
          const resetSeat = { ...nextSeat, activeHandIndex: 0 };
          set({
            activeSeatIndex: nextIdx,
            seats: state.seats.map((s, i) =>
              i === nextIdx ? resetSeat : s,
            ),
          });
        }
        // else: at last hand of last seat — stay
      },

      updateRoundOutcome: (roundIndex: number, seatIndex: number, handIndex: number, outcome: HandOutcome, netResult: number) => {
        const state = get();
        if (roundIndex < 0 || roundIndex >= state.shoeRoundHistory.length) return;

        const newHistory = [...state.shoeRoundHistory];
        const round = { ...newHistory[roundIndex] };
        const newSeats = [...round.seats];
        const seat = { ...newSeats[seatIndex] };
        const newHands = [...seat.hands];
        newHands[handIndex] = { ...newHands[handIndex], outcome, netResult };
        seat.hands = newHands;
        newSeats[seatIndex] = seat;
        round.seats = newSeats;
        newHistory[roundIndex] = round;
        set({ shoeRoundHistory: newHistory });
      },

      // Legacy compat
      setNumBoxes: (n: number) => {
        const state = get();
        if (state.handPhase !== 'idle') return;
        const clamped = Math.max(1, Math.min(4, n));
        const seatNumbers = Array.from({ length: clamped }, (_, i) => i + 1);
        state.setPlayerSeats(seatNumbers);
      },

      setActiveBox: (index: number) => {
        get().setActiveSeat(index);
      },

      nextBox: () => {
        get().nextHandOrSeat();
      },
    }),
    {
      name: 'card-counter-game',
      version: 3,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          return {
            ...persisted,
            playerSeatNumbers: [1],
            occupiedSeatNumbers: [],
            shoeRoundHistory: [],
            lastConfirmedRound: null,
          };
        }
        if (version < 3) {
          const numBoxes = persisted.numBoxes ?? 1;
          return {
            ...persisted,
            playerSeatNumbers: Array.from({ length: numBoxes }, (_, i) => i + 1),
            occupiedSeatNumbers: [],
            shoeRoundHistory: [],
            lastConfirmedRound: null,
          };
        }
        if (!persisted.occupiedSeatNumbers) {
          persisted.occupiedSeatNumbers = [];
        }
      },
      partialize: (state) => ({
        runningCount: state.runningCount,
        cardsSeen: state.cardsSeen,
        cardHistory: state.cardHistory,
        isWongedOut: state.isWongedOut,
        currentShoeId: state.currentShoeId,
        shoeHandCount: state.shoeHandCount,
        peakTrueCount: state.peakTrueCount,
        minTrueCount: state.minTrueCount,
        playerSeatNumbers: state.playerSeatNumbers,
        occupiedSeatNumbers: state.occupiedSeatNumbers,
      }),
    },
  ),
);
